// Botón flotante de "Comentarios" (feedback de diseño/estética) — quién
// lo ve, su HTML, y el wiring de sus eventos.

import { AppState } from '../app-state.js';
import { escapeHtml } from '../utils/helpers.js';
import { submitFeedback } from '../services/feedback.service.js';
import { currentPageLabel } from '../main.js';

  // Botón flotante de "Comentarios": pensado específicamente para que el jefe
  // de Comunicaciones (que no usa Claude) pueda dejar feedback de diseño/estética
  // sin escribirle a Agustín aparte — no es para todo el comando. Se identifica
  // por posición (jefe_seccion con depto === 'Comunicaciones'), no por cuenta de
  // Google puntual, así que sigue funcionando si cambia de mail o si alguien nuevo
  // asume ese puesto. El admin también lo ve siempre, para poder probarlo/revisarlo.
  // (22/09/2026) Habilitado también para todo el departamento de Formación —
  // marcados con `esFormacion:true` (los subjefes de Formación que acompañan una
  // sección auto-matchean con esto vía el bucket `formacion_member`; el jefe de
  // Formación ya es admin y ya lo ve). `comentaDiseno` (10/10/2026) es el campo
  // separado para otorgar SOLO este botón, sin marcar a nadie como miembro real
  // de Formación — antes esto se hacía reusando `esFormacion`, lo que hacía
  // aparecer a cualquiera con el botón habilitado dentro de "Comando de
  // Formación" en "Mi comando" (ver mandos.js, esFormacionMember()), aunque
  // fuera de otro departamento. `esFormacion` sigue otorgando el botón también
  // (un subjefe de Formación genuino lo necesita), pero ya no es la única vía.
  export function canSeeFeedbackWidget(){
    if(!AppState.authResolved || !AppState.currentUser || AppState.currentUser.role === 'pendiente') return false;
    if(AppState.currentUser.role === 'admin') return true;
    if(AppState.currentUser.esFormacion) return true;
    if(AppState.currentUser.comentaDiseno) return true;
    return AppState.currentUser.role === 'jefe_seccion' && AppState.currentUser.depto === 'Comunicaciones';
  }


  export function renderFeedbackWidget(){
    var el = document.getElementById('feedbackWidget');
    if(!el) return;
    if(!canSeeFeedbackWidget()){ el.innerHTML = ''; return; }

    var html = '';
    if(AppState.feedbackWidgetOpen){
      html += '<div class="feedback-panel" id="feedbackPanel">';
      if(AppState.feedbackJustSent){
        html += '  <h3>¡Gracias!</h3>';
        html += '  <p class="mandos-sub">Tu comentario ya le va a llegar a Agustín.</p>';
        html += '  <div class="form-actions"><button class="btn ghost small" id="feedbackCloseBtn" type="button">Cerrar</button></div>';
      } else {
        html += '  <h3>Dejar un comentario</h3>';
        html += '  <p class="mandos-sub">Sobre el diseño, la estética, o cualquier otra cosa de la página. Se lo mandamos directo a Agustín.</p>';
        html += '  <p class="feedback-page-ctx">Estás en: <strong>' + escapeHtml(currentPageLabel()) + '</strong></p>';
        var draftVal = AppState.feedbackDraft !== null ? AppState.feedbackDraft : '';
        html += '  <div class="form-row"><textarea id="feedbackText" placeholder="Escribí acá tu comentario...">' + escapeHtml(draftVal) + '</textarea></div>';
        html += '  <div class="form-actions">';
        html += '    <button class="btn small" id="feedbackSendBtn" type="button">Enviar</button>';
        html += '    <button class="btn ghost small" id="feedbackCancelBtn" type="button">Cancelar</button>';
        html += '  </div>';
        html += '  <div class="status-msg" id="feedbackStatusMsg"></div>';
      }
      html += '</div>';
    }
    html += '<button class="feedback-fab" id="feedbackFabBtn" type="button">' + (AppState.feedbackWidgetOpen ? 'Cerrar' : '💬 Comentario') + '</button>';
    el.innerHTML = html;
    attachFeedbackWidgetEvents();
  }


  export function attachFeedbackWidgetEvents(){
    var fab = document.getElementById('feedbackFabBtn');
    if(fab){
      fab.onclick = function(){
        AppState.feedbackWidgetOpen = !AppState.feedbackWidgetOpen;
        if(!AppState.feedbackWidgetOpen){ AppState.feedbackDraft = null; AppState.feedbackJustSent = false; }
        renderFeedbackWidget();
      };
    }
    var textEl = document.getElementById('feedbackText');
    if(textEl){
      textEl.oninput = function(e){ AppState.feedbackDraft = e.target.value; };
      // Ctrl+Enter (o Cmd+Enter en Mac) envía sin tener que ir a buscar el botón.
      textEl.onkeydown = function(e){
        if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
          e.preventDefault();
          e.stopPropagation(); // si no, este mismo Enter llega al listener global de
          // "Enter cierra la confirmación" y la cierra de una, sin dar tiempo a verla
          // (el envío es async y a veces ya resuelve antes de que el evento termine
          // de burbujear) — el listener global debe reaccionar solo a un Enter
          // *aparte*, apretado después, no al mismo que mandó el comentario.
          var sendBtn = document.getElementById('feedbackSendBtn');
          if(sendBtn) sendBtn.click();
        }
      };
    }
    var cancelBtn = document.getElementById('feedbackCancelBtn');
    if(cancelBtn){
      cancelBtn.onclick = function(){
        AppState.feedbackWidgetOpen = false;
        AppState.feedbackDraft = null;
        renderFeedbackWidget();
      };
    }
    var closeBtn = document.getElementById('feedbackCloseBtn');
    if(closeBtn){
      closeBtn.onclick = function(){
        AppState.feedbackWidgetOpen = false;
        AppState.feedbackJustSent = false;
        AppState.feedbackDraft = null;
        renderFeedbackWidget();
      };
    }
    var sendBtn = document.getElementById('feedbackSendBtn');
    if(sendBtn){
      sendBtn.onclick = async function(){
        var text = (document.getElementById('feedbackText').value || '').trim();
        if(!text){
          document.getElementById('feedbackStatusMsg').textContent = 'Escribí algo antes de enviar.';
          return;
        }
        sendBtn.disabled = true;
        var ok = await submitFeedback(text);
        sendBtn.disabled = false;
        if(ok){
          AppState.feedbackDraft = null;
          AppState.feedbackJustSent = true;
          renderFeedbackWidget();
        } else {
          document.getElementById('feedbackStatusMsg').textContent = 'No se pudo enviar. Probá de nuevo en un toque.';
        }
      };
    }
  }
