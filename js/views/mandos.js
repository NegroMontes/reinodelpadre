// "Comando" (antes "Cuadro de mandos", renombrada 09/10/2026) — dos
// subpestañas: "Cuadro de mandos" (de solo lectura, con la nómina completa
// de la Resolución de nombramientos — los datos viven en Firestore,
// `mandos/data`, ver services/mandos.service.js) y "Mi comando" (roster en
// vivo de quien ya se registró, con foto/actividad favorita/ruca — ver
// canSeeMiComandoSubtab() en services/permissions.js).

import { HIJOS_BIBLICOS } from '../config/test-hijo-biblico.js';
import { bonusDe } from '../services/juegos.service.js';
import { engancharMapaEventos } from '../components/eventos.js';
import { rangoGuardadoDe, rangoNombre, avanceGuardadoDe, obligPendientesDe, obligatoriaRangoDe } from '../services/rangos.service.js';
import { AppState } from '../app-state.js';
import { SECCIONES, DEPARTAMENTOS, DEPARTAMENTO_SVG_ICON } from '../config/constants.js';
import { escapeHtml, roleLabel, activityIcon, estaOculta } from '../utils/helpers.js';
import { userBadgeInnerHtml, sectionShieldHtml } from '../utils/badge-icons.js';
import { icon } from '../utils/icons.js';
import { canSeeMiComandoSubtab, realIsAdmin, isAdmin, effectiveRole, effectiveSeccion, effectiveDepto, lectorModeActive } from '../services/permissions.js';
import { buildMandosIndex, findMandoByName } from '../utils/mandos-matcher.js';
import { isMilicianoUser } from './users.js';
import { renderPanel } from '../main.js';
import { showAlert, showConfirm } from '../components/dialog.js';

  var COMANDO_CENTRAL = 'Comando central';

  // "Mi comando" (09/10/2026, pedido del usuario): agrupa a cada miembro
  // del comando según el cuadro de mandos real, no un roster plano de todo
  // el campamento. Un jefe_seccion/subjefe/consagrado ya tiene `seccion`/
  // `depto` guardado en su perfil — se usa directo. Un admin NUNCA tiene
  // ninguno de los dos (por diseño, ver "Rediseño de roles..."), así que
  // hay que buscarlo por nombre contra `MANDOS` (mismo matching que ya usa
  // el onboarding) para saber en qué mando específico cae — si matchea
  // como jefe de un departamento (ej. Formación) usa ESE departamento; si
  // matchea con la cúpula del campamento, o no matchea con nada (nombre no
  // encontrado en la resolución), cae en "Comando central".
  function comandoGrupoDe(u, mandosIndex){
    if(u.seccion) return u.seccion;
    if(u.depto) return u.depto;
    if(u.role === 'admin'){
      var found = findMandoByName(u.displayName || '', mandosIndex);
      if(found && found.bucket.seccion) return found.bucket.seccion;
      if(found && found.bucket.depto) return found.bucket.depto;
    }
    return COMANDO_CENTRAL;
  }


  // ¿Esta persona pertenece de verdad al comando de Formación? — el jefe
  // (admin, matcheado por nombre contra la resolución — bucket
  // `depto:'Formación'`, ver buildMandosIndex) o cualquier subjefe
  // (`esFormacion:true`, sin importar qué sección acompañe cada uno). Usa
  // SIEMPRE la identidad real (nunca `effectiveRole()`/"Ver como" —
  // `esFormacion` es un campo real del perfil, no simulable, mismo
  // criterio que `readDepartamentos` en el resto de la app).
  function esFormacionMember(u, mandosIndex){
    if(!u) return false;
    if(u.esFormacion) return true;
    if(u.role === 'admin'){
      var found = findMandoByName(u.displayName || '', mandosIndex);
      return !!(found && found.bucket.depto === 'Formación');
    }
    return false;
  }


  // El grupo del propio viewer — usa effectiveSeccion()/effectiveDepto()
  // (respetan "Ver como" cuando un admin está simulando un jefe de sección/
  // depto puntual) y, si es admin (real o "Yo (Admin)" sin simular nada),
  // el mismo matching por nombre que `comandoGrupoDe()` usa para cualquier
  // otro admin de la lista — así el criterio es idéntico para todos.
  function miGrupoActual(mandosIndex){
    var seccion = effectiveSeccion();
    var depto = effectiveDepto();
    if(seccion) return seccion;
    if(depto) return depto;
    if(effectiveRole() === 'admin'){
      var found = findMandoByName((AppState.currentUser && AppState.currentUser.displayName) || '', mandosIndex);
      if(found && found.bucket.seccion) return found.bucket.seccion;
      if(found && found.bucket.depto) return found.bucket.depto;
    }
    return COMANDO_CENTRAL;
  }

  export function mandoCard(role, name){
    return '<div class="mando-card"><span class="mando-role">' + escapeHtml(role) + '</span><span class="mando-name">' + escapeHtml(name) + '</span></div>';
  }


  function renderCuadroDeMandosHtml(){
    var MANDOS = AppState.mandosData;
    var html = '';

    if(!MANDOS){
      return AppState.mandosLoaded
        ? '<p class="empty">Todavía no hay cuadro de mandos cargado.</p>'
        : '<p class="loading-inline"><span class="loading-spinner"></span>Cargando…</p>';
    }

    if(realIsAdmin()){
      html += '<div class="mandos-admin-bar">' +
        '<button type="button" class="btn ghost small" id="mandosDescargarBtn">' + icon('download') + ' Descargar (.json)</button>' +
        '<button type="button" class="btn ghost small" id="mandosSubirBtn">Actualizar desde .json</button>' +
        '<button type="button" class="btn ghost small" id="mandosAnteriorBtn">Volver a la versión anterior</button>' +
        '<button type="button" class="btn ghost small" id="mandosIndiceBtn" title="Lo usan las reglas de Firebase para validar los registros">Actualizar índice de puestos</button>' +
        '<input type="file" id="mandosSubirFile" accept=".json,application/json" hidden></div>';
    }
    html += '<div class="mandos-cupula">';
    html += mandoCard('Jefe de Campamento', MANDOS.jefeCampamento);
    html += mandoCard('Asesor de la actividad', MANDOS.asesor);
    html += mandoCard('Secretario General', MANDOS.secretarioGeneral);
    html += mandoCard('Subjefe', MANDOS.subjefe);
    html += mandoCard('Jefe de Agrupación', MANDOS.jefeAgrupacion);
    html += '</div>';

    html += '<h3 class="mandos-group-title">Secciones</h3>';
    (MANDOS.secciones || []).forEach(function(sec){
      html += '<div class="mandos-section">';
      html += '  <div class="mandos-section-head"><h4>' + escapeHtml(sec.nombre) + '</h4>';
      html += '    <div class="mandos-section-heads"><span>Jefe: ' + escapeHtml(sec.jefe) + '</span><span>Secretario: ' + escapeHtml(sec.secretario) + '</span>' + (sec.capellan ? '<span>Capellán: ' + escapeHtml(sec.capellan) + '</span>' : '') + '</div>';
      html += '  </div>';
      html += '  <div class="mandos-subsecciones">';
      sec.subsecciones.forEach(function(sub){
        html += '<div class="mandos-sub-card"><p class="mandos-sub-jefe">' + escapeHtml(sub.jefe) + '</p><ul class="mandos-sub-list">';
        sub.subjefes.forEach(function(n){ html += '<li>' + escapeHtml(n) + '</li>'; });
        html += '</ul></div>';
      });
      html += '  </div>';
      html += '</div>';
    });

    html += '<h3 class="mandos-group-title">Departamentos</h3>';
    html += '<div class="mandos-deptos">';
    (MANDOS.departamentos || []).forEach(function(dep){
      html += '<div class="mandos-depto-card"><h4>' + escapeHtml(dep.nombre) + '</h4><p class="mandos-sub-jefe">' + escapeHtml(dep.jefe) + '</p><ul class="mandos-sub-list">';
      dep.subjefes.forEach(function(n){ html += '<li>' + escapeHtml(n) + '</li>'; });
      html += '</ul></div>';
    });
    html += '</div>';

    return html;
  }


  // Etiqueta de rol para la tarjeta de "Mi comando" — un subjefe de
  // Formación (`esFormacion:true`) usa internamente el mismo rol que
  // cualquier jefe de sección/depto (`jefe_seccion`, ver "Jefes de
  // departamento..." en CLAUDE.md), así que `roleLabel()` genérico los
  // etiquetaba igual que a un jefe real — acá, solo para esta pantalla, se
  // distinguen (pedido del usuario, 10/10/2026). `roleLabel()` en sí no se
  // tocó — lo siguen usando "Usuarios"/el pill del header/etc. tal cual.
  function miComandoRoleLabel(u){
    if(u.esFormacion) return 'Subjefe de departamento de Formación';
    return roleLabel(u.role);
  }


  // Tarjeta de "Mi comando" — mismo espíritu que mandoCard(), pero con los
  // datos reales de perfil de quien ya se registró (no la Resolución).
  // `grupo` es el mando ya resuelto por `comandoGrupoDe()` — un admin nunca
  // tiene `seccion`/`depto` propios (ver más arriba), así que sin esto su
  // tarjeta quedaba sin ninguna etiqueta de mando.
  function miComandoCardHtml(u, grupo){
    var avatar = u.photoURL
      ? '<img class="micomando-avatar-img" src="' + escapeHtml(u.photoURL) + '" alt="">'
      : '<span class="micomando-avatar-fallback">' + icon('user') + '</span>';
    var badgeInner = userBadgeInnerHtml(u);
    var badgeTitle = u.seccion ? ('Sección: ' + u.seccion) : (u.depto ? ('Departamento: ' + u.depto) : (grupo || ''));
    var badge = badgeInner ? '<span class="micomando-badge" title="' + escapeHtml(badgeTitle) + '">' + badgeInner + '</span>' : '';
    // El ícono de actividad favorita pasó de un emoji inline antes del
    // nombre a un badge abajo-izquierda del avatar (10/10/2026, pedido del
    // usuario) — mismo lugar/mismo criterio visual que ya usa el botón de
    // usuario de la barra superior (.user-avatar-badge-activity, ver
    // components/header.js y css/views/home.css).
    var actIcon = activityIcon(u.actividadFavorita);
    var actBadge = actIcon ? '<span class="micomando-badge micomando-badge-activity" title="Actividad: ' + escapeHtml(u.actividadFavorita) + '">' + actIcon + '</span>' : '';
    var html = '<div class="micomando-card">';
    html += '  <div class="micomando-avatar-wrap">' + avatar + actBadge + badge + '</div>';
    html += '  <div class="micomando-info">';
    html += '    <strong>' + escapeHtml(u.displayName || u.email) + '</strong>';
    html += '    <span class="mandos-sub">' + escapeHtml(miComandoRoleLabel(u)) + (' · ' + escapeHtml(u.seccion || u.depto || grupo || '')) + '</span>';
    if(u.rucaFundacion){ html += '    <span class="mandos-sub">' + escapeHtml(u.rucaFundacion) + '</span>'; }
    var rg = rangoGuardadoDe(u);
    if(rg){ html += '    <span class="rango-chip rango-chip-sm rango-' + rg + '" title="Rango">' + escapeHtml(rangoNombre(rg)) + '</span>'; }
    var hj = HIJOS_BIBLICOS[u.hijoBiblico];
    if(hj){ html += '    <span class="mandos-sub micomando-hijo" title="Resultado del test «¿Qué hijo bíblico sos?»">' + escapeHtml(hj.nombre) + '</span>'; }
    html += '  </div>';
    html += '</div>';
    return html;
  }


  // Un grupo de tarjetas con su propio título — `.mandos-group-title` ya
  // trae un `border-top` (ver css/components.css), así que encadenar dos
  // de estos ya separa los dos comandos con una línea, sin CSS nuevo.
  function miComandoGroupHtml(titulo, members, mandosIndex){
    if(members.length === 0) return '';
    var html = '<h3 class="mandos-group-title">' + escapeHtml(titulo) + '</h3>';
    html += '<div class="micomando-grid">';
    members.forEach(function(u){ html += miComandoCardHtml(u, comandoGrupoDe(u, mandosIndex)); });
    html += '</div>';
    return html;
  }


  function renderMiComandoHtml(){
    // Bug real (10/10/2026, reportado por el usuario — "estoy viendo a
    // todo los usuarios"): esta lista solo excluía milicianos
    // (`isMilicianoUser`), nunca a quienes todavía están `role:'pendiente'`
    // — y un pendiente típicamente no tiene `seccion` NI `depto` (recién se
    // setean cuando un admin lo aprueba, o el onboarding lo matchea solo),
    // así que `comandoGrupoDe()` los hacía caer SIEMPRE en "Comando central"
    // sin importar qué declararon — inflando ese grupo con cualquiera que
    // todavía no fue aprobado. "Mi comando" es un roster de quien YA
    // pertenece a un mando confirmado — un pendiente, por definición, todavía
    // no tiene ninguno.
    var comando = (AppState.usersList || []).filter(function(u){ return !isMilicianoUser(u) && u.role !== 'pendiente'; });
    var mandosIndex = buildMandosIndex(AppState.mandosData);
    var html = '';

    // Modo Lector (toggle "Mi mando"/"Lector" del comando no-admin) ya
    // significa "ver TODO, sin poder editar" en cualquier otro lado de la
    // app (entradas, Departamentos) — "Mi comando" sigue el mismo criterio
    // y muestra el roster completo mientras está activo, en vez de acotarlo
    // a uno o dos grupos.
    if(lectorModeActive()){
      html += '<p class="mandos-sub">Modo Lector — viendo todo el comando.</p>';
      if(comando.length === 0) return html + '<p class="empty">Todavía no se registró nadie del comando.</p>';
      html += '<div class="micomando-grid">';
      comando.forEach(function(u){ html += miComandoCardHtml(u, comandoGrupoDe(u, mandosIndex)); });
      html += '</div>';
      return html;
    }

    // Formación es el único comando con doble pertenencia (pedido del
    // usuario, 10/10/2026): un jefe/subjefe de Formación ve, a la vez, el
    // comando de Formación entero (jefes y subjefes, sin importar qué
    // sección acompañe cada uno) y el comando de LA sección puntual que él
    // mismo acompaña. Siempre con la identidad REAL — `esFormacionMember()`
    // usa `AppState.currentUser` directo, nunca "Ver como".
    var cu = AppState.currentUser;
    if(cu && esFormacionMember(cu, mandosIndex)){
      // La sección que acompaña, si tiene una — el jefe de Formación (admin,
      // sin `seccion` propia, ver `comandoGrupoDe()`) no acompaña ninguna en
      // particular, así que para él solo se arma el comando de Formación.
      var miSeccion = cu.seccion || null;
      var formacionMembers = comando.filter(function(u){ return esFormacionMember(u, mandosIndex); });
      var seccionMembers = miSeccion ? comando.filter(function(u){ return comandoGrupoDe(u, mandosIndex) === miSeccion; }) : [];

      html += '<p class="mandos-sub">Tu mando: <strong>Formación</strong>' +
        (miSeccion ? (' · acompañás a <strong>' + escapeHtml(miSeccion) + '</strong>') : '') + '</p>';

      if(formacionMembers.length === 0 && seccionMembers.length === 0){
        return html + '<p class="empty">Todavía no se registró nadie de tu mando.</p>';
      }

      html += miComandoGroupHtml('Comando de Formación', formacionMembers, mandosIndex);
      if(miSeccion) html += miComandoGroupHtml('Comando de ' + miSeccion, seccionMembers, mandosIndex);
      return html;
    }

    var miGrupo = miGrupoActual(mandosIndex);
    var members = comando.filter(function(u){ return comandoGrupoDe(u, mandosIndex) === miGrupo; });
    html += '<p class="mandos-sub">Tu mando: <strong>' + escapeHtml(miGrupo) + '</strong></p>';

    if(members.length === 0){
      return html + '<p class="empty">Todavía no se registró nadie de tu mando.</p>';
    }
    html += '<div class="micomando-grid">';
    members.forEach(function(u){ html += miComandoCardHtml(u, comandoGrupoDe(u, mandosIndex)); });
    html += '</div>';
    return html;
  }


  // Tablero por comando — T14 (05/11/2026): promedio del % de avance
  // (`users/{uid}.avance`, lo guarda el dispositivo de cada uno) de cada
  // sección/departamento. Miembros: mismos que Mi comando (sin milicianos ni
  // pendientes), pero Formación se lleva a TODOS los suyos (jefe y subjefes
  // `esFormacion`): no suman para la sección que acompañan (pedido del
  // usuario). Total = la cantidad de nombres de ese comando en la resolución
  // (`mandos/data`, sin capellanes), o los registrados si son más; quien no
  // se registró o no tiene avance cuenta como 0% en el promedio.
  function grupoTableroDe(u, mandosIndex){
    return esFormacionMember(u, mandosIndex) ? 'Formación' : comandoGrupoDe(u, mandosIndex);
  }

  // T18: comando con el que participa cada uno en las subastas de Beneficios
  // (el mismo agrupamiento del Tablero; siempre con la identidad real).
  export function grupoSubastaDe(u){
    return grupoTableroDe(u, buildMandosIndex(AppState.mandosData));
  }

  function totalesResolucion(mandosIndex){
    var t = {};
    mandosIndex.forEach(function(e){
      var b = e.bucket, g = b.seccion || b.depto;
      if(!g || b.type === 'capellan') return;
      t[g] = (t[g] || 0) + 1;
    });
    return t;
  }

  export function tableroComandos(){
    var comando = (AppState.usersList || []).filter(function(u){ return !isMilicianoUser(u) && u.role !== 'pendiente'; });
    var mandosIndex = buildMandosIndex(AppState.mandosData);
    var totRes = totalesResolucion(mandosIndex);
    var filas = SECCIONES.concat(DEPARTAMENTOS).map(function(g){
      var miembros = comando.filter(function(u){ return grupoTableroDe(u, mandosIndex) === g; });
      var vals = miembros.map(avanceGuardadoDe).filter(function(v){ return v !== null; });
      var total = Math.max(totRes[g] || 0, miembros.length);
      var suma = vals.reduce(function(x, y){ return x + y; }, 0);
      return { grupo: g, tipo: SECCIONES.indexOf(g) >= 0 ? 'seccion' : 'depto', total: total, conDatos: vals.length,
        promedio: total ? Math.round(suma / total) : 0,
        bonus: miembros.reduce(function(s, u){ return s + bonusDe(u); }, 0) };
    }).sort(function(x, y){ return (y.promedio - x.promedio) || (y.conDatos - x.conDatos); });
    // Posición: empatados comparten el puesto.
    filas.forEach(function(f, i){ f.pos = (i && f.promedio === filas[i - 1].promedio) ? filas[i - 1].pos : i + 1; });
    return filas;
  }

  // El comando propio para la tarjeta fija: Formación si es de Formación.
  function miGrupoTablero(mandosIndex){
    var cu = AppState.currentUser;
    if(cu && esFormacionMember(cu, mandosIndex)) return 'Formación';
    return miGrupoActual(mandosIndex);
  }

  function comandoIconHtml(f){
    var inner = f.tipo === 'seccion' ? sectionShieldHtml(f.grupo) : icon(DEPARTAMENTO_SVG_ICON[f.grupo] || 'users');
    return '<span class="tablero-icon tablero-icon-' + f.tipo + '">' + inner + '</span>';
  }

  // «N de M con avance»: solo para el admin (pedido del usuario, 06/11/2026).
  function metaTxt(f){ return f.conDatos + ' de ' + f.total + ' con avance'; }
  // T10: el bonus de minijuegos se ve aparte (no cambia el puesto).
  function metaHtml(f, tag){ return (isAdmin() ? '<' + tag + ' class="tablero-meta">' + metaTxt(f) + '</' + tag + '>' : '') + (f.bonus ? '<' + tag + ' class="tablero-bonus" title="Bonus de minijuegos">+' + f.bonus + ' bonus</' + tag + '>' : ''); }

  // T14 E3 (06/11/2026): mapa del hijo pródigo (Lc 15). Cada comando va
  // sobre el camino según su promedio: 0% = entre los chanchos, 100% = la
  // casa del Padre. El SVG fija el camino; los escudos y las estaciones son
  // HTML encima, ubicados al abrir con getPointAtLength() (ver
  // ubicarMapa()). Los que están cerca (≤4 puntos) se agrupan en un racimo.
  var MAPA_CAMINO = 'M150 345 C 225 352, 255 300, 212 250 S 140 125, 285 145 S 430 270, 470 190 S 470 110, 515 95';
  var MAPA_ESTACIONES = [
    { pct: 0, label: 'El valle de los cerdos', lado: 'abajo', lugar: 'valle' },
    { pct: 25, label: 'La encrucijada', lado: 'der', lugar: 'encrucijada' },
    { pct: 50, label: 'El camino de retorno', lado: 'arriba', lugar: 'retorno' },
    { pct: 75, label: 'La Tranquera', lado: 'abajo', lugar: 'tranquera' },
    { pct: 100, label: 'La casa del Padre', lado: 'izq', lugar: 'casa' }
  ];
  // Qué es cada lugar del mapa (se ve al tocarlo).
  var MAPA_LUGARES = {
    valle: { t: 'El valle de los cerdos', cita: 'Lc 15, 15-16', d: 'Lejos de casa, el hijo termina cuidando cerdos y con hambre. Es el punto de partida: con los primeros puntos, el comando arranca acá el camino de vuelta.' },
    encrucijada: { t: 'La encrucijada', cita: 'Lc 15, 17-18', d: '«Entonces recapacitó». El momento de decidir: seguir lejos o levantarse e ir a la casa del Padre. De acá sale el desvío a los pueblos extranjeros.' },
    retorno: { t: 'El camino de retorno', cita: 'Lc 15, 20', d: '«Se levantó y volvió a la casa de su padre». El regreso se hace paso a paso: cada entrada completada es un tramo más.' },
    tranquera: { t: 'La Tranquera', cita: 'Lc 15, 20', d: '«Cuando todavía estaba lejos, su padre lo vio y corrió a su encuentro». La entrada a las tierras del Padre: el portón está abierto.' },
    casa: { t: 'La casa del Padre', cita: 'Lc 15, 22-24', d: 'El abrazo, el anillo, las sandalias y la fiesta. La meta del camino: volver a casa como hijos.' },
    extranjeros: { t: 'Pueblos extranjeros', cita: 'Lc 15, 13', d: '«Se fue a un país lejano». Acá esperan los comandos que todavía no arrancaron (0%): con el primer punto pasan al camino.' },
    lago: { t: 'El lago', cita: '', d: 'El camino de vuelta no siempre es en línea recta: a veces hay que rodear obstáculos, pero se sigue avanzando.' },
    tierras: { t: 'Las tierras del Padre', cita: 'Lc 15, 17', d: '«¡Cuántos jornaleros de mi padre tienen pan en abundancia!». Viñas, trigo, olivos y ganado: la abundancia de la casa del Padre.' }
  };

  // Ilustraciones del mapa (06/11/2026): trazo redondeado como los íconos
  // Lucide de la página, con relleno suave; colores por variables CSS.
  // Porqueriza: cerco de madera, barro y un chancho embarrado.
  // Porqueriza: cerco con postes de punta de flecha (guiño FASTA), barro,
  // abrevadero y tres chanchos (uno grande y dos lechones).
  function mapaChanchoSvg(x, y, k, espejo){
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + (espejo ? -k : k) + ' ' + k + ') translate(-60 -46)">' +
      '<path class="mc-cuerpo" d="M40 49c0-9 8-14 19-14s19 5 19 14-8 9-19 9-19-2-19-9z"/>' +
      '<path class="mc-cuerpo" d="M72 34l3-6 3 7"/>' +
      '<circle class="mc-cuerpo" cx="77" cy="43" r="9"/>' +
      '<ellipse class="mc-hocico" cx="86" cy="45" rx="4" ry="5"/>' +
      '<path class="mc-piel-linea" d="M85.2 43.5v1M87.4 43.5v1M40 45c-4 0-6-2-5-4s4-1 3 1"/>' +
      '<circle class="mc-ojo" cx="78" cy="40" r="1.5"/>' +
      '<path class="mc-salpicon" d="M46 53c3-2 6-1 8 1-2 2-6 2-8-1z"/>' +
      '<circle class="mc-barro-osc" cx="58" cy="45" r="1.6"/></g>';
  }
  var MAPA_SVG_CHANCHO = '<svg viewBox="0 0 150 76" aria-hidden="true">' +
    '<path class="mc-madera" d="M6 24h5v36H6zM44 22h5v38h-5zM96 22h5v38h-5zM139 24h5v36h-5z"/>' +
    '<path class="mc-flecha" d="M3.5 26l5-6 5 6M41.5 24l5-6 5 6M93.5 24l5-6 5 6M136.5 26l5-6 5 6"/>' +
    '<path class="mc-tabla" d="M4 32h142M4 44h142"/>' +
    '<path class="mc-barro" d="M3 64c3-7 16-9 30-8s24-5 38-4 28-2 40 2 28 3 33 9-12 10-46 10-60 0-80-1-17-3-15-8z"/>' +
    '<ellipse class="mc-barro-osc" cx="24" cy="66" rx="9" ry="2.5"/>' +
    '<ellipse class="mc-barro-osc" cx="84" cy="69" rx="10" ry="2.4"/>' +
    '<path class="mc-abrevadero" d="M112 54h30l-3 10h-24z"/>' +
    '<path class="mc-agua" d="M115 57.5h24"/>' +
    mapaChanchoSvg(62, 54, 1) + mapaChanchoSvg(24, 60, .62, true) + mapaChanchoSvg(103, 62, .55) +
    '</svg>';
  // La casa del Padre: casona de estancia con galería, techo de tejas,
  // cruz en el frente, ventanas iluminadas, chimenea con humo y un galpón.
  var MAPA_SVG_CASA = '<svg viewBox="0 0 100 68" aria-hidden="true">' +
    '<path class="mc-humo" d="M71 13c-3-3 1-5-1-8s2-4 0-6"/>' +
    '<path class="mc-galpon" d="M2 63V46l10-8 10 8v17z"/>' +
    '<path class="mc-galpon-techo" d="M0 47l12-10 12 10"/>' +
    '<path class="mc-linea-fina" d="M8 63v-9h8v9M8 54l8 9M16 54l-8 9"/>' +
    '<rect class="mc-pared" x="24" y="32" width="56" height="31"/>' +
    '<rect class="mc-chimenea" x="67" y="14" width="6" height="14"/>' +
    '<path class="mc-techo-fill" d="M18 34L52 9l34 25z"/>' +
    '<path class="mc-tejas" d="M28 27h48M36 21h32M44 15h16"/>' +
    '<circle class="mc-ventana" cx="52" cy="24" r="3.2"/>' +
    '<path class="mc-cruz" d="M52 9V1M48.6 3.8h6.8"/>' +
    '<rect class="mc-galeria" x="20" y="40" width="64" height="3.5" rx="1"/>' +
    '<path class="mc-columnas" d="M24 43.5V63M36 43.5V63M68 43.5V63M80 43.5V63"/>' +
    '<path class="mc-puerta" d="M47 63V52a5 5 0 0 1 10 0v11z"/>' +
    '<rect class="mc-ventana" x="27.5" y="49" width="6" height="8" rx="1"/>' +
    '<rect class="mc-ventana" x="39" y="49" width="5" height="8" rx="1"/>' +
    '<rect class="mc-ventana" x="60" y="49" width="5" height="8" rx="1"/>' +
    '<rect class="mc-ventana" x="70.5" y="49" width="6" height="8" rx="1"/>' +
    '<path class="mc-linea-fina" d="M30.5 49v8M27.5 53h6M41.5 49v8M62.5 49v8M73.5 49v8M70.5 53h6"/>' +
    '<path class="mc-suelo" d="M0 63.5h100"/>' +
    '<circle class="mc-flor" cx="23" cy="61" r="1.6"/><circle class="mc-flor" cx="85" cy="61" r="1.6"/><circle class="mc-flor" cx="89" cy="60.5" r="1.3"/>' +
    '</svg>';

  // Pueblos extranjeros: un caserío de adobe (casas cúbicas de techo plano,
  // al estilo de la época) apoyado sobre la cresta de la izquierda, gris y
  // venido a menos: una casa en ruinas, árboles secos y escombros.
  function mapaCasita(x, y, w, h, ruina){
    var d = w * .35, top = y - h;
    var frente = ruina
      ? 'M' + x + ' ' + y + 'V' + top + 'h' + (w * .45) + 'l' + (w * .12) + ' ' + (h * .3) + 'l' + (w * .15) + ' -' + (h * .12) + 'l' + (w * .28) + ' ' + (h * .45) + 'V' + y + 'z'
      : 'M' + x + ' ' + y + 'V' + top + 'h' + w + 'V' + y + 'z';
    var h2 = '<path class="mx-frente" d="' + frente + '"/>';
    if(!ruina){
      h2 += '<path class="mx-lado" d="M' + (x + w) + ' ' + y + 'V' + top + 'l' + d + ' -' + (d * .5) + 'V' + (y - d * .5) + 'z"/>' +
        '<path class="mx-techo-plano" d="M' + x + ' ' + top + 'l' + d + ' -' + (d * .5) + 'h' + w + 'l-' + d + ' ' + (d * .5) + 'z"/>';
    }
    h2 += '<rect class="mx-hueco" x="' + (x + w * .38) + '" y="' + (y - h * .55) + '" width="' + (w * .26) + '" height="' + (h * .55) + '" rx="' + (w * .1) + '"/>';
    if(w > 13 && !ruina) h2 += '<rect class="mx-hueco" x="' + (x + w * .1) + '" y="' + (y - h * .8) + '" width="' + (w * .16) + '" height="' + (w * .16) + '"/>';
    return h2;
  }
  function mapaArbolSeco(x, y, k){
    return '<path class="mx-arbol" d="M' + x + ' ' + y + 'v-' + (16 * k) + 'M' + x + ' ' + (y - 8 * k) + 'l-' + (6 * k) + ' -' + (5 * k) +
      'M' + x + ' ' + (y - 11 * k) + 'l' + (6 * k) + ' -' + (6 * k) + 'M' + (x - 6 * k) + ' ' + (y - 13 * k) + 'l-' + (2 * k) + ' -' + (3 * k) + '"/>';
  }
  var MAPA_SVG_PUEBLO =
    mapaArbolSeco(22, 226, 1) +
    mapaCasita(34, 216, 13, 12) + mapaCasita(50, 205, 16, 16) + mapaCasita(70, 190, 14, 13, true) +
    mapaCasita(86, 179, 17, 18) + mapaCasita(108, 170, 13, 12) + mapaCasita(124, 169, 15, 15) +
    mapaArbolSeco(148, 172, .9) +
    '<path class="mx-escombro" d="M64 192l3-3 3 2 2-2 3 3zM100 172l2-2 3 1 2-2 2 3z"/>';

  // Relieve: álamos (Mendoza) y rocas en las curvas del camino.
  function mapaAlamo(x, y, h){
    return '<path class="mr-tronco" d="M' + x + ' ' + y + 'v-' + (h * .35) + '"/>' +
      '<ellipse class="mr-copa" cx="' + x + '" cy="' + (y - h * .62) + '" rx="' + (h * .17) + '" ry="' + (h * .42) + '"/>' +
      '<path class="mr-copa-luz" d="M' + (x + h * .05) + ' ' + (y - h * .95) + 'q' + (h * .1) + ' ' + (h * .3) + ' 0 ' + (h * .6) + '"/>';
  }
  function mapaRoca(x, y, w){
    var h = w * .6;
    return '<path class="mr-roca" d="M' + (x - w / 2) + ' ' + y + 'l' + (w * .18) + ' -' + h + ' l' + (w * .4) + ' -' + (h * .25) + ' l' + (w * .3) + ' ' + (h * .55) + ' L' + (x + w / 2) + ' ' + y + 'z"/>' +
      '<path class="mr-roca-luz" d="M' + (x - w * .26) + ' ' + (y - h * .8) + 'l' + (w * .3) + ' -' + (h * .2) + '"/>';
  }
  // La estancia del Padre (lado derecho, dentro de la cerca): viñedo,
  // trigales, ganado y un molino — lo productiva que es la casa del Padre.
  function mapaVaca(x, y, k, espejo){
    return '<g class="me-vaca" transform="translate(' + x + ' ' + y + ') scale(' + (espejo ? -k : k) + ' ' + k + ')">' +
      '<path class="me-pata" d="M-6 4v5M-3 4v5M4 4v5M7 4v5"/>' +
      '<rect class="me-cuerpo" x="-9" y="-5" width="18" height="10" rx="4"/>' +
      '<path class="me-mancha" d="M-4-5c2 2 5 2 6 0zM3 1c2-1 4 0 4 2-2 1-4 0-4-2z"/>' +
      '<rect class="me-cuerpo" x="8" y="-8" width="7" height="7" rx="2.5"/>' +
      '<path class="me-pata" d="M9-8l-2-2M14-8l2-2"/></g>';
  }
  function mapaOveja(x, y, k){
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')">' +
      '<path class="me-pata" d="M-3 3v4M3 3v4"/>' +
      '<path class="me-lana" d="M-7 1a3 3 0 0 1 2-5 3 3 0 0 1 5-1 3 3 0 0 1 5 1 3 3 0 0 1 2 5 3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3z"/>' +
      '<ellipse class="me-cara" cx="8" cy="-1" rx="2.6" ry="3.2"/></g>';
  }
  function mapaVinedo(){
    var h = '';
    for(var i = 0; i < 6; i++){
      var x0 = 452 + i * 24, y0 = 392, x1 = x0 + 40, y1 = 285 + i * 4;
      h += '<path class="me-espaldera" d="M' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y1 + '"/>';
      for(var j = 1; j < 7; j++){
        var t = j / 7, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        h += '<circle class="me-hoja" cx="' + x.toFixed(1) + '" cy="' + (y - 2).toFixed(1) + '" r="3.4"/>';
        if(j % 2) h += '<circle class="me-uva" cx="' + (x + 2).toFixed(1) + '" cy="' + (y + 1.5).toFixed(1) + '" r="1.6"/>';
      }
    }
    return h;
  }
  function mapaTrigal(pts){
    var d = 'M' + pts.map(function(p){ return p.join(' '); }).join('L') + 'z';
    var surcos = '';
    for(var t = .2; t < 1; t += .2){
      var a = pts[0], b = pts[1], c = pts[3], e = pts[2];
      surcos += 'M' + (a[0] + (c[0] - a[0]) * t).toFixed(1) + ' ' + (a[1] + (c[1] - a[1]) * t).toFixed(1) +
        'L' + (b[0] + (e[0] - b[0]) * t).toFixed(1) + ' ' + (b[1] + (e[1] - b[1]) * t).toFixed(1);
    }
    return '<path class="me-trigo" d="' + d + '"/><path class="me-surco" d="' + surcos + '"/>';
  }
  // Pozo de piedra con su travesaño y balde (en vez del molino, para que
  // la estancia se sienta de la época del Evangelio).
  function mapaPozo(x, y){
    return '<path class="me-pozo" d="M' + (x - 9) + ' ' + (y - 8) + 'v8a9 3 0 0 0 18 0v-8"/>' +
      '<ellipse class="me-pozo" cx="' + x + '" cy="' + (y - 8) + '" rx="9" ry="3"/>' +
      '<path class="me-piedra" d="M' + (x - 9) + ' ' + (y - 4) + 'a9 3 0 0 0 18 0M' + (x - 4) + ' ' + (y - 5) + 'v3M' + (x + 3) + ' ' + (y - 5) + 'v3"/>' +
      '<path class="me-palo" d="M' + (x - 8) + ' ' + (y - 8) + 'v-14M' + (x + 8) + ' ' + (y - 8) + 'v-14M' + (x - 10) + ' ' + (y - 22) + 'h20M' + x + ' ' + (y - 22) + 'v6"/>' +
      '<path class="me-balde" d="M' + (x - 2.5) + ' ' + (y - 16) + 'h5l-1 4h-3z"/>';
  }
  // Olivo: tronco retorcido y copa ancha gris verdosa.
  function mapaOlivo(x, y, k){
    return '<path class="me-tronco-olivo" d="M' + x + ' ' + y + 'c' + (-2 * k) + ' -' + (4 * k) + ' ' + (2 * k) + ' -' + (6 * k) + ' 0 -' + (10 * k) + '"/>' +
      '<ellipse class="me-olivo" cx="' + (x - 3 * k) + '" cy="' + (y - 13 * k) + '" rx="' + (6 * k) + '" ry="' + (4.5 * k) + '"/>' +
      '<ellipse class="me-olivo" cx="' + (x + 4 * k) + '" cy="' + (y - 14 * k) + '" rx="' + (6 * k) + '" ry="' + (5 * k) + '"/>' +
      '<circle class="me-aceituna" cx="' + (x + 2 * k) + '" cy="' + (y - 12 * k) + '" r="' + (1 * k) + '"/><circle class="me-aceituna" cx="' + (x - 4 * k) + '" cy="' + (y - 14 * k) + '" r="' + (1 * k) + '"/>';
  }
  // Fuera de la estancia: austero (arbustos secos, rocas, matas de pasto).
  function mapaSeco(x, y, k){
    return '<path class="mr-seco" d="M' + x + ' ' + y + 'v-' + (10 * k) + 'M' + x + ' ' + (y - 5 * k) + 'l-' + (5 * k) + ' -' + (4 * k) +
      'M' + x + ' ' + (y - 7 * k) + 'l' + (5 * k) + ' -' + (5 * k) + 'M' + (x - 5 * k) + ' ' + (y - 9 * k) + 'l-' + (2 * k) + ' -' + (2 * k) + '"/>';
  }
  function mapaMata(x, y){
    return '<path class="mr-mata" d="M' + (x - 4) + ' ' + y + 'l2-6M' + x + ' ' + y + 'v-7M' + (x + 4) + ' ' + y + 'l-2-6"/>';
  }
  var MAPA_SVG_RELIEVE =
    mapaSeco(330, 330, 1.4) + mapaSeco(360, 322, 1) + mapaSeco(300, 318, .9) + mapaSeco(360, 225, 1.1) +
    mapaMata(250, 380) + mapaMata(345, 360) + mapaMata(120, 300) + mapaMata(385, 180) +
    mapaRoca(276, 372, 22) + mapaRoca(292, 375, 14) + mapaRoca(385, 362, 22) +
    mapaRoca(58, 286, 18) + mapaRoca(405, 160, 14) + mapaRoca(320, 250, 12);
  // Dentro de la estancia: abundancia (flores y arbustos además de lo productivo).
  function mapaArbusto(x, y, r){
    return '<circle class="me-arbusto" cx="' + x + '" cy="' + y + '" r="' + r + '"/><circle class="me-flor" cx="' + (x - r * .4) + '" cy="' + (y - r * .3) + '" r="' + (r * .28) + '"/>';
  }
  var MAPA_SVG_ESTANCIA =
    mapaTrigal([[520, 128], [598, 112], [604, 160], [530, 176]]) +
    mapaPozo(458, 166) + mapaOlivo(505, 192, 1.1) + mapaOlivo(528, 184, 1) + mapaOlivo(590, 196, 1.1) +
    mapaVinedo() +
    mapaVaca(536, 222, 1.15) + mapaVaca(566, 236, 1, true) + mapaOveja(512, 252, 1.1) + mapaOveja(590, 214, 1) + mapaOveja(548, 262, .9) +
    mapaAlamo(470, 262, 30) + mapaAlamo(478, 250, 26) + mapaAlamo(590, 296, 34) + mapaAlamo(578, 290, 30) +
    mapaArbusto(596, 186, 4) + mapaArbusto(530, 100, 4) + mapaArbusto(505, 112, 3.5) + mapaArbusto(588, 262, 4.5);

  // Lago entre La Encrucijada y El camino de retorno: explica la vuelta que
  // da el camino (lo rodea por la izquierda). Orilla, agua, reflejos y juncos.
  var MAPA_SVG_LAGO =
    '<path class="ml-orilla" d="M210 230C197 221,188 206,188 188S195 159,214 154S256 150,272 161S285 197,268 213S228 236,210 230Z"/>' +
    '<path class="ml-agua" d="M213 224C202 217,194 203,194 188S200 165,216 160S252 157,266 166S277 195,263 208S230 229,213 224Z"/>' +
    '<path class="ml-reflejo" d="M208 186h20M222 196h26M214 207h16"/>' +
    '<path class="ml-junco" d="M268 206v-9M271 203v-12M274 199v-8M228 232v-8M231 233v-11M234 232v-7"/>' +
    '<ellipse class="ml-espiga" cx="271" cy="190" rx="1.2" ry="2.6"/><ellipse class="ml-espiga" cx="231" cy="221" rx="1.2" ry="2.6"/>';

  // Cresta de la cordillera de atrás, de izquierda a la cerca (440,118).
  var MAPA_CRESTA_IZQ = 'M0 235 C 50 205, 85 150, 140 168 S 225 105, 290 145 S 375 85, 440 118';

  function renderMapaHtml(filas, mio){
    var html = '<section class="tablero-mapa"><h3>El camino de vuelta</h3>' +
      '<div class="mapa-lienzo">' +
      '<svg viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true"><defs>' +
      '<linearGradient id="mapaG1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="mapa-g1a"/><stop offset="1" class="mapa-g1b"/></linearGradient>' +
      '<linearGradient id="mapaG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="mapa-g2a"/><stop offset="1" class="mapa-g2b"/></linearGradient>' +
      '<radialGradient id="mapaLuz"><stop offset="0" class="mapa-luz-a"/><stop offset="1" class="mapa-luz-b"/></radialGradient>' +
      '<linearGradient id="mapaCalido" x1="1" y1="0" x2="0" y2="1"><stop offset="0" class="mapa-calido-a"/><stop offset="1" class="mapa-calido-b"/></linearGradient>' +
      '<radialGradient id="mapaNiebla"><stop offset="0" class="mapa-niebla-a"/><stop offset=".6" class="mapa-niebla-m"/><stop offset="1" class="mapa-niebla-b"/></radialGradient></defs>' +
      '<ellipse cx="85" cy="150" rx="150" ry="100" fill="url(#mapaNiebla)"/>' +
      '<circle cx="560" cy="70" r="105" fill="url(#mapaLuz)"/>' +
      '<path fill="url(#mapaG1)" d="M0 235 C 50 205, 85 150, 140 168 S 225 105, 290 145 S 375 85, 440 118 C 480 98, 510 68, 545 66 S 590 66, 600 70 L600 400 L0 400 Z"/>' +
      MAPA_SVG_RELIEVE + MAPA_SVG_PUEBLO +
      '<path fill="url(#mapaG2)" d="M0 318 C 75 280, 145 302, 215 272 S 355 228, 430 258 S 535 215, 600 238 L600 400 L0 400 Z"/>' +
      '<path class="mapa-afuera"/><path class="mapa-dominio-verde mapa-dominio"/><path class="mapa-dominio-luz mapa-dominio" fill="url(#mapaCalido)"/>' +
      MAPA_SVG_ESTANCIA + MAPA_SVG_LAGO +
      // Bordes primero y centros después: el desvío y el camino se funden
      // en La Encrucijada, sin una línea que los separe.
      '<path class="mapa-desvio-borde mapa-desvio"/>' +
      '<path class="mapa-sendero-borde" d="' + MAPA_CAMINO + '"/>' +
      '<path class="mapa-desvio-centro mapa-desvio"/>' +
      '<path class="mapa-sendero mapa-camino" d="' + MAPA_CAMINO + '"/>' +
      '<path class="mapa-cerca-riel"/><path class="mapa-cerca-poste"/><g class="mapa-mojones"></g>' +
      '<g class="mapa-tranquera"></g>' +
      '</svg>' +
      '<span class="mapa-deco mapa-chancho" data-lugar="valle" role="button" tabindex="0" aria-label="El valle de los cerdos">' + MAPA_SVG_CHANCHO + '</span>' +
      '<span class="mapa-deco mapa-casa" data-lugar="casa" role="button" tabindex="0" aria-label="La casa del Padre">' + MAPA_SVG_CASA + '</span>' +
      '<button type="button" class="mapa-zona-label" data-lugar="extranjeros">Pueblos extranjeros</button>' +
      // Zonas tocables sin etiqueta propia (invisibles).
      '<button type="button" class="mapa-hit" data-lugar="extranjeros" style="left:14%;top:46%" aria-label="Pueblos extranjeros"></button>' +
      '<button type="button" class="mapa-hit" data-lugar="lago" style="left:40%;top:48%" aria-label="El lago"></button>' +
      '<button type="button" class="mapa-hit mapa-hit-grande" data-lugar="tierras" style="left:90%;top:64%" aria-label="Las tierras del Padre"></button>';
    MAPA_ESTACIONES.forEach(function(e, i){
      html += '<div class="mapa-estacion mapa-lado-' + e.lado + '" data-pct="' + e.pct + '">' +
        '<span class="mapa-punto"></span>' +
        '<button type="button" class="mapa-label" data-lugar="' + e.lugar + '"><b>' + (i + 1) + '</b><span class="mapa-label-txt">' + escapeHtml(e.label) + '</span></button></div>';
    });
    // Pueblos extranjeros (Lc 15, 13): los comandos en 0% (nadie avanzó
    // todavía) esperan ahí, en el desvío de La Encrucijada; con el primer
    // punto pasan al camino. El resto, en racimos a ≤4 puntos del primero.
    var lejos = filas.filter(function(f){ return !f.promedio; });
    var orden = filas.filter(function(f){ return f.promedio; }).sort(function(a, b){ return a.promedio - b.promedio; });
    var racimos = [];
    orden.forEach(function(f){
      var r = racimos[racimos.length - 1];
      if(r && f.promedio - r[0].promedio <= 4) r.push(f); else racimos.push([f]);
    });
    racimos.forEach(function(r){
      var pct = Math.round(r.reduce(function(x, f){ return x + f.promedio; }, 0) / r.length);
      html += mapaGrupoHtml(r, mio, 'data-pct="' + pct + '"');
    });
    if(lejos.length) html += mapaGrupoHtml(lejos, mio, 'data-zona="extranjeros"');
    html += '<div class="mapa-pop" role="dialog" hidden></div></div>' +
      '<p class="tablero-meta mapa-ayuda">Tocá los lugares del mapa para saber qué son.</p>';
    // Referencia numerada (solo en celular, donde las etiquetas no entran).
    html += '<ol class="mapa-leyenda">' + MAPA_ESTACIONES.map(function(e){ return '<li>' + escapeHtml(e.label) + '</li>'; }).join('') +
      '<li class="mapa-leyenda-zona">Pueblos extranjeros (sin avance)</li></ol></section>';
    return html;
  }

  // Una «pila» (hasta 3 escudos superpuestos + «+N»); al tocarla, un
  // globito con nombre, puesto y % de cada uno.
  function mapaGrupoHtml(r, mio, attrs){
    r = r.slice().sort(function(x, y){ return (y.grupo === mio) - (x.grupo === mio) || x.pos - y.pos; });
    var esMio = r.some(function(f){ return f.grupo === mio; });
    var nombres = r.map(function(f){ return f.grupo + ' ' + f.pos + '° ' + f.promedio + '%'; }).join(', ');
    var visibles = r.slice(0, 3), extra = r.length - visibles.length;
    var html = '<div class="mapa-grupo' + (esMio ? ' es-mio' : '') + '" ' + attrs + '>' +
      (esMio ? '<span class="mapa-tuyo">Tu comando</span>' : '') +
      '<button type="button" class="mapa-pila" aria-haspopup="dialog" aria-label="' + escapeHtml(nombres) + '">';
    visibles.forEach(function(f){
      html += '<span class="mapa-av' + (f.grupo === mio ? ' es-mio' : '') + '">' + comandoIconHtml(f) + '</span>';
    });
    if(extra) html += '<span class="mapa-mas">+' + extra + '</span>';
    html += '</button><div class="mapa-pop-content" hidden>';
    r.forEach(function(f){
      html += '<div class="mapa-pop-fila' + (f.grupo === mio ? ' es-mio' : '') + '">' + comandoIconHtml(f) +
        '<span class="mapa-pop-nombre">' + escapeHtml(f.grupo) + (f.grupo === mio ? ' <small>(tu comando)</small>' : '') + '</span>' +
        '<span class="mapa-pop-pos">' + f.pos + '°</span><span class="mapa-pop-pct">' + f.promedio + '%</span></div>';
    });
    return html + '</div></div>';
  }

  function cerrarMapaPop(){
    var pop = document.querySelector('.mapa-pop');
    if(pop) pop.hidden = true;
    document.querySelectorAll('.mapa-grupo.abierto, .mapa-lienzo .abierto').forEach(function(g){ g.classList.remove('abierto'); });
  }

  // Cierra el globito al tocar afuera o con Escape (instalado una sola vez).
  var mapaDocListo = false;
  function ubicarMapa(){
    var lienzo = document.querySelector('.mapa-lienzo');
    if(!lienzo) return;
    var camino = lienzo.querySelector('path.mapa-camino');
    if(!camino || !camino.getTotalLength) return;
    var L = camino.getTotalLength();
    lienzo.querySelectorAll('[data-pct]').forEach(function(el){
      var pt = camino.getPointAtLength(L * Math.max(0, Math.min(100, +el.getAttribute('data-pct'))) / 100);
      el.style.left = (pt.x / 600 * 100) + '%';
      el.style.top = (pt.y / 400 * 100) + '%';
    });
    // Desvío: nace en La Encrucijada (25%) y se va a la izquierda, a pueblos
    // extranjeros (del lado opuesto a la casa del Padre).
    var p0 = camino.getPointAtLength(L * .25);
    var dDesvio = 'M' + p0.x.toFixed(1) + ' ' + p0.y.toFixed(1) + ' C ' + (p0.x - 70).toFixed(1) + ' ' + (p0.y + 15).toFixed(1) + ', 70 270, 88 190';
    lienzo.querySelectorAll('path.mapa-desvio').forEach(function(d){ d.setAttribute('d', dDesvio); });
    // Cerca de los dominios del Padre: cruza todo el mapa (de arriba a abajo,
    // saliendo por los bordes) y el camino entra por La Tranquera (75%).
    // Postes con punta de flecha (guiño a las flechas del emblema de FASTA).
    function puntoNormal(f, off){
      var a = camino.getPointAtLength(L * Math.max(0, f - .004)), b = camino.getPointAtLength(L * Math.min(1, f + .004));
      var dx = b.x - a.x, dy = b.y - a.y, n = Math.sqrt(dx * dx + dy * dy) || 1;
      var p = camino.getPointAtLength(L * f);
      return { x: p.x + (-dy / n) * off, y: p.y + (dx / n) * off };
    }
    // Portón de frente, centrado en La Tranquera: un poste a cada costado.
    var pT = camino.getPointAtLength(L * .75);
    var arriba = { x: pT.x + 13, y: pT.y + 5 }, abajo = { x: pT.x - 13, y: pT.y + 5 };
    var postes = '', rieles = '', mojones = '';
    // Alambrado curvo (Bézier cuadrática): dos hilos, postes chicos y, cada
    // 5, un mojón con punta de flecha.
    function curva(a, c, b){
      var largo = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2)) * 1.1, n = Math.max(2, Math.round(largo / 16));
      rieles += 'M' + (a.x - 2) + ' ' + a.y + 'Q' + (c.x - 2) + ' ' + c.y + ' ' + (b.x - 2).toFixed(1) + ' ' + b.y.toFixed(1) +
        'M' + (a.x + 2) + ' ' + a.y + 'Q' + (c.x + 2) + ' ' + c.y + ' ' + (b.x + 2).toFixed(1) + ' ' + b.y.toFixed(1);
      for(var k = 0; k <= n; k++){
        var t = k / n, u = 1 - t;
        var x = u * u * a.x + 2 * u * t * c.x + t * t * b.x, y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
        if(k % 5 === 2) mojones += '<rect x="' + (x - 3).toFixed(1) + '" y="' + (y - 9).toFixed(1) + '" width="6" height="11" rx="1"/>' +
          '<path d="M' + (x - 2.4).toFixed(1) + ' ' + (y - 4.5).toFixed(1) + 'l2.4-2.6 2.4 2.6"/>';
        else postes += 'M' + x.toFixed(1) + ' ' + (y - 3).toFixed(1) + 'v6';
      }
    }
    // Arriba arranca en la cresta de la cordillera de atrás (no en el cielo).
    var A0 = { x: 440, y: 118 }, CA = { x: 412, y: 150 }, B1 = { x: 405, y: 414 }, CB = { x: 472, y: 330 };
    curva(A0, CA, arriba);
    curva(abajo, CB, B1);
    // Tierras del Padre (derecha de la cerca) y afuera: dos rellenos.
    // Los rellenos llegan hasta la cresta (MAPA_CRESTA), no al cielo.
    var borde = 'Q' + CA.x + ' ' + CA.y + ' ' + arriba.x.toFixed(1) + ' ' + arriba.y.toFixed(1) + 'L' + abajo.x.toFixed(1) + ' ' + abajo.y.toFixed(1) + 'Q' + CB.x + ' ' + CB.y + ' 405 414';
    lienzo.querySelectorAll('path.mapa-dominio').forEach(function(d){
      d.setAttribute('d', 'M440 118' + borde + 'L610 414L610 70L600 70C590 66 576 66 545 66C510 68 480 98 440 118Z');
    });
    lienzo.querySelector('path.mapa-afuera').setAttribute('d', MAPA_CRESTA_IZQ + borde + 'L-10 414L-10 235Z');
    lienzo.querySelector('path.mapa-cerca-poste').setAttribute('d', postes);
    lienzo.querySelector('path.mapa-cerca-riel').setAttribute('d', rieles);
    lienzo.querySelector('.mapa-mojones').innerHTML = mojones;
    // La Tranquera: portón de madera de frente — dos postes, viga de
    // dintel con un cartel de tablas encima, un arco debajo de la viga y
    // las dos hojas abiertas hacia adentro de la estancia.
    var t0 = camino.getPointAtLength(L * .746), t1 = camino.getPointAtLength(L * .754);
    var tx = t1.x - t0.x, ty = t1.y - t0.y, tn = Math.sqrt(tx * tx + ty * ty) || 1;
    tx /= tn; ty /= tn;
    var izq = abajo, der = arriba, tope = izq.y - 30, f = function(n){ return n.toFixed(1); };
    var g = '';
    // Hojas abiertas (detrás de los postes).
    [izq, der].forEach(function(p){
      var hx = tx * 13, hy = ty * 13 + 4, b0 = p.y - 1;
      g += '<path class="mt-hoja" d="M' + f(p.x) + ' ' + f(b0) + 'l' + f(hx) + ' ' + f(hy) + 'M' + f(p.x) + ' ' + f(b0 - 5) + 'l' + f(hx) + ' ' + f(hy) +
        'M' + f(p.x) + ' ' + f(b0 - 10) + 'l' + f(hx) + ' ' + f(hy) + 'M' + f(p.x + hx) + ' ' + f(b0 + hy + 1) + 'v-12' +
        'M' + f(p.x) + ' ' + f(b0) + 'l' + f(hx) + ' ' + f(hy - 10) + '"/>';
    });
    // Postes con punta de flecha (guiño FASTA).
    [izq, der].forEach(function(p){
      g += '<rect class="mt-poste" x="' + f(p.x - 2.6) + '" y="' + f(tope) + '" width="5.2" height="' + f(p.y - tope + 1) + '" rx="1"/>' +
        '<path class="mt-punta" d="M' + f(p.x - 2.6) + ' ' + f(tope) + 'l2.6-3.6 2.6 3.6z"/>';
    });
    var ancho = der.x - izq.x;
    g += '<path class="mt-arco" d="M' + f(izq.x + 2.6) + ' ' + f(tope + 15) + 'Q' + f(pT.x) + ' ' + f(tope + 5) + ' ' + f(der.x - 2.6) + ' ' + f(tope + 15) + '"/>' +
      '<rect class="mt-viga" x="' + f(izq.x - 7) + '" y="' + f(tope + 3) + '" width="' + f(ancho + 14) + '" height="4.2" rx="1.2"/>' +
      '<rect class="mt-cartel" x="' + f(pT.x - 10) + '" y="' + f(tope - 6) + '" width="20" height="8.5" rx="1.5"/>' +
      '<path class="mt-veta" d="M' + f(pT.x - 7) + ' ' + f(tope - 3) + 'h14M' + f(pT.x - 6) + ' ' + f(tope - .5) + 'h10"/>' +
      '<path class="mt-cuerda" d="M' + f(pT.x - 6) + ' ' + f(tope + 2.5) + 'v1M' + f(pT.x + 6) + ' ' + f(tope + 2.5) + 'v1"/>';
    lienzo.querySelector('.mapa-tranquera').innerHTML = g;
    var pop = lienzo.querySelector('.mapa-pop');
    // Arriba o abajo del punto (x,y) según dónde está; sin salirse del mapa.
    function ubicarPop(x, y, alto){
      var W = lienzo.clientWidth, H = lienzo.clientHeight, w = pop.offsetWidth, h = pop.offsetHeight;
      pop.style.left = Math.max(4, Math.min(W - w - 4, x - w / 2)) + 'px';
      var arriba = y - alto - h >= 0 || (y + alto + h > H && y > H - y);
      var top = arriba ? y - alto - h : y + alto;
      pop.style.top = Math.max(-h + 40, Math.min(H - 40, top)) + 'px';
    }
    lienzo.querySelectorAll('.mapa-grupo').forEach(function(g){
      g.querySelector('.mapa-pila').onclick = function(ev){
        ev.stopPropagation();
        if(g.classList.contains('abierto')){ cerrarMapaPop(); return; }
        cerrarMapaPop();
        g.classList.add('abierto');
        pop.innerHTML = g.querySelector('.mapa-pop-content').innerHTML;
        pop.hidden = false;
        ubicarPop(g.offsetLeft, g.offsetTop, g.querySelector('.mapa-pila').offsetHeight / 2 + 8);
      };
    });
    // Lugares: al tocarlos, qué son y por qué están (Lc 15).
    lienzo.querySelectorAll('[data-lugar]').forEach(function(el){
      var abrir = function(ev){
        ev.stopPropagation();
        if(el.classList.contains('abierto')){ cerrarMapaPop(); return; }
        cerrarMapaPop();
        var l = MAPA_LUGARES[el.getAttribute('data-lugar')];
        if(!l) return;
        el.classList.add('abierto');
        pop.innerHTML = '<div class="mapa-lugar-pop"><strong>' + escapeHtml(l.t) + '</strong>' +
          (l.cita ? '<small>' + escapeHtml(l.cita) + '</small>' : '') + '<p>' + escapeHtml(l.d) + '</p></div>';
        pop.hidden = false;
        var r = el.getBoundingClientRect(), base = lienzo.getBoundingClientRect();
        ubicarPop(r.left - base.left + r.width / 2, r.top - base.top + r.height / 2, r.height / 2 + 6);
      };
      el.onclick = abrir;
      el.onkeydown = function(ev){ if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); abrir(ev); } };
    });
    engancharMapaEventos(lienzo);
    if(!mapaDocListo){
      mapaDocListo = true;
      document.addEventListener('click', function(ev){ if(!ev.target.closest || !ev.target.closest('.mapa-pop')) cerrarMapaPop(); });
      document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') cerrarMapaPop(); });
    }
  }


  function renderTableroHtml(){
    var filas = tableroComandos();
    var mandosIndex = buildMandosIndex(AppState.mandosData);
    var mio = miGrupoTablero(mandosIndex);
    var mia = filas.filter(function(f){ return f.grupo === mio; })[0];
    var html = '';

    if(mia){
      html += '<div class="tablero-mio">' + comandoIconHtml(mia) +
        '<div class="tablero-mio-info"><span class="tablero-mio-label">Tu comando</span>' +
        '<strong>' + escapeHtml(mia.grupo) + '</strong>' + metaHtml(mia, 'span') + '</div>' +
        '<div class="tablero-mio-nums"><span class="tablero-mio-pos">' + mia.pos + '°</span>' +
        '<span class="tablero-mio-pct">' + mia.promedio + '%</span></div></div>';
    }

    html += renderMapaHtml(filas, mio);

    // Podio: 2° · 1° · 3° (en celular, 1° · 2° · 3°).
    var top = filas.slice(0, 3);
    html += '<div class="tablero-podio">';
    [1, 0, 2].forEach(function(i){
      var f = top[i];
      if(!f) return;
      html += '<div class="podio-col podio-' + (i + 1) + (f.grupo === mio ? ' es-mio' : '') + '">' +
        comandoIconHtml(f) +
        '<span class="podio-nombre">' + escapeHtml(f.grupo) + '</span>' +
        '<span class="podio-pct">' + f.promedio + '%</span>' +
        metaHtml(f, 'span') +
        '<div class="podio-base"><span>' + f.pos + '°</span></div></div>';
    });
    html += '</div>';

    var resto = filas.slice(3);
    if(resto.length){
      html += '<details class="tablero-resto"' + (AppState.tableroRestoOpen ? ' open' : '') + '>' +
        '<summary>Resto del ranking (' + resto.length + ')</summary><table class="tablero-tabla"><tbody>';
      resto.forEach(function(f){
        html += '<tr' + (f.grupo === mio ? ' class="es-mio"' : '') + '><td class="tt-pos">' + f.pos + '°</td>' +
          '<td><div class="tt-nombre">' + comandoIconHtml(f) + '<span>' + escapeHtml(f.grupo) + '' + metaHtml(f, 'small') + '</span></div></td>' +
          '<td class="tt-barra"><div class="perfil-barra"><span style="width:' + f.promedio + '%"></span></div></td>' +
          '<td class="tt-pct">' + f.promedio + '%</td></tr>';
      });
      html += '</tbody></table></details>';
    }
    return html;
  }

  // T17 (05/11/2026): quién no completó las obligatorias ya publicadas.
  // Cada uno guarda las suyas en `users/{uid}.obligPendientes` (ver
  // rangos.service.js). El jefe de sección/depto ve a los de su comando
  // (mismos que Mi comando; Formación = todos los suyos); el admin, todos.
  function obligatoriasVigentes(){
    var m = {};
    (AppState.state.entries || []).forEach(function(e){
      if(!e.deletedAt && !estaOculta(e) && obligatoriaRangoDe(e)) m[e.id] = e;
    });
    return m;
  }

  function miembrosDeGrupo(comando, g, mandosIndex){
    return comando.filter(function(u){
      return g === 'Formación' ? esFormacionMember(u, mandosIndex) : comandoGrupoDe(u, mandosIndex) === g;
    });
  }

  // Nombres de la resolución (sin capellanes) de un comando que todavía no
  // tienen cuenta: ningún usuario registrado matchea su nombre.
  function sinLoguearseDe(g, mandosIndex){
    var logueados = {};
    (AppState.usersList || []).forEach(function(u){
      var f = findMandoByName(u.displayName || '', mandosIndex);
      if(f) logueados[f.norm] = true;
    });
    var vistos = {};
    return mandosIndex.filter(function(e){
      var b = e.bucket;
      if(b.type === 'capellan' || logueados[e.norm] || vistos[e.norm]) return false;
      if((b.seccion || b.depto || COMANDO_CENTRAL) !== g) return false;
      vistos[e.norm] = true;
      return true;
    }).map(function(e){ return e.name; });
  }

  function renderObligatoriasHtml(){
    var rol = effectiveRole();
    if(rol !== 'admin' && rol !== 'jefe_seccion') return '';
    var vigentes = obligatoriasVigentes();
    var sinObligs = !Object.keys(vigentes).length;
    var comando = (AppState.usersList || []).filter(function(u){ return !isMilicianoUser(u) && u.role !== 'pendiente'; });
    var mandosIndex = buildMandosIndex(AppState.mandosData);
    var grupos = rol === 'admin' ? SECCIONES.concat(DEPARTAMENTOS, [COMANDO_CENTRAL]) : [miGrupoTablero(mandosIndex)];
    var totalFaltan = 0, cuerpo = '';
    var nombre = function(u){ return escapeHtml(u.displayName || u.email || 'Sin nombre'); };
    grupos.forEach(function(g){
      var deben = [], alDiaL = [], sinLogL = sinLoguearseDe(g, mandosIndex);
      miembrosDeGrupo(comando, g, mandosIndex).forEach(function(u){
        var ids = obligPendientesDe(u);
        if(ids === null) return;
        var faltan = ids.filter(function(id){ return vigentes[id]; }).map(function(id){ return vigentes[id]; });
        if(faltan.length) deben.push({ u: u, faltan: faltan }); else alDiaL.push(u);
      });
      if(!deben.length && !alDiaL.length && !sinLogL.length) return;
      totalFaltan += deben.length;
      var tipo = SECCIONES.indexOf(g) >= 0 ? 'seccion' : 'depto';
      var cnt = function(n, txt, cls){ return n ? '<span class="oblig-cnt ' + cls + '">' + n + ' ' + txt + '</span>' : ''; };
      var h = '<div class="oblig-grupo"><div class="oblig-head">' + comandoIconHtml({ grupo: g, tipo: tipo }) +
        '<strong>' + escapeHtml(g) + '</strong><span class="oblig-cnts">' +
        cnt(deben.length, deben.length === 1 ? 'debe' : 'deben', 'cnt-debe') +
        cnt(alDiaL.length, 'al día', 'cnt-ok') +
        (sinLogL.length ? '<button type="button" class="oblig-cnt cnt-nd oblig-cnt-btn" data-sinlog="' + escapeHtml(g) + '" aria-expanded="' + (AppState.tableroSinLogOpen === g) + '">' + sinLogL.length + ' sin loguearse</button>' : '') +
        '</span></div>';
      if(deben.length){
        h += '<ul class="oblig-lista">';
        deben.forEach(function(d){
          h += '<li><span class="oblig-nombre">' + nombre(d.u) + '</span><span class="oblig-tags">' +
            d.faltan.map(function(e){ return '<span class="tag tag-obligatoria">' + escapeHtml(e.title || 'Sin título') + '</span>'; }).join('') +
            '</span></li>';
        });
        h += '</ul>';
      }
      if(alDiaL.length) h += '<p class="oblig-linea"><span class="oblig-label cnt-ok">Al día:</span> ' + alDiaL.map(nombre).join(', ') + '</p>';
      if(sinLogL.length && AppState.tableroSinLogOpen === g) h += '<p class="oblig-linea"><span class="oblig-label cnt-nd">Sin loguearse:</span> ' + sinLogL.map(escapeHtml).join(', ') + '</p>';
      cuerpo += h + '</div>';
    });
    if(cuerpo) cuerpo = '<p class="tablero-meta oblig-ayuda">«Sin loguearse» = está en la resolución pero todavía no creó su cuenta. Tocalo para ver quiénes.</p>' + cuerpo;
    if(!cuerpo) cuerpo = '<p class="tablero-meta">Todavía no se registró nadie.</p>';
    if(sinObligs) cuerpo = '<p class="tablero-meta oblig-vacio">Todavía no hay entradas obligatorias publicadas.</p>' + cuerpo;
    return '<details class="tablero-resto tablero-oblig"' + (AppState.tableroObligOpen ? ' open' : '') + '>' +
      '<summary>Obligatorias sin completar (' + totalFaltan + (totalFaltan === 1 ? ' persona' : ' personas') + ')</summary>' +
      cuerpo + '</details>';
  }

  export function renderMandosPanel(){
    var showMiComando = canSeeMiComandoSubtab();
    if((AppState.mandosActiveSubTab === 'micomando' || AppState.mandosActiveSubTab === 'tablero') && !showMiComando){ AppState.mandosActiveSubTab = 'mandos'; }

    var html = '';
    html += '<div class="panel-head"><div><h2>Comando</h2>';
    html += '<p class="mandos-sub">Campamento Nacional "Reino del Padre".</p></div></div>';

    if(showMiComando){
      html += '<div class="users-subtabs">';
      var st = AppState.mandosActiveSubTab;
      html += '  <button type="button" class="day-pill' + (st !== 'micomando' && st !== 'tablero' ? ' active' : '') + '" data-mandos-subtab="mandos">Cuadro de mandos</button>';
      html += '  <button type="button" class="day-pill' + (st === 'micomando' ? ' active' : '') + '" data-mandos-subtab="micomando">Mi comando</button>';
      html += '  <button type="button" class="day-pill' + (st === 'tablero' ? ' active' : '') + '" data-mandos-subtab="tablero">Tablero</button>';
      html += '</div>';
    }

    if(showMiComando && AppState.mandosActiveSubTab === 'micomando') html += renderMiComandoHtml();
    else if(showMiComando && AppState.mandosActiveSubTab === 'tablero') html += renderObligatoriasHtml() + renderTableroHtml();
    else html += renderCuadroDeMandosHtml();

    return html;
  }


  export function attachMandosEvents(){
    var resto = document.querySelector('.tablero-resto:not(.tablero-oblig)');
    if(resto) resto.addEventListener('toggle', function(){ AppState.tableroRestoOpen = resto.open; });
    var oblig = document.querySelector('.tablero-oblig');
    if(oblig) oblig.addEventListener('toggle', function(){ AppState.tableroObligOpen = oblig.open; });
    document.querySelectorAll('[data-sinlog]').forEach(function(btn){
      btn.onclick = function(){
        var g = btn.getAttribute('data-sinlog');
        AppState.tableroSinLogOpen = AppState.tableroSinLogOpen === g ? '' : g;
        renderPanel();
      };
    });
    attachMandosAdmin();
    ubicarMapa();
    document.querySelectorAll('[data-mandos-subtab]').forEach(function(btn){
      btn.onclick = function(){
        AppState.mandosActiveSubTab = btn.getAttribute('data-mandos-subtab');
        renderPanel();
      };
    });
  }


  // Actualizar el cuadro de mandos (admin) — ver services/mandos-update.service.js.
  async function previsualizarYGuardar(obj, titulo){
    var mod = await import('../services/mandos-update.service.js');
    var v = mod.validarMandos(obj);
    if(v.errores.length){ await showAlert('No se puede usar este archivo:\n\n• ' + v.errores.join('\n• ')); return; }
    var r = mod.compararMandos(AppState.mandosData, v.data);
    var msg = titulo + '\n\n' + (v.avisos.length ? '⚠️ ' + v.avisos.join('\n⚠️ ') + '\n\n' : '') + mod.resumenTxt(r) +
      '\n\nSe guarda una copia del cuadro actual para poder volver atrás. ¿Guardar?';
    if(!(await showConfirm(msg))) return;
    try{
      var res = await mod.guardarMandos(v.data, r);
      await showAlert('Cuadro de mandos actualizado.' + (res.perfiles ? ' Perfiles acomodados: ' + res.perfiles + '.' : '') +
        (res.fallas ? ' No se pudieron acomodar ' + res.fallas + ' (ver consola).' : '') +
        ((r.aMano.length || r.yaNoFiguran.length) ? '\n\nQuedan personas para acomodar a mano en Usuarios.' : ''));
    }catch(e){
      console.error(e);
      showAlert('No se pudo guardar: ' + e.message);
    }
  }

  function attachMandosAdmin(){
    var bajar = document.getElementById('mandosDescargarBtn');
    if(!bajar) return;
    bajar.onclick = async function(){ (await import('../services/mandos-update.service.js')).descargarMandos(); };
    var file = document.getElementById('mandosSubirFile');
    document.getElementById('mandosSubirBtn').onclick = function(){ file.click(); };
    file.onchange = async function(){
      var f = file.files[0]; file.value = '';
      if(!f) return;
      var obj;
      try{ obj = JSON.parse(await f.text()); }
      catch(e){ showAlert('El archivo no es un .json válido.'); return; }
      previsualizarYGuardar(obj, 'Cambios del cuadro de mandos:');
    };
    document.getElementById('mandosIndiceBtn').onclick = async function(){
      var btn = this; btn.disabled = true;
      try{
        var r = await (await import('../services/mandos-index.service.js')).regenerarIndiceMandos();
        showAlert('Índice actualizado: ' + r.puestos + ' puestos, ' + r.conCuenta + ' ya con cuenta.');
      }catch(e){ showAlert('No se pudo actualizar el índice: ' + e.message); }
      btn.disabled = false;
    };
    document.getElementById('mandosAnteriorBtn').onclick = async function(){
      var mod = await import('../services/mandos-update.service.js');
      var ant;
      try{ ant = await mod.leerAnterior(); }catch(e){ showAlert('No se pudo leer la versión anterior: ' + e.message); return; }
      if(!ant || !ant.data){ showAlert('Todavía no hay una versión anterior guardada.'); return; }
      previsualizarYGuardar(ant.data, 'Volver a la versión del ' + new Date(ant.guardadoEn).toLocaleString('es-AR') + ':');
    };
  }
