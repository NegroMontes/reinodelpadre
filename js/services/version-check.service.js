// Avisa (toast, solo admin) cuando detecta en segundo plano que se
// pusheó una versión nueva del código mientras la pestaña seguía abierta
// (19/10/2026, pedido del usuario). Sin build step ni service worker: en
// vez de un archivo de versión aparte (que habría que mantener
// sincronizado a mano con APP_VERSION, dos fuentes de verdad para el mismo
// dato), vuelve a bajar este mismo `config/constants.js` con
// cache-busting y le saca el valor de APP_VERSION con una regex — una
// sola fuente, nunca se puede desincronizar.

import { AppState } from '../app-state.js';
import { APP_VERSION } from '../config/constants.js';
import { showToast } from '../components/toast.js';

var CHECK_INTERVAL_MS = 5 * 60 * 1000; // cada 5 minutos, no hace falta más seguido
var timer = null;
var alreadyNotified = false;

async function fetchRemoteVersion(){
  try{
    var res = await fetch('js/config/constants.js?_=' + Date.now(), { cache: 'no-store' });
    if(!res.ok) return null;
    var text = await res.text();
    var m = text.match(/APP_VERSION\s*=\s*'([^']+)'/);
    return m ? m[1] : null;
  }catch(e){
    return null; // sin red por un rato, por ejemplo — no es un error que haya que mostrar
  }
}

async function checkOnce(){
  if(alreadyNotified) return; // un solo aviso por sesión de pestaña, no insistir cada 5 min
  var remote = await fetchRemoteVersion();
  if(remote && remote !== APP_VERSION){
    alreadyNotified = true;
    showToast({
      message: 'Hay una versión nueva de la página (' + remote + ').',
      actionLabel: 'Recargar',
      onAction: function(){ location.reload(); }
    });
  }
}

// Se llama una sola vez, apenas se confirma que quien está logueado es
// admin (ver main.js) — nunca para el resto del comando ni milicianos,
// pedido explícito del usuario ("solo para el rol Administrador").
export function startVersionWatch(){
  if(timer) return; // ya está corriendo, no duplicar el intervalo
  timer = setInterval(checkOnce, CHECK_INTERVAL_MS);
}

export function stopVersionWatch(){
  if(timer){ clearInterval(timer); timer = null; }
  alreadyNotified = false;
}
