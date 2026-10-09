// Convierte una entrada de RDP al "espacio" que espera la Fordoquera
// incrustada — ver "Fordoquera incrustada" en CLAUDE.md (09/10/2026). Desde
// este cambio, una entrada NUEVA guarda su contenido directo como
// `entry.espacio` (el objeto tal cual lo persiste la Fordoquera — ver
// `incrEspacio()` en su propio index.html), sin pasar por ningún modelo
// propio de RDP. `entryToEspacio()` devuelve ESE objeto si ya existe, o lo
// sintetiza al vuelo a partir de los dos formatos viejos que pudo haber
// tenido una entrada creada antes de este cambio — nunca escribe nada:
// la migración real recién queda guardada cuando la Fordoquera manda su
// primer `{fq:'cambio'}` (ver components/fordoquera-embed.js).

import { uid } from './helpers.js';
import { convertRdpStep, convertRdpEntryToEncuentro } from './encuentros-interop.js';

// Una entrada "secuencial" (06/10/2026-09/10/2026, el modelo propio de RDP
// con pasos texto/pregunta/proposito/imagen/video/audio/pdf/enlace/libro/
// grupo) ya tiene un conversor completo, hecho para la importación/
// exportación con Encuentros — se reusa entero acá.
function espacioFromSecuencialEntry(entry){
  var enc = convertRdpEntryToEncuentro(entry).enc; // {id, title, steps, music?}
  var fecha = new Date(entry.createdAt || Date.now()).toISOString().slice(0, 10);
  var out = {
    id: enc.id, title: enc.title || '', sub: '', date: fecha, goal: '', intro: '', closing: {},
    steps: enc.steps || [], created: entry.createdAt || Date.now(), updated: entry.createdAt || Date.now()
  };
  if(enc.music) out.music = enc.music;
  return out;
}

// Una entrada de TIPO SIMPLE (de antes del 06/10/2026 — texto/enlace/
// imagen/video/audio/pdf/libro a nivel de la entrada entera, sin `steps`)
// se sintetiza como un único paso, reusando `convertRdpStep()` (ya sabe
// mapear un `book.lib` de RDP a su equivalente de Encuentros) sobre un
// objeto armado con forma de "paso" a partir de los campos sueltos de la
// entrada vieja.
function espacioFromLegacySimpleEntry(entry){
  var fakeStep;
  if(entry.type === 'libro'){
    fakeStep = { type: 'libro', book: entry.book || {} };
  } else if(entry.type === 'enlace'){
    // El viejo tipo "Enlace" guardaba el texto del link en `body` — el
    // conversor de pasos no tiene un campo para eso en este tipo (ver nota
    // en convertRdpStep), así que se antepone como `preText`: queda como
    // una aproximación razonable, no una pérdida de contenido.
    fakeStep = { type: 'enlace', url: entry.url || '', preText: entry.body || '' };
  } else if(entry.type === 'imagen' || entry.type === 'video' || entry.type === 'audio' || entry.type === 'pdf'){
    fakeStep = { type: entry.type, url: entry.url || '', preText: entry.body || '', postText: entry.bodyAfter || '' };
  } else {
    // 'texto', o cualquier otro caso no anticipado: un texto simple con lo
    // que haya en `body`, nunca se pierde el contenido entero.
    fakeStep = { type: 'texto', text: entry.body || '' };
  }
  var converted = convertRdpStep(fakeStep, 's' + uid());
  var steps = converted ? [converted] : [];
  var fecha = new Date(entry.createdAt || Date.now()).toISOString().slice(0, 10);
  return {
    id: 'e' + uid(), title: entry.title || '', sub: '', date: fecha, goal: '', intro: '', closing: {},
    steps: steps, created: entry.createdAt || Date.now(), updated: entry.createdAt || Date.now()
  };
}

// Función principal — nunca devuelve `null`: una entrada completamente
// vacía (nunca tuvo contenido) cae en un espacio en blanco, igual que
// `createEnc()` del lado de la Fordoquera.
export function entryToEspacio(entry){
  if(entry.espacio && Array.isArray(entry.espacio.steps)) return entry.espacio;
  if(entry.type === 'secuencial' && Array.isArray(entry.steps)) return espacioFromSecuencialEntry(entry);
  if(entry.type){ return espacioFromLegacySimpleEntry(entry); }
  var fecha = new Date(entry.createdAt || Date.now()).toISOString().slice(0, 10);
  return { id: 'e' + uid(), title: entry.title || '', sub: '', date: fecha, goal: '', intro: '', closing: {}, steps: [], created: entry.createdAt || Date.now(), updated: entry.createdAt || Date.now() };
}
