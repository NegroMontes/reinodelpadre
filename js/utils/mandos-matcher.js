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
      idx.push({ name: name, norm: norm, tokens: norm.split(' ').filter(Boolean), bucket: bucket });
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
        // El jefe de Formación es admin (como la cúpula), pero a diferencia
        // de la cúpula SÍ pertenece a un departamento real y nombrado — se
        // guarda `depto` igual que cualquier bucket admin puede llevarlo,
        // sin afectar bucketsMatch() (que para type:'admin' nunca mira
        // seccion/depto) — usado por "Mi comando" (views/mandos.js) para
        // agruparlo bajo "Formación" en vez de "Comando central".
        add(dep.jefe, {type:'admin', depto: 'Formación'});
        // `depto:'Formación'` acá también (10/10/2026, "Mi comando" — doble
        // comando de Formación): un subjefe de Formación normalmente nunca
        // llega a `comandoGrupoDe()` por nombre (su perfil ya tiene
        // `esFormacion`/`seccion` seteados desde el onboarding) — este campo
        // solo importa para el caso borde de alguien promovido a `admin` a
        // mano desde "Usuarios" cuyo nombre matchea acá; `bucketsMatch()`
        // nunca mira `depto` para `formacion_member`, así que esto no afecta
        // el auto-approve del onboarding en absoluto.
        (dep.subjefes || []).forEach(function(n){ add(n, {type:'formacion_member', depto: 'Formación'}); });
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
    if(fuzzy.length === 1) return fuzzy[0];
    if(fuzzy.length > 1) return null;

    // Paso 4 (14/11/2026, pedido del usuario: «Juani» en vez de «Juan
    // Ignacio»): apodos y diminutivos. Cada palabra escrita tiene que
    // corresponder a una palabra distinta del nombre real (apodo conocido,
    // comienzo de la palabra o diminutivo con -i/-o/-ito). Solo vale si
    // queda un único candidato.
    var flojo = index.filter(function(e){ return calzaFlojo(tokens, e.tokens); });
    if(flojo.length === 1) return flojo[0];
    if(flojo.length > 1) return null;

    // Paso 5 (14/11/2026, pedido del usuario: «Santi Soria Nodales» para
    // «Santiago Soria»): una palabra escrita de más (típicamente el segundo
    // apellido, que la resolución no trae). Se prueba sacando una sola
    // palabra, quedando al menos dos; vale si hay un único candidato.
    if(tokens.length < 3) return null;
    var extra = index.filter(function(e){
      for(var i = 0; i < tokens.length; i++){
        var resto = tokens.slice(0, i).concat(tokens.slice(i + 1));
        if(calzaFlojo(resto, e.tokens)) return true;
      }
      return false;
    });
    return extra.length === 1 ? extra[0] : null;
  }

  // Apodos comunes → nombre(s) real(es), ya normalizados (sin acentos).
  var APODOS = {
    juani: ['juan ignacio', 'juan'], juanma: ['juan manuel'], juampi: ['juan pablo'], juampa: ['juan pablo'],
    juancho: ['juan'], juanchi: ['juan'], juanfra: ['juan francisco'], juanjo: ['juan jose'], juancru: ['juan cruz'],
    nacho: ['ignacio'], nachito: ['ignacio'], pancho: ['francisco'], paco: ['francisco'], fran: ['francisco'], franco: ['francisco'],
    pepe: ['jose'], josema: ['jose maria'], chema: ['jose maria'], joaco: ['joaquin'], santi: ['santiago'],
    tomi: ['tomas'], tomy: ['tomas'], fede: ['federico'], nico: ['nicolas'], facu: ['facundo'], agus: ['agustin'],
    seba: ['sebastian'], lucho: ['luis'], mati: ['matias'], rami: ['ramiro'], gonza: ['gonzalo'], maxi: ['maximiliano', 'maximo'],
    gabi: ['gabriel'], gaby: ['gabriel'], benja: ['benjamin'], rodri: ['rodrigo'], manu: ['manuel'], valen: ['valentin'],
    guille: ['guillermo'], alejo: ['alejandro'], ale: ['alejandro'], pato: ['patricio'], cris: ['cristian', 'cristobal'],
    lauti: ['lautaro'], bauti: ['bautista'], tincho: ['martin'], tino: ['martin', 'valentin'], gaston: ['gaston'],
    beto: ['alberto', 'roberto'], quique: ['enrique'], kike: ['enrique'], pipe: ['felipe'], feli: ['felipe'],
    lolo: ['lorenzo', 'manuel'], lean: ['leandro'], leo: ['leonardo', 'leandro'], emi: ['emiliano', 'emilio'],
    mauri: ['mauricio'], dani: ['daniel'], fer: ['fernando'], nando: ['fernando'], hernan: ['hernan'],
    toto: ['ernesto', 'antonio'], tony: ['antonio'], toni: ['antonio'], alfi: ['alfonso'], rafa: ['rafael'],
    ezequi: ['ezequiel'], eze: ['ezequiel'], tobi: ['tobias'], iñaki: ['ignacio'], inaki: ['ignacio'],
    vicen: ['vicente'], gero: ['geronimo'], fito: ['rodolfo', 'adolfo'], cholo: ['diego']
  };

  // ¿La palabra escrita `t` puede ser la palabra real `et`?
  function palabraCalza(t, et){
    if(t === et || wordsAreClose(t, et)) return true;
    if(t.length >= 3 && et.indexOf(t) === 0) return true;          // «Seba» → sebastian
    var raiz = t.replace(/(ito|cito|i|y|o)$/, '');                  // «Tomi» → tom, «Juani» → juan
    if(raiz.length >= 3 && raiz !== t && et.indexOf(raiz) === 0) return true;
    return false;
  }

  // Cada palabra escrita se asigna a una palabra distinta del nombre real.
  // Un apodo compuesto («Juanma») puede ocupar dos palabras seguidas.
  function calzaFlojo(tokens, reales){
    function prueba(i, usados){
      if(i === tokens.length) return true;
      var t = tokens[i];
      var opciones = (APODOS[t] || []).map(function(x){ return x.split(' '); });
      for(var o = 0; o < opciones.length; o++){
        var partes = opciones[o];
        for(var k = 0; k + partes.length <= reales.length; k++){
          var ok = true;
          for(var p = 0; p < partes.length; p++){
            if(usados[k + p] || reales[k + p] !== partes[p]){ ok = false; break; }
          }
          if(!ok) continue;
          var u2 = usados.slice(); for(p = 0; p < partes.length; p++) u2[k + p] = true;
          if(prueba(i + 1, u2)) return true;
        }
      }
      for(var j = 0; j < reales.length; j++){
        if(usados[j] || !palabraCalza(t, reales[j])) continue;
        var u3 = usados.slice(); u3[j] = true;
        if(prueba(i + 1, u3)) return true;
      }
      return false;
    }
    return prueba(0, []);
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
