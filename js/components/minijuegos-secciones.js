// T10 — Dos minijuegos por sección (07/11/2026). Mismo contrato que
// minijuegos.js: (host, fin) → función de limpieza.
import { registrarMinijuego, rnd, rndInt, barajar, esMouse } from './minijuegos.js';
import { escapeHtml } from '../utils/helpers.js';

function reloj(segundos, alTick, alFin){
  var t = segundos, id = setInterval(function(){ t -= 0.1; alTick(t); if(t <= 0){ clearInterval(id); alFin(); } }, 100);
  return function(){ clearInterval(id); };
}

// ===================== ESCUDEROS =====================

// Carrera de obstáculos: tres carriles, esquivar ramas y barro.
registrarMinijuego('obstaculos', { titulo: 'La carrera de obstáculos', seccion: 'Escuderos',
  ayuda: 'Movete de carril con las flechas (o tocando a los costados) para esquivar ramas y barro. Llegá al hito en 25 segundos sin chocar 3 veces.' },
function(host, fin){
  var carril = 1, obst = [], choques = 0, tiempo = 25, terminado = false;
  host.innerHTML = '<div class="mj-pista"><div class="mj-pista-carriles"><i></i><i></i></div><div class="mj-corredor">🧒</div></div>' +
    '<div class="mj-barra"><div class="mj-barra-nivel" style="background:var(--teal)"></div></div>' +
    '<div class="mj-fila"><button type="button" class="btn" data-izq>◀</button><button type="button" class="btn" data-der>▶</button></div><div class="mj-info"></div>';
  var pista = host.querySelector('.mj-pista'), yo = host.querySelector('.mj-corredor'), barra = host.querySelector('.mj-barra-nivel'), info = host.querySelector('.mj-info');
  function mover(d){ carril = Math.max(0, Math.min(2, carril + d)); yo.style.left = (carril * 33.33 + 16.66) + '%'; }
  host.querySelector('[data-izq]').onclick = function(){ mover(-1); };
  host.querySelector('[data-der]').onclick = function(){ mover(1); };
  pista.addEventListener('pointerdown', function(e){ var r = pista.getBoundingClientRect(); mover(e.clientX - r.left < r.width / 2 ? -1 : 1); });
  function onKey(e){ if(e.key === 'ArrowLeft') mover(-1); if(e.key === 'ArrowRight') mover(1); }
  document.addEventListener('keydown', onKey);
  mover(0);
  var t = setInterval(function(){
    if(terminado) return;
    tiempo -= 0.1;
    var vel = (1.3 + (25 - tiempo) / 25 * 1.4) * (esMouse() ? 0.85 : 1);
    // Nunca dos obstáculos casi a la misma altura: siempre queda un carril libre.
    var cerca = obst.some(function(o){ return o.y < 14; });
    if(!cerca && Math.random() < 0.05 + (25 - tiempo) / 25 * 0.04){
      var el = document.createElement('span'); el.className = 'mj-obst'; var c = rndInt(0, 2);
      el.textContent = Math.random() < 0.5 ? '🌿' : '🟤'; el.style.left = (c * 33.33 + 16.66) + '%'; pista.appendChild(el);
      obst.push({ el: el, c: c, y: -8 });
    }
    obst.slice().forEach(function(o){
      o.y += vel; o.el.style.top = o.y + '%';
      if(o.y > 74 && o.y < 90 && o.c === carril && !o.choco){ o.choco = true; choques++; yo.classList.add('mj-golpe-rojo'); setTimeout(function(){ yo.classList.remove('mj-golpe-rojo'); }, 300); }
      if(o.y > 105){ o.el.remove(); obst.splice(obst.indexOf(o), 1); }
    });
    barra.style.width = ((25 - tiempo) / 25 * 100) + '%';
    info.textContent = 'Choques: ' + choques + ' / 3';
    if(choques >= 3){ terminado = true; fin(false); } else if(tiempo <= 0){ terminado = true; fin(true); }
  }, 100);
  return function(){ clearInterval(t); document.removeEventListener('keydown', onKey); };
});

