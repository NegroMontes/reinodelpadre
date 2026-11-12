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
import { libretaDe, sincronizarLibreta, sincronizarAdmin } from './libreta.service.js';

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

  // Evalúa `fn` como si estuviera logueado `u` (para calcular el rango de
  // otros con sus propios permisos). Sincrónico: no queda nada cambiado.
  function comoUsuario(u, fn){
    if(!u) return fn();
    var cu = AppState.currentUser, va = AppState.viewAsOverride, lm = AppState.myLectorMode;
    AppState.currentUser = Object.assign({}, u); AppState.viewAsOverride = null; AppState.myLectorMode = false;
    try{ return fn(); } finally { AppState.currentUser = cu; AppState.viewAsOverride = va; AppState.myLectorMode = lm; }
  }

  // Entradas que cuentan para quien está mirando (o para `u`, si se pasa;
  // respeta «Ver como» solo para uno mismo): las publicadas y también las
  // programadas (con fecha) que va a ver cuando salgan — así el total es el
  // camino entero y nadie llega a Heredero con las primeras entradas (pedido
  // del usuario, 05/11/2026). Los borradores sin fecha no cuentan. Info
  // general no tiene entradas que contar.
  export function entradasQueCuentan(u){
    var calc = function(){
      return (AppState.state.entries || []).filter(function(e){
        if(e.deletedAt || e.dayId === 'INFO_GENERAL') return false;
        if(!estaOculta(e)) return canSeeEntry(e);
        if(!e.publishAt) return false;
        return canSeeEntry(Object.assign({}, e, { oculta: false }));
      });
    };
    return u ? comoUsuario(u, calc) : calc();
  }

  // Completadas de alguien según su libreta (12/11/2026: la libreta la validan
  // las reglas; ya no se confía en lo que cada teléfono guardaba en el perfil).
  // Para uno mismo se suma lo que ya marcó la Fordoquera y todavía no pasó a la libreta.
  export function progresoDe(uid){
    var l = libretaDe(uid), p = {};
    Object.keys((l && l.entradas) || {}).forEach(function(id){ p[id] = { completedAt: l.entradas[id] }; });
    if(AppState.currentUser && uid === AppState.currentUser.uid){
      Object.keys(AppState.myProgress || {}).forEach(function(id){
        var x = AppState.myProgress[id];
        if(x && x.completedAt && !p[id]) p[id] = { completedAt: x.completedAt };
      });
    }
    return p;
  }

  function hecha(prog, e){ return !!(prog[e.id] && prog[e.id].completedAt); }

  // Puntos de las entradas que ya se ven (sin las programadas): el «M» de
  // «N de M puntos disponibles» del Perfil (pedido del usuario, 05/11/2026).
  // El rango se sigue calculando sobre el camino entero (miRango()).
  export function puntosDisponibles(u){
    var uid = u ? u.uid : (AppState.currentUser && AppState.currentUser.uid);
    var prog = progresoDe(uid), r = { puntos: 0, total: 0 };
    entradasQueCuentan(u).filter(function(e){ return !estaOculta(e); }).forEach(function(e){
      var p = puntosDe(e);
      r.total += p;
      if(hecha(prog, e)) r.puntos += p;
    });
    return r;
  }

  // % «al día»: puntos hechos de las entradas ya publicadas (pedido del
  // usuario, 05/11/2026: medir sobre el camino entero avanzaba muy lento).
  export function alDia(u){
    var d = puntosDisponibles(u);
    return d.total ? Math.round(d.puntos / d.total * 100) : 0;
  }

  // T17 (05/11/2026): ids de las obligatorias YA publicadas que la persona
  // ve y todavía no completó (cualquier rango).
  export function misObligatoriasPendientes(u){
    var uid = u ? u.uid : (AppState.currentUser && AppState.currentUser.uid);
    var prog = progresoDe(uid);
    return entradasQueCuentan(u).filter(function(e){
      return !estaOculta(e) && obligatoriaRangoDe(e) && !hecha(prog, e);
    }).map(function(e){ return e.id; }).sort();
  }

  export function miRango(){
    return calcularRango(entradasQueCuentan(), progresoDe(AppState.currentUser && AppState.currentUser.uid), rangoUmbrales(AppState.state));
  }

  // Antes cada dispositivo guardaba rango/avance/obligatorias en el perfil y
  // los demás lo leían de ahí (cualquiera que programara podía poner otro
  // número). Desde el 12/11/2026 se calculan acá, para cada persona, desde
  // su libreta. Lo único que se sincroniza es la libreta propia (y, si es
  // admin, los datos que usan las reglas para validarla).
  export function sincronizarMiRango(){
    sincronizarLibreta();
    sincronizarAdmin();
  }

  // Cálculos de otros, guardados mientras no cambien el estado ni las libretas.
  var memo = {}, memoClave = null;
  function deOtro(u, tipo, fn){
    if(!u || !u.uid) return null;
    if(memoClave !== AppState.libretas || memo._state !== AppState.state){ memo = { _state: AppState.state }; memoClave = AppState.libretas; }
    var c = u.uid + '|' + tipo;
    if(!(c in memo)) memo[c] = fn();
    return memo[c];
  }

  // Rango de otra persona. 0 = todavía no tiene libreta.
  export function rangoGuardadoDe(u){
    if(!u || !libretaDe(u.uid)) return 0;
    return deOtro(u, 'rango', function(){ return calcularRango(entradasQueCuentan(u), progresoDe(u.uid), rangoUmbrales(AppState.state)).rango; });
  }

  // % «al día» de otra persona (T14 E1). null = todavía no tiene libreta.
  export function avanceGuardadoDe(u){
    if(!u || !libretaDe(u.uid)) return null;
    return deOtro(u, 'avance', function(){ return alDia(u); });
  }

  // Obligatorias pendientes de otra persona (T17). null = todavía no tiene libreta.
  export function obligPendientesDe(u){
    if(!u || !libretaDe(u.uid)) return null;
    return deOtro(u, 'oblig', function(){ return misObligatoriasPendientes(u); });
  }
