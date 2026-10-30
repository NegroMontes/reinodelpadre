// "Crear misa" (30/10/2026), dentro del Cancionero: cada uno arma el
// repertorio de una misa eligiendo cantos del cancionero para cada momento.
// Primero se elige el tipo de día (Gloria/Credo según el día); el ordinario se carga
// solo. La misa guardada se ve con un desplegable por canto (se abre uno a
// la vez) y se puede exportar a PDF (diálogo de impresión del navegador).
// Vistas: AppState.cancioneroVista 'misas' (lista) | 'misa' (una) | 'misaEdit'.

import { AppState } from '../app-state.js';
import { escapeHtml, uid } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';
import { isAdmin } from '../services/permissions.js';
import { ensureMisasSub, saveMisa, deleteMisa } from '../services/cancionero.service.js';
import { showAlert, showConfirm } from '../components/dialog.js';
import { renderPanel, showStatus } from '../main.js';
import { norm, catLabel, sortedCantos, textoDe, letraHtml } from './cancionero.js';

  // Según la Instrucción General del Misal Romano: el Gloria va los
  // domingos, solemnidades y fiestas (IGMR 53); el Credo, solo domingos y
  // solemnidades (IGMR 68). La oración de los fieles se recomienda en toda
  // misa con pueblo (IGMR 69), así que no cambia según el día.
  // ('mayor' incluía las fiestas hasta el 30/10/2026; las misas viejas
  // así guardadas quedan como domingo/solemnidad.)
  export var MISA_TIPOS = [
    { id: 'mayor', label: 'Domingo, sábado a la tarde o solemnidad', sub: 'Con Gloria y Credo' },
    { id: 'fiesta', label: 'Fiesta', sub: 'Con Gloria, sin Credo' },
    { id: 'menor', label: 'Memoria o día de semana', sub: 'Sin Gloria ni Credo' }
  ];

  // Momentos de la misa, en orden. `ordinario`: se completa solo con el canto
  // del cancionero cuyo título coincide. `tipos`: solo en esos tipos de día.
  // `cats`: categorías que se sugieren primero al elegir un canto.
  var MOMENTOS = [
    { id: 'entrada', label: 'Entrada', cats: ['entrada'] },
    { id: 'kyrie', label: 'Señor, ten piedad', cats: ['ordinario'], ordinario: /kyrie|piedad/ },
    { id: 'gloria', label: 'Gloria', cats: ['ordinario'], ordinario: /gloria/, tipos: ['mayor', 'fiesta'] },
    { id: 'salmo', label: 'Salmo', cats: ['otros'] },
    { id: 'aleluya', label: 'Aleluya', cats: ['ordinario'], ordinario: /aleluya/ },
    // Sin canto en el cancionero: queda «Rezado» salvo que se elija uno.
    { id: 'credo', label: 'Credo', cats: ['ordinario'], ordinario: /credo/, tipos: ['mayor'] },
    { id: 'ofertorio', label: 'Ofertorio', cats: ['ofertorio'] },
    { id: 'santo', label: 'Santo', cats: ['ordinario'], ordinario: /^santo/ },
    { id: 'padrenuestro', label: 'Padre Nuestro', cats: ['ordinario'], ordinario: /padre nuestro/ },
    { id: 'cordero', label: 'Cordero de Dios', cats: ['ordinario'], ordinario: /cordero/ },
    { id: 'comunion', label: 'Comunión', cats: ['comunion', 'adoracion'] },
    { id: 'poscomunion', label: 'Acción de gracias', cats: ['poscomunion', 'adoracion'] },
    { id: 'salida', label: 'Salida', cats: ['maria', 'marchas', 'espiritu'] }
  ];

  function momentosDe(tipo){
    return MOMENTOS.filter(function(m){ return !m.tipos || m.tipos.indexOf(tipo) !== -1; });
  }

  function tipoLabel(tipo){
    var t = MISA_TIPOS.find(function(t){ return t.id === tipo; });
    return t ? t.label : '';
  }

  function cantoPorId(id){
    return AppState.cancionero.find(function(c){ return c.id === id; });
  }

  function canEditMisa(m){
    return isAdmin() || (!!AppState.currentUser && m.uid === AppState.currentUser.uid);
  }

  function fecha(ts){
    return ts ? new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  export function misasCountTxt(){
    ensureMisasSub();
    var n = AppState.misas.length;
    return n ? n + ' misa' + (n === 1 ? '' : 's') + ' armada' + (n === 1 ? '' : 's') : 'Armá el repertorio';
  }

  function backBtn(label){
    return '<button type="button" class="recursos-back" id="misasBackBtn">' + icon('chevron-left') + ' ' + label + '</button>';
  }

  export function renderMisasPanel(){
    ensureMisasSub();
    var v = AppState.cancioneroVista;
    if(v === 'misaEdit' && AppState.misaDraft){ renderEditor(); return; }
    var misa = v === 'misa' && AppState.misas.find(function(m){ return m.id === AppState.misaId; });
    if(misa){ renderMisa(misa); return; }
    if(v === 'misa' && !AppState.misasLoaded){ document.getElementById('panel').innerHTML = '<p class="empty">Cargando…</p>'; return; }
    AppState.cancioneroVista = 'misas';
    renderLista();
  }

  // ---- Lista de misas ----
  function renderLista(){
    var panel = document.getElementById('panel');
    var html = backBtn('Cancionero');
    html += '<div class="panel-head"><div><h2>Misas</h2><p class="mandos-sub">Armá el repertorio de una misa con los cantos del cancionero.</p></div>';
    html += '<div class="recursos-head-actions"><button type="button" class="btn small" id="misaNewBtn">+ Crear misa</button></div></div>';
    var misas = AppState.misas.slice().sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
    if(!AppState.misasLoaded){
      html += '<p class="empty">Cargando…</p>';
    } else if(!misas.length){
      html += '<p class="empty">Todavía no hay misas armadas.</p>';
    } else {
      html += '<div class="canto-list">';
      misas.forEach(function(m){
        html += '<button type="button" class="canto-item" data-misa="' + escapeHtml(m.id) + '">' +
          '<span class="canto-item-text"><span class="canto-item-title">' + escapeHtml(m.nombre) + '</span>' +
          (m.subtitulo ? '<span class="canto-item-sub">' + escapeHtml(m.subtitulo) + '</span>' : '') +
          '<span class="canto-item-sub">Por ' + escapeHtml(m.autor || '—') + ' · ' + fecha(m.createdAt) + '</span></span>' +
          icon('chevron-right') + '</button>';
      });
      html += '</div>';
    }
    panel.innerHTML = html;
    document.getElementById('misasBackBtn').onclick = function(){ AppState.cancioneroVista = ''; renderPanel(); };
    document.getElementById('misaNewBtn').onclick = function(){
      AppState.misaDraft = { nombre: '', subtitulo: '', tipo: '', momentos: {} };
      AppState.cancioneroVista = 'misaEdit';
      renderPanel();
      window.scrollTo(0, 0);
    };
    panel.querySelectorAll('[data-misa]').forEach(function(btn){
      btn.onclick = function(){
        AppState.misaId = btn.getAttribute('data-misa');
        AppState.misaOpenIdx = null;
        AppState.cancioneroVista = 'misa';
        renderPanel();
        window.scrollTo(0, 0);
      };
    });
  }

  // ---- Una misa: desplegables (uno abierto a la vez) ----
  // Filas de la misa: un renglón por canto elegido; un momento del ordinario
  // sin canto figura como "Rezado".
  // Notas del rito que van antes de cada momento (30/10/2026, pedido del
  // usuario): qué pasa en el medio, según el tipo de día. Se muestran aunque
  // ese momento no tenga canto, como guía de por dónde va la misa.
  function notaAntes(momId, tipo){
    var credo = tipo === 'mayor';
    var gloria = tipo !== 'menor';
    switch(momId){
      case 'entrada': return 'Al entrar el sacerdote en procesión.';
      case 'kyrie': return 'Después del saludo y el acto penitencial.';
      case 'salmo': return (gloria ? '' : 'No hay Gloria. ') + 'Oración colecta y primera lectura.';
      case 'aleluya': return credo ? 'Segunda lectura.' : 'No hay segunda lectura: después del salmo, el Aleluya antes del Evangelio.';
      case 'credo': return 'Evangelio y homilía.';
      case 'ofertorio': return credo
        ? 'Terminado el Credo, oración de los fieles. Después arranca el ofertorio (presentación de los dones).'
        : 'Evangelio y homilía. No hay Credo: después de la homilía, oración de los fieles, y arranca el ofertorio (presentación de los dones).';
      case 'santo': return 'Oración sobre las ofrendas y prefacio. Al terminar el prefacio se canta el Santo.';
      case 'padrenuestro': return 'Plegaria eucarística y consagración. Después del «Por Cristo, con Él y en Él… Amén».';
      case 'cordero': return 'Rito de la paz. Durante la fracción del pan.';
      case 'comunion': return 'Mientras se distribuye la comunión.';
      case 'poscomunion': return 'Terminada la comunión, en el silencio de acción de gracias.';
      case 'salida': return 'Oración después de la comunión, bendición y despedida.';
    }
    return '';
  }

  function filasDe(m){
    var filas = [];
    momentosDe(m.tipo).forEach(function(mom){
      var nota = notaAntes(mom.id, m.tipo);
      if(nota) filas.push({ nota: nota });
      var ids = (m.momentos && m.momentos[mom.id]) || [];
      var cantos = ids.map(cantoPorId).filter(Boolean);
      if(cantos.length){ cantos.forEach(function(c){ filas.push({ momento: mom, canto: c }); }); }
      else if(mom.ordinario){ filas.push({ momento: mom, canto: null }); }
    });
    return filas;
  }

  function renderMisa(m){
    var panel = document.getElementById('panel');
    var html = backBtn('Misas');
    html += '<div class="panel-head"><div><h2>' + escapeHtml(m.nombre) + '</h2>';
    if(m.subtitulo) html += '<p class="misa-subtitulo">' + escapeHtml(m.subtitulo) + '</p>';
    html += '<p class="mandos-sub">Creada por ' + escapeHtml(m.autor || '—') + ' · ' + fecha(m.createdAt) + '<br>' + escapeHtml(tipoLabel(m.tipo)) + '</p></div>';
    html += '<div class="recursos-head-actions"><button type="button" class="btn ghost small" id="misaPdfBtn">' + icon('download') + ' PDF</button>';
    if(canEditMisa(m)){
      html += '<button type="button" class="btn ghost small" id="misaEditBtn">' + icon('pencil') + ' Editar</button>' +
        '<button type="button" class="btn ghost small" id="misaDeleteBtn" aria-label="Eliminar misa" title="Eliminar">' + icon('trash') + '</button>';
    }
    html += '</div></div>';
    if(!AppState.cancioneroLoaded){ html += '<p class="empty">Cargando cantos…</p>'; }
    html += '<div class="misa-momentos">';
    filasDe(m).forEach(function(f, idx){
      if(f.nota){
        html += '<p class="misa-nota">' + escapeHtml(f.nota) + '</p>';
        return;
      }
      if(!f.canto){
        html += '<div class="misa-momento misa-momento-rezado"><span class="misa-momento-label">' + escapeHtml(f.momento.label) + '</span><span class="misa-momento-titulo">Rezado</span></div>';
        return;
      }
      // Si llega un cambio de Firestore mientras se canta, el que estaba abierto sigue abierto.
      html += '<details class="misa-momento" data-idx="' + idx + '"' + (AppState.misaOpenIdx === idx ? ' open' : '') + '><summary>' +
        '<span class="misa-momento-label">' + escapeHtml(f.momento.label) + '</span>' +
        '<span class="misa-momento-titulo">' + escapeHtml(f.canto.titulo) + '</span>' + icon('chevron-right') +
        '</summary><div class="canto-letra">' + letraHtml(f.canto) + '</div></details>';
    });
    html += '</div>';
    panel.innerHTML = html;

    document.getElementById('misasBackBtn').onclick = function(){ AppState.cancioneroVista = 'misas'; renderPanel(); };
    document.getElementById('misaPdfBtn').onclick = function(){ exportarPdf(m); };
    var edit = document.getElementById('misaEditBtn');
    if(edit) edit.onclick = function(){
      AppState.misaDraft = JSON.parse(JSON.stringify(m));
      AppState.cancioneroVista = 'misaEdit';
      renderPanel();
      window.scrollTo(0, 0);
    };
    var del = document.getElementById('misaDeleteBtn');
    if(del) del.onclick = async function(){
      if(!(await showConfirm('¿Eliminar la misa «' + m.nombre + '»?'))) return;
      try{
        await deleteMisa(m.id);
        AppState.cancioneroVista = 'misas';
        renderPanel();
        showStatus('Misa eliminada.');
      }catch(err){
        console.error(err);
        showAlert('No se pudo eliminar: ' + (err.message || err));
      }
    };
    // Uno abierto a la vez, y el que se abre queda arriba de la pantalla.
    var all = panel.querySelectorAll('details.misa-momento');
    all.forEach(function(d){
      d.addEventListener('toggle', function(){
        var idx = Number(d.getAttribute('data-idx'));
        if(!d.open){ if(AppState.misaOpenIdx === idx) AppState.misaOpenIdx = null; return; }
        if(AppState.misaOpenIdx === idx) return; // reabierto por un re-render
        AppState.misaOpenIdx = idx;
        all.forEach(function(o){ if(o !== d) o.open = false; });
        d.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });
  }

  // ---- PDF: diálogo de impresión con solo la misa ("Guardar como PDF") ----
  function exportarPdf(m){
    var old = document.getElementById('misaPrint');
    if(old) old.remove();
    var div = document.createElement('div');
    div.id = 'misaPrint';
    var html = '<h1>' + escapeHtml(m.nombre) + '</h1>';
    if(m.subtitulo) html += '<p class="misa-print-sub">' + escapeHtml(m.subtitulo) + '</p>';
    html += '<p class="misa-print-meta">' + escapeHtml(tipoLabel(m.tipo)) + ' · Creada por ' + escapeHtml(m.autor || '—') + '</p>';
    // Índice al principio, para ubicar cada canto rápido en papel.
    var filas = filasDe(m);
    html += '<ol class="misa-print-indice">';
    filas.forEach(function(f){
      if(f.nota) return;
      html += '<li><strong>' + escapeHtml(f.momento.label) + ':</strong> ' + (f.canto ? escapeHtml(f.canto.titulo) : 'Rezado') + '</li>';
    });
    html += '</ol>';
    filas.forEach(function(f){
      if(f.nota){ html += '<p class="misa-print-nota">' + escapeHtml(f.nota) + '</p>'; return; }
      if(!f.canto){ html += '<p class="misa-print-nota"><strong>' + escapeHtml(f.momento.label) + ':</strong> rezado.</p>'; return; }
      html += '<section class="misa-print-canto"><h2><span>' + escapeHtml(f.momento.label) + '</span> ' + escapeHtml(f.canto.titulo) + '</h2>' + letraHtml(f.canto) + '</section>';
    });
    div.innerHTML = html;
    document.body.appendChild(div);
    var prevTitle = document.title;
    document.title = m.nombre; // nombre sugerido del PDF
    document.body.classList.add('printing-misa');
    var done = false;
    function cleanup(){
      if(done) return;
      done = true;
      document.body.classList.remove('printing-misa');
      document.title = prevTitle;
      div.remove();
      window.removeEventListener('afterprint', cleanup);
    }
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1000);
  }

  // ---- Editor ----
  // Completa los momentos del ordinario que todavía no tienen nada.
  function completarOrdinario(d){
    momentosDe(d.tipo).forEach(function(mom){
      if(!mom.ordinario || d.momentos[mom.id]) return;
      var c = sortedCantos().find(function(c){ return c.categoria === 'ordinario' && mom.ordinario.test(norm(c.titulo)); });
      d.momentos[mom.id] = c ? [c.id] : [];
    });
  }

  function renderEditor(){
    var panel = document.getElementById('panel');
    var d = AppState.misaDraft;
    var html = backBtn('Misas');
    html += '<div class="panel-head"><div><h2>' + (d.id ? 'Editar misa' : 'Crear misa') + '</h2></div></div>';

    html += '<h3 class="canto-cat-title">¿Qué día es?</h3><div class="misa-tipos">';
    MISA_TIPOS.forEach(function(t){
      html += '<button type="button" class="misa-tipo' + (d.tipo === t.id ? ' active' : '') + '" data-misa-tipo="' + t.id + '">' +
        '<strong>' + escapeHtml(t.label) + '</strong><span>' + escapeHtml(t.sub) + '</span></button>';
    });
    html += '</div>';

    if(d.tipo){
      completarOrdinario(d);
      html += '<h3 class="canto-cat-title">Repertorio</h3><div class="misa-edit-momentos">';
      momentosDe(d.tipo).forEach(function(mom){
        var ids = d.momentos[mom.id] || [];
        html += '<div class="misa-edit-momento"><div class="misa-edit-head"><strong>' + escapeHtml(mom.label) + '</strong>' +
          (mom.ordinario ? '<span class="tag tag-muted">Ordinario</span>' : '') + '</div>';
        ids.forEach(function(id, i){
          var c = cantoPorId(id);
          html += '<div class="misa-edit-canto"><span>' + escapeHtml(c ? c.titulo : '(canto borrado)') + '</span>' +
            '<button type="button" data-quitar="' + mom.id + ':' + i + '" aria-label="Quitar" title="Quitar">' + icon('x') + '</button></div>';
        });
        if(!ids.length && mom.ordinario) html += '<p class="mandos-sub misa-edit-vacio">Rezado (sin canto)</p>';
        html += '<button type="button" class="btn ghost small" data-elegir="' + mom.id + '">+ ' + (ids.length ? 'Otro canto' : 'Elegir canto') + '</button></div>';
      });
      html += '</div>';

      html += '<h3 class="canto-cat-title">Datos</h3>';
      html += '<div class="form-row"><label for="misaNombre">Nombre</label><input type="text" id="misaNombre" placeholder="Ej: Misa del jueves" value="' + escapeHtml(d.nombre) + '"></div>';
      html += '<div class="form-row"><label for="misaSubtitulo">Subtítulo (opcional)</label><input type="text" id="misaSubtitulo" placeholder="Ej: Temática: el Bautismo" value="' + escapeHtml(d.subtitulo) + '"></div>';
      html += '<div class="form-actions misa-edit-actions"><button type="button" class="btn ghost" id="misaCancelBtn">Cancelar</button>' +
        '<button type="button" class="btn" id="misaSaveBtn">Guardar misa</button></div>';
    }
    panel.innerHTML = html;

    function volver(){
      var id = d.id;
      AppState.misaDraft = null;
      AppState.cancioneroVista = id ? 'misa' : 'misas';
      renderPanel();
    }
    document.getElementById('misasBackBtn').onclick = volver;
    panel.querySelectorAll('[data-misa-tipo]').forEach(function(btn){
      btn.onclick = function(){ d.tipo = btn.getAttribute('data-misa-tipo'); renderPanel(); };
    });
    if(!d.tipo) return;
    var nombre = document.getElementById('misaNombre');
    var subtitulo = document.getElementById('misaSubtitulo');
    nombre.oninput = function(){ d.nombre = nombre.value; };
    subtitulo.oninput = function(){ d.subtitulo = subtitulo.value; };
    panel.querySelectorAll('[data-quitar]').forEach(function(btn){
      btn.onclick = function(){
        var p = btn.getAttribute('data-quitar').split(':');
        d.momentos[p[0]].splice(Number(p[1]), 1);
        renderPanel();
      };
    });
    panel.querySelectorAll('[data-elegir]').forEach(function(btn){
      btn.onclick = function(){
        var mom = MOMENTOS.find(function(m){ return m.id === btn.getAttribute('data-elegir'); });
        elegirCanto(mom, function(id){
          var lista = d.momentos[mom.id] = d.momentos[mom.id] || [];
          if(lista.indexOf(id) === -1) lista.push(id);
          renderPanel();
        });
      };
    });
    document.getElementById('misaCancelBtn').onclick = volver;
    document.getElementById('misaSaveBtn').onclick = async function(){
      var n = d.nombre.trim();
      if(!n){ nombre.focus(); showAlert('Ponele un nombre a la misa.'); return; }
      var momentos = {};
      momentosDe(d.tipo).forEach(function(mom){ momentos[mom.id] = d.momentos[mom.id] || []; });
      var misa = {
        id: d.id || 'misa-' + uid(),
        nombre: n,
        subtitulo: (d.subtitulo || '').trim(),
        tipo: d.tipo,
        momentos: momentos,
        uid: d.uid || AppState.currentUser.uid,
        autor: d.autor || AppState.currentUser.displayName || '',
        createdAt: d.createdAt || Date.now()
      };
      try{
        await saveMisa(misa);
        // Se muestra ya, sin esperar a que vuelva de Firestore.
        AppState.misas = AppState.misas.filter(function(x){ return x.id !== misa.id; }).concat([misa]);
        AppState.misaDraft = null;
        AppState.misaId = misa.id;
        AppState.misaOpenIdx = null;
        AppState.cancioneroVista = 'misa';
        renderPanel();
        window.scrollTo(0, 0);
        showStatus('Misa guardada.');
      }catch(err){
        console.error(err);
        showAlert('No se pudo guardar: ' + (err.message || err));
      }
    };
  }

  // Diálogo para elegir un canto: primero los de las categorías sugeridas
  // para ese momento; con «Ver todos» (o buscando) aparece todo el cancionero.
  function elegirCanto(mom, onPick){
    var todos = false;
    var overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML =
      '<div class="app-dialog-box canto-dialog misa-picker" role="dialog" aria-modal="true">' +
      '  <h3 style="margin:0 0 10px">' + escapeHtml(mom.label) + '</h3>' +
      '  <div class="cancionero-search">' + icon('search') + '<input type="search" id="misaPickSearch" placeholder="Buscar por título o letra…" autocomplete="off"></div>' +
      '  <label class="misa-picker-todos"><input type="checkbox" id="misaPickTodos"> Ver todo el cancionero</label>' +
      '  <div id="misaPickLista" class="misa-picker-lista"></div>' +
      '  <div class="app-dialog-actions" style="margin-top:12px"><button type="button" class="btn ghost small" id="misaPickCancel">Cancelar</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    var search = overlay.querySelector('#misaPickSearch');
    var lista = overlay.querySelector('#misaPickLista');
    function pintar(){
      var q = norm(search.value).trim();
      var cantos = sortedCantos().filter(function(c){
        if(q) return norm(c.titulo).indexOf(q) !== -1 || norm(textoDe(c)).indexOf(q) !== -1;
        return todos || mom.cats.indexOf(c.categoria) !== -1;
      });
      if(!cantos.length){ lista.innerHTML = '<p class="empty">No hay cantos que coincidan.</p>'; return; }
      var html = '', last = null;
      cantos.forEach(function(c){
        if(c.categoria !== last){
          if(last !== null) html += '</div>';
          last = c.categoria;
          html += '<h4 class="canto-cat-title">' + escapeHtml(catLabel(c.categoria)) + '</h4><div class="canto-list">';
        }
        html += '<button type="button" class="canto-item" data-pick="' + escapeHtml(c.id) + '"><span class="canto-item-text"><span class="canto-item-title">' + escapeHtml(c.titulo) + '</span></span>' + icon('chevron-right') + '</button>';
      });
      lista.innerHTML = html + '</div>';
      lista.querySelectorAll('[data-pick]').forEach(function(b){
        b.onclick = function(){ close(); onPick(b.getAttribute('data-pick')); };
      });
    }
    function close(){
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }
    function onKey(e){ if(e.key === 'Escape') close(); }
    search.oninput = pintar;
    overlay.querySelector('#misaPickTodos').onchange = function(e){ todos = e.target.checked; pintar(); };
    overlay.querySelector('#misaPickCancel').onclick = close;
    overlay.onclick = function(e){ if(e.target === overlay) close(); };
    document.addEventListener('keydown', onKey);
    pintar();
    search.focus();
  }
