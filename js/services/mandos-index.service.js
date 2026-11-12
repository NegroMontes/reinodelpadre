// Índice de puestos (12/11/2026, seguridad del registro). Un documento por
// nombre de la resolución en `mandosIndex/{clave}` con el rol, la sección o
// el departamento que le corresponde y quién ya lo tiene (`uid`). Las reglas
// de Firestore lo usan para que nadie se cree un rol que no coincide con la
// resolución, ni un segundo dueño para el mismo puesto. Lo arma el admin:
// solo al actualizar el cuadro de mandos o con «Actualizar índice de puestos».
import { doc, getDocs, collection, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { normalizeName } from '../utils/helpers.js';
import { buildMandosIndex, findMandoByName } from '../utils/mandos-matcher.js';

export function claveDeNombre(nombre){
  return normalizeName(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sin-nombre';
}

// El perfil que le da cada puesto (mismo criterio que submitOnboarding()).
export function perfilDePuesto(b){
  var base = { seccion: null, depto: null, seccionLibre: false, esFormacion: false, readDepartamentos: false };
  if(b.type === 'jefe_seccion') return Object.assign(base, { role: 'jefe_seccion', seccion: b.seccion || null });
  if(b.type === 'formacion_member') return Object.assign(base, { role: 'jefe_seccion', seccionLibre: true, esFormacion: true });
  if(b.type === 'jefe_depto') return Object.assign(base, { role: 'jefe_seccion', depto: b.depto || null });
  if(b.type === 'lector_depto') return Object.assign(base, { role: 'subjefe', depto: b.depto || null });
  if(b.type === 'capellan') return Object.assign(base, { role: 'consagrado', seccion: b.seccion || null, readDepartamentos: true });
  if(b.type === 'lector') return Object.assign(base, { role: 'subjefe', seccion: b.seccion || null });
  return null; // comando central: siempre a mano
}

var col = function(){ return collection(db, 'mandosIndex'); };

// Rearma el índice desde la resolución. Respeta quién ya tiene cada puesto
// y reconoce por nombre a los que se registraron antes de que existiera.
export async function regenerarIndiceMandos(){
  var idx = buildMandosIndex(AppState.mandosData);
  var cuenta = {};
  idx.forEach(function(e){ cuenta[e.norm] = (cuenta[e.norm] || 0) + 1; });
  var actuales = {};
  (await getDocs(col())).docs.forEach(function(d){ actuales[d.id] = d.data() || {}; });
  var usuarios = AppState.usersList || [];
  var existe = {}; usuarios.forEach(function(u){ existe[u.uid || u.id] = u; });
  // Registrados con rol del comando → su puesto por nombre.
  var dueno = {};
  usuarios.forEach(function(u){
    var id = u.uid || u.id;
    if(!id || ['jefe_seccion', 'subjefe', 'consagrado', 'admin'].indexOf(u.role) < 0) return;
    var f = findMandoByName(u.displayName || '', idx);
    if(f){ var c = claveDeNombre(f.name); if(!dueno[c]) dueno[c] = id; }
  });
  var docs = {};
  idx.forEach(function(e){
    if(cuenta[e.norm] > 1) return; // nombre repetido en la resolución: queda a mano
    var p = perfilDePuesto(e.bucket);
    if(!p) return;
    var c = claveDeNombre(e.name);
    var viejo = actuales[c] && actuales[c].uid;
    var uid = (viejo && existe[viejo]) ? viejo : (dueno[c] || null);
    docs[c] = Object.assign({ nombre: e.name, uid: uid }, p);
  });
  var ops = [];
  Object.keys(docs).forEach(function(c){ ops.push(['set', c, docs[c]]); });
  Object.keys(actuales).forEach(function(c){ if(!docs[c]) ops.push(['del', c]); });
  for(var i = 0; i < ops.length; i += 400){
    var lote = writeBatch(db);
    ops.slice(i, i + 400).forEach(function(o){
      if(o[0] === 'set') lote.set(doc(db, 'mandosIndex', o[1]), o[2]);
      else lote.delete(doc(db, 'mandosIndex', o[1]));
    });
    await lote.commit();
  }
  var conCuenta = Object.keys(docs).filter(function(c){ return docs[c].uid; }).length;
  return { puestos: Object.keys(docs).length, conCuenta: conCuenta };
}

// Al borrar un usuario, su puesto queda libre para volver a registrarse.
export async function liberarPuestoDe(uid){
  var q = await getDocs(query(col(), where('uid', '==', uid)));
  if(!q.docs.length) return;
  var lote = writeBatch(db);
  q.docs.forEach(function(d){ lote.update(doc(db, 'mandosIndex', d.id), { uid: null }); });
  await lote.commit();
}
