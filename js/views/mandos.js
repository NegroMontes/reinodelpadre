// "Comando" (antes "Cuadro de mandos", renombrada 09/10/2026) — dos
// subpestañas: "Cuadro de mandos" (de solo lectura, con la nómina completa
// de la Resolución de nombramientos — los datos viven en Firestore,
// `mandos/data`, ver services/mandos.service.js) y "Mi comando" (roster en
// vivo de quien ya se registró, con foto/actividad favorita/ruca — ver
// canSeeMiComandoSubtab() en services/permissions.js).

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
        promedio: total ? Math.round(suma / total) : 0 };
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
  function metaHtml(f, tag){ return isAdmin() ? '<' + tag + ' class="tablero-meta">' + metaTxt(f) + '</' + tag + '>' : ''; }

  // T14 E3 (06/11/2026): mapa del hijo pródigo (Lc 15). Cada comando va
  // sobre el camino según su promedio: 0% = entre los chanchos, 100% = la
  // casa del Padre. El SVG fija el camino; los escudos y las estaciones son
  // HTML encima, ubicados al abrir con getPointAtLength() (ver
  // ubicarMapa()). Los que están cerca (≤4 puntos) se agrupan en un racimo.
  var MAPA_CAMINO = 'M150 345 C 225 352, 255 300, 212 250 S 140 125, 285 145 S 430 270, 470 190 S 470 110, 515 95';
  var MAPA_ESTACIONES = [
    { pct: 0, label: 'El valle de los cerdos', lado: 'abajo' },
    { pct: 25, label: 'La encrucijada', lado: 'der' },
    { pct: 50, label: 'El camino de retorno', lado: 'arriba' },
    { pct: 75, label: 'La Tranquera', lado: 'arriba' },
    { pct: 100, label: 'La casa del Padre', lado: 'izq' }
  ];

  // Ilustraciones del mapa (06/11/2026): trazo redondeado como los íconos
  // Lucide de la página, con relleno suave; colores por variables CSS.
  // Porqueriza: cerco de madera, barro y un chancho embarrado.
  var MAPA_SVG_CHANCHO = '<svg viewBox="0 0 120 72" aria-hidden="true">' +
    '<path class="mc-madera" d="M8 22h6v34H8zM30 20h6v36h-6zM84 20h6v36h-6zM106 22h6v34h-6z"/>' +
    '<path class="mc-tabla" d="M6 30h108M6 42h108"/>' +
    '<path class="mc-barro" d="M4 60c2-7 14-9 26-8s20-5 32-4 24-2 34 2 22 4 20 10-14 9-40 9-50 1-64-1-10-3-8-8z"/>' +
    '<ellipse class="mc-barro-osc" cx="24" cy="62" rx="9" ry="2.5"/>' +
    '<ellipse class="mc-barro-osc" cx="96" cy="63" rx="8" ry="2.2"/>' +
    '<path class="mc-cuerpo" d="M40 49c0-9 8-14 19-14s19 5 19 14-8 9-19 9-19-2-19-9z"/>' +
    '<path class="mc-cuerpo" d="M72 34l3-6 3 7"/>' +
    '<circle class="mc-cuerpo" cx="77" cy="43" r="9"/>' +
    '<ellipse class="mc-hocico" cx="86" cy="45" rx="4" ry="5"/>' +
    '<path class="mc-piel-linea" d="M85.2 43.5v1M87.4 43.5v1M40 45c-4 0-6-2-5-4s4-1 3 1"/>' +
    '<circle class="mc-ojo" cx="78" cy="40" r="1.5"/>' +
    '<path class="mc-salpicon" d="M46 53c3-2 6-1 8 1-2 2-6 2-8-1zM62 55c2-1 5-1 6 1-2 1-4 1-6-1z"/>' +
    '<circle class="mc-barro-osc" cx="58" cy="45" r="1.6"/><circle class="mc-barro-osc" cx="50" cy="48" r="1.2"/>' +
    '</svg>';
  var MAPA_SVG_CASA = '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    '<path class="mc-techo" d="M6 30L32 8l26 22"/>' +
    '<path class="mc-pared" d="M12 26v30h40V26"/>' +
    '<path class="mc-chimenea" d="M44 17V10h6v12"/>' +
    '<path class="mc-puerta" d="M27 56V42a5 5 0 0 1 10 0v14"/>' +
    '<rect class="mc-ventana" x="17" y="33" width="7" height="7" rx="1.5"/>' +
    '<rect class="mc-ventana" x="40" y="33" width="7" height="7" rx="1.5"/>' +
    '<path class="mc-suelo" d="M4 56h56"/></svg>';

  // Pueblos extranjeros: tierra árida, árboles secos y una choza caída.
  var MAPA_SVG_EXTRANJEROS = '<svg viewBox="0 0 120 72" aria-hidden="true">' +
    '<path class="mx-suelo" d="M2 62c14-5 30-6 48-4s40 1 68-3v15H2z"/>' +
    '<path class="mx-grieta" d="M20 66l6-3 4 3M64 64l5-3 3 2 4-2M96 63l4 2"/>' +
    '<path class="mx-arbol" d="M18 60V34M18 46l-8-7M18 40l7-8M18 52l6-4M25 32l3-4M10 39l-3-3"/>' +
    '<path class="mx-arbol" d="M102 59V40M102 50l6-6M102 46l-6-5M108 44l2-4"/>' +
    '<path class="mx-choza" d="M44 60V44l13-11 14 10v17"/>' +
    '<path class="mx-techo" d="M40 46l17-15 9 7M60 36l13 11"/>' +
    '<path class="mx-grieta" d="M53 60v-8h6v8M64 50l3 3"/>' +
    '</svg>';

  function renderMapaHtml(filas, mio){
    var html = '<section class="tablero-mapa"><h3>El camino de vuelta</h3>' +
      '<p class="tablero-meta">Del valle de los cerdos a la casa del Padre (Lucas 15, 11-32). Cada comando avanza según su promedio; los que todavía no arrancaron andan por pueblos extranjeros.</p>' +
      '<div class="mapa-lienzo">' +
      '<svg viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true"><defs>' +
      '<linearGradient id="mapaG1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="mapa-g1a"/><stop offset="1" class="mapa-g1b"/></linearGradient>' +
      '<linearGradient id="mapaG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="mapa-g2a"/><stop offset="1" class="mapa-g2b"/></linearGradient>' +
      '<radialGradient id="mapaLuz"><stop offset="0" class="mapa-luz-a"/><stop offset="1" class="mapa-luz-b"/></radialGradient>' +
      '<radialGradient id="mapaNiebla"><stop offset="0" class="mapa-niebla-a"/><stop offset=".6" class="mapa-niebla-m"/><stop offset="1" class="mapa-niebla-b"/></radialGradient></defs>' +
      '<ellipse cx="85" cy="150" rx="150" ry="100" fill="url(#mapaNiebla)"/>' +
      '<circle cx="545" cy="100" r="100" fill="url(#mapaLuz)"/>' +
      '<path fill="url(#mapaG1)" d="M0 235 C 50 205, 85 150, 140 168 S 225 105, 290 145 S 375 85, 440 118 S 535 55, 600 92 L600 400 L0 400 Z"/>' +
      '<path fill="url(#mapaG2)" d="M0 318 C 75 280, 145 302, 215 272 S 355 228, 430 258 S 535 215, 600 238 L600 400 L0 400 Z"/>' +
      '<path class="mapa-desvio-borde mapa-desvio"/>' +
      '<path class="mapa-desvio-centro mapa-desvio"/>' +
      '<path class="mapa-sendero-borde" d="' + MAPA_CAMINO + '"/>' +
      '<path class="mapa-sendero mapa-camino" d="' + MAPA_CAMINO + '"/>' +
      '</svg>' +
      '<span class="mapa-deco mapa-chancho" title="El valle de los cerdos">' + MAPA_SVG_CHANCHO + '</span>' +
      '<span class="mapa-deco mapa-casa" title="La casa del Padre">' + MAPA_SVG_CASA + '</span>' +
      '<span class="mapa-deco mapa-extranjeros" title="Pueblos extranjeros">' + MAPA_SVG_EXTRANJEROS + '</span>' +
      '<span class="mapa-zona-label">Pueblos extranjeros</span>';
    MAPA_ESTACIONES.forEach(function(e, i){
      html += '<div class="mapa-estacion mapa-lado-' + e.lado + '" data-pct="' + e.pct + '">' +
        '<span class="mapa-punto"></span>' +
        '<span class="mapa-label"><b>' + (i + 1) + '</b><span class="mapa-label-txt">' + escapeHtml(e.label) + '</span></span></div>';
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
    html += '<div class="mapa-pop" role="dialog" hidden></div></div>';
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
    document.querySelectorAll('.mapa-grupo.abierto').forEach(function(g){ g.classList.remove('abierto'); });
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
    var pop = lienzo.querySelector('.mapa-pop');
    lienzo.querySelectorAll('.mapa-grupo').forEach(function(g){
      g.querySelector('.mapa-pila').onclick = function(ev){
        ev.stopPropagation();
        if(g.classList.contains('abierto')){ cerrarMapaPop(); return; }
        cerrarMapaPop();
        g.classList.add('abierto');
        pop.innerHTML = g.querySelector('.mapa-pop-content').innerHTML;
        pop.hidden = false;
        // Arriba o abajo del escudo según dónde está; sin salirse del mapa.
        var W = lienzo.clientWidth, H = lienzo.clientHeight;
        var x = g.offsetLeft, y = g.offsetTop, w = pop.offsetWidth, h = pop.offsetHeight;
        var alto = g.querySelector('.mapa-pila').offsetHeight / 2 + 8;
        pop.style.left = Math.max(4, Math.min(W - w - 4, x - w / 2)) + 'px';
        var arriba = y - alto - h >= 0 || (y + alto + h > H && y > H - y);
        var top = arriba ? y - alto - h : y + alto;
        pop.style.top = Math.max(-h + 40, Math.min(H - 40, top)) + 'px';
      };
    });
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
    document.getElementById('mandosAnteriorBtn').onclick = async function(){
      var mod = await import('../services/mandos-update.service.js');
      var ant;
      try{ ant = await mod.leerAnterior(); }catch(e){ showAlert('No se pudo leer la versión anterior: ' + e.message); return; }
      if(!ant || !ant.data){ showAlert('Todavía no hay una versión anterior guardada.'); return; }
      previsualizarYGuardar(ant.data, 'Volver a la versión del ' + new Date(ant.guardadoEn).toLocaleString('es-AR') + ':');
    };
  }
