// Toast chico, no bloqueante (19/10/2026) — distinto de dialog.js
// (showAlert/showConfirm), que SÍ bloquean la pantalla con un overlay.
// Pensado para el aviso de "hay una versión nueva" (ver
// services/version-check.service.js): no debería frenar a nadie de seguir
// usando la página mientras decide si recargar.

var CONTAINER_ID = 'toastContainer';

function ensureContainer(){
  var el = document.getElementById(CONTAINER_ID);
  if(!el){
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

// opts: { message, actionLabel, onAction }. El toast se queda hasta que
// alguien lo cierra a mano o toca la acción — no hay timeout automático
// (el aviso de versión nueva es importante, no un "listo" de paso).
export function showToast(opts){
  var container = ensureContainer();
  var el = document.createElement('div');
  el.className = 'toast-item';
  var html = '<span class="toast-msg"></span>';
  if(opts.actionLabel){ html += '<button type="button" class="btn small toast-action"></button>'; }
  html += '<button type="button" class="toast-close" aria-label="Cerrar">✕</button>';
  el.innerHTML = html;
  el.querySelector('.toast-msg').textContent = opts.message || '';
  var actionBtn = el.querySelector('.toast-action');
  if(actionBtn){
    actionBtn.textContent = opts.actionLabel;
    actionBtn.onclick = function(){
      if(opts.onAction){ opts.onAction(); }
      el.remove();
    };
  }
  el.querySelector('.toast-close').onclick = function(){ el.remove(); };
  container.appendChild(el);
  return el;
}
