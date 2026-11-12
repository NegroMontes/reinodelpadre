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
// Desde el 12/11/2026 lo ganado vive en la libreta de puntos
// (`libreta/{uid}`, ver libreta.service.js), validada por las reglas.
import { AppState } from '../app-state.js';
import { libretaDe, miLibreta, sumarJuego, valorJuego, borrarJuegosDe } from './libreta.service.js';

export function juegosDe(u){ var l = u && libretaDe(u.uid); return (l && l.juegos) || {}; }

export function juegoGanado(clave){ var l = miLibreta(); return !!(l && l.juegos && l.juegos[clave]); }

export function bonusDe(u){ var l = u && libretaDe(u.uid); return (l && Number(l.gJ)) || 0; }

export function hoyClave(){
  var d = new Date();
  return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

// Devuelve los puntos sumados (0 si ya estaba ganado o no se puede guardar).
export function registrarJuego(clave){ return sumarJuego(clave); }

// Borra todo lo ganado por quien está logueado (botón del admin en Perfil,
// 07/11/2026) y las marcas locales de «ya se mostró hoy» de los eventos.
export function borrarMisJuegos(){
  var u = AppState.currentUser;
  if(!u) return Promise.resolve();
  try{ Object.keys(localStorage).forEach(function(k){ if(/^mj(Bandera|Sab)/.test(k)) localStorage.removeItem(k); }); }catch(e){}
  return borrarJuegosDe(u.uid);
}
export { valorJuego };
