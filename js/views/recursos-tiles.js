// Tarjetas de Recursos que llevan a vistas que se bajan recién al abrirlas
// (cancionero/misas y test del hijo bíblico — carga diferida, 12/11/2026).
import { AppState } from '../app-state.js';
import { escapeHtml } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';
import { ensureCancioneroSub } from '../services/cancionero.service.js';
import { HIJOS_BIBLICOS, PREGUNTAS_HIJO_BIBLICO } from '../config/test-hijo-biblico.js';
import { renderPanel } from '../main.js';

  function hijoDe(u){
    var k = u && u.hijoBiblico;
    return HIJOS_BIBLICOS[k] ? k : '';
  }

  export function cantosRosarioTileHtml(){
    ensureCancioneroSub();
    var n = AppState.cancionero.filter(function(c){ return c.categoria === 'rosario'; }).length;
    return '<button type="button" class="recurso-cat' + (n ? '' : ' recurso-cat-empty') + '" data-cantos-rosario>' +
      '<span class="recurso-cat-icon">' + icon('music') + '</span>' +
      '<span class="recurso-cat-label">Cantos para el Rosario</span>' +
      '<span class="recurso-cat-count">' + (n ? n + ' canto' + (n === 1 ? '' : 's') : 'Vacía') + '</span>' +
      '</button>';
  }

  export function abrirCantosRosario(){
    AppState.recursosCategoria = 'cancionero';
    AppState.cancioneroVista = 'ver';
    AppState.cancioneroCategoria = 'rosario';
    AppState.cancioneroBusqueda = '';
    AppState.cancioneroCantoId = null;
    AppState.cancioneroDesdeRosario = true;
    renderPanel();
    window.scrollTo(0, 0);
  }

  // Tarjeta del Cancionero entre las subcategorías de Vida espiritual.
  export function cancioneroTileHtml(){
    ensureCancioneroSub();
    var n = AppState.cancionero.length;
    return '<button type="button" class="recurso-cat" data-recurso-cat="cancionero">' +
      '<span class="recurso-cat-icon">' + icon('music') + '</span>' +
      '<span class="recurso-cat-label">Cancionero</span>' +
      '<span class="recurso-cat-count">' + (n ? n + ' canto' + (n === 1 ? '' : 's') : 'Letras de cantos') + '</span>' +
      '</button>';
  }

  export function testHijoTileHtml(){
    var k = hijoDe(AppState.currentUser);
    return '<button type="button" class="recurso-cat" data-recurso-cat="test-hijo">' +
      '<span class="recurso-cat-icon">' + icon('users') + '</span>' +
      '<span class="recurso-cat-label">¿Qué hijo bíblico sos?</span>' +
      '<span class="recurso-cat-count">' + (k ? 'Te salió: ' + escapeHtml(HIJOS_BIBLICOS[k].nombre) : 'Test de ' + PREGUNTAS_HIJO_BIBLICO.length + ' preguntas') + '</span>' +
      '</button>';
  }

