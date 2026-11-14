// Usuarios → Secciones (14/11/2026, pedido del usuario): resumen por sección
// y departamento para hacer el seguimiento de puntos, rangos, entradas
// completadas y minijuegos. Al tocar a alguien se ve su tarjeta (como en
// Mi comando) y el detalle. Se baja recién al abrir la subpestaña.

import { AppState } from '../app-state.js';
import { SECCIONES, DEPARTAMENTOS } from '../config/constants.js';
import { escapeHtml } from '../utils/helpers.js';
import { HIJOS_BIBLICOS } from '../config/test-hijo-biblico.js';
import { MINIJUEGOS_TITULOS } from '../config/minijuegos-catalogo.js';
import { calcularRango, entradasQueCuentan, progresoDe, rangoUmbrales, rangoNombre, puntosDisponibles, alDia, misObligatoriasPendientes, puntosDe } from '../services/rangos.service.js';
import { libretaDe, valorJuego } from '../services/libreta.service.js';
import { miComandoCardHtml, grupoSubastaDe } from './mandos.js';
import { isMilicianoUser } from './users.js';
import { entryLocationLabel } from '../components/header.js';
import { renderPanel } from '../main.js';

function fecha(ms){
  if(!ms) return '';
  var n = typeof ms === 'number' ? ms : (ms.toMillis ? ms.toMillis() : (ms.seconds ? ms.seconds * 1000 : 0));
  return n ? new Date(n).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '';
}

var HUEVOS = {
  'huevo-guardia': 'Sorpresa: la guardia nocturna',
  'huevo-actividad': 'Sorpresa: el escudo',
  'huevo-botella': 'Sorpresa: mensaje en la botella'
};
function nombreJuego(k){
  if(HUEVOS[k]) return HUEVOS[k];
  var m = k.match(/^([a-z]+)-(.*)$/);
  if(!m) return k;
  var dia = function(s){ return s.length === 8 ? s.slice(6, 8) + '/' + s.slice(4, 6) : s; };
  if(m[1] === 'dia'){
    var d = (AppState.state.days || []).find(function(x){ return x.id === m[2]; });
    return 'Desafío del día' + (d ? ' · ' + (d.label || d.title || d.name || '') : '');
  }
  if(m[1] === 'depto') return 'Departamentos · ' + (MINIJUEGOS_TITULOS[m[2]] || m[2]);
  var ev = { diana: 'Despertar de la bandera', lluvia: 'La tormenta', estrellas: 'La sopa de estrellas', zonda: 'Viento Zonda', saboteador: 'El saboteador' };
  return ev[m[1]] ? ev[m[1]] + ' (' + dia(m[2]) + ')' : k;
}

// Todo lo que se muestra de una persona.
function datosDe(u){
  var lib = libretaDe(u.uid);
  var prog = progresoDe(u.uid);
  var r = calcularRango(entradasQueCuentan(u), prog, rangoUmbrales(AppState.state));
  var porId = {}; (AppState.state.entries || []).forEach(function(e){ porId[e.id] = e; });
  var hechas = Object.keys(prog).filter(function(id){ return porId[id] && !porId[id].deletedAt; })
    .map(function(id){ return { e: porId[id], cuando: prog[id].completedAt }; })
    .sort(function(a, b){ return (Number(b.cuando) || 0) - (Number(a.cuando) || 0); });
  var juegos = (lib && lib.juegos) || {};
  return {
    lib: lib, r: r, disp: puntosDisponibles(u), alDia: lib ? alDia(u) : null,
    hechas: hechas, juegos: juegos, nJuegos: Object.keys(juegos).length,
    bonus: (lib && Number(lib.gJ)) || 0, oblig: lib ? misObligatoriasPendientes(u) : []
  };
}

function gruposOrdenados(){
  var miembros = (AppState.usersList || []).filter(function(u){ return !isMilicianoUser(u) && u.role !== 'pendiente'; });
  var g = {};
  miembros.forEach(function(u){ var k = grupoSubastaDe(u) || 'Comando central'; (g[k] = g[k] || []).push(u); });
  var orden = SECCIONES.concat(DEPARTAMENTOS, ['Comando central']);
  Object.keys(g).forEach(function(k){ if(orden.indexOf(k) === -1) orden.push(k); });
  return orden.filter(function(k){ return g[k]; }).map(function(k){
    return { nombre: k, miembros: g[k].slice().sort(function(a, b){ return (a.displayName || '').localeCompare(b.displayName || ''); }) };
  });
}