// Rastro de huellas: memoria, cada huella con su dueño.
var HUELLAS = [
  ['Pezuña partida en dos', '🦌 Ciervo'], ['Cuatro dedos, almohadilla y sin uñas', '🐈 Gato montés'],
  ['Cuatro dedos con uñas marcadas', '🦊 Zorro'], ['Tres dedos finos hacia adelante', '🐦 Ave'],
  ['Herradura en forma de U', '🐎 Caballo'], ['Suela con dibujo de taco', '🥾 Caminante']
];
registrarMinijuego('huellas', { titulo: 'El rastro de huellas', seccion: 'Escuderos',
  ayuda: 'Dá vuelta las tarjetas de a dos y uní cada huella con quien la dejó. Podés equivocarte hasta 8 veces.' },
function(host, fin){
  var cartas = barajar(HUELLAS.reduce(function(a, h, i){ return a.concat([{ par: i, txt: '🐾 ' + h[0] }, { par: i, txt: h[1] }]); }, []));
  var abiertas = [], hechas = 0, errores = 0, bloqueo = false;
  host.innerHTML = '<div class="mj-memo">' + cartas.map(function(c, i){ return '<button type="button" class="mj-carta" data-i="' + i + '"><span>' + escapeHtml(c.txt) + '</span></button>'; }).join('') + '</div><div class="mj-info">Errores: 0 / 8</div>';
  var info = host.querySelector('.mj-info'), bs = host.querySelectorAll('.mj-carta');
  bs.forEach(function(b){
    b.onclick = function(){
      var i = +b.getAttribute('data-i');
      if(bloqueo || b.classList.contains('mj-vuelta')) return;
      b.classList.add('mj-vuelta'); abiertas.push(i);
      if(abiertas.length < 2) return;
      var a = abiertas[0], c = abiertas[1]; abiertas = [];
      if(cartas[a].par === cartas[c].par){
        bs[a].classList.add('mj-ok'); bs[c].classList.add('mj-ok'); hechas++;
        if(hechas === HUELLAS.length) setTimeout(function(){ fin(true); }, 300);
      } else {
        errores++; info.textContent = 'Errores: ' + errores + ' / 8'; bloqueo = true;
        setTimeout(function(){ bs[a].classList.remove('mj-vuelta'); bs[c].classList.remove('mj-vuelta'); bloqueo = false; if(errores >= 8) fin(false); }, 900);
      }
    };
  });
  return function(){};
});

// ===================== TEMPLARIOS MENORES =====================

