// Perfil (05/11/2026, pedido del usuario): se abre desde el menú del avatar
// y se muestra como una pestaña más del panel. Datos editables (los mismos
// campos de autoservicio de siempre, ver updateMyProfile()) + rango «en hijos»
// (T13 E3).

import { AppState } from '../app-state.js';
import { DEPARTAMENTO_ICONS, CONSAGRADO_ICONS, RANGOS } from '../config/constants.js';
import { escapeHtml, roleLabelScoped } from '../utils/helpers.js';
import { cupulaIconOptionsHtml } from '../utils/badge-icons.js';
import { updateMyProfile } from '../services/auth.service.js';
import { miRango, puntosDisponibles, rangoNombres, rangoUmbrales } from '../services/rangos.service.js';
import { icon } from '../utils/icons.js';
import { showAlert } from '../components/dialog.js';

  function draftActual(){
    var u = AppState.currentUser;
    if(!AppState.userProfileDraft){
      AppState.userProfileDraft = { actividadFavorita: u.actividadFavorita || '', rucaFundacion: u.rucaFundacion || '', deptoIconChoice: u.deptoIconChoice || 'fasta', cupulaIcon: u.cupulaIcon || '', consagradoIconChoice: u.consagradoIconChoice || '' };
    }
    return AppState.userProfileDraft;
  }

  function rangoCardHtml(){
    var r = miRango();
    var nombres = rangoNombres(AppState.state);
    var umbrales = [0].concat(rangoUmbrales(AppState.state));
    var html = '<div class="home-card perfil-card">';
    html += '<h3>Tu rango</h3>';
    html += '<span class="rango-chip">' + icon('star') + ' ' + escapeHtml(r.nombre) + '</span>';
    if(!r.total){
      html += '<p class="mandos-sub">Todavía no hay entradas con puntos.</p>';
    } else {
      html += '<p class="mandos-sub">' + r.puntos + ' de ' + puntosDisponibles() + ' puntos disponibles</p>';
      html += '<div class="perfil-barra"><span style="width:' + Math.min(100, r.porcentaje) + '%"></span></div>';
    }
    html += '<ol class="perfil-rangos">';
    RANGOS.forEach(function(x, i){
      var cls = x.n < r.rango ? 'hecho' : (x.n === r.rango ? 'actual' : '');
      html += '<li class="' + cls + '"><strong>' + escapeHtml(nombres[i]) + '</strong><span class="mandos-sub">' + (i ? umbrales[i] + '%' : 'Inicio') + '</span></li>';
    });
    html += '</ol>';
    if(r.siguiente){
      var falta = [];
      if(r.siguiente.faltanPuntos) falta.push(r.siguiente.faltanPuntos + ' puntos');
      var obs = r.siguiente.obligatoriasPendientes;
      if(obs.length) falta.push(obs.length + (obs.length === 1 ? ' entrada obligatoria' : ' entradas obligatorias'));
      if(falta.length) html += '<p class="mandos-sub">Para llegar a «' + escapeHtml(r.siguiente.nombre) + '» falta: ' + falta.join(' y ') + '.</p>';
      if(obs.length){
        html += '<ul class="perfil-obligatorias">';
        obs.forEach(function(e){ html += '<li>' + escapeHtml(e.title || '(sin título)') + '</li>'; });
        html += '</ul>';
      }
    } else if(r.total){
      html += '<p class="mandos-sub">¡Llegaste al último rango!</p>';
    }
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
    html += '<div class="perfil-grid">' + rangoCardHtml() + datosCardHtml() + '</div>';
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
    var saveBtn = document.getElementById('userProfileSaveBtn');
    if(saveBtn){
      saveBtn.onclick = async function(){
        await updateMyProfile(draft);
        AppState.userProfileDraft = null; // watchProfile() refresca currentUser y redibuja
        await showAlert('Perfil guardado.');
      };
    }
  }
