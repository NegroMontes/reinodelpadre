// Importación de una sola vez de YouCat + la Biblia a Firestore (ver
// "Fordoquera incrustada" en CLAUDE.md, 09/10/2026) — mismo patrón ya usado
// para el cuadro de mandos (`mandos-seed.js`, borrado apenas se confirmó la
// migración con Firebase real): los datos fuente viven en `seed-data/`,
// NUNCA se publican al espejo público (ver tools/publish-public-mirror.sh)
// porque son textos con derechos de autor (YouCat, la Biblia — traducción
// argentina © Fundación Palabra de Vida). Pensado para correrse UNA sola
// vez, desde un botón admin-only en la pestaña "Usuarios" — avisar cuando
// ya corrió para borrar `seed-data/` del repo, igual que se hizo con
// `mandos-seed.js`.
//
// Se leen vía `fetch()` (no `import`), porque son JSON puros, no módulos —
// y porque el payload total (~6.8MB) no tiene sentido cargarlo como parte
// del bundle de JS de la app, solo lo necesita quien corre la importación.

import { doc, writeBatch, collection } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, librosColRef } from '../config/firebase.js';
import { encodeYoucatIndices } from '../utils/youcat-indices-codec.js';

async function fetchJson(path){
  var res = await fetch(path, { cache: 'no-store' });
  if(!res.ok) throw new Error('No se pudo leer ' + path + ' (HTTP ' + res.status + ')');
  return res.json();
}

// Firestore permite hasta 500 operaciones y ~10MB por lote — se reparten
// los ~82 documentos en lotes chicos para no acercarse a ningún límite.
async function commitInBatches(writes, batchSize){
  for(var i = 0; i < writes.length; i += batchSize){
    var slice = writes.slice(i, i + batchSize);
    var batch = writeBatch(db);
    slice.forEach(function(w){ batch.set(w.ref, w.data); });
    await batch.commit();
  }
}

// Lee `seed-data/` y escribe todo a Firestore. Devuelve un resumen de texto
// para mostrarle al admin. Tira si falta algún archivo — mejor cortar ahí
// que dejar la biblioteca a medio importar.
export async function seedLibrosFromFiles(onProgress){
  var report = function(msg){ if(onProgress) onProgress(msg); };
  var writes = [];

  report('Leyendo YouCat…');
  var ycMeta = await fetchJson('seed-data/youcat/meta.json');
  writes.push({ ref: doc(librosColRef, 'youcat'), data: ycMeta });
  for(var i = 0; i < ycMeta.chunkCount; i++){
    var chunk = await fetchJson('seed-data/youcat/chunks/' + i + '.json');
    writes.push({ ref: doc(collection(doc(librosColRef, 'youcat'), 'chunks'), String(i)), data: chunk });
  }

  report('Leyendo el índice de YouCat…');
  var ycIx = await fetchJson('seed-data/youcat_indices.json');
  // Ver utils/youcat-indices-codec.js: `index[].r` mezcla números sueltos
  // con pares de rango `[a,b]` — Firestore rechaza un array que contenga
  // directamente otro array, así que cada rango se codifica como {a,b}
  // antes de escribir (se decodifica de vuelta al leer, en libros.service.js).
  writes.push({ ref: doc(librosColRef, 'youcat_indices'), data: encodeYoucatIndices(ycIx) });

  report('Leyendo la Biblia (puede tardar, son 76 libros)…');
  var bibMeta = await fetchJson('seed-data/biblia/meta.json');
  writes.push({ ref: doc(librosColRef, 'biblia'), data: bibMeta });
  var caps = bibMeta.caps || [];
  for(var cap = 0; cap < caps.length; cap++){
    var libro = await fetchJson('seed-data/biblia/libros/' + cap + '.json');
    writes.push({ ref: doc(collection(doc(librosColRef, 'biblia'), 'libros'), String(cap)), data: libro });
  }

  report('Escribiendo ' + writes.length + ' documentos en Firestore…');
  await commitInBatches(writes, 15);

  return 'Listo — YouCat (' + ycMeta.chunkCount + ' bloques) y la Biblia (' + caps.length + ' libros) ya están en Firestore.';
}
