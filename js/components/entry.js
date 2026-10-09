// Renderizado de una entrada individual (texto/enlace/imagen/video/
// secuencial): el helper de alineación, los embeds de Drive/YouTube/
// Vimeo, el reproductor de una entrada secuencial (con su música de
// fondo y modo pantalla completa) y el armado final del <div class="entry">.

import { AppState } from '../app-state.js';
import { ALIGN_OPTIONS, LIBROS_META, LIBROS_ORDER } from '../config/constants.js';
import { escapeHtml, linkify, alignStyleAttr } from '../utils/helpers.js';
import { entryScope, canEditEntry, isAdmin, isLectorLike, effectiveRole } from '../services/permissions.js';
import { canSeeCompletions } from '../services/progress.service.js';
import { renderPanel } from '../main.js';

  // Alineación por zona de texto (22/09/2026) — ver comentario de `formAligns`
  // más arriba. `alignStyleAttr` nunca se aplica a un contenedor que también
  // tenga botones adentro (esa era la causa del bug reportado con el viejo
  // selector único) — solo a los `<div>` de texto individuales de abajo.
  // `scope` es 'form' (zona a nivel de la entrada — field: 'body'|'bodyAfter')
  // o 'step' (zona adentro de un paso de una secuencial — field:
  // 'align'|'preTextAlign'|'postTextAlign', con `idx` = índice del paso).
  export function renderAlignPicker(scope, field, idx, current){
    var cur = current || 'left';
    var html = '<div class="align-row"><span class="align-row-label">Alineación</span>';
    html += '<div class="align-picker" data-scope="' + scope + '" data-field="' + field + '"' + (idx !== null && idx !== undefined ? ' data-idx="' + idx + '"' : '') + '">';
    ALIGN_OPTIONS.forEach(function(a){
      html += '<button type="button" data-align="' + a[0] + '" class="' + (cur===a[0]?'active':'') + '" title="Alinear: ' + a[1] + '">' + a[1] + '</button>';
    });
    html += '</div></div>';
    return html;
  }


  // Envuelve un texto (si lo hay) en su propia zona alineable — nunca se
  // imprime nada si el texto está vacío, para no dejar una caja fantasma.
  export function textZoneHtml(text, align){
    if(!text) return '';
    return '<div class="entry-text-zone"' + alignStyleAttr(align) + '>' + linkify(text) + '</div>';
  }


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


  // Helpers para reconocer links de hosting comunes (Drive, YouTube, Vimeo) y
  // convertirlos a una forma que sí se puede embeber/hotlinkear — pegar el
  // link de "compartir" tal cual (ej. drive.google.com/file/d/XXX/view) no
  // sirve como src de <img>/<iframe>: esas URLs devuelven una página HTML de
  // visor, no el archivo en sí. (22/09/2026, reporte del usuario: "al poner
  // links de pdfs, videos o fotos no se carga el recurso".)
  // (22/09/2026) Ampliado: el regex original solo reconocía `uc?id=XXX` con el
  // id pegado justo después del `?` — pero muchos links de Drive vienen como
  // `uc?export=view&id=XXX` (el id después de OTRO parámetro), que no matcheaba
  // y dejaba la imagen rota. Ahora primero busca `/file/d/XXX/` (el formato del
  // link de "compartir" más común) y si no, cualquier `?id=XXX` o `&id=XXX` en
  // la URL, sea cual sea el resto de los parámetros.
  export function driveFileId(url){
    if(!url || url.indexOf('drive.google.com') === -1) return null;
    var m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if(m) return m[1];
    m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }


  export function youtubeId(url){
    var m = (url||'').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : null;
  }


  export function vimeoId(url){
    var m = (url||'').match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? m[1] : null;
  }


  // Devuelve el src embebible para una imagen, o la URL tal cual si no matchea
  // ningún formato conocido (URLs directas a .jpg/.png/etc. ya funcionaban).
  export function embeddableImageSrc(url){
    var drive = driveFileId(url);
    return drive ? ('https://drive.google.com/thumbnail?id=' + drive + '&sz=w1600') : url;
  }


  // Arma el bloque embebido para "video"/"enlace" (PDFs, Drive, YouTube,
  // Vimeo) — siempre agrega también el link crudo como alternativa, por si el
  // embed no carga (ej. archivo de Drive no compartido públicamente).
  export function embedBlockHtml(url, kind){
    var yt = youtubeId(url), vim = vimeoId(url), drive = driveFileId(url);
    var rawLink = '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="entry-embed-fallback">Abrir en una pestaña nueva ↗</a>';
    if(yt){
      return '<div class="entry-embed-video"><iframe src="https://www.youtube.com/embed/' + yt + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>' + rawLink;
    }
    if(vim){
      return '<div class="entry-embed-video"><iframe src="https://player.vimeo.com/video/' + vim + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>' + rawLink;
    }
    if(drive){
      // El visor de Drive ("preview") sirve tanto para video como para PDF/
      // docs/otros archivos subidos ahí.
      return '<div class="entry-embed-pdf"><iframe src="https://drive.google.com/file/d/' + drive + '/preview"></iframe></div>' + rawLink;
    }
    // El tipo "pdf" fuerza siempre el visor, sea cual sea la URL (pensado
    // para un PDF servido directo que no termina en ".pdf", o un link al que
    // de todas formas le conviene el embed) — "enlace" sigue necesitando la
    // extensión, para no forzar un iframe sobre cualquier link cualquiera.
    if(kind === 'pdf' || (kind === 'enlace' && /\.pdf(\?|#|$)/i.test(url))){
      return '<div class="entry-embed-pdf"><iframe src="' + escapeHtml(url) + '"></iframe></div>' + rawLink;
    }
    // Un video subido al Drive del usuario ya cae en la rama de arriba
    // (matchea `driveFileId`, se embebe con el visor de Drive). Esta rama es
    // para cualquier OTRO link directo a un archivo de video (.mp4/.webm/
    // etc., alojado en cualquier lugar que no sea Drive/YouTube/Vimeo) — se
    // embebe con la etiqueta <video> nativa del navegador en vez de caer
    // directo al link suelto (pedido del usuario, 22/09/2026).
    if(kind === 'video' && /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(url)){
      return '<div class="entry-embed-video"><video controls src="' + escapeHtml(url) + '"></video></div>' + rawLink;
    }
    // Ningún formato embebible reconocido (ej. un link a otro sitio, o un
    // video subido a un host que no soporta iframe): queda como link simple.
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(url) + '</a>';
  }


  // Entrada "secuencial" (22/09/2026) — se recorre paso a paso en vez de
  // mostrarse toda junta. `myProgress[entry.id]` (cache local de la
  // suscripción en vivo a `entryProgress`, ver `ensureProgressSubs()`) dice
  // si la persona ya la completó o tiene una respuesta guardada; la
  // navegación en sí (`secuencialOpenEntryId`/`secuencialStepIndex`) no se
  // persiste — siempre arranca del paso 1 al abrirla, simplificación
  // consciente (ver CLAUDE.md).
  // Lista, uno debajo del otro, el recordatorio de CADA paso de "propósito
  // personal" que la persona ya haya respondido (antes solo se mostraba el
  // último si había varios — bug reportado por el usuario, 22/09/2026).
  export function renderPropositosRecordatorio(steps, progress){
    if(!progress || !progress.respuestas) return '';
    var respuestas = [];
    steps.forEach(function(s, i){
      if(s.type !== 'proposito') return;
      var val = progress.respuestas[i];
      if(val) respuestas.push(val);
    });
    if(!respuestas.length) return '';
    // El título va UNA sola vez, afuera de las cajas (no adentro de la
    // primera) — y en plural si hay más de un propósito respondido (pedido
    // del usuario, 22/09/2026).
    var title = respuestas.length === 1 ? 'Te recordamos tu propósito:' : 'Te recordamos tus propósitos:';
    var html = '<div class="secuencial-recordatorio-group">';
    html += '<p class="secuencial-recordatorio-title">' + title + '</p>';
    respuestas.forEach(function(val){
      html += '<div class="secuencial-recordatorio"><p class="secuencial-recordatorio-text">' + escapeHtml(val) + '</p></div>';
    });
    html += '</div>';
    return html;
  }


  // Bloquea/desbloquea el scroll de la página mientras el overlay de
  // pantalla completa de una entrada secuencial está activo (pedido del
  // usuario, 22/09/2026) — se llama desde el toggle y desde cualquier lugar
  // que cierre la entrada de otra forma (Finalizar, cerrar sesión).
  export function setSecuencialFullscreenLock(active){
    try{ document.body.classList.toggle('secuencial-fs-lock', active); }catch(e){}
  }


  // Al pasar de paso (Anterior/Siguiente) en una entrada larga, vuelve a la
  // parte más alta de la entrada — si no, con la vista scrolleada hasta la
  // navegación de abajo, había que subir a mano para ver el paso nuevo
  // (pedido del usuario, 22/09/2026). En pantalla completa no hay que
  // scrollear la página (el overlay tapa todo) sino resetear el scroll
  // interno del propio overlay.
  export function scrollSecuencialToTop(entryId){
    try{
      var entryEl = document.querySelector('.entry[data-id="' + entryId + '"]');
      if(!entryEl) return;
      var fsStep = entryEl.querySelector('.secuencial-step.secuencial-fullscreen');
      if(fsStep){ fsStep.scrollTop = 0; return; }
      entryEl.scrollIntoView({ behavior:'smooth', block:'start' });
    }catch(e){}
  }


  // Música de fondo de una entrada secuencial (pedido del usuario, 22/09/2026).
  // Un link de Drive se convierte a descarga directa (mismo `driveFileId` que
  // ya se usa para imágenes/videos); cualquier otro link se usa tal cual —
  // tiene que ser un archivo de audio servido directo (mp3/ogg/etc.), no un
  // link de YouTube/Vimeo (esos son páginas, no un archivo que un <audio> de
  // HTML pueda reproducir).
  export function musicSourceUrl(url){
    var driveId = driveFileId(url);
    return driveId ? ('https://drive.google.com/uc?export=download&id=' + driveId) : url;
  }


  // ===== Citas de libro (26/09/2026) =====
  // Unificación con la herramienta "Encuentros" (leída como modelo de solo
  // lectura, nunca modificada). `book` = { lib:'youcat'|'docat'|'compendio'|
  // 'enciclica'|'yconfirmacion', n:'123' } para una biblioteca precargada, o
  // { lib:'custom', titulo, autor, color, texto } para una cita pegada a
  // mano ("Personalizado" — la vía general para sumar cualquier otra
  // bibliografía, como Cautivante o Salvaje de corazón, sin precargar su
  // texto). Las bibliotecas precargadas se cargan de forma perezosa (lazy) —
  // si todavía no están en caché, se dispara la carga y se llama a
  // `onLoaded` (un re-render) cuando esté lista, mostrando un placeholder
  // mientras tanto.
  var libroDataCache = {}; // lib -> datos cargados | 'loading' | 'error'
  var libroLoadPromises = {};
  export function ensureLibroLoaded(lib){
    if(!LIBROS_META[lib]) return Promise.resolve(null);
    if(libroDataCache[lib] && libroDataCache[lib] !== 'loading') return Promise.resolve(libroDataCache[lib]);
    if(libroLoadPromises[lib]) return libroLoadPromises[lib];
    libroDataCache[lib] = 'loading';
    var p = fetch(LIBROS_META[lib].file).then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(data){
      libroDataCache[lib] = data;
      return data;
    }).catch(function(e){
      console.error('No se pudo cargar la biblioteca "' + lib + '":', e);
      libroDataCache[lib] = 'error';
      throw e;
    });
    libroLoadPromises[lib] = p;
    return p;
  }


  // Acceso de solo lectura al cache de una biblioteca (undefined = nunca se
  // pidió, 'loading'/'error', o los datos ya cargados) — usado por el picker
  // multi-select (ver form.js) para saber, de forma sincrónica durante un
  // render, si ya tiene datos para mostrar o tiene que seguir esperando.
  export function getLibroCache(lib){ return libroDataCache[lib]; }


  // Busca un punto por número (acepta tanto `n` numérico como `num` string,
  // para no depender de si quien arma la cita tipeó "123" o "123 bis").
  export function findLibroPunto(data, numStr){
    if(!data || !data.puntos) return null;
    var asNum = parseInt(numStr, 10);
    return data.puntos.find(function(p){ return p.n === asNum || String(p.num) === String(numStr); }) || null;
  }


  // Busca puntos de una biblioteca ya cargada que matcheen una consulta
  // (08/10/2026, puerto de `pickResults()` de "Encuentros") — para el
  // diálogo "Buscar en los libros" (picker multi-select, ver form.js).
  // Soporta dos formas: números/rangos ("25", "200-215", "12, 40, 88") o
  // texto libre (todas las palabras tienen que aparecer en la pregunta/
  // cuerpo/referencia del punto, sin importar mayúsculas/acentos). Una
  // consulta vacía devuelve todos los puntos (hasta el tope de abajo).
  function normSearch(s){
    return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  export function searchLibroPuntos(data, query){
    if(!data || !data.puntos) return [];
    var q = (query||'').trim();
    if(!q) return data.puntos;
    // ¿Es una lista de números/rangos? (ej. "25", "200-215", "12, 40, 88")
    if(/^[\d.,\s-]+$/.test(q)){
      var wanted = [];
      q.split(',').forEach(function(part){
        part = part.trim(); if(!part) return;
        var range = part.match(/^(\d+)\s*-\s*(\d+)$/);
        if(range){
          var lo = parseInt(range[1], 10), hi = parseInt(range[2], 10);
          for(var n = lo; n <= hi; n++) wanted.push(String(n));
        } else {
          wanted.push(part);
        }
      });
      if(wanted.length){
        return data.puntos.filter(function(p){ return wanted.indexOf(String(p.n)) !== -1 || wanted.indexOf(String(p.num)) !== -1; });
      }
    }
    // Texto libre: cada palabra escrita tiene que aparecer en algún lado del punto.
    var words = normSearch(q).split(/\s+/).filter(Boolean);
    return data.puntos.filter(function(p){
      var hay = normSearch([p.q||'', p.body||'', p.ref||'', p.num||''].join(' '));
      return words.every(function(w){ return hay.indexOf(w) !== -1; });
    });
  }


  // Tarjeta de cita — reusada desde un paso "libro" de una secuencial y
  // desde una entrada legacy de tipo "libro" (de antes del 06/10/2026, ver
  // renderEntry() más abajo).
  export function renderLibroCita(book, onLoaded){
    if(!book || !book.lib) return '';
    if(book.lib === 'custom'){
      var color = book.color || '#6b6b6b';
      var html = '<div class="libro-cita" style="--bc:' + escapeHtml(color) + '">';
      html += '<div class="libro-cita-head"><span class="libro-cita-badge">' + escapeHtml(book.titulo || 'Cita') + '</span>';
      if(book.autor){ html += '<span class="libro-cita-autor">' + escapeHtml(book.autor) + '</span>'; }
      html += '</div>';
      html += '<div class="libro-cita-body">' + linkify(book.texto || '') + '</div>';
      html += '</div>';
      return html;
    }
    var meta = LIBROS_META[book.lib];
    if(!meta) return '';
    var data = libroDataCache[book.lib];
    if(data === undefined || data === 'loading'){
      ensureLibroLoaded(book.lib).then(onLoaded).catch(onLoaded);
      return '<div class="libro-cita libro-cita-loading" style="--bc:' + meta.color + '"><p class="loading-inline"><span class="loading-spinner"></span>Cargando cita de ' + escapeHtml(meta.titulo) + '...</p></div>';
    }
    if(data === 'error'){
      return '<div class="libro-cita" style="--bc:' + meta.color + '"><p class="mandos-sub">No se pudo cargar ' + escapeHtml(meta.titulo) + '.</p></div>';
    }
    var punto = findLibroPunto(data, book.n);
    if(!punto){
      return '<div class="libro-cita" style="--bc:' + meta.color + '"><p class="mandos-sub">No se encontró el punto "' + escapeHtml(String(book.n||'')) + '" en ' + escapeHtml(meta.titulo) + '.</p></div>';
    }
    var cHtml = '<div class="libro-cita" style="--bc:' + meta.color + '">';
    cHtml += '<div class="libro-cita-head"><span class="libro-cita-badge">' + escapeHtml(data.titulo || meta.titulo) + ' ' + escapeHtml(punto.num) + '</span></div>';
    if(punto.q){ cHtml += '<p class="libro-cita-q">' + linkify(punto.q) + '</p>'; }
    cHtml += '<div class="libro-cita-body">' + linkify(punto.body || '') + '</div>';
    if(punto.ref){ cHtml += '<p class="libro-cita-ref">' + escapeHtml(punto.ref) + '</p>'; }
    if(data.attr){ cHtml += '<p class="libro-cita-attr">' + escapeHtml(data.attr) + '</p>'; }
    cHtml += '</div>';
    return cHtml;
  }


  // Campos del editor para un paso "libro" (26/09/2026) — select de
  // biblioteca (las 5 precargadas + "Personalizado") y, según cuál, el
  // número de punto o los campos de una cita pegada a mano.
  export function renderLibroBookFields(book, prefixClass, idx){
    var b = book || { lib:'youcat', n:'' };
    var html = '      <select class="' + prefixClass + 'LibSelect" data-idx="' + idx + '">';
    LIBROS_ORDER.forEach(function(lib){
      html += '<option value="' + lib + '"' + (b.lib === lib ? ' selected' : '') + '>' + escapeHtml(LIBROS_META[lib].titulo) + '</option>';
    });
    html += '<option value="custom"' + (b.lib === 'custom' ? ' selected' : '') + '>Personalizado (otro libro)</option>';
    html += '      </select>';
    if(b.lib === 'custom'){
      html += '      <input type="text" class="' + prefixClass + 'CustomTitulo" data-idx="' + idx + '" placeholder="Título del libro/fuente" value="' + escapeHtml(b.titulo||'') + '">';
      html += '      <input type="text" class="' + prefixClass + 'CustomAutor" data-idx="' + idx + '" placeholder="Autor (opcional)" value="' + escapeHtml(b.autor||'') + '">';
      html += '      <input type="color" class="' + prefixClass + 'CustomColor" data-idx="' + idx + '" value="' + escapeHtml(b.color||'#6b6b6b') + '">';
      html += '      <textarea class="' + prefixClass + 'CustomTexto" data-idx="' + idx + '" placeholder="Pegá el texto de la cita...">' + escapeHtml(b.texto||'') + '</textarea>';
    } else {
      html += '      <input type="text" class="' + prefixClass + 'PuntoInput" data-idx="' + idx + '" placeholder="Número de punto (ej. 5)" value="' + escapeHtml(b.n||'') + '">';
    }
    return html;
  }
  export function renderLibroStepFields(step, idx){
    return renderLibroBookFields(step.book, 'step', idx) +
      '      <p class="mandos-sub">Vista previa:</p>' +
      '      <div class="libro-cita-preview">' + renderLibroCita(step.book, renderPanel) + '</div>';
  }


  // Nota interna (26/09/2026) — visible solo para quien puede editar la
  // entrada (mismo criterio que el aviso de música de fondo roto), nunca
  // para milicianos/lectores: pensado como apunte del disertante ("acordate
  // de mencionar tal cosa"), no contenido para quien recorre la entrada.
  export function renderStepNota(step, entry){
    if(!step.nota || !canEditEntry(entry)) return '';
    return '<p class="step-nota">📝 Nota (solo vos la ves): ' + linkify(step.nota) + '</p>';
  }


  // Separador entre opciones elegidas de una pregunta de opción múltiple —
  // guardado como un único string en `entryProgress.respuestas[idx]` (mismo
  // mapa que ya usa "Propósito personal"). Poco común a propósito, para no
  // confundirse con una coma que pueda aparecer dentro del texto de una
  // opción real.
  export var OPCION_SEP = ' ||| ';


  // Muestra/oculta un paso según la respuesta guardada en un paso anterior
  // (26/09/2026) — `cond:{step, val}`. Compara sin importar mayúsculas/
  // espacios extra, para no exigir una coincidencia letra por letra.
  export function stepCondMatches(step, entry, progress){
    if(!step.cond || step.cond.step === undefined || step.cond.step === null || step.cond.step === '') return true;
    var refIdx = parseInt(step.cond.step, 10);
    var saved = (progress && progress.respuestas && progress.respuestas[refIdx]) || '';
    var expected = (step.cond.val || '').trim().toLowerCase();
    if(!expected) return true;
    return saved.split(OPCION_SEP).map(function(s){ return s.trim().toLowerCase(); }).indexOf(expected) !== -1;
  }


  // ===== Paso "Grupo" (08/10/2026) =====
  // Puerto del tipo "grupo" de "Encuentros" — un paso sin contenido propio
  // (salvo que `slide:true`) que agrupa a TODOS los pasos siguientes hasta
  // el próximo "grupo" (o el final), bajo un título y una condición de
  // visibilidad propia. La condición del grupo se combina (Y lógico) con la
  // de cada paso miembro — si el grupo no aplica, ninguno de sus pasos se
  // muestra, sin importar la condición individual de cada uno.
  //
  // A diferencia de "Encuentros" (que tiene ids por paso y "aplana" la lista
  // antes de reproducir, `playSteps`), RDP referencia los pasos por ÍNDICE
  // dentro del array (`cond.step` ya es un índice, no un id) — así que el
  // "grupo" es simplemente OTRO elemento del mismo array `steps`, sin una
  // lista aparte: `ownerGroupOf` busca hacia atrás el "grupo" más cercano que
  // todavía no haya cerrado (otro "grupo" lo cierra).

  // El "grupo" más cercano que contiene al paso en `idx` (o `null` si ninguno).
  export function ownerGroupOf(steps, idx){
    for(var i = idx - 1; i >= 0; i--){
      if(steps[i].type === 'grupo') return steps[i];
    }
    return null;
  }


  // Rango [inicio, finExclusivo) de un "grupo" que empieza en `idx` — hasta
  // el próximo "grupo" o el final del array. Para cualquier otro tipo de
  // paso, devuelve su propio rango de largo 1 (usado por el constructor de
  // pasos para mover un grupo entero como un solo bloque — ver form.js).
  export function groupRangeAt(steps, idx){
    if(steps[idx] && steps[idx].type === 'grupo'){
      var j = idx + 1;
      while(j < steps.length && steps[j].type !== 'grupo') j++;
      return [idx, j];
    }
    return [idx, idx + 1];
  }


  // Visibilidad real de un paso en la posición `idx` — su propia condición
  // (`stepCondMatches`), y si pertenece a un grupo, también la del grupo. Un
  // paso de tipo "grupo" en sí mismo solo "ocupa" una parada propia en el
  // recorrido si `slide:true` (ahí se muestra como una portada de sección,
  // ver `renderSecuencialEntry`); si no, nunca es una parada (solo gatea a
  // sus miembros) y se salta de largo igual que un paso con condición no
  // cumplida.
  export function stepIsVisible(step, idx, steps, entry, progress){
    if(step.type === 'grupo'){
      return !!step.slide && stepCondMatches(step, entry, progress);
    }
    var grp = ownerGroupOf(steps, idx);
    if(grp && !stepCondMatches(grp, entry, progress)) return false;
    return stepCondMatches(step, entry, progress);
  }


  // Primer paso visible desde `fromIdx`, moviéndose en `dir` (+1/-1), sin
  // pasarse de los límites [0, maxIdx] — usado por "Anterior"/"Siguiente"
  // para saltar de largo los pasos que no aplican (cond no cumplida, o un
  // "grupo" que no corresponde mostrar), en vez de dejar a la persona parada
  // en una pantalla vacía.
  export function nextVisibleStepIndex(steps, entry, progress, fromIdx, dir, maxIdx){
    var i = fromIdx;
    while(i >= 0 && i <= maxIdx){
      if(i >= steps.length || stepIsVisible(steps[i], i, steps, entry, progress)) return i;
      i += dir;
    }
    return Math.max(0, Math.min(maxIdx, fromIdx));
  }


  export function stopSecuencialMusic(){
    try{
      var audio = document.getElementById('secuencialBgAudio');
      if(audio){ audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); }
    }catch(e){}
    AppState.secuencialMusicEntryId = null;
    AppState.secuencialMusicPausedByVideo = false;
    AppState.secuencialMusicErrorId = null;
  }


  // Se llama al abrir una entrada secuencial (nunca al navegar entre pasos de
  // la misma, para no reiniciar la música — ver `updateSecuencialMusicForStep`).
  // Corta cualquier música de OTRA entrada que hubiera quedado sonando, así
  // nunca hay dos a la vez.
  export function startSecuencialMusicIfAny(entry){
    stopSecuencialMusic();
    if(!entry || entry.type !== 'secuencial' || !entry.bgMusicUrl) return;
    try{
      var audio = document.getElementById('secuencialBgAudio');
      if(!audio) return;
      audio.src = musicSourceUrl(entry.bgMusicUrl);
      audio.loop = true;
      audio.volume = 0.5;
      AppState.secuencialMusicEntryId = entry.id;
      // Antes esto fallaba en silencio — si el link no es un archivo de
      // audio reproducible (ej. un link de Drive privado, sin compartir como
      // "Cualquiera con el enlace"), el navegador dispara `error` en el
      // elemento y no se enteraba nadie (pedido del usuario, 23/09/2026: "No
      // puedo escuchar la música"). Ahora se muestra un aviso en la propia
      // entrada (ver renderSecuencialEntry).
      audio.onerror = function(){
        if(AppState.secuencialMusicEntryId === entry.id){ AppState.secuencialMusicErrorId = entry.id; renderPanel(); }
      };
      var p = audio.play();
      // El navegador puede bloquear el autoplay si no lo ve como parte de un
      // gesto reciente del usuario — acá sí lo es (viene del click en
      // "Comenzar"/"Continuar"/"Repasar"), pero por si acaso no rompemos nada
      // si igual lo bloquea; el usuario puede reabrir la entrada para reintentar.
      if(p && p.catch) p.catch(function(){});
    }catch(e){}
  }


  // Pausa la música mientras el paso actual de la entrada sea de tipo Video —
  // es una aproximación, no una detección real de "se está reproduciendo":
  // un video embebido de YouTube/Vimeo/Drive vive en un <iframe> de otro
  // origen, así que JS no puede enterarse desde acá si está sonando de
  // verdad. Pausar mientras se está parado en cualquier paso de video (esté
  // reproduciéndose o no) es lo más cerca que se puede llegar sin agregar las
  // APIs de cada plataforma — cumple el pedido ("que se silencie cuando un
  // video de la entrada se reproduzca") sin arriesgar sonido de fondo
  // superpuesto al del video real. Se llama en cada "Anterior"/"Siguiente".
  export function updateSecuencialMusicForStep(entryId){
    if(AppState.secuencialMusicEntryId !== entryId) return;
    var entry = AppState.state.entries.find(function(e){ return e.id === entryId; });
    var audio = document.getElementById('secuencialBgAudio');
    if(!entry || !audio) return;
    var idx = AppState.secuencialStepIndex[entryId] || 0;
    var step = (entry.steps || [])[idx];
    var isVideoStep = !!(step && step.type === 'video');
    try{
      if(isVideoStep){
        if(!audio.paused){ audio.pause(); AppState.secuencialMusicPausedByVideo = true; }
      } else if(AppState.secuencialMusicPausedByVideo){
        var p = audio.play();
        if(p && p.catch) p.catch(function(){});
        AppState.secuencialMusicPausedByVideo = false;
      }
    }catch(e){}
  }


  export function renderSecuencialEntry(entry){
    var steps = entry.steps || [];
    var progress = AppState.myProgress[entry.id];
    var completed = !!(progress && progress.completedAt);
    var isOpen = AppState.secuencialOpenEntryId === entry.id;
    var html = '<p class="secuencial-summary">' + steps.length + ' paso' + (steps.length === 1 ? '' : 's') +
      (completed ? ' · <span class="secuencial-done">Completado ✓</span>' : '') + '</p>';
    // El botón para ABRIRLA sigue arriba, junto al resumen; el de CERRAR (una
    // vez abierta) se movió abajo de todo el paso, después de la navegación
    // (pedido del usuario, 22/09/2026) — mismo data-action en los dos casos,
    // el handler ya alterna solo entre abrir/cerrar.
    if(!isOpen){
      html += '<button class="btn small" data-action="secuencial-toggle" data-id="' + entry.id + '" type="button">' +
        (completed ? 'Repasar' : 'Comenzar') + '</button>';
      // Solo admin (22/09/2026, comentario del usuario: "¿cómo veo quién
      // completó las entradas?") — un jefe de sección/depto todavía no puede,
      // porque las reglas de Firestore de `entryProgress` solo dejan leer el
      // progreso propio o, a un admin, cualquiera (ver CLAUDE.md).
      if(canSeeCompletions()){
        // Número de completados al lado del botón, y un punto de alerta si
        // hay gente nueva desde la última vez que se abrió el panel (pedido
        // del usuario, 23/09/2026) — ver `ensureCompletionsSubs()`.
        var compList = AppState.secuencialCompletionsCache[entry.id];
        var compCount = Array.isArray(compList) ? compList.length : 0;
        var compSeen = AppState.secuencialCompletionsSeenCount[entry.id];
        var compHasNew = Array.isArray(compList) && compSeen !== undefined && compCount > compSeen;
        html += ' <button class="btn ghost small" data-action="secuencial-completions-toggle" data-id="' + entry.id + '" type="button">' +
          (AppState.secuencialCompletionsOpenId === entry.id ? ('Ocultar (' + compCount + ')') : ('Ver quién la completó (' + compCount + ')')) + '</button>';
        if(compHasNew){
          // Reemplaza al punto rojo chico de antes ("casi ni se ve" —
          // pedido del usuario, 24/09/2026) por un tag "+N" con el mismo
          // estilo que otros badges de alerta del sitio (ej. "🔒 Oculta",
          // "⚠ sugiere: Admin"), mucho más visible. Ya desaparece solo al
          // abrir el panel (`secuencial-completions-toggle` ya actualiza
          // `secuencialCompletionsSeenCount` ahí mismo, sin cambios acá).
          html += ' <span class="tag imagen" title="Gente nueva que la completó desde la última vez que se abrió">+' + (compCount - compSeen) + '</span>';
        }
      }
      // Cerrada y ya completada: se ven los propósitos ahí mismo, sin tener
      // que volver a entrar a la entrada para encontrarlos (pedido del
      // usuario, 22/09/2026).
      if(completed){
        html += renderPropositosRecordatorio(steps, progress);
      }
    }
    if(canSeeCompletions() && AppState.secuencialCompletionsOpenId === entry.id){
      var cached = AppState.secuencialCompletionsCache[entry.id];
      html += '<div class="secuencial-completions">';
      if(cached === undefined){
        html += '<p class="loading-inline"><span class="loading-spinner"></span>Cargando...</p>';
      } else if(cached === 'error'){
        html += '<p class="mandos-sub">No se pudo cargar (¿ya se publicaron las reglas nuevas de Firestore?).</p>';
      } else if(cached.length === 0){
        html += '<p class="mandos-sub">Todavía nadie la completó.</p>';
      } else {
        html += '<p class="mandos-sub">' + cached.length + ' persona' + (cached.length === 1 ? '' : 's') + ' la completó' + (cached.length === 1 ? '' : 'n') + ':</p>';
        html += '<ul class="secuencial-completions-list">';
        cached.forEach(function(c){
          html += '<li>' + escapeHtml(c.displayName) + ' <span class="mandos-sub">· ' + new Date(c.completedAt).toLocaleString('es-AR', { day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit' }) + '</span></li>';
        });
        html += '</ul>';
      }
      html += '</div>';
    }
    if(isOpen){
      // Un paso extra, sintético — nunca se guarda en `entry.steps`, se arma
      // solo al leer — que cierra cualquier entrada secuencial con un
      // agradecimiento fijo y, debajo, el recordatorio de TODOS los pasos de
      // "propósito personal" que tenga la entrada (antes solo aparecía el
      // último ahí mismo, en el propio último paso real — pedido del
      // usuario, 22/09/2026).
      var totalSteps = steps.length + 1;
      var closingIdx = steps.length;
      var idx = AppState.secuencialStepIndex[entry.id] || 0;
      if(idx >= totalSteps) idx = totalSteps - 1;
      if(idx < 0) idx = 0;
      var isFullscreen = AppState.secuencialFullscreenId === entry.id;
      html += '<div class="secuencial-step' + (isFullscreen ? ' secuencial-fullscreen' : '') + '">';
      // Pantalla completa (pedido del usuario, 22/09/2026): botón arriba de
      // todo, así queda accesible sin importar en qué paso se esté parado.
      html += '  <div class="secuencial-step-toolbar">';
      html += '    <button class="secuencial-fullscreen-btn" data-action="secuencial-fullscreen-toggle" data-id="' + entry.id + '" type="button" title="' +
        (isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa') + '">' + (isFullscreen ? '✕' : '⛶') + '</button>';
      html += '  </div>';
      // Aviso si la música de fondo no pudo reproducirse (pedido del
      // usuario, 23/09/2026: "No puedo escuchar la música") — antes fallaba
      // en silencio; ver `startSecuencialMusicIfAny`. Solo se muestra a quien
      // puede EDITAR la entrada (23/09/2026, tras la pregunta del usuario
      // "¿le aparece a todo el mundo?") — es un mensaje técnico/accionable
      // (compartir un archivo de Drive) que un miliciano no puede resolver;
      // para el resto, sigue siendo un fallo silencioso, sin cartel.
      if(entry.bgMusicUrl && AppState.secuencialMusicErrorId === entry.id && canEditEntry(entry)){
        html += '  <p class="mandos-sub secuencial-music-error">⚠ No se pudo reproducir la música de fondo. Si el link es de Drive, comprobá que el archivo esté compartido como "Cualquiera con el enlace" — y que sea un archivo de audio (mp3/ogg), no un link de YouTube o Vimeo. (Este aviso solo lo ves vos, que podés editar la entrada.)</p>';
      }
      if(idx === closingIdx){
        // Título/subtítulo de cierre personalizables (08/10/2026, puerto de
        // `closing.title`/`closing.sub` de "Encuentros") — si la entrada no
        // los cargó, caen al texto fijo de siempre.
        var closingTitle = (entry.closing && entry.closing.title) || 'Muchas gracias por tu atención.';
        var closingSub = (entry.closing && entry.closing.sub) || '¡A tus Órdenes!';
        html += '  <div class="secuencial-closing">';
        html += '    <p class="secuencial-closing-title">' + escapeHtml(closingTitle) + '</p>';
        html += '    <p class="secuencial-closing-sub">' + escapeHtml(closingSub) + '</p>';
        html += '  </div>';
        html += renderPropositosRecordatorio(steps, progress);
      } else {
        var step = steps[idx];
        // Un paso con condición no cumplida no debería alcanzarse nunca (la
        // navegación lo salta de largo, ver nextVisibleStepIndex) — este es
        // solo un resguardo defensivo (ej. se borró un paso de en medio y el
        // índice guardado quedó apuntando a otro distinto momentáneamente).
        if(!stepIsVisible(step, idx, steps, entry, progress)){
          html += '  <p class="mandos-sub">Este paso no aplica para ti.</p>';
        } else if(step.type === 'grupo'){
          // Solo se llega hasta acá si `slide:true` (si no, `stepIsVisible`
          // ya lo descartó como parada) — se muestra como una "portada" de
          // sección: título + texto opcional, centrados, sin más contenido.
          html += '  <div class="secuencial-group-slide">';
          html += '    <p class="secuencial-group-slide-title">' + escapeHtml(step.title || 'Grupo') + '</p>';
          if(step.body){ html += '    <div class="secuencial-step-body" style="text-align:center">' + linkify(step.body) + '</div>'; }
          html += '  </div>';
        } else
        // Cada zona de texto de un paso se alinea por separado (rediseño
        // 22/09/2026) — `step.align`/`preTextAlign`/`postTextAlign` según el
        // tipo (ver comentario de `formAligns` más arriba). Nunca se aplica
        // al contenedor del paso entero (ese era el bug reportado).
        if(step.type === 'texto'){
          html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.align) + '>' + linkify(step.text || '') + '</div>';
        } else if(step.type === 'pregunta'){
          // Texto normal antes/después de la pregunta, opcionales — la
          // pregunta en sí sigue con su diseño destacado en el medio (pedido
          // del usuario, 22/09/2026).
          if(step.preText){
            html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.preTextAlign) + '>' + linkify(step.preText) + '</div>';
          }
          html += '  <div class="secuencial-step-pregunta"' + alignStyleAttr(step.align) + '><p>' + linkify(step.text || '') + '</p></div>';
          // Opciones de respuesta (26/09/2026, unificación con "Encuentros") —
          // si no hay ninguna cargada, la pregunta sigue siendo de solo
          // lectura, exactamente como antes. Las respuestas se guardan en
          // `entryProgress` igual que un "Propósito personal" (mismo
          // `saveProgressAnswer`), como una lista separada por un token poco
          // común (sirve tanto para selección única como múltiple).
          if(step.opciones && step.opciones.length){
            var savedOpt = ((progress && progress.respuestas && progress.respuestas[idx]) || '').split(OPCION_SEP).map(function(s){ return s.trim(); }).filter(Boolean);
            html += '  <div class="secuencial-step-opciones">';
            step.opciones.forEach(function(op, oi){
              var checked = savedOpt.indexOf(op) !== -1;
              var inputType = step.unica === false ? 'checkbox' : 'radio';
              html += '    <label class="secuencial-opcion"><input type="' + inputType + '" class="secuencialOpcionInput" name="secuencialOpciones-' + entry.id + '-' + idx + '" data-entry="' + entry.id + '" data-step="' + idx + '" data-opcion="' + escapeHtml(op) + '" data-unica="' + (step.unica === false ? '0' : '1') + '"' + (checked ? ' checked' : '') + '> ' + escapeHtml(op) + '</label>';
            });
            html += '  </div>';
            if(step.allowWrite){
              var savedAnswerQ = (progress && progress.respuestas && progress.respuestas['w' + idx]) || '';
              var draftAnswerQ = (AppState.secuencialAnswerDraft && AppState.secuencialAnswerDraft.entryId === entry.id && AppState.secuencialAnswerDraft.stepIdx === ('w' + idx)) ? AppState.secuencialAnswerDraft.value : null;
              var answerValQ = draftAnswerQ !== null ? draftAnswerQ : savedAnswerQ;
              html += '  <textarea class="secuencialAnswerInput" data-entry="' + entry.id + '" data-step="w' + idx + '" placeholder="O escribí tu propia respuesta...">' + escapeHtml(answerValQ) + '</textarea>';
            }
          }
          if(step.postText){
            html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.postTextAlign) + '>' + linkify(step.postText) + '</div>';
          }
        } else if(step.type === 'proposito'){
          var savedAnswer = (progress && progress.respuestas && progress.respuestas[idx]) || '';
          var draftAnswer = (AppState.secuencialAnswerDraft && AppState.secuencialAnswerDraft.entryId === entry.id && AppState.secuencialAnswerDraft.stepIdx === idx) ? AppState.secuencialAnswerDraft.value : null;
          var answerVal = draftAnswer !== null ? draftAnswer : savedAnswer;
          html += '  <div class="secuencial-step-proposito">';
          // La alineación es solo para la consigna (el <p>), nunca para el
          // <textarea> de la respuesta — pedido explícito del usuario.
          html += '    <p' + alignStyleAttr(step.align) + '>' + linkify(step.text || '') + '</p>';
          html += '    <textarea class="secuencialAnswerInput" data-entry="' + entry.id + '" data-step="' + idx + '" placeholder="Escribí acá...">' + escapeHtml(answerVal) + '</textarea>';
          html += '  </div>';
        } else if(step.type === 'video'){
          // Texto antes y (opcional) después del video — `step.text` es el
          // nombre viejo del campo "antes", se sigue leyendo como respaldo
          // para pasos ya cargados que aún no pasaron por `preText` (pedido
          // del usuario, 22/09/2026, extendido de Imagen a Video).
          var vPre = step.preText || step.text || '';
          if(vPre){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.preTextAlign) + '>' + linkify(vPre) + '</div>'; }
          if(step.url){ html += embedBlockHtml(step.url, 'video'); }
          if(step.postText){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.postTextAlign) + '>' + linkify(step.postText) + '</div>'; }
        } else if(step.type === 'imagen'){
          var iPre = step.preText || step.text || '';
          if(iPre){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.preTextAlign) + '>' + linkify(iPre) + '</div>'; }
          if(step.url){ html += '<img src="' + escapeHtml(embeddableImageSrc(step.url)) + '" alt="">'; }
          if(step.postText){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.postTextAlign) + '>' + linkify(step.postText) + '</div>'; }
        } else if(step.type === 'audio'){
          var auPre = step.preText || '';
          if(auPre){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.preTextAlign) + '>' + linkify(auPre) + '</div>'; }
          if(step.url){ html += '<div class="entry-embed-audio"><audio controls src="' + escapeHtml(musicSourceUrl(step.url)) + '"></audio></div>'; }
          if(step.postText){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.postTextAlign) + '>' + linkify(step.postText) + '</div>'; }
        } else if(step.type === 'pdf'){
          var pdPre = step.preText || '';
          if(pdPre){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.preTextAlign) + '>' + linkify(pdPre) + '</div>'; }
          if(step.url){ html += embedBlockHtml(step.url, 'pdf'); }
          if(step.postText){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.postTextAlign) + '>' + linkify(step.postText) + '</div>'; }
        } else if(step.type === 'enlace'){
          var enPre = step.preText || '';
          if(enPre){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.preTextAlign) + '>' + linkify(enPre) + '</div>'; }
          if(step.url){ html += embedBlockHtml(step.url, 'enlace'); }
          if(step.postText){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.postTextAlign) + '>' + linkify(step.postText) + '</div>'; }
        } else if(step.type === 'libro'){
          var liPre = step.preText || '';
          if(liPre){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.preTextAlign) + '>' + linkify(liPre) + '</div>'; }
          html += renderLibroCita(step.book, renderPanel);
          if(step.postText){ html += '  <div class="secuencial-step-body"' + alignStyleAttr(step.postTextAlign) + '>' + linkify(step.postText) + '</div>'; }
        }
        html += renderStepNota(step, entry);
      }
      html += '  <div class="secuencial-nav">';
      html += '    <button class="btn ghost small" data-action="secuencial-prev" data-id="' + entry.id + '" type="button"' + (idx === 0 ? ' disabled' : '') + '>← Anterior</button>';
      if(idx < totalSteps - 1){
        html += '    <button class="btn small" data-action="secuencial-next" data-id="' + entry.id + '" type="button">Siguiente →</button>';
      } else {
        html += '    <button class="btn small" data-action="secuencial-finish" data-id="' + entry.id + '" type="button">Finalizar</button>';
      }
      html += '  </div>';
      // Barra de avance (06/10/2026, estética tipo "Encuentros") — puro
      // adorno visual a partir del mismo índice que ya calcula el "X de X"
      // de abajo, sin estado nuevo.
      html += '  <div class="secuencial-progress"><div style="width:' + Math.round(((idx+1)/totalSteps)*100) + '%"></div></div>';
      // El "X de X" va al pie, junto a la navegación — no arriba del todo —
      // así se nota al toque si dos pasos con la misma imagen en realidad son
      // distintos, en vez de quedar afuera de la vista (pedido del usuario, 22/09/2026).
      html += '  <p class="secuencial-step-count">' + (idx+1) + ' de ' + totalSteps + '</p>';
      // En el último paso (el de cierre) el botón "Cerrar" desaparece — un
      // subjefe de Formación llegó hasta ahí y tocó "Cerrar" por error en vez
      // de "Finalizar", así que la entrada quedó sin marcarse como completada
      // (pedido del usuario, 24/09/2026). Solo quedan "Anterior"/"Finalizar",
      // ambos ya presentes arriba en `.secuencial-nav` — en cualquier otro
      // paso "Cerrar" sigue disponible como siempre.
      if(idx < totalSteps - 1){
        html += '  <button class="btn ghost small secuencial-close-btn" data-action="secuencial-toggle" data-id="' + entry.id + '" type="button">Cerrar</button>';
      }
      html += '</div>';
    }
    return html;
  }


  export function renderEntry(entry){
    var typeLabels = { texto:'Texto', enlace:'Enlace', imagen:'Imagen', video:'Video', audio:'Audio', pdf:'PDF', libro:'Cita de libro', secuencial:'Secuencial' };
    var isCollapsed = !!AppState.collapsedEntryIds[entry.id];
    var canEdit = canEditEntry(entry);
    var html = '<div class="entry' + (isCollapsed ? ' entry-collapsed' : '') + '" data-id="' + entry.id + '">';
    html += '  <div class="entry-top">';
    html += '    <div class="entry-head-main">';
    // Botón de colapsar/expandir, en su propia fila junto al título pero
    // AFUERA del <h3> (pedido del usuario, 23/09/2026) — así `.entry-title`
    // conserva el texto exacto del título (varios tests/lugares del código
    // ya asumían eso), y el botón es una comodidad de navegación visible
    // para cualquiera, no una acción de edición: oculta/muestra
    // `.entry-body` entero con CSS, sin tocar ni resetear nada de su estado
    // interno (una secuencial mid-paso sigue en el mismo paso al reabrirla).
    html += '<div class="entry-title-row">';
    html += '  <button class="entry-collapse-btn" data-action="toggleCollapse" data-id="' + entry.id + '" type="button" title="' + (isCollapsed ? 'Expandir' : 'Colapsar') + '">' + (isCollapsed ? '▸' : '▾') + '</button>';
    html += '  <h3 class="entry-title">' + escapeHtml(entry.title) + '</h3>';
    html += '</div>';
    // En Info general no hace falta ningún tag — la pestaña entera es general y
    // nunca se puede scopear. En Recursos, en cambio, desde que se puede scopear
    // sí hace falta mostrarlo (si no queda invisible que un recurso es "solo
    // para mi sección"); el caso General de Recursos sigue sin tag, igual que
    // antes, porque sigue siendo el default de la pestaña entera.
    // Un lector (miliciano, capellán, etc.) nunca ve las etiquetas de ámbito —
    // le revelarían que esa entrada también es visible para otras secciones o
    // departamentos, información que no le corresponde (pedido del usuario,
    // 22/09/2026). Solo el comando (admin/jefe) las ve, para coordinarse.
    var scopeTag = (entry.dayId === 'INFO_GENERAL' || isLectorLike(effectiveRole())) ? '' : scopeTagsHtml(entry, entry.dayId === 'RESOURCES');
    // "Oculta" (borrador, pedido del usuario, 23/09/2026): solo puede LLEGAR
    // a verse este tag si `canSeeEntry` ya dejó pasar a quien mira — y esa
    // función solo deja ver una entrada oculta a quien puede editarla — así
    // que este tag nunca se le escapa a un lector/miliciano.
    var ocultaTag = entry.oculta ? ' <span class="tag imagen" title="Solo la ven quienes pueden editarla — no publicada todavía">🔒 Oculta</span>' : '';
    // "Permitirme ver siempre todo lo anónimo" (pedido del usuario,
    // 24/09/2026): un admin (efectivo — respeta "Ver como", para poder
    // previsualizar que un lector/jefe NO lo ve) siempre ve quién publicó
    // una entrada anónima, con un tag aparte que deja claro que el resto
    // no la ve firmada. `entry.authorReal` se guarda siempre al crear la
    // entrada (ver attachPanelEvents), independiente de `anonimo`.
    var anonimoTag = (entry.anonimo && isAdmin())
      ? ' <span class="tag imagen" title="Solo vos (admin) ves esto — el resto la ve sin firma">🔒 ' + escapeHtml(entry.authorReal || '(autor desconocido)') + '</span>'
      : '';
    html += '      <div class="entry-meta"><span class="tag ' + entry.type + '">' + typeLabels[entry.type] + '</span>' +
      scopeTag + ocultaTag + anonimoTag +
      (entry.anonimo ? '' : (entry.author ? '<span>' + escapeHtml(entry.author) + '</span>' : '')) + '</div>';
    html += '    </div>';
    if(canEdit){
      html += '    <div class="entry-actions">';
      // Publicar de un click, sin tener que abrir el formulario de edición
      // (pedido del usuario, 23/09/2026: "que se publique en un momento a
      // elección").
      if(entry.oculta){ html += '      <button data-action="publishEntry" data-id="' + entry.id + '">Publicar</button>'; }
      html += '      <button data-action="edit" data-id="' + entry.id + '">Editar</button>';
      // Exportar para "Encuentros" (06/10/2026) — mismo gate que Editar
      // (`canEditEntry`, ya evaluado acá arriba): el archivo que genera
      // incluye las notas internas de cada paso, que nunca deberían llegar
      // a quien solo puede leer la entrada.
      if(entry.type === 'secuencial' && entry.steps && entry.steps.length){
        html += '      <button data-action="exportEncuentro" data-id="' + entry.id + '" title="Descarga un .html que se puede importar directo en la fordoquera">📤 Exportar</button>';
      }
      html += '      <button data-action="delete" data-id="' + entry.id + '">Eliminar</button>';
      html += '    </div>';
    }
    html += '  </div>';
    // Cada texto vive en su propia zona alineable, nunca el `.entry-body`
    // entero — así una alineación (justificado incluido) nunca puede correr
    // un botón, porque los botones (Editar/Eliminar están afuera de acá;
    // Repasar/Completado/etc. de una secuencial viven adentro pero fuera de
    // cualquier `.entry-text-zone`) nunca comparten contenedor con el texto
    // alineado (rediseño 22/09/2026, reemplaza el `alignStyle` único de antes,
    // que sí lo compartían — esa era la causa del bug reportado).
    html += '  <div class="entry-body">';
    if(entry.type === 'secuencial'){
      html += renderSecuencialEntry(entry);
    } else if(entry.type === 'imagen' && entry.url){
      html += textZoneHtml(entry.body, entry.bodyAlign) + '<img src="' + escapeHtml(embeddableImageSrc(entry.url)) + '" alt="' + escapeHtml(entry.title) + '">' + textZoneHtml(entry.bodyAfter, entry.bodyAfterAlign);
    } else if(entry.type === 'video' && entry.url){
      html += textZoneHtml(entry.body, entry.bodyAlign) + embedBlockHtml(entry.url, 'video') + textZoneHtml(entry.bodyAfter, entry.bodyAfterAlign);
    } else if(entry.type === 'enlace' && entry.url){
      html += textZoneHtml(entry.body, entry.bodyAlign) + embedBlockHtml(entry.url, 'enlace');
    } else if(entry.type === 'audio' && entry.url){
      html += textZoneHtml(entry.body, entry.bodyAlign) + '<div class="entry-embed-audio"><audio controls src="' + escapeHtml(musicSourceUrl(entry.url)) + '"></audio></div>' + textZoneHtml(entry.bodyAfter, entry.bodyAfterAlign);
    } else if(entry.type === 'pdf' && entry.url){
      html += textZoneHtml(entry.body, entry.bodyAlign) + embedBlockHtml(entry.url, 'pdf') + textZoneHtml(entry.bodyAfter, entry.bodyAfterAlign);
    } else if(entry.type === 'libro' && entry.book){
      html += textZoneHtml(entry.body, entry.bodyAlign) + renderLibroCita(entry.book, renderPanel) + textZoneHtml(entry.bodyAfter, entry.bodyAfterAlign);
    } else {
      html += textZoneHtml(entry.body, entry.bodyAlign);
    }
    html += '  </div>';
    html += '</div>';
    return html;
  }


  // "+" flotante entre dos entradas (08/10/2026, pedido del usuario: poder
  // elegir dónde cae una entrada nueva, no solo agregarla al final) — una
  // franja angosta entre cada par de entradas consecutivas, invisible hasta
  // que el mouse pasa cerca (ver CSS `.entry-gap`); clickear el "+" abre el
  // formulario de "Agregar entrada" con la posición ya elegida (ver el
  // handler de `[data-action="insertGap"]` en `attachPanelEvents`, que
  // calcula un `createdAt` a mitad de camino entre las dos entradas vecinas
  // — mismo campo que ya ordena la lista, sin necesitar una columna nueva).
  // `prevId`/`nextId` quedan vacíos cuando el hueco es antes de la primera
  // entrada (no hay "antes" de eso) — siempre hay una entrada "siguiente"
  // real, porque nunca se imprime un hueco después de la última (para eso
  // ya está el botón "+ Agregar entrada" de abajo).
  export function renderEntryGap(prevId, nextId){
    return '<div class="entry-gap"><button type="button" class="entry-gap-btn" data-action="insertGap" data-prev-id="' + (prevId||'') + '" data-next-id="' + (nextId||'') + '" title="Agregar una entrada acá">+</button></div>';
  }


  // Arma la lista de entradas con un hueco "+" entre cada par consecutivo
  // (y uno antes de la primera, para poder anteponer) — solo si `canAddHere`
  // (quien no puede publicar ahí tampoco ve estos controles, mismo criterio
  // que el botón "+ Agregar entrada"). `items` ya viene ordenado por quien
  // llama (ascendente por `createdAt`, el mismo orden visual que se ve).
  export function renderEntriesListHtml(items, canAddHere){
    var html = '';
    // Sin entradas todavía, el botón "+ Agregar entrada" de abajo ya alcanza
    // como punto de entrada — no hace falta un hueco "+" huérfano acá arriba.
    if(!canAddHere || items.length === 0){
      items.forEach(function(entry){ html += renderEntry(entry); });
      return html;
    }
    html += renderEntryGap('', items[0].id);
    items.forEach(function(entry, i){
      html += renderEntry(entry);
      if(i < items.length - 1){ html += renderEntryGap(entry.id, items[i+1].id); }
    });
    return html;
  }
