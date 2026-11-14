// Avance de entradas "secuenciales": el progreso propio de cada quien
// (/entryProgress) y, para un admin, quién completó cada una.

import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
  // Una sola suscripción a TODA la colección (27/10/2026, la app tardaba en
  // cargar y no se actualizaba sola) — antes era una por entrada, así que con
  // muchas entradas se pasaba el límite recomendado de ~100 listeners por
  // cliente de Firestore. Se agrupa por `entryId` acá, en el cliente.
  function rebuildCompletions(){
    var byEntry = {};
    completionsDocs.forEach(function(data){
      if(!data.completedAt || !data.entryId) return;
      (byEntry[data.entryId] = byEntry[data.entryId] || []).push({ displayName: data.displayName || '(sin nombre)', completedAt: data.completedAt });
    });
    (AppState.state.entries || []).forEach(function(e){
      var list = (byEntry[e.id] || []).sort(function(a,b){ return a.completedAt - b.completedAt; });
      AppState.secuencialCompletionsCache[e.id] = list;
      // La primera vez que se ve una entrada, lo que ya había queda como
      // "visto" — la alerta es solo para completados NUEVOS.
      if(AppState.secuencialCompletionsSeenCount[e.id] === undefined){
        AppState.secuencialCompletionsSeenCount[e.id] = list.length;
      }
    });
  }
  var completionsDocs = null; // null hasta el primer snapshot

  export function ensureCompletionsSubs(){
    if(!realIsAdmin()) return;
    if(completionsDocs) rebuildCompletions(); // entradas nuevas en fordoc/shared
    if(AppState.secuencialCompletionsSubs._all) return;
    AppState.secuencialCompletionsSubs._all = onSnapshot(collection(db, 'entryProgress'), function(snap){
      completionsDocs = [];
      snap.forEach(function(d){ completionsDocs.push(d.data()); });
      rebuildCompletions();
      scheduleRender();
    }, function(err){
      console.error('No se pudo suscribir a quién completó la entrada:', err);
      (AppState.state.entries || []).forEach(function(e){ AppState.secuencialCompletionsCache[e.id] = 'error'; });
      scheduleRender();
    });
  }


  export function unsubAllCompletions(){
    Object.keys(AppState.secuencialCompletionsSubs).forEach(function(id){ AppState.secuencialCompletionsSubs[id](); });
    AppState.secuencialCompletionsSubs = {};
    AppState.secuencialCompletionsCache = {};
    AppState.secuencialCompletionsSeenCount = {};
    completionsDocs = null;
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


  // Una sola suscripción a los documentos propios (`where uid == yo`, lo que
  // las reglas de `entryProgress` dejan leer), en vez de una por entrada.
  export function ensureProgressSubs(){
    if(!AppState.currentUser || AppState.progressSubs._all) return;
    var q = query(collection(db, 'entryProgress'), where('uid', '==', AppState.currentUser.uid));
    AppState.progressSubs._all = onSnapshot(q, function(snap){
      var mine = {};
      snap.forEach(function(d){
        var data = d.data();
        if(data.entryId && data.uid === AppState.currentUser.uid) mine[data.entryId] = data;
      });
      AppState.myProgress = mine;
      AppState.myProgressLoaded = true;
      // Llegó al final pero cerró la página antes de los 30 s que pide la
      // regla (14/11/2026): se marca completada ahora.
      Object.keys(mine).forEach(function(id){
        var x = mine[id], ab = msDe(x.abiertoEn);
        if(x.terminado && !x.completedAt && ab != null) programarCompletado(id, ab + ESPERA_MS - Date.now());
      });
      scheduleRender();
    }, function(err){
      console.error('No se pudo suscribir a tu avance:', err);
    });
  }


  export function unsubAllProgress(){
    Object.keys(AppState.progressSubs).forEach(function(id){ AppState.progressSubs[id](); });
    AppState.progressSubs = {};
    AppState.myProgress = {};
    AppState.myProgressLoaded = false;
  }


  // Junta varios avisos seguidos en un solo redibujado.
  var renderPending = false;
  function scheduleRender(){
    if(renderPending) return;
    renderPending = true;
    setTimeout(function(){
      renderPending = false;
      if(!AppState.formOpen) render();
    }, 50);
  }


  // Reglas de Firestore (12/11/2026): `abiertoEn` lo pone el servidor la
  // primera vez que se abre la entrada, y `completedAt` solo se acepta pasados
  // 30 segundos desde ahí (y no se puede cambiar después). Esto arma lo que se
  // manda respetando eso; si todavía no pasaron, la marca de completada se
  // manda sola después (mientras la página siga abierta).
  var ESPERA_MS = 32000;
  var pendientesCompletar = {};
  // Cuándo se mandó `abiertoEn` desde este dispositivo: mientras el servidor no
  // confirma, Firestore lo lee como null, y mandarlo de nuevo lo rechazaría la regla.
  var abiertoEnviado = {};
  function msDe(t){ return t == null ? null : (typeof t === 'number' ? t : (t.toMillis ? t.toMillis() : (t.seconds ? t.seconds * 1000 : null))); }
  function camposBase(entryId){
    var u = AppState.currentUser, prev = AppState.myProgress[entryId] || null;
    var d = { entryId: entryId, uid: u.uid, displayName: u.displayName, updatedAt: Date.now() };
    if((!prev || prev.abiertoEn == null) && !abiertoEnviado[entryId]){ d.abiertoEn = serverTimestamp(); abiertoEnviado[entryId] = Date.now(); }
    return d;
  }
  function programarCompletado(entryId, esperaMs){
    if(pendientesCompletar[entryId]) return;
    pendientesCompletar[entryId] = setTimeout(function(){
      delete pendientesCompletar[entryId];
      var prev = AppState.myProgress[entryId];
      if(prev && prev.completedAt) return;
      setDoc(progressDocRef(entryId), { completedAt: Date.now(), updatedAt: Date.now() }, { merge: true })
        .catch(function(e){ console.error('No se pudo marcar la entrada como completada:', e); });
    }, Math.max(1000, esperaMs));
  }
  // Agrega `completedAt` a `data` si se puede ahora; si no, lo programa.
  function quizasCompletar(entryId, data){
    var prev = AppState.myProgress[entryId] || null;
    if(prev && prev.completedAt) return;
    var abierto = (prev && msDe(prev.abiertoEn)) || abiertoEnviado[entryId] || null;
    var falta = abierto == null ? ESPERA_MS + 3000 : (abierto + ESPERA_MS) - Date.now();
    if(abierto != null && falta <= 0){ data.completedAt = Date.now(); return; }
    programarCompletado(entryId, falta);
  }

  export async function saveProgressAnswer(entryId, stepIdx, text){
    try{
      var prev = (AppState.myProgress[entryId] && AppState.myProgress[entryId].respuestas) || {};
      var respuestas = Object.assign({}, prev);
      respuestas[stepIdx] = text;
      var data = camposBase(entryId); data.respuestas = respuestas;
      await setDoc(progressDocRef(entryId), data, { merge: true });
    }catch(e){ console.error('No se pudo guardar tu respuesta:', e); }
  }


  export async function markProgressCompleted(entryId){
    try{
      var data = camposBase(entryId);
      quizasCompletar(entryId, data);
      await setDoc(progressDocRef(entryId), data, { merge: true });
    }catch(e){ console.error('No se pudo guardar tu avance:', e); }
  }


  // Progreso que manda la Fordoquera incrustada, versión 2 del protocolo
  // (11/10/2026, Fordoquera 9.9) — `{fq:'progreso', paso, pasos, completado,
  // respuestas}`, recibido en `fordoquera-embed.js` (modo 'presentar') y
  // persistido acá con el mismo documento `entryProgress/<entryId>_<uid>`.
  export async function saveFordoqueraProgreso(entryId, msg){
    if(!AppState.currentUser || !AppState.myProgressLoaded) return;
    try{
      var data = camposBase(entryId);
      data.paso = msg.paso; data.pasos = msg.pasos; data.respuestas = msg.respuestas || {};
      if(msg.completado){ data.terminado = true; quizasCompletar(entryId, data); }
      await setDoc(progressDocRef(entryId), data, { merge: true });
    }catch(e){ delete abiertoEnviado[entryId]; console.error('No se pudo guardar el progreso de la Fordoquera:', e); }
  }
