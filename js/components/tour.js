// Tour guiado (13/11/2026, pedido del usuario): se oscurece la pantalla menos
// una parte y un globito la explica. Un tour corto la primera vez en Inicio
// (4 pasos) + 1 o 2 globitos la primera vez que se abre cada sección.
// Se guarda por usuario: `users/{uid}.tour` = {inicio: ms, mensaje: ms, …}
// (copia en localStorage para no repetirlo si falla el guardado).
import { AppState } from '../app-state.js';
import { db } from '../config/firebase.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { escapeHtml } from '../utils/helpers.js';
import { canCreateRecurso } from '../services/permissions.js';

function localKey(uid){ return 'rdpTour_' + uid; }
function vistos(){
  var u = AppState.currentUser; if(!u) return {};
  var loc = {};
  try{ loc = JSON.parse(localStorage.getItem(localKey(u.uid)) || '{}') || {}; }catch(e){}
  return Object.assign({}, loc, u.tour || {});
}
function marcar(k){
  var u = AppState.currentUser; if(!u) return;
  var t = Date.now();
  u.tour = Object.assign({}, u.tour || {}); u.tour[k] = t;
  try{ var loc = vistos(); loc[k] = t; localStorage.setItem(localKey(u.uid), JSON.stringify(loc)); }catch(e){}
  var cambio = {}; cambio['tour.' + k] = t;
  updateDoc(doc(db, 'users', u.uid), cambio).catch(function(e){ console.warn('No se pudo guardar el tour:', e); });
}

// «Ver el tour de nuevo» (menú del avatar): borra lo visto y vuelve a Inicio.
export function reiniciarTour(){
  var u = AppState.currentUser; if(!u) return;
  u.tour = {};
  try{ localStorage.removeItem(localKey(u.uid)); }catch(e){}
  updateDoc(doc(db, 'users', u.uid), { tour: {} }).catch(function(e){ console.warn('No se pudo reiniciar el tour:', e); });
}

function pasosInicio(){
  var pasos = [];
  if(document.querySelector('.welcome-entries')){
    pasos.push({ sel: '.welcome-entries', titulo: '¡Bienvenido!', texto: 'Empezá por esta entrada: te explica qué es una entrada y cómo se recorre. Cuando la terminás, deja de aparecer acá.' });
  } else {
    pasos.push({ titulo: '¡Bienvenido!', texto: 'Esta es la página del comando para el Campamento Nacional «Reino del Padre». Te mostramos rápido dónde está cada cosa.' });
  }
  pasos.push({ sel: '#dayRail', titulo: 'Las pestañas', texto: 'Mensaje: lo de cada día del campamento. Recursos: oraciones, cancionero, lecturas y más. Comando: tu gente y el tablero de puntos.' });
  pasos.push({ sel: '.home-pendientes', titulo: 'Para sumar puntos', texto: 'Las entradas que te faltan. Completarlas hasta el final suma puntos y te hace subir de rango.' });
  pasos.push({ sel: '#userAvatarBtn', titulo: 'Tu perfil', texto: 'Tocá tu foto y entrá a «Perfil»: ahí ves tu rango y tu avance. Desde ese menú podés volver a ver este tour.' });
  return pasos;
}

// Qué tour corresponde ahora (el primero que falte de la pantalla abierta).
function tourParaAhora(){
  var v = vistos(), tab = AppState.activeDayId;
  if(tab === 'HOME'){
    if(!v.inicio) return { k: 'inicio', pasos: pasosInicio() };
  } else if(!v.inicio){
    return null; // primero el de Inicio
  } else if(tab === 'MENSAJE' && !v.mensaje){
    return { k: 'mensaje', pasos: [
      { sel: '.mensaje-dayswitch', titulo: 'Los días', texto: 'Elegí un día del campamento: cada uno tiene su cita, su texto y un desafío.' },
      { sel: '.mj-card', titulo: 'Desafío del día', texto: 'Un minijuego que cambia cada día. A veces hay que ganarlo para leer la reflexión, y suma puntos extra.' }
    ] };
  } else if(tab === 'RECURSOS' && !AppState.recursosCategoria && !v.recursos){
    return { k: 'recursos', pasos: [
      { sel: '.recursos-grid', titulo: 'Recursos', texto: 'Tocá una categoría para ver sus entradas. En Vida espiritual están el cancionero y «Crear misa»; en Camino formativo, el test «¿Qué hijo bíblico sos?».' }
    ] };
  } else if(tab === 'MANDOS' && !v.comando){
    return { k: 'comando', pasos: [
      { sel: '.users-subtabs', titulo: 'Comando', texto: 'Cuadro de mandos: quién es quién. Mi comando: tu gente. Tablero: el ranking de los comandos y el mapa del hijo pródigo.' }
    ] };
  } else if(tab === 'TIENDA' && !v.beneficios){
    return { k: 'beneficios', pasos: [
      { sel: '.tienda-saldo', titulo: 'Tu saldo', texto: 'Los puntos que juntaste se gastan acá: canjes directos, o subastas donde cada comando junta puntos entre todos.' }
    ] };
  }
  if(!v.jefes && canCreateRecurso() && document.getElementById('toggleFormBtn')){
    return { k: 'jefes', pasos: [
      { sel: '#toggleFormBtn', titulo: 'Agregar entradas', texto: 'Con este botón cargás una entrada nueva: se abre el editor de la Fordoquera.' }
    ] };
  }
  return null;
}

