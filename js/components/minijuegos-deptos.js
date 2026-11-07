// T10 — Dos minijuegos nuevos por departamento (07/11/2026). Mismo contrato
// que minijuegos.js: (host, fin) → función de limpieza.
import { registrarMinijuego, rnd, rndInt, barajar } from './minijuegos.js';
import { escapeHtml } from '../utils/helpers.js';

function reloj(segundos, alTick, alFin){
  var t = segundos, id = setInterval(function(){ t -= 0.1; alTick(t); if(t <= 0){ clearInterval(id); alFin(); } }, 100);
  return function(){ clearInterval(id); };
}

// ===================== FORMACIÓN =====================

// Rompecabezas deslizante con la consigna (Lc 15, 18).
var FRASE = ['Me', 'levantaré,', 'iré', 'a la', 'casa', 'de mi', 'Padre', '(Lc 15, 18)'];
registrarMinijuego('rompecabezas', { titulo: 'El rompecabezas del mensaje', depto: 'Formación',
  ayuda: 'Tocá una pieza al lado del hueco para moverla. Ordená las piezas (de izquierda a derecha y de arriba abajo) para leer la consigna oculta.' },
function(host, fin){
  var tab = [0, 1, 2, 3, 4, 5, 6, 7, 8], hueco = 8, movs = 0;
  function vecinos(i){ var r = Math.floor(i / 3), c = i % 3, v = []; if(r > 0) v.push(i - 3); if(r < 2) v.push(i + 3); if(c > 0) v.push(i - 1); if(c < 2) v.push(i + 1); return v; }
  var ultimo = -1;
  for(var k = 0; k < 80; k++){ var v = vecinos(hueco).filter(function(x){ return x !== ultimo; }); var x = v[rndInt(0, v.length - 1)]; tab[hueco] = tab[x]; tab[x] = 8; ultimo = hueco; hueco = x; }
  if(tab.every(function(t, i){ return t === i; })){ tab[8] = 7; tab[7] = 8; hueco = 7; }
  function pintar(){
    host.innerHTML = '<div class="mj-puzle">' + tab.map(function(t, i){ return t === 8 ? '<span class="mj-pieza-hueco"></span>' : '<button type="button" class="mj-pieza-p" data-i="' + i + '"><i>🛡️</i>' + escapeHtml(FRASE[t]) + '</button>'; }).join('') + '</div><div class="mj-info">Movimientos: ' + movs + '</div>';
    host.querySelectorAll('.mj-pieza-p').forEach(function(b){
      b.onclick = function(){
        var i = +b.getAttribute('data-i');
        if(vecinos(i).indexOf(hueco) < 0) return;
        tab[hueco] = tab[i]; tab[i] = 8; hueco = i; movs++; pintar();
        if(tab.every(function(t, j){ return t === j; })) setTimeout(function(){ fin(true); }, 300);
      };
    });
  }
  pintar();
  return function(){};
});

// ===================== LOGÍSTICA =====================

