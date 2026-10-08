// Panel "Comentarios" (solo admin): la tabla de feedback dejado con el
// botón flotante, acciones en lote, y "copiar pendientes" para pegar
// directo en el chat.

import { AppState } from '../app-state.js';
import { escapeHtml, roleLabel } from '../utils/helpers.js';
import { toggleFeedbackResuelto, deleteFeedbackItem } from '../services/feedback.service.js';
import { renderPanel } from '../main.js';

  // Arma un texto plano con todos los comentarios pendientes (sin resolver),
  // listo para pegarle directo a Claude — así el admin no tiene que transcribir
  // a mano lo que ve en la tabla.
  export function buildFeedbackText(list, headerLabel){
    if(list.length === 0) return '';
    var lines = [headerLabel + ' (' + list.length + '):', ''];
    list.forEach(function(f, i){
      var fecha = f.createdAt ? new Date(f.createdAt).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
      var scopeTxt = f.seccion ? (' · ' + f.seccion) : (f.depto ? (' · ' + f.depto) : '');
      lines.push((i+1) + '. [' + fecha + '] ' + (f.author || '') + ' (' + roleLabel(f.role) + scopeTxt + ') — en ' + (f.page || '') + ':');
      lines.push(f.text || '');
      lines.push('');
    });
    return lines.join('\n');
  }


  export function buildPendingFeedbackText(){
    return buildFeedbackText(AppState.feedbackList.filter(function(f){ return !f.resuelto; }), 'Comentarios pendientes');
  }


  export function selectedFeedbackItems(){
    return AppState.feedbackList.filter(function(f){ return AppState.feedbackSelectedIds.indexOf(f.id) !== -1; });
  }


  export function copyTextToClipboard(text, btn){
    if(!text) return;
    var original = btn.textContent;
    navigator.clipboard.writeText(text).then(function(){
      btn.textContent = '¡Copiado!';
      setTimeout(function(){ btn.textContent = original; }, 1500);
    }).catch(function(){
      alert('No se pudo copiar automáticamente. Copiá este texto a mano:\n\n' + text);
    });
  }


  export function renderFeedbackPanel(){
    // Sacar de la selección cualquier id que ya no exista (ej. borrado desde
    // otra pestaña/dispositivo) — así el contador y la barra de acciones en
    // lote nunca quedan mostrando algo que ya no está.
    var existingIds = AppState.feedbackList.map(function(f){ return f.id; });
    AppState.feedbackSelectedIds = AppState.feedbackSelectedIds.filter(function(id){ return existingIds.indexOf(id) !== -1; });

    var pendCount = AppState.feedbackList.filter(function(f){ return !f.resuelto; }).length;
    // "Ocultar resueltos" (pedido del usuario, 24/09/2026) — filtra la tabla,
    // no `feedbackList` en sí (los botones de acción en lote/"Copiar
    // pendientes" siguen operando sobre TODOS los comentarios, no solo los
    // visibles con el filtro puesto).
    var visibleList = AppState.feedbackHideResueltos ? AppState.feedbackList.filter(function(f){ return !f.resuelto; }) : AppState.feedbackList;
    var selCount = AppState.feedbackSelectedIds.length;
    var allSelected = visibleList.length > 0 && selCount === visibleList.length;

    var html = '';
    html += '<div class="panel-head"><div><h2>Comentarios</h2>';
    html += '<p class="mandos-sub">Lo que va dejando el comando con el botón flotante "💬 Comentario" — pensado sobre todo para feedback de diseño y estética (ej. el jefe de Comunicaciones).</p></div>';
    html += '<button class="btn small" id="copyPendingBtn" type="button"' + (pendCount === 0 ? ' disabled title="No hay comentarios pendientes"' : '') + '>Copiar pendientes' + (pendCount > 0 ? ' (' + pendCount + ')' : '') + '</button>';
    html += '<button class="btn ghost small" id="toggleHideResueltosBtn" type="button">' + (AppState.feedbackHideResueltos ? 'Mostrar todos' : 'Ocultar resueltos') + '</button>';
    html += '</div>';
    if(AppState.feedbackList.length === 0){
      html += '<p class="empty">Todavía no hay comentarios.</p>';
    } else if(visibleList.length === 0){
      // Cola vacía con "Ocultar resueltos" puesto — mensaje festivo en vez
      // del mensaje neutro de arriba (pedido del usuario, 24/09/2026).
      html += '<p class="empty feedback-empty-fun">🎉 Admins, ¡descanso!<br><span class="mandos-sub">Ya no quedan comentarios por implementar</span></p>';
    } else {
      if(selCount > 0){
        html += '<div class="feedback-bulk-bar">';
        html += '  <span class="mandos-sub" style="margin:0">' + selCount + ' seleccionado' + (selCount === 1 ? '' : 's') + '</span>';
        html += '  <button class="btn small" id="bulkResolveBtn" type="button">Marcar resueltos</button>';
        html += '  <button class="btn small" id="bulkReopenBtn" type="button">Reabrir</button>';
        html += '  <button class="btn small" id="bulkCopyBtn" type="button">Copiar</button>';
        html += '  <button class="btn ghost small" id="bulkDeleteBtn" type="button">Borrar</button>';
        html += '</div>';
      }
      html += '<div style="overflow-x:auto"><table class="users-table"><thead><tr><th><input type="checkbox" id="fbSelectAll" title="Seleccionar todos"' + (allSelected ? ' checked' : '') + '></th><th>Fecha</th><th>Quién</th><th>Página</th><th>Comentario</th><th>Estado</th><th></th></tr></thead><tbody>';
      visibleList.forEach(function(f){
        var fecha = f.createdAt ? new Date(f.createdAt).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
        var scopeTxt = f.seccion ? (' · ' + f.seccion) : (f.depto ? (' · ' + f.depto) : '');
        var checked = AppState.feedbackSelectedIds.indexOf(f.id) !== -1;
        html += '<tr data-id="' + f.id + '"' + (f.resuelto ? ' style="opacity:0.55"' : '') + '>';
        html += '  <td><input type="checkbox" class="fbSelect" data-id="' + f.id + '"' + (checked ? ' checked' : '') + '></td>';
        html += '  <td style="white-space:nowrap">' + escapeHtml(fecha) + '</td>';
        html += '  <td>' + escapeHtml(f.author || '') + '<br><span class="mandos-sub" style="margin:2px 0 0">' + escapeHtml(roleLabel(f.role)) + escapeHtml(scopeTxt) + '</span></td>';
        html += '  <td>' + escapeHtml(f.page || '') + '</td>';
        html += '  <td style="white-space:pre-wrap">' + escapeHtml(f.text || '') + '</td>';
        html += '  <td>' + (f.resuelto ? 'Resuelto' : 'Pendiente') + '</td>';
        // Dos renglones simétricos (pedido del usuario, 24/09/2026): arriba
        // "Marcar resuelto"/"Reabrir" ocupando todo el ancho de la columna;
        // abajo "Borrar" y "Copiar" (orden invertido respecto de la versión
        // anterior) repartiéndose ese mismo ancho a la mitad cada uno
        // (`flex:1`), así el contenedor de los dos botones de abajo mide
        // exactamente lo mismo que el botón de arriba, en vez de quedar más
        // largo o más corto según el largo del texto de cada uno.
        html += '  <td>';
        html += '    <div style="display:flex;flex-direction:column;gap:6px;min-width:130px">';
        html += '      <button class="btn small" data-action="toggleFeedback">' + (f.resuelto ? 'Reabrir' : 'Marcar resuelto') + '</button>';
        html += '      <div style="display:flex;gap:6px">';
        html += '        <button class="btn ghost small" data-action="deleteFeedback" style="flex:1">Borrar</button>';
        html += '        <button class="btn ghost small" data-action="copyFeedback" style="flex:1">Copiar</button>';
        html += '      </div>';
        html += '    </div>';
        html += '  </td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }
    return html;
  }


  export function attachFeedbackPanelEvents(){
    var copyBtn = document.getElementById('copyPendingBtn');
    if(copyBtn && !copyBtn.disabled){
      copyBtn.onclick = function(){ copyTextToClipboard(buildPendingFeedbackText(), copyBtn); };
    }
    var toggleHideResueltosBtn = document.getElementById('toggleHideResueltosBtn');
    if(toggleHideResueltosBtn){
      toggleHideResueltosBtn.onclick = function(){ AppState.feedbackHideResueltos = !AppState.feedbackHideResueltos; renderPanel(); };
    }

    // "Seleccionar todos" respeta el filtro de "Ocultar resueltos" puesto —
    // tildar todo con el filtro activo no debería seleccionar de paso los
    // resueltos que están escondidos.
    var visibleListForSelectAll = AppState.feedbackHideResueltos ? AppState.feedbackList.filter(function(f){ return !f.resuelto; }) : AppState.feedbackList;
    var selectAll = document.getElementById('fbSelectAll');
    if(selectAll){
      selectAll.onchange = function(){
        AppState.feedbackSelectedIds = selectAll.checked ? visibleListForSelectAll.map(function(f){ return f.id; }) : [];
        renderPanel();
      };
    }
    document.querySelectorAll('.fbSelect').forEach(function(cb){
      cb.onchange = function(){
        var id = cb.getAttribute('data-id');
        if(cb.checked){
          if(AppState.feedbackSelectedIds.indexOf(id) === -1) AppState.feedbackSelectedIds.push(id);
        } else {
          AppState.feedbackSelectedIds = AppState.feedbackSelectedIds.filter(function(x){ return x !== id; });
        }
        renderPanel();
      };
    });
    var bulkResolveBtn = document.getElementById('bulkResolveBtn');
    if(bulkResolveBtn){
      bulkResolveBtn.onclick = function(){
        Promise.all(AppState.feedbackSelectedIds.map(function(id){ return toggleFeedbackResuelto(id, true); }));
      };
    }
    var bulkReopenBtn = document.getElementById('bulkReopenBtn');
    if(bulkReopenBtn){
      bulkReopenBtn.onclick = function(){
        Promise.all(AppState.feedbackSelectedIds.map(function(id){ return toggleFeedbackResuelto(id, false); }));
      };
    }
    var bulkCopyBtn = document.getElementById('bulkCopyBtn');
    if(bulkCopyBtn){
      bulkCopyBtn.onclick = function(){
        copyTextToClipboard(buildFeedbackText(selectedFeedbackItems(), 'Comentarios seleccionados'), bulkCopyBtn);
      };
    }
    var bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if(bulkDeleteBtn){
      bulkDeleteBtn.onclick = function(){
        var ids = AppState.feedbackSelectedIds.slice();
        if(!confirm('¿Borrar ' + ids.length + ' comentario' + (ids.length === 1 ? '' : 's') + '?')) return;
        AppState.feedbackSelectedIds = [];
        renderPanel(); // saca la barra de acciones y los checks de una, sin esperar el viaje a Firestore
        Promise.all(ids.map(function(id){ return deleteFeedbackItem(id); }));
      };
    }

    document.querySelectorAll('[data-action="toggleFeedback"]').forEach(function(btn){
      btn.onclick = function(){
        var row = btn.closest('tr');
        var id = row.getAttribute('data-id');
        var item = AppState.feedbackList.find(function(f){ return f.id === id; });
        if(!item) return;
        toggleFeedbackResuelto(id, !item.resuelto);
      };
    });
    document.querySelectorAll('[data-action="copyFeedback"]').forEach(function(btn){
      btn.onclick = function(){
        var row = btn.closest('tr');
        var id = row.getAttribute('data-id');
        var item = AppState.feedbackList.find(function(f){ return f.id === id; });
        if(!item) return;
        copyTextToClipboard(buildFeedbackText([item], 'Comentario'), btn);
      };
    });
    document.querySelectorAll('[data-action="deleteFeedback"]').forEach(function(btn){
      btn.onclick = function(){
        var row = btn.closest('tr');
        var id = row.getAttribute('data-id');
        if(!confirm('¿Borrar este comentario?')) return;
        deleteFeedbackItem(id);
      };
    });
  }
