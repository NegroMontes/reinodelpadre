// Firestore no acepta listas adentro de listas (ej. las filas de un paso
// «tabla» de la Fordoquera: `filas:[['a','b'],…]`) ni valores `undefined`:
// el `setDoc` entero falla y la entrada queda vacía (13/11/2026).
// Al guardar, cada lista que está adentro de otra se envuelve como
// `{__lista:[…]}` y los `undefined` se sacan; al leer se desenvuelve.

export function aFirestore(v, enLista){
  if(Array.isArray(v)){
    var arr = v.map(function(x){ return x === undefined ? null : aFirestore(x, true); });
    return enLista ? { __lista: arr } : arr;
  }
  if(v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype){
    var o = {};
    Object.keys(v).forEach(function(k){ if(v[k] !== undefined) o[k] = aFirestore(v[k], false); });
    return o;
  }
  return v;
}

export function deFirestore(v){
  if(Array.isArray(v)) return v.map(deFirestore);
  if(v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype){
    var keys = Object.keys(v);
    if(keys.length === 1 && keys[0] === '__lista' && Array.isArray(v.__lista)) return deFirestore(v.__lista);
    var o = {};
    keys.forEach(function(k){ o[k] = deFirestore(v[k]); });
    return o;
  }
  return v;
}