function detalleHtml(u, grupo, d){
  var html = '<div class="us-detalle">';
  html += miComandoCardHtml(u, grupo);
  html += '<div class="us-detalle-grid">';
  // Rango y puntos
  html += '<div class="us-bloque"><h4>Rango y puntos</h4>';
  html += '<p><span class="rango-chip rango-' + d.r.rango + '">' + escapeHtml(d.r.nombre) + '</span></p>';
  if(!d.lib) html += '<p class="mandos-sub">Todavía no abrió la página desde que existen los puntos.</p>';
  html += '<p class="mandos-sub">Al día: <strong>' + (d.alDia == null ? '—' : d.alDia + '%') + '</strong> · ' + d.disp.puntos + ' de ' + d.disp.total + ' puntos disponibles</p>';
  html += '<p class="mandos-sub">Camino entero: ' + d.r.puntos + ' de ' + d.r.total + ' puntos (' + d.r.porcentaje + '%)';
  if(d.r.siguiente && d.r.siguiente.faltanPuntos) html += ' · faltan ' + d.r.siguiente.faltanPuntos + ' para «' + escapeHtml(rangoNombre(d.r.siguiente.rango)) + '»';
  html += '</p>';
  if(d.lib){
    var gE = Number(d.lib.gE) || 0, gas = Number(d.lib.gastado) || 0;
    html += '<p class="mandos-sub">Beneficios: ganó ' + gE + ' por entradas + ' + d.bonus + ' bonus · gastó ' + gas + '</p>';
  }
  if(d.oblig.length){
    var porId = {}; (AppState.state.entries || []).forEach(function(e){ porId[e.id] = e; });
    html += '<p class="mandos-sub"><strong>Obligatorias sin completar:</strong></p><ul class="us-lista">';
    d.oblig.forEach(function(id){ html += '<li>' + escapeHtml((porId[id] && porId[id].title) || id) + '</li>'; });
    html += '</ul>';
  }
  var hj = HIJOS_BIBLICOS[u.hijoBiblico];
  if(hj) html += '<p class="mandos-sub">Hijo bíblico: ' + escapeHtml(hj.nombre) + '</p>';
  html += '</div>';
  // Entradas completadas
  html += '<div class="us-bloque"><h4>Entradas completadas (' + d.hechas.length + ')</h4>';
  if(!d.hechas.length) html += '<p class="mandos-sub">Ninguna todavía.</p>';
  else {
    html += '<ul class="us-lista">';
    d.hechas.forEach(function(h){
      var p = puntosDe(h.e);
      html += '<li><span>' + escapeHtml(h.e.title || '(sin título)') + '<span class="mandos-sub"> · ' + escapeHtml(entryLocationLabel(h.e)) + '</span></span><span class="us-lista-der">' + (p ? '★ ' + p : '') + ' <span class="mandos-sub">' + fecha(h.cuando) + '</span></span></li>';
    });
    html += '</ul>';
  }
  html += '</div>';
  // Minijuegos
  var claves = Object.keys(d.juegos).sort(function(a, b){ return (Number(d.juegos[b]) || 0) - (Number(d.juegos[a]) || 0); });
  html += '<div class="us-bloque"><h4>Minijuegos (' + claves.length + ' · ' + d.bonus + ' bonus)</h4>';
  if(!claves.length) html += '<p class="mandos-sub">Ninguno todavía.</p>';
  else {
    html += '<ul class="us-lista">';
    claves.forEach(function(k){
      html += '<li><span>' + escapeHtml(nombreJuego(k)) + '</span><span class="us-lista-der">+' + valorJuego(k) + ' <span class="mandos-sub">' + fecha(d.juegos[k]) + '</span></span></li>';
    });
    html += '</ul>';
  }
  html += '</div>';
  html += '</div></div>';
  return html;
}