// Ruta de abastecimiento: camino más corto entre el depósito y el comando.
registrarMinijuego('ruta', { titulo: 'La ruta de abastecimiento', depto: 'Logística',
  ayuda: 'Armá el camino desde el depósito 📦 hasta la carpa ⛺ tocando casillas vecinas (sin diagonales). Esquivá árboles y rocas. Tiene que ser el camino más corto. Tocá la última casilla para deshacer.' },
function(host, fin){
  var N = 6, ronda = 0;
  function jugar(){
    if(ronda >= 2) return fin(true);
    var muros, ini, meta, corto;
    do {
      muros = {}; for(var i = 0; i < N * N; i++) if(Math.random() < 0.26) muros[i] = true;
      ini = rndInt(0, N - 1) * N; meta = rndInt(0, N - 1) * N + N - 1; delete muros[ini]; delete muros[meta];
      corto = bfs(muros, ini, meta);
    } while(corto < 0 || corto < N);
    var camino = [ini];
    function pintar(){
      var h = '<p class="mj-info">Entrega ' + (ronda + 1) + ' de 2 · Pasos: ' + (camino.length - 1) + '</p><div class="mj-ruta" style="grid-template-columns:repeat(' + N + ',1fr)">';
      for(var i = 0; i < N * N; i++){
        var en = camino.indexOf(i) >= 0;
        h += '<button type="button" class="mj-casilla' + (muros[i] ? ' mj-muro' : '') + (en ? ' mj-camino' : '') + '" data-i="' + i + '">' + (i === ini ? '📦' : i === meta ? '⛺' : muros[i] ? (i % 2 ? '🌲' : '🪨') : '') + '</button>';
      }
      host.innerHTML = h + '</div>';
      host.querySelectorAll('.mj-casilla').forEach(function(b){
        b.onclick = function(){
          var i = +b.getAttribute('data-i'), ult = camino[camino.length - 1];
          if(i === ult && camino.length > 1){ camino.pop(); return pintar(); }
          if(muros[i] || camino.indexOf(i) >= 0) return;
          var d = Math.abs(i - ult); if(!((d === 1 && Math.floor(i / N) === Math.floor(ult / N)) || d === N)) return;
          camino.push(i);
          if(i === meta){
            pintar();
            if(camino.length - 1 === corto){ ronda++; return setTimeout(jugar, 500); }
            return setTimeout(function(){ fin(false); }, 500);
          }
          pintar();
        };
      });
    }
    pintar();
  }
  function bfs(m, a, b){
    var dist = {}; dist[a] = 0; var q = [a];
    while(q.length){ var x = q.shift(); if(x === b) return dist[x];
      [x - N, x + N, (x % N) ? x - 1 : -1, (x % N < N - 1) ? x + 1 : -1].forEach(function(y){ if(y >= 0 && y < N * N && !m[y] && dist[y] === undefined){ dist[y] = dist[x] + 1; q.push(y); } }); }
    return -1;
  }
  jugar();
  return function(){};
});

// Control de carga: ¿el bulto sube o se pasa del límite?
registrarMinijuego('carga', { titulo: 'Control de carga', depto: 'Logística',
  ayuda: 'Cada bulto puede pesar como mucho 20 kg. Sumá lo que tiene adentro y decidí si sube a la camioneta o excede. Acertá 7 de 8 en 30 segundos.' },
function(host, fin){
  var ronda = 0, bien = 0, terminado = false;
  var COSA = ['bolsas de papa', 'bidones de agua', 'cajones de fruta', 'bolsas de leña', 'cajas de fideos'];
  host.innerHTML = '<div class="mj-info" data-t></div><div data-q></div>';
  var q = host.querySelector('[data-q]');
  function jugar(){
    if(ronda >= 8){ terminado = true; return fin(bien >= 7); }
    var n = rndInt(2, 4), kg = rndInt(3, 8), extra = rndInt(1, 6), total = n * kg + extra;
    if(Math.abs(total - 20) > 6 && Math.random() < 0.6){ extra = Math.max(1, 20 - n * kg + rndInt(-2, 2)); total = n * kg + extra; }
    var excede = total > 20;
    q.innerHTML = '<div class="mj-bulto">📦</div><p style="text-align:center">' + n + ' ' + COSA[rndInt(0, 4)] + ' de <b>' + kg + ' kg</b> + un extra de <b>' + extra + ' kg</b></p>' +
      '<div class="mj-opciones"><button type="button" class="btn small ghost" data-r="sube">✅ Sube</button><button type="button" class="btn small ghost" data-r="excede">⛔ Excede</button></div><p class="mj-info">Bulto ' + (ronda + 1) + ' de 8 · Aciertos: ' + bien + '</p>';
    q.querySelectorAll('[data-r]').forEach(function(b){ b.onclick = function(){ if((b.getAttribute('data-r') === 'excede') === excede) bien++; ronda++; jugar(); }; });
  }
  jugar();
  return reloj(30, function(t){ host.querySelector('[data-t]').textContent = 'Tiempo: ' + Math.ceil(t) + ' s'; }, function(){ if(!terminado){ terminado = true; fin(false); } });
});

