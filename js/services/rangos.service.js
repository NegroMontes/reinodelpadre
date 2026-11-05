// Rangos «en hijos» — T13 E2 (05/11/2026): cálculo de puntos y rango.
// - Puntos por entrada: `entry.puntos` (0 a 10, lo pone el admin; sin valor
//   o 0 = no suma ni cuenta para el porcentaje — cambiado el 05/11/2026: no
//   todas las entradas tienen puntaje).
// - Rango por porcentaje: puntos juntados / puntos de las entradas con puntaje
//   que la persona puede hacer. Umbrales en `state.rangos.umbrales` (4
//   números, para los rangos 2..5), si no los de `RANGOS`.
// - Obligatorias: `entry.obligatoriaRango` = N → no se llega al rango N (ni a
//   los de arriba) sin completarla.
// Completada = `entryProgress.completedAt` (ver progress.service.js).

import { AppState } from '../app-state.js';
import { RANGOS } from '../config/constants.js';
import { estaOculta } from '../utils/helpers.js';
import { canSeeEntry } from './permissions.js';
import { db } from '../config/firebase.js';
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

  export function puntosDe(entry){
    var p = Number(entry && entry.puntos);
    return (entry && entry.puntos != null && entry.puntos !== '' && isFinite(p)) ? Math.max(0, p) : 0;
  }

  export function obligatoriaRangoDe(entry){
    var n = Number(entry && entry.obligatoriaRango);
    return (n >= 2 && n <= RANGOS.length) ? n : 0;
  }

  // Umbrales (%) para los rangos 2..5, siempre crecientes y entre 0 y 100.
  export function rangoUmbrales(state){
    var u = state && state.rangos && state.rangos.umbrales;
    var def = RANGOS.slice(1).map(function(r){ return r.umbral; });
    if(!Array.isArray(u) || u.length !== def.length) return def;
    var ok = u.every(function(x, i){ return typeof x === 'number' && x >= 0 && x <= 100 && (i === 0 || x >= u[i - 1]); });
    return ok ? u.slice() : def;
  }

  // Nombres de los rangos: los que puso el admin (`state.rangos.nombres`, 05/11/2026)
  // o los de fábrica (`RANGOS`).
  export function rangoNombres(state){
    var n = state && state.rangos && state.rangos.nombres;
    return RANGOS.map(function(r, i){
      var v = Array.isArray(n) && typeof n[i] === 'string' ? n[i].trim() : '';
      return v || r.nombre;
    });
  }

  export function rangoNombre(n){
    return (n >= 1 && n <= RANGOS.length) ? rangoNombres(AppState.state)[n - 1] : '';
  }

  // Cálculo puro: `entradas` = las que la persona puede hacer, `progreso` =
  // {entryId: {completedAt}}.
  export function calcularRango(entradas, progreso, umbrales){
    progreso = progreso || {};
    var hecha = function(e){ return !!(progreso[e.id] && progreso[e.id].completedAt); };
    var total = 0, puntos = 0;
    entradas.forEach(function(e){
      var p = puntosDe(e);
      if(!p) return;
      total += p;
      if(hecha(e)) puntos += p;
    });
    var pct = total ? (puntos / total) * 100 : 0;
    // Obligatorias sin completar, por rango.
    var pendientes = {};
    entradas.forEach(function(e){
      var n = obligatoriaRangoDe(e);
      if(n && !hecha(e)) (pendientes[n] = pendientes[n] || []).push(e);
    });
    var rango = 1, bloqueadoPor = [];
    for(var n = 2; n <= RANGOS.length; n++){
      if(pct + 1e-9 < umbrales[n - 2]) break;
      if(pendientes[n] && pendientes[n].length){ bloqueadoPor = pendientes[n]; break; }
      rango = n;
    }
    var sig = null;
    if(rango < RANGOS.length){
      var umbral = umbrales[rango - 1];
      var obligatorias = [];
      for(var m = 2; m <= rango + 1; m++){ obligatorias = obligatorias.concat(pendientes[m] || []); }
      sig = {
        rango: rango + 1, nombre: rangoNombre(rango + 1), umbral: umbral,
        faltanPuntos: Math.max(0, Math.ceil(total * umbral / 100 - puntos - 1e-9)),
        obligatoriasPendientes: obligatorias
      };
    }
    return {
      puntos: puntos, total: total, porcentaje: Math.round(pct),
      rango: rango, nombre: rangoNombre(rango), bloqueadoPor: bloqueadoPor, siguiente: sig
    };
  }

  // Entradas que cuentan para quien está mirando (respeta «Ver como»): las
  // publicadas y también las programadas (con fecha) que va a ver cuando
  // salgan — así el total es el camino entero y nadie llega a Heredero con
  // las primeras entradas (pedido del usuario, 05/11/2026). Los borradores sin
  // fecha no cuentan. Info general no tiene entradas que contar.
  export function entradasQueCuentan(){
    return (AppState.state.entries || []).filter(function(e){
      if(e.deletedAt || e.dayId === 'INFO_GENERAL') return false;
      if(!estaOculta(e)) return canSeeEntry(e);
      if(!e.publishAt) return false;
      return canSeeEntry(Object.assign({}, e, { oculta: false }));
    });
  }

  // Puntos de las entradas que ya se ven (sin las programadas): el «M» de
  // «N de M puntos disponibles» del Perfil (pedido del usuario, 05/11/2026).
  // El rango se sigue calculando sobre el camino entero (miRango()).
  export function puntosDisponibles(){
    var r = { puntos: 0, total: 0 };
    entradasQueCuentan().filter(function(e){ return !estaOculta(e); }).forEach(function(e){
      var p = puntosDe(e);
      r.total += p;
      if(AppState.myProgress[e.id] && AppState.myProgress[e.id].completedAt) r.puntos += p;
    });
    return r;
  }

  // % «al día»: puntos hechos de las entradas ya publicadas (pedido del
  // usuario, 05/11/2026: medir sobre el camino entero avanzaba muy lento).
  export function alDia(){
    var d = puntosDisponibles();
    return d.total ? Math.round(d.puntos / d.total * 100) : 0;
  }

  export function miRango(){
    return calcularRango(entradasQueCuentan(), AppState.myProgress, rangoUmbrales(AppState.state));
  }

  // Rango guardado en el perfil (T13 E3, 05/11/2026): el de otros no se puede
  // calcular acá (las reglas de `entryProgress` solo dejan leer lo propio),
  // así que cada uno guarda el suyo en `users/{uid}.rango` y los demás lo leen
  // de ahí (Mi comando, Usuarios). Solo con los permisos reales: nunca con
  // «Ver como» ni en Modo Lector (cambian qué entradas cuentan).
  var guardando = null;
  export function sincronizarMiRango(){
    var u = AppState.currentUser;
    if(!u || u.role === 'pendiente' || AppState.viewAsOverride || AppState.myLectorMode) return;
    if(AppState.firstSnapshot || !AppState.myProgressLoaded) return;
    var mr = miRango(), r = mr.rango, av = alDia();
    // T14 (05/11/2026): también el % «al día» (`avance`, 0-100): puntos
    // hechos sobre los de las entradas YA publicadas (no las programadas),
    // para el Tablero por comando. El rango sigue sobre el camino entero.
    var clave = r + '|' + av;
    if((r === u.rango && av === u.avance) || clave === guardando) return;
    guardando = clave;
    setDoc(doc(db, 'users', u.uid), { rango: r, avance: av }, { merge: true })
      .catch(function(e){ console.error('No se pudo guardar tu rango:', e); })
      .finally(function(){ guardando = null; });
  }

  // Rango de otra persona (lo que guardó su propio dispositivo). 0 = todavía no.
  export function rangoGuardadoDe(u){
    var n = Number(u && u.rango);
    return (n >= 1 && n <= RANGOS.length) ? n : 0;
  }

  // % de avance guardado de otra persona (T14 E1). null = todavía no lo guardó.
  export function avanceGuardadoDe(u){
    var n = Number(u && u.avance);
    return (u && u.avance != null && isFinite(n)) ? Math.max(0, Math.min(100, n)) : null;
  }
