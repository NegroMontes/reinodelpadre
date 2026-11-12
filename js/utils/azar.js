// Azar chico, sin estado (copia de los de minijuegos.js, para usarlos sin
// bajar los minijuegos — carga diferida, 12/11/2026).
export function rnd(a, b){ return a + Math.random() * (b - a); }
export function rndInt(a, b){ return Math.floor(rnd(a, b + 1)); }
export function barajar(arr){ arr = arr.slice(); for(var i = arr.length - 1; i > 0; i--){ var j = rndInt(0, i); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
