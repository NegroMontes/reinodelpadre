// Avance de entradas "secuenciales": el progreso propio de cada quien
// (/entryProgress) y, para un admin, quién completó cada una.

import { collection, query, where, onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { isAdmin, realIsAdmin } from './permissions.js';
import { render } from '../main.js';

  // Avance de entradas "secuenciales" — a diferencia de "Comentarios" (una
  // sola suscripción de admin a toda la colección), acá cada persona solo
  // necesita SUS propios documentos de avance, uno por entrada secuencial
  // visible. `progressSubs` evita suscribirse dos veces al mismo doc;
  // `ensureProgressSubs()` se llama cada vez que llega contenido nuevo de
  // `fordoc/shared` (ver `load()`), así una entrada secuencial nueva queda
  // cubierta sin que haga falta re-loguearse.
  // "¿Quién completó esta misión?" (22/09/2026, comentario del usuario) — solo
  // para admin, ver más abajo (`canSeeCompletions`). No es una suscripción en
  // vivo como `myProgress` — es una consulta puntual (`getDocs`) disparada al
  // abrir el panel de una entrada, cacheada por entryId para no repetirla si
  // se cierra y se vuelve a abrir. Requiere que las reglas de Firestore de
  // `entryProgress` ya estén publicadas (ver CLAUDE.md) — antes de eso, la
  // consulta va a fallar en silencio y el panel muestra "No se pudo cargar".
  // Cuántos completados ya "vio" el admin por entrada (pedido del usuario,
  // 23/09/2026: mostrar el número al lado del botón y avisar si entra gente
  // nueva) — se actualiza a la cantidad actual cada vez que se abre el panel
  // de esa entrada; mientras tanto, si el conteo en vivo supera este valor,
  // se considera que "hay nuevos" y se muestra el punto de alerta.
  export function canSeeCompletions(){ return isAdmin(); }


  // Suscripción en vivo (pedido del usuario, 23/09/2026) — antes era una
  // consulta puntual (`getDocs`) disparada recién al abrir el panel, así que
  // el número de completados no podía mostrarse de entrada ni avisar de
  // gente nueva sin haber abierto el panel primero. Mismo patrón que
  // `ensureProgressSubs()`, pero por entrada suma TODOS los que la
  // completaron (solo para el admin real — las reglas de Firestore de
  // `entryProgress` solo dejan leer cualquier doc ajeno a un admin).
  // El mock de este sandbox no filtra por `where()` en un `onSnapshot` de
  // colección (sí lo hace en `getDocs`) — por eso se filtra `entryId` acá
  // mismo, en el cliente, además del `where` de la query (redundante contra
  // Firestore real, pero necesario para que el mock ande igual).
  export function ensureCompletionsSubs(){
    if(!realIsAdmin()) return;
    (AppState.state.entries || []).forEach(function(e){
      if(e.type === 'secuencial' && !AppState.secuencialCompletionsSubs[e.id]){
        var q = query(collection(db, 'entryProgress'), where('entryId', '==', e.id));
        AppState.secuencialCompletionsSubs[e.id] = onSnapshot(q, function(snap){
          var list = [];
          snap.forEach(function(d){
            var data = d.data();
            if(data.entryId === e.id && data.completedAt){
              list.push({ displayName: data.displayName || '(sin nombre)', completedAt: data.completedAt });
            }
          });
          list.sort(function(a,b){ return a.completedAt - b.completedAt; });
          AppState.secuencialCompletionsCache[e.id] = list;
          // La primera vez que llega data para esta entrada, lo que ya había
          // queda como "visto" — la alerta es solo para completados NUEVOS
          // desde que empezó a mirarse, no retroactiva a lo que ya existía.
          if(AppState.secuencialCompletionsSeenCount[e.id] === undefined){
            AppState.secuencialCompletionsSeenCount[e.id] = list.length;
          }
          if(!AppState.formOpen) render();
        }, function(err){
          console.error('No se pudo suscribir a quién completó la entrada:', err);
          AppState.secuencialCompletionsCache[e.id] = 'error';
          if(!AppState.formOpen) render();
        });
      }
    });
  }


  export function unsubAllCompletions(){
    Object.keys(AppState.secuencialCompletionsSubs).forEach(function(id){ AppState.secuencialCompletionsSubs[id](); });
    AppState.secuencialCompletionsSubs = {};
    AppState.secuencialCompletionsCache = {};
    AppState.secuencialCompletionsSeenCount = {};
  }


  // Un documento por persona+entrada, id determinístico `<entryId>_<uid>`, así
  // no hace falta una query con `where` (que el mock de este sandbox no
  // soporta): cada quien se suscribe directo al doc que le corresponde. Las
  // reglas de Firestore solo dejan leer/escribir el propio (o a un admin
  // leer cualquiera, pensando en el futuro tablero de puntos) — ver CLAUDE.md.
  // (Definida acá adentro, no junto a los demás *ColRef/*DocRef de más arriba,
  // porque necesita `currentUser`, que solo existe en este scope.)
  export function progressDocRef(entryId){
    return doc(db, 'entryProgress', entryId + '_' + AppState.currentUser.uid);
  }


  export function ensureProgressSubs(){
    if(!AppState.currentUser) return;
    (AppState.state.entries || []).forEach(function(e){
      if(e.type === 'secuencial' && !AppState.progressSubs[e.id]){
        AppState.progressSubs[e.id] = onSnapshot(progressDocRef(e.id), function(snap){
          AppState.myProgress[e.id] = snap.exists() ? snap.data() : null;
          if(!AppState.formOpen) render();
        });
      }
    });
  }


  export function unsubAllProgress(){
    Object.keys(AppState.progressSubs).forEach(function(id){ AppState.progressSubs[id](); });
    AppState.progressSubs = {};
    AppState.myProgress = {};
  }


  export async function saveProgressAnswer(entryId, stepIdx, text){
    try{
      // Se relee lo ya guardado (del cache local, que viene del listener en
      // vivo) y se arma el mapa `respuestas` completo de nuevo, en vez de
      // mandar una escritura parcial — así no hace falta depender de paths
      // con punto (`respuestas.0`) para un merge anidado, que el mock de
      // este sandbox no interpreta igual que Firestore real.
      var prev = (AppState.myProgress[entryId] && AppState.myProgress[entryId].respuestas) || {};
      var respuestas = Object.assign({}, prev);
      respuestas[stepIdx] = text;
      await setDoc(progressDocRef(entryId), {
        entryId: entryId, uid: AppState.currentUser.uid, displayName: AppState.currentUser.displayName,
        respuestas: respuestas, updatedAt: Date.now()
      }, { merge: true });
    }catch(e){ console.error('No se pudo guardar tu respuesta:', e); }
  }


  export async function markProgressCompleted(entryId){
    try{
      await setDoc(progressDocRef(entryId), {
        entryId: entryId, uid: AppState.currentUser.uid, displayName: AppState.currentUser.displayName,
        completedAt: Date.now()
      }, { merge: true });
    }catch(e){ console.error('No se pudo guardar tu avance:', e); }
  }
