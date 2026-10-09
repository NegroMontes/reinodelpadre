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
// tenían ningún ícono, a diferencia de sección/depto): primero una lista
// chica de emoji heráldicos sueltos, reemplazada el mismo día (pedido del
// usuario: "dame a elegir solamente entre los iconos de las secciones y
// departamentos (o consagrados)") por un menú agrupado que reusa los MISMOS
// íconos ya existentes de sección/depto/consagrado — ver
// `cupulaIconOptionsHtml()`/`cupulaIconBadgeHtml()`/`isValidCupulaIconValue()`
// más abajo. Guardado en el perfil como `cupulaIcon`, un string con prefijo
// (`seccion:Escuderos`, `depto:Logística`, `consagrado:cruz`, o `cocina`).

import { DEPARTAMENTOS, DEPARTAMENTO_ICONS, CONSAGRADO_ICONS, COCINA_ICON } from '../config/constants.js';
import { escapeHtml } from './helpers.js';

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

// Emoji elegido por un consagrado para su propio badge (opt-in, en vez del
// escudo de su sección) — '' si no eligió ninguno (el default sigue siendo
// el escudo, ver userBadgeInnerHtml()).
export function consagradoIconEmoji(value){
  if(!value) return '';
  var found = CONSAGRADO_ICONS.filter(function(o){ return o.value === value; })[0];
  return found ? found.emoji : '';
}

// Ícono elegido por un admin/comando central (`u.cupulaIcon`), resuelto a su
// HTML real — un string con prefijo que apunta a los MISMOS datos que ya
// usan sección/depto/consagrado (09/10/2026, rediseño pedido por el
// usuario). '' si todavía no eligió nada, o si el value guardado no matchea
// ningún caso conocido (defensivo, nunca explota).
export function cupulaIconBadgeHtml(value){
  if(!value) return '';
  if(value.indexOf('seccion:') === 0){
    return sectionShieldHtml(value.slice(8));
  }
  if(value.indexOf('depto:') === 0){
    var emoji = DEPARTAMENTO_ICONS[value.slice(6)] || '';
    return emoji ? '<span class="user-badge-emoji">' + emoji + '</span>' : '';
  }
  if(value.indexOf('consagrado:') === 0){
    var cEmoji = consagradoIconEmoji(value.slice(11));
    return cEmoji ? '<span class="user-badge-emoji">' + cEmoji + '</span>' : '';
  }
  if(value === 'cocina'){
    return '<span class="user-badge-emoji">' + COCINA_ICON + '</span>';
  }
  return '';
}

// El `<optgroup>`/`<option>` del selector de "Perfil" para elegir el ícono
// de cúpula — agrupado igual que `viewAsScopeOptionsHtml()` (secciones y
// departamentos ya armados así en otro lado de la app, mismo criterio
// visual). `current` es el `cupulaIcon` ya guardado, para marcar `selected`.
export function cupulaIconOptionsHtml(current){
  var html = '';
  html += '<optgroup label="Secciones">';
  html += '  <option value="seccion:Escuderos"' + (current === 'seccion:Escuderos' ? ' selected' : '') + '>Escuderos</option>';
  html += '  <option value="seccion:Templarios"' + (current === 'seccion:Templarios' ? ' selected' : '') + '>Templarios</option>';
  html += '</optgroup>';
  html += '<optgroup label="Departamentos">';
  DEPARTAMENTOS.forEach(function(d){
    var v = 'depto:' + d;
    html += '  <option value="' + v + '"' + (current === v ? ' selected' : '') + '>' + DEPARTAMENTO_ICONS[d] + ' ' + escapeHtml(d) + '</option>';
  });
  html += '</optgroup>';
  html += '<optgroup label="Consagrado">';
  CONSAGRADO_ICONS.forEach(function(o){
    var v = 'consagrado:' + o.value;
    html += '  <option value="' + v + '"' + (current === v ? ' selected' : '') + '>' + o.emoji + ' ' + escapeHtml(o.label) + '</option>';
  });
  html += '</optgroup>';
  html += '<option value="cocina"' + (current === 'cocina' ? ' selected' : '') + '>' + COCINA_ICON + ' Cocina</option>';
  return html;
}

// Validación del lado del cliente antes de escribir en Firestore (mismo
// criterio que ya usa consagradoIconEmoji en updateMyProfile()) — nunca un
// string suelto sin chequear contra los valores reales.
export function isValidCupulaIconValue(value){
  if(value === 'seccion:Escuderos' || value === 'seccion:Templarios') return true;
  if(typeof value !== 'string') return false;
  if(value.indexOf('depto:') === 0){ return DEPARTAMENTOS.indexOf(value.slice(6)) !== -1; }
  if(value.indexOf('consagrado:') === 0){
    var key = value.slice(11);
    return CONSAGRADO_ICONS.some(function(o){ return o.value === key; });
  }
  return value === 'cocina';
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
  // lo que haya elegido del menú agrupado, o '' si todavía no eligió nada
  // (mismo criterio de "sin badge" que ya tenía antes de agregar esta
  // opción).
  return cupulaIconBadgeHtml(u.cupulaIcon);
}
