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
