// T8 E2 (07/11/2026) — Test «¿Qué hijo bíblico sos?», en Recursos → Camino
// formativo (AppState.recursosCategoria === 'test-hijo'). Una pregunta por
// pantalla; al terminar, el resultado se guarda en el perfil
// (`users/{uid}.hijoBiblico`) y se suma a `hijosDesbloqueados`, que destraba
// la entrada «Conocé a <hijo>» (entry.hijoBiblico, ver canSeeEntry()).
// Se puede repetir; no suma puntos.

import { AppState } from '../app-state.js';
import { HIJOS_BIBLICOS, PREGUNTAS_HIJO_BIBLICO, VIRTUDES } from '../config/test-hijo-biblico.js';
import { escapeHtml, compareEntryOrder } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';
import { canSeeEntry } from '../services/permissions.js';
import { db } from '../config/firebase.js';
import { setDoc, doc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { openFordoqueraViewer } from '../components/fordoquera-embed.js';
import { renderPanel } from '../main.js';

  // Gana el de más puntos; empate: el que sumó en la pregunta más reciente.
  export function calcularHijo(respuestas){
    var pts = {}, ultima = {};
    respuestas.forEach(function(oi, qi){
      var op = PREGUNTAS_HIJO_BIBLICO[qi] && PREGUNTAS_HIJO_BIBLICO[qi].o[oi];
      if(!op) return;
      op[0].forEach(function(h){ pts[h] = (pts[h] || 0) + 1; ultima[h] = qi; });
    });
    var mejor = null;
    Object.keys(pts).forEach(function(h){
      if(!mejor || pts[h] > pts[mejor] || (pts[h] === pts[mejor] && ultima[h] > ultima[mejor])) mejor = h;
    });
    return mejor;
  }

  export function hijoDe(u){
    var k = u && u.hijoBiblico;
    return HIJOS_BIBLICOS[k] ? k : '';
  }

  function guardarResultado(k){
    var u = AppState.currentUser;
    if(!u) return;
    // Al toque en la pantalla; watchProfile() lo confirma después.
    u.hijoBiblico = k;
    u.hijosDesbloqueados = (u.hijosDesbloqueados || []).filter(function(x){ return x !== k; }).concat([k]);
    setDoc(doc(db, 'users', u.uid), { hijoBiblico: k, hijosDesbloqueados: arrayUnion(k) }, { merge: true })
      .catch(function(e){ console.error('No se pudo guardar el resultado del test:', e); });
  }

  // Tarjeta del test dentro de Camino formativo.
  // Entradas «Conocé a…» que ve esta persona (las desbloqueadas; el admin, todas).
  function entradasHijo(){
    return AppState.state.entries.filter(function(e){ return e.hijoBiblico && canSeeEntry(e); }).sort(compareEntryOrder);
  }

  function resultadoHtml(k){
    var h = HIJOS_BIBLICOS[k];
    var html = '<div class="home-card test-hijo-card test-hijo-resultado">';
    html += '<p class="mandos-sub">Te salió</p>';
    html += '<h3>' + escapeHtml(h.nombre) + '</h3>';
    html += '<p class="mandos-sub">' + escapeHtml(h.cita) + '</p>';
    html += '<p><strong>Tu fortaleza.</strong> ' + escapeHtml(h.fortaleza) + '</p>';
    html += '<p><strong>Tu desafío.</strong> ' + escapeHtml(h.desafio) + '</p>';
    if(VIRTUDES[h.virtud]) html += '<p><strong>Virtud para cultivar.</strong> ' + escapeHtml(VIRTUDES[h.virtud]) + '</p>';
    html += '</div>';
    var propias = entradasHijo().filter(function(e){ return e.hijoBiblico === k; });
    var otras = entradasHijo().filter(function(e){ return e.hijoBiblico !== k; });
    if(propias.length){
      html += '<p class="test-hijo-desbloqueo">' + icon('star') + ' Desbloqueaste una entrada para conocerlo mejor:</p>';
      propias.forEach(function(e){ html += entradaBtnHtml(e); });
    }
    if(otras.length){
      html += '<p class="mandos-sub test-hijo-otras">' + (AppState.currentUser.role === 'admin' ? 'Entradas «Conocé a…» (como admin las ves todas):' : 'También desbloqueaste:') + '</p>';
      otras.forEach(function(e){ html += entradaBtnHtml(e); });
    }
    html += '<div class="test-hijo-acciones"><button class="btn ghost" type="button" id="testHijoRepetir">Repetir el test</button></div>';
    return html;
  }

  function entradaBtnHtml(e){
    return '<button type="button" class="btn small test-hijo-entrada" data-test-entrada="' + escapeHtml(e.id) + '">' + icon('book-open') + ' ' + escapeHtml(e.title || '(sin título)') + '</button> ';
  }

  export function renderTestHijoPanel(){
    var panel = document.getElementById('panel');
    var t = AppState.testHijo;
    var k = hijoDe(AppState.currentUser);
    var html = '<button type="button" class="recursos-back" id="testHijoBack">' + icon('chevron-left') + ' Camino formativo</button>';
    html += '<div class="panel-head"><div><h2>¿Qué hijo bíblico sos?</h2></div></div>';
    var total = PREGUNTAS_HIJO_BIBLICO.length;
    if(t && t.paso < total){
      var q = PREGUNTAS_HIJO_BIBLICO[t.paso];
      html += '<div class="home-card test-hijo-card">';
      html += '<p class="mandos-sub">Pregunta ' + (t.paso + 1) + ' de ' + total + '</p>';
      html += '<div class="perfil-barra"><span style="width:' + Math.round(t.paso / total * 100) + '%"></span></div>';
      html += '<h3 class="test-hijo-pregunta">' + escapeHtml(q.p) + '</h3>';
      html += '<div class="test-hijo-opciones">';
      q.o.forEach(function(op, i){
        html += '<button type="button" class="test-hijo-opcion' + (t.respuestas[t.paso] === i ? ' elegida' : '') + '" data-test-op="' + i + '">' + escapeHtml(op[1]) + '</button>';
      });
      html += '</div>';
      if(t.paso > 0) html += '<button type="button" class="btn ghost small" id="testHijoAtras">' + icon('chevron-left') + ' Anterior</button>';
      html += '</div>';
    } else if(k){
      html += resultadoHtml(k);
    } else {
      html += '<div class="home-card test-hijo-card">';
      html += '<p>En la Biblia hay muchos hijos: el pródigo, el mayor, Isaac, José, Samuel, David… Cada uno vivió a su manera ser hijo de Dios Padre.</p>';
      html += '<p>Respondé ' + total + ' preguntas cortas y descubrí con cuál te parecés más. No hay respuestas buenas ni malas: elegí la que más se parezca a vos.</p>';
      html += '<p class="mandos-sub">Al terminar se desbloquea una entrada para conocerlo mejor. Lo podés repetir cuando quieras.</p>';
      html += '<div class="test-hijo-acciones"><button class="btn" type="button" id="testHijoEmpezar">Empezar</button></div>';
      html += '</div>';
    }
    panel.innerHTML = html;

    var empezar = function(){ AppState.testHijo = { paso: 0, respuestas: [] }; renderPanel(); window.scrollTo(0, 0); };
    var b;
    if((b = document.getElementById('testHijoEmpezar'))) b.onclick = empezar;
    if((b = document.getElementById('testHijoRepetir'))) b.onclick = empezar;
    if((b = document.getElementById('testHijoBack'))) b.onclick = function(){
      AppState.testHijo = null;
      AppState.recursosCategoria = 'formacion';
      renderPanel(); window.scrollTo(0, 0);
    };
    if((b = document.getElementById('testHijoAtras'))) b.onclick = function(){ t.paso--; renderPanel(); };
    panel.querySelectorAll('[data-test-op]').forEach(function(btn){
      btn.onclick = function(){
        t.respuestas[t.paso] = Number(btn.getAttribute('data-test-op'));
        t.paso++;
        if(t.paso >= total){
          var r = calcularHijo(t.respuestas.slice(0, total));
          AppState.testHijo = null;
          if(r) guardarResultado(r);
        }
        renderPanel(); window.scrollTo(0, 0);
      };
    });
    panel.querySelectorAll('[data-test-entrada]').forEach(function(btn){
      btn.onclick = function(){ openFordoqueraViewer(btn.getAttribute('data-test-entrada')); };
    });
  }
