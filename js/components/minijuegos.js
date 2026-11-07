// T10 — Motor de minijuegos (07/11/2026). Cada juego es una función
// (host, fin) que dibuja adentro de `host` y llama a fin(true|false) al
// terminar; devuelve una función de limpieza (timers). Se abren en un
// overlay propio (`abrirMinijuego()`), sin librerías ni canvas.
import { escapeHtml } from '../utils/helpers.js';

export var MINIJUEGOS = {
  fogata:      { titulo: 'La fogata de la guardia', ayuda: 'Echá leña para que el fuego quede en la zona verde. Si se apaga o se desborda, se pierde. Aguantá 20 segundos en la zona.' },
  radio:       { titulo: 'Sintonizar la transmisión', ayuda: 'Mové el dial hasta que la señal quede al máximo y descifrá la palabra en morse.' },
  estacas:     { titulo: 'El clavado de estacas', ayuda: 'El viento afloja las estacas de la carpa. Tocá cada estaca que se levanta antes de que se suelte. Aguantá 30 segundos sin perder 3.' },
  proveeduria: { titulo: 'Tetris de proveeduría', ayuda: 'Acomodá toda la carga en el baúl. Elegí una pieza, girala si hace falta y tocá la casilla donde va su esquina de arriba a la izquierda. Tocá una pieza puesta para sacarla.' },
  cuentas:     { titulo: 'Cuadre de cuentas', ayuda: 'Elegí cuánto queda en la caja después de cada movimiento. Acertá 4 de 5 antes de que se acabe el tiempo.' },
  red:         { titulo: 'Sintonizar la red', ayuda: 'Memorizá las frecuencias. Después uní de a dos las radios que transmiten en la misma.' },
  trivia15:    { titulo: 'El camino de Lucas 15', ayuda: 'Preguntas rápidas sobre el capítulo 15 de Lucas. Acertá 5 de 7.' },
  linterna:    { titulo: 'Guardia nocturna', ayuda: 'Está todo oscuro. Mové la linterna y tocá las 5 cosas escondidas.' },
  zanjas:      { titulo: 'Zanjas de desagüe', ayuda: '¡Llueve! Tocá los charcos para cavar la zanja antes de que el agua llegue a las carpas. Aguantá 25 segundos sin inundar 2.' }
};

var abierto = null;

export function abrirMinijuego(id, opts){
  opts = opts || {};
  var def = MINIJUEGOS[id];
  if(!def || abierto) return;
  var ov = document.createElement('div');
  ov.className = 'mj-overlay' + (id === 'linterna' ? ' mj-oscuro' : '');
  ov.innerHTML = '<div class="mj-box" role="dialog" aria-modal="true" aria-label="' + escapeHtml(def.titulo) + '">' +
    '<div class="mj-head"><strong>' + escapeHtml(opts.titulo || def.titulo) + '</strong><button type="button" class="mj-close" aria-label="Cerrar">✕</button></div>' +
    '<p class="mj-ayuda">' + escapeHtml(def.ayuda) + '</p>' +
    '<div class="mj-juego"></div>' +
    '<div class="mj-pie"><button type="button" class="btn small" data-mj="empezar">Empezar</button></div></div>';
  document.body.appendChild(ov);
  var host = ov.querySelector('.mj-juego'), pie = ov.querySelector('.mj-pie');
  var limpiar = null;
  abierto = ov;
  function cerrar(){
    if(limpiar) limpiar();
    ov.remove(); abierto = null;
    document.removeEventListener('keydown', onKey);
    if(opts.alCerrar) opts.alCerrar();
  }
  function onKey(ev){ if(ev.key === 'Escape') cerrar(); }
  document.addEventListener('keydown', onKey);
  ov.querySelector('.mj-close').onclick = cerrar;
  function empezar(){
    if(limpiar) limpiar();
    host.innerHTML = ''; pie.innerHTML = '';
    limpiar = JUEGOS[id](host, function(gano){
      if(limpiar){ limpiar(); limpiar = null; }
      var extra = gano && opts.alGanar ? opts.alGanar() : '';
      pie.innerHTML = '<p class="mj-resultado ' + (gano ? 'mj-gano' : 'mj-perdio') + '">' +
        (gano ? '¡Lo lograste!' : 'Esta vez no salió.') + (extra ? ' ' + escapeHtml(extra) : '') + '</p>' +
        (gano ? '<button type="button" class="btn small" data-mj="cerrar">Seguir</button>' : '<button type="button" class="btn small" data-mj="empezar">Reintentar</button> <button type="button" class="btn small neutral" data-mj="cerrar">Cerrar</button>');
      bindPie();
    });
  }
  function bindPie(){
    pie.querySelectorAll('[data-mj]').forEach(function(b){
      b.onclick = b.getAttribute('data-mj') === 'empezar' ? empezar : cerrar;
    });
  }
  bindPie();
}

