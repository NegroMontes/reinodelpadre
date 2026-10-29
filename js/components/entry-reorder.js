// Reordenar entradas arrastrándolas (27/10/2026, pedido del usuario: "que
// los que pueden editar entradas puedan ordenarlas arrastrándolas").
// Copia del arrastre de la Fordoquera (mismo molde que pasó el usuario):
// eventos de puntero hechos a mano, sin el drag & drop nativo. Con el mouse
// arranca al moverse más de 6px; en el celular, manteniendo apretado ~350ms
// (si el dedo se mueve antes, es scroll y se cancela). Una copia de la
// tarjeta sigue al puntero, la original queda medio transparente y una raya
// marca si cae antes o después de la tarjeta de abajo. Al soltar se guarda
// solo un `order` nuevo en la entrada movida, a mitad de camino entre sus
// nuevas vecinas (mismo criterio que el "+" entre entradas).

import { AppState } from '../app-state.js';
import { entrySortKey } from '../utils/helpers.js';
import { canEditEntry } from '../services/permissions.js';
import { save } from '../services/state.service.js';
import { render } from '../main.js';

var DR = null, finArr = 0, installed = false;

function findEntry(id){ return AppState.state.entries.find(function(e){ return e.id === id; }); }

function listIds(list){
  return Array.prototype.filter.call(list.children, function(el){ return el.classList.contains('entry') && el.getAttribute('data-id'); })
    .map(function(el){ return el.getAttribute('data-id'); });
}

// `ids` ya en el orden nuevo; devuelve true si cambió algo.
function applyNewOrder(ids, movedId){
  var i = ids.indexOf(movedId);
  var moved = findEntry(movedId);
  if(!moved || i < 0) return false;
  var prev = i > 0 ? findEntry(ids[i-1]) : null;
  var next = i < ids.length - 1 ? findEntry(ids[i+1]) : null;
  var newKey;
  if(prev && next){
    var a = entrySortKey(prev), b = entrySortKey(next);
    if(a < b){ newKey = (a + b) / 2; }
    else {
      // Vecinas con el mismo valor (entradas viejas creadas en el mismo
      // milisegundo): se renumera la lista visible entera, en orden.
      var base = Math.min.apply(null, ids.map(function(id){ var e = findEntry(id); return e ? entrySortKey(e) : 0; }));
      ids.forEach(function(id, k){ var e = findEntry(id); if(e){ e.order = base + k * 1000; } });
      return true;
    }
  } else if(next){ newKey = entrySortKey(next) - 1000; }
  else if(prev){ newKey = entrySortKey(prev) + 1000; }
  else { return false; }
  if(entrySortKey(moved) === newKey) return false;
  moved.order = newKey;
  return true;
}

function clearMarks(){
  document.querySelectorAll('.grupo-drop-target').forEach(function(x){ x.classList.remove('grupo-drop-target'); });
  document.querySelectorAll('.entry-drop-antes,.entry-drop-despues').forEach(function(x){
    x.classList.remove('entry-drop-antes', 'entry-drop-despues');
    x.style.removeProperty('--entry-drop-y');
  });
}

// La raya va en el medio exacto del hueco entre la tarjeta destino y su
// vecina (arriba o abajo); sin vecina, a la mitad del espacio habitual.
function posicionarRaya(c, antes){
  var r = c.getBoundingClientRect(), sib = c, vec = null;
  while((sib = antes ? sib.previousElementSibling : sib.nextElementSibling)){
    if(sib.classList.contains('entry')){ vec = sib; break; }
  }
  var centro;
  if(vec){
    var rv = vec.getBoundingClientRect();
    centro = antes ? (rv.bottom + r.top) / 2 : (r.bottom + rv.top) / 2;
  } else {
    centro = antes ? r.top - 7 : r.bottom + 7;
  }
  // `top` del pseudo-elemento se mide desde adentro del borde de la tarjeta.
  c.style.setProperty('--entry-drop-y', (centro - 2 - r.top - c.clientTop) + 'px');
}

// Solo dentro de la misma lista. Si el puntero cae en el hueco entre dos
// tarjetas (o sobre el "+"), no hay tarjeta debajo: se toma la más cercana
// por altura, así soltar ahí también mueve la entrada.
function destino(x, y){
  var el = document.elementFromPoint(x, y);
  if(!el || !DR.list.contains(el)) return null;
  var c = el.closest('.entry');
  if(c && c.parentElement === DR.list){
    var r = c.getBoundingClientRect();
    return { c: c, antes: y < r.top + r.height / 2 };
  }
  var cards = Array.prototype.filter.call(DR.list.children, function(n){ return n.classList.contains('entry'); });
  for(var i = 0; i < cards.length; i++){
    var rr = cards[i].getBoundingClientRect();
    if(y < rr.top + rr.height / 2) return { c: cards[i], antes: true };
  }
  return cards.length ? { c: cards[cards.length - 1], antes: false } : null;
}