function ocupado(){
  return !!document.querySelector('.tour, .fordoquera-overlay, .mj-overlay, .mj-evento, .mj-diana, .app-dialog-overlay') ||
    AppState.userMenuOpen || AppState.formOpen;
}

var timer = null;
// Se llama después de cada render del panel. Espera un poco a que la
// pantalla se acomode y arranca el tour que falte, si no hay otra cosa abierta.
export function revisarTour(){
  var u = AppState.currentUser;
  if(!u || u.role === 'pendiente' || AppState.viewAsOverride || !AppState.activeDayId) return;
  if(timer) clearTimeout(timer);
  timer = setTimeout(function(){
    timer = null;
    if(ocupado()) return;
    var t = tourParaAhora();
    if(!t) return;
    var pasos = t.pasos.filter(function(p){ return !p.sel || document.querySelector(p.sel); });
    if(!pasos.length) return; // la pantalla todavía no tiene lo que hay que mostrar
    mostrar(t.k, pasos);
  }, 700);
}

function mostrar(k, pasos){
  var i = 0;
  var ov = document.createElement('div');
  ov.className = 'tour';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="tour-hueco"></div><div class="tour-globo" tabindex="-1"></div>';
  document.body.appendChild(ov);
  var hueco = ov.querySelector('.tour-hueco'), globo = ov.querySelector('.tour-globo');

  function cerrar(){
    marcar(k);
    ov.remove();
    window.removeEventListener('resize', ubicar);
    window.removeEventListener('scroll', ubicar, true);
    document.removeEventListener('keydown', teclas, true);
  }
  function teclas(e){
    if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); cerrar(); }
    else if(e.key === 'ArrowRight' || e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); avanzar(1); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); e.stopPropagation(); avanzar(-1); }
  }
  function avanzar(d){
    if(i + d >= pasos.length) return cerrar();
    if(i + d < 0) return;
    i += d; pintar();
  }
  function pintar(){
    var p = pasos[i], ult = i === pasos.length - 1;
    globo.innerHTML =
      '<p class="tour-titulo">' + escapeHtml(p.titulo) + '</p>' +
      '<p class="tour-texto">' + escapeHtml(p.texto) + '</p>' +
      '<div class="tour-pie"><span class="tour-cuenta">' + (pasos.length > 1 ? (i + 1) + ' de ' + pasos.length : '') + '</span>' +
      (ult ? '' : '<button type="button" class="btn ghost small" data-tour="saltar">Saltar</button>') +
      (i > 0 ? '<button type="button" class="btn ghost small" data-tour="atras">Anterior</button>' : '') +
      '<button type="button" class="btn small" data-tour="sig">' + (ult ? 'Listo' : 'Siguiente') + '</button></div>';
    globo.querySelector('[data-tour="sig"]').onclick = function(){ avanzar(1); };
    var s = globo.querySelector('[data-tour="saltar"]'); if(s) s.onclick = cerrar;
    var a = globo.querySelector('[data-tour="atras"]'); if(a) a.onclick = function(){ avanzar(-1); };
    var el = p.sel && document.querySelector(p.sel);
    if(el){
      var r = el.getBoundingClientRect();
      if(r.top < 70 || r.bottom > window.innerHeight - 20){ el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' }); }
    }
    ubicar();
    setTimeout(ubicar, 450);
    globo.querySelector('[data-tour="sig"]').focus({ preventScroll: true });
  }
  function ubicar(){
    var p = pasos[i], el = p.sel && document.querySelector(p.sel);
    var vw = window.innerWidth, vh = window.innerHeight, M = 12;
    globo.style.left = globo.style.top = '';
    if(!el){
      ov.classList.add('tour-centro');
      return;
    }
    ov.classList.remove('tour-centro');
    var r = el.getBoundingClientRect(), pad = 6;
    var top = Math.max(r.top - pad, 4), bottom = Math.min(r.bottom + pad, vh - 4);
    var left = Math.max(r.left - pad, 4), right = Math.min(r.right + pad, vw - 4);
    hueco.style.top = top + 'px'; hueco.style.left = left + 'px';
    hueco.style.width = Math.max(right - left, 0) + 'px'; hueco.style.height = Math.max(bottom - top, 0) + 'px';
    var gw = globo.offsetWidth, gh = globo.offsetHeight, gx, gy;
    if(right - left < 300 && vw - right > gw + 2 * M && bottom - top > 120){
      gx = right + M; gy = Math.min(Math.max(top, M), vh - gh - M); // al costado (sidebar en compu)
    } else if(vh - bottom > gh + 2 * M){
      gy = bottom + M; gx = left;
    } else if(top > gh + 2 * M){
      gy = top - gh - M; gx = left;
    } else {
      gy = vh - gh - M; gx = left; // el elemento ocupa casi toda la pantalla
    }
    gx = Math.min(Math.max(gx, M), vw - gw - M);
    globo.style.left = gx + 'px'; globo.style.top = gy + 'px';
  }
  window.addEventListener('resize', ubicar);
  window.addEventListener('scroll', ubicar, true);
  document.addEventListener('keydown', teclas, true);
  pintar();
}
