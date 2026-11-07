// T10 — Eventos especiales (07/11/2026). Solo aparecen por evento: no entran
// en los sorteos del Mensaje ni de Departamentos.
//  - La sopa de estrellas: al abrir entre 02:00 y 04:00. Clave `estrellas-<fecha>`.
//  - El despertar de la bandera: primera apertura del día entre 06:00 y 07:00
//    (reemplaza al toque de diana). Clave `diana-<fecha>`.
//  - La tormenta (refuerzo de canales): juego `zanjas`, lo abre el charco de
//    huevos.js cuando llueve. Clave `lluvia-<fecha>`.
//  - Viento Zonda: algunos días, en el mapa del Tablero los escudos se vuelan;
//    hay que sujetar las lonas. Clave `zonda-<fecha>`. Probar: `?zonda=1`.
//  - Mensaje en la botella: 5 toques seguidos al lago del mapa. Clave
//    `huevo-botella` (una vez; la misión cambia cada día).
//  - El saboteador: una vez al día le toca a un comando al azar, desde una
//    hora al azar; hay que atrapar al chancho en 3 pestañas en 60 s. Clave
//    `saboteador-<fecha>`. Probar: `?saboteador=1`.
import { AppState } from '../app-state.js';
import { registrarMinijuego, abrirMinijuego, rnd, rndInt, barajar } from './minijuegos.js';
import { registrarJuego, juegoGanado, hoyClave } from '../services/juegos.service.js';
import { SECCIONES, DEPARTAMENTOS } from '../config/constants.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast } from './toast.js';

