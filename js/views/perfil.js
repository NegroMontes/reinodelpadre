// Perfil (05/11/2026, pedido del usuario): se abre desde el menú del avatar
// y se muestra como una pestaña más del panel. Datos editables (los mismos
// campos de autoservicio de siempre, ver updateMyProfile()) + rango «en hijos»
// (T13 E3).

import { AppState } from '../app-state.js';
import { DEPARTAMENTO_ICONS, CONSAGRADO_ICONS } from '../config/constants.js';
import { escapeHtml, roleLabelScoped } from '../utils/helpers.js';
import { cupulaIconOptionsHtml } from '../utils/badge-icons.js';
import { updateMyProfile } from '../services/auth.service.js';
import { miRango, puntosDisponibles, alDia, rangoUmbrales, entradasQueCuentan, obligatoriaRangoDe } from '../services/rangos.service.js';
import { icon } from '../utils/icons.js';
import { showAlert } from '../components/dialog.js';
import { HIJOS_BIBLICOS } from '../config/test-hijo-biblico.js';
import { render } from '../main.js';

  function draftActual(){
    var u = AppState.currentUser;
    if(!AppState.userProfileDraft){
      AppState.userProfileDraft = { actividadFavorita: u.actividadFavorita || '', rucaFundacion: u.rucaFundacion || '', deptoIconChoice: u.deptoIconChoice || 'fasta', cupulaIcon: u.cupulaIcon || '', consagradoIconChoice: u.consagradoIconChoice || '' };
    }
    return AppState.userProfileDraft;
  }

  function rangoCardHtml(){
    var r = miRango();
    var umbrales = [0].concat(rangoUmbrales(AppState.state));
    var obligatorias = [], hecha = function(){ return false; };
    var html = '<div class="home-card perfil-card">';
    html += '<h3>Tu rango</h3>';
    html += '<span class="rango-chip rango-' + r.rango + '">' + escapeHtml(r.nombre) + '</span>';
    if(!r.total){
      html += '<p class="mandos-sub">Todavía no hay entradas con puntos.</p>';
    } else {
      // «N de M» con las entradas ya visibles (antes N contaba también las
      // programadas que se completaron, y podía dar «16 de 3»).
      var disp = puntosDisponibles();
      html += '<p class="perfil-aldia">Al día: <strong>' + alDia() + '%</strong></p>';
      html += '<div class="perfil-puntos"><span class="mandos-sub">' + disp.puntos + ' de ' + disp.total + ' puntos disponibles</span>';
      if(r.siguiente && r.siguiente.faltanPuntos) html += '<span class="mandos-sub">' + r.siguiente.faltanPuntos + (r.siguiente.faltanPuntos === 1 ? ' punto' : ' puntos') + ' hasta el siguiente rango</span>';
      html += '</div>';
      // Barra: avance desde el rango actual hasta el siguiente (pedido del
      // usuario, 05/11/2026). Llena si ya alcanzó el % y solo faltan obligatorias.
      var avance = 100;
      if(r.siguiente){
        var pct = r.puntos / r.total * 100, desde = umbrales[r.rango - 1], hasta = umbrales[r.rango];
        avance = hasta > desde ? Math.max(0, Math.min(100, (pct - desde) / (hasta - desde) * 100)) : 100;
      }
      // Obligatorias del siguiente rango, con tilde si están hechas.
      obligatorias = r.siguiente ? entradasQueCuentan().filter(function(e){ return obligatoriaRangoDe(e) === r.siguiente.rango; }) : [];
      hecha = function(e){ return !!(AppState.myProgress[e.id] && AppState.myProgress[e.id].completedAt); };
      var faltaObligatoria = obligatorias.some(function(e){ return !hecha(e); });
      // Llena pero sin las obligatorias: roja.
      var roja = avance >= 100 && faltaObligatoria;
      html += '<div class="perfil-barra' + (roja ? ' perfil-barra-roja' : '') + '"><span style="width:' + Math.round(avance) + '%"></span></div>';
      if(roja) html += '<p class="mandos-sub">Faltan entradas obligatorias.</p>';
    }
    if(r.siguiente){
      if(obligatorias && obligatorias.length){
        html += '<p class="mandos-sub perfil-obligatorias-titulo">Entradas obligatorias</p>';
        html += '<ul class="perfil-obligatorias">';
        obligatorias.forEach(function(e){
          var ok = hecha(e);
          html += '<li class="' + (ok ? 'hecha' : '') + '"><span class="perfil-tilde">' + (ok ? '✓' : '') + '</span>' + escapeHtml(e.title || '(sin título)') + '</li>';
        });
        html += '</ul>';
      }
    } else if(r.total){
      html += '<p class="mandos-sub">¡Llegaste al último rango!</p>';
    }
    html += '</div>';
    return html;
  }

  // T8 E2: resultado del test «¿Qué hijo bíblico sos?».
  function hijoCardHtml(){
    var h = HIJOS_BIBLICOS[AppState.currentUser.hijoBiblico];
    var html = '<div class="home-card perfil-card">';
    html += '<h3>Tu hijo bíblico</h3>';
    if(h){
      html += '<p><strong>' + escapeHtml(h.nombre) + '</strong> <span class="mandos-sub">· ' + escapeHtml(h.cita) + '</span></p>';
      html += '<p class="mandos-sub">' + escapeHtml(h.fortaleza) + '</p>';
    } else {
      html += '<p class="mandos-sub">Todavía no hiciste el test.</p>';
    }
    html += '<button class="btn small' + (h ? ' ghost' : '') + '" type="button" id="perfilTestHijoBtn">' + (h ? 'Ver resultado / repetir' : 'Hacer el test') + '</button>';
    html += '</div>';
    return html;
  }

  function datosCardHtml(){
    var u = AppState.currentUser, draft = draftActual();
    var html = '<div class="home-card perfil-card">';
    html += '<h3>Tus datos</h3>';
    html += '<div class="user-menu-profile-form">';
    html += '  <label>Actividad favorita<input id="userProfileActividadInput" type="text" value="' + escapeHtml(draft.actividadFavorita) + '" placeholder="Ej: Jugar al fútbol"></label>';
    html += '  <label>Ruca / Fundación de origen<input id="userProfileRucaInput" type="text" value="' + escapeHtml(draft.rucaFundacion) + '" placeholder="Ej: Ruca Chapelco"></label>';
    // Solo para quien tiene depto propio — una sección usa siempre su escudo.
    if(u.depto){
      html += '  <label>Ícono de tu depto en el avatar<select id="userProfileDeptoIconSelect">'
        + '<option value="fasta"' + (draft.deptoIconChoice !== 'depto' ? ' selected' : '') + '>Escudo de FASTA (genérico)</option>'
        + '<option value="depto"' + (draft.deptoIconChoice === 'depto' ? ' selected' : '') + '>' + (DEPARTAMENTO_ICONS[u.depto] || '') + ' Ícono de ' + escapeHtml(u.depto) + '</option>'
        + '</select></label>';
    }
    // Sin sección ni depto (comando central): elige uno de una lista.
    if(!u.seccion && !u.depto){
      html += '  <label>Tu ícono en el avatar<select id="userProfileCupulaIconSelect">';
      if(!draft.cupulaIcon){ html += '<option value="" selected disabled>Elegí uno…</option>'; }
      html += cupulaIconOptionsHtml(draft.cupulaIcon);
      html += '</select></label>';
    }
    // Consagrado: escudo de su sección o un ícono propio (cruz/pan).
    if(u.role === 'consagrado'){
      html += '  <label>Tu ícono en el avatar<select id="userProfileConsagradoIconSelect">';
      html += '<option value=""' + (!draft.consagradoIconChoice ? ' selected' : '') + '>Escudo de tu sección (default)</option>';
      CONSAGRADO_ICONS.forEach(function(o){
        html += '<option value="' + o.value + '"' + (draft.consagradoIconChoice === o.value ? ' selected' : '') + '>' + o.emoji + ' ' + escapeHtml(o.label) + '</option>';
      });
      html += '</select></label>';
    }
    html += '  <div class="user-menu-profile-actions"><button id="userProfileSaveBtn" class="btn small" type="button">Guardar</button></div>';
    html += '</div></div>';
    return html;
  }

  export function renderPerfilPanel(){
    var u = AppState.currentUser;
    var html = '<div class="panel-head"><div><h2>Perfil</h2>';
    html += '<p class="mandos-sub">' + escapeHtml(u.displayName || '') + ' · ' + escapeHtml(roleLabelScoped(u)) + '</p></div></div>';
    html += '<div class="perfil-grid">' + rangoCardHtml() + hijoCardHtml() + datosCardHtml() + '</div>';
    return html;
  }

  export function attachPerfilEvents(){
    var draft = draftActual();
    var bind = function(id, campo, ev){
      var el = document.getElementById(id);
      if(el) el[ev] = function(){ draft[campo] = el.value; };
    };
    bind('userProfileActividadInput', 'actividadFavorita', 'oninput');
    bind('userProfileRucaInput', 'rucaFundacion', 'oninput');
    bind('userProfileDeptoIconSelect', 'deptoIconChoice', 'onchange');
    bind('userProfileCupulaIconSelect', 'cupulaIcon', 'onchange');
    bind('userProfileConsagradoIconSelect', 'consagradoIconChoice', 'onchange');
    var testBtn = document.getElementById('perfilTestHijoBtn');
    if(testBtn){
      testBtn.onclick = function(){
        AppState.activeDayId = 'RECURSOS';
        AppState.recursosCategoria = 'test-hijo';
        AppState.recursosGrupo = '';
        AppState.testHijo = null;
        render(); window.scrollTo(0, 0);
      };
    }
    var saveBtn = document.getElementById('userProfileSaveBtn');
    if(saveBtn){
      saveBtn.onclick = async function(){
        await updateMyProfile(draft);
        AppState.userProfileDraft = null; // watchProfile() refresca currentUser y redibuja
        await showAlert('Perfil guardado.');
      };
    }
  }
