// El formulario de "Agregar entrada" (Mensaje, Departamentos, Recursos,
// Info general comparten el mismo) — desde "Fordoquera incrustada"
// (09/10/2026, ver CLAUDE.md) este formulario ya NO construye el contenido
// de la entrada (eso lo hace la Fordoquera entera, embebida en un <iframe>,
// ver components/fordoquera-embed.js) — solo administra los metadatos de
// plataforma: título (de respaldo, hasta que la Fordoquera guarde el suyo),
// a quién se publica (Ámbito), si queda anónima, si queda oculta (borrador),
// y si es la entrada de bienvenida.

import { AppState } from '../app-state.js';
import { SECCIONES, DEPARTAMENTOS } from '../config/constants.js';
import { escapeHtml, uid } from '../utils/helpers.js';
import { isAdmin, isJefeSeccion, isJefeSeccionEditing, effectiveDepto, effectiveSeccion, entryScope, canEditEntry, canCreateRecurso, canCreateInfoGeneral } from '../services/permissions.js';
import { save, renameDay, setDayDate, setDayCita, setConsigna, deleteDay } from '../services/state.service.js';
import { entryToEspacio } from '../utils/entry-to-espacio.js';
import { openFordoqueraEditor, openFordoqueraViewer } from './fordoquera-embed.js';
import { render, renderPanel, showStatus } from '../main.js';

  // Selector de Ámbito reusado en Mensaje (día real), Departamentos (day===null)
  // y Recursos (day==='RESOURCES') — nunca en Info general, que no lo usa.
  // Un admin puede tildar cualquier combinación de secciones/departamentos (en
  // Departamentos, sin la opción de secciones — sigue siendo contenido
  // exclusivo de departamentos); un jefe de sección o de departamento sigue
  // fijo a su propio grupo (sin poder elegir otros), pero también puede tildar
  // "Todos los comandos" para ampliar el alcance de esa entrada puntual.
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
    // viendo, sigue diciendo "Todos los comandos".
    var comandoGeneralLabel = isDeptosTab ? 'General' : 'Todos los comandos';
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


  // Borrador del formulario de "Agregar entrada" (título, ámbito, etc.) — se
  // resetea entero en varios puntos (cerrar, cancelar, después de guardar, y
  // antes de abrir uno nuevo vía un hueco "+" entre entradas), así que vive en
  // una sola función en vez de repetir la misma lista larga de asignaciones.
  function resetFormDraftState(){
    AppState.editingEntryId = null;
    AppState.formSecciones = []; AppState.formDeptos = []; AppState.formComandoGeneral = false; AppState.formSeccionComandoOnly = false;
    AppState.formAnonimo = false; AppState.formOculta = false; AppState.formBienvenida = false;
    AppState.formTitleDraft = null;
    AppState.insertOrderCreatedAt = null; AppState.insertOrderNote = '';
  }


  export function renderForm(day){
    var editing = AppState.editingEntryId ? AppState.state.entries.find(function(e){ return e.id === AppState.editingEntryId; }) : null;
    var html = '<div class="add-form' + (AppState.formOpen ? ' open' : '') + '" id="addForm">';
    if(!editing && AppState.insertOrderNote){
      html += '  <p class="mandos-sub insert-order-note">📍 ' + escapeHtml(AppState.insertOrderNote) + '</p>';
    }
    var titleVal = AppState.formTitleDraft !== null ? AppState.formTitleDraft : (editing ? editing.title : '');
    var titlePlaceholder = day === 'INFO_GENERAL' ? 'Ej: Lugar de campamento' : 'Ej: La virtud de la fortaleza';
    html += '  <div class="form-row"><label>Título</label><input type="text" id="fTitle" placeholder="' + escapeHtml(titlePlaceholder) + '" value="' + escapeHtml(titleVal) + '"></div>';

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
    // sentido en Recursos; solo el admin la ve/toca (pedido del usuario,
    // 24/09/2026).
    if(day === 'RESOURCES' && isAdmin()){
      html += '  <div class="signature-row"><label><input type="checkbox" id="fBienvenida"' + (AppState.formBienvenida ? ' checked' : '') + '> Entrada de bienvenida (aparece arriba de todo en Inicio para quien todavía no la completó — comando y milicianos por igual)</label></div>';
    }
    html += '  <div class="form-actions">';
    if(editing){
      var stepCount = entryToEspacio(editing).steps.length;
      html += '    <button class="btn" id="saveEntryBtn" type="button">Guardar cambios</button>';
      html += '    <button class="btn" id="openFordoqueraBtn" type="button">📝 Editar contenido (' + stepCount + ' paso' + (stepCount === 1 ? '' : 's') + ')</button>';
    } else {
      html += '    <button class="btn" id="saveEntryBtn" type="button">Crear entrada y abrir editor</button>';
    }
    html += '    <button class="btn ghost" id="cancelFormBtn" type="button">Cancelar</button>';
    html += '  </div>';
    html += '  <div class="status-msg" id="statusMsg"></div>';
    html += '</div>';
    return html;
  }


  // Guarda solo los metadatos de plataforma (título de respaldo, ámbito,
  // anónimo, oculta, bienvenida) — nunca toca `entry.espacio` (el contenido
  // real, que entra y sale exclusivamente por la Fordoquera incrustada).
  // Devuelve el id de la entrada (creada o editada), o `null` si algo falló
  // (y ya mostró el mensaje de error correspondiente).
  function saveEntryMetadata(day){
    var title = document.getElementById('fTitle').value.trim();
    if(!title){ showStatus('Poné un título antes de continuar.'); return null; }

    var comandoGeneral = (day === 'INFO_GENERAL') ? false : AppState.formComandoGeneral;
    var editingEntryNow = AppState.editingEntryId ? AppState.state.entries.find(function(e){ return e.id === AppState.editingEntryId; }) : null;

    var secciones, deptos;
    if(day === 'INFO_GENERAL'){
      secciones = []; deptos = [];
    } else if(isAdmin()){
      secciones = (day === null) ? [] : AppState.formSecciones.slice();
      deptos = AppState.formDeptos.slice();
    } else if(comandoGeneral){
      // Si tildó "Todos los comandos", no hace falta ADEMÁS su propio grupo —
      // alcanza con el flag general (antes quedaban los dos, mostrando dos
      // tags donde debía verse solo el más general — bug reportado por el
      // usuario 10/10/2026).
      secciones = []; deptos = [];
    } else if(editingEntryNow){
      // No-admin editando una entrada EXISTENTE: nunca re-scopea sola la
      // entrada al propio grupo del editor — preserva el ámbito que ya
      // tenía (bug reportado por el usuario 10/10/2026: "cualquier jefe
      // puede editar cualquier entrada... al guardarla esa entrada cambia
      // de tag escuderos>comunicaciones"). El único control de ámbito que
      // un no-admin tiene al editar es el checkbox "Todos los comandos"
      // (ya resuelto arriba) — nunca puede elegir OTRO grupo puntual.
      var existingScope = entryScope(editingEntryNow);
      secciones = existingScope.secciones.slice();
      deptos = existingScope.deptos.slice();
    } else if(isJefeSeccion() && effectiveDepto() && !effectiveSeccion()){
      secciones = []; deptos = [effectiveDepto()];
    } else {
      secciones = effectiveSeccion() ? [effectiveSeccion()] : []; deptos = [];
    }
    var seccionComandoOnly = (day === 'RESOURCES') ? AppState.formSeccionComandoOnly : false;

    var allowed;
    if(day === 'RESOURCES'){
      allowed = canCreateRecurso();
    } else if(day === 'INFO_GENERAL'){
      allowed = canCreateInfoGeneral();
    } else if(day === null){
      // "Departamentos": nunca General/Sección — siempre al menos un depto
      // puntual, o "todo el comando".
      if(deptos.length === 0 && !comandoGeneral){ showStatus('Elegí al menos un departamento (o tildá "General").'); return null; }
      allowed = isAdmin() || (isJefeSeccionEditing() && !!effectiveDepto());
    } else {
      allowed = isAdmin() || isJefeSeccionEditing();
    }
    if(!allowed){ showStatus('No tenés permiso para publicar ahí.'); return null; }

    var anonimo = AppState.formAnonimo;
    var author = anonimo ? '' : AppState.currentUser.displayName;
    // Grupo del autor — el dato que alimenta "el circulito" (feedback de
    // Comunicaciones, 09/10/2026). Usa la identidad EFECTIVA (respeta "Ver
    // como"), no la real — mismo criterio que ya usa el propio picker de
    // Ámbito (`effectiveSeccion()`/`effectiveDepto()`) para mostrar el grupo
    // fijo de quien publica: si un admin está simulando ser jefe de
    // Comunicaciones y crea una entrada ahí, el círculo tiene que decir "CO",
    // no "FD" — antes usaba siempre la identidad real, así que cualquier
    // entrada creada simulando un rol quedaba con el círculo de admin (bug
    // reportado por el usuario 10/10/2026: "sigue apareciendo el globo que
    // dice FD... no deberían aparecer sus respectivas letras").
    var authorGrupo = isAdmin()
      ? 'FORDOC'
      : (effectiveSeccion() || effectiveDepto() || '');
    var bienvenida = (day === 'RESOURCES') ? AppState.formBienvenida : false;

    if(AppState.editingEntryId){
      var entry = AppState.state.entries.find(function(e){ return e.id === AppState.editingEntryId; });
      if(!entry || !canEditEntry(entry)){ showStatus('No tenés permiso para editar esta entrada.'); return null; }
      entry.title = title;
      entry.author = author; entry.anonimo = anonimo;
      entry.authorReal = entry.authorReal || AppState.currentUser.displayName;
      entry.authorGrupo = entry.authorGrupo || authorGrupo;
      entry.secciones = secciones; entry.deptos = deptos; entry.comandoGeneral = comandoGeneral;
      entry.seccionesComandoOnly = seccionComandoOnly;
      entry.oculta = AppState.formOculta;
      entry.bienvenida = bienvenida;
      // Si el espacio ya tiene su propio título (puesto desde la Fordoquera),
      // lo sincronizamos también para que no queden desalineados.
      if(entry.espacio) entry.espacio.title = title;
      save();
      return entry.id;
    } else {
      var dayIdVal = (day && typeof day === 'object') ? day.id : (day || null);
      // "+" flotante entre entradas (08/10/2026): si el form se abrió desde
      // ahí, `insertOrderCreatedAt` ya trae el valor calculado a mitad de
      // camino entre las dos entradas vecinas — si no, se agrega al final
      // como siempre (`Date.now()`).
      var newCreatedAt = AppState.insertOrderCreatedAt != null ? AppState.insertOrderCreatedAt : Date.now();
      var id = uid();
      AppState.state.entries.push({
        id: id, dayId: dayIdVal, title: title, author: author, anonimo: anonimo,
        authorReal: AppState.currentUser.displayName, authorGrupo: authorGrupo,
        secciones: secciones, deptos: deptos, comandoGeneral: comandoGeneral, seccionesComandoOnly: seccionComandoOnly,
        oculta: AppState.formOculta, bienvenida: bienvenida, espacio: null, createdAt: newCreatedAt
      });
      save();
      return id;
    }
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

    var fTitleInput = document.getElementById('fTitle');
    if(fTitleInput){ fTitleInput.oninput = function(e){ AppState.formTitleDraft = e.target.value; }; }

    // Checkboxes del selector de Ámbito — tildar uno no necesita revelar/
    // ocultar nada más, así que no hace falta re-render acá (el checkbox ya
    // se mantiene tildado solo, es un <input> nativo).
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

    // "Guardar cambios" (entrada existente) / "Crear entrada y abrir editor"
    // (entrada nueva) — nunca toca el contenido (`espacio`): eso vive
    // exclusivamente del lado de la Fordoquera incrustada.
    var saveBtn = document.getElementById('saveEntryBtn');
    if(saveBtn){
      saveBtn.onclick = function(){
        var wasEditing = !!AppState.editingEntryId;
        var id = saveEntryMetadata(day);
        if(!id) return;
        if(wasEditing){
          AppState.formOpen = false;
          resetFormDraftState();
          render();
        } else {
          // Entrada recién creada, sin contenido todavía — queda en modo
          // edición (mismo criterio que una entrada ya existente, en vez de
          // cerrar el formulario) y se abre de una el editor de la
          // Fordoquera: al volver, el formulario de metadatos sigue abierto
          // con "Guardar cambios" disponible (bug reportado por el usuario
          // 10/10/2026 — "al cerrar el editor de la fordoquera se cierra la
          // edición general, debería volver a la edición para poder
          // guardarlo apretando guardar").
          AppState.editingEntryId = id;
          renderPanel();
          openFordoqueraEditor(id);
        }
      };
    }

    // "📝 Editar contenido" (solo visible editando una entrada existente) —
    // guarda los metadatos tocados hasta ahora (por si se cambió el Ámbito,
    // por ejemplo) y abre el editor de la Fordoquera — sin cerrar este
    // formulario: al volver del editor (`onClose` llama a `renderPanel()`),
    // el formulario de metadatos sigue abierto con el contador de pasos ya
    // actualizado.
    var openFordoqueraBtn = document.getElementById('openFordoqueraBtn');
    if(openFordoqueraBtn){
      openFordoqueraBtn.onclick = function(){
        var id = saveEntryMetadata(day);
        if(!id) return;
        openFordoqueraEditor(id);
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

    // "Ver" — abre la entrada en modo presentación (de solo lectura), 100%
    // igual que "la fordoquera" porque literalmente es ella, embebida.
    document.querySelectorAll('[data-action="view"]').forEach(function(btn){
      btn.onclick = function(){ openFordoqueraViewer(btn.getAttribute('data-id')); };
    });

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
        AppState.formTitleDraft = null;
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
  }