export function renderSeccionesHtml(){
  var grupos = gruposOrdenados();
  if(!grupos.length) return '<p class="empty">Todavía no hay nadie aprobado.</p>';
  var html = '<p class="mandos-sub">Tocá una sección o departamento para ver a su gente, y a una persona para ver su detalle.</p>';
  grupos.forEach(function(g){
    var datos = g.miembros.map(function(u){ return { u: u, d: datosDe(u) }; });
    var conDato = datos.filter(function(x){ return x.d.alDia != null; });
    var prom = conDato.length ? Math.round(conDato.reduce(function(s, x){ return s + x.d.alDia; }, 0) / conDato.length) : null;
    var entradas = datos.reduce(function(s, x){ return s + x.d.hechas.length; }, 0);
    var juegos = datos.reduce(function(s, x){ return s + x.d.nJuegos; }, 0);
    var bonus = datos.reduce(function(s, x){ return s + x.d.bonus; }, 0);
    var debenOblig = datos.filter(function(x){ return x.d.oblig.length; }).length;
    var rangos = {}; datos.forEach(function(x){ if(x.d.lib) rangos[x.d.r.rango] = (rangos[x.d.r.rango] || 0) + 1; });
    var abierto = AppState.usersSeccionOpen === g.nombre;
    html += '<details class="us-grupo" data-us-grupo="' + escapeHtml(g.nombre) + '"' + (abierto ? ' open' : '') + '>';
    html += '<summary><strong>' + escapeHtml(g.nombre) + '</strong>';
    html += '<span class="us-resumen">' + g.miembros.length + (g.miembros.length === 1 ? ' persona' : ' personas') + ' · al día ' + (prom == null ? '—' : prom + '%') + ' · ' + entradas + ' entradas · ' + juegos + ' juegos (' + bonus + ' bonus)' + (debenOblig ? ' · <span class="us-alerta">' + debenOblig + ' con obligatorias pendientes</span>' : '') + '</span>';
    var chips = Object.keys(rangos).sort().map(function(n){ return '<span class="rango-chip rango-chip-sm rango-' + n + '">' + escapeHtml(rangoNombre(Number(n))) + ': ' + rangos[n] + '</span>'; }).join(' ');
    if(chips) html += '<span class="us-chips">' + chips + '</span>';
    html += '</summary>';
    if(abierto){
      html += '<div class="users-table-wrap"><table class="users-table us-tabla"><thead><tr><th>Nombre</th><th>Rango</th><th>Al día</th><th>Puntos</th><th>Entradas</th><th>Juegos</th><th>Oblig.</th></tr></thead><tbody>';
      datos.forEach(function(x){
        var sel = AppState.usersSeccionUid === x.u.uid;
        html += '<tr class="us-fila' + (sel ? ' sel' : '') + '" data-us-uid="' + escapeHtml(x.u.uid) + '">';
        html += '<td>' + escapeHtml(x.u.displayName || x.u.email || '') + '</td>';
        html += '<td>' + (x.d.lib ? '<span class="rango-chip rango-chip-sm rango-' + x.d.r.rango + '">' + escapeHtml(x.d.r.nombre) + '</span>' : '<span class="mandos-sub">sin datos</span>') + '</td>';
        html += '<td>' + (x.d.alDia == null ? '—' : x.d.alDia + '%') + '</td>';
        html += '<td>' + x.d.disp.puntos + '/' + x.d.disp.total + '</td>';
        html += '<td>' + x.d.hechas.length + '</td>';
        html += '<td>' + x.d.nJuegos + '</td>';
        html += '<td>' + (x.d.oblig.length ? '<span class="us-alerta">' + x.d.oblig.length + '</span>' : '—') + '</td>';
        html += '</tr>';
        if(sel) html += '<tr class="us-fila-detalle"><td colspan="7">' + detalleHtml(x.u, g.nombre, x.d) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</details>';
  });
  return html;
}

export function attachSeccionesEvents(){
  document.querySelectorAll('[data-us-grupo]').forEach(function(det){
    det.querySelector('summary').onclick = function(ev){
      ev.preventDefault();
      var n = det.getAttribute('data-us-grupo');
      AppState.usersSeccionOpen = AppState.usersSeccionOpen === n ? null : n;
      AppState.usersSeccionUid = null;
      renderPanel();
    };
  });
  document.querySelectorAll('[data-us-uid]').forEach(function(tr){
    tr.onclick = function(){
      var uid = tr.getAttribute('data-us-uid');
      AppState.usersSeccionUid = AppState.usersSeccionUid === uid ? null : uid;
      renderPanel();
    };
  });
}
