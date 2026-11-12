// Libreta de puntos (12/11/2026, seguridad). Un documento por persona en
// `libreta/{uid}` con lo que sumó, y las reglas de Firestore controlan cada
// cambio, así nadie se puede poner puntos de la nada:
//   entradas: {entryId: ms}  entradas completadas (una por escritura; la regla
//             exige que `entryProgress` diga completada)
//   juegos:   {clave: ms}    minijuegos ganados (una por escritura; la clave
//             tiene que estar en `juegosValidos/lista` o ser de hoy)
//   gE / gJ:  puntos ganados por entradas / por juegos (solo suben de a lo que
//             vale cada una: `puntosEntradas/{id}` o 1-2 por juego)
//   gastado:  lo gastado en Beneficios (solo sube junto con un canje o aporte
//             y nunca por encima de lo ganado; las devoluciones las hace el admin)
//   ultima:   la clave que se acaba de sumar (la usa la regla)
// El rango, el % y las obligatorias de cada uno se calculan leyendo esto, ya no
// de lo que guardaba cada teléfono en su perfil.
import { collection, doc, setDoc, updateDoc, getDocs, onSnapshot, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { MINIJUEGOS_TITULOS } from '../config/minijuegos-catalogo.js';
import { render } from '../main.js';

var libretaCol = collection(db, 'libreta');
export function libretaRef(uid){ return doc(db, 'libreta', uid); }

export function valorJuego(clave){ return /^(huevo|lluvia|estrellas|zonda|saboteador)-/.test(clave) ? 2 : 1; }
export function puntosEntrada(e){ var p = Number(e && e.puntos); return (e && e.puntos != null && e.puntos !== '' && isFinite(p)) ? Math.max(0, p) : 0; }

export function libretaDe(uid){ return (AppState.libretas && uid && AppState.libretas[uid]) || null; }
export function miLibreta(){ var u = AppState.currentUser; return u ? libretaDe(u.uid) : null; }

function aprobado(){ var u = AppState.currentUser; return !!u && u.role && u.role !== 'pendiente'; }

var renderPend = false;
function pedirRender(){
  if(renderPend) return; renderPend = true;
  setTimeout(function(){ renderPend = false; if(!AppState.formOpen) render(); }, 60);
}

// Todas las libretas (las necesitan el Tablero y Mi comando).
export function ensureLibretasSub(){
  if(AppState.unsubLibretas || !aprobado()) return;
  AppState.unsubLibretas = onSnapshot(libretaCol, function(snap){
    var m = {};
    snap.forEach(function(d){ m[d.id] = d.data(); });
    AppState.libretas = m;
    AppState.libretasLoaded = true;
    pedirRender();
  }, function(e){ console.error('No se pudieron leer las libretas:', e); AppState.libretasLoaded = true; });
  if(AppState.currentUser.role === 'admin' && !AppState.unsubPuntosEntradas){
    AppState.unsubPuntosEntradas = onSnapshot(collection(db, 'puntosEntradas'), function(snap){
      var m = {}; snap.forEach(function(d){ m[d.id] = (d.data() || {}).puntos; });
      AppState.puntosEntradas = m; AppState.puntosEntradasLoaded = true;
    }, function(e){ console.error('No se pudieron leer los puntos de las entradas:', e); });
    AppState.unsubJuegosValidos = onSnapshot(doc(db, 'juegosValidos', 'lista'), function(s){
      AppState.juegosValidos = s.exists() ? (s.data().claves || []) : []; AppState.juegosValidosLoaded = true;
    }, function(e){ console.error('No se pudo leer la lista de juegos:', e); });
  }
}

export function stopLibretasSub(){
  ['unsubLibretas', 'unsubPuntosEntradas', 'unsubJuegosValidos'].forEach(function(k){ if(AppState[k]){ AppState[k](); AppState[k] = null; } });
  AppState.libretas = {}; AppState.libretasLoaded = false;
}

/* ---------- lo de cada uno ---------- */

function completadoLocal(entryId){ var p = AppState.myProgress[entryId]; return !!(p && p.completedAt); }

var enCurso = null, fallas = {}, creando = false;
// Pasa a la libreta lo que falta (de a una entrada por escritura, como pide la regla).
export function sincronizarLibreta(){
  var u = AppState.currentUser;
  if(!aprobado() || AppState.viewAsOverride || !AppState.libretasLoaded || !AppState.myProgressLoaded || AppState.firstSnapshot) return;
  var lib = miLibreta();
  if(!lib){
    if(creando) return; creando = true;
    setDoc(libretaRef(u.uid), { entradas: {}, juegos: {}, gE: 0, gJ: 0, gastado: 0, ultima: '' })
      .catch(function(e){ console.error('No se pudo crear tu libreta de puntos:', e); })
      .finally(function(){ creando = false; });
    return;
  }
  if(enCurso) return;
  var entradas = lib.entradas || {}, ahora = Date.now();
  var porEntry = {}; (AppState.state.entries || []).forEach(function(e){ porEntry[e.id] = e; });
  var falta = Object.keys(AppState.myProgress).find(function(id){
    return completadoLocal(id) && !entradas[id] && !(fallas[id] && ahora - fallas[id] < 60000);
  });
  if(!falta) return;
  enCurso = falta;
  var pts = puntosEntrada(porEntry[falta]);
  var cambio = { entradas: {}, gE: increment(pts), ultima: falta };
  cambio.entradas[falta] = ahora;
  setDoc(libretaRef(u.uid), cambio, { merge: true })
    .then(function(){ delete fallas[falta]; lib.entradas = Object.assign({}, entradas); lib.entradas[falta] = ahora; lib.gE = (lib.gE || 0) + pts; })
    .catch(function(e){ fallas[falta] = Date.now(); console.error('No se pudo sumar la entrada a tu libreta:', e); })
    .finally(function(){ enCurso = null; pedirRender(); });
}

// Minijuego ganado: devuelve los puntos sumados (0 si ya estaba).
export function sumarJuego(clave){
  var u = AppState.currentUser, lib = miLibreta();
  if(!aprobado() || AppState.viewAsOverride || !lib) return 0;
  if(lib.juegos && lib.juegos[clave]) return 0;
  var v = valorJuego(clave), ahora = Date.now();
  lib.juegos = Object.assign({}, lib.juegos || {}); lib.juegos[clave] = ahora; lib.gJ = (lib.gJ || 0) + v;
  var cambio = { juegos: {}, gJ: increment(v), ultima: clave };
  cambio.juegos[clave] = ahora;
  setDoc(libretaRef(u.uid), cambio, { merge: true }).catch(function(e){ console.error('No se pudo guardar el juego:', e); });
  return v;
}

/* ---------- admin ---------- */

// Mantiene al día lo que las reglas usan para validar: los puntos de cada
// entrada (`puntosEntradas`) y las claves de juegos que existen.
var sincAdmin = false;
export function sincronizarAdmin(){
  var u = AppState.currentUser;
  if(!u || u.role !== 'admin' || sincAdmin || AppState.firstSnapshot || !AppState.puntosEntradasLoaded || !AppState.juegosValidosLoaded) return;
  var quiero = {};
  (AppState.state.entries || []).forEach(function(e){ var p = puntosEntrada(e); if(p && !e.deletedAt) quiero[e.id] = p; });
  var hay = AppState.puntosEntradas || {}, ops = [];
  Object.keys(quiero).forEach(function(id){ if(hay[id] !== quiero[id]) ops.push(['set', id, quiero[id]]); });
  Object.keys(hay).forEach(function(id){ if(!(id in quiero)) ops.push(['del', id]); });
  var claves = juegosValidosQuiero();
  var cambiaLista = claves.join('|') !== (AppState.juegosValidos || []).slice().sort().join('|');
  if(!ops.length && !cambiaLista) return;
  sincAdmin = true;
  var lote = writeBatch(db);
  ops.slice(0, 450).forEach(function(o){
    if(o[0] === 'set') lote.set(doc(db, 'puntosEntradas', o[1]), { puntos: o[2] });
    else lote.delete(doc(db, 'puntosEntradas', o[1]));
  });
  if(cambiaLista) lote.set(doc(db, 'juegosValidos', 'lista'), { claves: claves });
  lote.commit().catch(function(e){ console.error('No se pudieron actualizar los puntos de las entradas:', e); })
    .finally(function(){ setTimeout(function(){ sincAdmin = false; }, 2000); });
}

function juegosValidosQuiero(){
  var c = ['huevo-guardia', 'huevo-actividad', 'huevo-botella'];
  (AppState.state.days || []).forEach(function(d){ c.push('dia-' + d.id); });
  Object.keys(MINIJUEGOS_TITULOS).forEach(function(k){ c.push('depto-' + k); });
  return c.sort();
}

// Devolver puntos gastados (cancelar un canje, aportes de una subasta perdida).
export function ajustarGastado(uid, delta){
  if(!uid || !delta) return Promise.resolve();
  return setDoc(libretaRef(uid), { gastado: increment(delta) }, { merge: true });
}

export function borrarJuegosDe(uid){
  var lib = libretaDe(uid);
  if(lib){ lib.juegos = {}; lib.gJ = 0; }
  return updateDoc(libretaRef(uid), { juegos: {}, gJ: 0 });
}

// Pasa los puntos del sistema viejo (perfil + entryProgress + canjes) a las
// libretas. Se toca una vez; se puede repetir sin duplicar (recalcula todo).
export async function migrarPuntos(){
  sincAdmin = false;
  var porEntry = {}; (AppState.state.entries || []).forEach(function(e){ porEntry[e.id] = e; });
  var hechas = {};
  (await getDocs(collection(db, 'entryProgress'))).forEach(function(d){
    var x = d.data() || {};
    if(x.uid && x.entryId && x.completedAt){ (hechas[x.uid] = hechas[x.uid] || {})[x.entryId] = x.completedAt; }
  });
  var actuales = {}; (await getDocs(libretaCol)).forEach(function(d){ actuales[d.id] = d.data() || {}; });
  var beneficios = {}; (await getDocs(collection(db, 'beneficios'))).forEach(function(d){ beneficios[d.id] = d.data() || {}; });
  var gastado = {};
  (await getDocs(collection(db, 'canjes'))).forEach(function(d){
    var c = d.data() || {};
    if(c.uid && c.estado !== 'cancelado') gastado[c.uid] = (gastado[c.uid] || 0) + (Number(c.monto) || 0);
  });
  (await getDocs(collection(db, 'pujas'))).forEach(function(d){
    var p = d.data() || {}, b = beneficios[p.beneficioId];
    if(p.uid && b && b.tipo === 'subasta' && b.estado !== 'cerrada') gastado[p.uid] = (gastado[p.uid] || 0) + (Number(p.monto) || 0);
  });
  var uids = {};
  (AppState.usersList || []).forEach(function(u){ if(u.uid) uids[u.uid] = u; });
  Object.keys(hechas).concat(Object.keys(actuales)).forEach(function(id){ if(!uids[id]) uids[id] = { uid: id }; });
  var lotes = [], lote = writeBatch(db), n = 0, total = 0;
  Object.keys(uids).forEach(function(uid){
    var u = uids[uid], vieja = actuales[uid] || {};
    var entradas = Object.assign({}, vieja.entradas || {}, hechas[uid] || {});
    var juegos = Object.assign({}, (u.juegos && typeof u.juegos === 'object') ? u.juegos : {}, vieja.juegos || {});
    if(!Object.keys(entradas).length && !Object.keys(juegos).length && !gastado[uid] && !actuales[uid]) return;
    var gE = Object.keys(entradas).reduce(function(s, id){ return s + puntosEntrada(porEntry[id]); }, 0);
    var gJ = Object.keys(juegos).reduce(function(s, k){ return s + valorJuego(k); }, 0);
    lote.set(libretaRef(uid), { entradas: entradas, juegos: juegos, gE: gE, gJ: gJ, gastado: gastado[uid] || 0, ultima: '' });
    total++;
    if(++n >= 400){ lotes.push(lote); lote = writeBatch(db); n = 0; }
  });
  lotes.push(lote);
  for(var i = 0; i < lotes.length; i++) await lotes[i].commit();
  return { personas: total };
}
