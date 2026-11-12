// T18 — Los puntos como moneda (07/11/2026). Esqueleto editable: el admin
// prende/apaga el evento desde Perfil, carga los beneficios (compra directa o
// subasta) y marca los canjes como entregados.
//
// Firestore:
//   config/public.tienda   {activa, titulo, moneda, usarEntradas, usarBonus, nota}
//                          (config/** ya deja leer a todos y escribir al admin)
//   beneficios/{id}        {titulo, desc, tipo:'compra'|'subasta', precio, stock|null,
//                           limite|null, vendidos, cierre|null,
//                           estado:'abierta'|'cerrada', ganadorGrupo, montoGanador,
//                           orden, createdAt}
//   canjes/{id}            {uid, nombre, beneficioId, titulo, monto, tipo,
//                           estado:'pendiente'|'entregado'|'cancelado', createdAt}
//   pujas/{id}             aportes a una subasta: {uid, nombre, grupo, beneficioId, monto, createdAt}
//
// Subastas POR COMANDO (pedido del usuario, 07/11/2026): cada sección/depto
// puja con la suma de lo que aporta cada uno de sus miembros (cada uno elige
// cuánto). Gana el comando con más total (que llegue a la puja inicial); a los
// que aportaron en el ganador se les cobra lo suyo (un canje por persona), al
// resto se le devuelve. Grupo = el mismo del Tablero (`grupoSubastaDe()`).
//
// Saldo = puntos ganados (entradas completadas + bonus de minijuegos, según la
// config) − canjes no cancelados − lo «reservado»: lo que aportó a subastas
// todavía abiertas. Gastar NO baja el rango: el rango sigue sobre lo ganado.
import { doc, collection, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query, where, runTransaction, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { miLibreta, libretaRef, ajustarGastado } from './libreta.service.js';
import { renderPanel, render } from '../main.js';

export var TIENDA_DEFAULT = { activa: false, titulo: 'Beneficios', moneda: 'puntos', usarEntradas: true, usarBonus: true, nota: '' };

var beneficiosCol = collection(db, 'beneficios');
var canjesCol = collection(db, 'canjes');
var pujasCol = collection(db, 'pujas');

export function tiendaConfig(){ return Object.assign({}, TIENDA_DEFAULT, AppState.tiendaConfig || {}); }

function aprobado(){ var u = AppState.currentUser; return !!u && u.role && u.role !== 'pendiente'; }

export function puedeVerTienda(){
  if(!aprobado()) return false;
  return tiendaConfig().activa || AppState.currentUser.role === 'admin';
}

function redibujar(){ if(AppState.activeDayId === 'TIENDA') renderPanel(); }

// Config: en vivo para todos (así la pestaña aparece/desaparece sola).
export function ensureTiendaConfigSub(){
  if(AppState.unsubTiendaConfig || !aprobado()) return;
  AppState.unsubTiendaConfig = onSnapshot(doc(db, 'config', 'public'), function(snap){
    var antes = JSON.stringify(AppState.tiendaConfig || null);
    AppState.tiendaConfig = (snap.exists() && snap.data().tienda) || null;
    var primera = !AppState.tiendaConfigLoaded;
    AppState.tiendaConfigLoaded = true;
    if(primera || JSON.stringify(AppState.tiendaConfig) !== antes) render();
  }, function(e){ console.error('No se pudo leer la config de la tienda:', e); AppState.tiendaConfigLoaded = true; render(); });
}

// Beneficios, mis canjes (o todos, si es admin) y pujas: solo con la pestaña visible.
export function ensureTiendaSubs(){
  if(!puedeVerTienda()) return;
  var u = AppState.currentUser;
  if(!AppState.unsubBeneficios){
    AppState.unsubBeneficios = onSnapshot(beneficiosCol, function(snap){
      AppState.beneficios = snap.docs.map(function(d){ return Object.assign({}, d.data(), { id: d.id }); });
      AppState.beneficiosLoaded = true; redibujar();
    }, function(e){ console.error('No se pudieron leer los beneficios:', e); AppState.beneficiosLoaded = true; redibujar(); });
  }
  if(!AppState.unsubCanjes){
    var q = u.role === 'admin' ? canjesCol : query(canjesCol, where('uid', '==', u.uid));
    AppState.unsubCanjes = onSnapshot(q, function(snap){
      AppState.canjes = snap.docs.map(function(d){ return Object.assign({}, d.data(), { id: d.id }); });
      redibujar();
    }, function(e){ console.error('No se pudieron leer los canjes:', e); });
  }
  if(!AppState.unsubPujas){
    AppState.unsubPujas = onSnapshot(pujasCol, function(snap){
      AppState.pujas = snap.docs.map(function(d){ return Object.assign({}, d.data(), { id: d.id }); });
      redibujar();
    }, function(e){ console.error('No se pudieron leer las pujas:', e); });
  }
}

export function stopTiendaSubs(){
  ['unsubTiendaConfig', 'unsubBeneficios', 'unsubCanjes', 'unsubPujas'].forEach(function(k){
    if(AppState[k]){ AppState[k](); AppState[k] = null; }
  });
  AppState.beneficios = []; AppState.canjes = []; AppState.pujas = []; AppState.beneficiosLoaded = false;
  AppState.tiendaConfig = null; AppState.tiendaConfigLoaded = false;
}

/* ---------- saldo ---------- */

export function subastaAbierta(b){ return b.tipo === 'subasta' && b.estado !== 'cerrada'; }
export function subastaVencida(b){ return subastaAbierta(b) && b.cierre && Date.now() >= b.cierre; }

// views/mandos.js se baja recién al abrir Comando o Beneficios (carga
// diferida, 12/11/2026): main.js registra acá su grupoSubastaDe() al cargarlo.
var grupoSubastaFn = null;
export function setGrupoSubasta(fn){ grupoSubastaFn = fn; }
export function miGrupo(){ return grupoSubastaFn ? grupoSubastaFn(AppState.currentUser) : 'Comando central'; }

function aportesDe(beneficioId){
  return (AppState.pujas || []).filter(function(p){ return p.beneficioId === beneficioId; });
}

// Total por comando, de mayor a menor (empate: el que llegó primero a ese total).
export function totalesSubasta(beneficioId){
  var g = {};
  aportesDe(beneficioId).forEach(function(p){
    var k = p.grupo || '—';
    if(!g[k]) g[k] = { grupo: k, total: 0, ultimo: 0, aportes: [] };
    g[k].total += Number(p.monto) || 0;
    g[k].ultimo = Math.max(g[k].ultimo, p.createdAt || 0);
    g[k].aportes.push(p);
  });
  return Object.keys(g).map(function(k){ return g[k]; })
    .sort(function(a, b){ return (b.total - a.total) || (a.ultimo - b.ultimo); });
}

// El comando que va ganando (null si nadie llegó a la puja inicial).
export function grupoGanando(b){
  var t = totalesSubasta(b.id)[0];
  return t && t.total >= Math.max(1, Number(b.precio) || 0) ? t : null;
}

export function miAporte(beneficioId){
  var uid = AppState.currentUser && AppState.currentUser.uid;
  return aportesDe(beneficioId).filter(function(p){ return p.uid === uid; })
    .reduce(function(s, p){ return s + (Number(p.monto) || 0); }, 0);
}

export function misCanjes(){
  var uid = AppState.currentUser && AppState.currentUser.uid;
  return (AppState.canjes || []).filter(function(c){ return c.uid === uid; });
}

// Desde el 12/11/2026 el saldo sale de la libreta (validada por las reglas):
// lo ganado (gE/gJ) menos `gastado`, que sube con cada canje o aporte en el
// mismo lote y solo baja si el admin devuelve. Lo aportado a subastas
// abiertas ya está dentro de `gastado` (se muestra aparte como «reservado»).
export function saldo(){
  var cfg = tiendaConfig(), l = miLibreta() || {};
  var entradas = cfg.usarEntradas ? (Number(l.gE) || 0) : 0;
  var bonus = cfg.usarBonus ? (Number(l.gJ) || 0) : 0;
  var reservado = (AppState.beneficios || []).filter(subastaAbierta).reduce(function(s, b){
    return s + miAporte(b.id);
  }, 0);
  var gastadoTotal = Number(l.gastado) || 0;
  return { entradas: entradas, bonus: bonus, ganado: entradas + bonus, gastado: Math.max(0, gastadoTotal - reservado), reservado: reservado, disponible: Math.max(0, entradas + bonus - gastadoTotal) };
}

/* ---------- acciones de cualquiera ---------- */

function bloqueado(){ return !aprobado() || AppState.viewAsOverride; }

export function quedan(b){ return b.stock == null ? Infinity : Math.max(0, b.stock - (b.vendidos || 0)); }

export function misCanjesDe(beneficioId){
  return misCanjes().filter(function(c){ return c.beneficioId === beneficioId && c.estado !== 'cancelado'; }).length;
}

// Devuelve '' si salió bien, o el motivo.
export function canjear(b){
  if(bloqueado()) return Promise.resolve('No disponible en «Ver como».');
  if(!tiendaConfig().activa) return Promise.resolve('El evento no está activo.');
  if(b.estado === 'cerrada') return Promise.resolve('Este beneficio ya no está disponible.');
  if(quedan(b) <= 0) return Promise.resolve('No quedan más.');
  if(b.limite && misCanjesDe(b.id) >= b.limite) return Promise.resolve('Ya llegaste al máximo por persona.');
  if(saldo().disponible < b.precio) return Promise.resolve('No te alcanzan los ' + tiendaConfig().moneda + '.');
  var u = AppState.currentUser, ref = doc(beneficiosCol, b.id), canjeRef = doc(canjesCol);
  if(!miLibreta()) return Promise.resolve('Todavía no se cargó tu libreta de puntos. Probá de nuevo en un rato.');
  // Todo junto (las reglas lo exigen): una unidad menos, el canje y lo gastado.
  return runTransaction(db, function(tx){
    return tx.get(ref).then(function(s){
      if(!s.exists()) throw new Error('No existe');
      var d = s.data();
      if(d.stock != null && (d.vendidos || 0) >= d.stock) throw new Error('agotado');
      tx.update(ref, { vendidos: (d.vendidos || 0) + 1 });
      tx.set(canjeRef, { uid: u.uid, nombre: u.displayName || '', beneficioId: b.id, titulo: b.titulo || '', monto: Number(b.precio) || 0, tipo: 'compra', estado: 'pendiente', createdAt: Date.now() });
      tx.update(libretaRef(u.uid), { gastado: increment(Number(b.precio) || 0) });
    });
  }).then(function(){ return ''; }).catch(function(e){
    console.error('No se pudo canjear:', e);
    return e && e.message === 'agotado' ? 'No quedan más.' : 'No se pudo canjear (¿faltan publicar las reglas?).';
  });
}

// Suma un aporte propio a la puja del comando de quien aporta.
export function aportar(b, monto){
  monto = Math.floor(Number(monto));
  if(bloqueado()) return Promise.resolve('No disponible en «Ver como».');
  if(!tiendaConfig().activa) return Promise.resolve('El evento no está activo.');
  if(!subastaAbierta(b) || subastaVencida(b)) return Promise.resolve('La subasta ya terminó.');
  if(!(monto >= 1)) return Promise.resolve('Aportá al menos 1.');
  if(saldo().disponible < monto) return Promise.resolve('No te alcanzan los ' + tiendaConfig().moneda + '.');
  var u = AppState.currentUser;
  if(!miLibreta()) return Promise.resolve('Todavía no se cargó tu libreta de puntos. Probá de nuevo en un rato.');
  var lote = writeBatch(db);
  lote.set(doc(pujasCol), { uid: u.uid, nombre: u.displayName || '', grupo: miGrupo(), beneficioId: b.id, monto: monto, createdAt: Date.now() });
  lote.update(libretaRef(u.uid), { gastado: increment(monto) });
  return lote.commit()
    .then(function(){ return ''; })
    .catch(function(e){ console.error('No se pudo pujar:', e); return 'No se pudo pujar (¿faltan publicar las reglas?).'; });
}

/* ---------- admin ---------- */

export function guardarConfigTienda(cambios){
  var cfg = Object.assign(tiendaConfig(), cambios);
  AppState.tiendaConfig = cfg;
  return setDoc(doc(db, 'config', 'public'), { tienda: cfg }, { merge: true });
}

export function guardarBeneficio(b){
  var data = Object.assign({}, b); delete data.id;
  if(b.id) return setDoc(doc(beneficiosCol, b.id), data, { merge: true });
  data.createdAt = Date.now(); data.vendidos = 0; data.estado = 'abierta';
  data.orden = (AppState.beneficios || []).reduce(function(m, x){ return Math.max(m, x.orden || 0); }, 0) + 1;
  return addDoc(beneficiosCol, data);
}

export function borrarBeneficio(id){ return deleteDoc(doc(beneficiosCol, id)); }

// Cierra la subasta: gana el comando con más total. A cada uno de sus
// aportantes se le crea un canje por lo que aportó (ya descontado al
// aportar); al resto se le devuelve lo aportado (queda anotado en
// `devueltos` por si se reabre).
export function cerrarSubasta(b){
  var g = grupoGanando(b), ref = doc(beneficiosCol, b.id), ahora = Date.now();
  var porPersona = {}, devueltos = {};
  aportesDe(b.id).forEach(function(p){
    var monto = Number(p.monto) || 0;
    if(g && p.grupo === g.grupo){
      if(!porPersona[p.uid]) porPersona[p.uid] = { uid: p.uid, nombre: p.nombre || '', monto: 0 };
      porPersona[p.uid].monto += monto;
    } else if(p.uid){ devueltos[p.uid] = (devueltos[p.uid] || 0) + monto; }
  });
  return Promise.all(Object.keys(porPersona).map(function(uid){
    var x = porPersona[uid];
    return addDoc(canjesCol, { uid: x.uid, nombre: x.nombre, grupo: g.grupo, beneficioId: b.id, titulo: b.titulo || '', monto: x.monto, tipo: 'subasta', estado: 'pendiente', createdAt: ahora });
  }).concat(Object.keys(devueltos).map(function(uid){ return ajustarGastado(uid, -devueltos[uid]); }))).then(function(){
    return updateDoc(ref, { estado: 'cerrada', ganadorGrupo: g ? g.grupo : '', montoGanador: g ? g.total : 0, devueltos: devueltos });
  });
}

// Reabrir: se vuelve a reservar lo devuelto y se borran los canjes que
// había generado el cierre.
export function reabrirSubasta(b){
  var devueltos = b.devueltos || {};
  var canjesSubasta = (AppState.canjes || []).filter(function(c){ return c.beneficioId === b.id && c.tipo === 'subasta'; });
  return Promise.all(Object.keys(devueltos).map(function(uid){ return ajustarGastado(uid, devueltos[uid]); })
    .concat(canjesSubasta.map(function(c){ return deleteDoc(doc(canjesCol, c.id)); }))).then(function(){
    return updateDoc(doc(beneficiosCol, b.id), { estado: 'abierta', ganadorGrupo: '', montoGanador: 0, devueltos: {} });
  });
}

export function setEstadoCanje(c, estado){
  var p = updateDoc(doc(canjesCol, c.id), { estado: estado });
  var cambia = (estado === 'cancelado') !== (c.estado === 'cancelado');
  if(cambia){
    // Cancelar devuelve los puntos; des-cancelar los vuelve a descontar.
    p = p.then(function(){ return ajustarGastado(c.uid, (estado === 'cancelado' ? -1 : 1) * (Number(c.monto) || 0)); });
    // Una compra cancelada devuelve la unidad al stock.
    if(c.tipo === 'compra'){
      var b = (AppState.beneficios || []).find(function(x){ return x.id === c.beneficioId; });
      if(b) p = p.then(function(){ return updateDoc(doc(beneficiosCol, b.id), { vendidos: Math.max(0, (b.vendidos || 0) + (estado === 'cancelado' ? -1 : 1)) }); });
    }
  }
  return p;
}