// Desafío de nudos: unir los extremos del mismo color antes de que se acabe el tiempo.
var NUDOS = ['Nudo llano', 'As de guía', 'Ballestrinque', 'Vuelta de braza'];
var COLORES_SOGA = ['#d93a5d', '#009bb3', '#ffa41d', '#639e8d'];
registrarMinijuego('nudos', { titulo: 'El desafío de nudos', seccion: 'Templarios Menores',
  ayuda: 'Para cada nudo, uní cada extremo de la izquierda con el de la derecha del mismo color. Tenés 10 segundos por nudo.' },
function(host, fin){
  var ronda = 0, limpiarReloj = null;
  function jugar(){
    if(ronda >= NUDOS.length) return fin(true);
    var der = barajar([0, 1, 2, 3]), unidos = 0, elegido = -1;
    var h = '<p class="mj-info"><b>' + NUDOS[ronda] + '</b> · nudo ' + (ronda + 1) + ' de ' + NUDOS.length + '</p><div class="mj-sogas"><svg viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';
    [0, 1, 2, 3].forEach(function(c, i){ h += '<button type="button" class="mj-extremo mj-izq" data-c="' + c + '" style="top:' + (12 + i * 25) + '%;background:' + COLORES_SOGA[c] + '"></button>'; });
    der.forEach(function(c, i){ h += '<button type="button" class="mj-extremo mj-der" data-c="' + c + '" data-y="' + (12 + i * 25) + '" style="top:' + (12 + i * 25) + '%;background:' + COLORES_SOGA[c] + '"></button>'; });
    h += '</div><div class="mj-barra"><div class="mj-barra-nivel"></div></div>';
    host.innerHTML = h;
    var svg = host.querySelector('svg'), barra = host.querySelector('.mj-barra-nivel');
    host.querySelectorAll('.mj-izq').forEach(function(b){ b.onclick = function(){ if(b.disabled) return; host.querySelectorAll('.mj-izq').forEach(function(x){ x.classList.remove('mj-sel'); }); b.classList.add('mj-sel'); elegido = +b.getAttribute('data-c'); }; });
    host.querySelectorAll('.mj-der').forEach(function(b){
      b.onclick = function(){
        if(elegido < 0 || b.disabled) return;
        var izq = host.querySelector('.mj-izq[data-c="' + elegido + '"]');
        if(+b.getAttribute('data-c') !== elegido){ b.classList.add('mj-error'); setTimeout(function(){ b.classList.remove('mj-error'); }, 300); return; }
        var ly = 12 + elegido * 25 + 5, ry = +b.getAttribute('data-y') + 5;
        svg.insertAdjacentHTML('beforeend', '<path d="M10 ' + ly + ' C 50 ' + ly + ', 50 ' + ry + ', 90 ' + ry + '" stroke="' + COLORES_SOGA[elegido] + '"/>');
        b.disabled = true; izq.disabled = true; izq.classList.remove('mj-sel'); elegido = -1; unidos++;
        if(unidos === 4){ limpiarReloj(); ronda++; setTimeout(jugar, 400); }
      };
    });
    limpiarReloj = reloj(10, function(t){ barra.style.width = (t / 10 * 100) + '%'; }, function(){ fin(false); });
  }
  jugar();
  return function(){ if(limpiarReloj) limpiarReloj(); };
});

// Armado de mochila: lo indispensable sin pasarse de peso.
var COSAS = [
  { n: '🫗 Cantimplora', kg: 1.5, ok: true }, { n: '🔦 Linterna', kg: 0.5, ok: true }, { n: '🧥 Abrigo', kg: 2, ok: true },
  { n: '🩹 Botiquín', kg: 1, ok: true }, { n: '🧢 Gorro', kg: 0.3, ok: true }, { n: '🍳 Sartén de hierro', kg: 3.5 },
  { n: '🎸 Guitarra', kg: 3 }, { n: '🛏️ Almohada', kg: 1.5 }, { n: '🎮 Consola', kg: 1 }, { n: '🥫 Latas de más', kg: 2.5 }
];
registrarMinijuego('mochila', { titulo: 'Armado de mochila express', seccion: 'Templarios Menores',
  ayuda: 'Tocá las cosas para meterlas o sacarlas de la mochila. Llevá todo lo indispensable sin pasar los 6 kg, y cerrala antes de 30 segundos.' },
function(host, fin){
  var dentro = {}, limite = 6, cosas = barajar(COSAS), terminado = false;
  function peso(){ return cosas.reduce(function(s, c, i){ return s + (dentro[i] ? c.kg : 0); }, 0); }
  function pintar(){
    var p = peso();
    host.innerHTML = '<div class="mj-mochila"><div class="mj-mochila-bolsa">🎒<b>' + p.toFixed(1) + ' / ' + limite + ' kg</b></div><div class="mj-cosas">' +
      cosas.map(function(c, i){ return '<button type="button" class="mj-cosa' + (dentro[i] ? ' mj-sel' : '') + '" data-i="' + i + '">' + c.n + '<small>' + c.kg + ' kg</small></button>'; }).join('') +
      '</div></div><div class="mj-fila"><button type="button" class="btn" data-cerrar>Cerrar la mochila</button></div><p class="mj-info" data-t></p>';
    host.querySelector('.mj-mochila-bolsa').classList.toggle('mj-pasado', p > limite);
    host.querySelectorAll('.mj-cosa').forEach(function(b){ b.onclick = function(){ var i = +b.getAttribute('data-i'); dentro[i] = !dentro[i]; pintar(); }; });
    host.querySelector('[data-cerrar]').onclick = function(){
      terminado = true;
      var falta = cosas.some(function(c, i){ return c.ok && !dentro[i]; });
      fin(!falta && peso() <= limite);
    };
  }
  pintar();
  var corta = reloj(30, function(t){ var el = host.querySelector('[data-t]'); if(el) el.textContent = 'Tiempo: ' + Math.ceil(t) + ' s'; }, function(){ if(!terminado) fin(false); });
  return corta;
});

