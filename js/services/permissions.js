// Lógica de permisos: quién puede ver o editar qué, según el rol
// (real o simulado por "Ver como"/Modo Lector). Depende únicamente de
// AppState — sin efectos de red ni de DOM, así que main.js puede llamarla
// libremente desde cualquier función de render.

import { AppState } from '../app-state.js';

  // "Ver como": solo para admins reales, para poder previsualizar la app como
  // otro rol sin cerrar sesión ni necesitar otra cuenta de Google. No cambia
  // nada en Firestore — el admin sigue teniendo permiso real de escritura,
  // esto solo simula qué vería/podría tocar cada rol en la interfaz.
  export function realIsAdmin(){ return !!AppState.currentUser && AppState.currentUser.role === 'admin'; }


  export function effectiveRole(){ return (realIsAdmin() && AppState.viewAsOverride) ? AppState.viewAsOverride.role : (AppState.currentUser ? AppState.currentUser.role : null); }


  export function effectiveSeccion(){ return (realIsAdmin() && AppState.viewAsOverride) ? AppState.viewAsOverride.seccion : (AppState.currentUser ? AppState.currentUser.seccion : null); }


  export function effectiveDepto(){ return (realIsAdmin() && AppState.viewAsOverride) ? AppState.viewAsOverride.depto : (AppState.currentUser ? AppState.currentUser.depto : null); }


  export function isAdmin(){ return effectiveRole() === 'admin'; }


  // "jefe_seccion" es el rol interno tanto para jefes de sección como de
  // departamento (se distinguen por effectiveSeccion()/effectiveDepto()) —
  // en la interfaz se muestra como "Jefe de sección/depto" (ver roleLabel).
  export function isJefeSeccion(){ return effectiveRole() === 'jefe_seccion'; }


  // 'lector', 'subjefe' y 'consagrado' (rediseño de roles, 23/09/2026) tienen
  // exactamente los mismos PERMISOS de visibilidad — la única diferencia
  // entre los tres es de dónde salió cada uno en el onboarding y qué
  // etiqueta se les muestra (ver roleLabel/submitOnboarding). Antes de este
  // cambio los tres vivían bajo un único `role:'lector'` + un `tipo`
  // ('comando'/'acampante') para distinguir subjefe de miliciano; ahora cada
  // uno es su propio valor de rol, así que cualquier chequeo que antes decía
  // `effectiveRole() === 'lector'` pasa a usar este helper, para no cambiar
  // ningún comportamiento real de golpe.
  export function isLectorLike(role){ return role === 'lector' || role === 'subjefe' || role === 'consagrado'; }


  // Toggle "Mi mando" / "Lector" (pedido del usuario, 25/09/2026, sugerencia
  // de Juli Ahumada): a diferencia de "Ver como" (arriba, solo para admins,
  // simula OTRO rol sin cambiar los permisos reales), esto es un cambio REAL
  // de la propia cuenta — cualquier jefe_seccion/subjefe/consagrado (NUNCA
  // milicianos ni admin, confirmado por el usuario) puede activarlo para leer
  // TODO el contenido del comando (todas las secciones, todos los
  // departamentos) sin poder editar nada mientras esté activo — ni siquiera
  // lo de su propia sección/depto ("en mando puedo crear y editar para
  // templarios menores, pero en lector puedo leer... pero no editarlas" — se
  // interpretó como un interruptor todo-o-nada, no aditivo). En memoria,
  // como "Ver como" — se resetea al cerrar sesión, nunca persiste.
  export function isComandoNonAdmin(){
    return !!AppState.currentUser && (AppState.currentUser.role === 'jefe_seccion' || AppState.currentUser.role === 'subjefe' || AppState.currentUser.role === 'consagrado');
  }


  // Envoltorio de seguridad sobre `myLectorMode`: si el rol REAL de la
  // persona cambia en vivo (ej. un admin la reasigna a miliciano mientras
  // tenía este toggle activo, algo que watchProfile() sí puede disparar en
  // caliente), `isComandoNonAdmin()` pasa a `false` al toque y esto corta
  // solo — sin depender de acordarse de resetear `myLectorMode` en cada
  // lugar donde el rol pueda cambiar. Todo lo que otorga permisos lee de
  // acá, nunca de la variable cruda (salvo el propio `<select>`, que ya vive
  // adentro de un `isComandoNonAdmin()` gateado).
  export function lectorModeActive(){ return AppState.myLectorMode && isComandoNonAdmin(); }


  // Para cualquier chequeo de "¿puedo EDITAR/CREAR esto?" que hoy usa
  // isJefeSeccion() — los chequeos de VISIBILIDAD (canSeeEntry,
  // canSeeDepartamentosTab) NO usan esto, se tocan aparte porque van al
  // revés (se ensanchan en vez de bloquearse).
  export function isJefeSeccionEditing(){ return isJefeSeccion() && !lectorModeActive(); }


  export function canEditStructure(){ return isAdmin(); } // agregar/renombrar/borrar días, cuadro de mandos


  // Normaliza el "ámbito" de una entrada a la forma nueva (arrays de secciones/
  // departamentos + un flag de "todo el comando"), sea cual sea el formato en
  // que esté guardada — así el resto del código (canSeeEntry, canEditEntry,
  // tags) solo conoce esta forma, nunca el detalle de cómo se guardó.
  // - Formato nuevo (22/09/2026): `secciones`/`deptos` (arrays) + `comandoGeneral`.
  // - Formato viejo (una sola `seccion`/`depto`, + `deptoVisibilidad`/
  //   `seccionVisibilidad`): `deptoVisibilidad:'todos'` equivalía a "todo el
  //   comando, sin milicianos" — mapea directo a `comandoGeneral`. En cambio
  //   `seccionVisibilidad:'todos'` (existía solo en Recursos) significaba algo
  //   distinto — "tan visible como General", milicianos incluidos — así que se
  //   normaliza como si esa entrada no tuviera sección puesta (no es lo mismo
  //   que el `comandoGeneral` nuevo, que a propósito excluye milicianos).
  export function entryScope(entry){
    if(entry.secciones || entry.deptos || entry.comandoGeneral){
      return {
        secciones: entry.secciones || [],
        deptos: entry.deptos || [],
        comandoGeneral: !!entry.comandoGeneral
      };
    }
    var secciones = (entry.seccion && entry.seccionVisibilidad !== 'todos') ? [entry.seccion] : [];
    var deptos = entry.depto ? [entry.depto] : [];
    return { secciones: secciones, deptos: deptos, comandoGeneral: entry.deptoVisibilidad === 'todos' };
  }


  export function canEditEntry(entry){
    if(isAdmin()) return true;
    // En modo "Lector" (ver arriba) nadie edita nada, ni siquiera su propia
    // sección/depto — corta acá y cubre de una todas las ramas de abajo.
    if(lectorModeActive()) return false;
    // Recursos e "Info general" son contenido sin sección/depto (general, para
    // todos) — se distinguen por el sentinel de dayId, no por el ámbito.
    // Una entrada "de bienvenida" (ver renderWelcomeSection) solo la puede
    // editar el admin — a diferencia del resto de Recursos, donde cualquier
    // jefe puede editar cualquier entrada sin restricción (pedido del
    // usuario, 24/09/2026: reservarla del todo al admin, no solo el checkbox
    // que la marca como tal).
    if(entry.dayId === 'RESOURCES'){
      if(entry.bienvenida) return false;
      if(!isJefeSeccion()) return false;
      // Antes cualquier jefe podía editar CUALQUIER recurso, sin mirar su
      // ámbito — bug reportado por el usuario 10/10/2026 ("cualquier jefe de
      // sección puede editar cualquier entrada, incluso aunque no sea de su
      // sección o departamento... esa entrada cambia de tag"). Mismo criterio
      // que ya usa "Mensaje" más abajo: un recurso sin ningún ámbito puntual
      // (General, o "Todos los comandos" sin elegir nada más) es colaborativo
      // — cualquier jefe lo coedita; uno scopeado a una sección/depto puntual
      // solo lo edita un jefe de ESE mismo grupo.
      var scopeR = entryScope(entry);
      if(scopeR.secciones.length === 0 && scopeR.deptos.length === 0) return true;
      var myDeptoR = effectiveDepto(), miSeccionR = effectiveSeccion();
      if(myDeptoR && scopeR.deptos.indexOf(myDeptoR) !== -1) return true;
      if(miSeccionR && scopeR.secciones.indexOf(miSeccionR) !== -1) return true;
      return false;
    }
    if(entry.dayId === 'INFO_GENERAL') return isJefeSeccion() && effectiveDepto() === 'Logística';
    if(isJefeSeccion()){
      var scope = entryScope(entry);
      if(effectiveDepto()) return scope.deptos.indexOf(effectiveDepto()) !== -1;
      if(effectiveSeccion()){
        if(scope.secciones.indexOf(effectiveSeccion()) !== -1) return true;
        // El mensaje del día (entrada General de "Mensaje", sin sección propia
        // — como las 8 reflexiones precargadas) es contenido colaborativo:
        // cualquier jefe de sección (o su delegado de Formación, mismo rol) lo
        // puede coeditar aunque no lo haya cargado él (pedido del usuario,
        // 22/09/2026). No se extiende a Departamentos (dayId null, tiene su
        // propia rama arriba) ni a contenido de OTRA sección/departamento.
        if(entry.dayId && scope.secciones.length === 0 && scope.deptos.length === 0 && !scope.comandoGeneral) return true;
        return false;
      }
      return false;
    }
    return false;
  }


  export function canSeeEntry(entry){
    // Entrada "oculta" (borrador, pedido del usuario, 23/09/2026): solo la ve
    // quien podría editarla (admin, o el jefe de esa sección/depto puntual) —
    // así se puede armar con tiempo, dejarla cargada con sus etiquetas de
    // sección/departamento ya puestas, y publicarla recién cuando esté lista,
    // sin que mientras tanto la vean los milicianos/lectores de esas etiquetas.
    if(entry.oculta && !canEditEntry(entry)) return false;
    // Entrada borrada (pedido del usuario, 24/09/2026: "que se elimine para
    // ellos pero que se quede guardada y oculta para mi"): desaparece del
    // feed normal para TODOS, admin incluido — la única forma de verla es la
    // pestaña dedicada "Papelera" (que no pasa por canSeeEntry, lee
    // state.entries directo), así no ensucia Mensaje/Departamentos/Recursos.
    if(entry.deletedAt) return false;
    if(isAdmin()) return true;
    // Modo "Lector" (pedido del usuario, 25/09/2026): lee absolutamente todo,
    // igual que un admin a efectos de visibilidad — es justo el propósito del
    // toggle ("que el comando entero pueda acceder a las entradas que hagan
    // todos"). No afecta el chequeo de `oculta` de arriba, que sigue mirando
    // `canEditEntry` real (y como `canEditEntry` ya corta a `false` en modo
    // Lector, un borrador propio queda invisible para uno mismo mientras el
    // toggle esté activo — consciente y aceptado: en "modo lector puro" no
    // corresponde ver ni los propios borradores sin publicar).
    if(lectorModeActive()) return true;
    var scope = entryScope(entry);
    if(isJefeSeccion()){
      // En "Mensaje" (entrada de un día real): desde el 22/09/2026, cada jefe
      // —de sección o de departamento, incluido un delegado de Formación que
      // acompaña una sección— solo ve el mensaje General del día, lo que esté
      // scopeado a SU propio ámbito, y lo marcado "Todos los comandos".
      // Ya no ve el contenido específico de otras secciones/departamentos acá
      // (antes cualquier jefe veía todo en Mensaje — el usuario aclaró que esa
      // regla vieja pensaba en el caso de Formación, no en un jefe cualquiera
      // viendo el contenido de otra sección). Un subjefe de Formación sigue
      // viendo la sección que acompaña normal, porque para él esa ES su propio
      // ámbito (`effectiveSeccion()`), no una sección ajena.
      var isMensajeEntry = !!entry.dayId && entry.dayId !== 'RESOURCES' && entry.dayId !== 'INFO_GENERAL';
      if(isMensajeEntry){
        if(scope.secciones.length === 0 && scope.deptos.length === 0) return true;
        if(scope.comandoGeneral) return true;
        var myDeptoM = effectiveDepto(), miSeccionM = effectiveSeccion();
        if(myDeptoM && scope.deptos.indexOf(myDeptoM) !== -1) return true;
        if(miSeccionM && scope.secciones.indexOf(miSeccionM) !== -1) return true;
        // Un subjefe de Formación tiene `depto:null` a propósito (para no
        // perder sus permisos de edición de la sección que acompaña — ver
        // "Jefes de departamento..." en CLAUDE.md), así que `effectiveDepto()`
        // nunca lo hace matchear con una entrada etiquetada "Formación" —
        // quedaba invisible para él sin querer (reportado por el usuario,
        // 23/09/2026). Se usa `currentUser.esFormacion` directo (no
        // simulable por "Ver como", igual que `readDepartamentos`) en vez de
        // `effectiveDepto()`.
        if(AppState.currentUser && AppState.currentUser.esFormacion && scope.deptos.indexOf('Formación') !== -1) return true;
        return false;
      }
      // Departamentos/Recursos: sin cambios — un jefe de DEPARTAMENTO sigue
      // coordinando y viendo absolutamente todo ahí; un jefe de SECCIÓN puro
      // no ve contenido de depto marcado "solo para ese/esos departamentos"
      // (sí lo marcado "todo el comando").
      if(effectiveDepto()) return true;
      if(scope.deptos.length > 0 && !scope.comandoGeneral) return false;
      return true;
    }
    if(isLectorLike(effectiveRole())){
      var myDepto = effectiveDepto();
      var mySeccion = effectiveSeccion();
      // "Todos los comandos": cualquier miembro del comando (subjefe o
      // consagrado, con sección O con depto — antes solo contaba con depto
      // propio o `readDepartamentos`, así que un subjefe de SECCIÓN quedaba
      // afuera sin querer, bug reportado por el usuario 10/10/2026: "a los
      // subjefes no les aparece la entrada si marco el check de todo el
      // comando") — nunca un miliciano puro (role:'lector', de sección o
      // General), sea cual sea la sección/depto puntual que además tenga
      // elegida la entrada. `isLectorLike(effectiveRole())` ya garantiza que
      // el rol es 'lector'/'subjefe'/'consagrado' — alcanza con excluir el
      // caso miliciano.
      if(scope.comandoGeneral){
        return effectiveRole() !== 'lector';
      }
      // Una entrada puede tener secciones Y departamentos elegidos a la vez
      // (ej. "Templarios Mayores" + "Formación") — no son excluyentes, así que
      // se evalúan los dos y alcanza con calzar en cualquiera de los dos, en
      // vez de un if/else que solo mirara uno. Contenido de departamento nunca
      // lo ve un miliciano (lector de sección o General) ni un consagrado sin
      // depto propio — solo un lector de ESE departamento puntual.
      if(scope.deptos.length > 0 || scope.secciones.length > 0){
        var matchesDepto = scope.deptos.length > 0 && !!myDepto && scope.deptos.indexOf(myDepto) !== -1;
        var matchesSeccion = scope.secciones.length > 0 && !!mySeccion && scope.secciones.indexOf(mySeccion) !== -1;
        // "Solo el comando de esa sección" (Recursos): si la entrada lo
        // marca, un miliciano puro (role:'lector') de esa misma sección NO la
        // ve — solo el comando de la sección (role 'subjefe'/'consagrado' de
        // esa sección) la ve. Antes esto se distinguía por `tipo`; ahora el
        // rol mismo ya lo dice (rediseño de roles, 23/09/2026).
        if(matchesSeccion && entry.seccionesComandoOnly){
          matchesSeccion = effectiveRole() !== 'lector';
        }
        return matchesDepto || matchesSeccion;
      }
      return true; // nada elegido: General de verdad, visible para cualquiera
    }
    return false;
  }


  // La pestaña "Departamentos" es contenido de coordinación interna del comando,
  // sin ligar a ningún día de campamento (instructivos, avisos, etc.) — un
  // miliciano (lector de sección, o General) no tiene nada que ver ahí, así que
  // directamente no le mostramos la pestaña (evita un tab vacío y confuso).
  // Excepción: un consagrado (`readDepartamentos: true` en su perfil, asignado
  // en el onboarding o a mano desde "Usuarios") sí la ve, en modo lectura —
  // puede tener seccion (acompaña una en particular) o no (general).
  export function canSeeDepartamentosTab(){
    if(isAdmin() || isJefeSeccion()) return true;
    // Modo "Lector" (25/09/2026): cualquier comando la ve, sin importar si
    // tiene depto propio o `readDepartamentos` — es justo lo que ese modo
    // amplía (subjefe/consagrado incluidos, no solo jefe_seccion).
    if(lectorModeActive()) return true;
    if(isLectorLike(effectiveRole())) return !!effectiveDepto() || !!(AppState.currentUser && AppState.currentUser.readDepartamentos);
    return false;
  }


  // "Mi comando" (09/10/2026, pedido del usuario) — subpestaña nueva dentro
  // de "Comando" (antes "Cuadro de mandos"), con el roster en vivo de quien
  // ya se registró (foto, actividad favorita, ruca) — distinto del cuadro
  // de mandos oficial (la Resolución, siempre visible para todos). Mismo
  // criterio amplio que "Departamentos": todo el comando (admin, jefe de
  // sección/depto, subjefe, consagrado) la ve; un miliciano o alguien
  // "pendiente" nunca — no le corresponde ver fotos/datos del resto.
  export function canSeeMiComandoSubtab(){
    if(isAdmin() || isJefeSeccion()) return true;
    if(lectorModeActive()) return true;
    var role = effectiveRole();
    return role === 'subjefe' || role === 'consagrado';
  }


  // "Recursos" e "Info general" son, al revés de "Departamentos", contenido
  // pensado para todo el mundo (comando y, a futuro, milicianos) — por eso no
  // tienen una función "canSeeXTab" propia, solo el gate de login normal.
  // Quién puede AGREGAR contenido sí está restringido, cada una a su manera:
  // Recursos lo puede cargar cualquiera del comando ("algunos roles" del doc de
  // specs); "Info general" queda más acotado a Logística, tal como pide el doc.
  export function canCreateRecurso(){
    return isAdmin() || isJefeSeccionEditing();
  }


  export function canCreateInfoGeneral(){
    return isAdmin() || (isJefeSeccionEditing() && effectiveDepto() === 'Logística');
  }


  // Consigna del día (22/09/2026): frase corta y propia de cada sección para un
  // día puntual — separada de la cita bíblica, pensada para que cada sección
  // ponga la suya en la cabecera de "Mensaje". Vive en `day.consignas`, un mapa
  // { <sección>: texto } dentro del mismo objeto día (mismo patrón que label/date,
  // sin colección nueva). Solo un admin o el jefe de ESA sección puntual la puede
  // tocar — un jefe de departamento nunca tiene sección propia, así que nunca
  // puede editar ninguna (aunque sí las ve, de solo lectura, para coordinar).
  export function canEditConsigna(seccion){
    return isAdmin() || (isJefeSeccionEditing() && !effectiveDepto() && effectiveSeccion() === seccion);
  }
