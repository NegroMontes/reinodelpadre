// Ícono de sección/departamento para el badge derecho del avatar de usuario
// (09/10/2026, pedido del usuario) — complemento del ícono de actividad
// favorita (ya existente, ver activityIcon() en helpers.js), del lado
// opuesto del avatar, inclinado en espejo.
//
// Los dos escudos de sección (Escuderos/Templarios) son los archivos REALES
// que el usuario subió — primero quedaron truncados al pasar por Drive (por
// debajo del umbral de tamaño que hace que este entorno guarde el resultado
// a disco de forma confiable, ver CLAUDE.md), así que se armó una
// recreación en SVG como primera versión; el mismo día el usuario los
// volvió a mandar subiéndolos directo a GitHub (sin ese límite), y se
// reemplazó la recreación por el recorte real (fondo negro de Canva sacado
// con flood-fill desde los bordes, mismo criterio que `depto-fasta.png`) —
// `assets/escudo-escuderos.png` / `assets/escudo-templarios.png`. Las 3
// secciones de Templarios (Menores/Intermedios/Mayores) comparten el mismo
// escudo — el usuario solo pasó un diseño para "Templarios" en general, sin
// variantes por tier.
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

import { CUPULA_ICONS, CONSAGRADO_ICONS } from '../config/constants.js';

// Devuelve el <img> del escudo real correspondiente a una sección, o '' si
// el nombre no matchea ninguna (defensivo — nunca debería pasar con los
// valores reales de SECCIONES).
export function sectionShieldHtml(seccion){
  if(!seccion) return '';
  if(seccion === 'Escuderos'){
    return '<img src="assets/escudo-escuderos.png" alt="Escuderos" style="width:100%;height:100%;object-fit:contain;">';
  }
  if(seccion.indexOf('Templarios') === 0){
    return '<img src="assets/escudo-templarios.png" alt="Templarios" style="width:100%;height:100%;object-fit:contain;">';
  }
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

// Emoji elegido por un consagrado para su propio badge (opt-in, en vez del
// escudo de su sección) — '' si no eligió ninguno (el default sigue siendo
// el escudo, ver userBadgeInnerHtml()).
export function consagradoIconEmoji(value){
  if(!value) return '';
  var found = CONSAGRADO_ICONS.filter(function(o){ return o.value === value; })[0];
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
  // Un consagrado que optó por un ícono propio (cruz/pan) lo muestra en vez
  // del escudo de su sección — chequeo antes de `u.seccion`, porque un
  // consagrado SIEMPRE tiene una sección asignada (es cómo se auto-aprueba
  // en el onboarding) y por default seguiría cayendo en esa rama.
  if(u.role === 'consagrado'){
    var consagradoEmoji = consagradoIconEmoji(u.consagradoIconChoice);
    if(consagradoEmoji) return '<span class="user-badge-emoji">' + consagradoEmoji + '</span>';
  }
  if(u.seccion){
    return sectionShieldHtml(u.seccion);
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
