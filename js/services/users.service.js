// Operaciones sobre la colección /users de Firestore: suscripción en
// vivo (solo para admins) y asignación/borrado de rol desde el panel
// "Usuarios".

import { onSnapshot, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, usersColRef } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { render, renderDayRail } from '../main.js';

  export function watchUsers(){
    if(AppState.unsubUsers) return;
    AppState.unsubUsers = onSnapshot(usersColRef, function(snap){
      var list = [];
      snap.forEach(function(d){ list.push(Object.assign({ uid: d.id }, d.data())); });
      list.sort(function(a,b){ return (a.displayName||'').localeCompare(b.displayName||''); });
      AppState.usersList = list;
      if(AppState.currentUser && AppState.currentUser.role === 'admin' && AppState.activeDayId === 'USERS'){ render(); }
      // El badge de "pendiente" en el sidebar se actualiza en vivo aunque el
      // admin esté mirando otra pestaña — mismo patrón que el badge de Comentarios.
      else if(AppState.currentUser && AppState.currentUser.role === 'admin'){ renderDayRail(); }
    });
  }


  export async function setUserRole(uid, role, seccion, depto, readDepartamentos, esFormacion){
    try{
      await setDoc(doc(db, 'users', uid), { role: role, seccion: seccion || null, depto: depto || null, readDepartamentos: !!readDepartamentos, esFormacion: !!esFormacion }, { merge: true });
    }catch(e){
      console.error('No se pudo actualizar el usuario:', e);
      alert('No se pudo guardar el cambio: ' + e.message);
    }
  }


  // Borra el perfil de un usuario de Firestore (colección `users`). No borra su
  // cuenta de Google ni nada fuera de esta app — solo el perfil/rol acá adentro.
  // Sirve, por ejemplo, para poder repetir el proceso de onboarding con el mismo
  // mail de prueba: al loguearse de nuevo sin perfil, vuelve a ver el formulario.
  export async function deleteUser(uid){
    try{
      await deleteDoc(doc(db, 'users', uid));
    }catch(e){
      console.error('No se pudo borrar el usuario:', e);
      alert('No se pudo borrar: ' + e.message);
    }
  }
