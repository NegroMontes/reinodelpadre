// T10 — Huevos de pascua por horario y contexto (07/11/2026). Ninguno se
// anuncia: hay que encontrarlos.
//  - Guardia nocturna: de 23:00 a 06:00 (o con el tema oscuro) aparece un
//    cielo estrellado y una constelación chiquita abajo a la izquierda;
//    tocarla abre la linterna. Clave `huevo-guardia`.
//  - Actividades (tema claro, de día): tocar 3 veces seguidas el escudo del
//    encabezado abre un juego de departamento al azar. Clave `huevo-actividad`.
//  - El toque de diana pasó a ser «El despertar de la bandera» (eventos.js).
//  - Lluvia: si llueve en Mendoza (Open-Meteo, sin clave) aparece lluvia y un
//    charco abajo a la derecha que abre las zanjas. Clave `lluvia-<fecha>`.
//    Para probar: agregar `?lluvia=1` a la dirección.
import { AppState } from '../app-state.js';
import { abrirMinijuego } from './minijuegos.js';
import { registrarJuego, hoyClave, juegoGanado } from '../services/juegos.service.js';
import { JUEGOS_DEPTOS } from '../views/juegos.js';
import { showToast } from './toast.js';
import { iniciarEventos } from './eventos.js';

var iniciado = false;

function minutosDelDia(){ var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function esHoraNoche(){ var m = minutosDelDia(); return m >= 23 * 60 || m < 6 * 60; }
function temaOscuro(){ return document.documentElement.classList.contains('theme-dark-active'); }

function premio(clave){
  var p = registrarJuego(clave);
  return p ? '+' + p + (p === 1 ? ' punto bonus' : ' puntos bonus') + ' para tu comando.' : '';
}

function aprobado(){
  var u = AppState.currentUser;
  return !!(u && u.role && u.role !== 'pendiente');
}

// ---------- Noche ----------
var cielo = null, constelacion = null;
function actualizarNoche(){
  var noche = aprobado() && esHoraNoche(), guardia = aprobado() && (noche || temaOscuro());
  document.documentElement.classList.toggle('mj-hora-noche', noche);
  if(noche && !cielo){
    cielo = document.createElement('div'); cielo.className = 'mj-cielo'; cielo.setAttribute('aria-hidden', 'true');
    var s = '';
    for(var i = 0; i < 60; i++) s += '<i style="left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;animation-delay:' + (Math.random() * 4) + 's"></i>';
    cielo.innerHTML = s; document.body.appendChild(cielo);
  } else if(!noche && cielo){ cielo.remove(); cielo = null; }
  if(guardia && !constelacion){
    constelacion = document.createElement('button');
    constelacion.type = 'button'; constelacion.className = 'mj-constelacion'; constelacion.setAttribute('aria-label', 'Constelación');
    constelacion.innerHTML = '<svg viewBox="0 0 40 30" aria-hidden="true"><path d="M4 22 L14 10 L24 16 L36 5"/><circle cx="4" cy="22" r="1.8"/><circle cx="14" cy="10" r="1.8"/><circle cx="24" cy="16" r="1.8"/><circle cx="36" cy="5" r="1.8"/></svg>';
    constelacion.onclick = function(){ abrirMinijuego('linterna', { alGanar: function(){ return premio('huevo-guardia'); } }); };
    document.body.appendChild(constelacion);
  } else if(!guardia && constelacion){ constelacion.remove(); constelacion = null; }
  if(constelacion) constelacion.classList.toggle('mj-constelacion-tenue', !noche);
}

// ---------- Actividades (triple toque al escudo) ----------
function engancharLogo(){
  var logo = document.getElementById('logoHomeBtn');
  if(!logo || logo.dataset.mjHuevo) return;
  logo.dataset.mjHuevo = '1';
  var toques = [];
  logo.addEventListener('click', function(){
    if(!aprobado() || temaOscuro() || esHoraNoche()) return;
    var ahora = Date.now();
    toques = toques.filter(function(t){ return ahora - t < 900; }); toques.push(ahora);
    if(toques.length >= 3){
      toques = [];
      var j = JUEGOS_DEPTOS[Math.floor(Math.random() * JUEGOS_DEPTOS.length)];
      setTimeout(function(){ abrirMinijuego(j, { titulo: '¡Actividad sorpresa!', alGanar: function(){ return premio('huevo-actividad'); } }); }, 250);
    }
  });
}

// ---------- Lluvia ----------
var LAT = -32.89, LON = -68.84;
function forzarLluvia(){
  try{
    var u = AppState.currentUser;
    return !!u && u.role === 'admin' && /[?&]lluvia=1/.test(location.search);
  }catch(e){ return false; }
}
function llueve(){
  if(forzarLluvia()) return Promise.resolve(true);
  try{
    var c = JSON.parse(sessionStorage.getItem('mjClima') || 'null');
    if(c && Date.now() - c.t < 30 * 60 * 1000) return Promise.resolve(c.lluvia);
  }catch(e){}
  return fetch('https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON + '&current=precipitation,weather_code')
    .then(function(r){ return r.json(); })
    .then(function(d){
      var cur = d && d.current || {}, code = Number(cur.weather_code);
      var si = Number(cur.precipitation) > 0 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
      try{ sessionStorage.setItem('mjClima', JSON.stringify({ t: Date.now(), lluvia: si })); }catch(e){}
      return si;
    }).catch(function(){ return false; });
}
function lluvia(){
  llueve().then(function(si){
    if(!si || !aprobado() || document.querySelector('.mj-lluvia-fondo')) return;
    var fondo = document.createElement('div'); fondo.className = 'mj-lluvia-fondo'; fondo.setAttribute('aria-hidden', 'true');
    var g = '';
    for(var i = 0; i < 50; i++) g += '<i style="left:' + (Math.random() * 100) + '%;animation-delay:' + (Math.random() * 1.2) + 's;animation-duration:' + (.6 + Math.random() * .5) + 's"></i>';
    fondo.innerHTML = g; document.body.appendChild(fondo);
    var clave = 'lluvia-' + hoyClave();
    var charco = document.createElement('button'); charco.type = 'button'; charco.className = 'mj-charco-btn'; charco.setAttribute('aria-label', 'Charco');
    charco.onclick = function(){ abrirMinijuego('zanjas', { alGanar: function(){ return premio(clave); } }); };
    document.body.appendChild(charco);
    if(!juegoGanado(clave)){
      showToast({ message: 'Está lloviendo en Mendoza… ¿y si se inundan las carpas?' });
      // Se va solo a los 6 s (el toast no tiene tiempo propio).
      setTimeout(function(){ document.querySelectorAll('.toast-item').forEach(function(t){ if(/lloviendo/.test(t.textContent)) t.remove(); }); }, 6000);
    }
  });
}

export function iniciarHuevos(){
  engancharLogo();
  actualizarNoche();
  if(iniciado || !aprobado()) return;
  iniciado = true;
  setInterval(actualizarNoche, 60 * 1000);
  new MutationObserver(actualizarNoche).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  iniciarEventos();
  lluvia();
}
