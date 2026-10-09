// El formulario grande de "Agregar contenido" (Mensaje, Departamentos,
// Recursos, Info general comparten el mismo): selector de Ámbito, el
// constructor de pasos de una entrada secuencial, el armado del HTML del
// formulario, y el wiring de todos sus eventos (incluido el guardado).

import { AppState } from '../app-state.js';
import { SECCIONES, DEPARTAMENTOS, STEP_TYPE_LABELS, STEP_PALETTE, LIBROS_META, LIBROS_ORDER, FORDOQUERA_URL } from '../config/constants.js';
import { escapeHtml, uid } from '../utils/helpers.js';
import { isAdmin, isJefeSeccion, isJefeSeccionEditing, effectiveDepto, effectiveSeccion, entryScope, canEditEntry, canCreateRecurso, canCreateInfoGeneral } from '../services/permissions.js';
import { uploadEntryFile } from '../services/drive.service.js';
import { save, renameDay, setDayDate, setDayCita, setConsigna, deleteDay } from '../services/state.service.js';
import { markProgressCompleted, saveProgressAnswer } from '../services/progress.service.js';
import { renderAlignPicker, stopSecuencialMusic, startSecuencialMusicIfAny, setSecuencialFullscreenLock, updateSecuencialMusicForStep, scrollSecuencialToTop, renderLibroStepFields, nextVisibleStepIndex, groupRangeAt, ensureLibroLoaded, getLibroCache, renderLibroCita, searchLibroPuntos, OPCION_SEP } from './entry.js';
import { parseEncuentrosHtml, convertEncuentroToRdpImport, dataUrlToFile, convertRdpEntryToEncuentro, buildEncuentroExportHtml, safeEncuentroFileName } from '../utils/encuentros-interop.js';
import { render, renderPanel, showStatus } from '../main.js';

  // Selector de Ámbito reusado en Mensaje (día real), Departamentos (day===null)
  // y Recursos (day==='RESOURCES') — nunca en Info general, que no lo usa.
  // Un admin puede tildar cualquier combinación de secciones/departamentos (en
  // Departamentos, sin la opción de secciones — sigue siendo contenido
  // exclusivo de departamentos); un jefe de sección o de departamento sigue
  // fijo a su propio grupo (sin poder elegir otros), pero también puede tildar
  // "Comando (sin milicianos)" para ampliar el alcance de esa entrada puntual.
  export function renderAmbitoPicker(day){
    var isDeptosTab = (day === null);
    var jefeDepto = isJefeSeccion() && effectiveDepto() && !effectiveSeccion();

    // "Ámbito" → "Visible para" (pedido del usuario, 22/09/2026) — mismo
    // label en los 3 lugares que reusan este picker (Mensaje, Departamentos,
    // Recursos).
    var html = '  <div class="form-row"><label>Visible para</label>';
    // Nota del default (nada elegido = General) arriba de todo, entre el label
    // y el checkbox — solo tiene sentido para el admin, el único que puede
    // efectivamente dejar todo sin elegir (un jefe siempre está forzado a su
    // propio grupo; Departamentos nunca permite quedar sin ámbito).
    if(isAdmin() && !isDeptosTab){
      html += '    <p class="mandos-sub ambito-default-note">Comando y milicianos (por defecto)</p>';
    }
    html += '    <div class="ambito-picker">';
    // En Departamentos, esta pestaña es exclusivamente de comando — nunca la
    // ve un miliciano — así que aclarar "(sin milicianos)" ahí es redundante
    // y confunde; se llama simplemente "General" (pedido del usuario,
    // 22/09/2026). En Mensaje/Recursos, donde sí puede haber milicianos
    // viendo, sigue diciendo "Comando (sin milicianos)".
    var comandoGeneralLabel = isDeptosTab ? 'General' : 'Comando (sin milicianos)';
    html += '      <label class="ambito-general-check"><input type="checkbox" id="fComandoGeneral"' + (AppState.formComandoGeneral ? ' checked' : '') + '> ' + comandoGeneralLabel + '</label>';

    if(isAdmin()){
      if(!isDeptosTab){
        html += '      <div class="ambito-group"><p class="ambito-group-title">Secciones</p>';
        SECCIONES.forEach(function(s){
          var checked = AppState.formSecciones.indexOf(s) !== -1;
          html += '<label><input type="checkbox" class="fSeccionCheck" value="' + escapeHtml(s) + '"' + (checked ? ' checked' : '') + '> ' + escapeHtml(s) + '</label>';
        });
        html += '</div>';
      }
      html += '      <div class="ambito-group"><p class="ambito-group-title">Departamentos</p>';
      DEPARTAMENTOS.forEach(function(d){
        var checked = AppState.formDeptos.indexOf(d) !== -1;
        html += '<label><input type="checkbox" class="fDeptoCheck" value="' + escapeHtml(d) + '"' + (checked ? ' checked' : '') + '> ' + escapeHtml(d) + '</label>';
      });
      html += '</div>';
      // Solo en Recursos (22/09/2026, comentario del usuario): permite acotar
      // la/s sección/es elegida/s a solo el comando de esa sección (subjefes,
      // secretarios — cualquier `lector` con `tipo:'comando'`), sin que lo vean
      // los milicianos de esa misma sección. Usa el campo `tipo` del perfil
      // (comando/acampante, ya se guarda desde el onboarding).
      if(day === 'RESOURCES'){
        html += '      <label class="ambito-general-check"><input type="checkbox" id="fSeccionComandoOnly"' + (AppState.formSeccionComandoOnly ? ' checked' : '') + '> Solo el comando de la(s) sección(es) elegida(s) (no milicianos)</label>';
        // Aclaración (22/09/2026, pregunta del usuario: "¿qué pasa si elijo un
        // departamento y tildo esto?") — nada: este checkbox solo tiene efecto
        // sobre las SECCIONES tildadas arriba. Si no se tildó ninguna sección
        // (por ejemplo, se eligió únicamente un departamento), queda guardado
        // en la entrada pero sin ningún efecto real sobre quién la ve.
        html += '      <p class="mandos-sub" style="margin:2px 0 0">No tiene efecto si no elegiste ninguna sección arriba.</p>';
      }
      html += '    </div></div>';
    } else if(jefeDepto){
      html += '      <p class="mandos-sub" style="margin:0">Se publica siempre para tu departamento: <strong>' + escapeHtml(effectiveDepto()) + '</strong></p>';
      html += '    </div></div>';
    } else {
      html += '      <p class="mandos-sub" style="margin:0">Se publica siempre para tu sección: <strong>' + escapeHtml(effectiveSeccion()) + '</strong></p>';
      if(day === 'RESOURCES'){
        html += '      <label class="ambito-general-check"><input type="checkbox" id="fSeccionComandoOnly"' + (AppState.formSeccionComandoOnly ? ' checked' : '') + '> Solo el comando de mi sección (no milicianos)</label>';
      }
      html += '    </div></div>';
    }
    return html;
  }


  // Constructor de pasos para una entrada "secuencial" (22/09/2026) — se
  // recorre de a un paso, en vez de mostrar todo junto: pensado para una
  // entrada tipo "misión" (texto que introduce, video, preguntas para
  // reflexionar, un cuadro de propósito personal, una imagen, texto de
  // cierre — en el orden que arme quien la carga). `formSteps` guarda el
  // borrador en memoria; cada campo escribe directo ahí al tipear (sin
  // re-render), y solo agregar/quitar/mover un paso dispara un `renderPanel()`
  // completo — como ya quedó guardado en `formSteps`, nada de lo tecleado se
  // pierde en ese redibujo (mismo criterio que el resto del form).
  export function renderStepsBuilder(){
    // Botón para colapsar/expandir TODOS los pasos a la vez, mientras se edita
    // (pedido del usuario, 23/09/2026) — un solo interruptor, no granular por
    // paso; puramente CSS (`.steps-builder-collapsed .step-row-body{display:none}`),
    // nunca toca `formSteps` ni lo ya tecleado.
    var collapseBtnHtml = AppState.formSteps.length
      ? ' <button type="button" id="toggleStepsCollapseBtn" class="collapse-toggle-btn">' + (AppState.formStepsCollapsed ? '▸ Expandir pasos' : '▾ Colapsar pasos') + '</button>'
      : '';
    var html = '<div class="form-row"><label>Pasos de la entrada' + collapseBtnHtml + '</label>';
    html += '  <div class="steps-builder' + (AppState.formStepsCollapsed ? ' steps-builder-collapsed' : '') + '">';
    if(AppState.formSteps.length === 0){
      html += '    <p class="mandos-sub">Todavía no agregaste ningún paso — usá los botones de abajo.</p>';
    }
    // "Grupo" (08/10/2026, puerto de "Encuentros") — agrupa a TODOS los
    // pasos que le siguen hasta el próximo grupo (o el final). Mientras se
    // recorre la lista linealmente, `insideClosedGroup` recuerda si el
    // grupo actual está plegado (`closed`) — si lo está, sus pasos miembro
    // ni siquiera se renderizan (mismo criterio que "Encuentros": un grupo
    // plegado oculta sus pasos del editor, no solo visualmente los
    // "aplasta" — así se puede ver la estructura general de una entrada
    // larga de un vistazo). El grupo plegado SIGUE mostrando su propia
    // fila (título/condición), solo sus MIEMBROS desaparecen.
    var insideClosedGroup = false;
    AppState.formSteps.forEach(function(step, idx){
      if(step.type === 'grupo'){
        insideClosedGroup = !!step.closed;
        var grange = groupRangeAt(AppState.formSteps, idx);
        var memberCount = grange[1] - grange[0] - 1;
        html += '    <div class="step-row step-row-group">';
        html += '      <div class="step-row-head"><span class="tag grupo">🗂️ Grupo</span>';
        html += '        <span class="mandos-sub step-group-count">' + memberCount + ' paso' + (memberCount===1?'':'s') + '</span>';
        html += '        <span class="step-row-actions">';
        html += '          <button type="button" class="step-group-fold" data-idx="' + idx + '" title="' + (step.closed?'Desplegar':'Plegar') + '">' + (step.closed?'▸':'▾') + '</button>';
        html += '          <button type="button" class="step-group-move-up" data-idx="' + idx + '"' + (idx===0?' disabled':'') + ' title="Subir el grupo entero">↑</button>';
        html += '          <button type="button" class="step-group-move-down" data-idx="' + idx + '"' + (grange[1]>=AppState.formSteps.length?' disabled':'') + ' title="Bajar el grupo entero">↓</button>';
        html += '          <button type="button" class="step-group-ungroup" data-idx="' + idx + '" title="Quita el grupo; sus pasos quedan, sin agrupar">Desagrupar</button>';
        html += '        </span></div>';
        html += '      <div class="step-row-body">';
        html += '        <input type="text" class="stepGroupTitleInput" data-idx="' + idx + '" placeholder="Nombre del grupo (ej.: Oración inicial, Desarrollo, Cierre)" value="' + escapeHtml(step.title||'') + '">';
        html += '        <label class="step-inline-check"><input type="checkbox" class="stepGroupSlideCheck" data-idx="' + idx + '"' + (step.slide?' checked':'') + '> Mostrar como una pantalla propia (portada de esta sección) al recorrer la entrada</label>';
        if(step.slide){
          html += '        <textarea class="stepGroupBodyInput" data-idx="' + idx + '" placeholder="Texto de la portada (opcional)">' + escapeHtml(step.body||'') + '</textarea>';
        }
        if(idx > 0){
          html += '        <div class="step-cond-row">';
          html += '          <label class="align-row-label">Mostrar este grupo (todos sus pasos) solo si, en el paso</label>';
          html += '          <select class="stepCondStepSelect" data-idx="' + idx + '"><option value="">(siempre)</option>';
          for(var cig = 0; cig < idx; cig++){
            var condSelG = step.cond && String(step.cond.step) === String(cig);
            html += '<option value="' + cig + '"' + (condSelG ? ' selected' : '') + '>Paso ' + (cig+1) + ' (' + STEP_TYPE_LABELS[AppState.formSteps[cig].type] + ')</option>';
          }
          html += '</select>';
          html += '          <input type="text" class="stepCondValInput" data-idx="' + idx + '" placeholder="la respuesta fue..." value="' + escapeHtml((step.cond && step.cond.val) || '') + '">';
          html += '        </div>';
          html += '        <p class="mandos-sub">El grupo llega hasta el próximo grupo (o el final). Sus pasos se muestran u ocultan junto con el grupo, salvo que tengan su propia condición además.</p>';
        }
        html += '      </div>';
        html += '    </div>';
        return;
      }
      if(insideClosedGroup) return; // paso miembro de un grupo plegado — no se renderiza (ver arriba).
      html += '    <div class="step-row">';
      html += '      <div class="step-row-head"><span class="tag ' + step.type + '">' + (idx+1) + '. ' + STEP_TYPE_LABELS[step.type] + '</span>';
      html += '        <span class="step-row-actions">';
      html += '          <button type="button" class="step-move-up" data-idx="' + idx + '"' + (idx===0?' disabled':'') + ' title="Subir">↑</button>';
      html += '          <button type="button" class="step-move-down" data-idx="' + idx + '"' + (idx===AppState.formSteps.length-1?' disabled':'') + ' title="Bajar">↓</button>';
      html += '          <button type="button" class="step-remove" data-idx="' + idx + '">Eliminar</button>';
      html += '        </span></div>';
      html += '      <div class="step-row-body">';
      var stepPlaceholders = {
        texto:'Texto introductorio o de cierre...',
        pregunta:'Escribí la pregunta para reflexionar...',
        proposito:'Consigna: qué le pedís a la persona que escriba (ej. "Escribí un propósito para hoy")'
      };
      var beforeAfterLabels = {
        pregunta: ['Texto antes de la pregunta (opcional)...', 'Texto después de la pregunta (opcional)...'],
        video: ['Texto antes del video (opcional)...', 'Texto después del video (opcional)...'],
        imagen: ['Texto antes de la imagen (opcional)...', 'Texto después de la imagen (opcional)...'],
        audio: ['Texto antes del audio (opcional)...', 'Texto después del audio (opcional)...'],
        pdf: ['Texto antes del PDF (opcional)...', 'Texto después del PDF (opcional)...'],
        enlace: ['Texto antes del enlace (opcional)...', 'Texto después del enlace (opcional)...'],
        libro: ['Texto antes de la cita (opcional)...', 'Texto después de la cita (opcional)...']
      };
      var mediaStepTypes = ['video', 'imagen', 'audio', 'pdf', 'enlace'];
      if(step.type === 'pregunta' || mediaStepTypes.indexOf(step.type) !== -1){
        // Texto normal antes y (opcional) después — para Pregunta va separado
        // de la pregunta en sí (que mantiene su diseño destacado en el medio);
        // para los tipos de media va antes y después del embed, con la URL en
        // el medio (pedido del usuario, 22/09/2026, extendido a Audio/PDF/
        // Enlace el 26/09/2026 — mismo patrón). Cada zona de texto tiene su
        // propio selector de alineación, independiente de las demás.
        html += '      <textarea class="stepPreTextInput" data-idx="' + idx + '" placeholder="' + escapeHtml(beforeAfterLabels[step.type][0]) + '">' + escapeHtml(step.preText||'') + '</textarea>';
        html += renderAlignPicker('step', 'preTextAlign', idx, step.preTextAlign);
        if(step.type === 'pregunta'){
          html += '      <textarea class="stepTextInput" data-idx="' + idx + '" placeholder="' + escapeHtml(stepPlaceholders.pregunta) + '">' + escapeHtml(step.text||'') + '</textarea>';
          html += renderAlignPicker('step', 'align', idx, step.align);
          // Opciones de respuesta (26/09/2026, unificación con "Encuentros") —
          // opcional: si se deja vacío, la pregunta sigue siendo de solo
          // lectura (para pensarla), igual que siempre. Una por renglón.
          html += '      <textarea class="stepOpcionesInput" data-idx="' + idx + '" placeholder="Opciones de respuesta (una por renglón, opcional — si las dejás vacías la pregunta queda de solo lectura, como siempre)">' + escapeHtml((step.opciones||[]).join('\n')) + '</textarea>';
          html += '      <label class="step-inline-check"><input type="checkbox" class="stepUnicaCheck" data-idx="' + idx + '"' + (step.unica === false ? '' : ' checked') + '> Selección única (si no, se puede elegir más de una)</label>';
          html += '      <label class="step-inline-check"><input type="checkbox" class="stepAllowWriteCheck" data-idx="' + idx + '"' + (step.allowWrite ? ' checked' : '') + '> Permitir además una respuesta escrita</label>';
        } else {
          var urlLabels = {
            video:'URL del video (YouTube, Vimeo o Drive)', imagen:'URL de la imagen (o link de Drive)',
            audio:'URL del audio (archivo .mp3/.ogg, o link de Drive)', pdf:'URL del PDF (o link de Drive)',
            enlace:'URL del enlace'
          };
          var fileAccepts = { video:'video/*', imagen:'image/*', audio:'audio/*', pdf:'application/pdf', enlace:'' };
          html += '      <input type="text" class="stepUrlInput" data-idx="' + idx + '" placeholder="' + escapeHtml(urlLabels[step.type]) + '" value="' + escapeHtml(step.url||'') + '">';
          // Subir un archivo directo para este paso (pedido del usuario,
          // 22/09/2026, extendido a Audio/PDF/Enlace el 26/09/2026) — mismo
          // gate por `driveAccessToken` que el resto de las subidas.
          if(AppState.driveAccessToken){
            var acceptAttr = fileAccepts[step.type] ? ' accept="' + fileAccepts[step.type] + '"' : '';
            html += '      <input type="file" class="stepFileInput" data-idx="' + idx + '"' + acceptAttr + '>';
            html += '      <p class="mandos-sub stepFileStatus" data-idx="' + idx + '"></p>';
          } else {
            html += '      <p class="mandos-sub">Para subir un archivo hace falta reingresar por "Soy del comando".</p>';
          }
        }
        if(step.type !== 'libro'){
          html += '      <textarea class="stepPostTextInput" data-idx="' + idx + '" placeholder="' + escapeHtml(beforeAfterLabels[step.type][1]) + '">' + escapeHtml(step.postText||'') + '</textarea>';
          html += renderAlignPicker('step', 'postTextAlign', idx, step.postTextAlign);
        }
      } else if(step.type === 'libro'){
        html += renderLibroStepFields(step, idx);
      } else {
        html += '      <textarea class="stepTextInput" data-idx="' + idx + '" placeholder="' + escapeHtml(stepPlaceholders[step.type]) + '">' + escapeHtml(step.text||'') + '</textarea>';
        html += renderAlignPicker('step', 'align', idx, step.align);
      }
      // Nota interna + condición de visibilidad (26/09/2026) — comunes a
      // cualquier tipo de paso, siempre al final de la fila.
      html += '      <textarea class="stepNotaInput" data-idx="' + idx + '" placeholder="Nota interna (opcional, solo la ve quien puede editar — nunca se muestra al recorrer la entrada)">' + escapeHtml(step.nota||'') + '</textarea>';
      if(idx > 0){
        html += '      <div class="step-cond-row">';
        html += '        <label class="align-row-label">Mostrar solo si, en el paso</label>';
        html += '        <select class="stepCondStepSelect" data-idx="' + idx + '"><option value="">(siempre)</option>';
        for(var ci = 0; ci < idx; ci++){
          var condSel = step.cond && String(step.cond.step) === String(ci);
          html += '<option value="' + ci + '"' + (condSel ? ' selected' : '') + '>Paso ' + (ci+1) + ' (' + STEP_TYPE_LABELS[AppState.formSteps[ci].type] + ')</option>';
        }
        html += '</select>';
        html += '        <input type="text" class="stepCondValInput" data-idx="' + idx + '" placeholder="la respuesta fue..." value="' + escapeHtml((step.cond && step.cond.val) || '') + '">';
        html += '      </div>';
      }
      html += '      </div>';
      html += '    </div>';
    });
    html += '  </div>';
    // Paleta visual (08/10/2026, puerto de la paleta de "Encuentros") —
    // reemplaza a la fila de botones de puro texto por tarjetas con ícono +
    // descripción corta, para no tener que adivinar qué hace cada tipo.
    html += '  <div class="form-row"><label>Agregar un paso</label>';
    html += '  <div class="step-palette">';
    STEP_PALETTE.forEach(function(t){
      html += '<button type="button" class="step-palette-card addStepBtn" data-type="' + t.type + '">' +
        '<span class="step-palette-icon">' + t.icon + '</span>' +
        '<span class="step-palette-label">' + escapeHtml(STEP_TYPE_LABELS[t.type]) + '</span>' +
        '<span class="step-palette-desc">' + escapeHtml(t.desc) + '</span></button>';
    });
    // Buscar y agregar varios textos de una biblioteca de una (08/10/2026,
    // puerto del diálogo multi-select de "Encuentros", ver renderLibroPickerModal
    // más abajo) — no agrega un paso por sí solo, abre el diálogo.
    html += '<button type="button" class="step-palette-card" id="openLibroPickerBtn">' +
      '<span class="step-palette-icon">🔎</span>' +
      '<span class="step-palette-label">Buscar en los libros</span>' +
      '<span class="step-palette-desc">Buscá y agregá varias citas de una biblioteca precargada de una sola vez.</span></button>';
    html += '  </div></div>';
    html += '</div>';
    if(AppState.libroPickerOpen){ html += renderLibroPickerModal(); }
    return html;
  }


  // Diálogo "Buscar en los libros" (08/10/2026, puerto del selector
  // multi-select de "Encuentros" — `openPicker`/`renderPick`/`pickResults`/
  // `renderPickPrev`): pestañas por biblioteca, un buscador (número/rango o
  // texto libre, ver `searchLibroPuntos`), una lista de resultados con
  // checkbox, y una vista previa de la cita que tiene el foco — confirmar
  // agrega TODOS los tildados como pasos "Cita de libro" de una. Mismo
  // patrón visual que el resto de los paneles flotantes del sitio
  // (`.novedades-panel`/`.feedback-panel`), no un <dialog> nativo.
  function renderLibroPickerModal(){
    var html = '<div class="libro-picker-overlay"><div class="libro-picker-modal">';
    html += '  <div class="libro-picker-head"><h3>Buscar en los libros</h3><button type="button" id="libroPickerClose" class="btn ghost small">✕</button></div>';
    html += '  <div class="libro-picker-tabs">';
    LIBROS_ORDER.forEach(function(lib){
      html += '<button type="button" class="libroPickerTab' + (AppState.libroPickerBook === lib ? ' on' : '') + '" data-lib="' + lib + '">' + escapeHtml(LIBROS_META[lib].titulo) + '</button>';
    });
    html += '  </div>';
    html += '  <input type="text" id="libroPickerQuery" placeholder="Buscá por número (ej. 25, o 200-215) o por palabra..." value="' + escapeHtml(AppState.libroPickerQuery) + '">';
    var data = getLibroCache(AppState.libroPickerBook);
    html += '  <div class="libro-picker-body">';
    html += '    <div class="libro-picker-list">';
    if(data === undefined || data === 'loading'){
      html += '      <p class="loading-inline"><span class="loading-spinner"></span>Cargando ' + escapeHtml(LIBROS_META[AppState.libroPickerBook].titulo) + '...</p>';
    } else if(data === 'error'){
      html += '      <p class="mandos-sub">No se pudo cargar esta biblioteca.</p>';
    } else {
      var results = searchLibroPuntos(data, AppState.libroPickerQuery);
      var shown = results.slice(0, 300);
      if(!shown.length){
        html += '      <p class="mandos-sub">Sin resultados.</p>';
      }
      shown.forEach(function(p){
        var key = AppState.libroPickerBook + '|' + p.n;
        var checked = AppState.libroPickerSel.indexOf(key) !== -1;
        html += '      <label class="libro-picker-row"><input type="checkbox" class="libroPickerCheck" data-key="' + escapeHtml(key) + '"' + (checked?' checked':'') + '>' +
          '<span class="libro-picker-row-num">' + escapeHtml(String(p.num != null ? p.num : p.n)) + '</span>' +
          '<span class="libro-picker-row-title">' + escapeHtml(p.q || (p.body||'').slice(0, 80)) + '</span></label>';
      });
      if(results.length > shown.length){
        html += '      <p class="mandos-sub">…y ' + (results.length - shown.length) + ' más (afiná la búsqueda para verlos).</p>';
      }
    }
    html += '    </div>';
    html += '  </div>';
    var selCount = AppState.libroPickerSel.length;
    html += '  <div class="libro-picker-foot"><span class="mandos-sub">' + selCount + ' seleccionado' + (selCount===1?'':'s') + '</span>' +
      '<button type="button" id="libroPickerConfirm" class="btn small"' + (selCount ? '' : ' disabled') + '>Agregar' + (selCount ? ' ' + selCount : '') + '</button></div>';
    html += '</div></div>';
    return html;
  }


  // Botón "Importar desde Encuentros" (06/10/2026, movido ADENTRO del
  // formulario de "Agregar entrada" el 08/10/2026 — pedido del usuario: antes
  // vivía afuera, al lado del botón de abrir el form, y quedaban dos botones
  // sueltos compitiendo por atención; ahora es una opción más DENTRO del
  // mismo flujo de "Agregar entrada", visible recién cuando el form ya está
  // abierto) — mismo gate de permiso que ya calcula cada vista (`canAddHere`,
  // evaluado por quien llama a `renderForm`) — importar termina creando una
  // entrada nueva por el mismo camino de siempre, así que no hace falta un
  // permiso aparte. El input de archivo queda oculto, el botón solo lo dispara.
  export function renderImportEncuentroButtonHtml(){
    return '<div class="import-encuentro-row">' +
      '<button class="btn ghost small" id="importEncuentroBtn" type="button">📥 Importar desde la fordoquera…</button>' +
      // Pedido del usuario (09/10/2026): no todos los jefes tienen el link
      // de la fordoquera a mano — este botón la abre directo en una pestaña
      // nueva, al lado del de importar.
      '<a class="btn ghost small" href="' + FORDOQUERA_URL + '" target="_blank" rel="noopener">🔗 Abrir la fordoquera</a>' +
      '<input type="file" id="importEncuentroFile" accept=".html,.htm,text/html" hidden>' +
      '<p class="mandos-sub">¿Ya armaste esto en la fordoquera? Importalo en vez de cargarlo de nuevo a mano.</p>' +
      '</div>';
  }


  // Borrador del formulario de "Agregar entrada" (título, pasos, ámbito,
  // etc.) — se resetea entero en varios puntos (cerrar, cancelar, después de
  // guardar, y antes de abrir uno nuevo vía un hueco "+" entre entradas), así
  // que vive en una sola función en vez de repetir la misma lista larga de
  // asignaciones 4-5 veces (como quedaba hasta el 08/10/2026 — el riesgo real
  // de tenerlo repetido es que un reset nuevo se agregue en un solo lugar y
  // se olvide en los demás, dejando basura de una entrada a la otra).
  function resetFormDraftState(){
    AppState.editingEntryId = null;
    AppState.formSecciones = []; AppState.formDeptos = []; AppState.formComandoGeneral = false; AppState.formSeccionComandoOnly = false;
    AppState.formAnonimo = false; AppState.formOculta = false; AppState.formBienvenida = false;
    AppState.formStepsCollapsed = true; AppState.formMediaCollapsed = true;
    AppState.formAligns = { body: 'left', bodyAfter: 'left' };
    AppState.formTitleDraft = null; AppState.formBgMusicUrlDraft = null; AppState.formSteps = [];
    AppState.formClosingTitleDraft = null; AppState.formClosingSubDraft = null;
    AppState.libroPickerOpen = false; AppState.libroPickerBook = 'youcat'; AppState.libroPickerQuery = ''; AppState.libroPickerSel = [];
    AppState.insertOrderCreatedAt = null; AppState.insertOrderNote = '';
  }


  export function renderForm(day){
    // Todas las entradas son "secuenciales" (06/10/2026, pedido del usuario:
    // los tipos de contenido de nivel superior —Texto/Enlace/Imagen/Video/
    // Audio/PDF/Cita de libro— quedaron redundantes apenas esos mismos tipos
    // se sumaron como PASOS de una secuencial, el mismo día — así que se sacó
    // el selector "Tipo de contenido" del todo: toda entrada nueva se arma
    // con el constructor de pasos de abajo, aunque termine teniendo uno solo.
    // `AppState.formType` se mantiene fija en 'secuencial' (todavía la usan
    // el guardado y el resto del código de pasos) pero ya nunca cambia de
    // valor desde la interfaz. Las entradas viejas de un tipo simple (ya
    // guardadas en Firestore antes de este cambio) se siguen viendo igual
    // que siempre — `renderEntry()` no se tocó — y se migran a un paso único
    // recién al abrir "Editar" (ver el handler de `[data-action="edit"]`).
    var editing = AppState.editingEntryId ? AppState.state.entries.find(function(e){ return e.id === AppState.editingEntryId; }) : null;
    var html = '<div class="add-form' + (AppState.formOpen ? ' open' : '') + '" id="addForm">';
    // Importar desde Encuentros: solo tiene sentido para una entrada NUEVA
    // (importar "sobre" una edición en curso pisaría lo que se estaba
    // corrigiendo, sin ningún beneficio) — mismo criterio que el resto del
    // form, que no mezcla "editar" con "empezar de cero".
    if(!editing){ html += renderImportEncuentroButtonHtml(); }
    // Nota de "se va a insertar acá" (08/10/2026) — solo aparece si se abrió
    // el form clickeando el "+" flotante entre dos entradas, para confirmar
    // que el click surtió efecto (si no, no hay ninguna pista visual de que
    // la posición de guardado cambió respecto del comportamiento normal).
    if(!editing && AppState.insertOrderNote){
      html += '  <p class="mandos-sub insert-order-note">📍 ' + escapeHtml(AppState.insertOrderNote) + '</p>';
    }
    var titleVal = AppState.formTitleDraft !== null ? AppState.formTitleDraft : (editing ? editing.title : '');
    var titlePlaceholder = day === 'INFO_GENERAL' ? 'Ej: Lugar de campamento' : 'Ej: La virtud de la fortaleza';
    html += '  <div class="form-row"><label>Título</label><input type="text" id="fTitle" placeholder="' + escapeHtml(titlePlaceholder) + '" value="' + escapeHtml(titleVal) + '"></div>';
    html += renderStepsBuilder();
    // Música de fondo, opcional (pedido del usuario, 22/09/2026) — arranca
    // en loop al abrir la entrada, se silencia sola mientras se esté en un
    // paso de Video (ver `updateSecuencialMusicForStep`). Tiene que ser un
    // archivo de audio servido directo — un link de YouTube/Vimeo no sirve
    // acá (esos son páginas, no un archivo que un <audio> pueda reproducir).
    var bgMusicVal = AppState.formBgMusicUrlDraft !== null ? AppState.formBgMusicUrlDraft : (editing ? (editing.bgMusicUrl||'') : '');
    html += '  <div class="form-row"><label>Música de fondo (opcional)</label>';
    html += '    <input type="text" id="fBgMusicUrl" placeholder="Link a un archivo de audio (mp3, o de Drive)" value="' + escapeHtml(bgMusicVal) + '">';
    html += '    <p class="mandos-sub">Suena en loop mientras se recorre la entrada, y se silencia mientras se esté en un paso de Video. No funciona con un link de YouTube/Vimeo — tiene que ser un archivo de audio. Si pegás un link de Drive (en vez de subirlo con el botón de abajo), el archivo tiene que estar compartido como "Cualquiera con el enlace", igual que las imágenes y videos.</p>';
    if(AppState.driveAccessToken){
      html += '    <input type="file" id="fBgMusicFileUpload" accept="audio/*">';
      html += '    <p class="mandos-sub" id="fBgMusicFileUploadStatus"></p>';
    }
    html += '  </div>';

    // Cierre personalizable (08/10/2026, puerto de "Encuentros",
    // `closing.title`/`closing.sub`) — reemplaza, si se completa, el texto
    // fijo de siempre en el último paso de cualquier entrada secuencial.
    var closingTitleVal = AppState.formClosingTitleDraft !== null ? AppState.formClosingTitleDraft : (editing && editing.closing ? (editing.closing.title||'') : '');
    var closingSubVal = AppState.formClosingSubDraft !== null ? AppState.formClosingSubDraft : (editing && editing.closing ? (editing.closing.sub||'') : '');
    html += '  <div class="form-row"><label>Texto de cierre (opcional)</label>';
    html += '    <input type="text" id="fClosingTitle" placeholder="Ej: ¡Gracias por participar! (si lo dejás vacío, queda el texto de siempre)" value="' + escapeHtml(closingTitleVal) + '">';
    html += '    <textarea id="fClosingSub" placeholder="Subtítulo de cierre (opcional) — ej.: Nos vemos el sábado a las 17.">' + escapeHtml(closingSubVal) + '</textarea>';
    html += '    <p class="mandos-sub">Se muestra en la última pantalla, al terminar de recorrer la entrada, junto con el recordatorio de los propósitos que se hayan escrito.</p>';
    html += '  </div>';

    // Ámbito: a quién se publica esta entrada. Selector multi-select unificado
    // (22/09/2026) — reemplaza al viejo selector de una sola sección/depto con
    // un "quién la puede ver" aparte: ahora se pueden tildar varias secciones Y
    // varios departamentos a la vez (ej. "Administración y Logística"), más un
    // checkbox aparte "Comando (sin milicianos)" — ver entryScope().
    if(day === 'INFO_GENERAL'){
      // Info general es contenido general (sin sección/depto), visible para
      // todos — no hay Ámbito que elegir acá. Sin cambios.
    } else {
      html += renderAmbitoPicker(day);
    }
    html += '  <div class="signature-row"><label><input type="checkbox" id="fAnonimo"' + (AppState.formAnonimo ? ' checked' : '') + '> Publicar sin firmar (queda anónimo)</label></div>';
    html += '  <p class="mandos-sub">' + (AppState.formAnonimo ? 'Se publica sin firma (anónimo).' : ('Firma como: <strong>' + escapeHtml(AppState.currentUser.displayName) + '</strong>')) + '</p>';
    // "Ocultar (borrador)" (pedido del usuario, 23/09/2026) — deja armar la
    // entrada con tiempo, con sus etiquetas de sección/depto ya puestas, sin
    // que la vean todavía quienes están en esas etiquetas (ver canSeeEntry).
    html += '  <div class="signature-row"><label><input type="checkbox" id="fOculta"' + (AppState.formOculta ? ' checked' : '') + '> Ocultar (borrador — solo vos y otros editores la ven hasta que la publiques)</label></div>';
    // "Entrada de bienvenida" (pedido del usuario, 24/09/2026) — solo tiene
    // sentido en Recursos y solo para una Secuencial (es la única con
    // seguimiento de "completado" hoy, vía Finalizar/entryProgress). Además,
    // solo el admin la ve/toca (pedido del usuario, 24/09/2026) — a
    // diferencia del resto de Recursos, donde cualquier jefe puede editar
    // cualquier entrada sin restricción de ámbito, esta marca queda
    // reservada al admin para no descoordinar sin querer la pantalla de
    // bienvenida entre varios jefes con permiso de edición.
    if(day === 'RESOURCES' && isAdmin()){
      html += '  <div class="signature-row"><label><input type="checkbox" id="fBienvenida"' + (AppState.formBienvenida ? ' checked' : '') + '> Entrada de bienvenida (aparece arriba de todo en Inicio para quien todavía no la completó — comando y milicianos por igual)</label></div>';
    }
    html += '  <div class="form-actions">';
    html += '    <button class="btn" id="saveEntryBtn" type="button">' + (editing ? 'Guardar cambios' : 'Publicar') + '</button>';
    html += '    <button class="btn ghost" id="cancelFormBtn" type="button">Cancelar</button>';
    html += '  </div>';
    html += '  <div class="status-msg" id="statusMsg"></div>';
    html += '</div>';
    return html;
  }


  export function attachPanelEvents(day){
    var dayLabelEdit = document.getElementById('dayLabelEdit');
    if(dayLabelEdit){
      dayLabelEdit.addEventListener('blur', function(){
        var val = dayLabelEdit.textContent.trim();
        if(val) renameDay(day.id, val);
      });
    }
    var dayDateInput = document.getElementById('dayDateInput');
    if(dayDateInput){
      dayDateInput.addEventListener('blur', function(){ setDayDate(day.id, dayDateInput.value.trim()); });
    }
    // Cita bíblica editable (09/10/2026) — guarda los dos campos juntos al
    // perder el foco de cualquiera de los dos, para no pisar uno con el
    // valor viejo del otro.
    var dayCitaTextoInput = document.getElementById('dayCitaTextoInput');
    var dayCitaRefInput = document.getElementById('dayCitaRefInput');
    if(dayCitaTextoInput && dayCitaRefInput){
      var saveCita = function(){ setDayCita(day.id, dayCitaTextoInput.value.trim(), dayCitaRefInput.value.trim()); };
      dayCitaTextoInput.addEventListener('blur', saveCita);
      dayCitaRefInput.addEventListener('blur', saveCita);
    }
    if(day && typeof day === 'object'){
      document.querySelectorAll('.consignaInput').forEach(function(inp){
        inp.addEventListener('blur', function(){ setConsigna(day.id, inp.getAttribute('data-seccion'), inp.value.trim()); });
      });
    }
    var deleteDayBtn = document.getElementById('deleteDayBtn');
    if(deleteDayBtn){ deleteDayBtn.onclick = function(){ deleteDay(day.id); }; }

    var toggleFormBtn = document.getElementById('toggleFormBtn');
    if(toggleFormBtn){
      toggleFormBtn.onclick = function(){
        AppState.formOpen = !AppState.formOpen;
        if(!AppState.formOpen){
          resetFormDraftState();
        }
        renderPanel();
        if(AppState.formOpen){
          document.getElementById('addForm').scrollIntoView({behavior:'smooth', block:'nearest'});
        }
      };
    }

    // "+" flotante entre dos entradas (08/10/2026, pedido del usuario):
    // abre el formulario de "Agregar entrada", igual que el botón de abajo,
    // pero con la posición de guardado ya elegida — `createdAt` (el mismo
    // campo que ya ordena la lista en los 4 lugares que la usan) se calcula
    // a mitad de camino entre las dos entradas vecinas del hueco clickeado,
    // así la nueva entrada queda sorteada justo ahí sin necesitar una
    // columna de orden nueva. Si el hueco es antes de la primera entrada
    // (sin "anterior"), se resta un segundo al `createdAt` de la siguiente
    // para quedar justo antes.
    document.querySelectorAll('[data-action="insertGap"]').forEach(function(btn){
      btn.onclick = function(){
        var prevId = btn.getAttribute('data-prev-id');
        var nextId = btn.getAttribute('data-next-id');
        var prevEntry = prevId ? AppState.state.entries.find(function(e){ return e.id === prevId; }) : null;
        var nextEntry = nextId ? AppState.state.entries.find(function(e){ return e.id === nextId; }) : null;
        var insertAt, note;
        if(prevEntry && nextEntry){
          insertAt = (prevEntry.createdAt + nextEntry.createdAt) / 2;
          note = 'Se va a insertar entre "' + prevEntry.title + '" y "' + nextEntry.title + '".';
        } else if(nextEntry){
          insertAt = nextEntry.createdAt - 1000;
          note = 'Se va a insertar antes de "' + nextEntry.title + '".';
        } else if(prevEntry){
          insertAt = prevEntry.createdAt + 1000;
          note = 'Se va a insertar después de "' + prevEntry.title + '".';
        } else {
          insertAt = Date.now();
          note = '';
        }
        resetFormDraftState();
        AppState.insertOrderCreatedAt = insertAt;
        AppState.insertOrderNote = note;
        AppState.formOpen = true;
        renderPanel();
        var addFormEl = document.getElementById('addForm');
        if(addFormEl){ addFormEl.scrollIntoView({behavior:'smooth', block:'nearest'}); }
      };
    });

    // "Importar desde Encuentros" (06/10/2026) — toma el .html que exportó
    // la herramienta "Encuentros" (botón "📦 Exportar / imprimir" → "Encuentro
    // para compartir"), lo convierte a pasos de RDP, y abre el formulario de
    // "Agregar contenido" ya precargado — como si fuera una entrada nueva en
    // borrador, para que se revise antes de publicar (nunca guarda solo).
    var importEncuentroBtn = document.getElementById('importEncuentroBtn');
    var importEncuentroFile = document.getElementById('importEncuentroFile');
    if(importEncuentroBtn && importEncuentroFile){
      importEncuentroBtn.onclick = function(){ importEncuentroFile.click(); };
      importEncuentroFile.onchange = function(){
        var file = importEncuentroFile.files && importEncuentroFile.files[0];
        importEncuentroFile.value = '';
        if(!file) return;
        showStatus('Leyendo el archivo de la fordoquera...');
        file.text().then(function(text){
          var parsed;
          try{ parsed = parseEncuentrosHtml(text); }
          catch(e){ showStatus('No se pudo importar: ' + e.message); return; }
          var result = convertEncuentroToRdpImport(parsed.enc);

          resetFormDraftState();
          AppState.formSteps = result.steps;
          AppState.formTitleDraft = result.title;
          AppState.formBgMusicUrlDraft = result.bgMusicUrl || null;
          AppState.formOpen = true;
          renderPanel();
          var addFormEl = document.getElementById('addForm');
          if(addFormEl){ addFormEl.scrollIntoView({behavior:'smooth', block:'nearest'}); }

          var msg = 'Importado desde la fordoquera — revisá el contenido antes de publicar.';
          if(result.warnings.length){ msg += ' ' + result.warnings.join(' '); }

          if(result.pendingFiles.length){
            if(!AppState.driveAccessToken){
              msg += ' ' + result.pendingFiles.length + ' archivo(s) subido(s) directo en la fordoquera no se pudieron traer automáticamente (hace falta reingresar por "Soy del comando" para poder subir a Drive) — revisá las notas de cada paso y subilos a mano.';
              result.pendingFiles.forEach(function(pf){
                if(pf.stepIndex === -1) return; // música de fondo: sin nota donde dejar el aviso, queda sin resolver.
                var step = AppState.formSteps[pf.stepIndex];
                if(step){ step.nota = ('[Archivo "' + pf.name + '" no se pudo traer automáticamente — subilo a mano.] ' + (step.nota || '')).trim(); }
              });
            } else {
              result.pendingFiles.forEach(function(pf){
                var dataUrl = parsed.fileMap[pf.fid];
                if(!dataUrl) return;
                dataUrlToFile(dataUrl, pf.name, pf.mime).then(function(fileObj){
                  return uploadEntryFile(fileObj);
                }).then(function(url){
                  if(pf.stepIndex === -1){
                    AppState.formBgMusicUrlDraft = url;
                    var bgInput = document.getElementById('fBgMusicUrl');
                    if(bgInput) bgInput.value = url;
                    return;
                  }
                  var step = AppState.formSteps[pf.stepIndex];
                  if(step){
                    step.url = url;
                    var urlInputEl = document.querySelector('.stepUrlInput[data-idx="' + pf.stepIndex + '"]');
                    if(urlInputEl) urlInputEl.value = url;
                  }
                }).catch(function(e){
                  console.error('Error subiendo archivo importado de Encuentros:', e);
                  if(pf.stepIndex === -1) return;
                  var step = AppState.formSteps[pf.stepIndex];
                  if(step){ step.nota = ('[Archivo "' + pf.name + '" no se pudo subir: ' + e.message + ' — subilo a mano.] ' + (step.nota || '')).trim(); }
                });
              });
            }
          }
          showStatus(msg);
        }).catch(function(e){
          console.error('Error leyendo archivo de Encuentros:', e);
          showStatus('No se pudo leer el archivo: ' + e.message);
        });
      };
    }

    // "Exportar para Encuentros" (06/10/2026) — descarga un .html que la
    // herramienta "Encuentros" puede importar directo con su propio botón
    // "📥 Importar un encuentro". Mismo gate que "Editar"/"Eliminar"
    // (`canEditEntry`) — el archivo generado incluye las notas internas de
    // cada paso, que nunca deberían llegar a quien solo puede leer la entrada.
    document.querySelectorAll('[data-action="exportEncuentro"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        var entry = AppState.state.entries.find(function(e){ return e.id === id; });
        if(!entry || !canEditEntry(entry)) return;
        var payload = convertRdpEntryToEncuentro(entry);
        var html = buildEncuentroExportHtml(payload);
        var blob = new Blob([html], { type:'text/html' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = safeEncuentroFileName(entry.title) + '.html';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(a.href); }, 30000);
        showStatus('Exportado — importalo en la fordoquera con "📥 Importar un encuentro".');
      };
    });

    // Selectores chicos de alineación por zona (rediseño 22/09/2026, reemplaza
    // al viejo #textAlignToggle único) — puede haber varios en la misma
    // pantalla (uno por textarea de nivel superior, o uno por zona de cada
    // paso de una secuencial), así que se recorren todos por delegación en
    // vez de buscar un solo id. No disparan renderPanel() — elegir una
    // alineación no cambia qué otros campos se muestran.
    document.querySelectorAll('.align-picker').forEach(function(picker){
      var scope = picker.getAttribute('data-scope');
      var field = picker.getAttribute('data-field');
      var idxAttr = picker.getAttribute('data-idx');
      picker.querySelectorAll('button').forEach(function(btn){
        btn.onclick = function(){
          var val = btn.getAttribute('data-align');
          if(scope === 'step'){
            AppState.formSteps[parseInt(idxAttr, 10)][field] = val;
          } else {
            AppState.formAligns[field] = val;
          }
          picker.querySelectorAll('button').forEach(function(b){ b.classList.toggle('active', b === btn); });
        };
      });
    });

    // Colapsar/expandir todos los pasos de una secuencial mientras se edita
    // (pedido del usuario, 23/09/2026) — puramente visual, no toca `formSteps`.
    var toggleStepsCollapseBtn = document.getElementById('toggleStepsCollapseBtn');
    if(toggleStepsCollapseBtn){
      toggleStepsCollapseBtn.onclick = function(){ AppState.formStepsCollapsed = !AppState.formStepsCollapsed; renderPanel(); };
    }
    // Mismo criterio para el bloque de contenido multimedia (URL/subida +
    // textos antes/después) de una entrada de Imagen o Video.
    var toggleMediaCollapseBtn = document.getElementById('toggleMediaCollapseBtn');
    if(toggleMediaCollapseBtn){
      toggleMediaCollapseBtn.onclick = function(){ AppState.formMediaCollapsed = !AppState.formMediaCollapsed; renderPanel(); };
    }

    var fTitleInput = document.getElementById('fTitle');
    if(fTitleInput){ fTitleInput.oninput = function(e){ AppState.formTitleDraft = e.target.value; }; }
    // Cierre personalizable (08/10/2026) — mismo patrón *Draft que el resto.
    var fClosingTitleInput = document.getElementById('fClosingTitle');
    if(fClosingTitleInput){ fClosingTitleInput.oninput = function(e){ AppState.formClosingTitleDraft = e.target.value; }; }
    var fClosingSubInput = document.getElementById('fClosingSub');
    if(fClosingSubInput){ fClosingSubInput.oninput = function(e){ AppState.formClosingSubDraft = e.target.value; }; }
    // Música de fondo de una secuencial (22/09/2026) — mismo patrón que el
    // campo de URL/subida de arriba, pero para el link de audio opcional.
    var fBgMusicUrlInput = document.getElementById('fBgMusicUrl');
    if(fBgMusicUrlInput){ fBgMusicUrlInput.oninput = function(e){ AppState.formBgMusicUrlDraft = e.target.value; }; }
    var fBgMusicFileUpload = document.getElementById('fBgMusicFileUpload');
    if(fBgMusicFileUpload){
      fBgMusicFileUpload.onchange = function(){
        var file = fBgMusicFileUpload.files && fBgMusicFileUpload.files[0];
        if(!file) return;
        var statusEl = document.getElementById('fBgMusicFileUploadStatus');
        if(statusEl) statusEl.textContent = 'Subiendo "' + file.name + '"...';
        fBgMusicFileUpload.disabled = true;
        uploadEntryFile(file).then(function(url){
          AppState.formBgMusicUrlDraft = url;
          if(fBgMusicUrlInput) fBgMusicUrlInput.value = url;
          if(statusEl) statusEl.textContent = '✓ Archivo subido — el link de arriba ya lo apunta.';
          fBgMusicFileUpload.disabled = false;
        }).catch(function(e){
          console.error('Error subiendo archivo de música:', e);
          if(statusEl) statusEl.textContent = 'No se pudo subir: ' + e.message;
          fBgMusicFileUpload.disabled = false;
        });
      };
    }

    // Constructor de pasos de una entrada "secuencial" — tipear en un paso
    // escribe directo en `formSteps` sin re-render (mismo motivo que el resto
    // de los campos del form); solo agregar/quitar/mover dispara `renderPanel()`.
    document.querySelectorAll('.stepTextInput').forEach(function(ta){
      ta.oninput = function(){ AppState.formSteps[parseInt(ta.getAttribute('data-idx'), 10)].text = ta.value; };
    });
    document.querySelectorAll('.stepPreTextInput').forEach(function(ta){
      ta.oninput = function(){ AppState.formSteps[parseInt(ta.getAttribute('data-idx'), 10)].preText = ta.value; };
    });
    document.querySelectorAll('.stepPostTextInput').forEach(function(ta){
      ta.oninput = function(){ AppState.formSteps[parseInt(ta.getAttribute('data-idx'), 10)].postText = ta.value; };
    });
    document.querySelectorAll('.stepUrlInput').forEach(function(inp){
      inp.oninput = function(){ AppState.formSteps[parseInt(inp.getAttribute('data-idx'), 10)].url = inp.value; };
    });
    // Opciones de respuesta + configuración de una pregunta de opción
    // múltiple (26/09/2026, unificación con "Encuentros").
    document.querySelectorAll('.stepOpcionesInput').forEach(function(ta){
      ta.oninput = function(){
        AppState.formSteps[parseInt(ta.getAttribute('data-idx'), 10)].opciones = ta.value.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
      };
    });
    document.querySelectorAll('.stepUnicaCheck').forEach(function(cb){
      cb.onchange = function(){ AppState.formSteps[parseInt(cb.getAttribute('data-idx'), 10)].unica = cb.checked; };
    });
    document.querySelectorAll('.stepAllowWriteCheck').forEach(function(cb){
      cb.onchange = function(){ AppState.formSteps[parseInt(cb.getAttribute('data-idx'), 10)].allowWrite = cb.checked; };
    });
    // Nota interna (26/09/2026) — común a cualquier tipo de paso.
    document.querySelectorAll('.stepNotaInput').forEach(function(ta){
      ta.oninput = function(){ AppState.formSteps[parseInt(ta.getAttribute('data-idx'), 10)].nota = ta.value; };
    });
    // Condición de visibilidad (26/09/2026) — "mostrar este paso solo si la
    // respuesta de un paso anterior fue X". Cambiar el paso de referencia
    // re-renderiza (la lista de "en qué paso" no depende de esto, pero el
    // select en sí sí necesita reflejar la selección nueva); tipear el valor
    // esperado no, mismo criterio que el resto de los campos de texto.
    document.querySelectorAll('.stepCondStepSelect').forEach(function(sel){
      sel.onchange = function(){
        var idx = parseInt(sel.getAttribute('data-idx'), 10);
        var val = sel.value;
        if(val === ''){ AppState.formSteps[idx].cond = null; }
        else { AppState.formSteps[idx].cond = { step: parseInt(val, 10), val: (AppState.formSteps[idx].cond && AppState.formSteps[idx].cond.val) || '' }; }
      };
    });
    document.querySelectorAll('.stepCondValInput').forEach(function(inp){
      inp.oninput = function(){
        var idx = parseInt(inp.getAttribute('data-idx'), 10);
        if(!AppState.formSteps[idx].cond) AppState.formSteps[idx].cond = { step: 0, val: '' };
        AppState.formSteps[idx].cond.val = inp.value;
      };
    });
    // Cita de libro — select de biblioteca + número de punto, o los campos de
    // "Personalizado" (26/09/2026). `.stepLibSelect` sí re-renderiza (cambiar
    // de biblioteca cambia qué campos se muestran, y la vista previa).
    document.querySelectorAll('.stepLibSelect').forEach(function(sel){
      sel.onchange = function(){
        var idx = parseInt(sel.getAttribute('data-idx'), 10);
        AppState.formSteps[idx].book = { lib: sel.value, n: '', titulo: '', autor: '', color: '#6b6b6b', texto: '' };
        renderPanel();
      };
    });
    // Punto/campos de "Personalizado": escriben directo sin re-render (mismo
    // criterio que el resto de los campos de texto), pero sí refrescan la
    // vista previa de la cita al perder el foco — si no, quedaría desactualizada
    // hasta la próxima acción que dispare un renderPanel() por otro motivo.
    document.querySelectorAll('.stepPuntoInput').forEach(function(inp){
      var idx = parseInt(inp.getAttribute('data-idx'), 10);
      inp.oninput = function(){ AppState.formSteps[idx].book.n = inp.value; };
      inp.addEventListener('blur', function(){ renderPanel(); });
    });
    document.querySelectorAll('.stepCustomTitulo').forEach(function(inp){
      var idx = parseInt(inp.getAttribute('data-idx'), 10);
      inp.oninput = function(){ AppState.formSteps[idx].book.titulo = inp.value; };
      inp.addEventListener('blur', function(){ renderPanel(); });
    });
    document.querySelectorAll('.stepCustomAutor').forEach(function(inp){
      inp.oninput = function(){ AppState.formSteps[parseInt(inp.getAttribute('data-idx'), 10)].book.autor = inp.value; };
    });
    document.querySelectorAll('.stepCustomColor').forEach(function(inp){
      inp.oninput = function(){ AppState.formSteps[parseInt(inp.getAttribute('data-idx'), 10)].book.color = inp.value; };
      inp.addEventListener('change', function(){ renderPanel(); });
    });
    document.querySelectorAll('.stepCustomTexto').forEach(function(ta){
      var idx = parseInt(ta.getAttribute('data-idx'), 10);
      ta.oninput = function(){ AppState.formSteps[idx].book.texto = ta.value; };
      ta.addEventListener('blur', function(){ renderPanel(); });
    });
    document.querySelectorAll('.stepFileInput').forEach(function(inp){
      inp.onchange = function(){
        var idx = parseInt(inp.getAttribute('data-idx'), 10);
        var file = inp.files && inp.files[0];
        if(!file) return;
        var statusEl = document.querySelector('.stepFileStatus[data-idx="' + idx + '"]');
        if(statusEl) statusEl.textContent = 'Subiendo "' + file.name + '"...';
        inp.disabled = true;
        uploadEntryFile(file).then(function(url){
          AppState.formSteps[idx].url = url;
          var urlInputEl = document.querySelector('.stepUrlInput[data-idx="' + idx + '"]');
          if(urlInputEl) urlInputEl.value = url;
          if(statusEl) statusEl.textContent = '✓ Archivo subido — el link de arriba ya lo apunta.';
          inp.disabled = false;
        }).catch(function(e){
          console.error('Error subiendo archivo del paso:', e);
          if(statusEl) statusEl.textContent = 'No se pudo subir: ' + e.message;
          inp.disabled = false;
        });
      };
    });
    document.querySelectorAll('.step-remove').forEach(function(btn){
      btn.onclick = function(){ AppState.formSteps.splice(parseInt(btn.getAttribute('data-idx'), 10), 1); renderPanel(); };
    });
    document.querySelectorAll('.step-move-up').forEach(function(btn){
      btn.onclick = function(){
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        if(i > 0){ var tmp = AppState.formSteps[i-1]; AppState.formSteps[i-1] = AppState.formSteps[i]; AppState.formSteps[i] = tmp; renderPanel(); }
      };
    });
    document.querySelectorAll('.step-move-down').forEach(function(btn){
      btn.onclick = function(){
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        if(i < AppState.formSteps.length - 1){ var tmp = AppState.formSteps[i+1]; AppState.formSteps[i+1] = AppState.formSteps[i]; AppState.formSteps[i] = tmp; renderPanel(); }
      };
    });
    document.querySelectorAll('.addStepBtn').forEach(function(btn){
      btn.onclick = function(){
        var newType = btn.getAttribute('data-type');
        if(newType === 'grupo'){
          AppState.formSteps.push({ type:'grupo', title:'', body:'', closed:false, slide:false, cond:null });
        } else {
          AppState.formSteps.push({ type: newType, text: '', url: '', preText: '', postText: '', align: 'left', preTextAlign: 'left', postTextAlign: 'left',
            opciones: [], unica: true, allowWrite: false, nota: '', cond: null,
            book: newType === 'libro' ? { lib: 'youcat', n: '', titulo: '', autor: '', color: '#6b6b6b', texto: '' } : null });
        }
        // Si los pasos arrancaban colapsados (default al abrir el form), un
        // paso recién agregado se expande solo — si no, habría que tocar
        // "Expandir pasos" antes de poder escribir nada en el que se acaba
        // de crear.
        AppState.formStepsCollapsed = false;
        renderPanel();
        // Con muchos pasos ya cargados, el nuevo queda fuera de vista arriba
        // del todo — bajar hasta él en vez de que la persona tenga que
        // desplazarse a mano (pedido del usuario, 23/09/2026).
        var rows = document.querySelectorAll('.step-row');
        if(rows.length){ rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' }); }
      };
    });

    // ===== Paso "Grupo" (08/10/2026) =====
    document.querySelectorAll('.stepGroupTitleInput').forEach(function(inp){
      inp.oninput = function(){ AppState.formSteps[parseInt(inp.getAttribute('data-idx'), 10)].title = inp.value; };
    });
    document.querySelectorAll('.stepGroupBodyInput').forEach(function(ta){
      ta.oninput = function(){ AppState.formSteps[parseInt(ta.getAttribute('data-idx'), 10)].body = ta.value; };
    });
    document.querySelectorAll('.stepGroupSlideCheck').forEach(function(cb){
      cb.onchange = function(){
        AppState.formSteps[parseInt(cb.getAttribute('data-idx'), 10)].slide = cb.checked;
        renderPanel(); // revela/oculta el textarea de la portada
      };
    });
    document.querySelectorAll('.step-group-fold').forEach(function(btn){
      btn.onclick = function(){
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        AppState.formSteps[idx].closed = !AppState.formSteps[idx].closed;
        renderPanel();
      };
    });
    // Mueve el grupo entero (header + todos sus miembros) como un solo
    // bloque, intercambiándolo con el rango que tenga inmediatamente antes/
    // después — ese rango puede ser un paso suelto o, a su vez, otro grupo
    // completo (ver `groupRangeAt`), así nunca se puede "colar" en el medio
    // de otro grupo.
    function precedingRangeStart(steps, idx){
      for(var i = idx - 1; i >= 0; i--){ if(steps[i].type === 'grupo') return i; }
      return idx - 1;
    }
    function moveGroupBlock(idx, dir){
      var steps = AppState.formSteps;
      var range = groupRangeAt(steps, idx);
      var otherStart;
      if(dir < 0){
        if(idx === 0) return;
        otherStart = precedingRangeStart(steps, idx);
      } else {
        otherStart = range[1];
        if(otherStart >= steps.length) return;
      }
      var otherRange = groupRangeAt(steps, otherStart);
      var a = range[0] < otherRange[0] ? range : otherRange;
      var b = range[0] < otherRange[0] ? otherRange : range;
      AppState.formSteps = steps.slice(0, a[0]).concat(steps.slice(b[0], b[1]), steps.slice(a[0], a[1]), steps.slice(b[1]));
      renderPanel();
    }
    document.querySelectorAll('.step-group-move-up').forEach(function(btn){
      btn.onclick = function(){ moveGroupBlock(parseInt(btn.getAttribute('data-idx'), 10), -1); };
    });
    document.querySelectorAll('.step-group-move-down').forEach(function(btn){
      btn.onclick = function(){ moveGroupBlock(parseInt(btn.getAttribute('data-idx'), 10), 1); };
    });
    // "Desagrupar" — quita SOLO la marca de grupo (splice de un elemento);
    // sus miembros quedan donde estaban, ahora sin agrupar (o agrupados por
    // lo que haya quedado antes, si este grupo estaba anidado detrás de
    // otro — mismo criterio que "Encuentros", que tampoco soporta anidar).
    document.querySelectorAll('.step-group-ungroup').forEach(function(btn){
      btn.onclick = function(){
        AppState.formSteps.splice(parseInt(btn.getAttribute('data-idx'), 10), 1);
        renderPanel();
      };
    });

    // ===== "Buscar en los libros" — picker multi-select (08/10/2026) =====
    var openLibroPickerBtn = document.getElementById('openLibroPickerBtn');
    if(openLibroPickerBtn){
      openLibroPickerBtn.onclick = function(){
        AppState.libroPickerOpen = true; AppState.libroPickerQuery = ''; AppState.libroPickerSel = [];
        renderPanel();
        ensureLibroLoaded(AppState.libroPickerBook).then(renderPanel).catch(renderPanel);
      };
    }
    var libroPickerClose = document.getElementById('libroPickerClose');
    if(libroPickerClose){
      libroPickerClose.onclick = function(){ AppState.libroPickerOpen = false; renderPanel(); };
    }
    document.querySelectorAll('.libroPickerTab').forEach(function(tab){
      tab.onclick = function(){
        var lib = tab.getAttribute('data-lib');
        if(AppState.libroPickerBook === lib) return;
        AppState.libroPickerBook = lib; AppState.libroPickerQuery = ''; AppState.libroPickerSel = [];
        renderPanel();
        ensureLibroLoaded(lib).then(renderPanel).catch(renderPanel);
      };
    });
    var libroPickerQueryInput = document.getElementById('libroPickerQuery');
    if(libroPickerQueryInput){
      libroPickerQueryInput.oninput = function(){ AppState.libroPickerQuery = libroPickerQueryInput.value; renderPanel(); };
    }
    document.querySelectorAll('.libroPickerCheck').forEach(function(cb){
      cb.onchange = function(){
        var key = cb.getAttribute('data-key');
        var sel = AppState.libroPickerSel;
        var at = sel.indexOf(key);
        if(cb.checked){ if(at === -1) sel.push(key); } else if(at !== -1){ sel.splice(at, 1); }
        renderPanel();
      };
    });
    var libroPickerConfirm = document.getElementById('libroPickerConfirm');
    if(libroPickerConfirm){
      libroPickerConfirm.onclick = function(){
        AppState.libroPickerSel.forEach(function(key){
          var n = key.split('|')[1];
          AppState.formSteps.push({ type:'libro', text:'', url:'', preText:'', postText:'', align:'left', preTextAlign:'left', postTextAlign:'left',
            opciones: [], unica: true, allowWrite: false, nota: '', cond: null,
            book: { lib: AppState.libroPickerBook, n: n, titulo:'', autor:'', color:'#6b6b6b', texto:'' } });
        });
        AppState.libroPickerOpen = false; AppState.libroPickerQuery = ''; AppState.libroPickerSel = [];
        AppState.formStepsCollapsed = false;
        renderPanel();
        var rows = document.querySelectorAll('.step-row');
        if(rows.length){ rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' }); }
      };
    }

    // Checkboxes del selector de Ámbito — a diferencia del viejo <select>, tildar
    // uno no necesita revelar/ocultar nada más, así que no hace falta re-render
    // acá (el checkbox ya se mantiene tildado solo, es un <input> nativo).
    var comandoGeneralCheck = document.getElementById('fComandoGeneral');
    if(comandoGeneralCheck){
      comandoGeneralCheck.onchange = function(){ AppState.formComandoGeneral = comandoGeneralCheck.checked; };
    }
    var seccionComandoOnlyCheck = document.getElementById('fSeccionComandoOnly');
    if(seccionComandoOnlyCheck){
      seccionComandoOnlyCheck.onchange = function(){ AppState.formSeccionComandoOnly = seccionComandoOnlyCheck.checked; };
    }
    // Este sí re-renderiza: el texto de abajo ("Firma como: X" / "Se publica
    // sin firma") tiene que reflejar el estado nuevo al toque.
    var anonimoCheck = document.getElementById('fAnonimo');
    if(anonimoCheck){
      anonimoCheck.onchange = function(){ AppState.formAnonimo = anonimoCheck.checked; renderPanel(); };
    }
    // No hace falta re-renderizar acá (no hay ningún texto que dependa de
    // este checkbox, a diferencia de "Publicar sin firmar") — mismo criterio
    // que los checkboxes de Ámbito.
    var ocultaCheck = document.getElementById('fOculta');
    if(ocultaCheck){
      ocultaCheck.onchange = function(){ AppState.formOculta = ocultaCheck.checked; };
    }
    var bienvenidaCheck = document.getElementById('fBienvenida');
    if(bienvenidaCheck){
      bienvenidaCheck.onchange = function(){ AppState.formBienvenida = bienvenidaCheck.checked; };
    }
    document.querySelectorAll('.fSeccionCheck').forEach(function(cb){
      cb.onchange = function(){
        var v = cb.value;
        if(cb.checked){ if(AppState.formSecciones.indexOf(v) === -1) AppState.formSecciones.push(v); }
        else { AppState.formSecciones = AppState.formSecciones.filter(function(x){ return x !== v; }); }
      };
    });
    document.querySelectorAll('.fDeptoCheck').forEach(function(cb){
      cb.onchange = function(){
        var v = cb.value;
        if(cb.checked){ if(AppState.formDeptos.indexOf(v) === -1) AppState.formDeptos.push(v); }
        else { AppState.formDeptos = AppState.formDeptos.filter(function(x){ return x !== v; }); }
      };
    });

    var saveBtn = document.getElementById('saveEntryBtn');
    if(saveBtn){
      saveBtn.onclick = function(){
        var title = document.getElementById('fTitle').value.trim();
        var bgMusicUrlInput = document.getElementById('fBgMusicUrl');
        var bgMusicUrl = bgMusicUrlInput ? bgMusicUrlInput.value.trim() : '';
        var closingTitleInput = document.getElementById('fClosingTitle');
        var closingSubInput = document.getElementById('fClosingSub');
        var closingTitle = closingTitleInput ? closingTitleInput.value.trim() : '';
        var closingSub = closingSubInput ? closingSubInput.value.trim() : '';
        var closing = (closingTitle || closingSub) ? { title: closingTitle, sub: closingSub } : null;
        if(!title){ showStatus('Poné un título antes de publicar.'); return; }
        if(AppState.formSteps.length === 0){ showStatus('Agregá al menos un paso.'); return; }
        // Los pasos se guardan sueltos — se limpia el texto de cada paso al
        // guardar, no en cada tecla, para no interrumpir mientras se escribe.
        var steps = AppState.formSteps.map(function(s){
          if(s.type === 'grupo'){
            // "Grupo" (08/10/2026) no lleva ninguno de los campos de
            // contenido de un paso normal — título propio, condición (igual
            // que cualquier otro paso), si está plegado en el editor, y si
            // se muestra como portada (+ su texto, solo entonces).
            return { type: 'grupo', title: (s.title||'').trim(), body: s.slide ? (s.body||'').trim() : '',
              closed: !!s.closed, slide: !!s.slide,
              cond: (s.cond && s.cond.val) ? { step: s.cond.step, val: s.cond.val.trim() } : null };
          }
          return { type: s.type, text: (s.text||'').trim(), url: (s.url||'').trim(), preText: (s.preText||'').trim(), postText: (s.postText||'').trim(),
            align: s.align || 'left', preTextAlign: s.preTextAlign || 'left', postTextAlign: s.postTextAlign || 'left',
            // Opciones de una pregunta de opción única/múltiple, nota interna
            // y condición de visibilidad — comunes a cualquier tipo de paso
            // (26/09/2026, unificación con "Encuentros").
            opciones: (s.opciones || []).slice(), unica: s.unica !== false, allowWrite: !!s.allowWrite,
            nota: (s.nota || '').trim(), cond: (s.cond && s.cond.val) ? { step: s.cond.step, val: s.cond.val.trim() } : null,
            // Cita de libro: se guarda tal cual (la vista previa ya validó que
            // tenga sentido); un paso que no es "libro" no lleva este campo.
            book: s.type === 'libro' ? (s.book ? {
              lib: s.book.lib, n: (s.book.n||'').trim(), titulo: (s.book.titulo||'').trim(),
              autor: (s.book.autor||'').trim(), color: s.book.color || '#6b6b6b', texto: (s.book.texto||'').trim()
            } : null) : null };
        });

        // El ámbito efectivo depende de quién publica: un admin puede elegir
        // cualquier combinación (los checkboxes tildados); un jefe de sección o
        // de departamento sigue forzado a su propio grupo único (nunca tuvo
        // checkboxes para elegir otros), pero el checkbox de "Comando (sin milicianos)"
        // sí aplica para cualquiera.
        var secciones, deptos;
        if(day === 'INFO_GENERAL'){
          secciones = []; deptos = [];
        } else if(isAdmin()){
          secciones = (day === null) ? [] : AppState.formSecciones.slice();
          deptos = AppState.formDeptos.slice();
        } else if(isJefeSeccion() && effectiveDepto() && !effectiveSeccion()){
          secciones = []; deptos = [effectiveDepto()];
        } else {
          secciones = effectiveSeccion() ? [effectiveSeccion()] : []; deptos = [];
        }
        var comandoGeneral = (day === 'INFO_GENERAL') ? false : AppState.formComandoGeneral;
        var seccionComandoOnly = (day === 'RESOURCES') ? AppState.formSeccionComandoOnly : false;

        var allowed;
        if(day === 'RESOURCES'){
          allowed = canCreateRecurso();
        } else if(day === 'INFO_GENERAL'){
          allowed = canCreateInfoGeneral();
        } else if(day === null){
          // "Departamentos": nunca General/Sección — siempre al menos un depto
          // puntual, o "todo el comando".
          if(deptos.length === 0 && !comandoGeneral){ showStatus('Elegí al menos un departamento (o tildá "General").'); return; }
          allowed = isAdmin() || (isJefeSeccionEditing() && !!effectiveDepto());
        } else {
          allowed = isAdmin() || isJefeSeccionEditing();
        }
        if(!allowed){ showStatus('No tenés permiso para publicar ahí.'); return; }
        var anonimo = AppState.formAnonimo;
        var author = anonimo ? '' : AppState.currentUser.displayName;
        // Guardado siempre, independiente de `anonimo` — es lo que le permite
        // al admin ver quién publicó una entrada anónima (ver renderEntry()).
        // Nadie más lo lee nunca (`anonimoTag` está gateado por isAdmin()).
        // Grupo del autor REAL (nunca simulado por "Ver como") — el dato que
        // alimenta "el circulito" (feedback de Comunicaciones, 09/10/2026):
        // admin → 'FORDOC' (el comando central de este sitio ES, en la
        // práctica, el equipo de Formación/FORDOC); jefe_seccion siempre
        // tiene `seccion` XOR `depto`, nunca los dos — se usa el que tenga.
        var authorGrupo = AppState.currentUser.role === 'admin'
          ? 'FORDOC'
          : (AppState.currentUser.seccion || AppState.currentUser.depto || '');
        // "Entrada de bienvenida" — solo tiene sentido en Recursos, y solo
        // para una Secuencial; en cualquier otro contexto se fuerza a false,
        // por si `formBienvenida` quedó en `true` de una edición anterior de
        // otro tipo/pestaña en la misma sesión (defensivo, el checkbox ya
        // solo aparece en ese caso puntual, pero no cuesta nada blindarlo).
        var bienvenida = (day === 'RESOURCES') ? AppState.formBienvenida : false;
        if(AppState.editingEntryId){
          var entry = AppState.state.entries.find(function(e){ return e.id === AppState.editingEntryId; });
          if(!canEditEntry(entry)){ showStatus('No tenés permiso para editar esta entrada.'); return; }
          entry.title = title; entry.author = author; entry.anonimo = anonimo; entry.type = 'secuencial';
          entry.authorReal = entry.authorReal || AppState.currentUser.displayName;
          entry.authorGrupo = entry.authorGrupo || authorGrupo;
          entry.secciones = secciones; entry.deptos = deptos; entry.comandoGeneral = comandoGeneral;
          entry.seccionesComandoOnly = seccionComandoOnly;
          entry.steps = steps;
          entry.bgMusicUrl = bgMusicUrl;
          entry.closing = closing;
          entry.oculta = AppState.formOculta;
          entry.bienvenida = bienvenida;
          // Limpia los campos del formato viejo (de antes de que toda entrada
          // pasara a ser "secuencial", 06/10/2026) para que no quede una
          // entrada con las dos formas mezcladas — `renderEntry()` ya prioriza
          // `steps` cuando `type==='secuencial'`, pero mejor no dejar basura.
          entry.body = ''; entry.bodyAfter = ''; entry.url = ''; entry.book = null;
          entry.seccion = ''; entry.depto = ''; entry.deptoVisibilidad = ''; entry.seccionVisibilidad = ''; entry.textAlign = '';
          entry.bodyAlign = ''; entry.bodyAfterAlign = '';
        } else {
          var dayIdVal = (day && typeof day === 'object') ? day.id : (day || null);
          // "+" flotante entre entradas (08/10/2026): si el form se abrió
          // desde ahí, `insertOrderCreatedAt` ya trae el valor calculado a
          // mitad de camino entre las dos entradas vecinas — si no, se
          // agrega al final como siempre (`Date.now()`).
          var newCreatedAt = AppState.insertOrderCreatedAt != null ? AppState.insertOrderCreatedAt : Date.now();
          AppState.state.entries.push({
            id: uid(), dayId: dayIdVal, type: 'secuencial', title: title, body: '', bodyAfter: '', url: '', book: null, author: author, anonimo: anonimo, authorReal: AppState.currentUser.displayName, authorGrupo: authorGrupo,
            secciones: secciones, deptos: deptos, comandoGeneral: comandoGeneral, seccionesComandoOnly: seccionComandoOnly, steps: steps,
            bgMusicUrl: bgMusicUrl, closing: closing, oculta: AppState.formOculta, bienvenida: bienvenida, createdAt: newCreatedAt
          });
        }
        save();
        AppState.formOpen = false;
        resetFormDraftState();
        render();
      };
    }

    var cancelBtn = document.getElementById('cancelFormBtn');
    if(cancelBtn){
      cancelBtn.onclick = function(){
        AppState.formOpen = false;
        resetFormDraftState();
        render();
      };
    }

    document.querySelectorAll('[data-action="edit"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        var entry = AppState.state.entries.find(function(e){ return e.id === id; });
        if(!entry) return;
        AppState.editingEntryId = id;
        // Editar una entrada existente nunca toca su posición en el orden —
        // si quedó un "insertar acá" armado de un click anterior sin guardar
        // (abrió el hueco "+" y después, sin cerrar, tocó "Editar" en otra
        // entrada), que no se cuele en esta edición.
        AppState.insertOrderCreatedAt = null; AppState.insertOrderNote = '';
        var scope = entryScope(entry);
        AppState.formSecciones = scope.secciones.slice();
        AppState.formDeptos = scope.deptos.slice();
        AppState.formComandoGeneral = scope.comandoGeneral;
        AppState.formSeccionComandoOnly = !!entry.seccionesComandoOnly;
        AppState.formAnonimo = !!entry.anonimo;
        AppState.formOculta = !!entry.oculta;
        AppState.formBienvenida = !!entry.bienvenida;
        // Arranca colapsado siempre (pedido del usuario, 23/09/2026) — no se
        // recuerda el estado de una edición anterior de esta misma sesión,
        // cada vez que se abre "Editar" vuelve a empezar colapsado.
        AppState.formStepsCollapsed = true;
        AppState.formMediaCollapsed = true;
        AppState.formClosingTitleDraft = null; AppState.formClosingSubDraft = null;
        if(entry.type === 'secuencial'){
          AppState.formSteps = (entry.steps || []).map(function(s){
            if(s.type === 'grupo'){
              return { type:'grupo', title: s.title || '', body: s.body || '', closed: !!s.closed, slide: !!s.slide,
                cond: s.cond ? { step: s.cond.step, val: s.cond.val || '' } : null };
            }
            // Migración suave: un paso viejo de Video/Imagen guardaba su
            // descripción en `text` (mostrada siempre ANTES) — si todavía no
            // tiene `preText` propio, se la pasamos ahí para no perder lo ya
            // cargado (pedido del usuario, 22/09/2026).
            var preTextVal = s.preText || '';
            if(!preTextVal && (s.type === 'video' || s.type === 'imagen')) preTextVal = s.text || '';
            return { type: s.type, text: s.text || '', url: s.url || '', preText: preTextVal, postText: s.postText || '',
              align: s.align || 'left', preTextAlign: s.preTextAlign || 'left', postTextAlign: s.postTextAlign || 'left',
              opciones: (s.opciones || []).slice(), unica: s.unica !== false, allowWrite: !!s.allowWrite,
              nota: s.nota || '', cond: s.cond ? { step: s.cond.step, val: s.cond.val || '' } : null,
              book: s.type === 'libro' ? Object.assign({ lib:'youcat', n:'', titulo:'', autor:'', color:'#6b6b6b', texto:'' }, s.book || {}) : null };
          });
        } else {
          // Migración a un solo paso (06/10/2026, "Tipo de contenido" sacado
          // del todo): una entrada de un tipo simple guardada de ANTES de este
          // cambio se convierte, al editarla, en un borrador de secuencial de
          // un solo paso que preserva todo su contenido — al guardar queda
          // convertida de verdad (`entry.type` pasa a 'secuencial'). Mientras
          // tanto, si nunca se edita, `renderEntry()` sigue mostrándola igual
          // que siempre (no se tocó su rama de lectura).
          var legacyAlign = entry.bodyAlign || entry.textAlign || 'left';
          var step = { type: entry.type, text: '', url: '', preText: '', postText: '',
            align: 'left', preTextAlign: 'left', postTextAlign: 'left',
            opciones: [], unica: true, allowWrite: false, nota: '', cond: null, book: null };
          if(entry.type === 'texto'){
            step.text = entry.body || ''; step.align = legacyAlign;
          } else if(entry.type === 'enlace'){
            step.preText = entry.body || ''; step.preTextAlign = legacyAlign; step.url = entry.url || '';
          } else if(entry.type === 'libro'){
            step.preText = entry.body || ''; step.preTextAlign = legacyAlign;
            step.postText = entry.bodyAfter || ''; step.postTextAlign = entry.bodyAfterAlign || 'left';
            step.book = Object.assign({ lib:'youcat', n:'', titulo:'', autor:'', color:'#6b6b6b', texto:'' }, entry.book || {});
          } else {
            // imagen / video / audio / pdf
            step.preText = entry.body || ''; step.preTextAlign = legacyAlign; step.url = entry.url || '';
            step.postText = entry.bodyAfter || ''; step.postTextAlign = entry.bodyAfterAlign || 'left';
          }
          AppState.formSteps = [step];
        }
        AppState.formTitleDraft = null; AppState.formBgMusicUrlDraft = null;
        AppState.formOpen = true;
        renderPanel();
        document.getElementById('addForm').scrollIntoView({behavior:'smooth', block:'nearest'});
      };
    });

    document.querySelectorAll('[data-action="delete"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        if(!confirm('¿Eliminar este contenido?')) return;
        // Borrado suave (pedido del usuario, 24/09/2026): ya no se saca del
        // array — queda marcada y desaparece del feed normal (canSeeEntry),
        // pero sigue recuperable desde "Papelera".
        var entry = AppState.state.entries.find(function(e){ return e.id === id; });
        if(entry){ entry.deletedAt = Date.now(); entry.deletedBy = AppState.currentUser.displayName; }
        save();
        render();
      };
    });

    // Colapsar/expandir (pedido del usuario, 23/09/2026) — solo re-renderiza
    // el panel entero (no hay forma más liviana de togglear una clase en un
    // string ya armado), pero no toca ningún estado de la entrada en sí.
    document.querySelectorAll('[data-action="toggleCollapse"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        if(AppState.collapsedEntryIds[id]){ delete AppState.collapsedEntryIds[id]; }
        else { AppState.collapsedEntryIds[id] = true; }
        renderPanel();
      };
    });

    // "Publicar" de una entrada oculta/borrador, sin abrir el formulario de
    // edición (pedido del usuario, 23/09/2026).
    document.querySelectorAll('[data-action="publishEntry"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        var entry = AppState.state.entries.find(function(e){ return e.id === id; });
        if(!entry || !canEditEntry(entry)) return;
        entry.oculta = false;
        save();
        render();
      };
    });

    // Navegación de una entrada "secuencial" — abrir/cerrar, moverse entre
    // pasos, y guardar la respuesta del paso de "propósito personal".
    document.querySelectorAll('[data-action="secuencial-toggle"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        if(AppState.secuencialOpenEntryId === id){
          AppState.secuencialOpenEntryId = null;
          stopSecuencialMusic();
        } else {
          AppState.secuencialOpenEntryId = id; AppState.secuencialStepIndex[id] = 0;
          startSecuencialMusicIfAny(AppState.state.entries.find(function(e){ return e.id === id; }));
        }
        AppState.secuencialAnswerDraft = null;
        if(AppState.secuencialFullscreenId && AppState.secuencialFullscreenId !== AppState.secuencialOpenEntryId){
          AppState.secuencialFullscreenId = null;
          setSecuencialFullscreenLock(false);
        }
        renderPanel();
      };
    });
    document.querySelectorAll('[data-action="secuencial-fullscreen-toggle"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        AppState.secuencialFullscreenId = AppState.secuencialFullscreenId === id ? null : id;
        setSecuencialFullscreenLock(!!AppState.secuencialFullscreenId);
        renderPanel();
      };
    });
    document.querySelectorAll('[data-action="secuencial-prev"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        var entry = AppState.state.entries.find(function(e){ return e.id === id; });
        var steps = entry && entry.steps ? entry.steps : [];
        var raw = Math.max(0, (AppState.secuencialStepIndex[id]||0) - 1);
        // Salta de largo cualquier paso cuya condición no se cumpla (26/09/2026)
        // — no tiene sentido dejar a la persona parada en una pantalla vacía.
        AppState.secuencialStepIndex[id] = nextVisibleStepIndex(steps, entry, AppState.myProgress[id], raw, -1, steps.length);
        AppState.secuencialAnswerDraft = null;
        updateSecuencialMusicForStep(id);
        renderPanel();
        scrollSecuencialToTop(id);
      };
    });
    document.querySelectorAll('[data-action="secuencial-next"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        var entry = AppState.state.entries.find(function(e){ return e.id === id; });
        // +1 acá porque hay un paso extra sintético de cierre después del
        // último paso real (ver renderSecuencialEntry).
        var steps = entry && entry.steps ? entry.steps : [];
        var max = steps.length;
        var raw = Math.min(max, (AppState.secuencialStepIndex[id]||0) + 1);
        AppState.secuencialStepIndex[id] = nextVisibleStepIndex(steps, entry, AppState.myProgress[id], raw, 1, max);
        AppState.secuencialAnswerDraft = null;
        updateSecuencialMusicForStep(id);
        renderPanel();
        scrollSecuencialToTop(id);
      };
    });
    document.querySelectorAll('[data-action="secuencial-finish"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        markProgressCompleted(id);
        AppState.secuencialOpenEntryId = null;
        AppState.secuencialAnswerDraft = null;
        stopSecuencialMusic();
        if(AppState.secuencialFullscreenId === id){ AppState.secuencialFullscreenId = null; setSecuencialFullscreenLock(false); }
        renderPanel();
      };
    });
    document.querySelectorAll('[data-action="secuencial-completions-toggle"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-id');
        if(AppState.secuencialCompletionsOpenId === id){
          AppState.secuencialCompletionsOpenId = null;
          renderPanel();
        } else {
          AppState.secuencialCompletionsOpenId = id;
          // Abrir el panel "reconoce" los completados actuales — la alerta
          // de "hay gente nueva" solo vuelve a aparecer si entra alguien más
          // después de este punto (ya está suscripto en vivo, no hace falta
          // pedir los datos de nuevo acá).
          var list = AppState.secuencialCompletionsCache[id];
          if(Array.isArray(list)){ AppState.secuencialCompletionsSeenCount[id] = list.length; }
          renderPanel();
        }
      };
    });
    document.querySelectorAll('.secuencialAnswerInput').forEach(function(ta){
      var entryId = ta.getAttribute('data-entry');
      // El campo de respuesta libre de una pregunta de opción múltiple usa la
      // clave "w<idx>" (en vez de un índice numérico) para no pisar la
      // respuesta de las opciones elegidas en el mismo paso (26/09/2026) — no
      // se puede parsear como número, así que se guarda tal cual.
      var stepAttr = ta.getAttribute('data-step');
      var stepIdx = /^w/.test(stepAttr) ? stepAttr : parseInt(stepAttr, 10);
      ta.oninput = function(){ AppState.secuencialAnswerDraft = { entryId: entryId, stepIdx: stepIdx, value: ta.value }; };
      ta.addEventListener('blur', function(){
        saveProgressAnswer(entryId, stepIdx, ta.value);
        AppState.secuencialAnswerDraft = null;
      });
    });
    // Opciones de una pregunta de opción única/múltiple (26/09/2026) — guarda
    // al toque (no hace falta un blur, es un click sobre un radio/checkbox).
    document.querySelectorAll('.secuencialOpcionInput').forEach(function(inp){
      inp.onchange = function(){
        var entryId = inp.getAttribute('data-entry');
        var stepIdx = parseInt(inp.getAttribute('data-step'), 10);
        var opcion = inp.getAttribute('data-opcion');
        var unica = inp.getAttribute('data-unica') === '1';
        if(unica){
          saveProgressAnswer(entryId, stepIdx, opcion);
        } else {
          var prevVal = (AppState.myProgress[entryId] && AppState.myProgress[entryId].respuestas && AppState.myProgress[entryId].respuestas[stepIdx]) || '';
          var cur = prevVal.split(OPCION_SEP).map(function(s){ return s.trim(); }).filter(Boolean);
          if(inp.checked){ if(cur.indexOf(opcion) === -1) cur.push(opcion); }
          else { cur = cur.filter(function(x){ return x !== opcion; }); }
          saveProgressAnswer(entryId, stepIdx, cur.join(OPCION_SEP));
        }
        // Sin renderPanel() acá a propósito: el radio/checkbox ya refleja el
        // click solo (DOM nativo) — reconstruir el HTML ahora volvería a leer
        // `myProgress` desde el cache viejo (la escritura a Firestore todavía
        // no volvió) y pisaría la selección recién hecha hasta que el
        // listener en vivo la actualice solo (mismo criterio que el blur-save
        // de "Propósito personal", que tampoco re-renderiza al guardar).
      };
    });
  }
