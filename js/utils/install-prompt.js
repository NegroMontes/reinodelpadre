// "Agregar a inicio" (23/10/2026): guarda el evento `beforeinstallprompt`
// que dispara Chrome/Edge/Android cuando la página es instalable, para
// poder abrir el diálogo nativo de instalación desde el menú del avatar.
// Safari (iPhone) no tiene ese evento — ahí se muestran instrucciones.

var deferredPrompt = null;

window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  deferredPrompt = e;
});
window.addEventListener('appinstalled', function(){ deferredPrompt = null; });

export function isInstalledApp(){
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
}

// Devuelve 'accepted', 'dismissed' o 'unavailable' (sin diálogo nativo).
export async function promptInstall(){
  if(!deferredPrompt) return 'unavailable';
  var ev = deferredPrompt;
  deferredPrompt = null; // el evento solo se puede usar una vez
  ev.prompt();
  var choice = await ev.userChoice;
  return choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
}
