// Juegos que solo abren los eventos (estrellas, bandera, tormenta). Separados
// de eventos.js para bajarlos recién cuando se abre uno (carga diferida, 12/11/2026).
import { registrarMinijuego, rnd, rndInt, barajar } from './minijuegos.js';
import { escapeHtml } from '../utils/helpers.js';

// ===================== LA SOPA DE ESTRELLAS =====================
var CONSTELACIONES = [
  { nombre: 'la Cruz del Sur', estrellas: [[205, 40], [212, 140], [172, 88], [248, 82]], lineas: [[0, 1], [2, 3]] },
  { nombre: 'las Tres Marías', estrellas: [[55, 120], [80, 108], [105, 96]], lineas: [[0, 1], [1, 2]] }
];
registrarMinijuego('estrellas', { titulo: 'La sopa de estrellas',
  ayuda: 'Mirá el dibujo de la constelación y uní sus estrellas tocándolas de a dos. Ojo, que hay estrellas que no son. Podés errarle 5 veces.' },
function(host, fin){
  var etapa = 0, errores = 0;
  function jugar(){
    if(etapa >= CONSTELACIONES.length) return fin(true);
    var c = CONSTELACIONES[etapa], hechas = [], elegida = -1;
    var pts = c.estrellas.map(function(p){ return { x: p[0], y: p[1], real: true }; });
    var n = 0;
    while(n < 26){ var x = rnd(10, 290), y = rnd(10, 170); if(pts.every(function(p){ return Math.hypot(p.x - x, p.y - y) > 22; })){ pts.push({ x: x, y: y, real: false, br: Math.random() < 0.25 }); n++; } }
    var h = '<p class="mj-info">Formá <b>' + c.nombre + '</b> · errores: ' + errores + ' / 5</p><div class="mj-cielo-juego"><svg viewBox="0 0 300 200">' +
      '<path class="mj-sierras" d="M0 200 L0 175 L40 150 L70 168 L110 138 L150 165 L190 145 L230 170 L270 150 L300 165 L300 200 Z"/><g class="mj-lineas"></g>';
    pts.forEach(function(p, i){ var r = p.real ? 3.4 : (p.br ? 2.8 : rnd(1, 1.9)); h += '<circle class="mj-estrella" data-i="' + i + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r.toFixed(1) + '"/><circle class="mj-estrella-hit" data-i="' + i + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="11"/>'; });
    // El dibujo de guía, chiquito, en la esquina.
    var gx = c.estrellas.map(function(p){ return p[0]; }), gy = c.estrellas.map(function(p){ return p[1]; });
    var mx = Math.min.apply(null, gx), my = Math.min.apply(null, gy), esc = 40 / Math.max(Math.max.apply(null, gx) - mx, Math.max.apply(null, gy) - my, 1);
    h += '<g class="mj-guia" transform="translate(248 6)"><rect x="-4" y="-2" width="52" height="50" rx="4"/>' +
      c.lineas.map(function(l){ var a = c.estrellas[l[0]], b = c.estrellas[l[1]]; return '<line x1="' + ((a[0] - mx) * esc) + '" y1="' + ((a[1] - my) * esc) + '" x2="' + ((b[0] - mx) * esc) + '" y2="' + ((b[1] - my) * esc) + '"/>'; }).join('') + '</g>';
    host.innerHTML = h + '</svg></div>';
    var lineas = host.querySelector('.mj-lineas');
    host.querySelectorAll('.mj-estrella-hit').forEach(function(el){
      el.addEventListener('click', function(){
        var i = +el.getAttribute('data-i'), dot = host.querySelector('.mj-estrella[data-i="' + i + '"]');
        if(elegida < 0){ elegida = i; dot.classList.add('mj-sel'); return; }
        var a = elegida; elegida = -1;
        host.querySelector('.mj-estrella[data-i="' + a + '"]').classList.remove('mj-sel');
        if(a === i) return;
        var ok = c.lineas.some(function(l, k){ return hechas.indexOf(k) < 0 && ((l[0] === a && l[1] === i) || (l[0] === i && l[1] === a)); });
        if(ok){
          var k = c.lineas.findIndex(function(l){ return (l[0] === a && l[1] === i) || (l[0] === i && l[1] === a); });
          hechas.push(k);
          lineas.insertAdjacentHTML('beforeend', '<line x1="' + pts[a].x + '" y1="' + pts[a].y + '" x2="' + pts[i].x + '" y2="' + pts[i].y + '"/>');
          if(hechas.length === c.lineas.length){ etapa++; setTimeout(jugar, 700); }
        } else {
          errores++; dot.classList.add('mj-mal'); setTimeout(function(){ dot.classList.remove('mj-mal'); }, 400);
          host.querySelector('.mj-info').innerHTML = 'Formá <b>' + c.nombre + '</b> · errores: ' + errores + ' / 5';
          if(errores >= 5) fin(false);
        }
      });
    });
  }
  jugar();
  return function(){};
});

// ===================== EL DESPERTAR DE LA BANDERA =====================
registrarMinijuego('bandera', { titulo: 'El despertar de la bandera',
  ayuda: 'Mantené apretado «Tirar de la driza» para tensar la soga. La bandera solo sube con la tensión en la zona verde: si aflojás, se frena; si tirás de más, se corta. Izala en 30 segundos.' },
function(host, fin){
  var tension = 0, altura = 0, tirando = false, tiempo = 30, terminado = false, ctx = null;
  host.innerHTML = '<div class="mj-mastil"><div class="mj-palo"></div><div class="mj-bandera-izada"><i></i></div></div>' +
    '<div class="mj-barra"><div class="mj-barra-zona" style="left:35%;width:45%"></div><div class="mj-barra-nivel"></div></div>' +
    '<div class="mj-fila"><button type="button" class="btn mj-driza">Tirar de la driza</button></div><div class="mj-info"></div>';
  var band = host.querySelector('.mj-bandera-izada'), barra = host.querySelector('.mj-barra-nivel'), info = host.querySelector('.mj-info'), boton = host.querySelector('.mj-driza');
  boton.addEventListener('pointerdown', function(e){ e.preventDefault(); tirando = true; clarin(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function(ev){ boton.addEventListener(ev, function(){ tirando = false; }); });
  function clarin(){
    if(ctx) return;
    try{
      ctx = new (window.AudioContext || window.webkitAudioContext)(); var t = ctx.currentTime;
      [[392,0],[523,.35],[659,.7],[784,1.05],[659,1.6],[784,1.95],[1047,2.3]].forEach(function(n){
        var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0, t + n[1]); g.gain.linearRampToValueAtTime(.12, t + n[1] + .03); g.gain.linearRampToValueAtTime(0, t + n[1] + .3);
        o.connect(g); g.connect(ctx.destination); o.start(t + n[1]); o.stop(t + n[1] + .35);
      });
    }catch(e){}
  }
  var t = setInterval(function(){
    if(terminado) return;
    tiempo -= 0.05;
    tension += tirando ? 1.7 + Math.random() * 1.1 : -2.2;
    tension = Math.max(0, tension);
    if(tension >= 35 && tension <= 80) altura += 1;
    band.style.bottom = (8 + altura * 0.78) + '%';
    barra.style.width = Math.min(100, tension) + '%';
    info.textContent = 'Altura: ' + Math.min(100, Math.round(altura)) + '% · ' + Math.ceil(tiempo) + ' s';
    if(tension >= 100){ terminado = true; info.textContent = '¡Se cortó la driza!'; fin(false); }
    else if(altura >= 100){ terminado = true; fin(true); }
    else if(tiempo <= 0){ terminado = true; fin(false); }
  }, 50);
  return function(){ clearInterval(t); if(ctx) setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 3000); };
});

// ===================== LA TORMENTA: REFUERZO DE CANALES =====================
registrarMinijuego('zanjas', { titulo: 'La tormenta: refuerzo de canales',
  ayuda: 'El agua baja hacia las carpas. Trazá zanjas con el dedo (o el mouse apretado) para cortarle el paso. Las zanjas se llenan de barro en unos segundos. Aguantá 25 segundos sin inundar 2 carpas.' },
function(host, fin){
  var CARPAS = [45, 115, 185, 255], inund = [false, false, false, false], zanjas = [], gotas = [], tiempo = 25, terminado = false, trazando = null;
  host.innerHTML = '<svg class="mj-tormenta" viewBox="0 0 300 220"><rect width="300" height="220" class="mj-tormenta-suelo"/><g class="mj-zanjas"></g><g class="mj-agua"></g>' +
    CARPAS.map(function(x, i){ return '<text class="mj-carpa-t" data-c="' + i + '" x="' + x + '" y="212">⛺</text>'; }).join('') + '</svg><div class="mj-info"></div>';
  var svg = host.querySelector('svg'), gZ = host.querySelector('.mj-zanjas'), gA = host.querySelector('.mj-agua'), info = host.querySelector('.mj-info');
  function aSvg(e){ var r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 300, (e.clientY - r.top) / r.height * 220]; }
  svg.addEventListener('pointerdown', function(e){ svg.setPointerCapture(e.pointerId); trazando = aSvg(e); });
  svg.addEventListener('pointermove', function(e){
    if(!trazando) return;
    var p = aSvg(e); if(Math.hypot(p[0] - trazando[0], p[1] - trazando[1]) < 6) return;
    var z = { a: trazando, b: p, hasta: Date.now() + 5000, el: document.createElementNS('http://www.w3.org/2000/svg', 'line') };
    z.el.setAttribute('x1', z.a[0]); z.el.setAttribute('y1', z.a[1]); z.el.setAttribute('x2', z.b[0]); z.el.setAttribute('y2', z.b[1]);
    gZ.appendChild(z.el); zanjas.push(z); trazando = p;
  });
  ['pointerup', 'pointercancel'].forEach(function(ev){ svg.addEventListener(ev, function(){ trazando = null; }); });
  function dist(p, a, b){
    var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  var t = setInterval(function(){
    if(terminado) return;
    tiempo -= 0.05;
    var ahora = Date.now();
    zanjas = zanjas.filter(function(z){ var resta = z.hasta - ahora; if(resta <= 0){ z.el.remove(); return false; } z.el.style.opacity = Math.min(1, resta / 1500); return true; });
    if(Math.random() < 0.05 + (25 - tiempo) / 25 * 0.05){
      var obj = rndInt(0, 3); if(!inund[obj]){ var el = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); el.setAttribute('r', '5'); gA.appendChild(el); gotas.push({ x: rnd(20, 280), y: 0, obj: obj, el: el }); }
    }
    gotas = gotas.filter(function(g){
      g.y += 1.6 + (25 - tiempo) / 25 * 1.4; g.x += (CARPAS[g.obj] - g.x) * 0.02;
      g.el.setAttribute('cx', g.x.toFixed(1)); g.el.setAttribute('cy', g.y.toFixed(1));
      if(zanjas.some(function(z){ return dist([g.x, g.y], z.a, z.b) < 6; })){ g.el.classList.add('mj-desviada'); setTimeout(function(){ g.el.remove(); }, 300); return false; }
      if(g.y >= 196){
        g.el.remove();
        if(!inund[g.obj]){ inund[g.obj] = true; host.querySelector('[data-c="' + g.obj + '"]').classList.add('mj-inundada'); }
        return false;
      }
      return true;
    });
    var n = inund.filter(Boolean).length;
    info.textContent = Math.ceil(tiempo) + ' s · Carpas inundadas: ' + n + ' / 2';
    if(n >= 2){ terminado = true; fin(false); } else if(tiempo <= 0){ terminado = true; fin(true); }
  }, 50);
  return function(){ clearInterval(t); };
});
