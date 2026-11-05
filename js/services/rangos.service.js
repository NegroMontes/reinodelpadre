// Rangos «en hijos» — T13 E2 (05/11/2026): cálculo de puntos y rango.
// - Puntos por entrada: `entry.puntos` (el admin lo pone; sin valor = 1; 0 =
//   no suma ni cuenta para el porcentaje).
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

  export function puntosDe(entry){
    var p = Number(entry && entry.puntos);
    return (entry && entry.puntos != null && entry.puntos !== '' && isFinite(p)) ? Math.max(0, p) : 1;
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

  export function rangoNombre(n){
    var r = RANGOS.find(function(x){ return x.n === n; });
    return r ? r.nombre : '';
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

  // Entradas que cuentan para quien está mirando (respeta «Ver como»): las que
  // ve, publicadas y no borradas. Info general no tiene entradas que contar.
  export function entradasQueCuentan(){
    return (AppState.state.entries || []).filter(function(e){
      return !e.deletedAt && !estaOculta(e) && e.dayId !== 'INFO_GENERAL' && canSeeEntry(e);
    });
  }

  export function miRango(){
    return calcularRango(entradasQueCuentan(), AppState.myProgress, rangoUmbrales(AppState.state));
  }
