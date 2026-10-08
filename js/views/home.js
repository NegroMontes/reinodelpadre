// Pantalla de Inicio: cuenta regresiva, la cita destacada del día, el
// resumen de ejes, la sección "Entrada de bienvenida" y "Info general"
// (integrada adentro de Inicio desde el 23/09/2026).

import { AppState } from '../app-state.js';
import { CAMP_DURATION_DAYS } from '../config/constants.js';
import { escapeHtml } from '../utils/helpers.js';
import { canEditStructure, canSeeEntry, canCreateInfoGeneral } from '../services/permissions.js';
import { save } from '../services/state.service.js';
import { renderEntry, renderEntriesListHtml } from '../components/entry.js';
import { renderForm } from '../components/form.js';
import { showStatus } from '../main.js';

  export function stopCountdownTicker(){
    if(AppState.countdownInterval){ clearInterval(AppState.countdownInterval); AppState.countdownInterval = null; }
  }


  export function startCountdownTicker(){
    stopCountdownTicker();
    updateCountdownDisplay();
    AppState.countdownInterval = setInterval(updateCountdownDisplay, 1000);
  }


  // Devuelve en qué estado está el campamento respecto de "ahora": sin fecha
  // definida, todavía no arrancó (con el desglose días/horas/min/seg), en curso
  // (con el número de día), o ya terminó.
  export function campStatus(){
    if(!AppState.state.campStart){ return { phase:'sinFecha' }; }
    var start = new Date(AppState.state.campStart).getTime();
    if(isNaN(start)){ return { phase:'sinFecha' }; }
    var now = Date.now();
    var end = start + CAMP_DURATION_DAYS * 86400000;
    if(now < start){
      var ms = start - now;
      return {
        phase: 'faltan',
        dias: Math.floor(ms / 86400000),
        horas: Math.floor((ms % 86400000) / 3600000),
        mins: Math.floor((ms % 3600000) / 60000),
        segs: Math.floor((ms % 60000) / 1000)
      };
    }
    if(now < end){
      return { phase:'enCurso', diaNum: Math.floor((now - start) / 86400000) + 1 };
    }
    return { phase:'terminado' };
  }


  export function updateCountdownDisplay(){
    var el = document.getElementById('countdownDisplay');
    if(!el){ stopCountdownTicker(); return; }
    var st = campStatus();
    if(st.phase === 'sinFecha'){
      el.innerHTML = '<p class="mandos-sub">Todavía no se cargó la fecha de inicio.</p>';
    } else if(st.phase === 'faltan'){
      el.innerHTML =
        '<div class="countdown-nums">' +
        '  <div class="countdown-unit"><span class="countdown-n">' + st.dias + '</span><span class="countdown-l">días</span></div>' +
        '  <div class="countdown-unit"><span class="countdown-n">' + String(st.horas).padStart(2,'0') + '</span><span class="countdown-l">hs</span></div>' +
        '  <div class="countdown-unit"><span class="countdown-n">' + String(st.mins).padStart(2,'0') + '</span><span class="countdown-l">min</span></div>' +
        '  <div class="countdown-unit"><span class="countdown-n">' + String(st.segs).padStart(2,'0') + '</span><span class="countdown-l">seg</span></div>' +
        '</div>';
    } else if(st.phase === 'enCurso'){
      el.innerHTML = '<p class="countdown-live">¡Estamos de campamento! Día ' + st.diaNum + '</p>';
    } else {
      el.innerHTML = '<p class="countdown-live">El campamento ya terminó. ¡Gracias por vivirlo! 🙏</p>';
    }
  }


  // Cita destacada: si el campamento está en curso, la del día que corresponde;
  // si no, la del Día 1 como "cita ancla" del camino formativo.
  export function featuredDay(){
    if(!AppState.state.days || !AppState.state.days.length) return null;
    var st = campStatus();
    if(st.phase === 'enCurso' && AppState.state.days[st.diaNum - 1]){
      return { day: AppState.state.days[st.diaNum - 1], label: 'Hoy — Día ' + st.diaNum };
    }
    return { day: AppState.state.days[0], label: null };
  }


  export function computeEjesSummary(){
    var groups = [];
    (AppState.state.days || []).forEach(function(day, i){
      var label = day.ejeCorto || 'Sin eje';
      var g = groups.filter(function(x){ return x.label === label; })[0];
      if(!g){ g = { label: label, dayNums: [] }; groups.push(g); }
      g.dayNums.push(i + 1);
    });
    return groups;
  }


  // "Entrada de bienvenida" (pedido del usuario, 24/09/2026): una entrada
  // Secuencial de Recursos marcada `bienvenida:true` (ver renderForm/día
  // 'RESOURCES') que, mientras la persona todavía no la completó, aparece
  // arriba de todo en "Inicio" — para cualquiera que entre por primera vez,
  // comando y milicianos por igual. Se reusa `renderEntry()` tal cual (con
  // toda su lógica de pasos/navegación/Finalizar) — al completarla
  // (`myProgress[entry.id].completedAt`), deja de aparecer acá y sigue
  // viviendo en Recursos como cualquier otra entrada, sin moverla de lugar
  // de verdad (siempre vivió ahí — esto solo deja de destacarla en Inicio).
  export function renderWelcomeSection(){
    var items = AppState.state.entries.filter(function(e){
      return e.bienvenida && e.type === 'secuencial' && canSeeEntry(e) &&
        !(AppState.myProgress[e.id] && AppState.myProgress[e.id].completedAt);
    });
    if(items.length === 0) return '';
    var html = '<div class="entries welcome-entries">';
    items.forEach(function(entry){ html += renderEntry(entry); });
    html += '</div>';
    return html;
  }


  export function renderHomePanel(){
    var html = '';
    html += '<div class="panel-head"><div><h2>Inicio</h2>';
    html += '<p class="mandos-sub">Campamento Nacional "Reino del Padre" · MDZ 2027</p></div></div>';

    html += renderWelcomeSection();

    html += '<div class="home-grid">';

    html += '  <div class="home-card">';
    html += '    <h3 style="text-align:center">Cuenta regresiva</h3>';
    html += '    <div id="countdownDisplay"></div>';
    if(canEditStructure()){
      html += '    <div class="form-row" style="margin-top:12px">';
      html += '      <label>' + (AppState.state.campStart ? 'Corregir fecha y hora de inicio' : 'Fecha y hora de inicio del campamento') + '</label>';
      html += '      <input type="datetime-local" id="campStartInput" value="' + escapeHtml(AppState.state.campStart || '') + '">';
      html += '    </div>';
      html += '    <button class="btn small" id="campStartSaveBtn" type="button" style="margin-top:6px">Guardar fecha</button>';
    }
    html += '  </div>';

    var feat = featuredDay();
    if(feat){
      html += '  <div class="home-card">';
      if(feat.label){ html += '    <h3>' + escapeHtml(feat.label) + '</h3>'; }
      if(feat.day.ejeCorto){ html += '    <div class="eje-badge">' + escapeHtml(feat.day.ejeCorto) + '</div>'; }
      html += '    <div class="cita-banner" style="margin-top:10px"><p class="cita-text">«' + escapeHtml(feat.day.citaTexto || '') + '»</p>';
      if(feat.day.citaRef){ html += '<p class="cita-ref">' + escapeHtml(feat.day.citaRef) + '</p>'; }
      html += '    </div>';
      html += '  </div>';
    }

    html += '</div>'; // .home-grid

    var ejes = computeEjesSummary();
    if(ejes.length){
      html += '<h3 class="mandos-group-title">Los ejes del camino</h3>';
      html += '<div class="home-ejes-grid">';
      ejes.forEach(function(g){
        var nums = g.dayNums;
        var rango = nums.length > 1 ? ('Días ' + nums[0] + '–' + nums[nums.length-1]) : ('Día ' + nums[0]);
        html += '  <div class="eje-card"><div class="eje-badge">' + escapeHtml(g.label) + '</div><p class="mandos-sub" style="margin:6px 0 0">' + rango + '</p></div>';
      });
      html += '</div>';
    }

    // "Ir directo a..." (accesos rápidos) se sacó de acá (pedido del usuario,
    // 22/09/2026) — cada pestaña sigue accesible desde el sidebar como
    // siempre, no hacía falta el atajo. En su lugar, Info general se integró
    // directo en Inicio, para que lo que se vaya cargando ahí se encuentre en
    // la página de entrada.
    html += renderInfoGeneralSection();

    return html;
  }


  // "Info general": mapa, fotos y videos del lugar, info general (fecha, etc.)
  // — mismo patrón que "Recursos" (entradas con dayId sentinel 'INFO_GENERAL'),
  // pero solo Logística (+ admin) puede cargar/editar, según pidió el doc de
  // specs. Integrada adentro de "Inicio" (22/09/2026, antes era pestaña
  // propia) — así lo que se vaya agregando ahí aparece en la página de
  // entrada en vez de quedar escondido en una pestaña aparte.
  export function renderInfoGeneralSection(){
    // Orden ascendente, igual que el resto de los paneles con entradas
    // (08/10/2026) — el botón "+ Agregar entrada" queda debajo de todo.
    var items = AppState.state.entries.filter(function(e){ return e.dayId === 'INFO_GENERAL' && canSeeEntry(e); })
      .sort(function(a,b){ return a.createdAt - b.createdAt; });
    var canAddHere = canCreateInfoGeneral();

    var html = '<h3 class="mandos-group-title">Info general</h3>';
    html += '<p class="mandos-sub">Mapa, fotos y videos del lugar, y demás info general del campamento.</p>';

    html += '<div class="entries">';
    if(items.length === 0){
      html += '<p class="empty">Todavía no hay info general cargada.</p>';
    } else {
      html += renderEntriesListHtml(items, canAddHere);
    }
    html += '</div>';

    // Botón "+ Agregar entrada" (renombrado y movido debajo de la lista,
    // 08/10/2026, pedido del usuario) — "Importar desde Encuentros" se movió
    // adentro del formulario (ver renderForm()).
    if(canAddHere){
      html += '<div class="panel-head add-entry-row"><div></div><button class="btn small" id="toggleFormBtn" type="button">' + (AppState.formOpen ? 'Cerrar' : '+ Agregar entrada') + '</button></div>';
      html += renderForm('INFO_GENERAL');
    }

    return html;
  }


  export function attachHomeEvents(){
    // Los botones de "Ir directo a..." se sacaron de Inicio (pedido del
    // usuario, 22/09/2026) — ya no hace falta escuchar `[data-goto]`/
    // `[data-goto-day]` acá.
    var saveBtn = document.getElementById('campStartSaveBtn');
    if(saveBtn){
      saveBtn.onclick = function(){
        if(!canEditStructure()) return;
        var val = document.getElementById('campStartInput').value;
        AppState.state.campStart = val || '';
        save();
        updateCountdownDisplay();
        showStatus(val ? 'Fecha del campamento guardada.' : 'Fecha del campamento borrada.');
      };
    }
  }
