// Calendario de publicación (05/11/2026): aplica de una vez las fechas de la
// pestaña "Calendario de publicaciones" del doc "IA - Página Mascu" a las
// entradas ocultas de Recursos, reconociéndolas por el título. Cada una queda
// programada para ese día a las 12:00 (ver `estaOculta()` en helpers.js).
// Solo toca entradas ocultas: lo ya publicado no se vuelve a ocultar.
import { AppState } from '../app-state.js';
import { mediodiaDe, fechaCorta, estaOculta } from '../utils/helpers.js';
import { save } from './state.service.js';

function norm(s){
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Mensaje día N (Camino formativo) — el día 8 no está en el calendario.
var DIAS = { 1:'2026-11-18', 2:'2026-11-25', 3:'2026-12-02', 4:'2026-12-09', 5:'2026-12-16', 6:'2026-12-23', 7:'2026-12-30' };
var RESTO = '2026-11-13';

// Devuelve la fecha ('aaaa-mm-dd') para un título, o '' si no está en el
// calendario (en ese caso va al 13/11 con el resto de los recursos), o null
// si no hay que tocarla.
function fechaPara(title){
  var t = norm(title);
  var dia = /\bdia\s*(\d)\b/.exec(t);
  if(dia){ return DIAS[dia[1]] || null; }
  if(/que es una entrada/.test(t) || /repaso del mensaje/.test(t)) return RESTO;
  if(/quiz/.test(t)) return '2026-11-22';
  if(/perfil/.test(t)) return '2026-11-29';
  if(/estilo|signos|revista/.test(t)){
    if(/revista|estilo\D{0,4}4/.test(t)) return '2026-12-20';
    if(/formacion|estilo\D{0,4}3/.test(t)) return '2026-12-13';
    return '2026-12-06';
  }
  if(/marcha/.test(t)) return '2026-12-20';
  if(/protocolo/.test(t)) return '2026-12-27';
  if(/carpa/.test(t)) return '2027-01-03';
  return RESTO;
}

export function planCalendario(){
  var plan = [], sinTocar = [];
  (AppState.state.entries || []).forEach(function(e){
    if(e.deletedAt || e.dayId !== 'RESOURCES') return;
    var title = e.title || (e.espacio && e.espacio.title) || '(sin título)';
    var f = fechaPara(title);
    // Solo las ocultas sin fecha: lo publicado o ya programado no se toca.
    if(!estaOculta(e) || e.publishAt){ return; }
    if(!f){ sinTocar.push(title); return; }
    plan.push({ entry: e, title: title, iso: f, at: mediodiaDe(f) });
  });
  plan.sort(function(a, b){ return a.at - b.at || a.title.localeCompare(b.title); });
  return { plan: plan, sinTocar: sinTocar };
}

export function resumenPlan(p){
  var lineas = [], ultima = '';
  p.plan.forEach(function(x){
    var f = fechaCorta(x.at);
    if(f !== ultima){ lineas.push((lineas.length ? '\n' : '') + f + ' (12:00):'); ultima = f; }
    lineas.push('• ' + x.title);
  });
  if(p.sinTocar.length){ lineas.push('\nQuedan ocultas sin fecha (no están en el calendario):'); p.sinTocar.forEach(function(t){ lineas.push('• ' + t); }); }
  return lineas.join('\n');
}

export function aplicarPlan(p){
  p.plan.forEach(function(x){ x.entry.publishAt = x.at; x.entry.oculta = true; });
  save();
}
