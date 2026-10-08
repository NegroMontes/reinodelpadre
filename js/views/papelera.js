// Panel "Papelera" (solo admin): entradas borradas (borrado suave, ver
// canSeeEntry en permissions.js), con Restaurar/Eliminar definitivamente.

import { AppState } from '../app-state.js';
import { escapeHtml } from '../utils/helpers.js';
import { entryLocationLabel } from '../components/header.js';
import { save } from '../services/state.service.js';
import { render } from '../main.js';

  // "Papelera" (pedido del usuario, 24/09/2026): cuando alguien borra una
  // entrada, ya no se pierde del todo — queda en `state.entries` con
  // `deletedAt`/`deletedBy` (ver el handler de "Eliminar" en
  // attachPanelEvents), invisible en el resto de la app (canSeeEntry) pero
  // recuperable acá. Esta pantalla lee `state.entries` directo, sin pasar
  // por canSeeEntry (que a propósito la excluye del feed normal).
  export function papeleraList(){
    return (AppState.state.entries || [])
      .filter(function(e){ return !!e.deletedAt; })
      .sort(function(a,b){ return b.deletedAt - a.deletedAt; });
  }


  export function renderPapeleraPanel(){
    var list = papeleraList();
    var html = '';
    html += '<div class="panel-head"><div><h2>Papelera</h2>';
    html += '<p class="mandos-sub">Lo que se fue borrando de Mensaje, Departamentos, Recursos e Info general — nadie más lo ve, pero queda guardado acá por si hace falta recuperarlo.</p></div></div>';
    if(list.length === 0){
      html += '<p class="empty">No hay nada borrado por ahora.</p>';
      return html;
    }
    html += '<div style="overflow-x:auto"><table class="users-table"><thead><tr><th>Borrado</th><th>Dónde vivía</th><th>Título</th><th>Autor original</th><th></th></tr></thead><tbody>';
    list.forEach(function(e){
      var fecha = new Date(e.deletedAt).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      var autorOriginal = e.anonimo ? (e.authorReal || '(autor desconocido)') : (e.author || '(sin firmar)');
      html += '<tr data-id="' + e.id + '">';
      html += '  <td style="white-space:nowrap">' + escapeHtml(fecha) + '<br><span class="mandos-sub" style="margin:2px 0 0">por ' + escapeHtml(e.deletedBy || '—') + '</span></td>';
      html += '  <td>' + escapeHtml(entryLocationLabel(e)) + '</td>';
      html += '  <td>' + escapeHtml(e.title || '(sin título)') + '</td>';
      html += '  <td>' + escapeHtml(autorOriginal) + '</td>';
      html += '  <td>';
      html += '    <div style="display:flex;flex-direction:column;gap:6px;min-width:110px">';
      html += '      <button class="btn small" data-action="restoreEntry">Restaurar</button>';
      html += '      <button class="btn ghost small" data-action="purgeEntry">Eliminar definitivamente</button>';
      html += '    </div>';
      html += '  </td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }


  export function attachPapeleraPanelEvents(){
    document.querySelectorAll('[data-action="restoreEntry"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.closest('tr').getAttribute('data-id');
        var entry = AppState.state.entries.find(function(e){ return e.id === id; });
        if(!entry) return;
        delete entry.deletedAt;
        delete entry.deletedBy;
        save();
        render();
      };
    });
    document.querySelectorAll('[data-action="purgeEntry"]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.closest('tr').getAttribute('data-id');
        if(!confirm('Esto la borra para siempre, sin forma de recuperarla. ¿Seguro?')) return;
        AppState.state.entries = AppState.state.entries.filter(function(e){ return e.id !== id; });
        save();
        render();
      };
    });
  }