// ===================== COMUNICACIONES =====================

// El radioperador: repetir la secuencia de pulsos cortos y largos.
registrarMinijuego('radioperador', { titulo: 'El radioperador', depto: 'Comunicaciones',
  ayuda: 'Mirá la luz: destellos cortos y largos. Después repetí la misma secuencia con los botones para transmitir el aviso. Son 4 avisos, cada uno más largo.' },
function(host, fin){
  var ronda = 0, timers = [];
  function limpiarT(){ timers.forEach(clearTimeout); timers = []; }
  function jugar(){
    if(ronda >= 4) return fin(true);
    var sec = []; for(var i = 0; i < 3 + ronda; i++) sec.push(Math.random() < 0.5 ? '.' : '-');
    host.innerHTML = '<div class="mj-faro"><span class="mj-luz-radio"></span></div><p class="mj-info" data-m>Aviso ' + (ronda + 1) + ' de 4 · mirá…</p><div class="mj-morse mj-tecleado" data-tec></div>' +
      '<div class="mj-fila"><button type="button" class="btn" data-p="." disabled>• Corto</button><button type="button" class="btn" data-p="-" disabled>— Largo</button></div>';
    var luz = host.querySelector('.mj-luz-radio'), msg = host.querySelector('[data-m]'), tec = host.querySelector('[data-tec]');
    var t = 600;
    sec.forEach(function(s){
      timers.push(setTimeout(function(){ luz.classList.add('mj-on'); }, t));
      t += s === '.' ? 250 : 750;
      timers.push(setTimeout(function(){ luz.classList.remove('mj-on'); }, t));
      t += 350;
    });
    var escrito = [];
    timers.push(setTimeout(function(){
      msg.textContent = 'Ahora transmití vos';
      host.querySelectorAll('[data-p]').forEach(function(b){
        b.disabled = false;
        b.onclick = function(){
          escrito.push(b.getAttribute('data-p')); tec.textContent = escrito.join(' ');
          if(escrito[escrito.length - 1] !== sec[escrito.length - 1]) return fin(false);
          if(escrito.length === sec.length){ ronda++; timers.push(setTimeout(jugar, 500)); }
        };
      });
    }, t));
  }
  jugar();
  return limpiarT;
});

// Interferencia de señal: alinear una onda con la otra.
registrarMinijuego('interferencia', { titulo: 'Interferencia de señal', depto: 'Comunicaciones',
  ayuda: 'Mové «Frecuencia» y «Fase» hasta que tu onda (turquesa) quede encima de la de la patrulla (punteada). Mantenela alineada un segundo. Son 2 patrullas.' },
function(host, fin){
  var ronda = 0, t = null;
  function jugar(){
    if(ronda >= 2) return fin(true);
    var f0 = rndInt(10, 30) / 10, p0 = rndInt(0, 35) * 10, fijo = 0;
    host.innerHTML = '<p class="mj-info">Patrulla ' + (ronda + 1) + ' de 2</p><svg class="mj-ondas" viewBox="0 0 300 100"><path class="mj-onda-meta"/><path class="mj-onda-mia"/></svg>' +
      '<label class="mj-slider">Frecuencia<input type="range" min="5" max="35" value="' + (f0 > 2 ? 8 : 32) + '" data-f></label><label class="mj-slider">Fase<input type="range" min="0" max="355" step="5" value="' + ((p0 + 180) % 360) + '" data-p></label>' +
      '<div class="mj-barra"><div class="mj-barra-nivel"></div></div>';
    var meta = host.querySelector('.mj-onda-meta'), mia = host.querySelector('.mj-onda-mia'), fi = host.querySelector('[data-f]'), pi = host.querySelector('[data-p]'), barra = host.querySelector('.mj-barra-nivel');
    function onda(f, p){ var d = ''; for(var x = 0; x <= 300; x += 4){ d += (x ? 'L' : 'M') + x + ' ' + (50 + Math.sin(x / 300 * Math.PI * 2 * f + p * Math.PI / 180) * 35).toFixed(1); } return d; }
    meta.setAttribute('d', onda(f0, p0));
    function cerca(){ var df = Math.abs(fi.value / 10 - f0), dp = Math.abs(((pi.value - p0) % 360 + 540) % 360 - 180); return Math.max(0, 100 - df * 120 - dp * 1.2); }
    function pintar(){ mia.setAttribute('d', onda(fi.value / 10, +pi.value)); barra.style.width = cerca() + '%'; }
    fi.oninput = pintar; pi.oninput = pintar; pintar();
    clearInterval(t);
    t = setInterval(function(){ fijo = cerca() > 85 ? fijo + 0.1 : 0; if(fijo >= 1){ clearInterval(t); ronda++; setTimeout(jugar, 400); } }, 100);
  }
  jugar();
  return function(){ clearInterval(t); };
});

