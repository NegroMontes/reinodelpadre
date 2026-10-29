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

  export var CAMP_DURATION_DAYS = 8;

  // Ícono por departamento (09/10/2026, pedido del usuario) — pensado para
  // el badge chico del avatar de usuario (ver header.js). Quien tiene un
  // depto puede elegir, desde "Perfil", entre este ícono propio o el glifo
  // genérico de FASTA. Ligado a la función real de cada departamento (no
  // arbitrario — pedido del usuario, 09/10/2026, mismo día: "Intendencia
  // podría tener un martillo, Administración dinero"): Administración
  // 📋→💰 e Intendencia 🍲→🔨 se corrigieron ese mismo día para reflejar
  // mejor su tarea real (dinero/facturas, construcción/materiales) — los
  // otros 4 ya encajaban (Formación=libro, Logística=caja, Comunicaciones=
  // altavoz, Actividades=juegos) y no se tocaron.
  export var DEPARTAMENTO_ICONS = {
    'Formación': '📖',
    'Logística': '📦',
    'Comunicaciones': '📣',
    'Administración': '💰',
    'Intendencia': '🔨',
    'Actividades': '🎯'
  };

  // Ícono propio para el rol "Consagrado" (09/10/2026, mismo pedido de
  // arriba) — antes mostraba siempre el escudo de su sección (como
  // cualquier jefe/subjefe de esa sección), sin nada que lo distinguiera
  // como consagrado. Opt-in desde "Perfil" (ver CONSAGRADO_ICONS más abajo):
  // por default sigue mostrando el escudo de su sección (compatibilidad
  // hacia atrás, nada cambia para quien no elige nada), pero puede optar
  // por un ícono que lo identifique como consagrado en su lugar.
  export var CONSAGRADO_ICONS = [
    { value:'cruz', emoji:'✝️', label:'Cruz' },
    { value:'pan', emoji:'🍞', label:'Pan' }
  ];

  // Ícono del badge para quien no tiene sección NI departamento (admin /
  // comando central) — 09/10/2026, pedido del usuario ("Yo no tengo ninguno
  // jajajaj"). Primera versión: una lista chica de emoji heráldicos sueltos
  // (corona/escudo/estrella/medalla/cruz/torre/águila/tridente), sin ligar a
  // nada real del campamento. El usuario probó esa lista y pidió algo más
  // acotado, el mismo día: "Me gusta solamente el escudo, dame a elegir
  // solamente entre los iconos de las secciones y departamentos (o
  // consagrados)" — así que se reemplazó por un menú agrupado que reusa los
  // mismos escudos/íconos ya existentes de sección (ver `sectionShieldHtml`),
  // departamento (`DEPARTAMENTO_ICONS`) y consagrado (`CONSAGRADO_ICONS`),
  // más "Cocina" (que faltaba del todo — ver `COCINA_ICON` abajo). Se guarda
  // como un string con prefijo (`seccion:Escuderos`, `depto:Logística`,
  // `consagrado:cruz`, `cocina`) en vez de un id plano — ver
  // `cupulaIconBadgeHtml()`/`cupulaIconOptionsHtml()`/`isValidCupulaIconValue()`
  // en `utils/badge-icons.js`, que arman el HTML y validan contra estos
  // mismos datos en vez de mantener una lista aparte.
  export var COCINA_ICON = '🍲';

  // Mapeos a íconos VECTORIALES (Lucide, ver utils/icons.js), para el badge
  // redondo del avatar (19/10/2026, pedido del usuario: "mismo estilo los
  // dos, vector monocromático, sin emoji") — los emoji de arriba
  // (DEPARTAMENTO_ICONS/CONSAGRADO_ICONS/COCINA_ICON) siguen existiendo
  // porque los <option> de un <select> no pueden dibujar un <svg>, así que
  // siguen usándose ahí (ver cupulaIconOptionsHtml() en utils/badge-icons.js);
  // estos mapeos solo se usan para lo que se dibuja en el círculo del badge.
  export var DEPARTAMENTO_SVG_ICON = {
    'Formación': 'book-open',
    'Logística': 'package',
    'Comunicaciones': 'megaphone',
    'Administración': 'wallet',
    'Intendencia': 'hammer',
    'Actividades': 'target'
  };
  export var CONSAGRADO_SVG_ICON = { cruz: 'cross', pan: 'wheat' };
  export var COCINA_SVG_ICON = 'soup';

  export var VIEW_AS_ROLES = [
    { value: '', label: 'Yo (Admin)' },
    { value: 'jefe_seccion', label: 'Jefe de sección/depto' },
    { value: 'subjefe', label: 'Subjefe de sección/depto' },
    { value: 'consagrado', label: 'Consagrado' },
    { value: 'lector', label: 'Milicianos' },
    { value: 'pendiente', label: 'Pendiente de aprobación' }
  ];

  // Link público de "la fordoquera" (la otra herramienta del usuario,
  // Encuentros — ver CLAUDE.md "Convención nueva — 'actualizar fordoquera'")
  // — pedido del usuario, 09/10/2026: "no todos los jefes tienen el link a
  // mano", así que se agregó un botón que abre esto directo desde el botón
  // de "Importar desde la fordoquera...".
  // Categorías de Recursos (27/10/2026): grilla de categorías arriba y,
  // al entrar a una, la lista de sus entradas — en vez de un scroll infinito.
  // Una entrada sin `categoria` cae en "Otros" (o en "Para empezar" si es la
  // de bienvenida), ver recursoCategoriaDe() en views/mensaje.js.
  export var RECURSO_CATEGORIAS = [
    { id: 'inicio', label: 'Para empezar', icon: 'house' },
    { id: 'formacion', label: 'Camino formativo', icon: 'compass' },
    // "Vida espiritual" (29/10/2026, antes "Citas bíblicas": mismo id).
    // `parent`: subcategoría — no sale en la grilla, se abre desde adentro
    // de su categoría madre.
    { id: 'biblia', label: 'Vida espiritual', icon: 'book-open' },
    { id: 'oraciones', label: 'Oraciones', icon: 'praying-hands', parent: 'biblia' },
    { id: 'rosario', label: 'Santo Rosario', icon: 'rosary', parent: 'biblia' },
    { id: 'textos', label: 'Milicia y lectura', icon: 'library-boina' },
    { id: 'instructivos', label: 'Instructivos y guías', icon: 'clipboard-list' },
    { id: 'otros', label: 'Otros', icon: 'folder' }
  ];

  export var FORDOQUERA_URL = 'https://negromontes.github.io/fordoquera/';

  // Versión de la app, solo para admins (19/10/2026, pedido del usuario) —
  // número discreto en el menú del avatar que, al click, abre el historial
  // de abajo (CHANGELOG). `version-check.service.js` vuelve a bajar ESTE
  // MISMO archivo cada tanto (fetch con cache-busting) y compara el valor
  // acá adentro contra el que ya tiene cargado la pestaña — si difieren,
  // avisa con un toast (significa que alguien pusheó una versión nueva
  // mientras la página seguía abierta). Bump a mano en cada cambio grande
  // — fecha + un contador chico si hay más de un cambio el mismo día.
  export var APP_VERSION = '2026.10.29.7';

  // Historial para el comando, en español simple — NO es el changelog
  // técnico interno (eso vive en CLAUDE_HISTORY.md, con nombres de archivo/
  // bugs/decisiones de implementación, no pensado para que lo lea nadie
  // fuera de una sesión de Code). Curado a mano, introducido el mismo
  // día que `APP_VERSION` — lista corta, van quedando las últimas
  // novedades, más viejo abajo.
  export var CHANGELOG = [
    { version: '2026.10.29.3', date: '29/10/2026', items: [
      'Si se vuelve a importar un libro, todo el comando ve la versión nueva la próxima vez que abre una entrada.'
    ]},
    { version: '2026.10.29.5', date: '29/10/2026', items: [
      'Recursos: dentro de cada categoría se pueden crear grupos («+ Agregar grupo»). Para meter una entrada en un grupo, arrastrala encima (o elegí el grupo al editarla).'
    ]},
    { version: '2026.10.29.6', date: '29/10/2026', items: [
      'Recursos: «Citas bíblicas» pasó a llamarse «Vida espiritual», y adentro están Oraciones y Santo Rosario.'
    ]},
    { version: '2026.10.29.7', date: '29/10/2026', items: [
      'Recursos: «Textos y lecturas» pasó a llamarse «Milicia y lectura».'
    ]},
    { version: '2026.10.29.4', date: '29/10/2026', items: [
      'Info general ya no tiene entradas: queda solo el recuadro editable de Inicio.'
    ]},
    { version: '2026.10.29.3', date: '29/10/2026', items: [
      'Info general ahora se ve directo en Inicio: lugar, mapa, fecha, fotos y qué llevar. Logística y Secretaría lo editan con «Editar».'
    ]},
    { version: '2026.10.29.2', date: '29/10/2026', items: [
      '«Importar libros de la Fordoquera» (menú del usuario, solo admin) abre la Fordoquera para elegir libros de tu biblioteca (cuando la Fordoquera lo permita); si no, se puede elegir el archivo .json.'
    ]},
    { version: '2026.10.29.1', date: '29/10/2026', items: [
      'El botón para importar libros a la Fordoquera pasó al menú del usuario (solo admin).'
    ]},
    { version: '2026.10.28.2', date: '28/10/2026', items: [
      '«📥 Importar de la Fordoquera» abre la Fordoquera para elegir varios espacios (cuando la Fordoquera lo permita); «📦 Importar archivos .html» sigue abriendo los archivos.'
    ]},
    { version: '2026.10.28.1', date: '28/10/2026', items: [
      'Al agregar una entrada, «📥 Importar de la Fordoquera» permite subir varios archivos .html de una vez: cada uno se vuelve una entrada.'
    ]},
    { version: '2026.10.27.3', date: '27/10/2026', items: [
      'Recursos ahora se ordena por categorías (Oraciones, Santo Rosario, Citas bíblicas…): tocá una para ver sus entradas.'
    ]},
    { version: '2026.10.27.2', date: '27/10/2026', items: [
      'Quien puede editar entradas ahora puede ordenarlas arrastrándolas (manija ⋮⋮ en cada tarjeta).'
    ]},
    { version: '2026.10.27.1', date: '27/10/2026', items: [
      'La página carga más rápido: guarda una copia del contenido en el dispositivo.',
      'Quién completó cada entrada se actualiza solo, también al volver a la app.',
      'Recorrer una entrada ya no descarga los libros enteros (abre mucho más rápido).'
    ]},
    { version: '2026.10.19.1', date: '19/10/2026', items: [
      'Pulido visual de Recursos, Usuarios, el formulario de agregar entrada y el menú de usuario.',
      'Editor del día: selector de fecha, botón para eliminar, cita con altura automática, vista previa.',
      'La app ya se puede instalar como aplicación en el celular (íconos sin fondo blanco).',
      'Íconos de departamento/consagrado en el avatar, ahora vectoriales en vez de emoji.',
      'Número de versión y este historial, solo visibles para administradores.'
    ] }
  ];

// El cuadro de mandos (nombres reales) ya NO vive en este archivo — se
// movió a Firestore (colección `mandos`, documento `data`) para que el
// código fuente (que ahora se publica también en un repo público de
// GitHub, ver "Publicar en GitHub" en CLAUDE.md) no cargue ningún dato
// sensible. Ver `services/mandos.service.js` (lectura en vivo) y
// `AppState.mandosData` (dónde vive en memoria).
