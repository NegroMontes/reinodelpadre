// Barra superior (usuario, "Ver como", Modo Lector, campana de
// Novedades) y sus datos: qué contenido nuevo hay, y dónde vive.

import { AppState } from '../app-state.js';
import { SECCIONES, DEPARTAMENTOS, DEPARTAMENTO_ICONS, CONSAGRADO_ICONS, VIEW_AS_ROLES, NOVEDADES_WINDOW_DAYS, APP_VERSION, CHANGELOG, FORDOQUERA_URL } from '../config/constants.js';
import { escapeHtml, roleLabel, roleLabelScoped, activityIcon } from '../utils/helpers.js';
import { userBadgeInnerHtml, cupulaIconOptionsHtml } from '../utils/badge-icons.js';
import { saveNovedadesSeenAt } from '../utils/storage.js';
import { lectorModeActive, realIsAdmin, isComandoNonAdmin, canSeeEntry } from '../services/permissions.js';
import { signOutUser, updateMyProfile } from '../services/auth.service.js';
import { render } from '../main.js';
import { icon } from '../utils/icons.js';
import { isInstalledApp, promptInstall } from '../utils/install-prompt.js';
import { showAlert, showConfirm } from './dialog.js';

  export function viewAsScopeOptionsHtml(role, current){
    var html = '';
    if(role === 'subjefe' || role === 'consagrado'){
      html += '<option value=""' + (current===''?' selected':'') + '>General (sin sección)</option>';
    }
    if(role === 'lector'){
      // Un miliciano siempre es de una sección puntual — nunca General, nunca
      // de un departamento (pedido del usuario, 22/09/2026).
      html += '<optgroup label="Secciones">';
      SECCIONES.forEach(function(s){
        var v = 'seccion:' + s;
        html += '<option value="' + escapeHtml(v) + '"' + (current===v?' selected':'') + '>' + escapeHtml(s) + '</option>';
      });
      html += '</optgroup>';
      return html;
    }
    html += '<optgroup label="Secciones">';
    SECCIONES.forEach(function(s){
      var v = 'seccion:' + s;
      html += '<option value="' + escapeHtml(v) + '"' + (current===v?' selected':'') + '>' + escapeHtml(s) + '</option>';
    });
    html += '</optgroup><optgroup label="Departamentos">';
    DEPARTAMENTOS.forEach(function(d){
      var v = 'depto:' + d;
      html += '<option value="' + escapeHtml(v) + '"' + (current===v?' selected':'') + '>' + escapeHtml(d) + '</option>';
    });
    html += '</optgroup>';
    return html;
  }


  export function renderAuthBar(){
    var el = document.getElementById('authBar');
    // La campana de Novedades vive en #headerBellSlot (al lado del logo/
    // badge, ver index.html) — separada de #authBar (pill de rol + avatar,
    // del otro lado) desde el segundo rediseño de la topbar, 15/10/2026.
    // El toggle de tema (#themeToggleBtn) ya no se mueve de su placeholder
    // (#themeToggleHome, en .header-top-right) — antes vivía al lado de la
    // campana, pero la campana se mudó al lado opuesto del header.
    var bellSlot = document.getElementById('headerBellSlot');
    if(!AppState.authResolved || !AppState.currentUser){ el.innerHTML = ''; if(bellSlot){ bellSlot.innerHTML = ''; } return; }
    var simPill = '';
    if(AppState.viewAsOverride){
      var scopeTxt = AppState.viewAsOverride.seccion ? (' · ' + AppState.viewAsOverride.seccion) : (AppState.viewAsOverride.depto ? (' · ' + AppState.viewAsOverride.depto) : '');
      // "Milicianos" en plural para el pill de simulación (mismo criterio
      // que el propio VIEW_AS_ROLES) — en cualquier otro caso, la etiqueta
      // genérica de roleLabel() ya alcanza.
      var simRoleLabel = AppState.viewAsOverride.role === 'lector' ? 'Milicianos' : roleLabel(AppState.viewAsOverride.role);
      simPill = ' <span class="role-pill" style="color:var(--gold);border-color:var(--gold)" title="Vista simulada, no cambia tus permisos reales">viendo como ' + escapeHtml(simRoleLabel) + escapeHtml(scopeTxt) + '</span>';
    }
    // Pill de "Modo Lector" (25/09/2026, sugerencia de Juli): a diferencia
    // del pill de "Ver como" de arriba (que simula OTRO rol siendo admin),
    // este es un cambio real de la propia cuenta — se muestra siempre que el
    // toggle esté activo, para que no se olviden de que no pueden editar
    // nada mientras dure.
    var lectorPill = lectorModeActive() ? ' <span class="role-pill" style="color:var(--gold);border-color:var(--gold)" title="Estás leyendo todo el comando — no podés editar nada mientras este modo esté activo">Modo Lector</span>' : '';
    var novedades = getNovedades();
    var novedadesSinVer = novedades.filter(function(e){ return e.createdAt > AppState.novedadesSeenAt; });
    if(bellSlot){
      bellSlot.innerHTML = '<button id="novedadesBtn" class="novedades-bell" type="button" title="Novedades de los últimos ' + NOVEDADES_WINDOW_DAYS + ' días">' + icon('bell') + (novedadesSinVer.length > 0 ? '<span class="tag imagen novedades-count">' + novedadesSinVer.length + '</span>' : '') + '</button>';
    }
    var html = '<div class="auth-user">';
    html += '<span class="role-pill">' + escapeHtml(roleLabelScoped(AppState.currentUser)) + '</span>' + simPill + lectorPill;
    // El selector de "Ver como" (admin) y el toggle "Mi mando"/"Lector"
    // (comando no-admin, sugerencia de Juli Ahumada 25/09/2026) vivían acá
    // sueltos en la topbar — ambos se movieron adentro del menú del botón
    // de usuario (ver renderUserMenuPanelHtml()), pedido del usuario
    // (15/10/2026): "los desplegables siempre dentro del botón de usuario".
    html += renderUserAvatarHtml();
    html += '</div>';
    if(AppState.novedadesOpen){
      html += '<div class="novedades-panel" id="novedadesPanel">';
      html += '  <h3>Novedades</h3>';
      html += '  <p class="mandos-sub novedades-intro">Contenido agregado en los últimos ' + NOVEDADES_WINDOW_DAYS + ' días.</p>';
      if(novedades.length === 0){
        html += '  <p class="empty">No hay nada nuevo por ahora.</p>';
      } else {
        html += '  <ul class="novedades-list">';
        novedades.forEach(function(e){
          var fecha = new Date(e.createdAt).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
          html += '<li data-novedad-id="' + e.id + '"><strong>' + escapeHtml(e.title) + '</strong><span class="mandos-sub" style="display:block;margin:2px 0 0">' + escapeHtml(entryLocationLabel(e)) + ' · ' + escapeHtml(fecha) + '</span></li>';
        });
        html += '  </ul>';
        html += '  <div class="novedades-fade-bottom" id="novedadesFadeBottom"></div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    attachUserAvatarEvents();

    var novedadesBtn = document.getElementById('novedadesBtn');
    if(novedadesBtn){
      novedadesBtn.onclick = function(e){
        e.stopPropagation(); // no lo agarre el listener de "click afuera cierra"
        AppState.novedadesOpen = !AppState.novedadesOpen;
        if(AppState.novedadesOpen){
          AppState.novedadesSeenAt = Date.now(); // marca como vistas -> el globo rojo desaparece
          // Persistido (pedido del usuario, 22/09/2026) — así sigue "visto" al
          // recargar la página o volver a entrar, no solo durante esta sesión.
          if(AppState.currentUser){ saveNovedadesSeenAt(AppState.currentUser.uid, AppState.novedadesSeenAt); }
        }
        renderAuthBar();
      };
    }
    // Sombra de "hay más" (ver CSS de `.novedades-fade-bottom`) — se muestra
    // mientras la lista tenga contenido sin scrollear debajo, y se apaga al
    // llegar al final. Reemplaza a la scrollbar nativa como indicador en
    // mobile, donde el navegador la oculta por default.
    var novedadesListEl = document.querySelector('.novedades-list');
    var novedadesFadeEl = document.getElementById('novedadesFadeBottom');
    if(novedadesListEl && novedadesFadeEl){
      var updateNovedadesFade = function(){
        var hasMore = novedadesListEl.scrollHeight - novedadesListEl.scrollTop - novedadesListEl.clientHeight > 4;
        novedadesFadeEl.classList.toggle('show', hasMore);
      };
      updateNovedadesFade();
      novedadesListEl.addEventListener('scroll', updateNovedadesFade);
    }

    document.querySelectorAll('[data-novedad-id]').forEach(function(li){
      li.onclick = function(){
        var id = li.getAttribute('data-novedad-id');
        var entry = (AppState.state.entries || []).find(function(e){ return e.id === id; });
        if(!entry) return;
        AppState.novedadesOpen = false;
        if(entry.dayId === 'RESOURCES'){ AppState.activeDayId = 'RECURSOS'; }
        // Info general vive adentro de Inicio (22/09/2026) — ya no es una
        // pestaña propia a la que saltar.
        else if(entry.dayId === 'INFO_GENERAL'){ AppState.activeDayId = 'HOME'; }
        else if(!entry.dayId){ AppState.activeDayId = 'DEPARTAMENTOS'; }
        else { AppState.activeDayId = 'MENSAJE'; AppState.activeMensajeDayId = entry.dayId; }
        AppState.formOpen = false;
        render();
      };
    });
    // El wiring de "Ver como" (viewAsRoleSelect/viewAsScopeSelect) vive
    // ahora en attachUserAvatarEvents() — esos <select> se movieron adentro
    // del menú del avatar (ver renderUserMenuPanelHtml()).
  }


  // Botón de usuario con avatar (09/10/2026, pedido del usuario) — reemplaza
  // el nombre suelto + "Cerrar sesión" de siempre por un botón redondo con
  // la foto de Google, dos íconos chicos superpuestos en espejo (actividad
  // favorita a la izquierda, escudo de sección/ícono de depto a la derecha)
  // y un menú desplegable con "Perfil" (autoservicio: actividad favorita,
  // Ruca/Fundación, y el ícono de depto a usar — los únicos 3 campos que las
  // reglas de Firestore dejan tocar a cualquiera sobre su propia cuenta) y
  // "Cerrar sesión".
  //
  // El escudo de SECCIÓN (Escuderos/Templarios) es automático, sin elegir —
  // cada sección tiene un solo escudo. El de DEPARTAMENTO sí se elige (ver
  // "Perfil" más abajo): el glifo genérico de FASTA, o un ícono propio por
  // depto (ver DEPARTAMENTO_ICONS en config/constants.js) — pedido explícito
  // del usuario ("pensa iconos para cada departamento para que elijan entre
  // el de fasta y el de los departamentos").
  function rightBadgeHtml(){
    var inner = userBadgeInnerHtml(AppState.currentUser);
    if(!inner) return '';
    var title = AppState.currentUser.seccion
      ? 'Sección: ' + AppState.currentUser.seccion
      : (AppState.currentUser.depto ? 'Departamento: ' + AppState.currentUser.depto : '');
    return '<span class="user-avatar-badge user-avatar-badge-seccion" title="' + escapeHtml(title) + '">' + inner + '</span>';
  }

  function renderUserAvatarHtml(){
    var myActivityIcon = activityIcon(AppState.currentUser.actividadFavorita);
    var html = '<div class="user-avatar-wrap">';
    html += '<button id="userAvatarBtn" class="user-avatar-btn" type="button" title="' + escapeHtml(AppState.currentUser.displayName) + '">';
    html += AppState.currentUser.photoURL
      ? '<img class="user-avatar-img" src="' + escapeHtml(AppState.currentUser.photoURL) + '" alt="">'
      : '<span class="user-avatar-fallback">' + icon('user') + '</span>';
    if(myActivityIcon){
      html += '<span class="user-avatar-badge user-avatar-badge-activity" title="Actividad: ' + escapeHtml(AppState.currentUser.actividadFavorita) + '">' + myActivityIcon + '</span>';
    }
    html += rightBadgeHtml();
    html += '</button>';
    if(AppState.userMenuOpen){ html += renderUserMenuPanelHtml(); }
    html += '</div>';
    return html;
  }

  function renderUserMenuPanelHtml(){
    var html = '<div class="user-menu-panel" id="userMenuPanel">';
    html += '  <div class="user-menu-header"><strong>' + escapeHtml(AppState.currentUser.displayName) + '</strong><span class="mandos-sub">' + escapeHtml(roleLabelScoped(AppState.currentUser)) + '</span></div>';
    if(AppState.userMenuEditingProfile){
      var draft = AppState.userProfileDraft || { actividadFavorita: AppState.currentUser.actividadFavorita || '', rucaFundacion: AppState.currentUser.rucaFundacion || '', deptoIconChoice: AppState.currentUser.deptoIconChoice || 'fasta', cupulaIcon: AppState.currentUser.cupulaIcon || '', consagradoIconChoice: AppState.currentUser.consagradoIconChoice || '' };
      html += '  <div class="user-menu-profile-form">';
      html += '    <label>Actividad favorita<input id="userProfileActividadInput" type="text" value="' + escapeHtml(draft.actividadFavorita) + '" placeholder="Ej: Jugar al fútbol"></label>';
      html += '    <label>Ruca / Fundación de origen<input id="userProfileRucaInput" type="text" value="' + escapeHtml(draft.rucaFundacion) + '" placeholder="Ej: Ruca Chapelco"></label>';
      // Solo tiene sentido para quien tiene un depto propio — una sección no
      // elige nada, siempre usa su propio escudo (ver rightBadgeHtml()).
      if(AppState.currentUser.depto){
        var deptoIcon = DEPARTAMENTO_ICONS[AppState.currentUser.depto] || '';
        html += '    <label>Ícono de tu depto en el avatar'
          + '<select id="userProfileDeptoIconSelect">'
          + '  <option value="fasta"' + (draft.deptoIconChoice !== 'depto' ? ' selected' : '') + '>Escudo de FASTA (genérico)</option>'
          + '  <option value="depto"' + (draft.deptoIconChoice === 'depto' ? ' selected' : '') + '>' + deptoIcon + ' Ícono de ' + escapeHtml(AppState.currentUser.depto) + '</option>'
          + '</select></label>';
      }
      // Sin sección ni depto (admin/comando central, 09/10/2026: "yo no
      // tengo ninguno") — a diferencia de sección (automático) o depto (2
      // opciones fijas), acá hay que elegir uno de una lista chica.
      if(!AppState.currentUser.seccion && !AppState.currentUser.depto){
        html += '    <label>Tu ícono en el avatar<select id="userProfileCupulaIconSelect">';
        if(!draft.cupulaIcon){ html += '  <option value="" selected disabled>Elegí uno…</option>'; }
        html += cupulaIconOptionsHtml(draft.cupulaIcon);
        html += '</select></label>';
      }
      // Un consagrado por default muestra el escudo de su sección (como
      // cualquiera de esa sección) — acá puede optar por un ícono propio
      // (cruz/pan) que lo distinga como consagrado en su lugar.
      if(AppState.currentUser.role === 'consagrado'){
        html += '    <label>Tu ícono en el avatar<select id="userProfileConsagradoIconSelect">';
        html += '  <option value=""' + (!draft.consagradoIconChoice ? ' selected' : '') + '>Escudo de tu sección (default)</option>';
        CONSAGRADO_ICONS.forEach(function(o){
          html += '  <option value="' + o.value + '"' + (draft.consagradoIconChoice === o.value ? ' selected' : '') + '>' + o.emoji + ' ' + escapeHtml(o.label) + '</option>';
        });
        html += '</select></label>';
      }
      html += '    <div class="user-menu-profile-actions">';
      html += '      <button id="userProfileCancelBtn" class="btn neutral small" type="button">Cancelar</button>';
      html += '      <button id="userProfileSaveBtn" class="btn small" type="button">Guardar</button>';
      html += '    </div>';
      html += '  </div>';
    } else {
      // "Ver como" (solo admin) — vivía como dos <select> sueltos en la
      // topbar; se movió acá adentro, pedido del usuario (15/10/2026): "los
      // desplegables siempre dentro del botón de usuario". El rol se elige
      // primero; si ese rol necesita un ámbito (sección/depto/General), el
      // segundo select aparece debajo, dentro del mismo menú — el menú se
      // queda abierto entre un cambio y el otro (AppState.userMenuOpen no
      // se toca al cambiar ninguno de los dos).
      if(realIsAdmin()){
        var curRole = AppState.viewAsOverride ? AppState.viewAsOverride.role : '';
        html += '  <div class="user-menu-viewas">';
        html += '    <label class="user-menu-viewas-label">Ver como</label>';
        html += '    <select id="viewAsRoleSelect">';
        // "Milicianos" se puede ocultar del selector (pedido del usuario,
        // 26/09/2026) desde Usuarios → Milicianos — ver AppState.publicConfig.
        VIEW_AS_ROLES.filter(function(o){ return o.value !== 'lector' || AppState.publicConfig.milicianosLoginEnabled !== false; }).forEach(function(o){
          html += '<option value="' + o.value + '"' + (o.value === curRole ? ' selected' : '') + '>' + escapeHtml(o.label) + '</option>';
        });
        html += '    </select>';
        if(curRole === 'jefe_seccion' || curRole === 'subjefe' || curRole === 'consagrado' || curRole === 'lector'){
          var curScope = AppState.viewAsOverride ? (AppState.viewAsOverride.seccion ? ('seccion:' + AppState.viewAsOverride.seccion) : (AppState.viewAsOverride.depto ? ('depto:' + AppState.viewAsOverride.depto) : '')) : '';
          html += '    <select id="viewAsScopeSelect">' + viewAsScopeOptionsHtml(curRole, curScope) + '</select>';
        }
        html += '  </div>';
      }
      // Toggle "Mi mando"/"Lector" (ver el comentario de renderAuthBar() —
      // se movió acá adentro, pedido del usuario, 11/10/2026). El botón
      // siempre muestra el modo al que CAMBIARÍA si se lo aprieta (no el
      // modo actual), y debajo una explicación de qué significa el modo en
      // el que está ahora.
      if(isComandoNonAdmin()){
        var lectorTargetLabel = AppState.myLectorMode ? 'Mi mando' : 'Lector';
        var lectorCurrentExplain = AppState.myLectorMode
          ? 'Estás en Lector: leés todo el comando (todas las secciones y departamentos), sin poder editar nada mientras esté activo.'
          : 'Estás en Mi mando: tus permisos de siempre, sobre tu sección o departamento.';
        html += '  <div class="user-menu-lector-toggle">';
        html += '    <button class="user-menu-item" id="userMenuLectorToggleBtn" type="button">Cambiar a ' + escapeHtml(lectorTargetLabel) + '</button>';
        html += '    <p class="mandos-sub user-menu-lector-explain">' + escapeHtml(lectorCurrentExplain) + '</p>';
        html += '  </div>';
      }
      html += '  <button class="user-menu-item" id="userMenuProfileBtn" type="button">' + icon('user') + ' Perfil</button>';
      // Accesos extra (23/10/2026, pedido del usuario): abrir la Fordoquera
      // aparte, e instalar RDP en la pantalla de inicio (oculto si ya se
      // está usando instalada).
      html += '  <a class="user-menu-item" href="' + FORDOQUERA_URL + '" target="_blank" rel="noopener">' + icon('external-link') + ' Ir a la Fordoquera</a>';
      if(!isInstalledApp()){
        html += '  <button class="user-menu-item" id="userMenuInstallBtn" type="button">' + icon('smartphone') + ' Agregar a inicio</button>';
      }
      // Importar un libro de la Fordoquera (ej. el Catecismo, ver
      // services/libros-import.service.js) — solo admin. Movido acá desde
      // Usuarios (29/10/2026, pedido del usuario).
      if(realIsAdmin()){
        html += '  <button class="user-menu-item" id="userMenuImportLibroBtn" type="button">' + icon('book-open') + ' Importar libro (.json)</button>';
        html += '  <input type="file" id="userMenuImportLibroFile" accept=".json,application/json" hidden>';
      }
      html += '  <button class="user-menu-item user-menu-item-danger" id="userMenuSignOutBtn" type="button">' + icon('log-out') + ' Cerrar sesión</button>';
      // Versión + historial de cambios, discreto, solo admin (19/10/2026,
      // pedido del usuario) — nunca para el resto del comando.
      if(realIsAdmin()){
        html += '  <div class="user-menu-version">';
        html += '    <button class="user-menu-version-btn" id="userMenuVersionBtn" type="button" title="Ver el historial de cambios">v' + escapeHtml(APP_VERSION) + '</button>';
        if(AppState.changelogOpen){
          html += '    <div class="user-menu-changelog">';
          CHANGELOG.forEach(function(entry){
            html += '      <div class="user-menu-changelog-entry">';
            html += '        <strong>v' + escapeHtml(entry.version) + '</strong><span class="mandos-sub"> · ' + escapeHtml(entry.date) + '</span>';
            html += '        <ul>';
            entry.items.forEach(function(it){ html += '<li>' + escapeHtml(it) + '</li>'; });
            html += '        </ul>';
            html += '      </div>';
          });
          html += '    </div>';
        }
        html += '  </div>';
      }
    }
    html += '</div>';
    return html;
  }

  function attachUserAvatarEvents(){
    var avatarBtn = document.getElementById('userAvatarBtn');
    if(avatarBtn){
      avatarBtn.onclick = function(e){
        e.stopPropagation(); // no lo agarre el listener de "click afuera cierra" de Novedades
        AppState.userMenuOpen = !AppState.userMenuOpen;
        if(!AppState.userMenuOpen){ AppState.userMenuEditingProfile = false; AppState.userProfileDraft = null; AppState.changelogOpen = false; }
        renderAuthBar();
      };
    }
    var profileBtn = document.getElementById('userMenuProfileBtn');
    if(profileBtn){
      profileBtn.onclick = function(){
        AppState.userMenuEditingProfile = true;
        AppState.userProfileDraft = { actividadFavorita: AppState.currentUser.actividadFavorita || '', rucaFundacion: AppState.currentUser.rucaFundacion || '', deptoIconChoice: AppState.currentUser.deptoIconChoice || 'fasta', cupulaIcon: AppState.currentUser.cupulaIcon || '', consagradoIconChoice: AppState.currentUser.consagradoIconChoice || '' };
        renderAuthBar();
      };
    }
    var installBtn = document.getElementById('userMenuInstallBtn');
    if(installBtn){
      installBtn.onclick = async function(){
        var r = await promptInstall();
        if(r === 'accepted'){ AppState.userMenuOpen = false; renderAuthBar(); return; }
        if(r === 'unavailable'){
          await showAlert('Para agregar la página a la pantalla de inicio:\n\n• Android (Chrome): menú ⋮ → "Agregar a pantalla de inicio" o "Instalar app".\n• iPhone (Safari): botón Compartir → "Agregar a inicio".\n• Computadora (Chrome/Edge): ícono de instalar en la barra de direcciones.');
        }
      };
    }
    var importLibroBtn = document.getElementById('userMenuImportLibroBtn');
    var importLibroFile = document.getElementById('userMenuImportLibroFile');
    if(importLibroBtn && importLibroFile){
      importLibroBtn.onclick = function(){ importLibroFile.click(); };
      importLibroFile.onchange = async function(){
        var file = importLibroFile.files[0];
        importLibroFile.value = '';
        if(!file) return;
        importLibroBtn.disabled = true;
        try{
          var libro = JSON.parse(await file.text());
          if(await showConfirm('¿Importar «' + (libro.titulo || libro.id || file.name) + '» a Firestore? Va a quedar disponible en la Fordoquera para todo el comando.')){
            importLibroBtn.textContent = 'Importando…';
            var mod = await import('../services/libros-import.service.js');
            var resumen = await mod.importLibroFordoquera(libro, function(msg){ importLibroBtn.textContent = msg; });
            await (await import('../services/libros.service.js')).clearLibrosCache();
            await showAlert(resumen);
          }
        }catch(e){
          console.error(e);
          await showAlert('❌ ' + (e.message || 'No se pudo importar.'));
        }
        renderAuthBar();
      };
    }
    var menuSignOutBtn = document.getElementById('userMenuSignOutBtn');
    if(menuSignOutBtn){ menuSignOutBtn.onclick = signOutUser; }

    var versionBtn = document.getElementById('userMenuVersionBtn');
    if(versionBtn){
      versionBtn.onclick = function(){
        AppState.changelogOpen = !AppState.changelogOpen;
        renderAuthBar();
      };
    }

    var lectorToggleBtn = document.getElementById('userMenuLectorToggleBtn');
    if(lectorToggleBtn){
      lectorToggleBtn.onclick = function(){
        AppState.myLectorMode = !AppState.myLectorMode;
        AppState.formOpen = false; // por si tenía el form de "Agregar contenido" abierto al cambiar
        render();
      };
    }

    // "Ver como" (movido adentro del menú del avatar, ver
    // renderUserMenuPanelHtml()) — mismo comportamiento de siempre, solo
    // que ahora los <select> viven en otro lugar del DOM.
    var roleSel = document.getElementById('viewAsRoleSelect');
    if(roleSel){
      roleSel.onchange = function(){
        var role = roleSel.value;
        if(!role){ AppState.viewAsOverride = null; }
        else if(role === 'pendiente'){ AppState.viewAsOverride = { role: 'pendiente', seccion: null, depto: null }; }
        // 'lector' ya significa "miliciano" sin ambigüedad (rediseño de
        // roles, 23/09/2026) — arranca en la primera sección, nunca General.
        else if(role === 'lector'){ AppState.viewAsOverride = { role: 'lector', seccion: SECCIONES[0], depto: null }; }
        else { AppState.viewAsOverride = { role: role, seccion: SECCIONES[0], depto: null }; } // jefe_seccion/subjefe/consagrado, arranca con la primera sección
        // Ya no fuerza la vuelta a "Inicio" (pedido del usuario, 22/09/2026) —
        // se queda en la pestaña que se estaba mirando. Si esa pestaña no
        // tiene sentido para el rol simulado nuevo (ej. "Usuarios"/"Comentarios"
        // para un no-admin, o "Departamentos" para un lector sin depto), los
        // guards que ya existen adentro de esos `render*Panel()` la mandan
        // solos a "Inicio" — no hace falta duplicar esa lógica acá.
        render();
      };
    }
    var scopeSel = document.getElementById('viewAsScopeSelect');
    if(scopeSel){
      scopeSel.onchange = function(){
        var val = scopeSel.value;
        if(val.indexOf('seccion:') === 0){ AppState.viewAsOverride.seccion = val.slice(8); AppState.viewAsOverride.depto = null; }
        else if(val.indexOf('depto:') === 0){ AppState.viewAsOverride.depto = val.slice(6); AppState.viewAsOverride.seccion = null; }
        else { AppState.viewAsOverride.seccion = null; AppState.viewAsOverride.depto = null; } // General (solo lector)
        render();
      };
    }

    var actInput = document.getElementById('userProfileActividadInput');
    if(actInput){ actInput.oninput = function(){ AppState.userProfileDraft.actividadFavorita = actInput.value; }; }
    var rucaInput = document.getElementById('userProfileRucaInput');
    if(rucaInput){ rucaInput.oninput = function(){ AppState.userProfileDraft.rucaFundacion = rucaInput.value; }; }
    var deptoIconSelect = document.getElementById('userProfileDeptoIconSelect');
    if(deptoIconSelect){ deptoIconSelect.onchange = function(){ AppState.userProfileDraft.deptoIconChoice = deptoIconSelect.value; }; }
    var cupulaIconSelect = document.getElementById('userProfileCupulaIconSelect');
    if(cupulaIconSelect){ cupulaIconSelect.onchange = function(){ AppState.userProfileDraft.cupulaIcon = cupulaIconSelect.value; }; }
    var consagradoIconSelect = document.getElementById('userProfileConsagradoIconSelect');
    if(consagradoIconSelect){ consagradoIconSelect.onchange = function(){ AppState.userProfileDraft.consagradoIconChoice = consagradoIconSelect.value; }; }

    var saveBtn = document.getElementById('userProfileSaveBtn');
    if(saveBtn){
      saveBtn.onclick = function(){
        updateMyProfile(AppState.userProfileDraft);
        AppState.userMenuEditingProfile = false;
        AppState.userProfileDraft = null;
        // El propio onSnapshot de watchProfile() va a refrescar currentUser
        // (actividadFavorita/rucaFundacion ya guardados) y disparar un
        // render solo en cuanto el write resuelva — este render de acá es
        // solo para cerrar el formulario de inmediato, sin esperarlo.
        renderAuthBar();
      };
    }
    var cancelBtn = document.getElementById('userProfileCancelBtn');
    if(cancelBtn){
      cancelBtn.onclick = function(){
        AppState.userMenuEditingProfile = false;
        AppState.userProfileDraft = null;
        renderAuthBar();
      };
    }
  }


  // Igual que currentPageLabel(), pero a partir de una ENTRADA puntual en vez
  // de la pestaña activa — la usa el campanario de "Novedades" para decir
  // dónde vive cada cosa nueva.
  export function entryLocationLabel(entry){
    if(entry.dayId === 'RESOURCES') return 'Recursos';
    if(entry.dayId === 'INFO_GENERAL') return 'Info general';
    if(!entry.dayId) return 'Departamentos';
    var day = (AppState.state.days || []).find(function(d){ return d.id === entry.dayId; });
    return day ? ('Mensaje — ' + day.label) : 'Mensaje';
  }


  // Contenido agregado en los últimos NOVEDADES_WINDOW_DAYS días que el usuario
  // actual puede ver (reusa canSeeEntry — un lector nunca se entera de algo que
  // igual no le tocaría ver). No hay tracking de "última visita": es una
  // ventana fija, simple a propósito.
  export function getNovedades(){
    var cutoff = Date.now() - NOVEDADES_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return (AppState.state.entries || [])
      .filter(function(e){ return e.createdAt && e.createdAt >= cutoff && canSeeEntry(e); })
      .sort(function(a,b){ return b.createdAt - a.createdAt; });
  }
