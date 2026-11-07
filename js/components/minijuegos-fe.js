// T10 — Juegos de fe (07/11/2026, pedido del usuario: «casi no agregamos
// juegos católicos»). Mismo contrato que minijuegos.js.
import { registrarMinijuego, rndInt, barajar } from './minijuegos.js';
import { escapeHtml } from '../utils/helpers.js';

// Pregunta de opción múltiple, una por pantalla. `preguntas`: [{q, ok, mal:[…], cita}].
function quiz(host, fin, preguntas, cuantas, minimo){
  var lista = barajar(preguntas).slice(0, cuantas), i = 0, ok = 0, timer = null;
  function mostrar(){
    if(i >= lista.length) return fin(ok >= minimo);
    var p = lista[i], ops = barajar([p.ok].concat(p.mal));
    host.innerHTML = '<div class="mj-trivia"><p class="mj-info">Pregunta ' + (i + 1) + ' de ' + lista.length + ' · Aciertos: ' + ok + '</p><p><b>' + escapeHtml(p.q) + '</b></p><div class="mj-opciones mj-col">' +
      ops.map(function(o){ return '<button type="button" class="btn small ghost">' + escapeHtml(o) + '</button>'; }).join('') + '</div><p class="mj-info mj-cita" hidden></p></div>';
    host.querySelectorAll('.mj-opciones button').forEach(function(b){
      b.onclick = function(){
        var bien = b.textContent === p.ok; if(bien) ok++;
        b.classList.add(bien ? 'mj-ok' : 'mj-error');
        host.querySelectorAll('.mj-opciones button').forEach(function(x){ x.disabled = true; if(x.textContent === p.ok) x.classList.add('mj-ok'); });
        if(p.cita){ var c = host.querySelector('.mj-cita'); c.hidden = false; c.textContent = p.cita; }
        timer = setTimeout(function(){ i++; mostrar(); }, p.cita ? 1800 : 800);
      };
    });
  }
  mostrar();
  return function(){ clearTimeout(timer); };
}

