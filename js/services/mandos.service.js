// Cuadro de mandos (08/10/2026) — movido de una constante estática en el
// código a Firestore (`mandos/data`), ver "Cuadro de mandos movido a
// Firestore" en CLAUDE.md. Se lee en vivo para cualquiera logueado (igual
// que `fordoc/shared`) — la migración de un solo uso que subía los datos
// desde `config/mandos-seed.js` ya se usó y se sacó del código (confirmado
// por el usuario, datos ya persistidos en Firestore real).

import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { mandosDocRef } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { render } from '../main.js';

  export function loadMandos(){
    return onSnapshot(mandosDocRef, function(snap){
      AppState.mandosData = snap.exists() ? snap.data() : null;
      AppState.mandosLoaded = true;
      render();
    }, function(err){
      console.error('No se pudo leer el cuadro de mandos:', err);
      AppState.mandosData = null;
      AppState.mandosLoaded = true;
      render();
    });
  }
