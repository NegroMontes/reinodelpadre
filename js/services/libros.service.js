// Bibliotecas (YouCat + la Biblia) para la Fordoquera incrustada — ver
// "Fordoquera incrustada" en CLAUDE.md (09/10/2026). El protocolo
// (index.html de encuentros-pagina, sección "Fordoquera incrustada") pide
// mandarle a la Fordoquera `libros: {youcat, indices:{youcat}, libros:[biblia]}`
// con el formato que ella misma usa (datos/youcat.json, datos/youcat-indices.json,
// libros/biblia.json de ese repo) — acá se arma ese mismo shape a partir de
// los documentos partidos en Firestore (ver config/firebase.js, `librosColRef`).
//
// Se carga una sola vez por navegador: primero se prueba IndexedDB
// (utils/idb-cache.js); si no hay nada ahí (primera vez en este
// dispositivo), se lee de Firestore y se guarda en IndexedDB para la
// próxima. Nunca se vuelve a leer Firestore después de la primera vez,
// salvo que cambie LIBROS_CACHE_VERSION (si algún día se resiembran los
// datos) — el texto de YouCat/la Biblia no cambia solo.

import { doc, getDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, librosColRef } from '../config/firebase.js';
import { idbGet, idbSet } from '../utils/idb-cache.js';
import { decodeYoucatIndices } from '../utils/youcat-indices-codec.js';

var LIBROS_CACHE_VERSION = 1;
var CACHE_KEY = 'libros-fordoquera-v' + LIBROS_CACHE_VERSION;

var memoCache = null; // en memoria, para no releer IndexedDB en cada apertura del editor/lector en la misma sesión de pestaña

async function fetchYoucatFromFirestore(){
  var metaSnap = await getDoc(doc(librosColRef, 'youcat'));
  var meta = metaSnap.exists() ? metaSnap.data() : { chunkCount: 0 };
  var chunksSnap = await getDocs(collection(doc(librosColRef, 'youcat'), 'chunks'));
  var byIndex = {};
  chunksSnap.forEach(function(d){ byIndex[d.id] = d.data(); });
  var puntos = [];
  for(var i = 0; i < meta.chunkCount; i++){
    var c = byIndex[String(i)];
    if(c && Array.isArray(c.puntos)) puntos = puntos.concat(c.puntos);
  }
  return puntos;
}

async function fetchYoucatIndicesFromFirestore(){
  var snap = await getDoc(doc(librosColRef, 'youcat_indices'));
  if(!snap.exists()) return { index: [], defs: [] };
  // Deshace la codificación de rangos de libros-seed.service.js — ver
  // utils/youcat-indices-codec.js.
  return decodeYoucatIndices(snap.data());
}

async function fetchBibliaFromFirestore(){
  var metaSnap = await getDoc(doc(librosColRef, 'biblia'));
  if(!metaSnap.exists()) return null;
  var meta = metaSnap.data();
  var librosSnap = await getDocs(collection(doc(librosColRef, 'biblia'), 'libros'));
  var byCap = {};
  librosSnap.forEach(function(d){ var data = d.data(); byCap[data.cap] = data.puntos || []; });
  var puntos = [];
  var caps = meta.caps || [];
  for(var cap = 0; cap < caps.length; cap++){
    puntos = puntos.concat(byCap[cap] || []);
  }
  var out = Object.assign({}, meta);
  out.puntos = puntos;
  return out;
}

// Trae las 3 piezas de Firestore en paralelo y arma el shape que espera la
// Fordoquera. Si falta alguna (todavía no se corrió la importación, ver
// views/users.js → botón admin-only "Importar libros") esa pieza queda
// vacía/ausente en vez de romper — la Fordoquera ya tolera bibliotecas
// faltantes (rebuildOrder() oculta la pestaña correspondiente si no hay
// datos, ver index.html de encuentros-pagina).
async function loadFromFirestore(){
  var results = await Promise.allSettled([
    fetchYoucatFromFirestore(),
    fetchYoucatIndicesFromFirestore(),
    fetchBibliaFromFirestore()
  ]);
  var youcat = results[0].status === 'fulfilled' ? results[0].value : [];
  var indicesYoucat = results[1].status === 'fulfilled' ? results[1].value : { index: [], defs: [] };
  var biblia = results[2].status === 'fulfilled' ? results[2].value : null;
  return {
    youcat: youcat,
    indices: { youcat: indicesYoucat },
    libros: biblia ? [biblia] : []
  };
}

// Devuelve `{youcat, indices:{youcat}, libros:[biblia]}`, listo para el
// campo `libros` del mensaje `{fq:'abrir', ...}` — ver
// components/fordoquera-embed.js.
export async function loadLibrosForFordoquera(){
  if(memoCache) return memoCache;
  var cached = await idbGet(CACHE_KEY);
  if(cached && cached.youcat && cached.youcat.length){
    memoCache = cached;
    return cached;
  }
  var fresh = await loadFromFirestore();
  // Solo se cachea en memoria (y en IndexedDB) si de verdad trajo contenido
  // — si todavía no se corrió "Importar libros" (o se corrió a medias), el
  // resultado queda vacío, y cachear ESE resultado vacío en `memoCache`
  // dejaría la Fordoquera mostrando bibliotecas vacías para el resto de la
  // sesión en esta pestaña, aunque el admin importe los datos un minuto
  // después (encontrado al verificar esta feature, 09/10/2026: abrir
  // cualquier entrada ANTES de correr el botón "Importar libros" poisoneaba
  // el cache en memoria para siempre, hasta recargar la página).
  if(fresh.youcat.length || fresh.libros.length){
    memoCache = fresh;
    idbSet(CACHE_KEY, fresh); // no se espera — si falla, simplemente no quedó cacheado, sin romper nada
  }
  return fresh;
}
