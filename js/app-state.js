// Estado reactivo global de la aplicación — un único objeto mutable,
// compartido por import entre todos los módulos de js/. Cada función que
// antes leía/escribía una variable suelta del closure único ahora lee/
// escribe AppState.<campo> — mismo valor inicial, mismo comportamiento,
// solo cambia el binding (variable local del closure -> propiedad de un
// objeto importado). Ver "Refactor de arquitectura" en CLAUDE.md.
export const AppState = {
  state: { days: [], entries: [] },
  activeDayId: null, // 'HOME' | 'MENSAJE' | 'RECURSOS' | 'INFO_GENERAL' | 'DEPARTAMENTOS' | 'MANDOS' | 'USERS' | 'FEEDBACK'
  activeMensajeDayId: null, // qué día se está viendo adentro de la pestaña "Mensaje"
  activeDeptoFiltro: '', // filtro de pills adentro de "Departamentos" — '' = todos
  formOpen: false,
  // Toda entrada nueva es "secuencial" desde el 06/10/2026 (se sacó el
  // selector "Tipo de contenido" del form — ver renderForm()) — `formType`
  // se mantiene como variable interna (el guardado y el constructor de
  // pasos todavía la usan) pero ya nunca cambia de valor desde la interfaz.
  formType: 'secuencial',
  editingEntryId: null,
  formSecciones: [],
  formDeptos: [],
  formComandoGeneral: false,
  formSeccionComandoOnly: false,
  formAnonimo: false, // "Publicar sin firmar" — si está tildado, la entrada se guarda sin autor
  formOculta: false,
  formBienvenida: false,
  collapsedEntryIds: {},
  formAligns: { body: 'left', bodyAfter: 'left' },
  formTitleDraft: null,
  formBgMusicUrlDraft: null, // link de música de fondo (pedido del usuario, 22/09/2026)
  // Título/subtítulo de cierre personalizables (08/10/2026, puerto de
  // "Encuentros") — si se dejan en blanco, la entrada usa el texto fijo de
  // siempre ("Muchas gracias por tu atención." / "¡A tus Órdenes!").
  formClosingTitleDraft: null,
  formClosingSubDraft: null,
  formSteps: [],
  formStepsCollapsed: true,
  formMediaCollapsed: true,
  // Diálogo "Buscar en los libros" (08/10/2026, puerto del selector
  // multi-select de "Encuentros") — busca y agrega varias citas de una
  // biblioteca precargada de una sola vez, en vez de un paso "Cita de
  // libro" a la vez. `libroPickerSel` guarda claves "lib|n" (string) de los
  // puntos tildados, para no depender de un id propio de cada punto.
  libroPickerOpen: false,
  libroPickerBook: 'youcat',
  libroPickerQuery: '',
  libroPickerSel: [],
  // Insertar en una posición puntual del orden (08/10/2026, pedido del
  // usuario: un "+" flotante entre dos entradas, para poder elegir dónde
  // cae la nueva en vez de que siempre se agregue al final) — se setea al
  // clickear ese "+", se usa UNA vez al guardar (como el `createdAt` de la
  // entrada nueva, en vez de `Date.now()`) y se resetea junto con el resto
  // del borrador del form. `null` = comportamiento de siempre, se agrega al
  // final. `insertOrderNote` es el texto que se le muestra a quien está
  // cargando, para confirmar que el click funcionó.
  insertOrderCreatedAt: null,
  insertOrderNote: '',
  secuencialOpenEntryId: null, // qué entrada está expandida/en curso
  secuencialStepIndex: {}, // entryId -> índice del paso actual
  secuencialFullscreenId: null, // entryId en modo pantalla completa, o null (pedido del usuario, 22/09/2026)
  secuencialAnswerDraft: null, // { entryId, stepIdx, value }
  secuencialMusicEntryId: null,
  secuencialMusicPausedByVideo: false,
  secuencialMusicErrorId: null,
  firstSnapshot: true,
  currentUser: null, // { uid, email, displayName, role, seccion } una vez resuelto el perfil
  authResolved: false, // true en cuanto sabemos si hay o no sesión
  usersList: [], // solo se llena para admins (panel de usuarios)
  usersFilterName: '',
  usersFilterRole: '',
  usersFilterScope: '', // '' | 'seccion:X' | 'depto:Y'
  usersSortField: 'fecha', // '' | 'nombre' | 'fecha'
  usersSortDir: 'desc', // 'asc' | 'desc'
  usersActiveSubTab: 'comando', // 'comando' | 'milicianos'
  unsubProfile: null,
  unsubState: null,
  stateSubscribed: false, // para no suscribirnos a fordoc/shared hasta tener un rol autorizado
  authPath: null, // 'comando' | 'acampante' | null — elegido en la pantalla inicial, antes de loguearse
  driveAccessToken: null,
  pendingFbUser: null, // usuario de Google ya logueado pero sin perfil en Firestore todavía (necesita completar el formulario)
  obPosGrupo: 'cupula',
  obSeccionOrDepto: '',
  obSeccionFormacion: '',
  obNombreDraft: null,
  obRucaDraft: null,
  obActividadDraft: null,
  feedbackList: [], // solo se llena para admins (panel "Comentarios")
  feedbackSelectedIds: [], // checkboxes tildados en el panel "Comentarios", para acciones en lote
  feedbackHideResueltos: true, // botón "Ocultar resueltos" del panel "Comentarios" (24/09/2026) — oculto por defecto (pedido del usuario, 23/09/2026)
  feedbackWidgetOpen: false,
  feedbackDraft: null, // sobrevive al re-render del widget mientras se escribe (mismo patrón que formTitleDraft)
  feedbackJustSent: false, // true justo después de enviar, para mostrar la confirmación en vez del form
  // Botón de usuario con avatar (09/10/2026, pedido del usuario) — menú
  // desplegable (Perfil/Cerrar sesión) desde el avatar de Google en la
  // barra superior. `userProfileDraft` sobrevive al re-render mientras se
  // tipea (mismo patrón `*Draft` ya usado en toda la app).
  userMenuOpen: false,
  userMenuEditingProfile: false,
  userProfileDraft: null, // { actividadFavorita, rucaFundacion }
  novedadesOpen: false, // desplegable del campanario de "Novedades" en el header
  novedadesSeenAt: 0, // Date.now() de la última vez que se abrió la campana — el
  novedadesSeenAtLoadedForUid: null, // evita releer localStorage en cada re-fire del snapshot de perfil
  usersSeenAt: 0,
  usersSeenAtLoadedForUid: null,
  // Evita reintentar el sync de `photoURL` (ver watchProfile()) en cada
  // re-fire del snapshot de perfil dentro de la misma sesión — una sola
  // vez por uid alcanza, el próximo login ya lo trae actualizado.
  photoURLSyncedForUid: null,
  unsubUsers: null,
  unsubFeedback: null,
  myProgress: {}, // entryId -> { respuestas:{stepIdx:texto}, completedAt } | null
  progressSubs: {}, // entryId -> función de unsubscribe
  secuencialCompletionsOpenId: null,
  secuencialCompletionsCache: {}, // entryId -> 'error' | array de {displayName, completedAt}
  secuencialCompletionsSeenCount: {},
  secuencialCompletionsSubs: {}, // entryId -> función de unsubscribe
  viewAsOverride: null, // null | { role, seccion, depto }
  myLectorMode: false,
  countdownInterval: null,
  pendienteGameTimer: null,
  pendienteGameScore: 0,
  // Flag pública (26/09/2026, pedido del usuario): permite a un admin ocultar
  // "Soy miliciano" del login y "Milicianos" de "Ver como" — pensado para
  // cuando el campamento arme su propia página para milicianos y esta quede
  // exclusiva del comando por un tiempo. Se lee una sola vez al arrancar
  // (ver loadPublicConfig() en services/state.service.js), antes de que se
  // resuelva si hay o no sesión — default `true` (habilitado) si el doc
  // `config/public` todavía no existe o falla la lectura (fail-open, no es
  // una medida de seguridad real).
  publicConfig: { milicianosLoginEnabled: true },
  // Cuadro de mandos (08/10/2026) — movido de una constante estática en el
  // código a Firestore (`mandos/data`), para que el código fuente (ahora
  // también publicado en un repo público de GitHub) no cargue nombres
  // reales. `mandosData` tiene la misma forma que la vieja constante
  // `MANDOS` ({jefeCampamento, secciones, departamentos, ...}), o `null`
  // mientras no cargó/no existe el documento todavía. Se suscribe una vez
  // por sesión de login (ver loadMandos() en services/mandos.service.js),
  // igual que `fordoc/shared`.
  mandosData: null,
  mandosLoaded: false,
  mandosSubscribed: false,
  unsubMandos: null,
  // Pestaña "Comando" (antes "Cuadro de mandos", renombrada 09/10/2026) —
  // subpestañas: 'mandos' (nómina oficial de la Resolución, de siempre) y
  // 'micomando' (roster en vivo de quienes ya se registraron, con foto/
  // actividad/ruca — ver canSeeMiComandoSubtab() en services/permissions.js).
  mandosActiveSubTab: 'mandos',
};
