// Los 3 paneles de contenido ligados (o no) a un día de campamento:
// "Departamentos" (coordinación interna, sin día), "Recursos" (para
// todos, sin día), y "Mensaje" (el camino formativo día por día, con el
// bloque de consignas en la cabecera).

import { AppState } from '../app-state.js';
import { SECCIONES } from '../config/constants.js';
import { escapeHtml, linkify } from '../utils/helpers.js';
import { entryScope, canSeeEntry, isAdmin, isJefeSeccionEditing, isJefeSeccion, effectiveDepto, effectiveSeccion, effectiveRole, lectorModeActive, isLectorLike, canEditStructure, canCreateRecurso } from '../services/permissions.js';
import { addDay } from '../services/state.service.js';
import { renderEntriesListHtml } from '../components/entry.js';
import { renderForm, attachPanelEvents } from '../components/form.js';
import { renderPanel } from '../main.js';

  // "Departamentos": contenido de coordinación interna del comando que NO está
  // ligado a ningún día de campamento (instructivos, avisos internos, etc.) —
  // por eso no vive adentro de "Mensaje". Si un departamento quiere hacer una
  // reflexión sobre un día puntual, esa sí va en "Mensaje" (con Ámbito = ese
  // departamento), porque ahí sí corresponde que aparezca ligada al día.
  export function renderDepartamentosPanel(){
    var panel = document.getElementById('panel');
    // Orden ascendente (más antigua primero), igual que "Mensaje" (22/09/2026)
    // — así el botón "+ Agregar entrada", ahora debajo de todo (08/10/2026,
    // pedido del usuario), queda justo donde cae cualquier entrada nueva que
    // se agregue sin elegir una posición puntual.
    var allDeptoEntries = AppState.state.entries.filter(function(e){
      if(e.dayId) return false;
      var scope = entryScope(e);
      return (scope.deptos.length > 0 || scope.comandoGeneral) && canSeeEntry(e);
    }).sort(function(a,b){ return a.createdAt - b.createdAt; });
    var visibleDeptos = [];
    allDeptoEntries.forEach(function(e){
      entryScope(e).deptos.forEach(function(d){ if(visibleDeptos.indexOf(d) === -1){ visibleDeptos.push(d); } });
    });
    if(visibleDeptos.indexOf(AppState.activeDeptoFiltro) === -1){ AppState.activeDeptoFiltro = ''; }

    var shown = AppState.activeDeptoFiltro ? allDeptoEntries.filter(function(e){ return entryScope(e).deptos.indexOf(AppState.activeDeptoFiltro) !== -1; }) : allDeptoEntries;
    var canAddHere = isAdmin() || (isJefeSeccionEditing() && !!effectiveDepto());

    var html = '';
    html += '<div class="panel-head"><div><h2>Departamentos</h2></div></div>';

    if(visibleDeptos.length > 1){
      html += '<div class="mensaje-dayswitch">';
      html += '  <button class="day-pill' + (AppState.activeDeptoFiltro==='' ? ' active' : '') + '" data-depto-filtro="" type="button">Todos</button>';
      visibleDeptos.forEach(function(d){
        html += '  <button class="day-pill' + (AppState.activeDeptoFiltro===d ? ' active' : '') + '" data-depto-filtro="' + escapeHtml(d) + '" type="button">' + escapeHtml(d) + '</button>';
      });
      html += '</div>';
    }

    html += '<div class="entries">';
    if(shown.length === 0){
      html += '<p class="empty">' + (allDeptoEntries.length === 0 ? 'Todavía no hay contenido de departamentos.' : 'No hay contenido de ese departamento.') + '</p>';
    } else {
      html += renderEntriesListHtml(shown, canAddHere);
    }
    html += '</div>';

    // Botón "+ Agregar entrada" (renombrado y movido debajo de la lista,
    // 08/10/2026, pedido del usuario) — el "Importar desde Encuentros" que
    // antes vivía al lado se movió ADENTRO del formulario (ver renderForm()).
    if(canAddHere){
      html += '<div class="panel-head add-entry-row"><div></div><button class="btn small" id="toggleFormBtn" type="button">' + (AppState.formOpen ? 'Cerrar' : '+ Agregar entrada') + '</button></div>';
      html += renderForm(null);
    }

    panel.innerHTML = html;
    attachPanelEvents(null);

    document.querySelectorAll('[data-depto-filtro]').forEach(function(btn){
      btn.onclick = function(){
        AppState.activeDeptoFiltro = btn.getAttribute('data-depto-filtro');
        renderPanel();
      };
    });
  }


  // "Recursos": citas bíblicas, textos, imágenes, oraciones, etc. — a diferencia
  // de "Departamentos", es contenido para todo el mundo (comando y, a futuro,
  // milicianos), así que no hay filtro de visibilidad más allá de estar logueado.
  // Se guarda como entradas con dayId sentinel 'RESOURCES' (sin seccion/depto).
  export function renderRecursosPanel(){
    var panel = document.getElementById('panel');
    // Orden ascendente, igual que "Mensaje"/"Departamentos" (08/10/2026) —
    // el botón "+ Agregar entrada" queda debajo de todo, así que una entrada
    // nueva (sin posición elegida) tiene que aparecer ahí, no saltar arriba.
    var items = AppState.state.entries.filter(function(e){ return e.dayId === 'RESOURCES' && canSeeEntry(e); })
      .sort(function(a,b){ return a.createdAt - b.createdAt; });
    var canAddHere = canCreateRecurso();

    var html = '';
    html += '<div class="panel-head"><div><h2>Recursos</h2>';
    html += '<p class="mandos-sub">Citas bíblicas, textos, imágenes y oraciones para todo el campamento.</p></div></div>';

    html += '<div class="entries">';
    if(items.length === 0){
      html += '<p class="empty">Todavía no hay recursos cargados.</p>';
    } else {
      html += renderEntriesListHtml(items, canAddHere);
    }
    html += '</div>';

    if(canAddHere){
      html += '<div class="panel-head add-entry-row"><div></div><button class="btn small" id="toggleFormBtn" type="button">' + (AppState.formOpen ? 'Cerrar' : '+ Agregar entrada') + '</button></div>';
      html += renderForm('RESOURCES');
    }

    panel.innerHTML = html;
    attachPanelEvents('RESOURCES');
  }


  // "Mensaje": un solo lugar en el sidebar, con un selector dinámico (pills)
  // para elegir qué día ver, en vez de una pestaña por día que se abre y colapsa.
  // Bloque de consignas del día en la cabecera de "Mensaje" — qué se ve depende
  // del rol: admin ve/edita las 4 secciones; un jefe de sección solo ve/edita la
  // suya; un jefe de departamento (coordina, sin sección propia) ve de solo
  // lectura las que estén cargadas; un lector (miliciano) solo ve la de su
  // propia sección, destacada, si está cargada — nada para un lector General o
  // sin sección (no hay ninguna consigna que le corresponda).
  export function renderConsignasBlock(day){
    var consignas = day.consignas || {};
    var html = '';
    if(isAdmin()){
      html += '<div class="consignas-box"><p class="consignas-title">Consignas por sección</p>';
      SECCIONES.forEach(function(s){
        html += '<div class="consignas-row"><span class="consignas-seccion">' + escapeHtml(s) + '</span><input type="text" class="consignaInput" data-seccion="' + escapeHtml(s) + '" placeholder="Sin consigna" value="' + escapeHtml(consignas[s] || '') + '"></div>';
      });
      html += '</div>';
    } else if(lectorModeActive()){
      // Modo "Lector" (25/09/2026): ve TODAS las consignas cargadas, de solo
      // lectura — mismo bloque que ya veía un jefe de departamento, ahora
      // también para cualquier comando (jefe de sección/subjefe/consagrado)
      // que active el toggle, sin importar su ámbito real.
      var cargadasLector = SECCIONES.filter(function(s){ return consignas[s]; });
      if(cargadasLector.length){
        html += '<div class="consignas-box"><p class="consignas-title">Consignas del día</p>';
        cargadasLector.forEach(function(s){ html += '<p class="consignas-readonly"><strong>' + escapeHtml(s) + ':</strong> ' + escapeHtml(consignas[s]) + '</p>'; });
        html += '</div>';
      }
    } else if(isJefeSeccion() && !effectiveDepto() && effectiveSeccion()){
      var mySeccion = effectiveSeccion();
      html += '<div class="consignas-box"><p class="consignas-title">Consigna de ' + escapeHtml(mySeccion) + ' para hoy</p>';
      html += '<input type="text" class="consignaInput" data-seccion="' + escapeHtml(mySeccion) + '" placeholder="Escribí la consigna del día..." value="' + escapeHtml(consignas[mySeccion] || '') + '">';
      html += '</div>';
    } else if(isJefeSeccion()){
      var cargadas = SECCIONES.filter(function(s){ return consignas[s]; });
      if(cargadas.length){
        html += '<div class="consignas-box"><p class="consignas-title">Consignas del día</p>';
        cargadas.forEach(function(s){ html += '<p class="consignas-readonly"><strong>' + escapeHtml(s) + ':</strong> ' + escapeHtml(consignas[s]) + '</p>'; });
        html += '</div>';
      }
    } else if(isLectorLike(effectiveRole()) && effectiveSeccion() && consignas[effectiveSeccion()]){
      html += '<div class="consignas-box consignas-featured"><p class="consignas-title">Consigna del día</p>';
      html += '<p class="consignas-text">' + escapeHtml(consignas[effectiveSeccion()]) + '</p></div>';
    }
    return html;
  }


  export function renderMensajePanel(){
    var panel = document.getElementById('panel');
    if(!AppState.state.days || !AppState.state.days.length){
      panel.innerHTML = '<div class="panel-head"><div><h2>Mensaje</h2></div></div><p class="empty">Todavía no hay días cargados.</p>';
      return;
    }
    if(!AppState.activeMensajeDayId || !AppState.state.days.some(function(d){ return d.id === AppState.activeMensajeDayId; })){
      AppState.activeMensajeDayId = AppState.state.days[0].id;
    }
    var day = AppState.state.days.find(function(d){ return d.id === AppState.activeMensajeDayId; });
    // Orden ascendente (más antigua primero): así el mensaje del día — la
    // reflexión original de cada día, cargada primero — queda siempre arriba,
    // y cualquier entrada nueva que se vaya agregando aparece debajo, en el
    // orden en que se fue creando (pedido del usuario, 22/09/2026).
    var dayEntries = AppState.state.entries.filter(function(e){ return e.dayId === day.id && canSeeEntry(e); })
      .sort(function(a,b){ return a.createdAt - b.createdAt; });
    var canAddHere = isAdmin() || (isJefeSeccionEditing() && (!!effectiveSeccion() || !!effectiveDepto()));

    var html = '';
    html += '<div class="panel-head"><div><h2>Mensaje</h2>';
    html += '<p class="mandos-sub">El camino formativo, día por día.</p></div></div>';

    html += '<div class="mensaje-dayswitch">';
    AppState.state.days.forEach(function(d){
      html += '  <button class="day-pill' + (d.id === day.id ? ' active' : '') + '" data-day="' + d.id + '" type="button">' + escapeHtml(d.label) + '</button>';
    });
    if(canEditStructure()){
      html += '  <button class="day-pill-add" id="mensajeAddDayBtn" title="Agregar día" type="button">+</button>';
    }
    html += '</div>';

    html += '<div class="panel-head">';
    html += '  <div>';
    if(day.ejeCorto){ html += '    <div class="eje-badge">' + escapeHtml(day.ejeCorto) + '</div>'; }
    if(canEditStructure()){
      html += '    <h2 class="day-title" contenteditable="true" id="dayLabelEdit">' + escapeHtml(day.label) + '</h2>';
      html += '    <div class="day-meta">';
      html += '      <input type="text" id="dayDateInput" placeholder="fecha (ej: 8 de enero)" value="' + escapeHtml(day.date) + '">';
      html += '      <button class="btn ghost small" id="deleteDayBtn" type="button">Eliminar día</button>';
      html += '    </div>';
    } else {
      html += '    <h2 class="day-title">' + escapeHtml(day.label) + '</h2>';
      if(day.date){ html += '    <div class="day-meta"><span>' + escapeHtml(day.date) + '</span></div>'; }
    }
    html += '  </div>';
    html += '</div>';

    html += renderConsignasBlock(day);

    // La cita bíblica admite el mismo markdown liviano que el resto del
    // sitio (**negrita**/*cursiva*, linkify()) — pedido del usuario,
    // 09/10/2026: "solo dejaría en negrita las palabras clave", en vez de
    // que el texto entero lea con el mismo peso. Editable solo por quien
    // puede tocar la estructura del día (mismo gate que label/fecha).
    if(canEditStructure()){
      html += '<div class="cita-banner cita-banner-edit">';
      html += '  <label class="cita-edit-label">Cita bíblica — podés usar **negrita** para resaltar palabras clave<textarea id="dayCitaTextoInput" rows="3" placeholder="Texto de la cita...">' + escapeHtml(day.citaTexto || '') + '</textarea></label>';
      html += '  <input type="text" id="dayCitaRefInput" class="cita-ref-input" placeholder="Referencia (ej: Gálatas 4, 4-7)" value="' + escapeHtml(day.citaRef || '') + '">';
      if(day.citaTexto){
        html += '  <div class="cita-banner-preview"><p class="cita-text">«' + linkify(day.citaTexto) + '»</p><p class="cita-ref">' + escapeHtml(day.citaRef||'') + '</p></div>';
      }
      html += '</div>';
    } else if(day.citaTexto){
      html += '<div class="cita-banner"><p class="cita-text">«' + linkify(day.citaTexto) + '»</p><p class="cita-ref">' + escapeHtml(day.citaRef||'') + '</p></div>';
    }

    html += '<div class="entries">';
    if(dayEntries.length === 0){
      html += '<p class="empty">Todavía no hay contenido cargado para este día.</p>';
    } else {
      html += renderEntriesListHtml(dayEntries, canAddHere);
    }
    html += '</div>';

    // Botón "+ Agregar entrada" (renombrado y movido debajo de la lista,
    // 08/10/2026, pedido del usuario) — antes vivía arriba, junto al título
    // del día; "Importar desde Encuentros" se movió adentro del formulario.
    if(canAddHere){
      html += '<div class="panel-head add-entry-row"><div></div><button class="btn small" id="toggleFormBtn" type="button">' + (AppState.formOpen ? 'Cerrar' : '+ Agregar entrada') + '</button></div>';
      html += renderForm(day);
    }

    panel.innerHTML = html;
    attachPanelEvents(day);

    document.querySelectorAll('.day-pill[data-day]').forEach(function(btn){
      btn.onclick = function(){
        AppState.activeMensajeDayId = btn.getAttribute('data-day');
        AppState.formOpen = false;
        renderPanel();
      };
    });
    var addBtn = document.getElementById('mensajeAddDayBtn');
    if(addBtn){ addBtn.onclick = addDay; }

    // Bug reportado por Julian Ahumada (24/09/2026): "cuando elegiste día 8
    // no se ve que está seleccionado". Causa real: `panel.innerHTML = html`
    // (arriba) reconstruye `.mensaje-dayswitch` de cero en cada render, así
    // que su scroll horizontal vuelve a 0 sin importar qué pill haya quedado
    // activa — si esa pill (ej. "Día 8") queda lejos a la derecha, el
    // usuario SÍ eligió bien (la clase `.active` se aplicó), pero la fila
    // vuelve a mostrar el principio y la pill activa queda fuera de vista.
    // Fix: después de cada render, asegurar que la pill activa esté visible
    // DENTRO de su propia fila horizontal — a mano (`scrollLeft`), nunca con
    // `scrollIntoView()`, que ajusta CUALQUIER ancestro scrolleable en el
    // camino, página incluida: como este bloque corre después de CADA
    // render del panel (no solo al cambiar de día), `scrollIntoView` hacía
    // saltar la página entera cada vez que se tocaba cualquier botón de una
    // entrada (editar, colapsar, completar un paso, etc.) si la fila de
    // pills quedaba apenas fuera del viewport — reportado por el usuario,
    // 08/10/2026 ("un pequeño salto hacia arriba y vuelve a bajar").
    var activePill = document.querySelector('.mensaje-dayswitch .day-pill.active');
    var dayswitchEl = activePill && activePill.closest('.mensaje-dayswitch');
    if(dayswitchEl){
      var pillLeft = activePill.offsetLeft, pillRight = pillLeft + activePill.offsetWidth;
      var viewLeft = dayswitchEl.scrollLeft, viewRight = viewLeft + dayswitchEl.clientWidth;
      if(pillLeft < viewLeft){ dayswitchEl.scrollLeft = pillLeft; }
      else if(pillRight > viewRight){ dayswitchEl.scrollLeft = pillRight - dayswitchEl.clientWidth; }
    }
  }