// Grupos de Recursos (29/10/2026): soltar una entrada sobre la tarjeta de
// un grupo la mete adentro; sobre el "‹ volver" de un grupo, la saca.
function grupoDestino(x, y){
  var el = document.elementFromPoint(x, y);
  var g = el && el.closest && el.closest('[data-grupo-drop]');
  return g || null;
}

function marcar(){
  clearMarks();
  DR.t = null; DR.g = null;
  var g = grupoDestino(DR.x, DR.y);
  if(g){
    g.classList.add('grupo-drop-target');
    DR.g = g.getAttribute('data-grupo-drop');
    return;
  }
  var t = destino(DR.x, DR.y);
  if(!t || t.c === DR.el) return;
  t.c.classList.add(t.antes ? 'entry-drop-antes' : 'entry-drop-despues');
  posicionarRaya(t.c, t.antes);
  DR.t = t;
}

function mover(x, y){
  DR.x = x; DR.y = y;
  DR.f.style.transform = 'translate(' + (x - DR.dx) + 'px,' + (y - DR.dy) + 'px)';
  marcar();
}

function empezar(){
  var r = DR.el.getBoundingClientRect(), f = DR.el.cloneNode(true);
  f.classList.add('entry-drag-ghost');
  f.style.cssText = 'position:fixed;left:0;top:0;width:' + r.width + 'px;margin:0;pointer-events:none;z-index:2000;opacity:.85;';
  DR.dx = DR.x0 - r.left; DR.dy = DR.y0 - r.top; DR.f = f; DR.on = true;
  document.body.appendChild(f);
  DR.el.style.opacity = '.35';
  document.body.classList.add('entry-arrastrando');
  try { if(navigator.vibrate) navigator.vibrate(15); } catch(e){}
  DR.scroll = setInterval(function(){
    if(DR.y < 70) scrollBy(0, -14); else if(DR.y > innerHeight - 70) scrollBy(0, 14);
    marcar();
  }, 16);
  mover(DR.x0, DR.y0);
}

function terminar(ok){
  var d = DR; DR = null;
  clearTimeout(d.timer); clearInterval(d.scroll);
  if(!d.on) return;
  d.f.remove(); d.el.style.opacity = '';
  document.body.classList.remove('entry-arrastrando');
  finArr = Date.now();
  clearMarks();
  if(!ok) return;
  if(d.g !== null && d.g !== undefined){
    var e = findEntry(d.el.getAttribute('data-id'));
    if(!e || (e.grupo || '') === d.g) return;
    if(d.g) e.grupo = d.g; else delete e.grupo;
    save(); render();
    return;
  }
  if(!d.t) return;
  var movedId = d.el.getAttribute('data-id');
  var ids = listIds(d.list).filter(function(id){ return id !== movedId; });
  var at = ids.indexOf(d.t.c.getAttribute('data-id')) + (d.t.antes ? 0 : 1);
  ids.splice(at, 0, movedId);
  if(applyNewOrder(ids, movedId)){ save(); render(); }
}

function install(){
  if(installed) return;
  installed = true;
  document.addEventListener('pointerdown', function(ev){
    var el = ev.target.closest && ev.target.closest('.entry.entry-draggable');
    if(!el || ev.button > 0 || ev.target.closest('button,input,select,textarea,a,label')) return;
    var entry = findEntry(el.getAttribute('data-id'));
    if(!entry || !canEditEntry(entry)) return;
    DR = { el: el, list: el.parentElement, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, on: false, toque: ev.pointerType !== 'mouse' };
    if(DR.toque){ DR.timer = setTimeout(function(){ if(DR && !DR.on) empezar(); }, 350); }
  });
  document.addEventListener('pointermove', function(ev){
    if(!DR) return;
    if(!DR.on){
      var d = Math.hypot(ev.clientX - DR.x0, ev.clientY - DR.y0);
      if(DR.toque){ if(d > 8) terminar(false); return; } // está desplazando la página
      if(d < 6) return;
      empezar();
    }
    mover(ev.clientX, ev.clientY);
  });
  document.addEventListener('pointerup', function(){ if(DR) terminar(true); });
  document.addEventListener('pointercancel', function(){ if(DR) terminar(false); });
  document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape' && DR) terminar(false); });
  document.addEventListener('touchmove', function(ev){ if(DR && DR.on) ev.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function(ev){ if(DR && DR.toque) ev.preventDefault(); });
  document.addEventListener('click', function(ev){ if(Date.now() - finArr < 350){ ev.preventDefault(); ev.stopPropagation(); } }, true);
}

// Se llama en cada render (attachPanelEvents); los listeners van sobre
// `document`, así que se instalan una sola vez.
export function attachEntryReorder(){ install(); }
