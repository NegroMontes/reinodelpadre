// La Fordoquera incrustada — editor y lector de entradas, 100% iguales a
// "la fordoquera" (la otra herramienta del usuario, `NegroMontes/
// encuentros-pagina`) porque literalmente ES la fordoquera, mostrada
// adentro de un <iframe> (`FORDOQUERA_URL + '?incrustada'`). Reemplaza al
// constructor de pasos propio de RDP (components/form.js) y a su
// reproductor (components/entry.js, `renderSecuencialEntry`) — ver
// "Fordoquera incrustada" en CLAUDE.md (09/10/2026).
//
// Protocolo completo, documentado en index.html de encuentros-pagina
// (sección "Fordoquera incrustada", versión 8.5): se hablan con
// postMessage, siempre iniciado DESDE el iframe (la fordoquera → página):
//   {fq:'lista'}                        ya cargó: le mandamos {fq:'abrir', ...}
//   {fq:'cambio', espacio}              cada vez que se guarda (debounced ~450ms del lado de ella)
//   {fq:'volver'}                       tocó «← Volver» (ya mandó un último 'cambio' antes)
//   {fq:'cerrado'}                      cerró la presentación (modo 'presentar')
//   {fq:'subir', pid, archivo:File}     guardá este archivo; respondemos {fq:'subido', pid, url|error}

import { AppState } from '../app-state.js';
import { FORDOQUERA_URL } from '../config/constants.js';
import { entryToEspacio } from '../utils/entry-to-espacio.js';
import { loadLibrosForFordoquera } from '../services/libros.service.js';
import { uploadEntryFile } from '../services/drive.service.js';
import { save } from '../services/state.service.js';
import { render, renderPanel } from '../main.js';

var active = null; // { messageHandler, overlayEl } — a lo sumo un overlay abierto a la vez

