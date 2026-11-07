// T10 — Minijuegos y huevos de pascua (07/11/2026).
// Lo que cada persona ganó se guarda en su perfil: `users/{uid}.juegos`
// (mapa clave → fecha en ms). Claves:
//   dia-<dayId>      minijuego del día de Mensaje (1 punto bonus)
//   depto-<juego>    juego de departamento que tocó ese día (1, solo la primera vez por juego)
//   huevo-<id>       huevo de pascua encontrado (2)
//   diana-<aaaammdd> toque de diana de ese día (1)
//   lluvia-<aaaammdd> zanjas en un día de lluvia (2)
//   estrellas-/zonda-/saboteador-<aaaammdd> eventos especiales (2), ver eventos.js
// El bonus NO cambia el rango ni el % del Tablero: se muestra aparte.
import { setDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { AppState } from '../app-state.js';

export function juegosDe(u){ return (u && u.juegos && typeof u.juegos === 'object') ? u.juegos : {}; }

export function juegoGanado(clave){ return !!juegosDe(AppState.currentUser)[clave]; }

function valor(clave){
  if(/^(huevo|lluvia|estrellas|zonda|saboteador)-/.test(clave)) return 2;
  return 1;
}

export function bonusDe(u){
  return Object.keys(juegosDe(u)).reduce(function(s, k){ return s + valor(k); }, 0);
}

export function hoyClave(){
  var d = new Date();
  return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

// Devuelve los puntos sumados (0 si ya estaba ganado o no se puede guardar).
export function registrarJuego(clave){
  var u = AppState.currentUser;
  if(!u || u.role === 'pendiente' || AppState.viewAsOverride) return 0;
  if(juegoGanado(clave)) return 0;
  var ahora = Date.now();
  u.juegos = Object.assign({}, juegosDe(u)); u.juegos[clave] = ahora;
  var parcial = {}; parcial[clave] = ahora;
  setDoc(doc(db, 'users', u.uid), { juegos: parcial }, { merge: true })
    .catch(function(e){ console.error('No se pudo guardar el juego:', e); });
  return valor(clave);
}

// Borra todo lo ganado por quien está logueado (botón del admin en Perfil,
// 07/11/2026) y las marcas locales de «ya se mostró hoy» de los eventos.
export function borrarMisJuegos(){
  var u = AppState.currentUser;
  if(!u) return Promise.resolve();
  u.juegos = {};
  try{ Object.keys(localStorage).forEach(function(k){ if(/^mj(Bandera|Sab)/.test(k)) localStorage.removeItem(k); }); }catch(e){}
  return updateDoc(doc(db, 'users', u.uid), { juegos: {} });
}