// ===================== ADMINISTRACIÓN =====================

// El racionamiento: repartir raciones según integrantes y días.
var COMANDOS_R = ['Escuderos', 'Templarios Menores', 'Templarios Intermedios', 'Templarios Mayores', 'el comando'];
registrarMinijuego('racionamiento', { titulo: 'El racionamiento', depto: 'Administración',
  ayuda: 'Repartí las raciones en partes iguales por persona y por día. Elegí cuántas le tocan al comando indicado. Acertá 4 de 5 en 60 segundos.' },
function(host, fin){
  var ronda = 0, bien = 0, terminado = false;
  host.innerHTML = '<div class="mj-info" data-t></div><div data-q></div>';
  var q = host.querySelector('[data-q]');
  function jugar(){
    if(ronda >= 5){ terminado = true; return fin(bien >= 4); }
    var dias = rndInt(2, 5), grupo = rndInt(2, 8) * 5, total = grupo * rndInt(3, 8), porPersonaDia = rndInt(1, 3);
    var raciones = total * dias * porPersonaDia, ok = grupo * porPersonaDia;
    var quien = COMANDOS_R[rndInt(0, COMANDOS_R.length - 1)];
    var ops = barajar([ok, ok + grupo, Math.max(1, ok - Math.ceil(grupo / 2)), ok * dias].filter(function(v, i, a){ return a.indexOf(v) === i; })).slice(0, 3);
    if(ops.indexOf(ok) < 0) ops[0] = ok; ops = barajar(ops);
    q.innerHTML = '<p>Hay <b>' + raciones + ' raciones</b> para <b>' + dias + ' días</b> y <b>' + total + ' acampantes</b>.<br>' + quien.charAt(0).toUpperCase() + quien.slice(1) + ' son <b>' + grupo + '</b>. ¿Cuántas raciones le tocan <b>por día</b>?</p>' +
      '<div class="mj-opciones">' + ops.map(function(o){ return '<button type="button" class="btn small ghost" data-v="' + o + '">' + o + '</button>'; }).join('') + '</div><p class="mj-info">Ronda ' + (ronda + 1) + ' de 5 · Aciertos: ' + bien + '</p>';
    q.querySelectorAll('[data-v]').forEach(function(b){ b.onclick = function(){ if(+b.getAttribute('data-v') === ok) bien++; ronda++; jugar(); }; });
  }
  jugar();
  return reloj(60, function(t){ host.querySelector('[data-t]').textContent = 'Tiempo: ' + Math.ceil(t) + ' s'; }, function(){ if(!terminado){ terminado = true; fin(false); } });
});

