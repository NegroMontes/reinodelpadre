// Decodificador del índice temático de YouCat (`libros/youcat_indices` en
// Firestore) — ver "Fordoquera incrustada" en CLAUDE.md (09/10/2026).
//
// Muchas entradas de `index[].r` mezclan números sueltos (un punto) con
// pares de rango (`[334, 336]`, "del punto 334 al 336") — Firestore rechaza
// de plano cualquier array que contenga directamente otro array como valor
// de campo ("Nested arrays are not supported"), así que al importar los
// datos (la importación de una sola vez, ya corrida y borrada del código —
// ver "Limpieza de libros-seed.service.js" en CLAUDE.md) cada rango se
// codificó como un mapa `{a, b}` en vez de un array — el documento quedó
// guardado así para siempre. Esto deshace esa codificación al leer, para
// que lo que recibe la Fordoquera incrustada sea exactamente el mismo shape
// que su propio `datos/youcat-indices.json` (cada elemento de `r` es
// `number | [number, number]`), sin perder fidelidad para la herramienta real.

export function decodeYoucatIndices(data){
  var index = (data.index || []).map(function(entry){
    var r = (entry.r || []).map(function(el){
      return (el && typeof el === 'object' && 'a' in el && 'b' in el) ? [el.a, el.b] : el;
    });
    return Object.assign({}, entry, { r: r });
  });
  return Object.assign({}, data, { index: index });
}
