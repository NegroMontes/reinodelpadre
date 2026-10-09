// Traduce el estado de navegación (`activeDayId` + `activeMensajeDayId`) a
// y desde el hash de la URL (`#mensaje/<dayId>`, `#usuarios`, etc.) — pedido
// del usuario (09/10/2026): un F5 en GitHub Pages siempre volvía a Inicio,
// porque la pestaña activa solo vivía en memoria, sin ningún reflejo en la
// URL. Funciones puras, sin acceso a `AppState` ni al DOM — quien las llama
// (`main.js`/`state.service.js`) decide cuándo leerlas/escribirlas.
//
// Hash, no un path real — GitHub Pages (y Netlify/localhost) son hosting
// estático; el routing por hash no necesita ninguna configuración de
// servidor para funcionar, a diferencia de un path real (`/mensaje/...`),
// que en GitHub Pages exigiría el truco del `404.html` como fallback.

  var TAB_TO_SLUG = {
    MENSAJE: 'mensaje',
    RECURSOS: 'recursos',
    DEPARTAMENTOS: 'departamentos',
    MANDOS: 'mandos',
    USERS: 'usuarios',
    FEEDBACK: 'comentarios',
    PAPELERA: 'papelera'
  };
  var SLUG_TO_TAB = {};
  Object.keys(TAB_TO_SLUG).forEach(function(tab){ SLUG_TO_TAB[TAB_TO_SLUG[tab]] = tab; });

  // 'HOME' (o cualquier estado todavía sin resolver, ej. antes de loguearse)
  // codifica a '' — así la URL raíz queda limpia, sin un "#inicio" de más.
  export function encodeHash(activeDayId, activeMensajeDayId){
    if(!activeDayId || activeDayId === 'HOME') return '';
    if(activeDayId === 'MENSAJE'){
      return activeMensajeDayId ? ('mensaje/' + activeMensajeDayId) : 'mensaje';
    }
    return TAB_TO_SLUG[activeDayId] || '';
  }

  // Nunca valida permisos ni que el día exista de verdad — eso lo resuelve
  // quien llama, apoyándose en los guards que ya existen en
  // `renderPanelImpl()`/`renderMensajePanel()` (si un hash apunta a una
  // pestaña admin-only sin serlo, o a un día borrado, esos mismos guards ya
  // bouncean solos a Inicio / al primer día — no hacía falta duplicar esa
  // lógica acá).
  export function decodeHash(rawHash){
    var h = (rawHash || '').replace(/^#/, '');
    if(!h) return { tab: 'HOME', dayId: null };
    var parts = h.split('/');
    var tab = SLUG_TO_TAB[parts[0]];
    if(!tab) return { tab: 'HOME', dayId: null };
    if(tab === 'MENSAJE'){ return { tab: 'MENSAJE', dayId: parts[1] || null }; }
    return { tab: tab, dayId: null };
  }
