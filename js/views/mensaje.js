// Los 3 paneles de contenido ligados (o no) a un día de campamento:
// "Departamentos" (coordinación interna, sin día), "Recursos" (para
// todos, sin día), y "Mensaje" (el camino formativo día por día, con el
// bloque de consignas en la cabecera).

import { AppState } from '../app-state.js';
import { SECCIONES, RECURSO_CATEGORIAS } from '../config/constants.js';
import { escapeHtml, linkify, dayDateToIso, compareEntryOrder, recursoCategoriaDe } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';
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
    }).sort(compareEntryOrder);
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
    // Orden ascendente, igual que "Mensaje"/"Departamentos" (08/10/2026).
    var items = AppState.state.entries.filter(function(e){ return e.dayId === 'RESOURCES' && canSeeEntry(e); })
      .sort(compareEntryOrder);
    var canAddHere = canCreateRecurso();

    // Categorías (27/10/2026): sin categoría abierta se ve la grilla; al
    // tocar una, la lista de sus entradas como tarjetas anchas.
    var porCat = {};
    items.forEach(function(e){ var c = recursoCategoriaDe(e); (porCat[c] = porCat[c] || []).push(e); });
    var cat = RECURSO_CATEGORIAS.find(function(c){ return c.id === AppState.recursosCategoria; });
    if(cat && !canAddHere && !porCat[cat.id]){ cat = null; }
    AppState.recursosCategoria = cat ? cat.id : '';

    var html = '';
    if(!cat){
      html += '<div class="panel-head"><div><h2>Recursos</h2>';
      html += '<p class="mandos-sub">Citas bíblicas, textos, imágenes, oraciones y misterios del Rosario para todo el campamento.</p></div></div>';
      // Quien puede agregar ve todas las categorías (para cargar en una
      // vacía); el resto, solo las que tienen algo.
      var cats = RECURSO_CATEGORIAS.filter(function(c){ return canAddHere || porCat[c.id]; });
      if(cats.length === 0){
        html += '<p class="empty">Todavía no hay recursos cargados.</p>';
      } else {
        html += '<div class="recursos-grid">';
        cats.forEach(function(c){
          // Las ocultas no cuentan como contenido: una categoría con solo
          // ocultas se ve transparente, igual que una vacía.
          var lista = porCat[c.id] || [];
          var ocultas = lista.filter(function(e){ return e.oculta; }).length;
          var n = lista.length - ocultas;
          var countTxt = n ? (n + ' entrada' + (n === 1 ? '' : 's')) : (ocultas ? '' : 'Vacía');
          if(ocultas){ countTxt += (n ? ' · ' : '') + ocultas + ' oculta' + (ocultas === 1 ? '' : 's'); }
          html += '<button type="button" class="recurso-cat' + (n ? '' : ' recurso-cat-empty') + '" data-recurso-cat="' + c.id + '">' +
            '<span class="recurso-cat-icon">' + icon(c.icon) + '</span>' +
            '<span class="recurso-cat-label">' + escapeHtml(c.label) + '</span>' +
            '<span class="recurso-cat-count">' + countTxt + '</span>' +
            '</button>';
        });
        html += '</div>';
      }
      panel.innerHTML = html;
    } else {
      var catItems = porCat[cat.id] || [];
      html += '<button type="button" class="recursos-back" id="recursosBackBtn">' + icon('chevron-left') + ' Recursos</button>';
      html += '<div class="panel-head"><div><h2>' + escapeHtml(cat.label) + '</h2></div>';
      if(canAddHere){
        html += '<button class="btn small" id="toggleFormBtn" type="button">' + (AppState.formOpen ? 'Cerrar' : '+ Agregar entrada') + '</button>';
      }
      html += '</div>';
      html += '<div class="entries">';
      if(catItems.length === 0){
        html += '<p class="empty">Todavía no hay nada en esta categoría.</p>';
      } else {
        html += renderEntriesListHtml(catItems, canAddHere, cat.icon);
      }
      html += '</div>';
      if(canAddHere){ html += renderForm('RESOURCES'); }
      panel.innerHTML = html;
      attachPanelEvents('RESOURCES');
    }

    panel.querySelectorAll('[data-recurso-cat]').forEach(function(btn){
      btn.onclick = function(){
        AppState.recursosCategoria = btn.getAttribute('data-recurso-cat');
        panel.scrollTop = 0; window.scrollTo(0, 0);
        renderPanel();
      };
    });
    var back = document.getElementById('recursosBackBtn');
    if(back){
      back.onclick = function(){
        AppState.recursosCategoria = '';
        AppState.formOpen = false;
        AppState.editingEntryId = null;
        AppState.formCategoria = '';
        renderPanel();
      };
    }
  }


  // "Mensaje": un solo lugar en el sidebar, con un selector dinámico (pills)
  // para elegir qué día ver, en vez de una pestaña por día que se abre y colapsa.
  // Bloque de consignas del día en la cabecera de "Mensaje" — qué se ve depende
  // del rol: admin ve/edita las 4 secciones; un jefe de sección solo ve/edita la
  // suya; un jefe de departamento (coordina, sin sección propia) ve de solo
  // lectura las que estén cargadas; un lector (miliciano) solo ve la de su
  // propia sección, destacada, si está cargada — nada para un lector General o
  // sin sección (no hay ninguna consigna que le corresponda).
  // Bloques editables de consignas y cita, plegables (27/10/2026): cerrados
  // por default, y se recuerda si están abiertos entre re-renders.
  function foldOpen(key, cls, summaryHtml){
    var open = AppState.mensajeFold && AppState.mensajeFold[key];
    return '<details class="' + cls + ' mensaje-fold" data-fold="' + key + '"' + (open ? ' open' : '') + '>' +
      '<summary class="mensaje-fold-summary">' + summaryHtml + '<span class="mensaje-fold-chev" aria-hidden="true">' + icon('chevron-right') + '</span></summary>' +
      '<div class="mensaje-fold-body">';
  }

  export function renderConsignasBlock(day){
    var consignas = day.consignas || {};
    var html = '';
    if(isAdmin()){
      var nCargadas = SECCIONES.filter(function(s){ return consignas[s]; }).length;
      html += foldOpen('consignas', 'consignas-box', '<span class="consignas-title">Consignas por sección</span><span class="mensaje-fold-hint">' + nCargadas + '/' + SECCIONES.length + ' cargadas</span>');
      SECCIONES.forEach(function(s){
        html += '<div class="consignas-row"><span class="consignas-seccion">' + escapeHtml(s) + '</span><input type="text" class="consignaInput" data-seccion="' + escapeHtml(s) + '" placeholder="Sin consigna" value="' + escapeHtml(consignas[s] || '') + '"></div>';
      });
      html += '</div></details>';
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
      html += foldOpen('consignas', 'consignas-box', '<span class="consignas-title">Consigna de ' + escapeHtml(mySeccion) + ' para hoy</span><span class="mensaje-fold-hint">' + (consignas[mySeccion] ? 'Cargada' : 'Sin cargar') + '</span>');
      html += '<input type="text" class="consignaInput" data-seccion="' + escapeHtml(mySeccion) + '" placeholder="Escribí la consigna del día..." value="' + escapeHtml(consignas[mySeccion] || '') + '">';
      html += '</div></details>';
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
      .sort(compareEntryOrder);
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
      // Selector de fecha nativo (19/10/2026) en vez de texto libre — ver
      // dayDateToIso()/isoToDayDate() en helpers.js. Si la fecha vieja era un
      // texto que no se puede leer como fecha, se muestra al lado para no
      // perderla de vista hasta que se elija una nueva.
      var dateIso = dayDateToIso(day.date);
      html += '      <input type="date" id="dayDateInput" aria-label="Fecha del día" value="' + dateIso + '">';
      if(day.date && !dateIso){ html += '      <span class="day-date-legacy">' + escapeHtml(day.date) + '</span>'; }
      html += '    </div>';
    } else {
      html += '    <h2 class="day-title">' + escapeHtml(day.label) + '</h2>';
      if(day.date){ html += '    <div class="day-meta"><span>' + escapeHtml(day.date) + '</span></div>'; }
    }
    html += '  </div>';
    // "Eliminar día" pasó de botón con texto, pegado a la fecha, a un ícono
    // de tacho en la esquina superior derecha de la cabecera (19/10/2026).
    if(canEditStructure()){
      html += '  <button class="day-delete-btn" id="deleteDayBtn" type="button" title="Eliminar día" aria-label="Eliminar día">' + icon('trash') + '</button>';
    }
    html += '</div>';

    html += renderConsignasBlock(day);

    // La cita bíblica admite el mismo markdown liviano que el resto del
    // sitio (**negrita**/*cursiva*, linkify()) — pedido del usuario,
    // 09/10/2026: "solo dejaría en negrita las palabras clave", en vez de
    // que el texto entero lea con el mismo peso. Editable solo por quien
    // puede tocar la estructura del día (mismo gate que label/fecha).
    if(canEditStructure()){
      html += foldOpen('cita', 'cita-banner cita-banner-edit', '<span class="cita-edit-label">Cita bíblica</span><span class="mensaje-fold-hint">' + escapeHtml(day.citaRef || (day.citaTexto ? 'Cargada' : 'Sin cargar')) + '</span>');
      // La ayuda de formato vive detrás de un ícono ℹ (19/10/2026) — un
      // <details> se abre con un toque, también en el celular (un `title`
      // no se ve sin mouse).
      html += '  <div class="cita-edit-head"><label class="cita-edit-label" for="dayCitaTextoInput">Texto</label>';
      html += '    <details class="md-hint"><summary title="Formato" aria-label="Ayuda de formato">' + icon('info') + '</summary><div class="md-hint-body">Escribí <code>**palabra**</code> para que salga en <strong>negrita</strong>, y <code>*palabra*</code> para <em>cursiva</em>.</div></details></div>';
      html += '  <textarea id="dayCitaTextoInput" class="cita-edit-textarea" rows="2" placeholder="Texto de la cita...">' + escapeHtml(day.citaTexto || '') + '</textarea>';
      html += '  <input type="text" id="dayCitaRefInput" class="cita-ref-input" placeholder="Referencia (ej: Gálatas 4, 4-7)" value="' + escapeHtml(day.citaRef || '') + '">';
      if(day.citaTexto){
        html += '  <div class="cita-banner-preview"><div class="cita-preview-label">Vista previa</div><p class="cita-text">«' + linkify(day.citaTexto) + '»</p><p class="cita-ref">' + escapeHtml(day.citaRef||'') + '</p></div>';
      }
      html += '</div></details>';
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
