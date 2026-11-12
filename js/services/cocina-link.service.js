// Link de ingreso para el comando de cocina (12/11/2026). Quien entra con
// `?cocina=<código>` se registra directo como cocina (rol subjefe, sin
// sección), sin pasar por pendiente. El formulario normal ya no ofrece
// «Comando de cocina». El código vive en `codigosCocina/{código}`: las reglas
// dejan leer un código puntual a cualquiera logueado, pero no listarlos
// (solo el admin), así que no se puede adivinar ni sacar del código fuente.
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from '../config/firebase.js';

var CLAVE = 'rdpCocina';

// Se lee al cargar: si la dirección trae el código, se guarda para la pestaña
// (el login con Google no recarga la página, pero por las dudas) y se saca
// de la barra de direcciones.
(function(){
  try{
    var m = location.search.match(/[?&]cocina=([A-Za-z0-9]+)/);
    if(m){
      sessionStorage.setItem(CLAVE, m[1]);
      var q = location.search.replace(/([?&])cocina=[A-Za-z0-9]+&?/, '$1').replace(/[?&]$/, '');
      history.replaceState(null, '', location.pathname + q + location.hash);
    }
  }catch(e){}
})();

export function codigoCocina(){ try{ return sessionStorage.getItem(CLAVE) || ''; }catch(e){ return ''; } }
export function olvidarCodigoCocina(){ try{ sessionStorage.removeItem(CLAVE); }catch(e){} }

export function codigoCocinaValido(codigo){
  if(!codigo) return Promise.resolve(false);
  return getDoc(doc(db, 'codigosCocina', codigo)).then(function(s){ return s.exists(); }).catch(function(){ return false; });
}

export function linkDeCodigo(codigo){ return location.origin + location.pathname + '?cocina=' + codigo; }

// Solo admin (las reglas no dejan listar a nadie más).
export function codigoCocinaActual(){
  return getDocs(collection(db, 'codigosCocina')).then(function(q){ return q.docs.length ? q.docs[0].id : ''; });
}

function borrarTodos(){
  return getDocs(collection(db, 'codigosCocina')).then(function(q){ return Promise.all(q.docs.map(function(d){ return deleteDoc(doc(db, 'codigosCocina', d.id)); })); });
}

export function generarCodigoCocina(){
  var b = new Uint8Array(12); crypto.getRandomValues(b);
  var codigo = Array.from(b, function(x){ return ('0' + x.toString(16)).slice(-2); }).join('');
  return borrarTodos().then(function(){ return setDoc(doc(db, 'codigosCocina', codigo), { createdAt: Date.now() }); }).then(function(){ return codigo; });
}

export function desactivarCodigoCocina(){ return borrarTodos(); }