function driveIdFromShareUrl(url){
  var m = String(url || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// `uploadEntryFile()` devuelve un link de "compartir" de Drive
// (`.../file/d/<id>/view`) — útil cuando RDP mismo convertía ese link antes
// de mostrarlo (ver el `embedBlockHtml()` que se borró junto con entry.js),
// pero la Fordoquera usa `s.file.path` TAL CUAL como `src` de
// <img>/<video>/<audio>/<iframe>, sin ninguna conversión propia (a
// diferencia de un link pegado a mano en el campo URL, que sí reconoce y
// adapta sola) — así que acá hay que entregarle la forma ya embebible,
// según el tipo de archivo subido.
function embeddableUrlForUpload(shareUrl, mimeType){
  var id = driveIdFromShareUrl(shareUrl);
  if(!id) return shareUrl;
  if(mimeType && mimeType.indexOf('image/') === 0) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w2000';
  if(mimeType === 'application/pdf') return 'https://drive.google.com/file/d/' + id + '/preview';
  if(mimeType && (mimeType.indexOf('video/') === 0 || mimeType.indexOf('audio/') === 0)) return 'https://drive.google.com/uc?export=download&id=' + id;
  return shareUrl;
}

function closeOverlay(){
  if(!active) return;
  window.removeEventListener('message', active.messageHandler);
  if(active.overlayEl && active.overlayEl.parentNode) active.overlayEl.parentNode.removeChild(active.overlayEl);
  active = null;
}

function buildOverlay(onCloseClick){
  var overlay = document.createElement('div');
  overlay.className = 'fordoquera-overlay';
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'fordoquera-overlay-close';
  closeBtn.title = 'Cerrar';
  closeBtn.textContent = '✕';
  closeBtn.onclick = onCloseClick;
  var iframe = document.createElement('iframe');
  iframe.className = 'fordoquera-overlay-iframe';
  iframe.src = FORDOQUERA_URL.replace(/\/$/, '') + '/?incrustada';
  overlay.appendChild(closeBtn);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
  return { overlay: overlay, iframe: iframe };
}

// Guarda el espacio nuevo adentro de la entrada de RDP (título incluido,
// para que la tarjeta de la lista lo muestre actualizado) y persiste —
// mismo `save()` de siempre, que reescribe `fordoc/shared` entero (así
// funciona toda la app, no es nuevo de este cambio).
function persistEspacio(entryId, espacio){
  var entry = AppState.state.entries.find(function(e){ return e.id === entryId; });
  if(!entry) return;
  entry.espacio = espacio;
  entry.title = espacio.title || '';
  save();
}

function open(opts){
  closeOverlay(); // por si quedó algo abierto de una llamada anterior
  // Único punto de cierre real — lo usan el botón "✕" Y los mensajes
  // 'volver'/'cerrado' del protocolo, así los tres se comportan igual
  // (antes el "✕" cerraba el overlay SIN llamar a `onClose`, así que un
  // cierre por ese botón no refrescaba el panel de atrás).
  var doClose = function(){
    closeOverlay();
    if(opts.onClose) opts.onClose();
  };
  var built = buildOverlay(doClose);
  var espacio = entryToEspacio(opts.entry);
  var subirPermitido = opts.modo === 'editar' && !!AppState.driveAccessToken;

  function postToIframe(msg){
    try{ built.iframe.contentWindow.postMessage(msg, '*'); }catch(e){}
  }

  function handleMessage(ev){
    if(!built.iframe.contentWindow || ev.source !== built.iframe.contentWindow) return;
    var d = ev.data || {};
    if(d.fq === 'lista'){
      loadLibrosForFordoquera().then(function(libros){
        postToIframe({
          fq: 'abrir',
          espacio: espacio,
          modo: opts.modo,
          libros: libros,
          subir: subirPermitido,
          volver: opts.volver || 'Volver a la entrada',
          notas: !!opts.notas
        });
      });
      return;
    }
    if(d.fq === 'cambio'){
      espacio = d.espacio;
      if(opts.entryId) persistEspacio(opts.entryId, espacio);
      if(opts.onSaved) opts.onSaved(espacio);
      return;
    }
    if(d.fq === 'volver'){ doClose(); return; }
    if(d.fq === 'cerrado'){ doClose(); return; }
    if(d.fq === 'subir'){
      var pid = d.pid, file = d.archivo;
      if(!subirPermitido){
        postToIframe({ fq: 'subido', pid: pid, error: 'No hay permiso de Drive activo — cerrá sesión y volvé a entrar por "Soy del comando".' });
        return;
      }
      uploadEntryFile(file).then(function(shareUrl){
        postToIframe({ fq: 'subido', pid: pid, url: embeddableUrlForUpload(shareUrl, file.type) });
      }).catch(function(e){
        postToIframe({ fq: 'subido', pid: pid, error: (e && e.message) || 'No se pudo subir el archivo.' });
      });
      return;
    }
  }

  window.addEventListener('message', handleMessage);
  active = { messageHandler: handleMessage, overlayEl: built.overlay };
}

// Editor: abre la entrada (o una vacía recién creada) en modo edición —
// cualquier guardado dentro de la Fordoquera ({fq:'cambio'}) se persiste
// de una en Firestore. Al volver, se refresca el panel para que la
// tarjeta de la lista muestre el título nuevo.
export function openFordoqueraEditor(entryId){
  var entry = AppState.state.entries.find(function(e){ return e.id === entryId; });
  if(!entry) return;
  open({
    entry: entry,
    entryId: entryId,
    modo: 'editar',
    volver: 'Volver a la entrada',
    onClose: function(){ renderPanel(); }
  });
}

// Lector: abre la entrada en modo presentación — de solo lectura, sin
// `subir` (no hace falta: nunca se edita nada acá). El progreso (respuestas,
// en qué paso quedó, si la completó) lo guarda la Fordoquera SOLA, en el
// localStorage de su propio origen — no vuelve a RDP por ningún mensaje de
// este protocolo (ver CLAUDE.md, "progreso ya no es por persona/dispositivo
// — limitación aceptada de usar el protocolo real").
export function openFordoqueraViewer(entryId){
  var entry = AppState.state.entries.find(function(e){ return e.id === entryId; });
  if(!entry) return;
  open({
    entry: entry,
    modo: 'presentar',
    notas: false,
    onClose: function(){ render(); }
  });
}