// Auditoría de inventario: marcar faltantes y duplicados.
var INVENTARIO = ['Carpa 4 personas', 'Olla grande', 'Linterna', 'Botiquín', 'Pala', 'Hacha', 'Bidón 20 L', 'Soga 10 m', 'Farol a gas', 'Lona', 'Martillo', 'Cantimplora'];
registrarMinijuego('auditoria', { titulo: 'Auditoría de inventario', depto: 'Administración',
  ayuda: 'Compará el inventario con la planilla. Tocá en la planilla los renglones duplicados y en el inventario lo que falta en la planilla. Cada error resta 3 segundos.' },
function(host, fin){
  var items = barajar(INVENTARIO).slice(0, 8), faltan = items.slice(0, 2), dup = items.slice(2, 4);
  var planilla = barajar(items.filter(function(x){ return faltan.indexOf(x) < 0; }).concat(dup));
  var marcados = 0, objetivo = faltan.length + dup.length, tiempo = 30, terminado = false, vistos = {};
  host.innerHTML = '<div class="mj-audit"><div><b>Inventario</b>' + items.map(function(x){ return '<button type="button" class="mj-renglon" data-inv="' + escapeHtml(x) + '">' + escapeHtml(x) + '</button>'; }).join('') + '</div>' +
    '<div><b>Planilla</b>' + planilla.map(function(x, i){ return '<button type="button" class="mj-renglon" data-pla="' + i + '">' + escapeHtml(x) + '</button>'; }).join('') + '</div></div><div class="mj-info"></div>';
  var info = host.querySelector('.mj-info');
  function pintar(){ info.textContent = 'Encontrados: ' + marcados + ' / ' + objetivo + ' · ' + Math.ceil(tiempo) + ' s'; }
  function error(b){ tiempo -= 3; b.classList.add('mj-error'); setTimeout(function(){ b.classList.remove('mj-error'); }, 300); }
  function acierto(b){ b.classList.add('mj-tachado'); b.disabled = true; marcados++; if(marcados >= objetivo){ terminado = true; setTimeout(function(){ fin(true); }, 300); } }
  host.querySelectorAll('[data-inv]').forEach(function(b){ b.onclick = function(){ if(faltan.indexOf(b.getAttribute('data-inv')) >= 0) acierto(b); else error(b); }; });
  host.querySelectorAll('[data-pla]').forEach(function(b){
    b.onclick = function(){
      var x = planilla[+b.getAttribute('data-pla')];
      // El segundo renglón de un par es el duplicado (cualquiera de los dos vale, una vez).
      if(dup.indexOf(x) >= 0 && !vistos[x]){ vistos[x] = true; acierto(b); } else error(b);
    };
  });
  pintar();
  var t = setInterval(function(){ if(terminado) return; tiempo -= 0.1; pintar(); if(tiempo <= 0){ terminado = true; fin(false); } }, 100);
  return function(){ clearInterval(t); };
});

// ===================== INTENDENCIA =====================

