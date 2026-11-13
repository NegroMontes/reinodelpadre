// «Visto hasta» de la campana de Novedades y del badge de usuarios nuevos,
// guardado también en el perfil (13/11/2026): antes vivía solo en el
// localStorage de cada sitio, así que lo visto en Netlify seguía como nuevo
// en GitHub Pages (y al revés). Campos `users/{uid}.vistoNovedades` y
// `.vistoUsuarios` (ms).

import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { AppState } from '../app-state.js';

export function guardarVisto(campo, ts){
  var u = AppState.currentUser;
  if(!u || !u.uid) return;
  if((u[campo] || 0) >= ts) return;
  u[campo] = ts;
  var cambio = {}; cambio[campo] = ts;
  updateDoc(doc(db, 'users', u.uid), cambio).catch(function(e){ console.warn('No se pudo guardar ' + campo + ':', e); });
}