// ===================== TEMPLARIOS INTERMEDIOS =====================

// Orientación por azimut: elegir el puesto según rumbo y distancia.
registrarMinijuego('azimut', { titulo: 'Orientación por azimut', seccion: 'Templarios Intermedios',
  ayuda: 'El azimut se mide desde el Norte, en el sentido de las agujas del reloj (90° = Este). Tocá el puesto que queda en el rumbo y la distancia indicados. Acertá 4 de 5.' },
function(host, fin){
  var ronda = 0, bien = 0;
  function jugar(){
    if(ronda >= 5) return fin(bien >= 4);
    var angs = [], intentos = 0;
    while(angs.length < 5 && intentos++ < 200){ var a = rndInt(0, 35) * 10; if(angs.every(function(b){ var d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) >= 35; })) angs.push(a); }
    var puestos = angs.map(function(a){ return { az: a, dist: rndInt(2, 4) * 100 }; }), meta = puestos[rndInt(0, puestos.length - 1)];
    var h = '<p class="mj-info">Ronda ' + (ronda + 1) + ' de 5 · Aciertos: ' + bien + '</p><p style="text-align:center"><b>Caminá ' + meta.dist + ' m con azimut ' + meta.az + '°</b></p><div class="mj-mapa-az"><svg viewBox="-110 -110 220 220">' +
      '<circle r="100" class="mj-az-aro"/><circle r="66" class="mj-az-aro"/><circle r="33" class="mj-az-aro"/>';
    for(var g = 0; g < 360; g += 45){ var rad = (g - 90) * Math.PI / 180; h += '<line x1="0" y1="0" x2="' + (Math.cos(rad) * 100) + '" y2="' + (Math.sin(rad) * 100) + '" class="mj-az-linea"/><text x="' + (Math.cos(rad) * 92) + '" y="' + (Math.sin(rad) * 92 + 3) + '" class="mj-az-txt">' + (g === 0 ? 'N' : g + '°') + '</text>'; }
    h += '<text x="0" y="4" class="mj-az-yo">⛺</text></svg>';
    puestos.forEach(function(p, i){ var rad = (p.az - 90) * Math.PI / 180, r = p.dist / 400 * 100; h += '<button type="button" class="mj-puesto" data-i="' + i + '" style="left:' + (50 + Math.cos(rad) * r / 2.2) + '%;top:' + (50 + Math.sin(rad) * r / 2.2) + '%">🚩</button>'; });
    h += '</div><p class="mj-info">Cada anillo = 100 m</p>';
    host.innerHTML = h;
    host.querySelectorAll('.mj-puesto').forEach(function(b){
      b.onclick = function(){
        var ok = puestos[+b.getAttribute('data-i')] === meta; if(ok) bien++;
        b.classList.add(ok ? 'mj-ok' : 'mj-error');
        setTimeout(function(){ ronda++; jugar(); }, 600);
      };
    });
  }
  jugar();
  return function(){};
});

