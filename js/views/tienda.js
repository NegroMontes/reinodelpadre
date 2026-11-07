// T18 — pestaña «Beneficios» (07/11/2026). Ver tienda.service.js.
import { AppState } from '../app-state.js';
import { escapeHtml } from '../utils/helpers.js';
import { realIsAdmin } from '../services/permissions.js';
import { showAlert, showConfirm } from '../components/dialog.js';
import { renderPanel } from '../main.js';
import {
  tiendaConfig, saldo, canjear, aportar, totalesSubasta, grupoGanando, miAporte, miGrupo, quedan, misCanjes, misCanjesDe,
  subastaAbierta, subastaVencida, guardarConfigTienda, guardarBeneficio, borrarBeneficio,
  cerrarSubasta, reabrirSubasta, setEstadoCanje
} from '../services/tienda.service.js';

  var ESTADOS_CANJE = { pendiente: 'Pendiente de entrega', entregado: 'Entregado', cancelado: 'Cancelado' };

  function fecha(ms){
    if(!ms) return '';
    var d = new Date(ms);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  function ordenados(){
    return (AppState.beneficios || []).slice().sort(function(a, b){ return (a.orden || 0) - (b.orden || 0) || (a.createdAt || 0) - (b.createdAt || 0); });
  }

  function saldoHtml(cfg){
    var s = saldo(), m = escapeHtml(cfg.moneda);
    var html = '<div class="home-card tienda-saldo"><div><span class="mandos-sub">Tu saldo</span>';
    html += '<p class="tienda-saldo-num"><strong>' + s.disponible + '</strong> ' + m + '</p></div>';
    var partes = [];
    if(cfg.usarEntradas) partes.push(s.entradas + ' de entradas');
    if(cfg.usarBonus) partes.push(s.bonus + ' bonus de minijuegos');
    if(s.gastado) partes.push('−' + s.gastado + ' canjeados');
    if(s.reservado) partes.push('−' + s.reservado + ' reservados en subastas');
    html += '<p class="mandos-sub">' + escapeHtml(partes.join(' · ')) + '</p>';
    html += '<p class="mandos-sub">Gastar no te baja el rango.</p></div>';
    return html;
  }

  function beneficioHtml(b, cfg, admin){
    var m = escapeHtml(cfg.moneda), yo = AppState.currentUser.uid;
    var cerrada = b.estado === 'cerrada';
    var html = '<div class="home-card tienda-item' + (cerrada ? ' is-cerrada' : '') + '">';
    html += '<div class="tienda-item-head"><span class="tag ' + (b.tipo === 'subasta' ? 'tag-obligatoria' : 'badge-neutral') + '">' + (b.tipo === 'subasta' ? 'Subasta' : 'Canje') + '</span>';
    if(admin) html += '<span class="tienda-item-admin"><button type="button" class="btn small ghost" data-tienda-edit="' + b.id + '">Editar</button><button type="button" class="btn small ghost" data-tienda-del="' + b.id + '">Borrar</button></span>';
    html += '</div>';
    html += '<h3>' + escapeHtml(b.titulo || '(sin título)') + '</h3>';
    if(b.desc) html += '<p class="mandos-sub">' + escapeHtml(b.desc) + '</p>';
    if(b.tipo === 'subasta'){
      // Subasta por comando: cada uno aporta a la puja de su sección/depto.
      var tot = totalesSubasta(b.id), gan = grupoGanando(b), mg = miGrupo();
      var mio = tot.find(function(t){ return t.grupo === mg; });
      var base = Math.max(1, Number(b.precio) || 0);
      html += '<p class="mandos-sub">Pujan los comandos: cada uno aporta lo que quiera a la puja de su sección o departamento. Puja inicial: ' + base + ' ' + m + '.</p>';
      if(tot.length){
        html += '<ol class="tienda-ranking">' + tot.map(function(t, i){
          var es = t.grupo === mg;
          return '<li class="' + (es ? 'es-mio' : '') + '"><span>' + escapeHtml(t.grupo) + (es ? ' <span class="tag">tu comando</span>' : '') + '</span><strong>' + t.total + '</strong>' +
            (admin ? '<span class="mandos-sub tienda-aportantes">' + escapeHtml(t.aportes.map(function(a){ return (a.nombre || '?') + ' ' + a.monto; }).join(' · ')) + '</span>' : '') + '</li>';
        }).join('') + '</ol>';
      } else {
        html += '<p class="mandos-sub">Todavía ningún comando pujó.</p>';
      }
      if(cerrada){
        html += '<p class="mandos-sub">Cerrada. ' + (b.ganadorGrupo ? 'Ganó ' + escapeHtml(b.ganadorGrupo) + ' con ' + b.montoGanador + ' ' + m + '.' : 'Ningún comando llegó a la puja inicial.') + '</p>';
        if(admin) html += '<button type="button" class="btn small ghost" data-tienda-reabrir="' + b.id + '">Reabrir</button>';
      } else {
        html += '<p>' + escapeHtml(mg) + ': <strong>' + (mio ? mio.total : 0) + '</strong> ' + m + ' (vos: ' + miAporte(b.id) + ')' + (gan && gan.grupo === mg ? ' <span class="tag">¡van ganando!</span>' : '') + '</p>';
        if(b.cierre) html += '<p class="mandos-sub">' + (subastaVencida(b) ? 'Terminó el ' + fecha(b.cierre) + (admin ? ': falta cerrarla.' : '. Falta que la cierre el admin.') : 'Cierra el ' + fecha(b.cierre)) + '</p>';
        if(!subastaVencida(b)){
          html += '<div class="tienda-pujar"><input type="number" min="1" step="1" value="1" data-tienda-monto="' + b.id + '" aria-label="Cuánto aportás">';
          html += '<button type="button" class="btn small" data-tienda-pujar="' + b.id + '">Aportar</button></div>';
        }
        if(admin) html += '<button type="button" class="btn small neutral" data-tienda-cerrar="' + b.id + '">Cerrar subasta</button>';
      }
    } else {
      var q = quedan(b), mios = misCanjesDe(b.id);
      html += '<p><strong>' + (b.precio || 0) + '</strong> ' + m + '</p>';
      var info = [];
      if(q !== Infinity) info.push(q + (q === 1 ? ' disponible' : ' disponibles'));
      if(b.limite) info.push('máximo ' + b.limite + ' por persona');
      if(mios) info.push('ya canjeaste ' + mios);
      if(info.length) html += '<p class="mandos-sub">' + escapeHtml(info.join(' · ')) + '</p>';
      var no = cerrada || q <= 0 || (b.limite && mios >= b.limite);
      html += '<button type="button" class="btn small" data-tienda-canjear="' + b.id + '"' + (no ? ' disabled' : '') + '>' + (q <= 0 ? 'Agotado' : 'Canjear') + '</button>';
    }
    html += '</div>';
    return html;
  }

  function misCanjesHtml(cfg){
    var c = misCanjes().slice().sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
    if(!c.length) return '';
    var html = '<h3 class="tienda-titulo">Mis canjes</h3><ul class="tienda-canjes">';
    c.forEach(function(x){
      html += '<li><span>' + escapeHtml(x.titulo || '') + (x.tipo === 'subasta' ? ' (subasta' + (x.grupo ? ', ' + escapeHtml(x.grupo) : '') + ')' : '') + '</span><span class="mandos-sub">' + x.monto + ' ' + escapeHtml(cfg.moneda) + ' · ' + escapeHtml(ESTADOS_CANJE[x.estado] || x.estado) + '</span></li>';
    });
    return html + '</ul>';
  }

  function canjesAdminHtml(cfg){
    var c = (AppState.canjes || []).slice().sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
    var pend = c.filter(function(x){ return x.estado === 'pendiente'; }).length;
    var html = '<details class="home-card tienda-admin-canjes"' + (AppState.tiendaCanjesOpen ? ' open' : '') + ' id="tiendaCanjesFold"><summary><h3>Canjes de todos (' + c.length + (pend ? ' · ' + pend + ' pendientes' : '') + ')</h3></summary>';
    if(!c.length) return html + '<p class="mandos-sub">Todavía nadie canjeó nada.</p></details>';
    html += '<ul class="tienda-canjes">';
    c.forEach(function(x){
      html += '<li><span><strong>' + escapeHtml(x.nombre || '') + '</strong>' + (x.grupo ? ' (' + escapeHtml(x.grupo) + ')' : '') + ' · ' + escapeHtml(x.titulo || '') + ' <span class="mandos-sub">(' + x.monto + ' ' + escapeHtml(cfg.moneda) + ', ' + fecha(x.createdAt) + ')</span></span>';
      html += '<select data-tienda-canje="' + x.id + '">' + Object.keys(ESTADOS_CANJE).map(function(k){ return '<option value="' + k + '"' + (x.estado === k ? ' selected' : '') + '>' + ESTADOS_CANJE[k] + '</option>'; }).join('') + '</select></li>';
    });
    return html + '</ul></details>';
  }

  export function renderTiendaPanel(){
    var cfg = tiendaConfig(), admin = realIsAdmin();
    var html = '<div class="panel-head"><div><h2>' + escapeHtml(cfg.titulo) + '</h2>';
    html += '<p class="mandos-sub">Gastá tus ' + escapeHtml(cfg.moneda) + ' en beneficios para el campamento, o pujá en las subastas.</p></div>';
    if(admin) html += '<div class="tienda-head-actions"><button type="button" class="btn small ghost" id="tiendaConfigBtn">Configurar</button><button type="button" class="btn small" id="tiendaNuevoBtn">+ Nuevo beneficio</button></div>';
    html += '</div>';
    if(admin && !cfg.activa) html += '<p class="info-callout tienda-apagado">El evento está apagado: solo vos ves esta pestaña. Prendelo desde tu Perfil.</p>';
    if(cfg.nota) html += '<p class="mandos-sub tienda-nota">' + escapeHtml(cfg.nota) + '</p>';
    html += saldoHtml(cfg);
    var items = ordenados();
    if(!AppState.beneficiosLoaded) html += '<p class="mandos-sub">Cargando…</p>';
    else if(!items.length) html += '<p class="mandos-sub">Todavía no hay beneficios cargados.</p>';
    else html += '<div class="tienda-grid">' + items.map(function(b){ return beneficioHtml(b, cfg, admin); }).join('') + '</div>';
    html += misCanjesHtml(cfg);
    if(admin) html += canjesAdminHtml(cfg);
    return html;
  }

  function buscar(id){ return (AppState.beneficios || []).find(function(b){ return b.id === id; }); }

  function avisar(msg){ if(msg) showAlert(msg); }

  export function attachTiendaEvents(){
    var q = function(sel, fn){ document.querySelectorAll(sel).forEach(fn); };
    q('[data-tienda-canjear]', function(el){ el.onclick = async function(){
      var b = buscar(el.getAttribute('data-tienda-canjear')); if(!b) return;
      if(!(await showConfirm('¿Canjear «' + b.titulo + '» por ' + b.precio + ' ' + tiendaConfig().moneda + '?'))) return;
      el.disabled = true;
      var err = await canjear(b);
      if(err){ el.disabled = false; avisar(err); } else showAlert('¡Listo! Canjeaste «' + b.titulo + '». El comando te lo va a entregar.');
    }; });
    q('[data-tienda-pujar]', function(el){ el.onclick = async function(){
      var id = el.getAttribute('data-tienda-pujar'), b = buscar(id); if(!b) return;
      var inp = document.querySelector('[data-tienda-monto="' + id + '"]');
      var monto = inp ? inp.value : 0;
      if(!(await showConfirm('¿Aportar ' + monto + ' ' + tiendaConfig().moneda + ' a la puja de ' + miGrupo() + ' por «' + b.titulo + '»? Quedan reservados hasta que cierre: si gana tu comando se descuentan, si no, vuelven. No se pueden retirar.'))) return;
      el.disabled = true;
      var err = await aportar(b, monto);
      el.disabled = false; avisar(err);
    }; });
    if(!realIsAdmin()) return;
    var cfgBtn = document.getElementById('tiendaConfigBtn'); if(cfgBtn) cfgBtn.onclick = openConfigDialog;
    var nuevo = document.getElementById('tiendaNuevoBtn'); if(nuevo) nuevo.onclick = function(){ openBeneficioDialog(null); };
    q('[data-tienda-edit]', function(el){ el.onclick = function(){ openBeneficioDialog(buscar(el.getAttribute('data-tienda-edit'))); }; });
    q('[data-tienda-del]', function(el){ el.onclick = async function(){
      var b = buscar(el.getAttribute('data-tienda-del')); if(!b) return;
      if(!(await showConfirm('¿Borrar «' + b.titulo + '»? Los canjes ya hechos quedan.'))) return;
      borrarBeneficio(b.id).catch(function(e){ console.error(e); showAlert('No se pudo borrar.'); });
    }; });
    q('[data-tienda-cerrar]', function(el){ el.onclick = async function(){
      var b = buscar(el.getAttribute('data-tienda-cerrar')); if(!b) return;
      var g = grupoGanando(b);
      if(!(await showConfirm(g ? 'Cerrar la subasta: gana ' + g.grupo + ' con ' + g.total + ' ' + tiendaConfig().moneda + ' (se le descuenta a cada uno lo que aportó; al resto se le devuelve).' : 'Cerrar la subasta: ningún comando llegó a la puja inicial, se devuelve todo.'))) return;
      cerrarSubasta(b).catch(function(e){ console.error(e); showAlert('No se pudo cerrar.'); });
    }; });
    q('[data-tienda-reabrir]', function(el){ el.onclick = async function(){
      var b = buscar(el.getAttribute('data-tienda-reabrir')); if(!b) return;
      if(!(await showConfirm('¿Reabrir la subasta? Si ya tenía ganador, cancelá a mano sus canjes en «Canjes de todos».'))) return;
      reabrirSubasta(b).catch(function(e){ console.error(e); showAlert('No se pudo reabrir.'); });
    }; });
    q('[data-tienda-canje]', function(el){ el.onchange = function(){
      var c = (AppState.canjes || []).find(function(x){ return x.id === el.getAttribute('data-tienda-canje'); });
      if(c) setEstadoCanje(c, el.value).catch(function(e){ console.error(e); showAlert('No se pudo cambiar el estado.'); });
    }; });
    var fold = document.getElementById('tiendaCanjesFold');
    if(fold) fold.ontoggle = function(){ AppState.tiendaCanjesOpen = fold.open; };
  }

  /* ---------- diálogos del admin ---------- */

  function dialogo(titulo, cuerpo, alGuardar){
    var overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML = '<div class="app-dialog-box info-general-dialog" role="dialog" aria-modal="true"><h3 style="margin:0 0 12px">' + titulo + '</h3>' + cuerpo +
      '<p class="mandos-sub recurso-dialog-error" id="tdError" hidden></p>' +
      '<div class="app-dialog-actions" style="margin-top:16px"><button type="button" class="btn ghost small" id="tdCancel">Cancelar</button><button type="button" class="btn small" id="tdSave">Guardar</button></div></div>';
    document.body.appendChild(overlay);
    function close(){ document.removeEventListener('keydown', onKey); overlay.remove(); }
    function onKey(e){ if(e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#tdCancel').onclick = close;
    overlay.onclick = function(e){ if(e.target === overlay) close(); };
    overlay.querySelector('#tdSave').onclick = function(){
      var err = alGuardar(overlay);
      if(err){ var p = overlay.querySelector('#tdError'); p.textContent = err; p.hidden = false; return; }
      close();
    };
    return overlay;
  }

  function fila(label, input){ return '<div class="form-row"><label>' + label + '</label>' + input + '</div>'; }

  function openConfigDialog(){
    var c = tiendaConfig();
    dialogo('Configurar el evento',
      fila('Nombre de la pestaña', '<input type="text" id="tdTitulo" value="' + escapeHtml(c.titulo) + '">') +
      fila('Nombre de la moneda', '<input type="text" id="tdMoneda" value="' + escapeHtml(c.moneda) + '" placeholder="Ej: puntos, denarios, talentos">') +
      '<div class="form-row switch-row"><label><input type="checkbox" class="switch" id="tdEntradas"' + (c.usarEntradas ? ' checked' : '') + '> Cuentan los puntos de las entradas</label></div>' +
      '<div class="form-row switch-row"><label><input type="checkbox" class="switch" id="tdBonus"' + (c.usarBonus ? ' checked' : '') + '> Cuentan los puntos bonus de minijuegos</label></div>' +
      fila('Aviso para todos (opcional)', '<textarea id="tdNota" rows="2" placeholder="Ej: Los beneficios se entregan en la intendencia">' + escapeHtml(c.nota || '') + '</textarea>'),
      function(o){
        var titulo = o.querySelector('#tdTitulo').value.trim(), moneda = o.querySelector('#tdMoneda').value.trim();
        if(!titulo || !moneda) return 'Completá el nombre y la moneda.';
        guardarConfigTienda({ titulo: titulo, moneda: moneda, usarEntradas: o.querySelector('#tdEntradas').checked, usarBonus: o.querySelector('#tdBonus').checked, nota: o.querySelector('#tdNota').value.trim() })
          .then(renderPanel).catch(function(e){ console.error(e); showAlert('No se pudo guardar.'); });
        return '';
      });
  }

  function aInputFecha(ms){
    if(!ms) return '';
    var d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }

  function openBeneficioDialog(b){
    var x = b || { tipo: 'compra', precio: 10, stock: null, limite: null };
    var o = dialogo(b ? 'Editar beneficio' : 'Nuevo beneficio',
      fila('Título', '<input type="text" id="tdBTitulo" value="' + escapeHtml(x.titulo || '') + '" placeholder="Ej: Elegir la canción del fogón">') +
      fila('Descripción (opcional)', '<textarea id="tdBDesc" rows="2">' + escapeHtml(x.desc || '') + '</textarea>') +
      fila('Tipo', '<select id="tdBTipo"><option value="compra"' + (x.tipo !== 'subasta' ? ' selected' : '') + '>Canje directo (precio fijo)</option><option value="subasta"' + (x.tipo === 'subasta' ? ' selected' : '') + '>Subasta (gana el que más puja)</option></select>') +
      fila('<span id="tdBPrecioLbl">' + (x.tipo === 'subasta' ? 'Puja inicial (mínimo que tiene que juntar un comando)' : 'Precio') + '</span>', '<input type="number" min="0" step="1" id="tdBPrecio" value="' + (x.precio != null ? x.precio : '') + '">') +
      '<div data-solo="compra">' +
      fila('Cantidad disponible (vacío = sin límite)', '<input type="number" min="0" step="1" id="tdBStock" value="' + (x.stock != null ? x.stock : '') + '">') +
      fila('Máximo por persona (vacío = sin límite)', '<input type="number" min="1" step="1" id="tdBLimite" value="' + (x.limite != null ? x.limite : '') + '">') +
      '</div><div data-solo="subasta">' +
      fila('Cierra el (opcional)', '<input type="datetime-local" id="tdBCierre" value="' + aInputFecha(x.cierre) + '">') +
      '</div>',
      function(o){
        var tipo = o.querySelector('#tdBTipo').value;
        var num = function(id){ var v = o.querySelector(id).value.trim(); return v === '' ? null : Math.max(0, Math.floor(Number(v))); };
        var titulo = o.querySelector('#tdBTitulo').value.trim();
        if(!titulo) return 'Poné un título.';
        var precio = num('#tdBPrecio');
        if(precio == null) return 'Poné un precio.';
        var cierreV = o.querySelector('#tdBCierre').value;
        var data = { titulo: titulo, desc: o.querySelector('#tdBDesc').value.trim(), tipo: tipo, precio: precio,
          stock: tipo === 'compra' ? num('#tdBStock') : null, limite: tipo === 'compra' ? (num('#tdBLimite') || null) : null,
          cierre: tipo === 'subasta' && cierreV ? new Date(cierreV).getTime() : null };
        if(b) data.id = b.id;
        guardarBeneficio(data).catch(function(e){ console.error(e); showAlert('No se pudo guardar (¿faltan publicar las reglas?).'); });
        return '';
      });
    var sel = o.querySelector('#tdBTipo');
    var sync = function(){
      o.querySelectorAll('[data-solo]').forEach(function(d){ d.hidden = d.getAttribute('data-solo') !== sel.value; });
      o.querySelector('#tdBPrecioLbl').textContent = sel.value === 'subasta' ? 'Puja inicial (mínimo que tiene que juntar un comando)' : 'Precio';
    };
    sel.onchange = sync; sync();
  }
