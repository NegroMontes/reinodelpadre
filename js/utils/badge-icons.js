// Ícono de sección/departamento para el badge derecho del avatar de usuario
// (09/10/2026, pedido del usuario) — complemento del ícono de actividad
// favorita (ya existente, ver activityIcon() en helpers.js), del lado
// opuesto del avatar, inclinado en espejo.
//
// Los dos escudos de sección (Escuderos/Templarios) son una RECREACIÓN en
// SVG a partir de los archivos reales que pasó el usuario por Drive
// ("Escuderos.png"/"Templarios.png") — no una copia de píxel a píxel (este
// entorno no pudo bajar esos dos archivos completos sin corromperlos, ver
// CLAUDE.md), armada a partir de haberlos visto directamente en el chat:
// mismo escudo (capuchón negro arriba + cuerpo redondeado abajo, con una
// flecha central) en dos variantes de color — blanco con flecha verde
// (Escuderos) y verde con flecha blanca (Templarios). Las 3 secciones de
// Templarios (Menores/Intermedios/Mayores) comparten el mismo escudo — el
// usuario solo pasó un diseño para "Templarios" en general, sin variantes
// por tier.
//
// El glifo de FASTA (ícono DEFAULT para cualquier departamento) sí es el
// archivo real del usuario ("Escudo de Fasta.png"), recortado por este
// entorno a partir del PNG bajado completo — se aisló el componente central
// (las tres flechas unidas con una cruz) y se descartaron el anillo de
// texto y el fondo, quedando como `assets/depto-fasta.png` (transparente).
//
// Ícono para admin/comando central (09/10/2026, pedido del usuario — no
// tenían ningún ícono, a diferencia de sección/depto): a elegir entre una
// lista chica de emoji (CUPULA_ICONS, config/constants.js), guardado en el
// perfil como `cupulaIcon` (la `value`, no el emoji directo).

import { CUPULA_ICONS } from '../config/constants.js';

function shieldSvg(bodyColor, arrowColor){
  return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M6 4 H94 V42 L50 66 L6 42 Z" fill="#000"/>'
    + '<path d="M6 42 L50 66 L94 42 V58 Q94 102 50 118 Q6 102 6 58 Z" fill="' + bodyColor + '" stroke="#000" stroke-width="4" stroke-linejoin="round"/>'
    + '<path d="M50 48 L70 68 H59 V106 H41 V68 H30 Z" fill="' + arrowColor + '" stroke="#000" stroke-width="3" stroke-linejoin="round"/>'
    + '</svg>';
}

var ESCUDEROS_SVG = shieldSvg('#FFFFFF', '#5a9e6f');
var TEMPLARIOS_SVG = shieldSvg('#5a9e6f', '#FFFFFF');

// Devuelve el SVG del escudo correspondiente a una sección, o '' si el
// nombre no matchea ninguna (defensivo — nunca debería pasar con los
// valores reales de SECCIONES).
export function sectionShieldSvg(seccion){
  if(!seccion) return '';
  if(seccion === 'Escuderos') return ESCUDEROS_SVG;
  if(seccion.indexOf('Templarios') === 0) return TEMPLARIOS_SVG;
  return '';
}

// El glifo de FASTA es siempre el mismo archivo — una sola función, sin
// parámetros.
export function fastaGlyphHtml(){
  return '<img src="assets/depto-fasta.png" alt="FASTA" style="width:100%;height:100%;object-fit:contain;padding:2px;box-sizing:border-box;">';
}

// Emoji elegido por un admin/comando central para su propio badge — '' si
// todavía no eligió ninguno (nunca explota con un value viejo/inválido).
export function cupulaIconEmoji(value){
  if(!value) return '';
  var found = CUPULA_ICONS.filter(function(o){ return o.value === value; })[0];
  return found ? found.emoji : '';
}

// Ícono de sección/depto de UN usuario cualquiera (no necesariamente
// currentUser) — reusado tanto por el badge del propio avatar (header.js)
// como por las tarjetas de "Mi comando" (views/mandos.js), para no duplicar
// este mismo criterio en dos lugares. `deptoIcons` es el mapa
// DEPARTAMENTO_ICONS (se pasa como parámetro para no crear una dependencia
// circular con config/constants.js).
export function userBadgeInnerHtml(u, deptoIcons){
  if(!u) return '';
  if(u.seccion){
    return sectionShieldSvg(u.seccion);
  }
  if(u.depto){
    if(u.deptoIconChoice === 'depto'){ return (deptoIcons && deptoIcons[u.depto]) || ''; }
    return fastaGlyphHtml();
  }
  // Sin sección ni depto — típicamente admin/comando central (09/10/2026):
  // el emoji que haya elegido, o '' si todavía no eligió ninguno (mismo
  // criterio de "sin badge" que ya tenía antes de agregar esta opción).
  var cupulaEmoji = cupulaIconEmoji(u.cupulaIcon);
  return cupulaEmoji ? '<span class="user-badge-emoji">' + cupulaEmoji + '</span>' : '';
}
