// Caché genérica en IndexedDB, clave→valor — usada por
// services/libros.service.js para no releer YouCat/la Biblia de Firestore
// en cada carga de página (pedido explícito del usuario, 09/10/2026:
// "Cargá una vez y guardalos en el navegador (IndexedDB)"). Sin ninguna
// dependencia externa — IndexedDB nativo, con `try/catch` en cada paso
// porque puede fallar o no estar disponible (ventana privada, storage
// bloqueado), mismo criterio ya usado en toda la sesión para localStorage.

var DB_NAME = 'fordoc-libros';
var STORE = 'kv';

function openDb(){
  return new Promise(function(resolve, reject){
    var req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function(){ req.result.createObjectStore(STORE); };
    req.onsuccess = function(){ resolve(req.result); };
    req.onerror = function(){ reject(req.error); };
  });
}

export async function idbGet(key){
  try{
    var db = await openDb();
    return await new Promise(function(resolve, reject){
      var tx = db.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).get(key);
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
  } catch(e){ return undefined; }
}

export async function idbSet(key, value){
  try{
    var db = await openDb();
    await new Promise(function(resolve, reject){
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = function(){ reject(tx.error); };
    });
  } catch(e){ /* sin caché persistente, no es fatal */ }
}
