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
    PAPELERA: 'papelera',
    PERFIL: 'perfil'
  };
  var SLUG_TO_TAB = {};
  Object.keys(TAB_TO_SLUG).forEach(function(tab){ SLUG_TO_TAB[TAB_TO_SLUG[tab]] = tab; });

  // 'HOME' (o cualquier estado todavía sin resolver, ej. antes de loguearse)
  // codifica a '' — así la URL raíz queda limpia, sin un "#inicio" de más.
  // Sub-lugares con dirección propia (07/11/2026, pedido del usuario):
  //   recursos/<categoría>[/<grupo>]
  //   recursos/cancionero[/ver[/<canto>] | /misas | /misa/<id>]
  //   departamentos/<depto>   mandos/micomando|tablero   usuarios/milicianos
  // `nav` es AppState (o algo con los mismos campos).
  function seg(x){ return encodeURIComponent(x); }

  export function encodeHash(nav){
    var tab = nav.activeDayId;
    if(!tab || tab === 'HOME') return '';
    if(tab === 'MENSAJE'){
      return nav.activeMensajeDayId ? ('mensaje/' + seg(nav.activeMensajeDayId)) : 'mensaje';
    }
    var base = TAB_TO_SLUG[tab] || '';
    if(!base) return '';
    var parts = [base];
    if(tab === 'RECURSOS' && nav.recursosCategoria){
      parts.push(seg(nav.recursosCategoria));
      if(nav.recursosCategoria === 'cancionero'){
        var v = nav.cancioneroVista;
        if(v === 'ver'){ parts.push('ver'); if(nav.cancioneroCantoId) parts.push(seg(nav.cancioneroCantoId)); }
        else if(v === 'misa' && nav.misaId){ parts.push('misa', seg(nav.misaId)); }
        else if(v === 'misas' || v === 'misaEdit' || v === 'misa'){ parts.push('misas'); }
      } else if(nav.recursosGrupo){
        parts.push(seg(nav.recursosGrupo));
      }
    } else if(tab === 'DEPARTAMENTOS' && nav.activeDeptoFiltro){
      parts.push(seg(nav.activeDeptoFiltro));
    } else if(tab === 'MANDOS' && (nav.mandosActiveSubTab === 'micomando' || nav.mandosActiveSubTab === 'tablero')){
      parts.push(nav.mandosActiveSubTab);
    } else if(tab === 'USERS' && nav.usersActiveSubTab === 'milicianos'){
      parts.push('milicianos');
    }
    return parts.join('/');
  }

  // Nunca valida permisos ni que el día/categoría exista de verdad — eso lo
  // resuelven los guards que ya existen en cada vista (si algo no existe,
  // vuelven solos a Inicio / al primer día / a la grilla).
  export function decodeHash(rawHash){
    var h = (rawHash || '').replace(/^#/, '');
    var out = { tab: 'HOME', dayId: null, recursosCategoria: '', recursosGrupo: '', cancioneroVista: '', cancioneroCantoId: null, misaId: null, deptoFiltro: '', mandosSub: 'mandos', usersSub: 'comando' };
    if(!h) return out;
    var parts = h.split('/').map(function(p){ try{ return decodeURIComponent(p); }catch(e){ return p; } });
    if(parts[0] === 'entrada' && parts[1]){ out.entryId = parts[1]; return out; }
    var tab = SLUG_TO_TAB[parts[0]];
    if(!tab) return out;
    out.tab = tab;
    if(tab === 'MENSAJE'){ out.dayId = parts[1] || null; }
    else if(tab === 'RECURSOS' && parts[1]){
      out.recursosCategoria = parts[1];
      if(parts[1] === 'cancionero'){
        if(parts[2] === 'ver'){ out.cancioneroVista = 'ver'; out.cancioneroCantoId = parts[3] || null; }
        else if(parts[2] === 'misas'){ out.cancioneroVista = 'misas'; }
        else if(parts[2] === 'misa' && parts[3]){ out.cancioneroVista = 'misa'; out.misaId = parts[3]; }
      } else if(parts[2]){ out.recursosGrupo = parts[2]; }
    }
    else if(tab === 'DEPARTAMENTOS' && parts[1]){ out.deptoFiltro = parts[1]; }
    else if(tab === 'MANDOS' && (parts[1] === 'micomando' || parts[1] === 'tablero')){ out.mandosSub = parts[1]; }
    else if(tab === 'USERS' && parts[1] === 'milicianos'){ out.usersSub = 'milicianos'; }
    return out;
  }

  // Lleva lo leído del hash al estado (el día de Mensaje lo resuelve quien llama).
  export function applyHashNav(app, t){
    app.activeDayId = t.tab;
    app.recursosCategoria = t.recursosCategoria;
    app.recursosGrupo = t.recursosGrupo;
    app.cancioneroVista = t.cancioneroVista;
    app.cancioneroCantoId = t.cancioneroCantoId;
    if(t.misaId) app.misaId = t.misaId;
    if(app.cancioneroVista === 'misaEdit') app.cancioneroVista = 'misas';
    app.cancioneroDesdeRosario = false;
    app.activeDeptoFiltro = t.deptoFiltro;
    app.mandosActiveSubTab = t.mandosSub;
    app.usersActiveSubTab = t.usersSub;
  }
