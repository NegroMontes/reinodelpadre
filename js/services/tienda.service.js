// T18 — Los puntos como moneda (07/11/2026). Esqueleto editable: el admin
// prende/apaga el evento desde Perfil, carga los beneficios (compra directa o
// subasta) y marca los canjes como entregados.
//
// Firestore:
//   config/public.tienda   {activa, titulo, moneda, usarEntradas, usarBonus, nota}
//                          (config/** ya deja leer a todos y escribir al admin)
//   beneficios/{id}        {titulo, desc, tipo:'compra'|'subasta', precio, stock|null,
//                           limite|null, vendidos, cierre|null, incremento,
//                           estado:'abierta'|'cerrada', ganadorUid, ganadorNombre,
//                           montoGanador, orden, createdAt}
//   canjes/{id}            {uid, nombre, beneficioId, titulo, monto, tipo,
//                           estado:'pendiente'|'entregado'|'cancelado', createdAt}
//   pujas/{id}             {uid, nombre, beneficioId, monto, createdAt}
//
// Saldo = puntos ganados (entradas completadas + bonus de minijuegos, según la
// config) − canjes no cancelados − lo «reservado» en subastas abiertas donde
// la persona va ganando. Gastar NO baja el rango: el rango sigue sobre lo ganado.
import { doc, collection, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query, where, runTransaction } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { miRango } from './rangos.service.js';
import { bonusDe } from './juegos.service.js';
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

// Mejor puja de una subasta (empate: la más vieja).
export function mejorPuja(beneficioId){
  return (AppState.pujas || []).filter(function(p){ return p.beneficioId === beneficioId; })
    .sort(function(a, b){ return (b.monto - a.monto) || (a.createdAt - b.createdAt); })[0] || null;
}

export function misCanjes(){
  var uid = AppState.currentUser && AppState.currentUser.uid;
  return (AppState.canjes || []).filter(function(c){ return c.uid === uid; });
}

export function saldo(excluirSubasta){
  var u = AppState.currentUser, cfg = tiendaConfig();
  var entradas = cfg.usarEntradas ? (miRango().puntos || 0) : 0;
  var bonus = cfg.usarBonus ? bonusDe(u) : 0;
  var gastado = misCanjes().filter(function(c){ return c.estado !== 'cancelado'; })
    .reduce(function(s, c){ return s + (Number(c.monto) || 0); }, 0);
  var reservado = (AppState.beneficios || []).filter(subastaAbierta).reduce(function(s, b){
    if(b.id === excluirSubasta) return s;
    var m = mejorPuja(b.id);
    return s + (m && m.uid === u.uid ? (Number(m.monto) || 0) : 0);
  }, 0);
  return { entradas: entradas, bonus: bonus, ganado: entradas + bonus, gastado: gastado, reservado: reservado, disponible: entradas + bonus - gastado - reservado };
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
  var u = AppState.currentUser, ref = doc(beneficiosCol, b.id);
  return runTransaction(db, function(tx){
    return tx.get(ref).then(function(s){
      if(!s.exists()) throw new Error('No existe');
      var d = s.data();
      if(d.stock != null && (d.vendidos || 0) >= d.stock) throw new Error('agotado');
      tx.update(ref, { vendidos: (d.vendidos || 0) + 1 });
    });
  }).then(function(){
    return addDoc(canjesCol, { uid: u.uid, nombre: u.displayName || '', beneficioId: b.id, titulo: b.titulo || '', monto: Number(b.precio) || 0, tipo: 'compra', estado: 'pendiente', createdAt: Date.now() });
  }).then(function(){ return ''; }).catch(function(e){
    console.error('No se pudo canjear:', e);
    return e && e.message === 'agotado' ? 'No quedan más.' : 'No se pudo canjear (¿faltan publicar las reglas?).';
  });
}

export function minimoPuja(b){
  var m = mejorPuja(b.id), inc = Math.max(1, Number(b.incremento) || 1);
  return m ? Number(m.monto) + inc : Math.max(1, Number(b.precio) || 1);
}

export function pujar(b, monto){
  monto = Math.floor(Number(monto));
  if(bloqueado()) return Promise.resolve('No disponible en «Ver como».');
  if(!tiendaConfig().activa) return Promise.resolve('El evento no está activo.');
  if(!subastaAbierta(b) || subastaVencida(b)) return Promise.resolve('La subasta ya terminó.');
  if(!(monto >= minimoPuja(b))) return Promise.resolve('La puja mínima es ' + minimoPuja(b) + '.');
  if(saldo(b.id).disponible < monto) return Promise.resolve('No te alcanzan los ' + tiendaConfig().moneda + '.');
  var u = AppState.currentUser;
  return addDoc(pujasCol, { uid: u.uid, nombre: u.displayName || '', beneficioId: b.id, monto: monto, createdAt: Date.now() })
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

// Cierra la subasta: el que más pujó se lleva el beneficio (se crea su canje).
export function cerrarSubasta(b){
  var m = mejorPuja(b.id), ref = doc(beneficiosCol, b.id);
  var cambios = { estado: 'cerrada', ganadorUid: m ? m.uid : '', ganadorNombre: m ? (m.nombre || '') : '', montoGanador: m ? m.monto : 0 };
  var p = m ? addDoc(canjesCol, { uid: m.uid, nombre: m.nombre || '', beneficioId: b.id, titulo: b.titulo || '', monto: Number(m.monto) || 0, tipo: 'subasta', estado: 'pendiente', createdAt: Date.now() }) : Promise.resolve();
  return p.then(function(){ return updateDoc(ref, cambios); });
}

export function reabrirSubasta(b){
  return updateDoc(doc(beneficiosCol, b.id), { estado: 'abierta', ganadorUid: '', ganadorNombre: '', montoGanador: 0 });
}

export function setEstadoCanje(c, estado){
  var p = updateDoc(doc(canjesCol, c.id), { estado: estado });
  // Cancelar una compra devuelve la unidad al stock.
  if(c.tipo === 'compra' && (estado === 'cancelado') !== (c.estado === 'cancelado')){
    var b = (AppState.beneficios || []).find(function(x){ return x.id === c.beneficioId; });
    if(b) p = p.then(function(){ return updateDoc(doc(beneficiosCol, b.id), { vendidos: Math.max(0, (b.vendidos || 0) + (estado === 'cancelado' ? -1 : 1)) }); });
  }
  return p;
}
