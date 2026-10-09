import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { auth } from './config/firebase.js';
import { BOOTSTRAP_ADMIN_EMAIL, SECCIONES, DEPARTAMENTOS, NOVEDADES_WINDOW_DAYS, CAMP_DURATION_DAYS, ALIGN_OPTIONS, STEP_TYPE_LABELS, VIEW_AS_ROLES } from './config/constants.js';

import { renderUsersPanel, attachUsersEvents } from './views/users.js';
import { renderFeedbackPanel, attachFeedbackPanelEvents } from './views/feedback.js';
import { renderPapeleraPanel, attachPapeleraPanelEvents } from './views/papelera.js';
import { renderDepartamentosPanel, renderRecursosPanel, renderMensajePanel } from './views/mensaje.js';
import { renderMandosPanel } from './views/mandos.js';
import { loadMandos } from './services/mandos.service.js';
import { stopCountdownTicker, startCountdownTicker, renderHomePanel, attachHomeEvents } from './views/home.js';
import { renderGate } from './views/gate.js';
import { canSeeFeedbackWidget, renderFeedbackWidget, attachFeedbackWidgetEvents } from './components/feedback-widget.js';
import { viewAsScopeOptionsHtml, renderAuthBar, entryLocationLabel, getNovedades } from './components/header.js';
import { renderAmbitoPicker, renderStepsBuilder, renderForm, attachPanelEvents } from './components/form.js';
import { addDay, renameDay, setDayDate, setConsigna, deleteDay } from './services/state.service.js';
import { renderAlignPicker, textZoneHtml, scopeTagsHtml, driveFileId, youtubeId, vimeoId, embeddableImageSrc, embedBlockHtml, renderPropositosRecordatorio, setSecuencialFullscreenLock, scrollSecuencialToTop, musicSourceUrl, stopSecuencialMusic, startSecuencialMusicIfAny, updateSecuencialMusicForStep, renderSecuencialEntry, renderEntry } from './components/entry.js';
import { signIn, signOutUser, watchProfile, submitOnboarding } from './services/auth.service.js';
import { watchUsers, setUserRole, deleteUser } from './services/users.service.js';
import { watchFeedback, submitFeedback, toggleFeedbackResuelto, deleteFeedbackItem } from './services/feedback.service.js';
import { canSeeCompletions, ensureCompletionsSubs, unsubAllCompletions, progressDocRef, ensureProgressSubs, unsubAllProgress, saveProgressAnswer, markProgressCompleted } from './services/progress.service.js';
import { defaultData, load, save, loadPublicConfig } from './services/state.service.js';
import { uploadEntryFile } from './services/drive.service.js';
import { realIsAdmin, effectiveRole, effectiveSeccion, effectiveDepto, isAdmin, isJefeSeccion, isLectorLike, isComandoNonAdmin, lectorModeActive, isJefeSeccionEditing, canEditStructure, entryScope, canEditEntry, canSeeEntry, canSeeDepartamentosTab, canCreateRecurso, canCreateInfoGeneral, canEditConsigna } from './services/permissions.js';
import { AppState } from './app-state.js';
import { uid, escapeHtml, linkify, alignStyleAttr, roleLabel } from './utils/helpers.js';
import { saveNovedadesSeenAt, saveUsersSeenAt, saveTheme } from './utils/storage.js';
import { encodeHash, decodeHash } from './utils/hash-router.js';

// Los servicios (services/*.js) necesitan poder disparar un re-render o
// mostrar un mensaje de estado después de una operación async — como
// render()/renderDayRail()/showStatus()/currentPageLabel() viven adentro del
// IIFE de más abajo (dependen de un montón de funciones de vista que todavía
// no se separaron), no se pueden `export` ahí directo (export solo vale a
// nivel de módulo) — se declaran acá arriba y el IIFE las asigna al llegar a
// su definición real, en vez de declararlas con `function` de nuevo.
export let render, renderDayRail, showStatus, currentPageLabel, renderPanel;