// Cruce del río: saltar cuando la piedra siguiente está fuera del agua.
registrarMinijuego('rio', { titulo: 'El cruce del río', seccion: 'Templarios Intermedios',
  ayuda: 'Las piedras suben y bajan con la corriente. Tocá «Saltar» (o la barra espaciadora) cuando la piedra siguiente esté afuera del agua: si saltás a una hundida, te caés. Cruzá en 15 segundos.' },
function(host, fin){
  var N = 6, pos = -1, fase = [], vel = [], t0 = Date.now(), terminado = false;
  for(var i = 0; i < N; i++){ fase.push(rnd(0, Math.PI * 2)); vel.push(rnd(1.6, 3.2)); }
  var h = '<div class="mj-rio"><span class="mj-orilla">🌳</span>';
  for(var k = 0; k < N; k++) h += '<span class="mj-piedra" data-i="' + k + '"></span>';
  h += '<span class="mj-orilla">🏁</span><span class="mj-saltador">🧍</span></div><div class="mj-fila"><button type="button" class="btn" data-saltar data-espacio>Saltar</button></div><div class="mj-info">Piedra 0 / ' + N + '</div>';
  host.innerHTML = h;
  var piedras = host.querySelectorAll('.mj-piedra'), yo = host.querySelector('.mj-saltador'), info = host.querySelector('.mj-info');
  // Al saltar hay un margen (se ve hundida un instante antes de que cuente como hundida).
  function arriba(i, margen){ return Math.sin((Date.now() - t0) / 1000 * vel[i] + fase[i]) > (margen ? -0.4 : -0.1); }
  function ubicar(){ var x = pos < 0 ? 4 : (pos >= N ? 96 : 12 + pos * (76 / (N - 1))); yo.style.left = x + '%'; }
  host.querySelector('[data-saltar]').onclick = function(){
    if(terminado) return;
    if(pos + 1 >= N){ pos = N; ubicar(); terminado = true; return setTimeout(function(){ fin(true); }, 300); }
    if(!arriba(pos + 1, true)){ terminado = true; pos++; ubicar(); yo.textContent = '💦'; return setTimeout(function(){ fin(false); }, 500); }
    pos++; ubicar(); info.textContent = 'Piedra ' + (pos + 1) + ' / ' + N;
  };
  function tick(){
    piedras.forEach(function(p, i){ var up = arriba(i); p.classList.toggle('mj-hundida', !up); });
    var quedan = 15 - (Date.now() - t0) / 1000;
    if(!terminado){ info.textContent = 'Piedra ' + Math.max(0, pos + 1) + ' / ' + N + ' · ' + Math.max(0, Math.ceil(quedan)) + ' s'; }
    if(!terminado && quedan <= 0){ terminado = true; fin(false); }
  }
  tick();
  var t = setInterval(tick, 60);
  ubicar();
  return function(){ clearInterval(t); };
});

// ===================== TEMPLARIOS MAYORES =====================

// La pira: apilar troncos en pirámide (4-3-2-1), cada uno bien centrado.
registrarMinijuego('pira', { titulo: 'La pira de la fogata', seccion: 'Templarios Mayores',
  ayuda: 'El tronco va y viene. Tocá «Soltar» (o la barra espaciadora) cuando quede justo en su lugar (la marca punteada). Si se corre mucho, la pira se cae. Armá la pirámide entera y prendé el fuego.' },
function(host, fin){
  var filas = [4, 3, 2, 1], fila = 0, enFila = 0, x = 0, dir = 1, vel = 1.0, terminado = false, ANCHO = 18;
  host.innerHTML = '<div class="mj-pira"><div class="mj-pira-guia"></div><div class="mj-tronco mj-tronco-mov"></div></div><div class="mj-fila"><button type="button" class="btn" data-soltar data-espacio>Soltar</button></div><div class="mj-info"></div>';
  var pira = host.querySelector('.mj-pira'), mov = host.querySelector('.mj-tronco-mov'), guia = host.querySelector('.mj-pira-guia'), info = host.querySelector('.mj-info');
  function objetivo(){ var n = filas[fila]; var inicio = 50 - n * ANCHO / 2; return inicio + enFila * ANCHO; }
  function alto(f){ return 88 - f * 14; }
  function pintarGuia(){ guia.style.left = objetivo() + '%'; guia.style.top = alto(fila) + '%'; mov.style.top = (alto(fila) - 22) + '%'; info.textContent = 'Fila ' + (fila + 1) + ' de 4 · tronco ' + (enFila + 1) + ' de ' + filas[fila]; }
  pintarGuia();
  host.querySelector('[data-soltar]').onclick = function(){
    if(terminado) return;
    var err = Math.abs(x - objetivo());
    if(err > 6){ terminado = true; mov.classList.add('mj-cae'); return setTimeout(function(){ fin(false); }, 500); }
    var t = document.createElement('div'); t.className = 'mj-tronco'; t.style.left = objetivo() + '%'; t.style.top = alto(fila) + '%'; pira.appendChild(t);
    enFila++; vel += esMouse() ? 0.06 : 0.08;
    if(enFila >= filas[fila]){ fila++; enFila = 0; }
    if(fila >= filas.length){ terminado = true; mov.remove(); guia.remove(); pira.insertAdjacentHTML('beforeend', '<div class="mj-pira-fuego">🔥</div>'); return setTimeout(function(){ fin(true); }, 700); }
    pintarGuia();
  };
  var t = setInterval(function(){ if(terminado) return; x += dir * vel; if(x > 100 - ANCHO){ x = 100 - ANCHO; dir = -1; } if(x < 0){ x = 0; dir = 1; } mov.style.left = x + '%'; }, 30);
  return function(){ clearInterval(t); };
});