// ===================== El fundamento del campamento =====================
var FUNDAMENTO = [
  { q: '¿Cuándo nos hacemos hijos de Dios?', ok: 'En el Bautismo', mal: ['Al nacer', 'En la Confirmación', 'Al hacer la Primera Comunión'], cita: '«Por el bautismo fuimos sepultados con Él… para que también nosotros llevemos una vida nueva» (Rom 6, 4).' },
  { q: '¿Para qué envió Dios a su Hijo, nacido de mujer?', ok: 'Para que recibiéramos la adopción de hijos', mal: ['Para darnos una ley nueva', 'Para juzgar al mundo', 'Para fundar un reino terrenal'], cita: 'Gál 4, 4-5.' },
  { q: '¿Quién nos hace clamar «Abbá, Padre»?', ok: 'El Espíritu del Hijo en nuestros corazones', mal: ['Nuestro propio esfuerzo', 'La ley de Moisés', 'Los ángeles'], cita: 'Gál 4, 6; Rom 8, 15.' },
  { q: 'En el bautismo de Jesús, ¿qué dice la voz del Padre?', ok: '«Tú eres mi Hijo amado, en ti me complazco»', mal: ['«Este es el Cordero de Dios»', '«Preparen el camino del Señor»', '«Hagan lo que Él les diga»'], cita: 'Mc 1, 11.' },
  { q: 'Si somos hijos, ¿qué somos también?', ok: 'Herederos de Dios y coherederos con Cristo', mal: ['Siervos del Reino', 'Jueces del mundo', 'Profetas'], cita: 'Rom 8, 17.' },
  { q: '¿Quiénes son hijos de Dios, según San Pablo?', ok: 'Los que se dejan conducir por el Espíritu de Dios', mal: ['Los que cumplen todas las normas', 'Los que nunca se equivocan', 'Los que nacieron en Israel'], cita: 'Rom 8, 14.' },
  { q: '¿Dónde empieza a construirse el Reino?', ok: 'En el corazón, donde Cristo habita por la fe', mal: ['En los palacios', 'Recién al final de los tiempos', 'Solo dentro del templo'], cita: 'Ef 3, 17.' },
  { q: '¿Por qué decimos que podemos hacer presente el Reino?', ok: 'Porque somos hijos y herederos, y el Espíritu nos conduce', mal: ['Porque lo ganamos con nuestras fuerzas', 'Porque ya terminó la historia', 'Porque es solo una idea'], cita: 'Rom 8, 14-17.' },
  { q: '¿Qué dice Jesús sobre el Reino de Dios?', ok: '«El Reino de Dios ya está entre ustedes»', mal: ['«El Reino es solo para los sabios»', '«El Reino vendrá cuando yo me vaya»', '«El Reino está lejos de ustedes»'], cita: 'Lc 17, 21.' },
  { q: 'Cuando el hijo pródigo vuelve, ¿qué hace el padre?', ok: 'Lo ve de lejos, se conmueve, corre y lo abraza', mal: ['Espera que le pida perdón de rodillas', 'Lo manda a trabajar con los jornaleros', 'Le pregunta qué hizo con la herencia'], cita: 'Lc 15, 20.' },
  { q: '¿Qué alimento nos da vida eterna?', ok: 'El Pan de Vida: el Cuerpo de Cristo', mal: ['El maná del desierto', 'Los panes de la proposición', 'Cualquier pan bendecido'], cita: '«El que come mi carne y bebe mi sangre tiene Vida eterna» (Jn 6, 54).' },
  { q: '¿Cuál es el objetivo del campamento?', ok: 'Descubrir nuestra identidad de hijos de Dios Padre, en Jesús, el Hijo amado', mal: ['Ganar el Tablero de puntos', 'Aprender a armar carpas', 'Conocer Mendoza'] },
  { q: '¿Qué pedimos en el Padre Nuestro sobre el Reino?', ok: '«Venga a nosotros tu Reino»', mal: ['«Danos tu Reino ya terminado»', '«Que el Reino sea solo del cielo»', 'El Padre Nuestro no habla del Reino'], cita: 'Mt 6, 10.' }
];
registrarMinijuego('fundamento', { titulo: 'Hijos y herederos del Reino',
  ayuda: 'Preguntas sobre el fundamento del campamento: cómo nos hacemos hijos de Dios y por qué podemos hacer presente el Reino. Acertá 6 de 8.' },
function(host, fin){ return quiz(host, fin, FUNDAMENTO, 8, 6); });

// ===================== Las partes de la Misa =====================
var MISA = ['Señal de la cruz y saludo', 'Acto penitencial', 'Gloria', 'Primera lectura', 'Salmo', 'Evangelio', 'Homilía', 'Credo', 'Oración de los fieles',
  'Presentación de los dones', 'Plegaria eucarística (consagración)', 'Padre Nuestro', 'Rito de la paz', 'Cordero de Dios', 'Comunión', 'Bendición final'];
registrarMinijuego('partesMisa', { titulo: 'Las partes de la Misa',
  ayuda: 'Tocá los momentos de la Misa en el orden en que suceden (una Misa de domingo). Son 3 rondas; podés equivocarte hasta 3 veces en total.' },
function(host, fin){
  var ronda = 0, errores = 0, timer = null;
  function jugar(){
    if(ronda >= 3) return fin(true);
    // 6 momentos al azar, en su orden real.
    var idx = barajar(MISA.map(function(_, i){ return i; })).slice(0, 6).sort(function(a, b){ return a - b; }), sig = 0;
    host.innerHTML = '<p class="mj-info">Ronda ' + (ronda + 1) + ' de 3 · Errores: ' + errores + ' / 3</p><ol class="mj-orden"></ol><div class="mj-opciones mj-col">' +
      barajar(idx).map(function(i){ return '<button type="button" class="btn small ghost" data-i="' + i + '">' + escapeHtml(MISA[i]) + '</button>'; }).join('') + '</div>';
    var ol = host.querySelector('.mj-orden'), info = host.querySelector('.mj-info');
    host.querySelectorAll('[data-i]').forEach(function(b){
      b.onclick = function(){
        var i = +b.getAttribute('data-i');
        if(i === idx[sig]){
          sig++; b.remove(); ol.insertAdjacentHTML('beforeend', '<li>' + escapeHtml(MISA[i]) + '</li>');
          if(sig === idx.length){ ronda++; timer = setTimeout(jugar, 700); }
        } else {
          errores++; b.classList.add('mj-error'); setTimeout(function(){ b.classList.remove('mj-error'); }, 400);
          info.textContent = 'Ronda ' + (ronda + 1) + ' de 3 · Errores: ' + errores + ' / 3';
          if(errores >= 3) fin(false);
        }
      };
    });
  }
  jugar();
  return function(){ clearTimeout(timer); };
});

