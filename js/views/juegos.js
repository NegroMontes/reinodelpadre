// T10 — Dónde aparecen los minijuegos (07/11/2026):
//  - Mensaje: un desafío por día (lo elige quien edita la estructura; si no
//    eligió, uno por default según el número de día). Puede «bloquear» el
//    texto del día hasta ganarlo.
//  - Departamentos: un juego propio de cada departamento.
//  - Huevos de pascua: ver huevos.js.
import { AppState } from '../app-state.js';
import { save } from '../services/state.service.js';
import { canEditStructure } from '../services/permissions.js';
import { escapeHtml } from '../utils/helpers.js';
import { MINIJUEGOS, abrirMinijuego } from '../components/minijuegos.js';
import { juegoGanado, registrarJuego } from '../services/juegos.service.js';
import { renderPanel } from '../main.js';

var DIA_DEFAULT = ['fogata', 'radio', 'trivia15', 'red', 'fogata', 'radio', 'trivia15'];
var JUEGOS_DIA = ['fogata', 'radio', 'trivia15', 'red', 'estacas', 'cuentas', 'proveeduria'];

export var DEPTO_JUEGO = {
  'Intendencia': 'estacas',
  'Logística': 'proveeduria',
  'Administración': 'cuentas',
  'Comunicaciones': 'red',
  'Formación': 'trivia15',
  'Actividades': 'fogata'
};

export function juegoDelDia(day){
  if(day.minijuego !== undefined) return MINIJUEGOS[day.minijuego] ? day.minijuego : '';
  var i = AppState.state.days.indexOf(day);
  return DIA_DEFAULT[i] || '';
}

// true = el texto del día queda tapado hasta ganar.
export function textoBloqueado(day){
  var j = juegoDelDia(day);
  return !!(j && day.minijuegoBloquea && !juegoGanado('dia-' + day.id) && !canEditStructure());
}

function textoGanado(clave){
  var p = registrarJuego(clave);
  return p ? '+' + p + (p === 1 ? ' punto bonus' : ' puntos bonus') + ' para tu comando.' : '';
}

export function renderJuegoDelDiaHtml(day){
  var j = juegoDelDia(day), html = '';
  if(j){
    var ganado = juegoGanado('dia-' + day.id), bloq = textoBloqueado(day);
    html += '<div class="mj-card' + (bloq ? ' mj-card-bloq' : '') + '">';
    html += '<div><span class="mj-card-kicker">' + (bloq ? '🔒 Desafío para desbloquear la reflexión' : 'Desafío del día') + '</span>';
    html += '<strong>' + escapeHtml(MINIJUEGOS[j].titulo) + '</strong>' + (ganado ? ' <span class="mj-hecho">✓ Superado</span>' : '') + '</div>';
    html += '<button type="button" class="btn small' + (ganado ? ' ghost' : '') + '" data-jugar-dia="' + escapeHtml(day.id) + '">' + (ganado ? 'Jugar otra vez' : 'Jugar') + '</button>';
    html += '</div>';
  }
  if(canEditStructure()){
    html += '<div class="mj-config"><label>Desafío del día <select id="dayJuegoSelect"><option value="">Ninguno</option>' +
      JUEGOS_DIA.map(function(id){ return '<option value="' + id + '"' + (id === j ? ' selected' : '') + '>' + escapeHtml(MINIJUEGOS[id].titulo) + '</option>'; }).join('') +
      '</select></label>' + (j ? '<label class="mj-config-check"><input type="checkbox" id="dayJuegoBloquea"' + (day.minijuegoBloquea ? ' checked' : '') + '> Tapar el texto del día hasta ganarlo</label>' : '') + '</div>';
  }
  return html;
}

export function attachJuegoDelDia(day){
  var b = document.querySelector('[data-jugar-dia]');
  if(b) b.onclick = function(){
    abrirMinijuego(juegoDelDia(day), { alGanar: function(){ return textoGanado('dia-' + day.id); }, alCerrar: renderPanel });
  };
  var sel = document.getElementById('dayJuegoSelect');
  if(sel) sel.onchange = function(){ day.minijuego = sel.value; if(!sel.value) delete day.minijuegoBloquea; save(); renderPanel(); };
  var chk = document.getElementById('dayJuegoBloquea');
  if(chk) chk.onchange = function(){ if(chk.checked) day.minijuegoBloquea = true; else delete day.minijuegoBloquea; save(); renderPanel(); };
}

export function renderJuegosDeptoHtml(filtro){
  var deptos = filtro ? [filtro] : Object.keys(DEPTO_JUEGO);
  deptos = deptos.filter(function(d){ return DEPTO_JUEGO[d]; });
  if(!deptos.length) return '';
  var html = '<div class="mj-deptos">';
  deptos.forEach(function(d){
    var j = DEPTO_JUEGO[d], ganado = juegoGanado('depto-' + d);
    html += '<button type="button" class="mj-depto' + (ganado ? ' mj-depto-hecho' : '') + '" data-jugar-depto="' + escapeHtml(d) + '">' +
      '<span class="mj-card-kicker">' + escapeHtml(d) + '</span><strong>' + escapeHtml(MINIJUEGOS[j].titulo) + '</strong>' +
      (ganado ? '<span class="mj-hecho">✓ Superado</span>' : '<span class="mj-jugar">Jugar ›</span>') + '</button>';
  });
  return html + '</div>';
}

export function attachJuegosDepto(){
  document.querySelectorAll('[data-jugar-depto]').forEach(function(b){
    b.onclick = function(){
      var d = b.getAttribute('data-jugar-depto');
      abrirMinijuego(DEPTO_JUEGO[d], { alGanar: function(){ return textoGanado('depto-' + d); }, alCerrar: renderPanel });
    };
  });
}