function rnd(a, b){ return a + Math.random() * (b - a); }
function rndInt(a, b){ return Math.floor(rnd(a, b + 1)); }
function barajar(arr){ arr = arr.slice(); for(var i = arr.length - 1; i > 0; i--){ var j = rndInt(0, i); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

var JUEGOS = {};

// ---------- Fogata ----------
JUEGOS.fogata = function(host, fin){
  var nivel = 50, enZona = 0, META = 20, viento = 0, terminado = false, t0 = Date.now();
  host.innerHTML = '<div class="mj-fogata"><div class="mj-llama">🔥</div>' +
    '<div class="mj-barra"><div class="mj-barra-zona" style="left:45%;width:25%"></div><div class="mj-barra-nivel"></div></div>' +
    '<div class="mj-info"></div><button type="button" class="btn" data-leña>🪵 Echar leña</button></div>';
  var llama = host.querySelector('.mj-llama'), nivelEl = host.querySelector('.mj-barra-nivel'), info = host.querySelector('.mj-info');
  // Cada tronco suma distinto (troncos más secos o más verdes): no alcanza con un ritmo fijo.
  host.querySelector('[data-leña]').onclick = function(){ nivel = Math.min(100, nivel + rnd(9, 19)); pintar(); };
  function pintar(){
    nivelEl.style.width = nivel + '%';
    llama.style.transform = 'scale(' + (0.4 + nivel / 70) + ')';
    llama.style.opacity = nivel < 15 ? .4 : 1;
    info.textContent = 'En la zona: ' + Math.floor(enZona) + ' / ' + META + ' s' + (viento > 0.5 ? ' · ¡viento!' : '');
  }
  var t = setInterval(function(){
    if(terminado) return;
    var seg = (Date.now() - t0) / 1000;
    if(Math.random() < 0.05) viento = rnd(0.6, 1.6) + seg / 25;
    viento = Math.max(0, viento - 0.012);
    nivel -= 1.4 + seg / 30 + viento * 1.6;
    if(nivel >= 45 && nivel <= 70) enZona += 0.1;
    pintar();
    if(nivel <= 0 || nivel >= 100){ terminado = true; fin(false); }
    else if(enZona >= META){ terminado = true; fin(true); }
  }, 100);
  pintar();
  return function(){ clearInterval(t); };
};

// ---------- Radio (dial + morse) ----------
var MORSE = { A:'.-', B:'-...', C:'-.-.', D:'-..', E:'.', F:'..-.', G:'--.', H:'....', I:'..', J:'.---', L:'.-..', M:'--', N:'-.', O:'---', P:'.--.', R:'.-.', S:'...', T:'-', U:'..-', V:'...-', Z:'--..' };
var PALABRAS_RADIO = ['HIJO', 'PADRE', 'REINO', 'CASA', 'PAN', 'FUEGO', 'CRUZ', 'GUIA'];
JUEGOS.radio = function(host, fin){
  var meta = rndInt(880, 1080) / 10, palabra = PALABRAS_RADIO[rndInt(0, PALABRAS_RADIO.length - 1)], fijo = 0, fase = 1;
  host.innerHTML = '<div class="mj-radio"><div class="mj-radio-frec">88.0 MHz</div>' +
    '<div class="mj-barra"><div class="mj-barra-nivel"></div></div><div class="mj-info">Buscá la señal…</div>' +
    '<input type="range" min="880" max="1080" step="1" value="880" class="mj-dial" aria-label="Dial"></div>';
  var frec = host.querySelector('.mj-radio-frec'), barra = host.querySelector('.mj-barra-nivel'), info = host.querySelector('.mj-info'), dial = host.querySelector('.mj-dial');
  dial.value = rndInt(880, 1080);
  function señal(){ var d = Math.abs(dial.value / 10 - meta); return Math.max(0, 100 - d * 9); }
  function pintar(){ var s = señal(); frec.textContent = (dial.value / 10).toFixed(1) + ' MHz'; barra.style.width = s + '%'; info.textContent = s > 96 ? '¡Señal clara! Mantenela…' : (s > 60 ? 'Se oye algo…' : 'Ruido…'); }
  dial.oninput = pintar; pintar();
  var t = setInterval(function(){
    if(fase !== 1) return;
    fijo = señal() > 96 ? fijo + 0.1 : 0;
    if(fijo >= 1.2){ fase = 2; mostrarMorse(); }
  }, 100);
  function mostrarMorse(){
    var letras = palabra.split('');
    var leyenda = Object.keys(MORSE).filter(function(l){ return letras.indexOf(l) >= 0 || Math.random() < 0.25; });
    host.innerHTML = '<div class="mj-radio"><p class="mj-info">Llega la transmisión:</p><div class="mj-morse">' +
      letras.map(function(l){ return '<span>' + MORSE[l] + '</span>'; }).join('') + '</div>' +
      '<div class="mj-leyenda">' + leyenda.map(function(l){ return '<span><b>' + l + '</b> ' + MORSE[l] + '</span>'; }).join('') + '</div>' +
      '<div class="mj-fila"><input type="text" class="mj-input" maxlength="8" placeholder="Palabra" autocapitalize="characters"><button type="button" class="btn small" data-ok>Enviar</button></div><p class="mj-info" data-msg></p></div>';
    var inp = host.querySelector('.mj-input'), msg = host.querySelector('[data-msg]'), intentos = 3;
    function probar(){
      var v = inp.value.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if(v === palabra) return fin(true);
      intentos--; if(intentos <= 0) return fin(false);
      msg.textContent = 'No es. Te quedan ' + intentos + ' intentos.';
    }
    host.querySelector('[data-ok]').onclick = probar;
    inp.onkeydown = function(e){ if(e.key === 'Enter') probar(); };
    inp.focus();
  }
  return function(){ clearInterval(t); };
};

// ---------- Estacas ----------
JUEGOS.estacas = function(host, fin){
  var N = 8, flojas = [], perdidas = 0, tiempo = 30, terminado = false;
  var html = '<div class="mj-carpa"><div class="mj-carpa-lona">⛺</div>';
  for(var i = 0; i < N; i++){
    var ang = i / N * Math.PI * 2;
    html += '<button type="button" class="mj-estaca" data-i="' + i + '" style="left:' + (50 + Math.cos(ang) * 40) + '%;top:' + (50 + Math.sin(ang) * 40) + '%" aria-label="Estaca ' + (i + 1) + '"><span></span></button>';
    flojas.push(0);
  }
  html += '</div><div class="mj-info"></div>';
  host.innerHTML = html;
  var info = host.querySelector('.mj-info'), botones = host.querySelectorAll('.mj-estaca');
  botones.forEach(function(b){
    b.onclick = function(){ var i = +b.getAttribute('data-i'); if(flojas[i] >= 0){ flojas[i] = 0; b.classList.add('mj-golpe'); setTimeout(function(){ b.classList.remove('mj-golpe'); }, 150); pintar(); } };
  });
  function pintar(){
    botones.forEach(function(b, i){
      var f = flojas[i];
      b.classList.toggle('mj-perdida', f < 0);
      b.style.setProperty('--flojo', f < 0 ? 1 : f / 100);
    });
    info.textContent = 'Tiempo: ' + Math.ceil(tiempo) + ' s · Estacas perdidas: ' + perdidas + ' / 3';
  }
  var t = setInterval(function(){
    if(terminado) return;
    tiempo -= 0.1;
    var avance = (30 - tiempo) / 30;
    var fuerza = 0.8 + avance * 2.6 + avance * avance * 1.5;
    flojas.forEach(function(f, i){
      if(f < 0) return;
      if(f > 0 || Math.random() < 0.016 * fuerza) flojas[i] = f + fuerza * 2.4;
      if(flojas[i] >= 100){ flojas[i] = -1; perdidas++; }
    });
    pintar();
    if(perdidas >= 3){ terminado = true; fin(false); }
    else if(tiempo <= 0){ terminado = true; fin(true); }
  }, 100);
  pintar();
  return function(){ clearInterval(t); };
};

// ---------- Proveeduría (baúl 4x4) ----------
var PIEZAS = [
  { nombre: 'Carpas', color: 'var(--teal)', celdas: [[0,0],[0,1],[0,2],[0,3]] },
  { nombre: 'Ollas', color: 'var(--bordeaux, #d93a5d)', celdas: [[0,0],[0,1],[1,0],[1,1]] },
  { nombre: 'Bidones', color: '#ffa41d', celdas: [[0,0],[0,1],[1,0]] },
  { nombre: 'Leña', color: '#639e8d', celdas: [[0,0],[0,1],[0,2]] },
  { nombre: 'Botiquín', color: '#db6829', celdas: [[0,0],[1,0]] }
];
JUEGOS.proveeduria = function(host, fin){
  var piezas = PIEZAS.map(function(p, i){ return { i: i, nombre: p.nombre, color: p.color, celdas: p.celdas.map(function(c){ return c.slice(); }), puesta: null }; });
  var tablero = [], sel = null;
  for(var r = 0; r < 4; r++){ tablero.push([-1, -1, -1, -1]); }
  function rotar(p){ p.celdas = p.celdas.map(function(c){ return [c[1], -c[0]]; }); normalizar(p); }
  function normalizar(p){
    var mr = Math.min.apply(null, p.celdas.map(function(c){ return c[0]; })), mc = Math.min.apply(null, p.celdas.map(function(c){ return c[1]; }));
    p.celdas = p.celdas.map(function(c){ return [c[0] - mr, c[1] - mc]; });
  }
  function entra(p, r, c){ return p.celdas.every(function(x){ var rr = r + x[0], cc = c + x[1]; return rr >= 0 && rr < 4 && cc >= 0 && cc < 4 && tablero[rr][cc] === -1; }); }
  function pintar(){
    var h = '<div class="mj-baul">';
    for(var r = 0; r < 4; r++) for(var c = 0; c < 4; c++){
      var v = tablero[r][c];
      h += '<button type="button" class="mj-celda" data-r="' + r + '" data-c="' + c + '"' + (v >= 0 ? ' style="background:' + piezas[v].color + '" title="' + escapeHtml(piezas[v].nombre) + '"' : '') + '></button>';
    }
    h += '</div><div class="mj-piezas">';
    piezas.forEach(function(p){
      if(p.puesta) return;
      var w = 1 + Math.max.apply(null, p.celdas.map(function(x){ return x[1]; })), hh = 1 + Math.max.apply(null, p.celdas.map(function(x){ return x[0]; }));
      h += '<button type="button" class="mj-pieza' + (sel === p.i ? ' mj-sel' : '') + '" data-p="' + p.i + '"><span class="mj-mini" style="grid-template-columns:repeat(' + w + ',12px);grid-template-rows:repeat(' + hh + ',12px)">';
      p.celdas.forEach(function(x){ h += '<i style="grid-row:' + (x[0] + 1) + ';grid-column:' + (x[1] + 1) + ';background:' + p.color + '"></i>'; });
      h += '</span>' + escapeHtml(p.nombre) + '</button>';
    });
    h += '</div><div class="mj-fila"><button type="button" class="btn small ghost" data-rot' + (sel === null ? ' disabled' : '') + '>↻ Girar</button></div>';
    host.innerHTML = h;
    host.querySelectorAll('.mj-pieza').forEach(function(b){ b.onclick = function(){ sel = +b.getAttribute('data-p'); pintar(); }; });
    var rb = host.querySelector('[data-rot]'); rb.onclick = function(){ if(sel !== null){ rotar(piezas[sel]); pintar(); } };
    host.querySelectorAll('.mj-celda').forEach(function(b){
      b.onclick = function(){
        var r = +b.getAttribute('data-r'), c = +b.getAttribute('data-c'), v = tablero[r][c];
        if(v >= 0){ sacar(piezas[v]); pintar(); return; }
        if(sel === null) return;
        var p = piezas[sel];
        if(!entra(p, r, c)){ b.classList.add('mj-error'); setTimeout(function(){ b.classList.remove('mj-error'); }, 300); return; }
        p.puesta = [r, c];
        p.celdas.forEach(function(x){ tablero[r + x[0]][c + x[1]] = p.i; });
        sel = null;
        var siguiente = piezas.find(function(q){ return !q.puesta; });
        if(!siguiente){ pintar(); return fin(true); }
        sel = siguiente.i; pintar();
      };
    });
  }
  function sacar(p){ for(var r = 0; r < 4; r++) for(var c = 0; c < 4; c++) if(tablero[r][c] === p.i) tablero[r][c] = -1; p.puesta = null; sel = p.i; }
  sel = 0; pintar();
  return function(){};
};

// ---------- Cuadre de cuentas ----------
var CONCEPTOS_ENTRA = ['cuotas', 'donación', 'venta de rifas', 'aporte de la fundación'];
var CONCEPTOS_SALE = ['leña', 'pan', 'gas', 'yerba', 'micro', 'remedios', 'fideos'];
JUEGOS.cuentas = function(host, fin){
  var ronda = 0, aciertos = 0, tiempo = 45, terminado = false;
  host.innerHTML = '<div class="mj-cuentas"><div class="mj-info" data-t></div><div data-q></div></div>';
  var tEl = host.querySelector('[data-t]'), qEl = host.querySelector('[data-q]');
  function pregunta(){
    if(ronda >= 5){ terminado = true; return fin(aciertos >= 4); }
    var caja = rndInt(10, 60) * 100, entra = rndInt(2, 20) * 100, sale1 = rndInt(1, 15) * 100, sale2 = rndInt(1, 10) * 50;
    var ok = caja + entra - sale1 - sale2;
    var opciones = barajar([ok, ok + rndInt(1, 4) * 100, ok - rndInt(1, 4) * 50]);
    qEl.innerHTML = '<p>Caja: <b>$' + caja + '</b><br>Entra: <b>+$' + entra + '</b> (' + CONCEPTOS_ENTRA[rndInt(0, 3)] + ')<br>Sale: <b>−$' + sale1 + '</b> (' + CONCEPTOS_SALE[rndInt(0, 6)] + ') y <b>−$' + sale2 + '</b> (' + CONCEPTOS_SALE[rndInt(0, 6)] + ')</p>' +
      '<div class="mj-opciones">' + opciones.map(function(o){ return '<button type="button" class="btn small ghost" data-v="' + o + '">$' + o + '</button>'; }).join('') + '</div>' +
      '<p class="mj-info">Ronda ' + (ronda + 1) + ' de 5 · Aciertos: ' + aciertos + '</p>';
    qEl.querySelectorAll('[data-v]').forEach(function(b){ b.onclick = function(){ if(+b.getAttribute('data-v') === ok) aciertos++; ronda++; pregunta(); }; });
  }
  var t = setInterval(function(){ if(terminado) return; tiempo -= 0.1; tEl.textContent = 'Tiempo: ' + Math.ceil(tiempo) + ' s'; if(tiempo <= 0){ terminado = true; fin(false); } }, 100);
  pregunta();
  return function(){ clearInterval(t); };
};

// ---------- Sintonizar la red ----------
JUEGOS.red = function(host, fin){
  var frecs = barajar(['144.5', '146.2', '147.8', '149.1']).slice(0, 4);
  var nodos = barajar(frecs.concat(frecs)), unidos = [], elegido = -1, errores = 0, terminado = false;
  var html = '<div class="mj-red"><svg class="mj-red-lineas" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';
  nodos.forEach(function(f, i){
    var ang = i / nodos.length * Math.PI * 2 - Math.PI / 2;
    html += '<button type="button" class="mj-nodo" data-i="' + i + '" style="left:' + (50 + Math.cos(ang) * 40) + '%;top:' + (50 + Math.sin(ang) * 40) + '%">📻<small>' + f + '</small></button>';
  });
  html += '</div><div class="mj-info">Memorizá… 4</div>';
  host.innerHTML = html;
  var info = host.querySelector('.mj-info'), svg = host.querySelector('svg'), botones = host.querySelectorAll('.mj-nodo');
  function pos(i){ var ang = i / nodos.length * Math.PI * 2 - Math.PI / 2; return [50 + Math.cos(ang) * 40, 50 + Math.sin(ang) * 40]; }
  var cuenta = 4, oculto = false;
  var t = setInterval(function(){
    cuenta--;
    if(cuenta > 0){ info.textContent = 'Memorizá… ' + cuenta; return; }
    clearInterval(t); oculto = true; host.querySelector('.mj-red').classList.add('mj-oculto');
    info.textContent = 'Uní las radios de la misma frecuencia. Errores: 0 / 3';
  }, 1000);
  botones.forEach(function(b){
    b.onclick = function(){
      if(!oculto || terminado) return;
      var i = +b.getAttribute('data-i');
      if(unidos.indexOf(i) >= 0) return;
      if(elegido < 0){ elegido = i; b.classList.add('mj-sel', 'mj-ver'); return; }
      if(elegido === i){ b.classList.remove('mj-sel', 'mj-ver'); elegido = -1; return; }
      var a = elegido; elegido = -1;
      botones[a].classList.remove('mj-sel');
      if(nodos[a] === nodos[i]){
        unidos.push(a, i); botones[a].classList.add('mj-ok', 'mj-ver'); b.classList.add('mj-ok', 'mj-ver');
        var p1 = pos(a), p2 = pos(i);
        svg.insertAdjacentHTML('beforeend', '<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '"/>');
        if(unidos.length === nodos.length){ terminado = true; fin(true); }
      } else {
        errores++; b.classList.add('mj-ver', 'mj-error');
        setTimeout(function(){ b.classList.remove('mj-ver', 'mj-error'); botones[a].classList.remove('mj-ver'); }, 700);
        info.textContent = 'Uní las radios de la misma frecuencia. Errores: ' + errores + ' / 3';
        if(errores >= 3){ terminado = true; fin(false); }
      }
    };
  });
  return function(){ clearInterval(t); };
};

// ---------- Trivia de Lucas 15 ----------
var TRIVIA = [
  { q: '¿Qué le pidió el hijo menor a su padre?', ok: 'La parte de la herencia que le tocaba', mal: ['Un trabajo en el campo', 'Permiso para casarse'] },
  { q: '¿Qué tuvo que cuidar cuando pasó hambre?', ok: 'Cerdos', mal: ['Ovejas', 'Camellos'] },
  { q: '¿Qué deseaba comer?', ok: 'Las bellotas que comían los cerdos', mal: ['El pan de los jornaleros', 'Langostas y miel'] },
  { q: '¿Qué hizo el padre cuando lo vio de lejos?', ok: 'Se conmovió, corrió y lo abrazó', mal: ['Lo esperó sentado en la puerta', 'Mandó a un sirviente a buscarlo'] },
  { q: '¿Qué mandó traer el padre?', ok: 'La mejor ropa, un anillo y sandalias', mal: ['Una espada y un caballo', 'Agua para lavarle los pies'] },
  { q: '¿Qué animal se mató para la fiesta?', ok: 'El ternero engordado', mal: ['Un cordero', 'Un cabrito'] },
  { q: '¿Qué le reclamó el hijo mayor al padre?', ok: 'Que nunca le dio un cabrito para festejar con sus amigos', mal: ['Que le diera su herencia', 'Que lo dejara ir de viaje'] },
  { q: '¿Qué otras dos parábolas cuenta Jesús en Lucas 15?', ok: 'La oveja perdida y la moneda perdida', mal: ['El sembrador y la semilla de mostaza', 'El buen samaritano y el rico necio'] },
  { q: '¿Qué dice el padre al hijo mayor?', ok: '«Hijo, tú estás siempre conmigo, y todo lo mío es tuyo»', mal: ['«Andá a trabajar al campo»', '«Tu hermano ya no es mi hijo»'] }
];
JUEGOS.trivia15 = function(host, fin){
  var preguntas = barajar(TRIVIA).slice(0, 7), i = 0, ok = 0;
  function mostrar(){
    if(i >= preguntas.length) return fin(ok >= 5);
    var p = preguntas[i], ops = barajar([p.ok].concat(p.mal));
    host.innerHTML = '<div class="mj-trivia"><p class="mj-info">Pregunta ' + (i + 1) + ' de ' + preguntas.length + ' · Aciertos: ' + ok + '</p><p><b>' + escapeHtml(p.q) + '</b></p><div class="mj-opciones mj-col">' +
      ops.map(function(o){ return '<button type="button" class="btn small ghost">' + escapeHtml(o) + '</button>'; }).join('') + '</div></div>';
    host.querySelectorAll('.mj-opciones button').forEach(function(b){
      b.onclick = function(){
        var bien = b.textContent === p.ok; if(bien) ok++;
        b.classList.add(bien ? 'mj-ok' : 'mj-error');
        host.querySelectorAll('.mj-opciones button').forEach(function(x){ x.disabled = true; if(x.textContent === p.ok) x.classList.add('mj-ok'); });
        setTimeout(function(){ i++; mostrar(); }, 700);
      };
    });
  }
  mostrar();
  return function(){};
};

// ---------- Linterna (noche) ----------
var ESCONDIDOS = ['✝️', '🛡️', '🔦', '🪵', '🧭', '📿', '🥾', '⛺', '🐑', '🍞'];
JUEGOS.linterna = function(host, fin){
  var items = barajar(ESCONDIDOS).slice(0, 5), encontrados = 0;
  var html = '<div class="mj-noche"><div class="mj-estrellas"></div>';
  items.forEach(function(e, i){ html += '<button type="button" class="mj-escondido" style="left:' + rnd(8, 88) + '%;top:' + rnd(10, 85) + '%" aria-label="Algo escondido">' + e + '</button>'; });
  html += '<div class="mj-luz"></div></div><div class="mj-info">Encontrados: 0 / 5</div>';
  host.innerHTML = html;
  var zona = host.querySelector('.mj-noche'), luz = host.querySelector('.mj-luz'), info = host.querySelector('.mj-info');
  var est = host.querySelector('.mj-estrellas'), s = '';
  for(var k = 0; k < 40; k++) s += '<i style="left:' + rnd(0, 100) + '%;top:' + rnd(0, 100) + '%;animation-delay:' + rnd(0, 3) + 's"></i>';
  est.innerHTML = s;
  function mover(ev){
    var r = zona.getBoundingClientRect(), p = ev.touches ? ev.touches[0] : ev;
    luz.style.setProperty('--x', (p.clientX - r.left) + 'px'); luz.style.setProperty('--y', (p.clientY - r.top) + 'px');
  }
  zona.addEventListener('pointermove', mover); zona.addEventListener('pointerdown', mover);
  host.querySelectorAll('.mj-escondido').forEach(function(b){
    b.onclick = function(){
      var r = zona.getBoundingClientRect(), br = b.getBoundingClientRect();
      var lx = parseFloat(luz.style.getPropertyValue('--x')) + r.left, ly = parseFloat(luz.style.getPropertyValue('--y')) + r.top;
      var d = Math.hypot(br.left + br.width / 2 - lx, br.top + br.height / 2 - ly);
      if(!(d < 80) || b.classList.contains('mj-ok')) return;
      b.classList.add('mj-ok'); encontrados++;
      info.textContent = 'Encontrados: ' + encontrados + ' / 5';
      if(encontrados >= 5) setTimeout(function(){ fin(true); }, 400);
    };
  });
  return function(){};
};

// ---------- Zanjas (lluvia) ----------
JUEGOS.zanjas = function(host, fin){
  var COLS = 4, charcos = [], inundadas = 0, tiempo = 25, terminado = false, carpas = [0, 0, 0, 0];
  var html = '<div class="mj-lluvia"><div class="mj-gotas"></div><div class="mj-charcos"></div><div class="mj-carpas">';
  for(var c = 0; c < COLS; c++) html += '<span data-c="' + c + '">⛺</span>';
  html += '</div></div><div class="mj-info"></div>';
  host.innerHTML = html;
  var gotas = host.querySelector('.mj-gotas'), g = '';
  for(var k = 0; k < 30; k++) g += '<i style="left:' + rnd(0, 100) + '%;animation-delay:' + rnd(0, 1) + 's;animation-duration:' + rnd(.5, .9) + 's"></i>';
  gotas.innerHTML = g;
  var cont = host.querySelector('.mj-charcos'), info = host.querySelector('.mj-info'), carpasEl = host.querySelectorAll('.mj-carpas span');
  function nuevo(){
    var col = rndInt(0, COLS - 1);
    if(carpas[col] < 0) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'mj-charco'; b.setAttribute('aria-label', 'Charco');
    b.style.left = (col * 25 + 12.5) + '%';
    var ch = { el: b, col: col, y: 0 }; charcos.push(ch);
    b.onclick = function(){ b.classList.add('mj-cavado'); charcos = charcos.filter(function(x){ return x !== ch; }); setTimeout(function(){ b.remove(); }, 250); };
    cont.appendChild(b);
  }
  function pintar(){ info.textContent = 'Tiempo: ' + Math.ceil(tiempo) + ' s · Carpas inundadas: ' + inundadas + ' / 2'; }
  var t = setInterval(function(){
    if(terminado) return;
    tiempo -= 0.1;
    if(Math.random() < 0.06 + (25 - tiempo) / 25 * 0.06) nuevo();
    charcos.slice().forEach(function(ch){
      ch.y += 0.9; ch.el.style.top = ch.y + '%';
      if(ch.y >= 75){
        ch.el.remove(); charcos = charcos.filter(function(x){ return x !== ch; });
        if(carpas[ch.col] >= 0){ carpas[ch.col] = -1; inundadas++; carpasEl[ch.col].classList.add('mj-inundada'); }
      }
    });
    pintar();
    if(inundadas >= 2){ terminado = true; fin(false); }
    else if(tiempo <= 0){ terminado = true; fin(true); }
  }, 100);
  pintar();
  return function(){ clearInterval(t); };
};
