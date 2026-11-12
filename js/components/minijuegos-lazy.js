// Carga diferida de los minijuegos (12/11/2026): el código de los ~30 juegos
// se baja recién la primera vez que alguien abre uno, no al entrar a la página.
// Para listarlos sin bajarlos están los títulos en config/minijuegos-catalogo.js.
var carga = null;
export function cargarMinijuegos(){
  if(!carga){
    carga = Promise.all([
      import('./minijuegos.js'),
      import('./minijuegos-secciones.js'),
      import('./minijuegos-deptos.js'),
      import('./minijuegos-fe.js'),
      import('./minijuegos-eventos.js')
    ]).then(function(r){ return r[0]; }).catch(function(e){ carga = null; throw e; });
  }
  return carga;
}
export function abrirMinijuego(id, opts){
  return cargarMinijuegos().then(function(m){ m.abrirMinijuego(id, opts); }).catch(function(e){
    console.error('No se pudo cargar el juego:', e);
  });
}
