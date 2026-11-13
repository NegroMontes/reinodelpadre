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
import { abrirMinijuego } from './minijuegos-lazy.js';
import { rnd, barajar } from '../utils/azar.js';
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
function ocupado(){ return !!document.querySelector('.mj-evento, .mj-overlay, .mj-diana, .tour'); }
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

function amanecer(){
  var ov = document.createElement('div'); ov.className = 'mj-diana';
  ov.innerHTML = '<div class="mj-sol"></div>';
  document.body.appendChild(ov);
  requestAnimationFrame(function(){ ov.classList.add('mj-amanece'); });
  setTimeout(function(){ ov.classList.add('mj-sale'); setTimeout(function(){ ov.remove(); }, 800); }, 2600);
}

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