// Reparación de lonas: repasar el desgarro con el dedo.
registrarMinijuego('lonas', { titulo: 'Reparación de lonas', depto: 'Intendencia',
  ayuda: 'Pasá el dedo (o el mouse apretado) por encima de cada desgarro para emparcharlo con cinta, antes de que empiece a llover. Son 3 desgarros en 25 segundos.' },
function(host, fin){
  var tear = 0, puntos = [], tapados = [], terminado = false, dibujando = false;
  host.innerHTML = '<svg class="mj-lona" viewBox="0 0 300 200"><rect width="300" height="200" rx="10" class="mj-lona-tela"/><path class="mj-desgarro"/><path class="mj-cinta"/></svg><div class="mj-barra"><div class="mj-barra-nivel"></div></div><div class="mj-info"></div>';
  var svg = host.querySelector('svg'), desg = host.querySelector('.mj-desgarro'), cinta = host.querySelector('.mj-cinta'), barra = host.querySelector('.mj-barra-nivel'), info = host.querySelector('.mj-info'), trazo = '';
  function nuevo(){
    puntos = []; tapados = []; trazo = '';
    var x = rnd(40, 80), y = rnd(40, 160), d = 'M' + x + ' ' + y;
    puntos.push([x, y]);
    for(var i = 0; i < 6; i++){ x += rnd(25, 35); y = Math.max(25, Math.min(175, y + rnd(-35, 35))); d += ' L' + x.toFixed(0) + ' ' + y.toFixed(0); puntos.push([x, y]); }
    // Puntos intermedios para medir cuánto se tapó.
    var muestras = [];
    for(var k = 0; k < puntos.length - 1; k++) for(var s = 0; s < 5; s++) muestras.push([puntos[k][0] + (puntos[k + 1][0] - puntos[k][0]) * s / 5, puntos[k][1] + (puntos[k + 1][1] - puntos[k][1]) * s / 5]);
    puntos = muestras; tapados = muestras.map(function(){ return false; });
    desg.setAttribute('d', d); cinta.setAttribute('d', '');
  }
  function aSvg(e){ var r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 300, (e.clientY - r.top) / r.height * 200]; }
  svg.addEventListener('pointerdown', function(e){ dibujando = true; svg.setPointerCapture(e.pointerId); var p = aSvg(e); trazo += 'M' + p[0].toFixed(0) + ' ' + p[1].toFixed(0); mover(e); });
  svg.addEventListener('pointerup', function(){ dibujando = false; });
  svg.addEventListener('pointermove', mover);
  function mover(e){
    if(!dibujando || terminado) return;
    var p = aSvg(e); trazo += ' L' + p[0].toFixed(0) + ' ' + p[1].toFixed(0); cinta.setAttribute('d', trazo);
    puntos.forEach(function(q, i){ if(Math.hypot(q[0] - p[0], q[1] - p[1]) < 14) tapados[i] = true; });
    var pct = tapados.filter(Boolean).length / tapados.length;
    barra.style.width = (pct * 100) + '%';
    if(pct >= 0.9){ tear++; dibujando = false; if(tear >= 3){ terminado = true; return setTimeout(function(){ fin(true); }, 300); } setTimeout(nuevo, 300); }
  }
  nuevo();
  var corta = reloj(25, function(t){ info.textContent = 'Desgarro ' + Math.min(tear + 1, 3) + ' de 3 · ' + Math.ceil(t) + ' s'; }, function(){ if(!terminado){ terminado = true; fin(false); } });
  return corta;
});

// Gestión de residuos: cada cosa a su tacho.
var RESIDUOS = [
  ['🧴 Botella de plástico', 'rec'], ['🥫 Lata de conserva', 'rec'], ['📰 Diario', 'rec'], ['📦 Caja de cartón', 'rec'], ['🫙 Frasco de vidrio', 'rec'],
  ['🍌 Cáscara de banana', 'org'], ['🧉 Yerba usada', 'org'], ['🥕 Restos de verdura', 'org'], ['🥚 Cáscaras de huevo', 'org'], ['🍂 Hojas secas', 'org'],
  ['🧻 Servilleta usada', 'bas'], ['🍬 Envoltorio de golosina', 'bas'], ['🩹 Curita usada', 'bas'], ['🚬 Colilla', 'bas']
];
registrarMinijuego('residuos', { titulo: 'Gestión de residuos', depto: 'Intendencia',
  ayuda: 'Tocá el tacho correcto para cada residuo: reciclable, orgánico (compost) o basura común. 12 residuos en 30 segundos, con 2 errores como mucho.' },
function(host, fin){
  var lista = barajar(RESIDUOS).slice(0, 12), i = 0, errores = 0, terminado = false;
  host.innerHTML = '<div class="mj-residuo" data-r></div><div class="mj-tachos"><button type="button" class="mj-tacho mj-t-rec" data-t="rec">♻️<small>Reciclable</small></button><button type="button" class="mj-tacho mj-t-org" data-t="org">🍂<small>Orgánico</small></button><button type="button" class="mj-tacho mj-t-bas" data-t="bas">🗑️<small>Basura</small></button></div><div class="mj-info" data-i></div>';
  var r = host.querySelector('[data-r]'), info = host.querySelector('[data-i]'), tiempo = 30;
  function pintar(){ r.textContent = lista[i] ? lista[i][0] : ''; info.textContent = (i + 1 > 12 ? 12 : i + 1) + ' de 12 · Errores: ' + errores + ' / 2 · ' + Math.ceil(tiempo) + ' s'; }
  host.querySelectorAll('[data-t]').forEach(function(b){
    b.onclick = function(){
      if(terminado) return;
      var ok = b.getAttribute('data-t') === lista[i][1];
      b.classList.add(ok ? 'mj-ok' : 'mj-error'); setTimeout(function(){ b.classList.remove('mj-ok', 'mj-error'); }, 250);
      if(!ok) errores++;
      i++;
      if(errores > 2){ terminado = true; return fin(false); }
      if(i >= lista.length){ terminado = true; return fin(true); }
      pintar();
    };
  });
  pintar();
  var t = setInterval(function(){ if(terminado) return; tiempo -= 0.1; pintar(); if(tiempo <= 0){ terminado = true; fin(false); } }, 100);
  return function(){ clearInterval(t); };
});

