// Reordenar entradas arrastrándolas (27/10/2026, pedido del usuario: "que
// los que pueden editar entradas puedan ordenarlas arrastrándolas").
// Con eventos de puntero (no el drag & drop nativo de HTML) para que ande
// igual con mouse y con el dedo en el celular. Se arrastra desde la manija
// (`data-action="dragEntry"`, ver renderEntry()); la tarjeta se mueve en
// vivo dentro de su lista y, al soltar, solo se le guarda un `order` nuevo
// a la entrada movida — a mitad de camino entre sus nuevas vecinas, mismo
// criterio que el "+" entre entradas.

import { AppState } from '../app-state.js';
import { entrySortKey } from '../utils/helpers.js';
import { canEditEntry } from '../services/permissions.js';
import { save } from '../services/state.service.js';
import { render } from '../main.js';

function findEntry(id){ return AppState.state.entries.find(function(e){ return e.id === id; }); }

function listCards(list){
  return Array.prototype.filter.call(list.children, function(el){ return el.classList.contains('entry') && el.getAttribute('data-id'); });
}

function applyNewOrder(list, movedId){
  var cards = listCards(list);
  var ids = cards.map(function(c){ return c.getAttribute('data-id'); });
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
      // Vecinas con el mismo valor (pasa con entradas viejas creadas en el
      // mismo milisegundo): se renumera la lista visible entera, en orden.
      var base = entrySortKey(findEntry(ids[0]) || moved);
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

export function attachEntryReorder(){
  document.querySelectorAll('[data-action="dragEntry"]').forEach(function(handle){
    handle.onpointerdown = function(ev){
      if(ev.button != null && ev.button !== 0) return;
      var card = handle.closest('.entry');
      var list = card && card.parentElement;
      var entry = findEntry(handle.getAttribute('data-id'));
      if(!card || !list || !entry || !canEditEntry(entry)) return;
      ev.preventDefault();
      try { handle.setPointerCapture(ev.pointerId); } catch(e){}
      var startIndex = listCards(list).indexOf(card);
      list.classList.add('entries-reordering');
      card.classList.add('entry-dragging');
      var lastY = ev.clientY;
      var scrollTimer = null;

      function reposition(){
        var others = listCards(list).filter(function(c){ return c !== card; });
        var before = null;
        for(var k = 0; k < others.length; k++){
          var r = others[k].getBoundingClientRect();
          if(lastY < r.top + r.height / 2){ before = others[k]; break; }
        }
        if(before){ if(card.nextElementSibling !== before) list.insertBefore(card, before); }
        else {
          var last = others[others.length - 1];
          if(last && last.nextSibling !== card){ list.insertBefore(card, last.nextSibling); }
        }
      }
      function autoScroll(){
        var edge = 60, h = window.innerHeight;
        var dy = lastY < edge ? -12 : (lastY > h - edge ? 12 : 0);
        if(dy){ window.scrollBy(0, dy); reposition(); }
      }
      function onMove(e){ lastY = e.clientY; reposition(); }
      function onEnd(){
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        clearInterval(scrollTimer);
        list.classList.remove('entries-reordering');
        card.classList.remove('entry-dragging');
        var moved = listCards(list).indexOf(card) !== startIndex && applyNewOrder(list, entry.id);
        if(moved){ save(); }
        render();
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
      scrollTimer = setInterval(autoScroll, 30);
    };
  });
}