// ===================== Los misterios del Rosario =====================
var GRUPOS = { gozosos: 'Gozosos', luminosos: 'Luminosos', dolorosos: 'Dolorosos', gloriosos: 'Gloriosos' };
var MISTERIOS = [
  ['La Anunciación del ángel a María', 'gozosos'], ['La Visitación de María a Isabel', 'gozosos'], ['El Nacimiento de Jesús en Belén', 'gozosos'],
  ['La Presentación de Jesús en el Templo', 'gozosos'], ['El Niño perdido y hallado en el Templo', 'gozosos'],
  ['El Bautismo de Jesús en el Jordán', 'luminosos'], ['Las bodas de Caná', 'luminosos'], ['El anuncio del Reino de Dios', 'luminosos'],
  ['La Transfiguración', 'luminosos'], ['La institución de la Eucaristía', 'luminosos'],
  ['La oración en el Huerto', 'dolorosos'], ['La flagelación', 'dolorosos'], ['La coronación de espinas', 'dolorosos'],
  ['Jesús con la cruz a cuestas', 'dolorosos'], ['La crucifixión y muerte de Jesús', 'dolorosos'],
  ['La Resurrección', 'gloriosos'], ['La Ascensión', 'gloriosos'], ['La venida del Espíritu Santo', 'gloriosos'],
  ['La Asunción de María', 'gloriosos'], ['La coronación de María como Reina', 'gloriosos']
];
registrarMinijuego('misterios', { titulo: 'Los misterios del Rosario',
  ayuda: 'Para cada misterio, tocá a qué grupo pertenece. 12 misterios en 60 segundos; acertá 10.' },
function(host, fin){
  var lista = barajar(MISTERIOS).slice(0, 12), i = 0, ok = 0, tiempo = 60, terminado = false;
  host.innerHTML = '<div class="mj-info" data-t></div><div class="mj-residuo" data-m></div><div class="mj-tachos mj-grupos4">' +
    Object.keys(GRUPOS).map(function(g){ return '<button type="button" class="mj-tacho" data-g="' + g + '">📿<small>' + GRUPOS[g] + '</small></button>'; }).join('') + '</div><div class="mj-info" data-i></div>';
  var m = host.querySelector('[data-m]'), info = host.querySelector('[data-i]'), tEl = host.querySelector('[data-t]');
  function pintar(){ m.textContent = lista[i] ? lista[i][0] : ''; info.textContent = Math.min(i + 1, 12) + ' de 12 · Aciertos: ' + ok; }
  host.querySelectorAll('[data-g]').forEach(function(b){
    b.onclick = function(){
      if(terminado) return;
      var bien = b.getAttribute('data-g') === lista[i][1]; if(bien) ok++;
      b.classList.add(bien ? 'mj-ok' : 'mj-error'); setTimeout(function(){ b.classList.remove('mj-ok', 'mj-error'); }, 250);
      i++;
      if(i >= lista.length){ terminado = true; return fin(ok >= 10); }
      pintar();
    };
  });
  pintar();
  var t = setInterval(function(){ if(terminado) return; tiempo -= 0.1; tEl.textContent = 'Tiempo: ' + Math.ceil(tiempo) + ' s'; if(tiempo <= 0){ terminado = true; fin(false); } }, 100);
  return function(){ clearInterval(t); };
});