function premio(clave){
  var p = registrarJuego(clave);
  return p ? '+' + p + (p === 1 ? ' punto bonus' : ' puntos bonus') + ' para tu comando.' : '';
}
function hash(s){ var h = 0; for(var i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
function minutos(){ var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
// Forzar un evento para probarlo: solo mientras `?<nombre>=1` esté en la
// dirección. Antes quedaba guardado en la pestaña y el evento seguía
// saliendo a cualquier hora (reporte del usuario, 07/11/2026).
// Solo el admin puede forzar (07/11/2026): si cualquiera escribía el
// parámetro en la dirección, le salía el evento y sumaba puntos.
function esAdmin(){ var u = AppState.currentUser; return !!u && u.role === 'admin'; }
function forzado(nombre){ return esAdmin() && new RegExp('[?&]' + nombre + '=1').test(location.search); }
try{ Object.keys(sessionStorage).forEach(function(k){ if(/^mj-|^mjLluvia$/.test(k)) sessionStorage.removeItem(k); }); }catch(e){}
function vez(clave){ try{ if(localStorage.getItem(clave)) return false; localStorage.setItem(clave, '1'); return true; }catch(e){ return true; } }

// Aviso a pantalla completa con botones [{txt, fn, clase}]. De a uno: si
// hay otro aviso o un juego abierto, espera su turno.
var cola = [];
function ocupado(){ return !!document.querySelector('.mj-evento, .mj-overlay, .mj-diana'); }
function siguiente(){
  if(!cola.length) return;
  if(ocupado()) return setTimeout(siguiente, 1000);
  var a = cola.shift(); mostrarAviso(a[0], a[1], a[2]);
}
// Como mucho un evento por cada vez que se abre la página (salvo los
// forzados para probar): los demás quedan para otra apertura.
var mostrados = 0;
function aviso(clase, html, botones, siempre){
  if(!siempre && mostrados >= 1 && !(esAdmin() && /[?&](estrellas|bandera|saboteador)=1/.test(location.search))) return;
  if(!siempre) mostrados++;
  cola.push([clase, html, botones]); siguiente();
}
function mostrarAviso(clase, html, botones){
  var ov = document.createElement('div');
  ov.className = 'mj-evento ' + clase;
  ov.innerHTML = '<div class="mj-evento-box">' + html + '<div class="mj-fila">' +
    botones.map(function(b, i){ return '<button type="button" class="btn small ' + (b.clase || '') + '" data-b="' + i + '">' + escapeHtml(b.txt) + '</button>'; }).join(' ') + '</div></div>';
  document.body.appendChild(ov);
  ov.querySelectorAll('[data-b]').forEach(function(el){ el.onclick = function(){ ov.remove(); var b = botones[+el.getAttribute('data-b')]; if(b.fn) b.fn(); setTimeout(siguiente, 1200); }; });
}

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

function amanecer(){
  var ov = document.createElement('div'); ov.className = 'mj-diana';
  ov.innerHTML = '<div class="mj-sol"></div>';
  document.body.appendChild(ov);
  requestAnimationFrame(function(){ ov.classList.add('mj-amanece'); });
  setTimeout(function(){ ov.classList.add('mj-sale'); setTimeout(function(){ ov.remove(); }, 800); }, 2600);
}

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

// ===================== VIENTO ZONDA (mapa del Tablero) =====================
function hayZonda(){
  if(forzado('zonda')) return true;
  var u = AppState.currentUser;
  return !!u && hash((u.uid || '') + hoyClave() + 'zonda') % 100 < 30;
}
function zondaEnMapa(lienzo){
  var clave = 'zonda-' + hoyClave();
  if(!hayZonda() || juegoGanado(clave) || lienzo.dataset.zonda) return;
  lienzo.dataset.zonda = '1';
  lienzo.classList.add('mapa-zonda');
  var aviso = document.createElement('div'); aviso.className = 'mj-zonda-aviso';
  aviso.innerHTML = '<span>🌬️ <b>Alerta de viento Zonda</b>: se están volando las lonas de los comandos.</span><button type="button" class="btn small">Sujetar las lonas</button>';
  lienzo.parentNode.insertBefore(aviso, lienzo);
  aviso.querySelector('button').onclick = function(){
    var toques = 0, META = 25, fin = Date.now() + 8000;
    aviso.innerHTML = '<span>¡Tocá rápido para sujetar! <b data-n>0</b> / ' + META + '</span><div class="mj-barra"><div class="mj-barra-nivel"></div></div><button type="button" class="btn mj-sujetar">🪢 Sujetar</button>';
    var b = aviso.querySelector('.mj-sujetar'), n = aviso.querySelector('[data-n]'), barra = aviso.querySelector('.mj-barra-nivel');
    var t = setInterval(function(){
      barra.style.width = Math.max(0, (fin - Date.now()) / 80) + '%';
      if(Date.now() > fin){ clearInterval(t); aviso.innerHTML = '<span>El viento ganó esta vez.</span><button type="button" class="btn small">Reintentar</button>'; aviso.querySelector('button').onclick = function(){ lienzo.dataset.zonda = ''; aviso.remove(); zondaEnMapa(lienzo); }; }
    }, 100);
    b.onclick = function(){
      toques++; n.textContent = toques;
      lienzo.style.setProperty('--zonda', String(Math.max(0, 1 - toques / META)));
      if(toques >= META){
        clearInterval(t); lienzo.classList.remove('mapa-zonda'); lienzo.style.removeProperty('--zonda');
        var txt = premio(clave);
        aviso.innerHTML = '<span>✅ ¡Lonas sujetas! ' + escapeHtml(txt) + '</span>';
        setTimeout(function(){ aviso.remove(); }, 3500);
      }
    };
  };
}

// ===================== MENSAJE EN LA BOTELLA (lago del mapa) =====================
var MISIONES = [
  'Durante el campamento, buscá a alguien de otra sección que no conozcas y preguntale cómo conoció a FASTA.',
  'Acertijo: «Tengo cuello y no cabeza, tengo brazos y no manos». Cuando lo descubras, llevá uno a la próxima formación.',
  'Rezá un misterio del Rosario por el comando que va último en el Tablero.',
  'Encontrá un lugar del campamento desde donde se vea la cruz al atardecer, y contáselo a tu jefe.',
  'Hacé un favor escondido a alguien de tu comando, sin que se entere quién fue.',
  'Acertijo: «Cuanto más le sacás, más grande se hace». Respondelo en la próxima reunión del comando.',
  'Aprendete de memoria Lucas 15, 20 y decíselo a alguien del comando central.',
  'Antes de la cena, agradecé en voz alta por alguien que hoy te haya ayudado.',
  'Juntá cinco piedras chicas y armá una cruz en un lugar donde la vea todo el campamento.',
  'Preguntale a un capellán cuál es su santo favorito, y por qué.'
];
function engancharBotella(lienzo){
  var toques = [];
  lienzo.querySelectorAll('[data-lugar="lago"]').forEach(function(el){
    el.addEventListener('click', function(){
      var ahora = Date.now();
      toques = toques.filter(function(t){ return ahora - t < 2500; }); toques.push(ahora);
      if(toques.length < 5) return;
      toques = [];
      var mision = MISIONES[hash(hoyClave()) % MISIONES.length], txt = premio('huevo-botella');
      setTimeout(function(){
        aviso('mj-pergamino', '<div class="mj-botella">🍾</div><p class="mj-card-kicker">Mensaje en la botella</p><p class="mj-pergamino-txt">' + escapeHtml(mision) + '</p>' +
          '<p class="mj-info">Misión secreta para el campamento' + (txt ? ' · ' + escapeHtml(txt) : '') + '</p>', [{ txt: 'Guardar el secreto' }], true);
      }, 150);
    });
  });
}

export function engancharMapaEventos(lienzo){
  if(!lienzo) return;
  engancharBotella(lienzo);
  zondaEnMapa(lienzo);
}

// ===================== EL SABOTEADOR =====================
var PESTANAS = { HOME: 'Inicio', MENSAJE: 'Mensaje', RECURSOS: 'Recursos', MANDOS: 'Comando' };
var sab = null;
function miComando(){
  var u = AppState.currentUser; if(!u) return '';
  return u.seccion || u.depto || (u.esFormacion ? 'Formación' : '');
}
function tocaSaboteador(){
  if(forzado('saboteador')) return true;
  var comandos = SECCIONES.concat(DEPARTAMENTOS), f = hoyClave();
  var elegido = comandos[hash(f + 'sabot') % comandos.length], hora = 9 * 60 + hash(f + 'hora') % (13 * 60);
  return miComando() === elegido && minutos() >= hora;
}
function chipSab(){
  var chip = document.getElementById('mjSabChip');
  if(!chip){ chip = document.createElement('div'); chip.id = 'mjSabChip'; chip.className = 'mj-sab-chip'; document.body.appendChild(chip); }
  return chip;
}
function terminarSab(gano){
  clearInterval(sab.t);
  var chip = document.getElementById('mjSabChip'); if(chip) chip.remove();
  var p = document.querySelector('.mj-chancho-suelto'); if(p) p.remove();
  var txt = gano ? premio('saboteador-' + hoyClave()) : '';
  sab = null;
  aviso('', gano ? '<p style="font-size:44px;margin:0">🐖✅</p><p><b>¡Lo atrapaste!</b></p><p>' + escapeHtml(txt || 'Volvió a la porqueriza.') + '</p>' : '<p style="font-size:44px;margin:0">🐖💨</p><p><b>Se escapó…</b> Se perdió por el campamento.</p>', [{ txt: 'Volver' }], true);
}
function arrancarSab(){
  sab = { pasos: barajar(Object.keys(PESTANAS)).slice(0, 3), i: 0, hasta: Date.now() + 60000 };
  sab.t = setInterval(function(){
    if(!sab) return;
    var resta = Math.ceil((sab.hasta - Date.now()) / 1000);
    chipSab().innerHTML = '🐖 Lo vieron por <b>' + PESTANAS[sab.pasos[sab.i]] + '</b> · ' + Math.max(0, resta) + ' s · ' + sab.i + '/3';
    if(resta <= 0) terminarSab(false);
  }, 250);
  saboteadorTrasRender();
}
export function saboteadorTrasRender(){
  if(!sab) return;
  var panel = document.getElementById('panel');
  if(!panel || AppState.activeDayId !== sab.pasos[sab.i] || panel.querySelector('.mj-chancho-suelto')) return;
  if(getComputedStyle(panel).position === 'static') panel.style.position = 'relative';
  var b = document.createElement('button'); b.type = 'button'; b.className = 'mj-chancho-suelto'; b.setAttribute('aria-label', 'Chancho');
  b.textContent = '🐖';
  b.style.left = rnd(5, 85) + '%'; b.style.top = rnd(8, 88) + '%';
  b.onclick = function(){ b.remove(); sab.i++; if(sab.i >= 3) terminarSab(true); };
  panel.appendChild(b);
}
function saboteador(){
  var f = hoyClave(), clave = 'saboteador-' + f;
  if(sab || juegoGanado(clave) || !tocaSaboteador()) return;
  if(!forzado('saboteador') && !vez('mjSab' + f)) return;
  aviso('mj-alerta', '<p style="font-size:44px;margin:0">🚨🐖</p><p><b>¡Soltaron los chanchos!</b></p><p>Un pícaro abrió la porqueriza de ' + escapeHtml(miComando() || 'tu comando') + '. Seguí las pistas por las pestañas y atrapalo antes de que pase un minuto.</p>',
    [{ txt: '¡A atraparlo!', fn: arrancarSab }, { txt: 'Ahora no', clase: 'neutral' }]);
}

// ===================== Arranque =====================
function sopaDeEstrellas(){
  var m = minutos(), clave = 'estrellas-' + hoyClave();
  if(!((m >= 120 && m < 240) || forzado('estrellas')) || juegoGanado(clave)) return;
  aviso('mj-noche-aviso', '<p style="font-size:40px;margin:0">✨</p><p><b>La sopa de estrellas</b></p><p>A esta hora el cielo de las sierras se ve como nunca. ¿Te animás a encontrar las constelaciones?</p>',
    [{ txt: 'Mirar el cielo', fn: function(){ abrirMinijuego('estrellas', { alGanar: function(){ var t = premio(clave); return 'Encendiste la Vela de la Guardia. ' + t; } }); } }, { txt: 'Ahora no', clase: 'neutral' }]);
}
function despertarBandera(){
  var m = minutos(), f = hoyClave(), clave = 'diana-' + f;
  if(!((m >= 360 && m < 420) || forzado('bandera')) || juegoGanado(clave)) return;
  if(!forzado('bandera') && !vez('mjBandera' + f)) return;
  aviso('mj-alba-aviso', '<p style="font-size:40px;margin:0">🎺</p><p><b>El despertar de la bandera</b></p><p>Suena el clarín: es hora de izar la bandera.</p>',
    [{ txt: 'Izar la bandera', fn: function(){ abrirMinijuego('bandera', { alGanar: function(){ setTimeout(amanecer, 300); return premio(clave); } }); } }, { txt: 'Ahora no', clase: 'neutral' }]);
}

var listo = false;
export function iniciarEventos(){
  if(listo) return;
  listo = true;
  setTimeout(function(){ sopaDeEstrellas(); despertarBandera(); }, 900);
  setTimeout(saboteador, 2500);
  setInterval(saboteador, 5 * 60 * 1000);
}
