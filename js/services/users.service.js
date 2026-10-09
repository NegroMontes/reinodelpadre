// Operaciones sobre la colección /users de Firestore: suscripción en
// vivo (solo para admins) y asignación/borrado de rol desde el panel
// "Usuarios".

import { onSnapshot, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, usersColRef } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { render, renderDayRail } from '../main.js';

  // Se suscribe para admins (pestaña "Usuarios", con edición) Y, desde
  // 09/10/2026, también para cualquier comando no-admin (jefe de sección/
  // depto, subjefe, consagrado) — ellos lo usan de solo lectura, en "Mi
  // comando" (ver views/mandos.js). Un miliciano o alguien "pendiente"
  // nunca dispara esto (ver auth.service.js) — ni siquiera cargan la lista
  // completa del comando en su propio estado del cliente.
  export function watchUsers(){
    if(AppState.unsubUsers) return;
    AppState.unsubUsers = onSnapshot(usersColRef, function(snap){
      var list = [];
      snap.forEach(function(d){ list.push(Object.assign({ uid: d.id }, d.data())); });
      list.sort(function(a,b){ return (a.displayName||'').localeCompare(b.displayName||''); });
      AppState.usersList = list;
      if(!AppState.currentUser) return;
      if(AppState.currentUser.role === 'admin'){
        if(AppState.activeDayId === 'USERS'){ render(); }
        // El badge de "pendiente" en el sidebar se actualiza en vivo aunque el
        // admin esté mirando otra pestaña — mismo patrón que el badge de Comentarios.
        else { renderDayRail(); }
      } else if(AppState.activeDayId === 'MANDOS' && AppState.mandosActiveSubTab === 'micomando'){
        render();
      }
    });
  }


  // `actividadFavorita` es opcional (09/10/2026) — antes solo se cargaba una
  // vez, en el formulario de onboarding (y ni siquiera el admin bootstrap
  // pasa por ahí, así que nunca tenía una propia). Un admin ahora puede
  // cargarla/corregirla desde acá, para cualquier usuario — `undefined`
  // deja el campo tal como estaba (para no pisarlo con '' cuando se llama
  // desde algún lugar que todavía no lo pasa).
  export async function setUserRole(uid, role, seccion, depto, readDepartamentos, esFormacion, actividadFavorita){
    try{
      var data = { role: role, seccion: seccion || null, depto: depto || null, readDepartamentos: !!readDepartamentos, esFormacion: !!esFormacion };
      if(actividadFavorita !== undefined) data.actividadFavorita = actividadFavorita;
      await setDoc(doc(db, 'users', uid), data, { merge: true });
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
