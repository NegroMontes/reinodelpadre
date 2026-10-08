// "Comentarios": feedback de diseño/estética dejado con el botón
// flotante. Documentos sueltos en /feedback (no en /fordoc/shared).

import { onSnapshot, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, feedbackColRef } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { uid } from '../utils/helpers.js';
import { render, renderDayRail, currentPageLabel } from '../main.js';

  // "Comentarios" — feedback de diseño/estética dejado con el botón flotante.
  // Documentos sueltos en `feedback` (no en `fordoc/shared`): solo un admin
  // se suscribe a la colección completa; el resto del comando solo puede crear.
  export function watchFeedback(){
    if(AppState.unsubFeedback) return;
    AppState.unsubFeedback = onSnapshot(feedbackColRef, function(snap){
      var list = [];
      snap.forEach(function(d){ list.push(Object.assign({ id: d.id }, d.data())); });
      list.sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });
      AppState.feedbackList = list;
      if(AppState.currentUser && AppState.currentUser.role === 'admin' && AppState.activeDayId === 'FEEDBACK'){ render(); }
      // El badge de pendientes en el sidebar se actualiza en vivo aunque el admin
      // esté mirando otra pestaña — sin pisarle esa pestaña, solo se redibuja el rail.
      else if(AppState.currentUser && AppState.currentUser.role === 'admin'){ renderDayRail(); }
    });
  }


  export async function submitFeedback(text){
    try{
      await setDoc(doc(db, 'feedback', uid()), {
        text: text,
        author: AppState.currentUser.displayName,
        email: AppState.currentUser.email,
        role: AppState.currentUser.role,
        seccion: AppState.currentUser.seccion || null,
        depto: AppState.currentUser.depto || null,
        page: currentPageLabel(),
        createdAt: Date.now(),
        resuelto: false
      });
      return true;
    }catch(e){
      console.error('No se pudo enviar el comentario:', e);
      return false;
    }
  }


  export async function toggleFeedbackResuelto(id, resuelto){
    try{
      await setDoc(doc(db, 'feedback', id), { resuelto: resuelto }, { merge: true });
    }catch(e){
      console.error('No se pudo actualizar el comentario:', e);
      alert('No se pudo guardar el cambio: ' + e.message);
    }
  }


  export async function deleteFeedbackItem(id){
    try{
      await deleteDoc(doc(db, 'feedback', id));
    }catch(e){
      console.error('No se pudo borrar el comentario:', e);
      alert('No se pudo borrar: ' + e.message);
    }
  }