// ===================== ACTIVIDADES =====================

// Laberinto nocturno: solo se ve lo que ilumina la linterna.
registrarMinijuego('laberinto', { titulo: 'El laberinto nocturno', depto: 'Actividades',
  ayuda: 'Movete con las flechas (o deslizando) hasta la salida 🏁. Solo ves lo que alumbra tu linterna. Tenés 60 segundos.' },
function(host, fin){
  var W = 9, H = 9, celdas = [], visit = [];
  for(var i = 0; i < W * H; i++){ celdas.push({ n: true, s: true, e: true, o: true }); visit.push(false); }
  (function cavar(){
    var pila = [0]; visit[0] = true;
    while(pila.length){
      var c = pila[pila.length - 1], x = c % W, y = Math.floor(c / W), vs = [];
      if(y > 0 && !visit[c - W]) vs.push(['n', c - W, 's']); if(y < H - 1 && !visit[c + W]) vs.push(['s', c + W, 'n']);
      if(x > 0 && !visit[c - 1]) vs.push(['o', c - 1, 'e']); if(x < W - 1 && !visit[c + 1]) vs.push(['e', c + 1, 'o']);
      if(!vs.length){ pila.pop(); continue; }
      var v = vs[rndInt(0, vs.length - 1)]; celdas[c][v[0]] = false; celdas[v[1]][v[2]] = false; visit[v[1]] = true; pila.push(v[1]);
    }
  })();
  var yo = 0, salida = W * H - 1, terminado = false;
  var h = '<div class="mj-lab" style="grid-template-columns:repeat(' + W + ',1fr)">';
  celdas.forEach(function(c, i){ h += '<span class="mj-lab-c' + (c.n ? ' bn' : '') + (c.s ? ' bs' : '') + (c.e ? ' be' : '') + (c.o ? ' bo' : '') + '">' + (i === salida ? '🏁' : '') + '</span>'; });
  h += '<span class="mj-lab-yo">🔦</span><div class="mj-lab-oscuro"></div></div><div class="mj-fila mj-flechas"><button type="button" class="btn small" data-d="o">◀</button><button type="button" class="btn small" data-d="n">▲</button><button type="button" class="btn small" data-d="s">▼</button><button type="button" class="btn small" data-d="e">▶</button></div><div class="mj-info"></div>';
  host.innerHTML = h;
  var lab = host.querySelector('.mj-lab'), ficha = host.querySelector('.mj-lab-yo'), osc = host.querySelector('.mj-lab-oscuro'), info = host.querySelector('.mj-info');
  function ubicar(){
    var x = (yo % W + 0.5) / W * 100, y = (Math.floor(yo / W) + 0.5) / H * 100;
    ficha.style.left = x + '%'; ficha.style.top = y + '%';
    osc.style.setProperty('--x', x + '%'); osc.style.setProperty('--y', y + '%');
  }
  function mover(d){
    if(terminado || celdas[yo][d]) return;
    yo += d === 'n' ? -W : d === 's' ? W : d === 'e' ? 1 : -1; ubicar();
    if(yo === salida){ terminado = true; setTimeout(function(){ fin(true); }, 300); }
  }
  host.querySelectorAll('[data-d]').forEach(function(b){ b.onclick = function(){ mover(b.getAttribute('data-d')); }; });
  function onKey(e){ var m = { ArrowUp: 'n', ArrowDown: 's', ArrowLeft: 'o', ArrowRight: 'e' }[e.key]; if(m){ e.preventDefault(); mover(m); } }
  document.addEventListener('keydown', onKey);
  var x0 = null, y0 = null;
  lab.addEventListener('pointerdown', function(e){ x0 = e.clientX; y0 = e.clientY; });
  lab.addEventListener('pointerup', function(e){ if(x0 === null) return; var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; if(Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; mover(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'o') : (dy > 0 ? 's' : 'n')); });
  ubicar();
  var corta = reloj(60, function(t){ info.textContent = Math.ceil(t) + ' s'; }, function(){ if(!terminado){ terminado = true; fin(false); } });
  return function(){ corta(); document.removeEventListener('keydown', onKey); };
});

