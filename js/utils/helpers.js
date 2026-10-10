// Utilidades chicas y sin estado, reusadas en toda la app: ids, normalización
// de texto, escapado/linkify de HTML, y las tablas de etiquetas legibles
// (roleLabel, posGrupoLabel).

  export function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }


  export function normalizeName(s){
    // Bug encontrado 23/09/2026 (reporte del usuario: capellán auto-logueado
    // sin reconocer): las dos regex de prefijo ("Mil. "/"P. ") exigen que el
    // string arranque EXACTO con ese prefijo — pero el `.trim()` corría al
    // final de la cadena, así que un espacio en blanco al principio (típico
    // de un autocompletado del navegador o de escribir sin querer un espacio
    // antes) hacía que ninguna de las dos matcheara, y el "P. " quedaba sin
    // sacar — "  P. Esteban Poccioni" nunca igualaba a "esteban poccioni" del
    // índice. Se movió el primer `.trim()` ANTES de las regex de prefijo.
    // De paso, se hizo el prefijo "P." un poco más tolerante (acepta un
    // espacio de más antes del punto, ej. "P .Nombre") por el mismo motivo.
    return (s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca acentos
      .toLowerCase()
      .trim()
      .replace(/^mil\.\s*/, '')
      .replace(/^p\s*\.\s*/, '') // capellanes: "P. Esteban Poccioni" -> "esteban poccioni"
      .replace(/\s+/g, ' ')
      .trim();
  }


  // Ícono por "actividad favorita" (09/10/2026, cuarto pedido de mejora
  // visual) — pensado explícitamente como primer paso hacia el sistema de
  // puntos/gamificación por comando que sigue en el backlog ("logo
  // específico según la actividad favorita de cada uno", ver sección del
  // doc de specs en CLAUDE.md). Matching por palabra clave sobre el texto
  // libre que la persona cargó en el onboarding — lista acotada, no
  // exhaustiva; cualquier respuesta que no matchee cae al ícono genérico
  // (⭐) en vez de no mostrar nada, así "cargaste una actividad" siempre se
  // nota aunque no se haya anticipado esa palabra puntual.
  var ACTIVITY_ICONS = [
    { k: ['futbol'], icon: '⚽' },
    { k: ['voley', 'voleibol'], icon: '🏐' },
    { k: ['basquet', 'basket'], icon: '🏀' },
    { k: ['rugby'], icon: '🏉' },
    { k: ['truco', 'cartas', 'naipes', 'juegos de mesa'], icon: '🃏' },
    { k: ['ajedrez'], icon: '♟' },
    { k: ['cocinar', 'cocina', 'asado', 'cocinero'], icon: '🍳' },
    { k: ['picada'], icon: '🧀' },
    { k: ['fogon', 'fuego'], icon: '🔥' },
    { k: ['charla'], icon: '🗨️' },
    { k: ['leer', 'lectura', 'libro'], icon: '📖' },
    { k: ['cantar', 'canto', 'musica', 'guitarra', 'banda'], icon: '🎵' },
    { k: ['pescar', 'pesca'], icon: '🎣' },
    { k: ['bici', 'bicicleta', 'ciclismo'], icon: '🚴' },
    { k: ['cabalgata', 'caballo', 'equitacion'], icon: '🐴' },
    { k: ['fortin', 'ataque', 'batalla'], icon: '⚔️' },
    { k: ['nadar', 'natacion', 'pileta', 'piscina'], icon: '🏊' },
    { k: ['dibujar', 'dibujo', 'pintar', 'pintura', 'arte'], icon: '🎨' },
    { k: ['teatro', 'actuar'], icon: '🎭' },
    { k: ['danza', 'baile', 'bailar'], icon: '💃' },
    { k: ['trekking', 'caminata', 'montanismo', 'senderismo', 'marcha'], icon: '🥾' },
    { k: ['acampar', 'campamento', 'carpa'], icon: '⛺' },
    { k: ['rezar', 'orar', 'oracion', 'capilla', 'adoracion'], icon: '🙏' },
    { k: ['dormir', 'siesta'], icon: '😴' },
    { k: ['foto', 'camara'], icon: '📷' },
    { k: ['programar', 'computacion', 'tecnologia', 'videojuego'], icon: '💻' },
    { k: ['manualidades', 'artesania', 'tejer', 'coser'], icon: '✂️' },
    { k: ['estudiar', 'estudio'], icon: '📚' },
    { k: ['amig'], icon: '🗣️' }
  ];
  export function activityIcon(actividadFavorita){
    if(!actividadFavorita) return '';
    // normalizeName() ya hace exactamente lo que hace falta acá (sacar
    // acentos, pasar a minúsculas, recortar espacios) aunque esté pensada
    // para nombres de personas — reusarla evita duplicar esa lógica.
    var norm = normalizeName(actividadFavorita);
    // "Vertientes" — imagen real de la bandera argentina, no el emoji de
    // bandera (10/10/2026, reporte del usuario: en su dispositivo, 🇦🇷 — una
    // secuencia Unicode de dos "regional indicators" — cae a mostrarse como
    // el texto plano "AR" en vez de componerse como una imagen de bandera,
    // una limitación conocida de fuente/plataforma. Un asset real (mismo
    // criterio ya usado para los escudos de sección en badge-icons.js) se
    // ve igual en cualquier lado, sin depender de soporte de emoji.
    if(norm.indexOf('vertientes') !== -1){
      return '<img class="activity-flag-icon" src="assets/bandera-argentina.svg" alt="Argentina" style="width:16px;height:12px;object-fit:cover;border-radius:2px;vertical-align:middle;display:inline-block;">';
    }
    for(var i = 0; i < ACTIVITY_ICONS.length; i++){
      var group = ACTIVITY_ICONS[i];
      for(var j = 0; j < group.k.length; j++){
        if(norm.indexOf(group.k[j]) !== -1) return group.icon;
      }
    }
    return '⭐';
  }


  export function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }


  export function linkify(text){
    var escaped = escapeHtml(text);
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    // Negrita/cursiva estilo markdown liviano (26/09/2026, unificación con la
    // herramienta "Encuentros") — se aplica después de escapar/linkear, así
    // que es seguro sobre texto de usuario: los asteriscos literales nunca
    // fueron escapados por escapeHtml, y **negrita** se consume entero antes
    // de buscar *cursiva* (si no, "**x**" matchearía primero como cursiva).
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return escaped;
  }


  export function alignStyleAttr(align){
    if(!align || align === 'left') return '';
    return ' style="text-align:' + escapeHtml(align) + '"';
  }


  export function roleLabel(role){
    return {
      admin:'Admin',
      jefe_seccion:'Jefe de sección/depto',
      subjefe:'Subjefe de sección/depto',
      consagrado:'Consagrado',
      lector:'Miliciano',
      pendiente:'Pendiente de aprobación'
    }[role] || role;
  }


  export function posGrupoLabel(posGrupo){
    return {
      cupula: 'Comando central',
      jefe_seccion: 'Jefe de sección',
      staff_seccion: 'Secretario o subjefe de sección',
      jefe_depto: 'Jefe de departamento',
      staff_depto: 'Subjefe de departamento',
      cocina: 'Comando de cocina',
      // Renombrado de "Capellán" a "Consagrado" (pedido del usuario,
      // 23/09/2026) — el value interno sigue siendo 'capellan' (no hacía
      // falta tocarlo, es solo una etiqueta) para no rehacer el matching.
      capellan: 'Consagrado'
    }[posGrupo] || posGrupo;
  }
