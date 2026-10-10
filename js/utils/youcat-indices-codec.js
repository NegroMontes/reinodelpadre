// Codec de ida y vuelta para el índice temático de YouCat
// (seed-data/youcat_indices.json) — ver "Fordoquera incrustada" en
// CLAUDE.md (09/10/2026).
//
// Muchas entradas de `index[].r` mezclan números sueltos (un punto) con
// pares de rango guardados como un array de 2 elementos (`[334, 336]`, "del
// punto 334 al 336") — Firestore rechaza de plano cualquier array que
// contenga directamente otro array como valor de campo ("Nested arrays are
// not supported"), así que antes de escribir a Firestore cada rango se
// codifica como un mapa `{a, b}` (nunca un array) — y se decodifica de
// vuelta a `[a, b]` al leer, para que lo que recibe la Fordoquera incrustada
// sea exactamente el mismo shape que su propio `datos/youcat-indices.json`
// (cada elemento de `r` es `number | [number, number]`), sin perder
// fidelidad para la herramienta real.

export function encodeYoucatIndices(data){
  var index = (data.index || []).map(function(entry){
    var r = (entry.r || []).map(function(el){
      return Array.isArray(el) ? { a: el[0], b: el[1] } : el;
    });
    return Object.assign({}, entry, { r: r });
  });
  return Object.assign({}, data, { index: index });
}

export function decodeYoucatIndices(data){
  var index = (data.index || []).map(function(entry){
    var r = (entry.r || []).map(function(el){
      return (el && typeof el === 'object' && 'a' in el && 'b' in el) ? [el.a, el.b] : el;
    });
    return Object.assign({}, entry, { r: r });
  });
  return Object.assign({}, data, { index: index });
}
