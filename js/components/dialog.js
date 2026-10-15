// Reemplaza a los alert()/confirm() nativos del navegador (que no se pueden
// estilizar — quedan con la fuente/color del sistema operativo, nada que
// ver con el resto del sitio) por un modal propio, con la estética de la
// página — pedido del usuario, 10/10/2026 ("Que todos los carteles de
// diálogo del sistema... tengan la estética de la página y que a partir de
// ahora sea siempre así"). De acá en más, cualquier aviso o confirmación
// nueva en el código tiene que usar showAlert()/showConfirm() de este
// archivo — nunca `alert()`/`confirm()` nativos.
//
// A diferencia del navegador, estos son asíncronos (devuelven una Promise) —
// quien los llama desde un handler de click tiene que ser `async function`
// y usar `await`.

function escapeForDialog(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function buildOverlay(message, buttonsHtml){
  var overlay = document.createElement('div');
  overlay.className = 'app-dialog-overlay';
  overlay.innerHTML =
    '<div class="app-dialog-box" role="dialog" aria-modal="true">' +
    '  <p class="app-dialog-message">' + escapeForDialog(message) + '</p>' +
    '  <div class="app-dialog-actions">' + buttonsHtml + '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  return overlay;
}

export function showAlert(message){
  return new Promise(function(resolve){
    var overlay = buildOverlay(message, '<button type="button" class="btn small app-dialog-ok">Aceptar</button>');
    function close(){
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve();
    }
    function onKey(e){ if(e.key === 'Escape' || e.key === 'Enter'){ e.preventDefault(); close(); } }
    overlay.querySelector('.app-dialog-ok').onclick = close;
    overlay.onclick = function(e){ if(e.target === overlay) close(); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.app-dialog-ok').focus();
  });
}

export function showConfirm(message){
  return new Promise(function(resolve){
    var overlay = buildOverlay(message,
      '<button type="button" class="btn ghost small app-dialog-cancel">Cancelar</button>' +
      '<button type="button" class="btn small app-dialog-confirm">Confirmar</button>');
    function close(result){
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }
    function onKey(e){
      if(e.key === 'Escape'){ close(false); }
      else if(e.key === 'Enter'){ e.preventDefault(); close(true); }
    }
    overlay.querySelector('.app-dialog-confirm').onclick = function(){ close(true); };
    overlay.querySelector('.app-dialog-cancel').onclick = function(){ close(false); };
    overlay.onclick = function(e){ if(e.target === overlay) close(false); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.app-dialog-confirm').focus();
  });
}