// Posta de destreza: repetir la secuencia de señales (banderines y silbato).
var SENALES = [{ id: 'r', txt: '🚩', clase: 'mj-s-rojo' }, { id: 'a', txt: '🏳️', clase: 'mj-s-azul' }, { id: 'v', txt: '🟩', clase: 'mj-s-verde' }, { id: 's', txt: '📯', clase: 'mj-s-silbato' }];
registrarMinijuego('posta', { titulo: 'Posta de destreza', depto: 'Actividades',
  ayuda: 'El jefe de posta hace una secuencia de señales. Repetila en el mismo orden. Cada vez se suma una más: llegá a 7.' },
function(host, fin){
  var sec = [], timers = [], escuchando = false, pos = 0, ctx = null;
  host.innerHTML = '<div class="mj-posta">' + SENALES.map(function(s){ return '<button type="button" class="mj-senal ' + s.clase + '" data-s="' + s.id + '">' + s.txt + '</button>'; }).join('') + '</div><div class="mj-info"></div>';
  var info = host.querySelector('.mj-info');
  function sonar(i){
    try{ ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = [330, 440, 554, 880][i]; g.gain.value = .08; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .18); }catch(e){}
  }
  function prender(id){ var i = SENALES.findIndex(function(s){ return s.id === id; }), b = host.querySelector('[data-s="' + id + '"]'); b.classList.add('mj-on'); sonar(i); timers.push(setTimeout(function(){ b.classList.remove('mj-on'); }, 350)); }
  function ronda(){
    if(sec.length >= 7) return fin(true);
    sec.push(SENALES[rndInt(0, 3)].id); escuchando = false; pos = 0;
    info.textContent = 'Mirá… (' + sec.length + (sec.length === 1 ? ' señal)' : ' señales)');
    sec.forEach(function(id, k){ timers.push(setTimeout(function(){ prender(id); }, 600 + k * 550)); });
    timers.push(setTimeout(function(){ escuchando = true; info.textContent = 'Tu turno (' + sec.length + (sec.length === 1 ? ' señal)' : ' señales)'); }, 600 + sec.length * 550));
  }
  host.querySelectorAll('[data-s]').forEach(function(b){
    b.onclick = function(){
      if(!escuchando) return;
      var id = b.getAttribute('data-s'); prender(id);
      if(id !== sec[pos]){ escuchando = false; return fin(false); }
      pos++;
      if(pos === sec.length){ escuchando = false; timers.push(setTimeout(ronda, 600)); }
    };
  });
  ronda();
  return function(){ timers.forEach(clearTimeout); if(ctx) ctx.close(); };
});
