// T10 — Dónde aparecen los minijuegos (07/11/2026):
//  - Mensaje: un desafío por día (lo elige quien edita la estructura; si no
//    eligió, uno por default según el número de día). Puede «bloquear» el
//    texto del día hasta ganarlo.
//  - Departamentos: un juego por día, al azar entre los de todos los deptos.
//  - Huevos de pascua: ver huevos.js.
import { AppState } from '../app-state.js';
import { save } from '../services/state.service.js';
import { canEditStructure } from '../services/permissions.js';
import { escapeHtml } from '../utils/helpers.js';
import { abrirMinijuego } from '../components/minijuegos-lazy.js';
import { MINIJUEGOS_TITULOS } from '../config/minijuegos-catalogo.js';
import { juegoGanado, registrarJuego, hoyClave } from '../services/juegos.service.js';
import { renderPanel } from '../main.js';

// Dos (o más) juegos propios de cada sección y departamento (07/11/2026).
export var SECCION_JUEGOS = {
  'Escuderos': ['obstaculos', 'huellas'],
  'Templarios Menores': ['nudos', 'mochila'],
  'Templarios Intermedios': ['azimut', 'rio'],
  'Templarios Mayores': ['pira', 'rescate']
};
export var DEPTO_JUEGOS = {
  'Formación': ['trivia15', 'rompecabezas'],
  'Logística': ['ruta', 'carga', 'proveeduria'],
  'Comunicaciones': ['radioperador', 'interferencia', 'red'],
  'Administración': ['racionamiento', 'auditoria', 'cuentas'],
  'Intendencia': ['estacas', 'lonas', 'residuos'],
  'Actividades': ['laberinto', 'posta']
};
function aplanar(m){ return Object.keys(m).reduce(function(a, k){ return a.concat(m[k]); }, []); }
// Mensaje: los de las secciones + fogata y radio. Departamentos: los de los deptos.
// Juegos de fe (07/11/2026): entran en el sorteo del Mensaje, junto a los de secciones.
export var FE_JUEGOS = ['fundamento', 'partesMisa', 'misterios'];
var JUEGOS_DIA = ['fogata', 'radio'].concat(FE_JUEGOS, aplanar(SECCION_JUEGOS));
export var JUEGOS_DEPTOS = aplanar(DEPTO_JUEGOS);

// «Escuderos», «Logística»… del juego (para la tarjeta).
function grupoDe(id){
  var m = Object.assign({}, SECCION_JUEGOS, DEPTO_JUEGOS);
  if(FE_JUEGOS.indexOf(id) >= 0) return 'Fe';
  return Object.keys(m).find(function(k){ return m[k].indexOf(id) >= 0; }) || '';
}

// Sorteo estable por persona y fecha (cambia cada día).
function sorteo(extra, n){
  var u = AppState.currentUser, semilla = (u && u.uid || '') + hoyClave() + extra, h = 0;
  for(var i = 0; i < semilla.length; i++){ h = (h * 31 + semilla.charCodeAt(i)) | 0; }
  return Math.abs(h) % n;
}

// Sin elegir (o «azar») = rota: cada persona, cada día, uno al azar
// (pedido del usuario, 07/11/2026). El admin puede fijar uno o ninguno.
export function juegoDelDia(day){
  if(day.minijuego === undefined || day.minijuego === 'azar') return JUEGOS_DIA[sorteo(day.id, JUEGOS_DIA.length)];
  return MINIJUEGOS_TITULOS[day.minijuego] ? day.minijuego : '';
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
    var g = grupoDe(j);
    html += '<div><span class="mj-card-kicker">' + (bloq ? '🔒 Desafío para desbloquear la reflexión' : 'Desafío del día') + (g ? ' · ' + escapeHtml(g) : '') + '</span>';
    html += '<strong>' + escapeHtml(MINIJUEGOS_TITULOS[j]) + '</strong>' + (ganado ? ' <span class="mj-hecho">✓ Superado</span>' : '') + '</div>';
    html += '<button type="button" class="btn small' + (ganado ? ' ghost' : '') + '" data-jugar-dia="' + escapeHtml(day.id) + '">' + (ganado ? 'Jugar otra vez' : 'Jugar') + '</button>';
    html += '</div>';
  }
  if(canEditStructure()){
    var azar = day.minijuego === undefined || day.minijuego === 'azar';
    html += '<div class="mj-config"><label>Desafío del día <select id="dayJuegoSelect"><option value="azar"' + (azar ? ' selected' : '') + '>Al azar (cambia cada día)</option><option value=""' + (!j ? ' selected' : '') + '>Ninguno</option>' +
      [['Generales', ['fogata', 'radio']], ['Fe', FE_JUEGOS]].concat(Object.keys(SECCION_JUEGOS).map(function(k){ return [k, SECCION_JUEGOS[k]]; }), Object.keys(DEPTO_JUEGOS).map(function(k){ return [k, DEPTO_JUEGOS[k]]; })).map(function(gr){
        return '<optgroup label="' + escapeHtml(gr[0]) + '">' + gr[1].map(function(id){ return '<option value="' + id + '"' + (!azar && id === j ? ' selected' : '') + '>' + escapeHtml(MINIJUEGOS_TITULOS[id]) + '</option>'; }).join('') + '</optgroup>';
      }).join('') +
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

// Departamentos (07/11/2026, pedido del usuario): a cada persona le toca UN
// juego por día, al azar entre los de todos los departamentos (cualquiera
// puede jugar el de cualquier depto). Puntos: la primera vez que se gana cada
// juego (`depto-<juego>`).
function juegoDeptoDeHoy(){ return JUEGOS_DEPTOS[sorteo('', JUEGOS_DEPTOS.length)]; }

export function renderJuegosDeptoHtml(){
  var j = juegoDeptoDeHoy(), ganado = juegoGanado('depto-' + j);
  return '<div class="mj-card"><div><span class="mj-card-kicker">Juego de hoy · ' + escapeHtml(grupoDe(j)) + '</span><strong>' + escapeHtml(MINIJUEGOS_TITULOS[j]) + '</strong>' +
    (ganado ? ' <span class="mj-hecho">✓ Ya lo superaste</span>' : '') + '</div>' +
    '<button type="button" class="btn small' + (ganado ? ' ghost' : '') + '" data-jugar-depto="' + escapeHtml(j) + '">' + (ganado ? 'Jugar otra vez' : 'Jugar') + '</button></div>';
}

export function attachJuegosDepto(){
  document.querySelectorAll('[data-jugar-depto]').forEach(function(b){
    b.onclick = function(){
      var j = b.getAttribute('data-jugar-depto');
      abrirMinijuego(j, { alGanar: function(){ return textoGanado('depto-' + j); }, alCerrar: renderPanel });
    };
  });
}
