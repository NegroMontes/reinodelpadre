// Barra superior (usuario, "Ver como", Modo Lector, campana de
// Novedades) y sus datos: qué contenido nuevo hay, y dónde vive.

import { AppState } from '../app-state.js';
import { SECCIONES, DEPARTAMENTOS, VIEW_AS_ROLES, NOVEDADES_WINDOW_DAYS } from '../config/constants.js';
import { escapeHtml, roleLabel } from '../utils/helpers.js';
import { saveNovedadesSeenAt } from '../utils/storage.js';
import { lectorModeActive, realIsAdmin, isComandoNonAdmin, canSeeEntry } from '../services/permissions.js';
import { signOutUser } from '../services/auth.service.js';
import { render } from '../main.js';

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
    if(!AppState.authResolved || !AppState.currentUser){ el.innerHTML = ''; return; }
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
    var html = '<div class="auth-user">';
    html += '<button id="novedadesBtn" class="novedades-bell" type="button" title="Novedades de los últimos ' + NOVEDADES_WINDOW_DAYS + ' días">🔔' + (novedadesSinVer.length > 0 ? '<span class="tag imagen novedades-count">' + novedadesSinVer.length + '</span>' : '') + '</button>';
    html += '<span class="role-pill">' + escapeHtml(roleLabel(AppState.currentUser.role)) + '</span>' + simPill + lectorPill;
    html += '<span>' + escapeHtml(AppState.currentUser.displayName) + '</span>';
    if(realIsAdmin()){
      var curRole = AppState.viewAsOverride ? AppState.viewAsOverride.role : '';
      html += '<select id="viewAsRoleSelect">';
      // "Milicianos" se puede ocultar del selector (pedido del usuario,
      // 26/09/2026) desde Usuarios → Milicianos — ver AppState.publicConfig.
      VIEW_AS_ROLES.filter(function(o){ return o.value !== 'lector' || AppState.publicConfig.milicianosLoginEnabled !== false; }).forEach(function(o){
        html += '<option value="' + o.value + '"' + (o.value === curRole ? ' selected' : '') + '>' + escapeHtml(o.label) + '</option>';
      });
      html += '</select>';
      if(curRole === 'jefe_seccion' || curRole === 'subjefe' || curRole === 'consagrado' || curRole === 'lector'){
        var curScope = AppState.viewAsOverride ? (AppState.viewAsOverride.seccion ? ('seccion:' + AppState.viewAsOverride.seccion) : (AppState.viewAsOverride.depto ? ('depto:' + AppState.viewAsOverride.depto) : '')) : '';
        html += '<select id="viewAsScopeSelect">' + viewAsScopeOptionsHtml(curRole, curScope) + '</select>';
      }
    } else if(isComandoNonAdmin()){
      // Toggle "Mi mando" / "Lector" (25/09/2026, sugerencia de Juli
      // Ahumada): disponible para cualquier jefe de sección/depto, subjefe o
      // consagrado — nunca milicianos (confirmado por el usuario) ni admin
      // (ya tiene "Ver como", que cubre lo mismo y más).
      html += '<select id="myLectorModeSelect" title="Mi mando: tus permisos de siempre. Lector: leés todo el comando (todas las secciones y departamentos), sin poder editar nada mientras esté activo.">';
      html += '  <option value="mando"' + (!AppState.myLectorMode ? ' selected' : '') + '>Mi mando</option>';
      html += '  <option value="lector"' + (AppState.myLectorMode ? ' selected' : '') + '>Lector (todo el comando)</option>';
      html += '</select>';
    }
    html += '<button id="signOutBtn" type="button">Cerrar sesión</button>';
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
    document.getElementById('signOutBtn').onclick = signOutUser;

    var myLectorModeSelect = document.getElementById('myLectorModeSelect');
    if(myLectorModeSelect){
      myLectorModeSelect.onchange = function(){
        AppState.myLectorMode = (myLectorModeSelect.value === 'lector');
        AppState.formOpen = false; // por si tenía el form de "Agregar contenido" abierto al cambiar
        render();
      };
    }

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
