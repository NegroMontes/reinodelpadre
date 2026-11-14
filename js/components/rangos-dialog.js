// Diálogo admin «Rangos y puntos» (T13 E2, 05/11/2026): editar los
// porcentajes de cada rango y ver el cálculo propio como prueba.

import { AppState } from '../app-state.js';
import { RANGOS } from '../config/constants.js';
import { escapeHtml, fechaCorta, estaOculta, recursoCategoriaDe, recursoGrupoDe, recursoCategorias } from '../utils/helpers.js';
import { realIsAdmin } from '../services/permissions.js';
import { save } from '../services/state.service.js';
import { rangoUmbrales, rangoNombres, miRango, entradasQueCuentan, puntosDe, obligatoriaRangoDe } from '../services/rangos.service.js';
import { render } from '../main.js';
import { showAlert, showConfirm } from './dialog.js';

  export function openRangosDialog(){
    if(!realIsAdmin()) return;
    var u = rangoUmbrales(AppState.state);
    var nombres = rangoNombres(AppState.state);
    var r = miRango();
    var entradas = entradasQueCuentan();
    var conPuntaje = entradas.filter(function(e){ return puntosDe(e) > 0; }).length;
    var obligatorias = entradas.filter(function(e){ return obligatoriaRangoDe(e); }).length;
    var filas = RANGOS.map(function(rg, i){
      var campo = i === 0 ? '<span class="mandos-sub">desde el inicio</span>'
        : '<span class="rango-pct"><input type="number" class="rango-umbral" min="0" max="100" step="1" value="' + u[i - 1] + '" aria-label="Porcentaje para el rango ' + rg.n + '">%</span>';
      return '<div class="rango-fila"><span class="rango-nombre-wrap">' + rg.n + ' · <input type="text" class="rango-nombre" maxlength="40" value="' + escapeHtml(nombres[i]) + '" placeholder="' + escapeHtml(rg.nombre) + '" aria-label="Nombre del rango ' + rg.n + '"></span><span>' + campo + '</span></div>';
    }).join('');
    var sig = r.siguiente;
    var prueba = 'Tus puntos: <strong>' + r.puntos + ' de ' + r.total + '</strong> (' + r.porcentaje + '%) → <strong>' + escapeHtml(r.nombre) + '</strong>.';
    if(sig){
      prueba += ' Para «' + escapeHtml(sig.nombre) + '»: ' + (sig.faltanPuntos ? 'faltan ' + sig.faltanPuntos + ' pts' : 'puntos alcanzados') +
        (sig.obligatoriasPendientes.length ? ', y ' + sig.obligatoriasPendientes.length + ' obligatoria' + (sig.obligatoriasPendientes.length === 1 ? '' : 's') + ' sin completar' : '') + '.';
    }
    var overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML =
      '<div class="app-dialog-box info-general-dialog" role="dialog" aria-modal="true">' +
      '  <h3 style="margin:0 0 6px">Rangos y puntos</h3>' +
      '  <p class="mandos-sub" style="margin:0 0 12px">Nombre de cada rango y porcentaje de los puntos (de las entradas que cada uno puede hacer) para llegar a cada rango. Los puntos y las obligatorias se ponen en cada entrada (Editar).</p>' +
      '  <div class="rango-tabla">' + filas + '</div>' +
      '  <p class="mandos-sub recurso-dialog-error" id="rangoError" hidden>Cada porcentaje tiene que ser de 0 a 100 y no menor que el anterior.</p>' +
      '  <p class="mandos-sub" style="margin:12px 0 0">' + entradas.length + ' entradas cuentan para vos (publicadas y programadas): ' + conPuntaje + ' con puntaje, ' + obligatorias + ' obligatoria' + (obligatorias === 1 ? '' : 's') + '.</p>' +
      '  <p style="margin:6px 0 0">' + prueba + '</p>' +
      '  <button type="button" class="rango-link" id="rangoResumenBtn">Copiar resumen de puntos y obligatorias</button>' +
      '  <button type="button" class="rango-link" id="rangoCalendarioBtn">Poner puntos según el calendario de publicación</button>' +
      '  <button type="button" class="rango-link" id="rangoMigrarBtn">Pasar los puntos al sistema nuevo (libretas)</button>' +
      '  <div class="app-dialog-actions" style="margin-top:16px">' +
      '    <button type="button" class="btn ghost small" id="rangoCancelBtn">Cancelar</button>' +
      '    <button type="button" class="btn small" id="rangoSaveBtn">Guardar</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(overlay);
    function close(){ document.removeEventListener('keydown', onKey); overlay.remove(); }
    function onKey(e){ if(e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    overlay.onclick = function(e){ if(e.target === overlay) close(); };
    overlay.querySelector('#rangoCancelBtn').onclick = close;
    overlay.querySelector('#rangoResumenBtn').onclick = async function(){
      var txt = resumenRangos();
      close();
      try{ await navigator.clipboard.writeText(txt); await showAlert('Resumen copiado. Pegalo en el chat.'); }
      catch(e){ await showAlert('No se pudo copiar solo. Copialo de acá:\n\n' + txt); }
    };
    overlay.querySelector('#rangoCalendarioBtn').onclick = async function(){
      var mod = await import('../services/calendario-publicacion.js');
      var plan = mod.planPuntos();
      close();
      if(!plan.length){ await showAlert('Todas las entradas de Recursos ya tienen puntos puestos.'); return; }
      if(!(await showConfirm('Puntos para las entradas de Recursos que todavía no tienen (las que ya tienen no se tocan):\n\n' + mod.resumenPuntos(plan) + '\n\n¿Aplicarlos?'))) return;
      mod.aplicarPuntos(plan);
      render();
      await showAlert('Listo. Cada tarjeta muestra sus puntos (solo vos los ves).');
    };
    overlay.querySelector('#rangoMigrarBtn').onclick = async function(){
      close();
      if(!(await showConfirm('Recalcula la libreta de puntos de todos a partir de las entradas completadas, los minijuegos ganados y lo canjeado en Beneficios. Se puede repetir sin duplicar nada. ¿Seguir?'))) return;
      try{
        var r = await (await import('../services/libreta.service.js')).migrarPuntos();
        await showAlert('Listo: ' + r.personas + ' libretas actualizadas.');
      }catch(e){ console.error(e); await showAlert('No se pudo: ' + e.message + '\n\n¿Están publicadas las reglas nuevas?'); }
    };
    overlay.querySelector('#rangoSaveBtn').onclick = function(){
      var vals = Array.prototype.map.call(overlay.querySelectorAll('.rango-umbral'), function(inp){ return Number(inp.value); });
      var ok = vals.every(function(x, i){ return inp100(x) && (i === 0 || x >= vals[i - 1]); });
      if(!ok){ overlay.querySelector('#rangoError').hidden = false; return; }
      var noms = Array.prototype.map.call(overlay.querySelectorAll('.rango-nombre'), function(inp, i){ return inp.value.trim() || RANGOS[i].nombre; });
      AppState.state.rangos = Object.assign({}, AppState.state.rangos || {}, { umbrales: vals, nombres: noms });
      save();
      close();
      render();
    };
  }

  function inp100(x){ return isFinite(x) && x >= 0 && x <= 100 && x === Math.floor(x); }

  // Resumen en texto (14/11/2026): rangos + cada entrada con puntos,
  // obligatoria, publicación y para quién es — para pasarlo rápido al chat.
  function resumenRangos(){
    var st = AppState.state, u = rangoUmbrales(st), nombres = rangoNombres(st);
    var out = ['RANGOS'];
    nombres.forEach(function(n, i){ out.push((i + 1) + ' ' + n + ': ' + (i ? u[i - 1] + '%' : 'inicio')); });
    out.push('', 'ENTRADAS (título | lugar | puntos | obligatoria | publicación | visible para)');
    var cats = {};
    try{ recursoCategorias(st).forEach(function(c){ cats[c.id] = c.label; }); }catch(e){}
    var dias = {};
    (st.days || []).forEach(function(d, i){ dias[d.id] = 'Día ' + (i + 1); });
    (st.entries || []).filter(function(e){ return !e.deletedAt; }).forEach(function(e){
      var lugar;
      if(e.dayId === 'RESOURCES'){
        var gid = recursoGrupoDe(st, e), g = gid && (st.recursoGrupos || []).find(function(x){ return x.id === gid; });
        lugar = 'Recursos › ' + (cats[recursoCategoriaDe(e)] || recursoCategoriaDe(e)) + (g ? ' › ' + g.title : '');
      } else lugar = dias[e.dayId] || e.dayId;
      var pub = e.publishAt ? (estaOculta(e) ? 'programada ' : 'publicada ') + fechaCorta(e.publishAt) : (estaOculta(e) ? 'oculta sin fecha' : 'publicada');
      var obl = obligatoriaRangoDe(e);
      var para = e.comandoGeneral ? 'todos' : [].concat(e.secciones || [], e.deptos || []).join(', ') || 'todos';
      out.push('- ' + (e.title || (e.espacio && e.espacio.title) || '(sin título)') + ' | ' + lugar + ' | ' + puntosDe(e) + ' | ' + (obl ? obl + ' ' + nombres[obl - 1] : '-') + ' | ' + pub + ' | ' + para);
    });
    return out.join('\n');
  }
