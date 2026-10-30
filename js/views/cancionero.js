// "Cancionero" (T6 E2, 30/10/2026), adentro de Recursos → Vida espiritual
// (AppState.recursosCategoria === 'cancionero'): letras de marchas y cantos de
// Misa, con buscador (título y letra, sin importar acentos) y filtro por
// categoría. Al tocar un canto se ve la letra entera. Lo editan los mismos
// que pueden cargar Recursos (`canEditCancionero()`), con un diálogo propio.

import { AppState } from '../app-state.js';
import { CANCIONERO_CATEGORIAS } from '../config/constants.js';
import { escapeHtml, uid } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';
import { canEditCancionero, isAdmin } from '../services/permissions.js';
import { ensureCancioneroSub, saveCanto, deleteCanto, importCancionero } from '../services/cancionero.service.js';
import { showAlert, showConfirm } from '../components/dialog.js';
import { renderPanel, showStatus } from '../main.js';

  function norm(s){
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function catLabel(id){
    var c = CANCIONERO_CATEGORIAS.find(function(c){ return c.id === id; });
    return c ? c.label : 'Otros cantos';
  }

  function catIndex(id){
    var i = CANCIONERO_CATEGORIAS.findIndex(function(c){ return c.id === id; });
    return i === -1 ? CANCIONERO_CATEGORIAS.length : i;
  }

  function sortedCantos(){
    return AppState.cancionero.slice().sort(function(a, b){
      return (catIndex(a.categoria) - catIndex(b.categoria)) ||
        ((a.orden != null ? a.orden : 1e9) - (b.orden != null ? b.orden : 1e9)) ||
        (a.titulo || '').localeCompare(b.titulo || '');
    });
  }

  function textoDe(canto){
    return (canto.estrofas || []).map(function(e){ return (e.lineas || []).join(' '); }).join(' ');
  }

  // Primera línea de la letra, como adelanto debajo del título.
  function primeraLinea(canto){
    var e = (canto.estrofas || []).find(function(e){ return e.tipo !== 'traduccion' && (e.lineas || []).length; });
    return e ? e.lineas[0] : '';
  }

  function filtrar(){
    var q = norm(AppState.cancioneroBusqueda).trim();
    return sortedCantos().filter(function(c){
      if(AppState.cancioneroCategoria && c.categoria !== AppState.cancioneroCategoria) return false;
      if(!q) return true;
      return norm(c.titulo).indexOf(q) !== -1 || norm(textoDe(c)).indexOf(q) !== -1;
    });
  }

  function listaHtml(){
    var cantos = filtrar();
    if(!cantos.length){
      return '<p class="empty">' + (AppState.cancionero.length ? 'No hay cantos que coincidan.' : 'Todavía no hay cantos cargados.') + '</p>';
    }
    var q = norm(AppState.cancioneroBusqueda).trim();
    var html = '';
    var lastCat = null;
    cantos.forEach(function(c){
      if(c.categoria !== lastCat){
        if(lastCat !== null) html += '</div>';
        lastCat = c.categoria;
        html += '<h3 class="canto-cat-title">' + escapeHtml(catLabel(c.categoria)) + '</h3><div class="canto-list">';
      }
      // Si se buscó algo que está en la letra (no en el título), se muestra esa línea.
      var sub = primeraLinea(c);
      if(q && norm(c.titulo).indexOf(q) === -1){
        (c.estrofas || []).some(function(e){
          return (e.lineas || []).some(function(l){ if(norm(l).indexOf(q) !== -1){ sub = l; return true; } return false; });
        });
      }
      html += '<button type="button" class="canto-item" data-canto="' + escapeHtml(c.id) + '">' +
        '<span class="canto-item-text"><span class="canto-item-title">' + escapeHtml(c.titulo) + '</span>' +
        (sub ? '<span class="canto-item-sub">' + escapeHtml(sub) + '</span>' : '') + '</span>' +
        icon('chevron-right') + '</button>';
    });
    return html + '</div>';
  }

  function cantoHtml(c, canEdit){
    var html = '<button type="button" class="recursos-back" id="cancioneroBackBtn">' + icon('chevron-left') + ' Cancionero</button>';
    html += '<div class="panel-head"><div><h2>' + escapeHtml(c.titulo) + '</h2>';
    html += '<p class="mandos-sub">' + escapeHtml(catLabel(c.categoria)) + '</p></div>';
    if(canEdit){
      html += '<div class="recursos-head-actions">' +
        '<button type="button" class="btn ghost small" id="cantoEditBtn">' + icon('pencil') + ' Editar</button>' +
        '<button type="button" class="btn ghost small" id="cantoDeleteBtn" aria-label="Eliminar canto" title="Eliminar">' + icon('trash') + '</button>' +
        '</div>';
    }
    html += '</div>';
    html += '<div class="canto-letra">';
    if((c.nota || '').trim()) html += '<p class="canto-nota">' + escapeHtml(c.nota) + '</p>';
    (c.estrofas || []).forEach(function(e){
      var cls = e.tipo === 'estribillo' ? ' canto-estribillo' : (e.tipo === 'traduccion' ? ' canto-traduccion' : '');
      html += '<p class="canto-estrofa' + cls + '">' + (e.lineas || []).map(escapeHtml).join('<br>') + '</p>';
    });
    if(!(c.estrofas || []).length) html += '<p class="empty">Este canto todavía no tiene letra.</p>';
    return html + '</div>';
  }

  export function renderCancioneroPanel(){
    var panel = document.getElementById('panel');
    ensureCancioneroSub();
    var canEdit = canEditCancionero();
    var abierto = AppState.cancioneroCantoId && AppState.cancionero.find(function(c){ return c.id === AppState.cancioneroCantoId; });
    if(AppState.cancioneroCantoId && !abierto && AppState.cancioneroLoaded){ AppState.cancioneroCantoId = null; }

    if(abierto){
      panel.innerHTML = cantoHtml(abierto, canEdit);
      attachCantoEvents(abierto);
      return;
    }

    var html = '<button type="button" class="recursos-back" id="cancioneroUpBtn">' + icon('chevron-left') + ' Vida espiritual</button>';
    html += '<div class="panel-head"><div><h2>Cancionero</h2>';
    html += '<p class="mandos-sub">Marchas, canciones FASTA y cantos de Misa.</p></div>';
    if(canEdit){
      html += '<div class="recursos-head-actions"><button type="button" class="btn small" id="cantoAddBtn">+ Agregar canto</button></div>';
    }
    html += '</div>';

    if(!AppState.cancioneroLoaded){
      panel.innerHTML = html + '<p class="empty">Cargando…</p>';
      document.getElementById('cancioneroUpBtn').onclick = salir;
      return;
    }

    if(isAdmin() && !AppState.cancionero.length){
      html += '<div class="home-card cancionero-import"><p>El cancionero está vacío. Importá las letras iniciales (<code>seed-data/cancionero.json</code>).</p>' +
        '<button type="button" class="btn small" id="cancioneroImportBtn">📥 Importar cancionero</button> <span class="mandos-sub" id="cancioneroImportStatus"></span></div>';
    }

    html += '<div class="cancionero-search">' + icon('search') +
      '<input type="search" id="cancioneroSearch" placeholder="Buscar por título o letra…" value="' + escapeHtml(AppState.cancioneroBusqueda) + '" autocomplete="off"></div>';

    var usadas = CANCIONERO_CATEGORIAS.filter(function(c){ return AppState.cancionero.some(function(x){ return x.categoria === c.id; }); });
    if(usadas.length > 1){
      html += '<div class="mensaje-dayswitch cancionero-cats">';
      html += '<button class="day-pill' + (!AppState.cancioneroCategoria ? ' active' : '') + '" data-canto-cat="" type="button">Todos</button>';
      usadas.forEach(function(c){
        html += '<button class="day-pill' + (AppState.cancioneroCategoria === c.id ? ' active' : '') + '" data-canto-cat="' + c.id + '" type="button">' + escapeHtml(c.label) + '</button>';
      });
      html += '</div>';
    }

    html += '<div id="cancioneroLista">' + listaHtml() + '</div>';
    panel.innerHTML = html;
    attachListEvents();
  }

  function salir(){
    AppState.recursosCategoria = 'biblia';
    AppState.cancioneroCantoId = null;
    renderPanel();
  }

  // Tarjeta del Cancionero entre las subcategorías de Vida espiritual.
  export function cancioneroTileHtml(){
    ensureCancioneroSub();
    var n = AppState.cancionero.length;
    return '<button type="button" class="recurso-cat" data-recurso-cat="cancionero">' +
      '<span class="recurso-cat-icon">' + icon('music') + '</span>' +
      '<span class="recurso-cat-label">Cancionero</span>' +
      '<span class="recurso-cat-count">' + (n ? n + ' canto' + (n === 1 ? '' : 's') : 'Letras de cantos') + '</span>' +
      '</button>';
  }

  function attachListEvents(){
    var panel = document.getElementById('panel');
    document.getElementById('cancioneroUpBtn').onclick = salir;
    var search = document.getElementById('cancioneroSearch');
    var lista = document.getElementById('cancioneroLista');
    function bindItems(){
      lista.querySelectorAll('[data-canto]').forEach(function(btn){
        btn.onclick = function(){
          AppState.cancioneroCantoId = btn.getAttribute('data-canto');
          renderPanel();
          window.scrollTo(0, 0);
        };
      });
    }
    // Al tipear solo se rehace la lista (así el buscador no pierde el foco).
    search.oninput = function(){
      AppState.cancioneroBusqueda = search.value;
      lista.innerHTML = listaHtml();
      bindItems();
    };
    bindItems();
    panel.querySelectorAll('[data-canto-cat]').forEach(function(btn){
      btn.onclick = function(){
        AppState.cancioneroCategoria = btn.getAttribute('data-canto-cat');
        renderPanel();
      };
    });
    var add = document.getElementById('cantoAddBtn');
    if(add) add.onclick = function(){ openCantoDialog(null); };
    var imp = document.getElementById('cancioneroImportBtn');
    if(imp) imp.onclick = runImport;
  }

  function attachCantoEvents(canto){
    document.getElementById('cancioneroBackBtn').onclick = function(){
      AppState.cancioneroCantoId = null;
      renderPanel();
    };
    var edit = document.getElementById('cantoEditBtn');
    if(edit) edit.onclick = function(){ openCantoDialog(canto); };
    var del = document.getElementById('cantoDeleteBtn');
    if(del) del.onclick = async function(){
      if(!(await showConfirm('¿Eliminar «' + canto.titulo + '» del cancionero?'))) return;
      try{
        await deleteCanto(canto.id);
        AppState.cancioneroCantoId = null;
        renderPanel();
        showStatus('Canto eliminado.');
      }catch(err){
        console.error(err);
        showAlert('No se pudo eliminar: ' + (err.message || err));
      }
    };
  }

  // Letra ↔ texto del diálogo: estrofas separadas por una línea en blanco;
  // una estrofa que arranca con "Estribillo:" o "Traducción:" es de ese tipo.
  function estrofasToText(estrofas){
    return (estrofas || []).map(function(e){
      var head = e.tipo === 'estribillo' ? 'Estribillo:\n' : (e.tipo === 'traduccion' ? 'Traducción:\n' : '');
      return head + (e.lineas || []).join('\n');
    }).join('\n\n');
  }

  function textToEstrofas(text){
    return (text || '').replace(/\r/g, '').split(/\n\s*\n/).map(function(block){
      var lineas = block.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
      var tipo = 'estrofa';
      var m = lineas.length && norm(lineas[0]).match(/^(estribillo|traduccion)\s*(?::\s*(.*))?$/);
      if(m){
        tipo = m[1];
        var resto = lineas[0].replace(/^[^:]*:?\s*/, '');
        lineas = m[2] ? [resto].concat(lineas.slice(1)) : lineas.slice(1);
      }
      return { tipo: tipo, lineas: lineas };
    }).filter(function(e){ return e.lineas.length; });
  }

  function openCantoDialog(canto){
    if(!canEditCancionero()) return;
    var c = canto || { titulo: '', categoria: AppState.cancioneroCategoria || 'marchas', nota: '', estrofas: [] };
    var opts = CANCIONERO_CATEGORIAS.map(function(cat){
      return '<option value="' + cat.id + '"' + (cat.id === c.categoria ? ' selected' : '') + '>' + escapeHtml(cat.label) + '</option>';
    }).join('');
    var overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML =
      '<div class="app-dialog-box canto-dialog" role="dialog" aria-modal="true">' +
      '  <h3 style="margin:0 0 12px">' + (canto ? 'Editar canto' : 'Agregar canto') + '</h3>' +
      '  <div class="form-row"><label for="cantoTitulo">Título</label><input type="text" id="cantoTitulo" value="' + escapeHtml(c.titulo) + '"></div>' +
      '  <div class="form-row"><label for="cantoCategoria">Categoría</label><select id="cantoCategoria">' + opts + '</select></div>' +
      '  <div class="form-row"><label for="cantoNota">Nota (opcional)</label><input type="text" id="cantoNota" placeholder="Ej: autor, cuándo se canta…" value="' + escapeHtml(c.nota || '') + '"></div>' +
      '  <div class="form-row"><label for="cantoLetra">Letra</label><textarea id="cantoLetra" rows="12">' + escapeHtml(estrofasToText(c.estrofas)) + '</textarea>' +
      '  <p class="mandos-sub" style="margin:4px 0 0">Dejá una línea en blanco entre estrofas. Para marcar el estribillo, escribí «Estribillo:» en la primera línea de esa estrofa.</p></div>' +
      '  <div class="app-dialog-actions" style="margin-top:16px">' +
      '    <button type="button" class="btn ghost small" id="cantoCancelBtn">Cancelar</button>' +
      '    <button type="button" class="btn small" id="cantoSaveBtn">Guardar</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(overlay);
    function close(){
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }
    function onKey(e){ if(e.key === 'Escape') close(); }
    overlay.querySelector('#cantoCancelBtn').onclick = close;
    overlay.onclick = function(e){ if(e.target === overlay) close(); };
    overlay.querySelector('#cantoSaveBtn').onclick = async function(){
      var titulo = overlay.querySelector('#cantoTitulo').value.trim();
      if(!titulo){ overlay.querySelector('#cantoTitulo').focus(); return; }
      var next = Object.assign({}, canto || {}, {
        id: canto ? canto.id : 'canto-' + uid(),
        titulo: titulo,
        categoria: overlay.querySelector('#cantoCategoria').value,
        nota: overlay.querySelector('#cantoNota').value.trim(),
        estrofas: textToEstrofas(overlay.querySelector('#cantoLetra').value)
      });
      if(!canto){
        next.orden = AppState.cancionero.reduce(function(m, x){ return Math.max(m, x.orden || 0); }, 0) + 1;
      }
      try{
        await saveCanto(next);
        close();
        AppState.cancioneroCantoId = next.id;
        renderPanel();
        showStatus('Canto guardado.');
      }catch(err){
        console.error(err);
        showAlert('No se pudo guardar: ' + (err.message || err));
      }
    };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#cantoTitulo').focus();
  }

  // Importación inicial: primero intenta leer el archivo del sitio (anda
  // desde el repo privado / localhost); si no está (espejo público), pide
  // elegirlo desde la compu.
  async function runImport(){
    var status = document.getElementById('cancioneroImportStatus');
    var setStatus = function(m){ if(status) status.textContent = m; };
    var json = null;
    try{
      var res = await fetch('seed-data/cancionero.json', { cache: 'no-store' });
      if(res.ok) json = await res.json();
    }catch(e){ /* sin archivo en el sitio: se pide elegirlo */ }
    if(!json) json = await pickJsonFile();
    if(!json) return;
    try{
      var n = await importCancionero(json, setStatus);
      setStatus('');
      showAlert('Listo: se importaron ' + n + ' cantos.');
    }catch(err){
      console.error(err);
      setStatus('');
      showAlert('No se pudo importar: ' + (err.message || err));
    }
  }

  function pickJsonFile(){
    return new Promise(function(resolve){
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = function(){
        var f = input.files && input.files[0];
        if(!f){ resolve(null); return; }
        f.text().then(function(t){ resolve(JSON.parse(t)); }).catch(function(err){
          showAlert('No se pudo leer el archivo: ' + (err.message || err));
          resolve(null);
        });
      };
      input.click();
    });
  }
