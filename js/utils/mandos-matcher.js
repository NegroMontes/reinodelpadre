import { normalizeName } from './helpers.js';

  // El cuadro de mandos ya no es una constante estática del código (ver
  // "Cuadro de mandos movido a Firestore" en CLAUDE.md, 08/10/2026) — vive
  // en `AppState.mandosData`, cargado en vivo desde Firestore
  // (services/mandos.service.js). Por eso `buildMandosIndex()` pasó de
  // leer un import de módulo a recibir esos datos como parámetro — sigue
  // siendo una función pura (sin estado propio), solo que ya no asume que
  // los datos están disponibles de forma síncrona al cargar el módulo.
  // `mandos` puede venir `null`/`undefined` (todavía no cargó, o Firestore
  // no tiene el documento) — devuelve un índice vacío en ese caso, nunca
  // explota.
  export function buildMandosIndex(mandos){
    var idx = [];
    function add(name, bucket){
      if(!name) return;
      var norm = normalizeName(name);
      idx.push({ norm: norm, tokens: norm.split(' ').filter(Boolean), bucket: bucket });
    }

    if(!mandos) return idx;

    add(mandos.jefeCampamento, {type:'admin'});
    add(mandos.asesor, {type:'admin'});
    add(mandos.secretarioGeneral, {type:'admin'});
    add(mandos.subjefe, {type:'admin'});
    add(mandos.jefeAgrupacion, {type:'admin'});

    (mandos.secciones || []).forEach(function(sec){
      add(sec.jefe, {type:'jefe_seccion', seccion: sec.nombre});
      add(sec.secretario, {type:'lector', seccion: sec.nombre});
      if(sec.capellan) add(sec.capellan, {type:'capellan', seccion: sec.nombre});
      (sec.subsecciones || []).forEach(function(sub){
        add(sub.jefe, {type:'lector', seccion: sec.nombre});
        (sub.subjefes || []).forEach(function(n){ add(n, {type:'lector', seccion: sec.nombre}); });
      });
    });

    (mandos.departamentos || []).forEach(function(dep){
      if(dep.nombre === 'Formación'){
        add(dep.jefe, {type:'admin'});
        (dep.subjefes || []).forEach(function(n){ add(n, {type:'formacion_member'}); });
      } else {
        // Jefe de departamento → puede cargar entradas para su departamento
        // (mismo rol interno que un jefe de sección, "jefe_seccion", ver roleLabel).
        // Subjefes → lector de ese departamento.
        add(dep.jefe, {type:'jefe_depto', depto: dep.nombre});
        (dep.subjefes || []).forEach(function(n){ add(n, {type:'lector_depto', depto: dep.nombre}); });
      }
    });

    return idx;
  }


  export function levenshteinDistance(a, b){
    var m = a.length, n = b.length;
    var prevRow = new Array(n + 1);
    for(var j = 0; j <= n; j++) prevRow[j] = j;
    for(var i = 1; i <= m; i++){
      var currRow = [i];
      for(j = 1; j <= n; j++){
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        currRow[j] = Math.min(
          prevRow[j] + 1,      // borrar
          currRow[j - 1] + 1,  // insertar
          prevRow[j - 1] + cost // reemplazar
        );
      }
      prevRow = currRow;
    }
    return prevRow[n];
  }


  export function wordsAreClose(a, b){
    if(a === b) return true;
    if(a.length < 5 || b.length < 5) return false;
    if(Math.abs(a.length - b.length) > 1) return false; // corte rápido, evita calcular la distancia de más
    return levenshteinDistance(a, b) <= 1;
  }


  // `index` ahora es un parámetro (el resultado de `buildMandosIndex()`) en
  // vez de leer el módulo-level `MANDOS_INDEX` de antes — mismo motivo que
  // arriba, los datos ya no están disponibles de forma síncrona/estática.
  export function findMandoByName(declaredName, index){
    var norm = normalizeName(declaredName);
    if(!norm) return null;

    var exact = index.filter(function(e){ return e.norm === norm; });
    if(exact.length === 1) return exact[0];
    if(exact.length > 1) return null; // ambiguo entre dos nombres idénticos en la resolución

    var tokens = norm.split(' ').filter(Boolean);
    if(tokens.length < 2) return null;

    var partial = index.filter(function(e){
      return tokens.every(function(t){ return e.tokens.indexOf(t) !== -1; });
    });
    if(partial.length === 1) return partial[0];
    if(partial.length > 1) return null; // ambiguo, ni el paso 3 (más laxo todavía) va a desambiguar esto

    var fuzzy = index.filter(function(e){
      return tokens.every(function(t){
        return e.tokens.some(function(et){ return wordsAreClose(t, et); });
      });
    });
    return fuzzy.length === 1 ? fuzzy[0] : null;
  }


  export function bucketsMatch(declared, found){
    if(!found) return false;
    if(declared.type !== found.bucket.type) return false;
    if(declared.type === 'jefe_seccion' || declared.type === 'capellan' || (declared.type === 'lector' && declared.seccion)){
      return declared.seccion === found.bucket.seccion;
    }
    if(declared.type === 'jefe_depto' || declared.type === 'lector_depto'){
      return declared.depto === found.bucket.depto;
    }
    return true;
  }


  export function declaredBucketFromForm(posGrupo, seccionOrDepto){
    if(posGrupo === 'cupula') return {type:'admin'};
    if(posGrupo === 'jefe_seccion') return {type:'jefe_seccion', seccion: seccionOrDepto};
    if(posGrupo === 'staff_seccion') return {type:'lector', seccion: seccionOrDepto};
    if(posGrupo === 'jefe_depto') return seccionOrDepto === 'Formación' ? {type:'admin'} : {type:'jefe_depto', depto: seccionOrDepto};
    if(posGrupo === 'staff_depto') return seccionOrDepto === 'Formación' ? {type:'formacion_member'} : {type:'lector_depto', depto: seccionOrDepto};
    // "Acompaño en general" (sin sección puntual) nunca puede matchear — la
    // resolución solo lista un capellán por sección, no uno general — así que
    // ese caso queda "pendiente" a propósito, para que un admin lo asigne a mano.
    if(posGrupo === 'capellan') return {type:'capellan', seccion: seccionOrDepto === 'general' ? null : seccionOrDepto};
    return {type:'ninguno'};
  }
