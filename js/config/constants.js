  // Primer admin del sistema: se auto-asigna rol admin la primera vez que
  // este mail inicia sesión. Los demás admins los agrega un admin ya
  // existente desde la pestaña "Usuarios".
  export var BOOTSTRAP_ADMIN_EMAIL = '';
  export var SECCIONES = ['Escuderos', 'Templarios Menores', 'Templarios Intermedios', 'Templarios Mayores'];

  export var UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // tope del lado del cliente, nada que ver con ninguna cuota de Firebase

  export var DEPARTAMENTOS = ['Formación', 'Logística', 'Comunicaciones', 'Administración', 'Intendencia', 'Actividades'];
  // "Novedades": en vez de notificaciones push reales (Service Worker + Web
  // Push — se descartó por ser mucho más grande de lo que hacía falta), un
  // campanario simple que avisa de contenido agregado en los últimos N días.
  export var NOVEDADES_WINDOW_DAYS = 3;

  export var ALIGN_OPTIONS = [['left','Izq'],['center','Centro'],['right','Der'],['justify','Justif']];

  export var CAMP_DURATION_DAYS = 8;

  export var STEP_TYPE_LABELS = { texto:'Texto', video:'Video', imagen:'Imagen', audio:'Audio', pdf:'PDF', enlace:'Enlace', libro:'Cita de libro', pregunta:'Pregunta', proposito:'Propósito personal', grupo:'Grupo' };

  // Paleta visual del constructor de pasos (08/10/2026) — puerto de la
  // paleta de "Encuentros" (constante `TYPES`, con `label`/`desc` por tipo):
  // antes era una fila de botones de puro texto ("+ Texto", "+ Video"...),
  // ahora cada tipo se ve como una tarjeta con ícono + descripción corta, que
  // ayuda a elegir sin tener que adivinar qué hace cada uno. El orden define
  // el orden de las tarjetas en pantalla.
  export var STEP_PALETTE = [
    { type:'texto', icon:'📝', desc:'Un bloque de texto corrido — introducción, explicación o cierre.' },
    { type:'pregunta', icon:'❓', desc:'Una pregunta para reflexionar, con opciones de respuesta o texto libre (opcional).' },
    { type:'proposito', icon:'✍️', desc:'Un cuadro para que cada persona escriba su propio propósito personal.' },
    { type:'imagen', icon:'🖼️', desc:'Una imagen, con texto opcional antes y después.' },
    { type:'video', icon:'🎬', desc:'Un video (YouTube, Vimeo o Drive), con texto opcional antes y después.' },
    { type:'audio', icon:'🎵', desc:'Un archivo de audio, con texto opcional antes y después.' },
    { type:'pdf', icon:'📄', desc:'Un PDF embebido, con texto opcional antes y después.' },
    { type:'enlace', icon:'🔗', desc:'Un link a cualquier otro recurso.' },
    { type:'libro', icon:'📖', desc:'Una cita de una biblioteca precargada (YouCat, DOCAT...) o de un libro propio.' },
    { type:'grupo', icon:'🗂️', desc:'Agrupa los pasos siguientes bajo un título — se pueden mostrar/ocultar juntos.' }
  ];

  // ===== Citas de libro (26/09/2026) =====
  // Unificación con la herramienta "Encuentros": cualquier paso/entrada puede
  // citar un punto de una biblioteca precargada (YouCat, DOCAT, Compendio de
  // la Doctrina Social de la Iglesia, una encíclica, o YOUCAT Confirmación)
  // sin tener que transcribirlo a mano — o pegar una cita de un libro propio
  // ("Personalizado"), que es la vía general para sumar cualquier otra
  // bibliografía (Cautivante, Salvaje de corazón, Enséñame a ser hombre,
  // Instructivo del Estilo, etc.) sin precargar su texto completo (pedido
  // explícito del usuario: "no le des los libros, pero si deja la opcion de
  // agregarlos"). Los datos en sí viven en data/libro-<id>.json (cargados de
  // forma perezosa, ver ensureLibroLoaded() en components/entry.js).
  export var LIBROS_META = {
    youcat: { id:'youcat', titulo:'YOUCAT', color:'#f2c21b', file:'data/libro-youcat.json' },
    docat: { id:'docat', titulo:'DOCAT', color:'#e0522d', file:'data/libro-docat.json' },
    compendio: { id:'compendio', titulo:'Compendio DSI', color:'#8a5a12', file:'data/libro-compendio.json' },
    // El `titulo` de acá es el que se ve en selects/pestañas del picker —
    // antes decía genérico "Encíclica" aunque el documento real cargado ya
    // es "Magnifica Humanitas" (ver `data/libro-enciclica.json`, campo
    // `titulo` — ese sí siempre tuvo el nombre real, se usa en el badge de
    // cada cita). Renombrado (08/10/2026, pedido del usuario) para que
    // coincida en todos lados.
    enciclica: { id:'enciclica', titulo:'Magnifica Humanitas', color:'#a3324f', file:'data/libro-enciclica.json' },
    yconfirmacion: { id:'yconfirmacion', titulo:'YOUCAT Confirmación', color:'#1f8a6f', file:'data/libro-yconfirmacion.json' }
  };
  export var LIBROS_ORDER = ['youcat', 'docat', 'compendio', 'enciclica', 'yconfirmacion'];

  export var VIEW_AS_ROLES = [
    { value: '', label: 'Yo (Admin)' },
    { value: 'jefe_seccion', label: 'Jefe de sección/depto' },
    { value: 'subjefe', label: 'Subjefe de sección/depto' },
    { value: 'consagrado', label: 'Consagrado' },
    { value: 'lector', label: 'Milicianos' },
    { value: 'pendiente', label: 'Pendiente de aprobación' }
  ];

// El cuadro de mandos (nombres reales) ya NO vive en este archivo — se
// movió a Firestore (colección `mandos`, documento `data`) para que el
// código fuente (que ahora se publica también en un repo público de
// GitHub, ver "Publicar en GitHub" en CLAUDE.md) no cargue ningún dato
// sensible. Ver `services/mandos.service.js` (lectura en vivo) y
// `AppState.mandosData` (dónde vive en memoria).
