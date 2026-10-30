// Cancionero (T6 E2, 30/10/2026): un documento por canto en la colección
// `cancionero` ({titulo, categoria, nota, estrofas:[{tipo, lineas}], orden}).
// Se empieza a leer recién al abrir Recursos → Vida espiritual.

import { onSnapshot, doc, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, cancioneroColRef, misasColRef } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { renderPanel } from '../main.js';

  export function ensureCancioneroSub(){
    if(AppState.unsubCancionero) return;
    AppState.unsubCancionero = onSnapshot(cancioneroColRef, function(snap){
      AppState.cancionero = snap.docs.map(function(d){ return Object.assign({}, d.data(), { id: d.id }); });
      AppState.cancioneroLoaded = true;
      if(AppState.activeDayId === 'RECURSOS') renderPanel();
    }, function(err){
      console.error('No se pudo leer el cancionero:', err);
      AppState.cancioneroLoaded = true;
      if(AppState.activeDayId === 'RECURSOS') renderPanel();
    });
  }

  export function stopCancioneroSub(){
    if(AppState.unsubCancionero){ AppState.unsubCancionero(); AppState.unsubCancionero = null; }
    AppState.cancionero = [];
    AppState.cancioneroLoaded = false;
    if(AppState.unsubMisas){ AppState.unsubMisas(); AppState.unsubMisas = null; }
    AppState.misas = [];
    AppState.misasLoaded = false;
  }

  // Misas armadas (30/10/2026): {nombre, subtitulo, tipo, momentos:{<momento>:[cantoId…]},
  // uid, autor, createdAt, updatedAt} — ver js/views/misas.js.
  export function ensureMisasSub(){
    if(AppState.unsubMisas) return;
    AppState.unsubMisas = onSnapshot(misasColRef, function(snap){
      AppState.misas = snap.docs.map(function(d){ return Object.assign({}, d.data(), { id: d.id }); });
      AppState.misasLoaded = true;
      if(AppState.activeDayId === 'RECURSOS') renderPanel();
    }, function(err){
      console.error('No se pudieron leer las misas:', err);
      AppState.misasLoaded = true;
      if(AppState.activeDayId === 'RECURSOS') renderPanel();
    });
  }

  export function saveMisa(misa){
    var data = Object.assign({}, misa);
    delete data.id;
    data.updatedAt = Date.now();
    return setDoc(doc(misasColRef, misa.id), data);
  }

  export function deleteMisa(id){
    return deleteDoc(doc(misasColRef, id));
  }

  export function saveCanto(canto){
    var data = Object.assign({}, canto);
    delete data.id;
    data.updatedAt = Date.now();
    return setDoc(doc(cancioneroColRef, canto.id), data);
  }

  export function deleteCanto(id){
    return deleteDoc(doc(cancioneroColRef, id));
  }

  // Importar desde un .json ({cantos:[…]}, botón admin). Un canto cuyo id
  // ya existe solo actualiza los campos que trae el archivo (ej. la letra
  // con acordes, `parte`); uno nuevo se crea entero, al final del orden.
  // Devuelve {nuevos, actualizados}.
  export async function importCancionero(json, onProgress){
    if(!json || !Array.isArray(json.cantos)) throw new Error('El archivo no tiene la lista de cantos.');
    var existentes = {};
    var maxOrden = -1;
    AppState.cancionero.forEach(function(c){ existentes[c.id] = true; if((c.orden || 0) > maxOrden) maxOrden = c.orden || 0; });
    var cantos = json.cantos.filter(function(c){ return c && c.id && (existentes[c.id] || c.titulo); });
    var res = { nuevos: 0, actualizados: 0 };
    for(var i = 0; i < cantos.length; i += 100){
      if(onProgress) onProgress('Escribiendo ' + Math.min(i + 100, cantos.length) + ' de ' + cantos.length + '…');
      var batch = writeBatch(db);
      cantos.slice(i, i + 100).forEach(function(c){
        var id = String(c.id).replace(/\//g, '-');
        var data = Object.assign({}, c, { updatedAt: Date.now() });
        delete data.id;
        if(existentes[id]){
          batch.set(doc(cancioneroColRef, id), data, { merge: true });
          res.actualizados++;
        } else {
          data.categoria = data.categoria || 'otros';
          data.nota = data.nota || '';
          data.estrofas = Array.isArray(data.estrofas) ? data.estrofas : [];
          if(data.orden == null) data.orden = ++maxOrden;
          batch.set(doc(cancioneroColRef, id), data);
          res.nuevos++;
        }
      });
      await batch.commit();
    }
    return res;
  }
