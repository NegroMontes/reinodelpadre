// Pantalla de Inicio: cuenta regresiva, la cita destacada del día, el
// resumen de ejes, la sección "Entrada de bienvenida" y "Info general"
// (integrada adentro de Inicio desde el 23/09/2026).

import { AppState } from '../app-state.js';
import { CAMP_DURATION_DAYS } from '../config/constants.js';
import { escapeHtml, linkify } from '../utils/helpers.js';
import { canEditStructure, canSeeEntry, canCreateInfoGeneral } from '../services/permissions.js';
import { save } from '../services/state.service.js';
import { renderEntry } from '../components/entry.js';
import { showStatus, renderPanel } from '../main.js';
import { icon } from '../utils/icons.js';

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


  // "Entrada de bienvenida" (pedido del usuario, 24/09/2026): una entrada de
  // Recursos marcada `bienvenida:true` (ver renderForm/día 'RESOURCES') que,
  // mientras la persona todavía no la completó, aparece arriba de todo en
  // "Inicio" — para cualquiera que entre por primera vez, comando y
  // milicianos por igual. Se reusa `renderEntry()` tal cual.
  // ⚠️ Desde "Fordoquera incrustada" (09/10/2026, ver CLAUDE.md): el
  // contenido/progreso de una entrada vive del lado de la Fordoquera (su
  // propio localStorage), que no avisa "completado" por postMessage — así
  // que `myProgress[entry.id].completedAt` solo puede seguir siendo `true`
  // para entradas de bienvenida completadas ANTES de este cambio (formato
  // viejo); una entrada de bienvenida nueva no tiene forma de "desaparecer
  // sola" al completarla, limitación aceptada de usar el protocolo real.
  export function renderWelcomeSection(){
    var items = AppState.state.entries.filter(function(e){
      return e.bienvenida && canSeeEntry(e) &&
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

    // El formulario para corregir la fecha/hora (solo admin) ya no queda a
    // la vista de todo el tiempo — se abre desde un engranaje en la esquina
    // de la tarjeta (19/10/2026, sugerencia de Gemini que pasó el usuario).
    // Ver openCampStartDialog() más abajo.
    html += '  <div class="home-card home-card-countdown">';
    if(canEditStructure()){
      html += '    <button class="home-card-gear" id="campStartGearBtn" type="button" title="' + (AppState.state.campStart ? 'Corregir fecha y hora de inicio' : 'Cargar fecha y hora de inicio') + '" aria-label="Configurar fecha del campamento">' + icon('settings') + '</button>';
    }
    html += '    <h3 style="text-align:center">Cuenta regresiva</h3>';
    html += '    <div id="countdownDisplay"></div>';
    html += '  </div>';

    var feat = featuredDay();
    if(feat){
      html += '  <div class="home-card">';
      if(feat.label){ html += '    <h3>' + escapeHtml(feat.label) + '</h3>'; }
      if(feat.day.ejeCorto){ html += '    <div class="eje-badge">' + escapeHtml(feat.day.ejeCorto) + '</div>'; }
      html += '    <div class="cita-banner" style="margin-top:10px"><p class="cita-text">«' + linkify(feat.day.citaTexto || '') + '»</p>';
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


  // "Info general" (T15, 29/10/2026): bloque fijo a la vista en Inicio —
  // lugar, dirección + mapa, fecha, fotos, qué llevar y notas — editable
  // directo acá (sin abrir la Fordoquera) por quien puede cargar Info general
  // (`canCreateInfoGeneral()`: admin/Secretaría + Logística). Vive en
  // `state.infoGeneral` (mismo doc `fordoc/shared`, sin reglas nuevas). Las
  // entradas con dayId 'INFO_GENERAL' ya no se muestran (pedido del usuario,
  // 29/10/2026); quedan guardadas en Firestore, sin borrar.
  var INFO_FIELDS = ['lugar', 'direccion', 'mapaUrl', 'fecha', 'fotos', 'queLlevar', 'notas'];

  function infoGeneralData(){
    var d = AppState.state.infoGeneral;
    return (d && typeof d === 'object') ? d : {};
  }

  function infoGeneralIsEmpty(d){
    return !INFO_FIELDS.some(function(k){ return (d[k] || '').trim(); });
  }

  // Link de "compartir" de Drive → miniatura embebible (mismo formato que usa
  // la Fordoquera para imágenes subidas). Cualquier otro link queda igual.
  function fotoSrc(url){
    var m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1200' : url;
  }

  function fechaDesdeCampStart(){
    var t = new Date(AppState.state.campStart || '');
    if(isNaN(t.getTime())) return '';
    return t.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  function renderInfoGeneralBlock(canEdit){
    var d = infoGeneralData();
    var html = '<div class="home-card info-general-card">';
    html += '<div class="info-general-head"><h3>' + icon('map-pin') + ' Info general</h3>';
    if(canEdit){
      html += '<button class="btn ghost small" id="infoGeneralEditBtn" type="button">' + icon('pencil') + ' Editar</button>';
    }
    html += '</div>';

    if(infoGeneralIsEmpty(d)){
      html += '<p class="empty">Todavía no se cargó la info del lugar.' + (canEdit ? ' Tocá «Editar» para cargarla.' : '') + '</p>';
      return html + '</div>';
    }

    var fecha = (d.fecha || '').trim() || fechaDesdeCampStart();
    var rows = '';
    if((d.lugar || '').trim() || (d.direccion || '').trim()){
      rows += '<div class="info-general-row"><span class="info-general-label">Lugar</span><div>';
      if((d.lugar || '').trim()) rows += '<strong>' + escapeHtml(d.lugar) + '</strong>';
      if((d.direccion || '').trim()) rows += '<div class="mandos-sub">' + escapeHtml(d.direccion) + '</div>';
      rows += '</div></div>';
    }
    if(fecha){
      rows += '<div class="info-general-row"><span class="info-general-label">Fecha</span><div class="info-general-text">' + linkify(fecha) + '</div></div>';
    }
    html += rows ? '<div class="info-general-rows">' + rows + '</div>' : '';

    // Mapa: embebido a partir de la dirección (o el lugar), sin clave de API.
    var q = (d.direccion || '').trim() || (d.lugar || '').trim();
    var mapaLink = (d.mapaUrl || '').trim() || (q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '');
    if(q){
      html += '<div class="info-general-map"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa del lugar" src="https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed"></iframe></div>';
    }
    if(mapaLink){
      html += '<p class="info-general-maplink"><a href="' + escapeHtml(mapaLink) + '" target="_blank" rel="noopener">' + icon('external-link') + ' Abrir en Google Maps</a></p>';
    }

    var fotos = (d.fotos || '').split(/\s+/).filter(function(u){ return /^https?:\/\//.test(u); });
    if(fotos.length){
      html += '<div class="info-general-fotos">';
      fotos.forEach(function(u){
        html += '<a href="' + escapeHtml(u) + '" target="_blank" rel="noopener"><img loading="lazy" alt="Foto del lugar" src="' + escapeHtml(fotoSrc(u)) + '"></a>';
      });
      html += '</div>';
    }

    if((d.queLlevar || '').trim()){
      html += '<h4 class="info-general-sub">Qué llevar</h4><div class="info-general-text">' + linkify(d.queLlevar) + '</div>';
    }
    if((d.notas || '').trim()){
      html += '<h4 class="info-general-sub">Más datos</h4><div class="info-general-text">' + linkify(d.notas) + '</div>';
    }
    return html + '</div>';
  }

  export function renderInfoGeneralSection(){
    return renderInfoGeneralBlock(canCreateInfoGeneral());
  }


  // Diálogo para editar el bloque de Info general — mismo estilo que el de
  // la fecha de inicio (.app-dialog-*).
  function openInfoGeneralDialog(){
    if(!canCreateInfoGeneral()) return;
    var d = infoGeneralData();
    function field(id, label, ph, multi, help){
      var val = escapeHtml(d[id] || '');
      return '<div class="form-row"><label for="ig_' + id + '">' + label + '</label>' +
        (multi ? '<textarea id="ig_' + id + '" rows="3" placeholder="' + ph + '">' + val + '</textarea>'
               : '<input type="text" id="ig_' + id + '" placeholder="' + ph + '" value="' + val + '">') +
        (help ? '<p class="mandos-sub" style="margin:4px 0 0">' + help + '</p>' : '') + '</div>';
    }
    var overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML =
      '<div class="app-dialog-box info-general-dialog" role="dialog" aria-modal="true">' +
      '  <h3 style="margin:0 0 12px">Info general</h3>' +
      field('lugar', 'Lugar', 'Ej: Predio …', false) +
      field('direccion', 'Dirección', 'Ej: Ruta 7 km …, Mendoza', false, 'Con la dirección se muestra el mapa solo.') +
      field('mapaUrl', 'Link de Google Maps (opcional)', 'https://maps.app.goo.gl/…', false) +
      field('fecha', 'Fecha (opcional)', 'Ej: del 6 al 13 de enero de 2027', false, 'Si queda vacío, se usa la fecha de inicio de la cuenta regresiva.') +
      field('fotos', 'Fotos (links, uno por línea)', 'https://drive.google.com/file/d/…', true, 'Links de Drive (compartidos) o de imágenes.') +
      field('queLlevar', 'Qué llevar', 'Bolsa de dormir, linterna, …', true) +
      field('notas', 'Más datos', 'Horarios de llegada, contacto, …', true) +
      '  <div class="app-dialog-actions" style="margin-top:16px">' +
      '    <button type="button" class="btn ghost small" id="igCancelBtn">Cancelar</button>' +
      '    <button type="button" class="btn small" id="igSaveBtn">Guardar</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(overlay);
    function close(){
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }
    function onKey(e){ if(e.key === 'Escape') close(); }
    overlay.querySelector('#igCancelBtn').onclick = close;
    overlay.onclick = function(e){ if(e.target === overlay) close(); };
    overlay.querySelector('#igSaveBtn').onclick = function(){
      if(!canCreateInfoGeneral()) return;
      var next = {};
      INFO_FIELDS.forEach(function(k){ next[k] = overlay.querySelector('#ig_' + k).value.trim(); });
      AppState.state.infoGeneral = next;
      save();
      close();
      renderPanel();
      showStatus('Info general guardada.');
    };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#ig_lugar').focus();
  }


  export function attachHomeEvents(){
    // Los botones de "Ir directo a..." se sacaron de Inicio (pedido del
    // usuario, 22/09/2026) — ya no hace falta escuchar `[data-goto]`/
    // `[data-goto-day]` acá.
    var gearBtn = document.getElementById('campStartGearBtn');
    if(gearBtn){ gearBtn.onclick = openCampStartDialog; }
    var igBtn = document.getElementById('infoGeneralEditBtn');
    if(igBtn){ igBtn.onclick = openInfoGeneralDialog; }
  }


  // Modal para cargar/corregir la fecha y hora de inicio — mismo estilo que
  // los diálogos propios de components/dialog.js (.app-dialog-*).
  function openCampStartDialog(){
    if(!canEditStructure()) return;
    var overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML =
      '<div class="app-dialog-box" role="dialog" aria-modal="true">' +
      '  <div class="form-row">' +
      '    <label for="campStartInput">' + (AppState.state.campStart ? 'Corregir fecha y hora de inicio' : 'Fecha y hora de inicio del campamento') + '</label>' +
      '    <input type="datetime-local" id="campStartInput" value="' + escapeHtml(AppState.state.campStart || '') + '">' +
      '  </div>' +
      '  <div class="app-dialog-actions" style="margin-top:16px">' +
      '    <button type="button" class="btn ghost small" id="campStartCancelBtn">Cancelar</button>' +
      '    <button type="button" class="btn small" id="campStartSaveBtn">Guardar fecha</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(overlay);
    function close(){
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }
    function onKey(e){ if(e.key === 'Escape') close(); }
    overlay.querySelector('#campStartCancelBtn').onclick = close;
    overlay.onclick = function(e){ if(e.target === overlay) close(); };
    overlay.querySelector('#campStartSaveBtn').onclick = function(){
      if(!canEditStructure()) return;
      var val = overlay.querySelector('#campStartInput').value;
      AppState.state.campStart = val || '';
      save();
      updateCountdownDisplay();
      close();
      showStatus(val ? 'Fecha del campamento guardada.' : 'Fecha del campamento borrada.');
    };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#campStartInput').focus();
  }