// Rescate en altura: lanzar la cuerda cuando la mira apunta al anclaje.
registrarMinijuego('rescate', { titulo: 'Rescate en altura', seccion: 'Templarios Mayores',
  ayuda: 'La mira se balancea. Tocá «Lanzar» (o la barra espaciadora) cuando apunte al árbol de anclaje. Hay 5 tramos, cada uno más difícil; acertá 4 antes de 30 segundos.' },
function(host, fin){
  var tramo = 0, bien = 0, ang = -60, dir = 1, meta = 0, tol = 8, terminado = false;
  host.innerHTML = '<div class="mj-rescate"><div class="mj-ancla">🌲</div><div class="mj-mira"><i></i></div><div class="mj-rescatista">🧗</div></div><div class="mj-fila"><button type="button" class="btn" data-lanzar data-espacio>Lanzar</button></div><div class="mj-info"></div>';
  var mira = host.querySelector('.mj-mira'), ancla = host.querySelector('.mj-ancla'), info = host.querySelector('.mj-info'), tiempo = 30;
  function nuevo(){ meta = rndInt(-50, 50); tol = Math.max(6, 10 - tramo); var rad = (meta - 90) * Math.PI / 180; ancla.style.left = (50 + Math.cos(rad) * 40) + '%'; ancla.style.top = (88 + Math.sin(rad) * 75) + '%'; }
  function pintarInfo(){ info.textContent = 'Tramo ' + (tramo + 1) + ' de 5 · Aciertos: ' + bien + ' · ' + Math.ceil(tiempo) + ' s'; }
  nuevo();
  host.querySelector('[data-lanzar]').onclick = function(){
    if(terminado) return;
    var ok = Math.abs(ang - meta) <= tol; if(ok) bien++;
    ancla.classList.add(ok ? 'mj-brillo' : 'mj-temblor'); setTimeout(function(){ ancla.classList.remove('mj-brillo', 'mj-temblor'); }, 400);
    tramo++;
    if(tramo >= 5 || bien >= 4){ terminado = true; return setTimeout(function(){ fin(bien >= 4); }, 400); }
    nuevo();
  };
  var t = setInterval(function(){
    if(terminado) return;
    ang += dir * (1.6 + tramo * 0.3) * (esMouse() ? 0.85 : 1); if(ang > 60){ ang = 60; dir = -1; } if(ang < -60){ ang = -60; dir = 1; }
    mira.style.transform = 'rotate(' + ang + 'deg)';
    tiempo -= 0.03; pintarInfo();
    if(tiempo <= 0){ terminado = true; fin(false); }
  }, 30);
  return function(){ clearInterval(t); };
});
