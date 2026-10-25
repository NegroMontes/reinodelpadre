// Importar un libro más de la Fordoquera (libros/<id>.json de
// encuentros-pagina, ej. el Catecismo) a Firestore — botón admin-only en
// "Usuarios" (25/10/2026). A diferencia de YouCat/la Biblia (sembrados una
// sola vez desde seed-data/), este importador es genérico: el admin elige
// el .json desde su compu, así el texto (con derechos de autor) nunca pasa
// por el repo público.
//
// Forma en Firestore:
//   libros/extras             {ids:[...]}  — qué libros extra hay que cargar
//   libros/<id>               todos los campos del libro salvo `puntos`, + capCount
//   libros/<id>/caps/<cap>    {cap, puntosJson}
// `puntos` va como texto JSON porque cada punto trae `f` (párrafos → frases,
// un array de arrays) y Firestore no acepta arrays dentro de arrays.

import { doc, collection, writeBatch, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, librosColRef } from '../config/firebase.js';

var RESERVED_IDS = ['youcat', 'youcat_indices', 'biblia', 'extras'];

export async function importLibroFordoquera(libro, onProgress){
  var report = function(msg){ if(onProgress) onProgress(msg); };
  if(!libro || typeof libro.id !== 'string' || !Array.isArray(libro.puntos) || !Array.isArray(libro.caps)){
    throw new Error('Ese archivo no parece un libro de la Fordoquera (falta id, caps o puntos).');
  }
  var id = libro.id.replace(/[^a-z0-9-]/g, '');
  if(!id || RESERVED_IDS.indexOf(id) !== -1) throw new Error('Id de libro inválido: ' + libro.id);

  var byCap = {};
  libro.puntos.forEach(function(p){ var c = p.cap || 0; (byCap[c] = byCap[c] || []).push(p); });

  var meta = Object.assign({}, libro);
  delete meta.puntos;
  meta.capCount = libro.caps.length;

  var writes = [{ ref: doc(librosColRef, id), data: meta }];
  for(var cap = 0; cap < libro.caps.length; cap++){
    writes.push({
      ref: doc(collection(doc(librosColRef, id), 'caps'), String(cap)),
      data: { cap: cap, puntosJson: JSON.stringify(byCap[cap] || []) }
    });
  }

  // Lotes chicos: cada capítulo puede pesar ~300KB y un lote tiene tope ~10MB.
  for(var i = 0; i < writes.length; i += 10){
    report('Escribiendo ' + Math.min(i + 10, writes.length) + ' de ' + writes.length + '…');
    var batch = writeBatch(db);
    writes.slice(i, i + 10).forEach(function(w){ batch.set(w.ref, w.data); });
    await batch.commit();
  }
  var last = writeBatch(db);
  last.set(doc(librosColRef, 'extras'), { ids: arrayUnion(id) }, { merge: true });
  await last.commit();

  return 'Listo — «' + (libro.titulo || id) + '» (' + libro.puntos.length + ' puntos) ya está en Firestore.';
}
