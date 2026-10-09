// "Comando" (antes "Cuadro de mandos", renombrada 09/10/2026) — dos
// subpestañas: "Cuadro de mandos" (de solo lectura, con la nómina completa
// de la Resolución de nombramientos — los datos viven en Firestore,
// `mandos/data`, ver services/mandos.service.js) y "Mi comando" (roster en
// vivo de quien ya se registró, con foto/actividad favorita/ruca — ver
// canSeeMiComandoSubtab() en services/permissions.js).

import { AppState } from '../app-state.js';
import { DEPARTAMENTO_ICONS } from '../config/constants.js';
import { escapeHtml, roleLabel, activityIcon } from '../utils/helpers.js';
import { userBadgeInnerHtml } from '../utils/badge-icons.js';
import { canSeeMiComandoSubtab } from '../services/permissions.js';
import { isMilicianoUser } from './users.js';
import { renderPanel } from '../main.js';

  export function mandoCard(role, name){
    return '<div class="mando-card"><span class="mando-role">' + escapeHtml(role) + '</span><span class="mando-name">' + escapeHtml(name) + '</span></div>';
  }


  function renderCuadroDeMandosHtml(){
    var MANDOS = AppState.mandosData;
    var html = '';

    if(!MANDOS){
      return AppState.mandosLoaded
        ? '<p class="empty">Todavía no hay cuadro de mandos cargado.</p>'
        : '<p class="loading-inline"><span class="loading-spinner"></span>Cargando…</p>';
    }

    html += '<div class="mandos-cupula">';
    html += mandoCard('Jefe de Campamento', MANDOS.jefeCampamento);
    html += mandoCard('Asesor de la actividad', MANDOS.asesor);
    html += mandoCard('Secretario General', MANDOS.secretarioGeneral);
    html += mandoCard('Subjefe', MANDOS.subjefe);
    html += mandoCard('Jefe de Agrupación', MANDOS.jefeAgrupacion);
    html += '</div>';

    html += '<h3 class="mandos-group-title">Secciones</h3>';
    (MANDOS.secciones || []).forEach(function(sec){
      html += '<div class="mandos-section">';
      html += '  <div class="mandos-section-head"><h4>' + escapeHtml(sec.nombre) + '</h4>';
      html += '    <div class="mandos-section-heads"><span>Jefe: ' + escapeHtml(sec.jefe) + '</span><span>Secretario: ' + escapeHtml(sec.secretario) + '</span>' + (sec.capellan ? '<span>Capellán: ' + escapeHtml(sec.capellan) + '</span>' : '') + '</div>';
      html += '  </div>';
      html += '  <div class="mandos-subsecciones">';
      sec.subsecciones.forEach(function(sub){
        html += '<div class="mandos-sub-card"><p class="mandos-sub-jefe">' + escapeHtml(sub.jefe) + '</p><ul class="mandos-sub-list">';
        sub.subjefes.forEach(function(n){ html += '<li>' + escapeHtml(n) + '</li>'; });
        html += '</ul></div>';
      });
      html += '  </div>';
      html += '</div>';
    });

    html += '<h3 class="mandos-group-title">Departamentos</h3>';
    html += '<div class="mandos-deptos">';
    (MANDOS.departamentos || []).forEach(function(dep){
      html += '<div class="mandos-depto-card"><h4>' + escapeHtml(dep.nombre) + '</h4><p class="mandos-sub-jefe">' + escapeHtml(dep.jefe) + '</p><ul class="mandos-sub-list">';
      dep.subjefes.forEach(function(n){ html += '<li>' + escapeHtml(n) + '</li>'; });
      html += '</ul></div>';
    });
    html += '</div>';

    return html;
  }


  // Tarjeta de "Mi comando" — mismo espíritu que mandoCard(), pero con los
  // datos reales de perfil de quien ya se registró (no la Resolución).
  function miComandoCardHtml(u){
    var avatar = u.photoURL
      ? '<img class="micomando-avatar-img" src="' + escapeHtml(u.photoURL) + '" alt="">'
      : '<span class="micomando-avatar-fallback">👤</span>';
    var badgeInner = userBadgeInnerHtml(u, DEPARTAMENTO_ICONS);
    var badge = badgeInner ? '<span class="micomando-badge" title="' + escapeHtml(u.seccion || u.depto || '') + '">' + badgeInner + '</span>' : '';
    var actIcon = activityIcon(u.actividadFavorita);
    var html = '<div class="micomando-card">';
    html += '  <div class="micomando-avatar-wrap">' + avatar + badge + '</div>';
    html += '  <div class="micomando-info">';
    html += '    <strong>' + (actIcon ? actIcon + ' ' : '') + escapeHtml(u.displayName || u.email) + '</strong>';
    html += '    <span class="mandos-sub">' + escapeHtml(roleLabel(u.role)) + (u.seccion ? (' · ' + escapeHtml(u.seccion)) : (u.depto ? (' · ' + escapeHtml(u.depto)) : '')) + '</span>';
    if(u.rucaFundacion){ html += '    <span class="mandos-sub">' + escapeHtml(u.rucaFundacion) + '</span>'; }
    html += '  </div>';
    html += '</div>';
    return html;
  }


  function renderMiComandoHtml(){
    var members = (AppState.usersList || []).filter(function(u){ return !isMilicianoUser(u); });
    if(members.length === 0){
      return '<p class="empty">Todavía no se registró nadie del comando.</p>';
    }
    var html = '<div class="micomando-grid">';
    members.forEach(function(u){ html += miComandoCardHtml(u); });
    html += '</div>';
    return html;
  }


  export function renderMandosPanel(){
    var showMiComando = canSeeMiComandoSubtab();
    if(AppState.mandosActiveSubTab === 'micomando' && !showMiComando){ AppState.mandosActiveSubTab = 'mandos'; }

    var html = '';
    html += '<div class="panel-head"><div><h2>Comando</h2>';
    html += '<p class="mandos-sub">Campamento Nacional "Reino del Padre".</p></div></div>';

    if(showMiComando){
      html += '<div class="users-subtabs">';
      html += '  <button type="button" class="day-pill' + (AppState.mandosActiveSubTab !== 'micomando' ? ' active' : '') + '" data-mandos-subtab="mandos">Cuadro de mandos</button>';
      html += '  <button type="button" class="day-pill' + (AppState.mandosActiveSubTab === 'micomando' ? ' active' : '') + '" data-mandos-subtab="micomando">Mi comando</button>';
      html += '</div>';
    }

    html += (AppState.mandosActiveSubTab === 'micomando' && showMiComando) ? renderMiComandoHtml() : renderCuadroDeMandosHtml();

    return html;
  }


  export function attachMandosEvents(){
    document.querySelectorAll('[data-mandos-subtab]').forEach(function(btn){
      btn.onclick = function(){
        AppState.mandosActiveSubTab = btn.getAttribute('data-mandos-subtab');
        renderPanel();
      };
    });
  }
