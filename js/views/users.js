// Panel "Usuarios" (solo admin): filtros, orden, subpestañas
// Comando/Milicianos, y la asignación de rol/sección/depto por fila.

import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { SECCIONES, DEPARTAMENTOS, BOOTSTRAP_ADMIN_EMAIL } from '../config/constants.js';
import { escapeHtml, roleLabel, activityIcon } from '../utils/helpers.js';
import { setUserRole, deleteUser } from '../services/users.service.js';
import { copyTextToClipboard } from './feedback.js';
import { render, renderPanel, showStatus } from '../main.js';

  // Filtra `usersList` según los filtros activos de la pestaña "Usuarios"
  // (pedido del usuario, 23/09/2026: filtrar por rol, sección, fecha y nombre).
  // Un miliciano es, sin ambigüedad, `role:'lector'` (rediseño de roles,
  // 23/09/2026) — todo lo demás (admin/jefe_seccion/subjefe/consagrado/
  // pendiente) es comando. Se usa tanto para las subpestañas como para sus
  // contadores.
  export function isMilicianoUser(u){ return u.role === 'lector'; }


  export function filteredUsersList(){
    var subset = AppState.usersList.filter(function(u){
      return AppState.usersActiveSubTab === 'milicianos' ? isMilicianoUser(u) : !isMilicianoUser(u);
    });
    var filtered = subset.filter(function(u){
      if(AppState.usersFilterName && (u.displayName || '').toLowerCase().indexOf(AppState.usersFilterName.toLowerCase()) === -1) return false;
      if(AppState.usersFilterRole && u.role !== AppState.usersFilterRole) return false;
      if(AppState.usersFilterScope){
        if(AppState.usersFilterScope.indexOf('seccion:') === 0 && u.seccion !== AppState.usersFilterScope.slice(8)) return false;
        if(AppState.usersFilterScope.indexOf('depto:') === 0 && u.depto !== AppState.usersFilterScope.slice(6)) return false;
      }
      return true;
    });
    // Orden por Nombre o Fecha, en cualquier dirección (pedido del usuario,
    // 23/09/2026) — sin ordenar, queda el orden alfabético de siempre que ya
    // trae `usersList` desde watchUsers().
    if(AppState.usersSortField){
      filtered = filtered.slice().sort(function(a, b){
        var cmp = AppState.usersSortField === 'nombre'
          ? (a.displayName || '').localeCompare(b.displayName || '')
          : (a.createdAt || 0) - (b.createdAt || 0);
        return AppState.usersSortDir === 'desc' ? -cmp : cmp;
      });
    }
    return filtered;
  }


  export function usersSortBtnHtml(field){
    var icon = AppState.usersSortField === field ? (AppState.usersSortDir === 'asc' ? '▲' : '▼') : '↕';
    return ' <button type="button" class="uf-sort-btn" data-sort="' + field + '" title="Ordenar">' + icon + '</button>';
  }


  // Texto plano con nombre + actividad favorita (09/10/2026, mismo patrón
  // que "Copiar pendientes" de Comentarios) — pensado para pegar en el chat
  // y revisar de una si algún ícono por actividad favorita no está
  // matcheando bien con lo que la gente puso de verdad. Achicado a solo
  // estos dos campos (antes incluía rol/email/declaró/ruca) porque es todo
  // lo que hace falta para ese chequeo puntual — pedido del usuario,
  // 09/10/2026: "en serio queres toda esa información, es solo para los
  // iconos". Solo entran los que SÍ cargaron algo — alguien sin actividad
  // no tiene ícono que revisar.
  export function buildUsersDeclaredText(list){
    var withActivity = list.filter(function(u){ return u.actividadFavorita; });
    if(withActivity.length === 0) return '';
    var lines = ['Actividades favoritas (' + withActivity.length + '):', ''];
    withActivity.forEach(function(u, i){
      lines.push((i+1) + '. ' + (u.displayName || '(sin nombre)') + ' — ' + u.actividadFavorita);
    });
    return lines.join('\n');
  }


  export function renderUsersPanel(){
    var html = '';
    html += '<div class="panel-head"><div><h2>Usuarios</h2>';
    html += '<p class="mandos-sub">Los que declararon un mando que coincide con el cuadro de mandos entraron solos. Revisá los resaltados en ámbar ("pendiente") — quedaron ahí porque no coincidieron, son acampantes/lectores sin padrón para verificar, o (⚠ sugiere: Admin) matchearon un puesto de admin y están esperando que lo confirmes vos.</p></div>';
    html += '<button class="btn ghost small" id="copyUsersBtn" type="button">Copiar actividades</button>';
    html += '</div>';

    // Importar/actualizar YouCat + la Biblia en Firestore (09/10/2026, ver
    // "Fordoquera incrustada" en CLAUDE.md) — mismo patrón que tuvo
    // "Importar desde el código" para el cuadro de mandos: botón admin-only,
    // pensado para correrse una sola vez (es idempotente, `set` pisa el
    // documento entero, así que correrlo de nuevo no rompe nada si hace
    // falta resembrar). Lee de `seed-data/` (solo en el repo privado,
    // nunca en el espejo público — tiene derechos de autor) vía fetch().
    html += '<div class="mandos-sub" style="margin-bottom:14px">';
    html += '  <button class="btn ghost small" id="seedLibrosBtn" type="button">📚 Importar libros (YouCat + Biblia) a Firestore</button>';
    html += '  <span id="seedLibrosStatus" style="margin-left:8px"></span>';
    html += '</div>';

    if(AppState.usersList.length === 0){
      html += '<p class="empty">Todavía no inició sesión nadie más.</p>';
      return html;
    }

    // Subpestañas Comando/Milicianos (pedido del usuario, 23/09/2026).
    var comandoCount = AppState.usersList.filter(function(u){ return !isMilicianoUser(u); }).length;
    var milicianosCount = AppState.usersList.length - comandoCount;
    html += '<div class="users-subtabs">';
    html += '  <button type="button" class="day-pill' + (AppState.usersActiveSubTab==='comando' ? ' active':'') + '" data-subtab="comando">Comando (' + comandoCount + ')</button>';
    html += '  <button type="button" class="day-pill' + (AppState.usersActiveSubTab==='milicianos' ? ' active':'') + '" data-subtab="milicianos">Milicianos (' + milicianosCount + ')</button>';
    html += '</div>';

    // Ocultar/mostrar el autologueo de milicianos (pedido del usuario,
    // 26/09/2026): mientras el campamento arma su propia página para ellos,
    // esta queda exclusiva del comando. Solo oculta la opción "Soy
    // miliciano" del login y "Milicianos" de "Ver como" — no toca las
    // cuentas de milicianos que ya se registraron (ver AppState.publicConfig).
    if(AppState.usersActiveSubTab === 'milicianos'){
      var miliEnabled = AppState.publicConfig.milicianosLoginEnabled !== false;
      html += '<div class="mandos-sub" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">';
      html += '  <span>Autologueo de milicianos: <strong>' + (miliEnabled ? 'habilitado' : 'deshabilitado') + '</strong></span>';
      html += '  <button class="btn ghost small" id="toggleMilicianosLoginBtn" type="button">' + (miliEnabled ? 'Deshabilitar' : 'Habilitar') + '</button>';
      html += '</div>';
      html += '<p class="mandos-sub" style="margin:-4px 0 10px">Oculta "Soy miliciano" en el login y "Milicianos" en "Ver como". No afecta a quienes ya tienen cuenta.</p>';
    }

    html += '<div class="users-filters">';
    html += '  <input type="text" id="ufName" placeholder="Buscar por nombre..." value="' + escapeHtml(AppState.usersFilterName) + '">';
    html += '  <select id="ufRole"><option value="">Todos los roles</option>';
    ['pendiente','lector','subjefe','consagrado','jefe_seccion','admin'].forEach(function(r){
      html += '<option value="' + r + '"' + (AppState.usersFilterRole===r ? ' selected':'') + '>' + roleLabel(r) + '</option>';
    });
    html += '  </select>';
    html += '  <select id="ufScope"><option value="">Todas las secciones/deptos</option>';
    html += '<optgroup label="Secciones">';
    SECCIONES.forEach(function(s){
      var v = 'seccion:' + s;
      html += '<option value="' + escapeHtml(v) + '"' + (AppState.usersFilterScope===v ? ' selected':'') + '>' + escapeHtml(s) + '</option>';
    });
    html += '</optgroup><optgroup label="Departamentos">';
    DEPARTAMENTOS.forEach(function(d){
      var v = 'depto:' + d;
      html += '<option value="' + escapeHtml(v) + '"' + (AppState.usersFilterScope===v ? ' selected':'') + '>' + escapeHtml(d) + '</option>';
    });
    html += '</optgroup></select>';
    html += '  <button class="btn ghost small" id="ufClearBtn" type="button">Limpiar filtros</button>';
    html += '</div>';

    var filtered = filteredUsersList();
    if(filtered.length === 0){
      html += '<p class="empty">Ningún usuario coincide con los filtros.</p>';
      return html;
    }

    // "Se logueó" (fecha) va antes que "Nombre" y ambas tienen botón de
    // orden (pedido del usuario, 23/09/2026).
    html += '<div style="overflow-x:auto"><table class="users-table"><thead><tr>' +
      '<th>Se logueó' + usersSortBtnHtml('fecha') + '</th>' +
      '<th>Nombre' + usersSortBtnHtml('nombre') + '</th>' +
      '<th>Declaró</th><th>Email</th><th>Rol</th><th>Sección / Depto</th>' +
      '<th title="Para consagrados: ver Departamentos en modo lectura">Lee Deptos.</th>' +
      '<th title="Ve el botón flotante de Comentarios (pensado para Formación, además de Comunicaciones)">Comenta diseño</th><th></th></tr></thead><tbody>';
    filtered.forEach(function(u){
      var isPendiente = u.role === 'pendiente';
      html += '<tr data-uid="' + u.uid + '"' + (isPendiente ? ' class="user-row-pendiente"' : '') + '>';
      // Fecha y hora en renglones separados (pedido del usuario, 23/09/2026:
      // "asi se optimiza mejor el espacio") — antes iban juntas en un solo
      // string largo, que además a veces partía la hora a la mitad ("a." /
      // "m.") si la columna quedaba angosta.
      var fechaLogueoDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
      var fechaLogueoHora = u.createdAt ? new Date(u.createdAt).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' }) : '';
      html += '  <td style="white-space:nowrap">' + escapeHtml(fechaLogueoDate) + (fechaLogueoHora ? '<br><span class="mandos-sub" style="margin:0">' + escapeHtml(fechaLogueoHora) + '</span>' : '') + '</td>';
      // Ruca/Fundación y actividad favorita ya no ocupan renglones propios —
      // quedan en un popover propio (no el tooltip nativo, que tarda en
      // aparecer y no se abre con un click) al lado del nombre (pedido del
      // usuario, 23/09/2026).
      // Actividad favorita pasó a ser EDITABLE acá (09/10/2026, pedido del
      // usuario: "¿puedo declarar una actividad después de loguearme?") —
      // antes solo se cargaba una vez, en el formulario de onboarding, sin
      // forma de corregirla o completarla después (ni siquiera el admin
      // bootstrap pasa por ese formulario, así que nunca tenía una propia).
      // El valor se lee junto al resto de la fila al tocar "Guardar" (mismo
      // patrón que el select de Rol o los checkboxes de abajo) — no hace
      // falta un botón aparte.
      var infoParts = [];
      if(u.rucaFundacion) infoParts.push('<p><strong>Ruca/Fundación:</strong> ' + escapeHtml(u.rucaFundacion) + '</p>');
      infoParts.push('<p><strong>Actividad favorita:</strong><br><input type="text" class="uActividad" value="' + escapeHtml(u.actividadFavorita || '') + '" placeholder="Ej: Marcha, fogón..."></p>');
      var infoBtn = ' <span class="user-info-wrap"><button type="button" class="user-info-btn" data-uid="' + u.uid + '">▲</button><div class="user-info-popover">' + infoParts.join('') + '</div></span>';
      // Ícono por actividad favorita (09/10/2026) — mismo helper que ya usa
      // el nombre propio en la barra superior, acá para poder identificar
      // a cada persona de un vistazo en la lista entera.
      var rowActivityIcon = activityIcon(u.actividadFavorita);
      html += '  <td>' + (rowActivityIcon ? rowActivityIcon + ' ' : '') + escapeHtml(u.displayName || '') + (u.email === BOOTSTRAP_ADMIN_EMAIL ? ' <span class="tag seccion">admin base</span>' : '') +
        infoBtn + '</td>';
      // Perfiles guardados ANTES del renombre "Capellán"→"Consagrado" (ver
      // posGrupoLabel más arriba) quedaron con el string viejo grabado tal
      // cual en Firestore (declaradoComo es un snapshot al momento del
      // onboarding, no se recalcula solo) — se normaliza acá para mostrarlo
      // igual que uno nuevo, sin necesitar migrar datos (pedido del usuario,
      // caso real: Reneidi Kayembe, 23/09/2026).
      var declaradoComoShown = (u.declaradoComo || '').replace(/^Capellán/, 'Consagrado');
      // El badge de sugerencia solo tiene sentido mientras la persona siga
      // "pendiente" — una vez que un admin ya la guardó con un rol real
      // (promovida a admin o asignada a otra cosa), `rolSugerido` sigue
      // guardado en Firestore como snapshot de lo que matcheó en su momento,
      // pero ya no hay nada pendiente de confirmar (pedido del usuario,
      // 09/10/2026: "que desaparezca la sugerencia" una vez resuelta).
      html += '  <td>' + escapeHtml(declaradoComoShown || (u.tipo === 'acampante' ? 'Acampante' : '—')) +
        (isPendiente && u.rolSugerido === 'admin' ? ' <span class="tag imagen" title="Nombre y mando coinciden con un puesto que otorgaría Admin, pero requiere que un admin lo confirme a mano">⚠ sugiere: Admin</span>' : '') + '</td>';
      html += '  <td>' + escapeHtml(u.email || '') + '</td>';
      html += '  <td><select class="uRole">';
      ['pendiente','lector','subjefe','consagrado','jefe_seccion','admin'].forEach(function(r){
        html += '<option value="' + r + '"' + (u.role===r ? ' selected':'') + '>' + roleLabel(r) + '</option>';
      });
      html += '  </select></td>';
      html += '  <td><select class="uScope"><option value="">— (General)</option>';
      html += '<optgroup label="Secciones">';
      SECCIONES.forEach(function(s){
        var v = 'seccion:' + s;
        html += '<option value="' + escapeHtml(v) + '"' + (u.seccion===s ? ' selected':'') + '>' + escapeHtml(s) + '</option>';
      });
      html += '</optgroup><optgroup label="Departamentos">';
      DEPARTAMENTOS.forEach(function(d){
        var v = 'depto:' + d;
        html += '<option value="' + escapeHtml(v) + '"' + (u.depto===d ? ' selected':'') + '>' + escapeHtml(d) + '</option>';
      });
      html += '</optgroup></select></td>';
      html += '  <td style="text-align:center"><input type="checkbox" class="uReadDeptos"' + (u.readDepartamentos ? ' checked' : '') + ' title="Ve la pestaña Departamentos en modo lectura (pensado para consagrados)"></td>';
      html += '  <td style="text-align:center"><input type="checkbox" class="uEsFormacion"' + (u.esFormacion ? ' checked' : '') + ' title="Ve el botón flotante de Comentarios (diseño/estética), aunque no sea de Comunicaciones"></td>';
      // El `display:flex` tiene que vivir en un <div> ADENTRO del <td>, nunca
      // en el <td> mismo — puesto directo en la celda, deja de participar del
      // alto de fila como una celda normal (pierde `vertical-align:middle`) y
      // queda desfasada respecto de las demás columnas de la misma fila
      // (reportado por el usuario, 07/10/2026, con captura). Mismo patrón ya
      // usado en la tabla de "Comentarios" (ver feedback.js) — ahí nunca tuvo
      // este bug porque ya envolvía el flex en un <div> propio.
      html += '  <td><div style="display:flex;gap:6px;flex-wrap:wrap">';
      html += '    <button class="btn small" data-action="saveUser">Guardar</button>';
      if(u.email === BOOTSTRAP_ADMIN_EMAIL){
        html += '    <button class="btn ghost small" disabled title="No podés borrar al admin base">Borrar</button>';
      } else {
        html += '    <button class="btn ghost small" data-action="deleteUser">Borrar</button>';
      }
      html += '  </div></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }


  export function attachUsersEvents(){
    var copyUsersBtn = document.getElementById('copyUsersBtn');
    if(copyUsersBtn){
      copyUsersBtn.onclick = function(){
        copyTextToClipboard(buildUsersDeclaredText(filteredUsersList()), copyUsersBtn);
      };
    }

    document.querySelectorAll('[data-subtab]').forEach(function(btn){
      btn.onclick = function(){
        AppState.usersActiveSubTab = btn.getAttribute('data-subtab');
        // Un filtro de rol que no existe en la subpestaña nueva (ej. "Admin"
        // mirando "Milicianos") dejaría la tabla vacía sin explicación — se
        // resetea al cambiar de subpestaña.
        AppState.usersFilterRole = '';
        renderPanel();
      };
    });

    var seedLibrosBtn = document.getElementById('seedLibrosBtn');
    if(seedLibrosBtn){
      seedLibrosBtn.onclick = function(){
        if(!confirm('¿Importar YouCat y la Biblia a Firestore? Esto lee ~6.8MB desde el repo y los escribe en varios documentos — puede tardar un rato. Es seguro correrlo de nuevo si hace falta.')) return;
        seedLibrosBtn.disabled = true;
        var statusEl = document.getElementById('seedLibrosStatus');
        import('../services/libros-seed.service.js').then(function(mod){
          return mod.seedLibrosFromFiles(function(msg){ if(statusEl) statusEl.textContent = msg; });
        }).then(function(resumen){
          if(statusEl) statusEl.textContent = resumen;
          showStatus(resumen);
          seedLibrosBtn.disabled = false;
        }).catch(function(e){
          console.error(e);
          if(statusEl) statusEl.textContent = '❌ ' + (e.message || 'No se pudo importar.');
          seedLibrosBtn.disabled = false;
        });
      };
    }

    var toggleMiliBtn = document.getElementById('toggleMilicianosLoginBtn');
    if(toggleMiliBtn){
      toggleMiliBtn.onclick = function(){
        var next = !(AppState.publicConfig.milicianosLoginEnabled !== false);
        toggleMiliBtn.disabled = true;
        setDoc(doc(db, 'config', 'public'), { milicianosLoginEnabled: next }, { merge: true }).then(function(){
          AppState.publicConfig.milicianosLoginEnabled = next;
          // Si estaba simulando "Ver como → Milicianos" y se acaba de
          // deshabilitar, esa opción ya no está en la lista — se resetea
          // para no dejar el pill de simulación mostrando algo que el
          // desplegable ya no ofrece.
          if(!next && AppState.viewAsOverride && AppState.viewAsOverride.role === 'lector'){ AppState.viewAsOverride = null; }
          render();
          showStatus(next ? 'Autologueo de milicianos habilitado.' : 'Autologueo de milicianos deshabilitado.');
        }).catch(function(e){
          console.error(e);
          toggleMiliBtn.disabled = false;
          showStatus('No se pudo guardar. Probá de nuevo.');
        });
      };
    }

    // El botón de info (Ruca/Fundación, actividad favorita) togglea `.open`
    // para que funcione con un click/tap además de hover (pedido del
    // usuario, 23/09/2026) — un segundo click lo vuelve a cerrar.
    document.querySelectorAll('.user-info-btn').forEach(function(btn){
      btn.onclick = function(e){
        e.stopPropagation();
        btn.closest('.user-info-wrap').classList.toggle('open');
      };
    });

    document.querySelectorAll('.uf-sort-btn').forEach(function(btn){
      btn.onclick = function(){
        var field = btn.getAttribute('data-sort');
        if(AppState.usersSortField === field){ AppState.usersSortDir = AppState.usersSortDir === 'asc' ? 'desc' : 'asc'; }
        else { AppState.usersSortField = field; AppState.usersSortDir = 'asc'; }
        renderPanel();
      };
    });

    // Filtros — el de nombre re-renderiza en cada tecla (para filtrar en
    // vivo), así que guarda y restaura la posición del cursor para no perder
    // el foco en medio de lo que se está escribiendo.
    var ufName = document.getElementById('ufName');
    if(ufName){
      ufName.oninput = function(e){
        AppState.usersFilterName = e.target.value;
        var cursorPos = e.target.selectionStart;
        renderPanel();
        var newInput = document.getElementById('ufName');
        if(newInput){ newInput.focus(); newInput.setSelectionRange(cursorPos, cursorPos); }
      };
    }
    var ufRole = document.getElementById('ufRole');
    if(ufRole){ ufRole.onchange = function(){ AppState.usersFilterRole = ufRole.value; renderPanel(); }; }
    var ufScope = document.getElementById('ufScope');
    if(ufScope){ ufScope.onchange = function(){ AppState.usersFilterScope = ufScope.value; renderPanel(); }; }
    var ufClearBtn = document.getElementById('ufClearBtn');
    if(ufClearBtn){
      ufClearBtn.onclick = function(){
        AppState.usersFilterName = ''; AppState.usersFilterRole = ''; AppState.usersFilterScope = '';
        renderPanel();
      };
    }

    document.querySelectorAll('[data-action="saveUser"]').forEach(function(btn){
      btn.onclick = function(){
        var row = btn.closest('tr');
        var uidVal = row.getAttribute('data-uid');
        var role = row.querySelector('.uRole').value;
        var scopeVal = row.querySelector('.uScope').value;
        var seccion = scopeVal.indexOf('seccion:') === 0 ? scopeVal.slice(8) : '';
        var depto = scopeVal.indexOf('depto:') === 0 ? scopeVal.slice(6) : '';
        var readDeptos = row.querySelector('.uReadDeptos').checked;
        var esFormacion = row.querySelector('.uEsFormacion').checked;
        var actividadInput = row.querySelector('.uActividad');
        var actividad = actividadInput ? actividadInput.value.trim() : '';
        if(role === 'jefe_seccion' && !seccion && !depto){
          alert('Elegí una sección o un departamento para ese rol.');
          return;
        }
        setUserRole(uidVal, role, seccion || null, depto || null, readDeptos, esFormacion, actividad);
      };
    });

    document.querySelectorAll('[data-action="deleteUser"]').forEach(function(btn){
      btn.onclick = function(){
        var row = btn.closest('tr');
        var uidVal = row.getAttribute('data-uid');
        // 2da celda (la 1ra es "Se logueó" desde el reordenamiento de
        // columnas del 23/09/2026) — antes de sacar el texto, se clona la
        // fila para poder sacarle el popover de info sin mostrar su
        // contenido pegado al nombre en el mensaje de confirmación.
        var nameCell = row.querySelectorAll('td')[1];
        var nombre = 'este usuario';
        if(nameCell){
          var clone = nameCell.cloneNode(true);
          var popover = clone.querySelector('.user-info-wrap');
          if(popover) popover.remove();
          nombre = clone.textContent.trim();
        }
        if(!confirm('¿Borrar el perfil de "' + nombre + '"? Va a tener que volver a completar el formulario de onboarding la próxima vez que inicie sesión.')) return;
        deleteUser(uidVal);
      };
    });
  }
