// Tarjeta de una entrada en la lista (título, tags, autor, Editar/Ver/
// Eliminar/Publicar) — el contenido en sí (los pasos) ya NO se renderiza
// acá: se abre en un overlay con la Fordoquera incrustada, idéntica a "la
// fordoquera" (ver components/fordoquera-embed.js y "Fordoquera
// incrustada" en CLAUDE.md, 09/10/2026). Reemplaza al viejo reproductor de
// pasos propio de RDP (`renderSecuencialEntry`, los embeds de Drive/
// YouTube/Vimeo, las citas de biblioteca, etc. — todo eso ahora lo hace la
// Fordoquera sola, con su propio reproductor).

import { AppState } from '../app-state.js';
import { escapeHtml } from '../utils/helpers.js';
import { entryToEspacio } from '../utils/entry-to-espacio.js';
import { entryScope, canEditEntry, isAdmin, isLectorLike, effectiveRole } from '../services/permissions.js';

  // Uno o más tags de ámbito para una entrada (antes era siempre uno solo) —
  // una sección/depto por cada elegido, más "Comando (sin milicianos)" si corresponde.
  // hideWhenEmpty: en Recursos, el caso General (nada elegido) no muestra tag,
  // porque es el default de la pestaña entera (no hace falta aclararlo).
  export function scopeTagsHtml(entry, hideWhenEmpty){
    var scope = entryScope(entry);
    var tags = [];
    var seccionSuffix = entry.seccionesComandoOnly ? ' · solo comando' : '';
    scope.secciones.forEach(function(s){ tags.push('<span class="tag seccion">' + escapeHtml(s) + seccionSuffix + '</span>'); });
    scope.deptos.forEach(function(d){ tags.push('<span class="tag seccion">' + escapeHtml(d) + '</span>'); });
    if(scope.comandoGeneral){ tags.push('<span class="tag seccion">' + (entry.dayId === null ? 'General' : 'Comando (sin milicianos)') + '</span>'); }
    if(tags.length === 0){ return hideWhenEmpty ? '' : '<span class="tag seccion">General</span>'; }
    return tags.join('');
  }


  // "El circulito" (feedback de Comunicaciones, 09/10/2026, comentario 2):
  // círculo chico con las iniciales del departamento/sección de quien
  // publicó — reemplaza al viejo tag de tipo de contenido ("Texto"/
  // "Secuencial"/etc.), que ya no tiene sentido desde que toda entrada pasa
  // por la Fordoquera.
  var GRUPO_INITIALS = {
    'FORDOC': 'FD',
    'Escuderos': 'ES',
    'Templarios Menores': 'TM',
    'Templarios Intermedios': 'TI',
    'Templarios Mayores': 'TY',
    'Formación': 'FD',
    'Logística': 'LO',
    'Comunicaciones': 'CO',
    'Administración': 'AD',
    'Intendencia': 'IN',
    'Actividades': 'AC'
  };

  // `entry.authorGrupo` se guarda al crear la entrada (ver
  // components/fordoquera-embed.js) — para entradas de ANTES de este
  // campo, que no lo tienen, la única señal retrocompatible es
  // `author === 'FORDOC'` (las 8 reflexiones precargadas de `defaultData()`).
  function resolveAuthorGrupo(entry){
    if(entry.authorGrupo) return entry.authorGrupo;
    if(entry.author === 'FORDOC') return 'FORDOC';
    return '';
  }

  function authorGrupoBadgeHtml(entry){
    var grupo = resolveAuthorGrupo(entry);
    if(!grupo) return '';
    var initials = GRUPO_INITIALS[grupo] || grupo.slice(0, 2).toUpperCase();
    return '<span class="author-grupo-circle" title="' + escapeHtml(grupo) + '">' + escapeHtml(initials) + '</span>';
  }


  export function renderEntry(entry){
    var canEdit = canEditEntry(entry);
    var espacio = entryToEspacio(entry);
    var stepCount = (espacio.steps || []).length;
    var html = '<div class="entry" data-id="' + entry.id + '">';
    html += '  <div class="entry-top">';
    html += '    <div class="entry-head-main">';
    html += '<div class="entry-title-row">';
    html += authorGrupoBadgeHtml(entry);
    html += '  <h3 class="entry-title">' + escapeHtml(entry.title || espacio.title || '(sin título)') + '</h3>';
    html += '</div>';
    // En Info general no hace falta ningún tag — la pestaña entera es general y
    // nunca se puede scopear. En Recursos, en cambio, desde que se puede scopear
    // sí hace falta mostrarlo (si no queda invisible que un recurso es "solo
    // para mi sección"); el caso General de Recursos sigue sin tag, igual que
    // antes, porque sigue siendo el default de la pestaña entera.
    // Un lector (miliciano, capellán, etc.) nunca ve las etiquetas de ámbito —
    // le revelarían que esa entrada también es visible para otras secciones o
    // departamentos, información que no le corresponde.
    var scopeTag = (entry.dayId === 'INFO_GENERAL' || isLectorLike(effectiveRole())) ? '' : scopeTagsHtml(entry, entry.dayId === 'RESOURCES');
    // "Oculta" (borrador): solo puede LLEGAR a verse este tag si `canSeeEntry`
    // ya dejó pasar a quien mira — y esa función solo deja ver una entrada
    // oculta a quien puede editarla — así que este tag nunca se le escapa a
    // un lector/miliciano.
    var ocultaTag = entry.oculta ? ' <span class="tag imagen" title="Solo la ven quienes pueden editarla — no publicada todavía">🔒 Oculta</span>' : '';
    // "Permitirme ver siempre todo lo anónimo": un admin (efectivo — respeta
    // "Ver como", para poder previsualizar que un lector/jefe NO lo ve)
    // siempre ve quién publicó una entrada anónima.
    var anonimoTag = (entry.anonimo && isAdmin())
      ? ' <span class="tag imagen" title="Solo vos (admin) ves esto — el resto la ve sin firma">🔒 ' + escapeHtml(entry.authorReal || '(autor desconocido)') + '</span>'
      : '';
    html += '      <div class="entry-meta">' +
      scopeTag + ocultaTag + anonimoTag +
      (entry.anonimo ? '' : (entry.author ? '<span>' + escapeHtml(entry.author) + '</span>' : '')) + '</div>';
    html += '      <div class="entry-start-row">';
    html += '        <button class="btn small entry-start-btn" data-action="view" data-id="' + entry.id + '">Comenzar</button>';
    if(stepCount){ html += '        <span class="entry-step-count">' + stepCount + ' paso' + (stepCount === 1 ? '' : 's') + '</span>'; }
    html += '      </div>';
    html += '    </div>';
    html += '    <div class="entry-actions">';
    if(canEdit){
      // Publicar de un click, sin tener que abrir el editor (pedido del
      // usuario, 23/09/2026: "que se publique en un momento a elección").
      if(entry.oculta){ html += '      <button data-action="publishEntry" data-id="' + entry.id + '">Publicar</button>'; }
      html += '      <button data-action="edit" data-id="' + entry.id + '">Editar</button>';
      html += '      <button data-action="delete" data-id="' + entry.id + '">Eliminar</button>';
    }
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
    return html;
  }


  // "+" flotante entre dos entradas (08/10/2026, pedido del usuario: poder
  // elegir dónde cae una entrada nueva, no solo agregarla al final) — una
  // franja angosta entre cada par de entradas consecutivas, invisible hasta
  // que el mouse pasa cerca (ver CSS `.entry-gap`); clickear el "+" abre el
  // formulario de "Agregar entrada" con la posición ya elegida.
  export function renderEntryGap(prevId, nextId){
    return '<div class="entry-gap"><button type="button" class="entry-gap-btn" data-action="insertGap" data-prev-id="' + (prevId||'') + '" data-next-id="' + (nextId||'') + '" title="Agregar una entrada acá">+</button></div>';
  }


  // Arma la lista de entradas con un hueco "+" entre cada par consecutivo —
  // solo si `canAddHere` (quien no puede publicar ahí tampoco ve estos
  // controles, mismo criterio que el botón "+ Agregar entrada"). `items` ya
  // viene ordenado por quien llama (ascendente por `createdAt`, el mismo
  // orden visual que se ve).
  export function renderEntriesListHtml(items, canAddHere){
    var html = '';
    if(!canAddHere || items.length === 0){
      items.forEach(function(entry){ html += renderEntry(entry); });
      return html;
    }
    items.forEach(function(entry, i){
      html += renderEntry(entry);
      if(i < items.length - 1){ html += renderEntryGap(entry.id, items[i+1].id); }
    });
    return html;
  }
