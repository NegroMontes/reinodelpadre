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
  export var FORDOQUERA_URL = 'https://negromontes.github.io/fordoquera/';

// El cuadro de mandos (nombres reales) ya NO vive en este archivo — se
// movió a Firestore (colección `mandos`, documento `data`) para que el
// código fuente (que ahora se publica también en un repo público de
// GitHub, ver "Publicar en GitHub" en CLAUDE.md) no cargue ningún dato
// sensible. Ver `services/mandos.service.js` (lectura en vivo) y
// `AppState.mandosData` (dónde vive en memoria).