(function(){
  // Ámbito elegido en el form de "Agregar contenido" para una entrada nueva —
  // multi-select: cero o más secciones, cero o más departamentos, más un
  // checkbox aparte "Comando (sin milicianos)". Se guarda acá (no solo
  // en los checkboxes) para sobrevivir a re-render que disparen otros controles
  // del form (mismo patrón que obNombreDraft en el onboarding). Nada elegido y
  // el checkbox sin tildar = General (visible para todos, milicianos incluidos).
  // Solo en Recursos (22/09/2026): acota la(s) sección(es) elegida(s) al
  // comando de esa sección únicamente (subjefes/secretarios, `tipo:'comando'`),
  // sin que lo vean los milicianos de esa misma sección — a diferencia de
  // `formComandoGeneral`, que es "todo el comando de cualquier sección/depto".
  // "Ocultar (borrador)" (pedido del usuario, 23/09/2026) — si está tildado,
  // la entrada se guarda armada, con sus etiquetas de sección/depto puestas,
  // pero solo la ve quien puede editarla hasta que se publique (ver
  // canSeeEntry). Deja "armar con tiempo" una entrada sin que la vean los
  // milicianos/lectores de esas etiquetas todavía.
  // "Entrada de bienvenida" (pedido del usuario, 24/09/2026) — solo aplica a
  // una entrada Secuencial de Recursos; si está tildado, aparece arriba de
  // todo en "Inicio" para cualquiera que todavía no la haya completado
  // (comando y milicianos por igual) hasta que la completa, y de ahí en más
  // sigue viviendo en Recursos como cualquier otra (ver renderWelcomeSection).
  // Qué entradas están colapsadas (pedido del usuario, 23/09/2026) — en
  // memoria, por entryId; puramente una comodidad visual de navegación (no
  // se persiste, no distingue entre usuarios).
  // Alineación por zona de texto (rediseñado 22/09/2026, reemplaza al viejo
  // `formTextAlign` único para toda la entrada) — 'body'/'bodyAfter' son las
  // dos zonas posibles a nivel de la entrada (texto único, o antes/después de
  // una imagen/video); cada paso de una secuencial guarda las suyas propias
  // adentro de `formSteps[i]` (`align`/`preTextAlign`/`postTextAlign`, según
  // el tipo de paso). 'left' es siempre el default.
  // Entradas "secuenciales" (22/09/2026) — pasos ordenados (texto, video,
  // imagen, pregunta, propósito personal) que se recorren de a uno, en vez de
  // un bloque de texto único. `formSteps` es el borrador del form de "Agregar
  // contenido" cuando `formType === 'secuencial'` — cada paso es
  // `{type, text, url}`; se muta directo (sin re-render) al tipear en un
  // paso, mismo criterio que el resto de los *Draft de esta sesión, así
  // sobrevive a un re-render disparado por otro control del form.
  // Colapsar el contenido de una entrada MIENTRAS SE LA EDITA (pedido del
  // usuario, 23/09/2026 — distinto del colapso de lectura, `collapsedEntryIds`
  // de arriba): en una secuencial larga, o una imagen/video con mucho texto
  // antes/después, ayuda a ver de un vistazo las distintas partes del
  // formulario. `formStepsCollapsed` colapsa TODOS los pasos de una
  // secuencial a la vez (no hay granularidad por paso — un solo botón,
  // como pidió el usuario); `formMediaCollapsed` colapsa el bloque de
  // URL/subida + textos antes/después de una entrada de Imagen o Video.
  // Ambos son puramente de CSS (display:none), nunca tocan `formSteps`/los
  // valores ya tecleados — reabrir no pierde nada. Arrancan colapsados por
  // default (pedido del usuario, 23/09/2026: "que los elementos que puedan
  // colapsarse aparezcan por efecto colapsados") — se expanden con un click.
  // Estado de NAVEGACIÓN de quien está leyendo/recorriendo una entrada
  // secuencial — nunca se persiste (es solo la posición en pantalla mientras
  // se recorre; si recarga, arranca de nuevo desde el paso 1, ver docs).
  // Lo tecleado en el cuadro de "propósito personal" de un paso, sin guardar
  // todavía (blur dispara el guardado real en Firestore) — mismo patrón
  // *Draft, para no perder lo tecleado si llega un render por otro motivo
  // mientras la persona está escribiendo.
  // Música de fondo (22/09/2026) — solo una entrada puede tener música sonando
  // a la vez (mismo criterio que `secuencialOpenEntryId`, que también es un
  // único valor global, nunca por-entrada). `secuencialMusicPausedByVideo`
  // distingue una pausa "porque estás en un paso de video" de una pausa
  // explícita del usuario — así solo se retoma sola en el primer caso.
  // Aviso visible cuando el <audio> no puede reproducir el link cargado
  // (pedido del usuario, 23/09/2026: "No puedo escuchar la música") — antes
  // fallaba en silencio (el `.catch()` de `play()` no avisaba nada); el caso
  // más común es un link de Drive privado (hace falta compartirlo como
  // "Cualquiera con el enlace", igual que ya pasa con imágenes/videos) o un
  // link que no apunta a un archivo de audio real.
  // Filtros/orden de la pestaña "Usuarios" (pedido del usuario, 23/09/2026) —
  // en memoria, se resetean al cerrar sesión (no hace falta persistirlos).
  // Los filtros de fecha (Desde/Hasta) se sacaron el mismo día, a cambio de
  // poder ordenar por fecha (ver usersSortField/usersSortDir).
  // Orden por defecto: más nuevo primero (pedido del usuario, 23/09/2026) —
  // antes arrancaba sin ordenar ('').
  // Subpestañas Comando/Milicianos (pedido del usuario, 23/09/2026) — un
  // miliciano es, sin ambigüedad, `role:'lector'` (ver rediseño de roles);
  // todo lo demás (admin/jefe_seccion/subjefe/consagrado/pendiente) es comando.
  // Token de acceso a Google Drive del usuario (22/09/2026) — solo se
  // obtiene si entró por el camino "comando" (ver signIn()). Vive únicamente
  // en memoria de esta pestaña — no se persiste, y dura lo que dure el token
  // de Google (~1 hora); si expira o nunca se obtuvo, la UI de subida lo
  // explica en vez de fallar en silencio (ver renderForm()).
  // Estado transitorio del formulario de onboarding (comando):
  // Lo que la persona va tecleando en "Nombre completo"/"Ruca o Fundación" — se guarda acá
  // (no solo en el <input>) para que sobreviva al re-render que dispara cambiar los selects
  // de mando/sección; si no, pisaba lo escrito con el nombre de la cuenta de Google. null =
  // todavía no tocó el campo, así que se sigue mostrando el valor por defecto.
  // "Comentarios" — botón flotante para que el comando (sobre todo el jefe de
  // Comunicaciones, que no usa Claude) deje feedback de diseño/estética sin tener
  // que escribirle a Agustín aparte. Documentos sueltos en la colección `feedback`
  // (no en `fordoc/shared`) — solo un admin los lee/gestiona.
  // globo rojo cuenta solo lo agregado DESPUÉS de esto, así desaparece al verlo en
  // vez de quedar prendido para siempre aunque ya se haya revisado.
  // Persistido en localStorage por uid (pedido del usuario, 22/09/2026: antes
  // vivía solo en memoria, así que cada vez que se volvía a entrar —recargar
  // la página, cerrar y reabrir el navegador— el globo rojo "se restauraba"
  // aunque ya se hubiera visto). Es un `localStorage` por dispositivo/navegador
  // (no sincroniza entre dispositivos, como cualquier localStorage), pero
  // sobrevive a recargas y a volver a loguearse en el mismo navegador.

  // Badge de "usuario(s) nuevo(s)" en la pestaña "Usuarios" (pedido del
  // usuario, 25/09/2026) — mismo patrón que `novedadesSeenAt` de arriba:
  // cuenta cualquier persona que se logueó por primera vez DESPUÉS de la
  // última vez que el admin abrió esta pestaña, sin importar el rol con el
  // que haya quedado (a diferencia del badge de "pendiente", que solo mira
  // el rol). Se marca como visto al abrir la pestaña (ver renderPanel()),
  // y se persiste en localStorage por uid para sobrevivir recargas.






  /* ===================== VERIFICACIÓN CONTRA EL CUADRO DE MANDOS =====================
     Cuando alguien del comando se loguea por primera vez, declara su nombre completo y
     su mando. Si ese nombre+mando coincide con la Resolución de nombramientos (MANDOS),
     se aprueba automático con el rol que le corresponde. Si no coincide (o no está en la
     resolución), queda "pendiente" para que un admin lo revise a mano — pero igual queda
     guardado lo que declaró, para que el admin no tenga que preguntarle de nuevo. */



  // Distancia de edición (Levenshtein) entre dos strings — cuántas letras
  // hay que agregar/sacar/cambiar para pasar de una a la otra. Usada solo
  // para el paso 3 de `findMandoByName` (tolerancia a typos chicos).

  // Dos palabras "se parecen" si son iguales, o si difieren en como mucho 1
  // letra (agregada/sacada/cambiada) Y ambas tienen 5 letras o más — un
  // umbral chico a propósito: tolera un typo real (ej. "Renedi" en vez de
  // "Reneidi", falta una "i") sin volverse tan laxo como para confundir dos
  // nombres cortos distintos entre sí (por eso el mínimo de 5 letras).

  // Compara el nombre declarado contra la resolución, en 3 pasos cada vez más
  // permisivos — cualquiera de los 3 exige que el resultado sea ÚNICO (si dos
  // personas distintas calzan, se descarta el match por ambiguo y queda
  // "pendiente" para que lo resuelva un admin a mano):
  // 1) Exacto (nombre completo, tal como figura en la resolución).
  // 2) Parcial: mucha gente tiene dos nombres y/o dos apellidos y se loguea
  //    con una versión más corta (ej. "Juan Osta" en vez de "Juan Pablo
  //    Osta") — se acepta si todas las palabras que escribió están, letra
  //    por letra, entre las palabras del nombre completo de la resolución
  //    (siempre que haya escrito al menos 2 palabras — una sola, como
  //    "Carloni", es muy poca información y queda afuera).
  // 3) Tolerante a un typo chico (pedido del usuario, 23/09/2026 — un
  //    capellán escribió "Renedi Kayembe" en vez de "Reneidi Kayembe", un
  //    caracter de diferencia, y no matcheaba ni con el paso 2 porque exige
  //    coincidencia exacta palabra por palabra): mismo criterio que el paso
  //    2, pero usando `wordsAreClose` en vez de igualdad estricta.


  // A partir de lo que el usuario eligió en el formulario (posGrupo + seccionOrDepto)
  // arma el "bucket declarado" a comparar contra lo que dice la resolución.


  /* ===================== AUTENTICACIÓN Y ROLES ===================== */

  // Rediseño de roles (23/09/2026, pedido del usuario): antes 'lector' cubría
  // tanto subjefes/secretarios de comando como capellanes y milicianos por
  // igual, distinguidos solo por un `tipo` aparte — ahora cada uno es su
  // propio valor de rol (mismos permisos que antes, ver `isLectorLike`), así
  // el desplegable de "Rol" de Usuarios y el de "Ver como" usan exactamente
  // el mismo vocabulario (ver VIEW_AS_ROLES).


















  // Cierra el desplegable de "Novedades" al clickear afuera (antes solo se
  // cerraba clickeando la campana de nuevo o un ítem de la lista) — un único
  // listener global, registrado una sola vez acá (no adentro de renderAuthBar,
  // que se llama en cada render y apilaría un listener nuevo cada vez).
  document.addEventListener('click', function(e){
    if(!AppState.novedadesOpen) return;
    if(e.target.closest && e.target.closest('#novedadesPanel')) return; // click adentro del propio panel
    AppState.novedadesOpen = false;
    renderAuthBar();
  });

  // En la pantalla de confirmación del widget de "Comentarios" ("¡Gracias!..."),
  // Enter cierra el globo igual que Ctrl+Enter lo mandó — ahí no hay ningún
  // input enfocado, así que el listener vive a nivel documento (una sola vez,
  // no adentro de attachFeedbackWidgetEvents, que se re-llama en cada render).
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter' || !AppState.feedbackWidgetOpen || !AppState.feedbackJustSent) return;
    var active = document.activeElement;
    if(active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return;
    var closeBtn = document.getElementById('feedbackCloseBtn');
    if(closeBtn){ e.preventDefault(); closeBtn.click(); }
  });

  // Tocar el logo del campamento (cabecera, fuera de #panel) vuelve a Inicio
  // (pedido del usuario, 25/09/2026) — listener único, el `<img>` vive en el
  // HTML estático de la página, nunca se recrea. Solo tiene sentido con
  // sesión ya iniciada y pasado el gate (nada que hacer en login/onboarding/
  // pendiente, ahí no existe todavía el concepto de "Inicio").
  document.getElementById('logoHomeBtn').onclick = function(){
    if(!AppState.currentUser || effectiveRole() === 'pendiente') return;
    AppState.novedadesOpen = false;
    AppState.activeDayId = 'HOME';
    AppState.formOpen = false;
    render();
  };

  // Toggle de tema claro/oscuro (09/10/2026) — vive en el HTML estático de
  // la cabecera (no en #authBar, que renderAuthBar() vacía por completo
  // antes del login) así funciona desde la pantalla de login/landing
  // también, no solo ya adentro de la app. Listener único; el estado real
  // (qué tema está activo) vive en el atributo `data-theme` de <html>, ya
  // seteado al cargar la página por el script inline de index.html (evita
  // el flash del tema equivocado antes de que este módulo llegue a correr).
  document.getElementById('themeToggleBtn').onclick = function(){
    // El tema "actual" lo decide la clase que ya dejó updateThemeToggleIcon()
    // al cargar (si no hay elección explícita, esa clase refleja la
    // preferencia del sistema — ver @media en css/base.css).
    var esOscuroAhora = document.documentElement.classList.contains('theme-dark-active');
    var nuevo = esOscuroAhora ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    saveTheme(nuevo);
    updateThemeToggleIcon();
  };
  updateThemeToggleIcon();

  function updateThemeToggleIcon(){
    var esOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var elegido = document.documentElement.getAttribute('data-theme');
    if(elegido === 'light'){ esOscuro = false; }
    else if(elegido === 'dark'){ esOscuro = true; }
    document.documentElement.classList.toggle('theme-dark-active', esOscuro);
    var btn = document.getElementById('themeToggleBtn');
    btn.textContent = esOscuro ? '☀️' : '🌙';
    btn.title = esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  }

  // La lectura de `AppState.publicConfig` (ver app-state.js) se espera antes
  // de enganchar `onAuthStateChanged` — así, para cuando se resuelve si hay o
  // no sesión (lo que dispara el primer render real, sacando el "Cargando…"),
  // ya se sabe si la opción "Soy miliciano" tiene que verse o no, sin un
  // flash del valor por default. Con timeout de 3s por si la lectura tarda o
  // falla — no vale la pena bloquear el login entero por esto.
  var publicConfigTimeout = new Promise(function(resolve){ setTimeout(resolve, 3000); });
  Promise.race([loadPublicConfig(), publicConfigTimeout]).then(startAuthListener);

  function startAuthListener(){
  onAuthStateChanged(auth, function(fbUser){
    if(fbUser){
      watchProfile(fbUser);
      // El cuadro de mandos (Firestore, `mandos/data`) se lee en vivo apenas
      // hay una sesión de Google válida — no esperamos a que el rol esté
      // resuelto, porque el ONBOARDING mismo necesita estos datos para el
      // auto-matcheo (ver submitOnboarding() en auth.service.js), y eso pasa
      // antes de que exista ningún perfil/rol todavía. Una sola suscripción
      // por sesión de login (igual criterio que `stateSubscribed`).
      if(!AppState.mandosSubscribed){
        AppState.mandosSubscribed = true;
        AppState.unsubMandos = loadMandos();
      }
    } else {
      AppState.currentUser = null;
      AppState.pendingFbUser = null;
      AppState.authPath = null;
      AppState.driveAccessToken = null;
      AppState.viewAsOverride = null;
      AppState.myLectorMode = false;
      AppState.authResolved = true;
      AppState.usersList = [];
      AppState.feedbackList = [];
      AppState.feedbackWidgetOpen = false;
      AppState.feedbackDraft = null;
      AppState.feedbackJustSent = false;
      if(AppState.unsubProfile){ AppState.unsubProfile(); AppState.unsubProfile = null; }
      if(AppState.unsubUsers){ AppState.unsubUsers(); AppState.unsubUsers = null; }
      if(AppState.unsubFeedback){ AppState.unsubFeedback(); AppState.unsubFeedback = null; }
      if(AppState.unsubState){ AppState.unsubState(); AppState.unsubState = null; }
      if(AppState.unsubMandos){ AppState.unsubMandos(); AppState.unsubMandos = null; }
      AppState.mandosSubscribed = false; AppState.mandosLoaded = false; AppState.mandosData = null;
      unsubAllProgress();
      unsubAllCompletions();
      AppState.secuencialCompletionsOpenId = null;
      AppState.secuencialOpenEntryId = null; AppState.secuencialStepIndex = {}; AppState.secuencialAnswerDraft = null;
      AppState.secuencialFullscreenId = null; setSecuencialFullscreenLock(false);
      stopSecuencialMusic();
      AppState.novedadesSeenAt = 0; AppState.novedadesOpen = false;
      AppState.usersSeenAt = 0; AppState.usersSeenAtLoadedForUid = null;
      AppState.usersFilterName = ''; AppState.usersFilterRole = ''; AppState.usersFilterScope = ''; AppState.usersSortField = 'fecha'; AppState.usersSortDir = 'desc'; AppState.usersActiveSubTab = 'comando';
      AppState.collapsedEntryIds = {};
      AppState.stateSubscribed = false;
      AppState.firstSnapshot = true;
      AppState.state = { days: [], entries: [] };
      AppState.activeDayId = null;
      AppState.activeMensajeDayId = null;
      render();
    }
  });
  }

  /* ===================== DATOS ===================== */



  showStatus = function(msg){
    var el = document.getElementById('statusMsg');
    if(el){ el.textContent = msg; }
  }




  /* ===================== PANTALLA DE INICIO (dashboard) ===================== */












  // (08/10/2026, ver `renderFailure()` más abajo) — `renderDayRail`/
  // `renderPanel` quedaron, acá abajo, como envoltorios finos con try/catch
  // sobre la implementación real (`*Impl`), porque bastante código fuera de
  // `render()` las llama DIRECTO (ej. el onclick de una pestaña del sidebar,
  // o cualquier handler de un botón del panel) — envolver solo `render()`
  // no alcanzaba para cubrir esos casos.
  function renderDayRailImpl(){
    var rail = document.getElementById('dayRail');
    rail.innerHTML = '';
    var homeTab = document.createElement('div');
    homeTab.className = 'day-tab home-tab' + (AppState.activeDayId === 'HOME' ? ' active' : '');
    homeTab.textContent = 'Inicio';
    homeTab.onclick = function(){ AppState.activeDayId = 'HOME'; AppState.formOpen = false; render(); };
    rail.appendChild(homeTab);
    // Los días ya no son una pestaña cada uno acá — viven todos juntos
    // adentro de "Mensaje", con un selector dinámico (ver renderMensajePanel).
    var mensajeTab = document.createElement('div');
    mensajeTab.className = 'day-tab' + (AppState.activeDayId === 'MENSAJE' ? ' active' : '');
    mensajeTab.textContent = 'Mensaje';
    mensajeTab.onclick = function(){ AppState.activeDayId = 'MENSAJE'; AppState.formOpen = false; render(); };
    rail.appendChild(mensajeTab);
    // Recursos e Info general son para todos (comando y, a futuro, milicianos) —
    // van antes de "Departamentos", que es la única pestaña comando-only del grupo.
    var recursosTab = document.createElement('div');
    recursosTab.className = 'day-tab' + (AppState.activeDayId === 'RECURSOS' ? ' active' : '');
    recursosTab.textContent = 'Recursos';
    recursosTab.onclick = function(){ AppState.activeDayId = 'RECURSOS'; AppState.formOpen = false; render(); };
    rail.appendChild(recursosTab);
    // Divisores fijos entre los 3 grupos del sidebar (camino formativo / contenido
    // general del comando / administración) — se agregan siempre, aunque algún rol
    // no vea todas las pestañas de cada grupo, para que el agrupamiento no "salte".
    var divider1 = document.createElement('div');
    divider1.className = 'day-rail-divider';
    rail.appendChild(divider1);
    // "Info general" ya no es una pestaña propia — se integró adentro de
    // "Inicio" (pedido del usuario, 22/09/2026), así lo que se vaya cargando
    // ahí aparece directo en la página de entrada. Ver renderHomePanel().
    var hasDeptosTab = canSeeDepartamentosTab();
    if(hasDeptosTab){
      var deptosTab = document.createElement('div');
      deptosTab.className = 'day-tab' + (AppState.activeDayId === 'DEPARTAMENTOS' ? ' active' : '');
      deptosTab.textContent = 'Departamentos';
      deptosTab.onclick = function(){ AppState.activeDayId = 'DEPARTAMENTOS'; AppState.formOpen = false; render(); };
      rail.appendChild(deptosTab);
    }
    // El grupo del medio hoy es solo "Departamentos" — si nadie lo ve (ej.
    // un miliciano, o "Ver como" simulando uno), ese grupo queda vacío y los
    // dos divisores quedaban pegados uno al lado del otro, sin nada en medio
    // (reporte del usuario, 27/09/2026). Con el grupo vacío alcanza con el
    // divisor de arriba (divider1) para separar el primer grupo del tercero.
    if(hasDeptosTab){
      var divider2 = document.createElement('div');
      divider2.className = 'day-rail-divider';
      rail.appendChild(divider2);
    }
    var mandosTab = document.createElement('div');
    mandosTab.className = 'day-tab mandos-tab' + (AppState.activeDayId === 'MANDOS' ? ' active' : '');
    mandosTab.textContent = 'Cuadro de mandos';
    mandosTab.onclick = function(){ AppState.activeDayId = 'MANDOS'; AppState.formOpen = false; render(); };
    rail.appendChild(mandosTab);
    if(isAdmin()){
      var usersTab = document.createElement('div');
      usersTab.className = 'day-tab mandos-tab' + (AppState.activeDayId === 'USERS' ? ' active' : '');
      usersTab.textContent = 'Usuarios';
      // "+N" = gente que se logueó por primera vez desde la última vez que se
      // abrió esta pestaña (cualquier rol) — se apaga solo al entrar (ver
      // renderPanel()). Número plano = cuántos quedaron "pendiente" ahora
      // mismo — no se apaga solo, sigue ahí hasta que se les asigne un rol.
      var newUsersCount = AppState.usersList.filter(function(u){ return (u.createdAt||0) > AppState.usersSeenAt; }).length;
      if(newUsersCount > 0){
        var newUsersBadge = document.createElement('span');
        newUsersBadge.className = 'tag imagen';
        newUsersBadge.style.marginLeft = '6px';
        newUsersBadge.title = 'Se logueó gente nueva desde la última vez que entraste acá';
        newUsersBadge.textContent = '+' + newUsersCount;
        usersTab.appendChild(newUsersBadge);
      }
      var pendUsersCount = AppState.usersList.filter(function(u){ return u.role === 'pendiente'; }).length;
      if(pendUsersCount > 0){
        var pendUsersBadge = document.createElement('span');
        pendUsersBadge.className = 'tag imagen';
        pendUsersBadge.style.marginLeft = '6px';
        pendUsersBadge.title = 'Pendiente(s) de que les asignes un rol';
        pendUsersBadge.textContent = String(pendUsersCount);
        usersTab.appendChild(pendUsersBadge);
      }
      usersTab.onclick = function(){ AppState.activeDayId = 'USERS'; AppState.formOpen = false; render(); };
      rail.appendChild(usersTab);

      var feedbackTab = document.createElement('div');
      feedbackTab.className = 'day-tab mandos-tab' + (AppState.activeDayId === 'FEEDBACK' ? ' active' : '');
      feedbackTab.textContent = 'Comentarios';
      var pendCount = AppState.feedbackList.filter(function(f){ return !f.resuelto; }).length;
      if(pendCount > 0){
        var pendBadge = document.createElement('span');
        pendBadge.className = 'tag imagen';
        pendBadge.style.marginLeft = '6px';
        pendBadge.textContent = String(pendCount);
        feedbackTab.appendChild(pendBadge);
      }
      feedbackTab.onclick = function(){ AppState.activeDayId = 'FEEDBACK'; AppState.formOpen = false; render(); };
      rail.appendChild(feedbackTab);

      // "Papelera" (pedido del usuario, 24/09/2026): cuando alguien borra una
      // entrada, desde ahora no desaparece del todo — queda guardada con
      // `deletedAt`/`deletedBy`, invisible en el resto de la app (ver
      // canSeeEntry()) pero recuperable acá.
      var papeleraTab = document.createElement('div');
      papeleraTab.className = 'day-tab mandos-tab' + (AppState.activeDayId === 'PAPELERA' ? ' active' : '');
      papeleraTab.textContent = 'Papelera';
      var papeleraCount = (AppState.state.entries || []).filter(function(e){ return !!e.deletedAt; }).length;
      if(papeleraCount > 0){
        var papeleraBadge = document.createElement('span');
        papeleraBadge.className = 'tag imagen';
        papeleraBadge.style.marginLeft = '6px';
        papeleraBadge.textContent = String(papeleraCount);
        papeleraTab.appendChild(papeleraBadge);
      }
      papeleraTab.onclick = function(){ AppState.activeDayId = 'PAPELERA'; AppState.formOpen = false; render(); };
      rail.appendChild(papeleraTab);
    }
  }
  renderDayRail = function(){
    try{ renderDayRailImpl(); }catch(err){ renderFailure(err); }
  }





  function renderPanelImpl(){
    var panel = document.getElementById('panel');
    if(AppState.activeDayId !== 'HOME'){ stopCountdownTicker(); }
    if(AppState.activeDayId === 'HOME'){
      panel.innerHTML = renderHomePanel();
      attachHomeEvents();
      // La sección de Info general vive adentro de Inicio (22/09/2026) — su
      // formulario de "Agregar contenido" reusa el mismo `attachPanelEvents`
      // que ya usan Mensaje/Recursos/Departamentos, pasándole el mismo
      // sentinel 'INFO_GENERAL' de siempre.
      attachPanelEvents('INFO_GENERAL');
      startCountdownTicker();
      return;
    }
    if(AppState.activeDayId === 'USERS'){
      if(!isAdmin()){ AppState.activeDayId = 'HOME'; renderPanel(); return; }
      panel.innerHTML = renderUsersPanel();
      attachUsersEvents();
      // Marca como "vistos" los usuarios nuevos apenas se abre esta pestaña
      // (mismo patrón que la campana de Novedades) — así el badge "+N" del
      // sidebar se apaga solo, sin necesitar un botón aparte.
      var latestUserCreatedAt = AppState.usersList.reduce(function(max, u){ return Math.max(max, u.createdAt || 0); }, 0);
      if(latestUserCreatedAt > AppState.usersSeenAt){
        AppState.usersSeenAt = Date.now();
        if(AppState.currentUser){ saveUsersSeenAt(AppState.currentUser.uid, AppState.usersSeenAt); }
      }
      return;
    }
    if(AppState.activeDayId === 'FEEDBACK'){
      if(!isAdmin()){ AppState.activeDayId = 'HOME'; renderPanel(); return; }
      panel.innerHTML = renderFeedbackPanel();
      attachFeedbackPanelEvents();
      return;
    }
    if(AppState.activeDayId === 'PAPELERA'){
      if(!isAdmin()){ AppState.activeDayId = 'HOME'; renderPanel(); return; }
      panel.innerHTML = renderPapeleraPanel();
      attachPapeleraPanelEvents();
      return;
    }
    if(AppState.activeDayId === 'MANDOS'){
      panel.innerHTML = renderMandosPanel();
      return;
    }
    if(AppState.activeDayId === 'MENSAJE'){
      renderMensajePanel();
      return;
    }
    if(AppState.activeDayId === 'RECURSOS'){
      renderRecursosPanel();
      return;
    }
    if(AppState.activeDayId === 'DEPARTAMENTOS'){
      if(!canSeeDepartamentosTab()){ AppState.activeDayId = 'HOME'; renderPanel(); return; }
      renderDepartamentosPanel();
      return;
    }
    panel.innerHTML = '';
  }
  // Transición suave al cambiar de PESTAÑA (09/10/2026) — a propósito, solo
  // cuando cambia `activeDayId` en sí, nunca en cualquier otro re-render
  // dentro de la misma pestaña (tipear un borrador, guardar, un tick de
  // Firestore, colapsar una entrada, etc. llaman a renderPanel() todo el
  // tiempo — animar en cada uno de esos sería un parpadeo molesto, no una
  // mejora). `lastPanelTabKey` recuerda qué pestaña se vio la última vez;
  // si cambió, se reinicia la animación CSS a mano (remover la clase, forzar
  // reflow, volver a agregarla) porque el navegador no reinicia una
  // @keyframes si la clase ya estaba puesta.
  var lastPanelTabKey = null;
  renderPanel = function(){
    var prevKey = lastPanelTabKey;
    try{ renderPanelImpl(); }catch(err){ renderFailure(err); return; }
    var newKey = AppState.activeDayId;
    lastPanelTabKey = newKey;
    if(newKey !== prevKey){
      var panel = document.getElementById('panel');
      panel.classList.remove('panel-fade-in');
      void panel.offsetWidth;
      panel.classList.add('panel-fade-in');
    }
    syncHashFromState();
  }

  // Routing por hash (09/10/2026, pedido del usuario): escribe la URL a
  // partir del estado actual (`activeDayId`/`activeMensajeDayId`) después de
  // CUALQUIER render del panel — es el único choke point por el que pasan
  // todos los cambios de navegación (clicks del sidebar, pills de día de
  // "Mensaje", "Ir directo a..." de Novedades, addDay/deleteDay, etc.), así
  // que alcanza con enganchar acá en vez de tocar cada handler suelto. Si el
  // hash ya coincide con el estado actual, `location.hash = x` es un no-op
  // del navegador (no dispara `hashchange` ni agrega una entrada al
  // historial) — no hace falta protegerse de un loop infinito con eso solo.
  function syncHashFromState(){
    // `activeDayId === null` significa "la navegación inicial todavía no se
    // resolvió" (antes de que `load()` lea el primer snapshot de Firestore
    // y decida dónde arrancar, ver `applyInitialNavFromHash()`) — NO es lo
    // mismo que 'HOME'. Bug real encontrado al testear esto (09/10/2026):
    // `watchUsers()`/`watchFeedback()`/`loadMandos()` pueden disparar un
    // `render()` (y por lo tanto este sync) antes de que `load()` resuelva
    // su propio snapshot — en ese instante `activeDayId` sigue en `null`, y
    // tratarlo como 'HOME' borraba el hash original de la URL (ej.
    // `#mensaje/<id>` de un F5) antes de que `applyInitialNavFromHash()`
    // llegara a leerlo. No tocar la URL en absoluto mientras siga sin
    // resolver evita pisarlo.
    if(AppState.activeDayId === null) return;
    var newHash = encodeHash(AppState.activeDayId, AppState.activeMensajeDayId);
    if((window.location.hash || '').replace(/^#/, '') !== newHash){
      window.location.hash = newHash;
    }
  }

  // Camino inverso: cuando el hash cambia por algo que NO fue este mismo
  // módulo escribiéndolo (el botón "Atrás"/"Adelante" del navegador, pegar
  // un link, editar la URL a mano) — comparar contra el estado actual antes
  // de actuar es lo que evita que esto dispare un render extra cuando el
  // cambio SÍ vino de `syncHashFromState()` de arriba (ahí el estado ya
  // coincide con el hash nuevo). Ignorado mientras no haya sesión resuelta
  // o se esté en la pantalla de "pendiente" — ahí todavía no existe el
  // concepto de "pestaña activa".
  window.addEventListener('hashchange', function(){
    if(!AppState.currentUser || effectiveRole() === 'pendiente') return;
    var target = decodeHash(window.location.hash);
    var days = AppState.state.days || [];
    var resolvedDayId = target.tab === 'MENSAJE'
      ? ((target.dayId && days.some(function(d){ return d.id === target.dayId; })) ? target.dayId : (days.length ? days[0].id : null))
      : null;
    var sameTab = AppState.activeDayId === target.tab;
    var sameDay = target.tab !== 'MENSAJE' || AppState.activeMensajeDayId === resolvedDayId;
    if(sameTab && sameDay) return;
    AppState.activeDayId = target.tab;
    if(target.tab === 'MENSAJE'){ AppState.activeMensajeDayId = resolvedDayId; }
    AppState.formOpen = false;
    render();
  });

































  // Opciones del selector "Ver como" (solo para admins reales) — mismo
  // vocabulario de roles que el desplegable "Rol" de la pestaña Usuarios
  // (pedido del usuario, 23/09/2026: "el desplegable... debe coincidir con
  // el desplegable de rol que está en la pestaña de usuarios"), salvo que acá
  // 'lector' se etiqueta "Milicianos" (más claro en el contexto de "estoy
  // simulando ver la app como...") en vez de "Miliciano" a secas.
  // "Ver como" en cascada (rol + ámbito) en vez de una sola lista plana — con
  // secciones y departamentos ya suman 10 ámbitos posibles, y va a seguir
  // creciendo, así que una lista de "Jefe de sección — X" x10 + "Subjefe — X"
  // x10 se vuelve inmanejable. Con dos selects (rol, y ámbito solo si aplica)
  // el tamaño de cada lista no pasa de ~12 opciones sin importar cuánto crezca.





  // Etiqueta legible de dónde está parado el usuario, para dar contexto
  // automático en el widget de "Comentarios" (así no hay que tipearlo a mano).
  currentPageLabel = function(){
    // Un "pendiente" (real, o el admin simulándolo con "Ver como") está
    // bloqueado en el gate de "Cuenta registrada" — nunca está de verdad
    // parado en ninguna pestaña, aunque `activeDayId` siga guardando la
    // última que se miró antes de simular ese rol (pedido del usuario,
    // 23/09/2026: el widget de Comentarios decía "Estás en: Recursos" en
    // vez de reflejar que un pendiente no tiene acceso a ninguna página).
    if(effectiveRole() === 'pendiente') return 'Pendiente de aprobación';
    if(AppState.activeDayId === 'HOME') return 'Inicio';
    if(AppState.activeDayId === 'MENSAJE'){
      var day = (AppState.state.days || []).find(function(d){ return d.id === AppState.activeMensajeDayId; });
      return day ? ('Mensaje — ' + day.label) : 'Mensaje';
    }
    if(AppState.activeDayId === 'RECURSOS') return 'Recursos';
    if(AppState.activeDayId === 'DEPARTAMENTOS') return 'Departamentos';
    if(AppState.activeDayId === 'MANDOS') return 'Cuadro de mandos';
    if(AppState.activeDayId === 'USERS') return 'Usuarios';
    if(AppState.activeDayId === 'FEEDBACK') return 'Comentarios';
    if(AppState.activeDayId === 'PAPELERA') return 'Papelera';
    return 'la página';
  }








  // Minijuego de la pantalla "Pendiente de aprobación" — pedido del usuario
  // (23/09/2026) para darle algo a hacer a quien está esperando que un
  // admin le asigne rol. "Atrapar el escudo": aparece el ícono del logo en
  // una posición al azar adentro de un cuadro, clickearlo suma un punto y
  // lo vuelve a mover; 20 segundos de juego, con "Jugar de nuevo" al final.





  // Red de seguridad (08/10/2026, reporte del usuario: la página quedaba
  // completamente en blanco después de loguearse — el header estático se
  // veía, pero el sidebar y el panel quedaban vacíos para siempre, sin
  // ningún error visible). Causa raíz encontrada: `renderGate()` ya revela
  // `.layout` (saca el sidebar/panel de su estado oculto) ANTES de que
  // `renderDayRail()`/`renderPanel()` lleguen a escribir contenido adentro —
  // si cualquiera de los dos tira una excepción (ej. un dato real en
  // Firestore con una forma que ningún caso de prueba cubrió), el sidebar y
  // el panel quedan como divs vacíos para siempre, porque ningún snapshot
  // nuevo de Firestore vuelve a disparar un reintento. Más allá de blindar
  // los puntos concretos ya encontrados (ver `normalizeState()` en
  // state.service.js), esto es el resguardo final: si CUALQUIER otra cosa
  // (conocida o no) explota acá, en vez de dejar todo en blanco se muestra un
  // mensaje visible y accionable, con el error real, para poder reportarlo.
  function renderFailure(err){
    console.error('render() falló:', err);
    try{
      var layout = document.querySelector('.layout');
      if(layout){ layout.style.display = 'none'; }
      var gate = document.getElementById('gate');
      if(gate){
        gate.innerHTML = '<div class="gate-box"><h2>Algo se rompió al cargar la página</h2>' +
          '<p>No es tu culpa — hubo un error inesperado. Probá recargar la página; si sigue pasando, ' +
          'avisale a Agustín con una captura de este mensaje.</p>' +
          '<p class="mandos-sub" style="word-break:break-word">' + (err && err.message ? err.message.replace(/</g,'&lt;') : String(err)) + '</p>' +
          '<button class="btn small" id="renderFailureReloadBtn" type="button" style="margin-top:12px">Recargar</button></div>';
        var reloadBtn = document.getElementById('renderFailureReloadBtn');
        if(reloadBtn){ reloadBtn.onclick = function(){ window.location.reload(); }; }
      }
    }catch(e2){ console.error('No se pudo ni mostrar el error:', e2); }
  }

  render = function(){
    try{
      renderAuthBar();
      renderFeedbackWidget();
      var gated = renderGate();
      if(gated) return;
      renderDayRail();
      renderPanel();
    }catch(err){
      renderFailure(err);
    }
  }

  // Resguardo adicional: un error asíncrono no atrapado (ej. una Promise sin
  // `.catch`, en cualquier parte de la app) no pasa por el try/catch de
  // render() de arriba — este listener global es el único lugar que lo
  // puede atrapar, para no dejar la página en blanco sin explicación tampoco
  // en ese caso.
  window.addEventListener('unhandledrejection', function(e){
    console.error('Promise sin manejar:', e.reason);
  });

  render();
})();
