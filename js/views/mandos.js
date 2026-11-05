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
import { canSeeMiComandoSubtab, effectiveRole, effectiveSeccion, effectiveDepto, lectorModeActive } from '../services/permissions.js';
import { buildMandosIndex, findMandoByName } from '../utils/mandos-matcher.js';
import { isMilicianoUser } from './users.js';
import { renderPanel } from '../main.js';

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

  function metaTxt(f){ return f.conDatos + ' de ' + f.total + ' con avance'; }

  function renderTableroHtml(){
    var filas = tableroComandos();
    var mandosIndex = buildMandosIndex(AppState.mandosData);
    var mio = miGrupoTablero(mandosIndex);
    var mia = filas.filter(function(f){ return f.grupo === mio; })[0];
    var html = '';

    if(mia){
      html += '<div class="tablero-mio">' + comandoIconHtml(mia) +
        '<div class="tablero-mio-info"><span class="tablero-mio-label">Tu comando</span>' +
        '<strong>' + escapeHtml(mia.grupo) + '</strong><span class="tablero-meta">' + metaTxt(mia) + '</span></div>' +
        '<div class="tablero-mio-nums"><span class="tablero-mio-pos">' + mia.pos + '°</span>' +
        '<span class="tablero-mio-pct">' + mia.promedio + '%</span></div></div>';
    }

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
        '<span class="tablero-meta">' + metaTxt(f) + '</span>' +
        '<div class="podio-base"><span>' + f.pos + '°</span></div></div>';
    });
    html += '</div>';

    var resto = filas.slice(3);
    if(resto.length){
      html += '<details class="tablero-resto"' + (AppState.tableroRestoOpen ? ' open' : '') + '>' +
        '<summary>Resto del ranking (' + resto.length + ')</summary><table class="tablero-tabla"><tbody>';
      resto.forEach(function(f){
        html += '<tr' + (f.grupo === mio ? ' class="es-mio"' : '') + '><td class="tt-pos">' + f.pos + '°</td>' +
          '<td><div class="tt-nombre">' + comandoIconHtml(f) + '<span>' + escapeHtml(f.grupo) + '<small class="tablero-meta">' + metaTxt(f) + '</small></span></div></td>' +
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

  function renderObligatoriasHtml(){
    var rol = effectiveRole();
    if(rol !== 'admin' && rol !== 'jefe_seccion') return '';
    var vigentes = obligatoriasVigentes();
    if(!Object.keys(vigentes).length) return '';
    var comando = (AppState.usersList || []).filter(function(u){ return !isMilicianoUser(u) && u.role !== 'pendiente'; });
    var mandosIndex = buildMandosIndex(AppState.mandosData);
    var grupos = rol === 'admin' ? SECCIONES.concat(DEPARTAMENTOS, [COMANDO_CENTRAL]) : [miGrupoTablero(mandosIndex)];
    var totalFaltan = 0, cuerpo = '';
    grupos.forEach(function(g){
      var filas = '', sinDato = 0;
      miembrosDeGrupo(comando, g, mandosIndex).forEach(function(u){
        var ids = obligPendientesDe(u);
        if(ids === null){ sinDato++; return; }
        var titulos = ids.filter(function(id){ return vigentes[id]; }).map(function(id){ return vigentes[id].title || 'Sin título'; });
        if(!titulos.length) return;
        totalFaltan++;
        filas += '<li><strong>' + escapeHtml(u.displayName || u.email || 'Sin nombre') + '</strong>' +
          '<span class="tablero-meta">' + titulos.map(escapeHtml).join(' · ') + '</span></li>';
      });
      if(!filas && !sinDato) return;
      cuerpo += '<div class="oblig-grupo">' + (rol === 'admin' ? '<h4>' + escapeHtml(g) + '</h4>' : '') +
        (filas ? '<ul class="oblig-lista">' + filas + '</ul>' : '<p class="tablero-meta">Todos al día.</p>') +
        (sinDato ? '<p class="tablero-meta">' + sinDato + (sinDato === 1 ? ' persona todavía no abrió' : ' personas todavía no abrieron') + ' la página desde que se cuenta esto.</p>' : '') +
        '</div>';
    });
    if(!cuerpo) cuerpo = '<p class="tablero-meta">Todavía no se registró nadie.</p>';
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
    else if(showMiComando && AppState.mandosActiveSubTab === 'tablero') html += renderTableroHtml() + renderObligatoriasHtml();
    else html += renderCuadroDeMandosHtml();

    return html;
  }


  export function attachMandosEvents(){
    var resto = document.querySelector('.tablero-resto:not(.tablero-oblig)');
    if(resto) resto.addEventListener('toggle', function(){ AppState.tableroRestoOpen = resto.open; });
    var oblig = document.querySelector('.tablero-oblig');
    if(oblig) oblig.addEventListener('toggle', function(){ AppState.tableroObligOpen = oblig.open; });
    document.querySelectorAll('[data-mandos-subtab]').forEach(function(btn){
      btn.onclick = function(){
        AppState.mandosActiveSubTab = btn.getAttribute('data-mandos-subtab');
        renderPanel();
      };
    });
  }
