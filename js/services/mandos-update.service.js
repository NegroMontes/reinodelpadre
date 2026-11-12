// Actualizar el cuadro de mandos (05/11/2026). Solo admin, desde Comando →
// Cuadro de mandos: descargar el actual (.json), subir uno nuevo con vista
// previa (qué nombres entran/salen/cambian y a quién de los ya registrados
// afecta), guardar copia del anterior (`mandos/anterior`) para poder
// volver atrás, y acomodar los perfiles de los registrados que cambiaron de
// puesto. Sin reglas nuevas (`mandos/**` y `users/*` ya los escribe el admin).

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, mandosDocRef } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { SECCIONES, DEPARTAMENTOS } from '../config/constants.js';
import { buildMandosIndex, findMandoByName } from '../utils/mandos-matcher.js';
import { isMilicianoUser } from '../views/users.js';
import { regenerarIndiceMandos } from './mandos-index.service.js';

  var anteriorRef = doc(db, 'mandos', 'anterior');

  function txt(v){ return typeof v === 'string' ? v.trim() : ''; }
  function lista(v){ return Array.isArray(v) ? v.map(txt).filter(Boolean) : []; }
  // La resolución marca nombres que no se publican con «(no decirlo)».
  function oculto(n){ return /no\s+decirlo/i.test(n); }
  function limpio(n){ n = txt(n); return oculto(n) ? '' : n; }
  function limpioLista(v){ return lista(v).filter(function(n){ return !oculto(n); }); }

  // Valida y normaliza. Devuelve { data, errores:[], avisos:[] }.
  export function validarMandos(obj){
    var errores = [], avisos = [];
    if(!obj || typeof obj !== 'object' || Array.isArray(obj)) return { data: null, errores: ['El archivo no tiene el formato del cuadro de mandos.'], avisos: [] };
    var ocultos = JSON.stringify(obj).match(/[^"]*no\s+decirlo[^"]*/gi) || [];
    if(ocultos.length) avisos.push('Se sacaron ' + ocultos.length + ' nombre(s) marcados «(no decirlo)».');
    var data = {
      jefeCampamento: limpio(obj.jefeCampamento), asesor: limpio(obj.asesor),
      secretarioGeneral: limpio(obj.secretarioGeneral), subjefe: limpio(obj.subjefe),
      jefeAgrupacion: limpio(obj.jefeAgrupacion), secciones: [], departamentos: []
    };
    (Array.isArray(obj.secciones) ? obj.secciones : []).forEach(function(s){
      var nombre = txt(s && s.nombre);
      if(SECCIONES.indexOf(nombre) < 0){ errores.push('Sección desconocida: «' + nombre + '» (tiene que ser una de: ' + SECCIONES.join(', ') + ').'); return; }
      var sec = { nombre: nombre, jefe: limpio(s.jefe), secretario: limpio(s.secretario),
        subsecciones: (Array.isArray(s.subsecciones) ? s.subsecciones : []).map(function(sub){
          return { jefe: limpio(sub && sub.jefe), subjefes: limpioLista(sub && sub.subjefes) };
        }) };
      if(limpio(s.capellan)) sec.capellan = limpio(s.capellan);
      data.secciones.push(sec);
    });
    (Array.isArray(obj.departamentos) ? obj.departamentos : []).forEach(function(d){
      var nombre = txt(d && d.nombre);
      if(DEPARTAMENTOS.indexOf(nombre) < 0){ errores.push('Departamento desconocido: «' + nombre + '» (tiene que ser uno de: ' + DEPARTAMENTOS.join(', ') + ').'); return; }
      data.departamentos.push({ nombre: nombre, jefe: limpio(d.jefe), subjefes: limpioLista(d.subjefes) });
    });
    SECCIONES.forEach(function(n){ if(!data.secciones.some(function(s){ return s.nombre === n; })) avisos.push('Falta la sección ' + n + '.'); });
    DEPARTAMENTOS.forEach(function(n){ if(!data.departamentos.some(function(d){ return d.nombre === n; })) avisos.push('Falta el departamento ' + n + '.'); });
    if(!buildMandosIndex(data).length) errores.push('No hay ningún nombre cargado.');
    // Nombres repetidos: el matcheo por nombre no los puede distinguir.
    var vistos = {}, rep = {};
    buildMandosIndex(data).forEach(function(e){ if(vistos[e.norm]) rep[e.name] = true; vistos[e.norm] = true; });
    if(Object.keys(rep).length) avisos.push('Nombres repetidos (quien se registre con ese nombre queda «pendiente»): ' + Object.keys(rep).join(', ') + '.');
    return { data: data, errores: errores, avisos: avisos };
  }

  export function puestoTxt(b){
    if(!b) return '';
    var g = b.seccion || b.depto || '';
    return ({ admin: g ? 'Jefe de ' + g : 'Comando central', jefe_seccion: 'Jefe de ' + g, lector: 'Subjefe/secretario de ' + g,
      capellan: 'Capellán de ' + g, jefe_depto: 'Jefe de ' + g, lector_depto: 'Subjefe de ' + g,
      formacion_member: 'Subjefe de Formación' })[b.type] || g;
  }
  function mismoPuesto(a, b){ return a.type === b.type && (a.seccion || '') === (b.seccion || '') && (a.depto || '') === (b.depto || ''); }

  // Perfil que corresponde a un puesto (mismo criterio que el onboarding,
  // auth.service.js). null = admin: se asigna a mano.
  function perfilDe(b, u){
    switch(b.type){
      case 'jefe_seccion': return { role: 'jefe_seccion', seccion: b.seccion, depto: null, esFormacion: false };
      case 'formacion_member': return { role: 'jefe_seccion', seccion: u.seccion || null, depto: null, esFormacion: true };
      case 'jefe_depto': return { role: 'jefe_seccion', seccion: null, depto: b.depto, esFormacion: false };
      case 'lector_depto': return { role: 'subjefe', seccion: null, depto: b.depto, esFormacion: false };
      case 'capellan': return { role: 'consagrado', seccion: b.seccion, depto: null, esFormacion: false, readDepartamentos: true };
      case 'lector': return { role: 'subjefe', seccion: b.seccion || null, depto: null, esFormacion: false };
      default: return null;
    }
  }
  function perfilIgual(p, u){
    return p.role === u.role && (p.seccion || null) === (u.seccion || null) &&
      (p.depto || null) === (u.depto || null) && !!p.esFormacion === !!u.esFormacion;
  }

  // Qué cambia entre dos cuadros y a quién de los registrados afecta.
  export function compararMandos(viejo, nuevo){
    var vi = buildMandosIndex(viejo), ni = buildMandosIndex(nuevo);
    function porNorm(idx){ var m = {}; idx.forEach(function(e){ m[e.norm] = m[e.norm] || e; }); return m; }
    var vm = porNorm(vi), nm = porNorm(ni);
    var r = { entran: [], salen: [], cambian: [], aplicar: [], aMano: [], yaNoFiguran: [] };
    Object.keys(nm).forEach(function(k){
      if(!vm[k]) r.entran.push(nm[k].name + ' — ' + puestoTxt(nm[k].bucket));
      else if(!mismoPuesto(vm[k].bucket, nm[k].bucket)) r.cambian.push(nm[k].name + ': ' + puestoTxt(vm[k].bucket) + ' → ' + puestoTxt(nm[k].bucket));
    });
    Object.keys(vm).forEach(function(k){ if(!nm[k]) r.salen.push(vm[k].name + ' — ' + puestoTxt(vm[k].bucket)); });

    (AppState.usersList || []).forEach(function(u){
      if(isMilicianoUser(u) || u.declaradoComo === 'Comando de cocina') return;
      var nombre = u.displayName || u.email || 'Sin nombre';
      var antes = findMandoByName(u.displayName || '', vi), ahora = findMandoByName(u.displayName || '', ni);
      if(!ahora){ if(antes) r.yaNoFiguran.push(nombre + ' (era ' + puestoTxt(antes.bucket) + ')'); return; }
      var p = perfilDe(ahora.bucket, u);
      if(!p || u.role === 'admin'){
        if(!antes || !mismoPuesto(antes.bucket, ahora.bucket)) r.aMano.push(nombre + ' → ' + puestoTxt(ahora.bucket));
        return;
      }
      if(!perfilIgual(p, u)) r.aplicar.push({ uid: u.uid, nombre: nombre, perfil: p, txt: nombre + ' → ' + puestoTxt(ahora.bucket) });
    });
    return r;
  }

  export function resumenTxt(r){
    var out = [];
    function bloque(t, l){ if(l.length) out.push(t + ' (' + l.length + '):\n• ' + l.join('\n• ')); }
    bloque('Entran', r.entran);
    bloque('Salen', r.salen);
    bloque('Cambian de puesto', r.cambian);
    bloque('Registrados cuyo perfil se va a acomodar', r.aplicar.map(function(a){ return a.txt; }));
    bloque('Registrados para acomodar a mano en Usuarios', r.aMano);
    bloque('Registrados que ya no figuran (acomodar a mano en Usuarios)', r.yaNoFiguran);
    return out.length ? out.join('\n\n') : 'No hay cambios.';
  }

  // Guarda el nuevo cuadro (con copia del anterior) y acomoda los perfiles.
  export async function guardarMandos(nuevo, r){
    var actual = AppState.mandosData;
    if(actual) await setDoc(anteriorRef, { data: actual, guardadoEn: Date.now(), por: (AppState.currentUser && AppState.currentUser.displayName) || '' });
    await setDoc(mandosDocRef, nuevo);
    var fallas = 0;
    for(var i = 0; i < r.aplicar.length; i++){
      var a = r.aplicar[i];
      try{ await setDoc(doc(db, 'users', a.uid), Object.assign({ verificado: true }, a.perfil), { merge: true }); }
      catch(e){ console.error('No se pudo acomodar el perfil de ' + a.nombre, e); fallas++; }
    }
    var indice = null;
    try{ indice = await regenerarIndiceMandos(); }catch(e){ console.error('No se pudo actualizar el índice de puestos:', e); }
    return { perfiles: r.aplicar.length - fallas, fallas: fallas, indice: indice };
  }

  export async function leerAnterior(){
    var s = await getDoc(anteriorRef);
    return s.exists() ? s.data() : null;
  }

  export function descargarMandos(){
    var blob = new Blob([JSON.stringify(AppState.mandosData || {}, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cuadro-de-mandos-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  }
