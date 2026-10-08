// Import/export de "encuentros" con la otra herramienta del usuario,
// "Encuentros" (`NegroMontes/encuentros-pagina`, leída como modelo de solo
// lectura — nunca se tocó ese repo). Pedido del usuario, 06/10/2026: "Permiti
// importar/exportar encuentros de la pagina de encuentros a la pagina RDP".
//
// Ambas herramientas ya comparten el mismo modelo de paso desde la
// unificación del 06/10/2026 (ver CLAUDE.md, "Entradas unificadas con el
// modelo de 'Encuentros'..."), así que el puente entre las dos es sobre todo
// un cambio de forma (nombres de campo, ids de biblioteca) más que una
// traducción de verdad.
//
// IMPORTAR: Encuentros exporta un encuentro como un único archivo .html
// autocontenido (botón "📦 Exportar / imprimir" → "Encuentro para
// compartir"), con un `<script type="application/json" id="enc-data">`
// adentro que trae el encuentro entero (`D.enc`, con sus `steps`) — los
// archivos que se hayan subido directo (no como link) viajan aparte, en
// `<script id="enc-FID">` o como `data:` URIs dentro de la versión de
// lectura sin JS. Achurar/leer solo ESE formato (no el `encuentros.json`
// interno de la herramienta) alcanza para el flujo real: alguien arma un
// encuentro en Encuentros, lo exporta, te pasa el .html, vos lo importás acá.
//
// EXPORTAR: no hace falta replicar el reproductor completo de Encuentros —
// `importEnc()` del lado de Encuentros solo busca el `<script id="enc-data">`
// en el archivo, así que un .html minúsculo que solo tenga ese script ya es
// un encuentro "exportado" válido para su propio importador. Como una entrada
// de RDP nunca guarda archivos embebidos (solo links, Drive incluido), este
// sentido no tiene nada de blobs que empaquetar — mucho más simple que la
// importación.

import { uid } from './helpers.js';

  // ===== Tablas de equivalencia entre bibliotecas =====
  // Encuentros tiene 4 tipos de paso fijos, uno por biblioteca precargada
  // (youcat/yconf/enciclica/estilo, sin campo `book.lib` — el tipo mismo ya
  // dice cuál es) más un tipo genérico "libro" con `book.lib` para el resto
  // de sus bibliotecas (docat, compendio-dsi, cautivante, etc.). RDP, en
  // cambio, tiene un solo tipo de paso "libro" con `book.lib` para las 5
  // bibliotecas que precarga (youcat/docat/compendio/enciclica/
  // yconfirmacion) — las demás solo existen como "Personalizado"
  // (book.lib==='custom'), sin precargar su texto.
  var ENC_TYPE_TO_RDP_LIB = { youcat:'youcat', enciclica:'enciclica', yconf:'yconfirmacion' };
  var RDP_LIB_TO_ENC_TYPE = { youcat:'youcat', enciclica:'enciclica', yconfirmacion:'yconf' };
  var ENC_LIBRO_LIB_TO_RDP_LIB = { docat:'docat', 'compendio-dsi':'compendio' };
  var RDP_LIB_TO_ENC_LIBRO_LIB = { docat:'docat', compendio:'compendio-dsi' };
  // Nombres conocidos para la cita "Personalizada" cuando no hay una
  // biblioteca de RDP equivalente (no se intenta adivinar nada para una
  // biblioteca nueva que no esté en esta lista — queda con el título del
  // paso, si lo tenía, o "Cita").
  var CUSTOM_LIB_TITLES = {
    estilo: 'Instructivo del Estilo',
    cautivante: 'Cautivante',
    'ensename-a-ser-hombre': 'Enséñame a ser hombre',
    'salvaje-de-corazon': 'Salvaje de corazón'
  };


  // ===== IMPORTAR =====

  // Lee el .html que exportó Encuentros y devuelve `{enc, fileMap}` — `enc`
  // es el objeto del encuentro tal cual lo guarda Encuentros (con `steps`),
  // `fileMap` un Map<fid, dataUrl> con cualquier archivo subido directo (no
  // como link) que haya quedado embebido adentro del archivo. Tira un Error
  // con un mensaje legible si el archivo no tiene el formato esperado.
  export function parseEncuentrosHtml(text){
    var doc = new DOMParser().parseFromString(text, 'text/html');
    var dataEl = doc.getElementById('enc-data');
    if(!dataEl){ throw new Error('El archivo no es un encuentro exportado de la fordoquera (no se encontró el formato esperado).'); }
    var payload;
    try{ payload = JSON.parse(dataEl.textContent); }
    catch(e){ throw new Error('El archivo no es un encuentro exportado de la fordoquera (el formato adentro está roto).'); }
    var enc = payload && payload.enc;
    if(!enc || !Array.isArray(enc.steps)){ throw new Error('El archivo no es un encuentro exportado de la fordoquera (le falta el contenido).'); }

    var fids = {};
    enc.steps.forEach(function(s){ if(s.file && s.file.fid){ fids[s.file.fid] = true; } });
    if(enc.music && enc.music.file && enc.music.file.fid){ fids[enc.music.file.fid] = true; }

    var fileMap = {};
    Object.keys(fids).forEach(function(fid){
      // Un archivo embebido puede estar en su propio <script id="enc-FID">
      // (la versión con JS), o — si ese script no está — adentro de la
      // versión de lectura sin JS, como un data: URI puesto directo en un
      // src/href con [data-fid] (ver buildExport/staticExport en el repo de
      // Encuentros). Cualquiera de los dos alcanza para reconstruir el Blob.
      var scriptEl = doc.getElementById('enc-' + fid);
      if(scriptEl){
        var mime = scriptEl.getAttribute('data-mime') || 'application/octet-stream';
        fileMap[fid] = 'data:' + mime + ';base64,' + scriptEl.textContent.trim();
        return;
      }
      var el = doc.querySelector('[data-fid="' + fid + '"]');
      if(el){
        var attr = el.getAttribute('data-at') || 'src';
        var val = el.getAttribute(attr);
        if(val && val.indexOf('data:') === 0){ fileMap[fid] = val; }
      }
    });

    return { enc: enc, fileMap: fileMap };
  }


  // Pasa un texto de Encuentros (markdown liviano, mismo subset que ya
  // entiende `linkify()` del lado de RDP) tal cual — no hace falta tocar
  // nada, las dos herramientas ya comparten **negrita**/*cursiva*.
  function passthroughText(t){ return t || ''; }


  // Reduce el HTML precomputado de una cita de libro (`step.html`, que
  // Encuentros arma al exportar — ver bookHtml() en su repo) a texto plano
  // con el mismo markdown liviano de RDP, para usarlo como el campo `texto`
  // de una cita "Personalizada" cuando la biblioteca de origen no es una de
  // las 5 que RDP precarga. No intenta ser perfecto — alcanza con no perder
  // el contenido real de la cita.
  export function stripBookHtmlToText(html){
    if(!html) return '';
    var root = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html').body.firstChild;
    if(!root) return '';
    // El botón de "Ver el texto/la respuesta" (una cita que arranca
    // colapsada) no es contenido — se saca entero; lo que tapaba (`.bk-hide`)
    // se deja, así el texto siempre sale completo, nunca escondido.
    root.querySelectorAll('.bk-show').forEach(function(el){ el.remove(); });
    var parts = [];
    function walk(node){
      if(node.nodeType === 3){ // texto
        var t = node.textContent.replace(/\s+/g, ' ');
        if(t.trim()) parts.push(t);
        return;
      }
      if(node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      if(tag === 'script' || tag === 'style') return;
      if(tag === 'br'){ parts.push('\n'); return; }
      if(tag === 'b' || tag === 'strong'){ parts.push('**'); Array.prototype.forEach.call(node.childNodes, walk); parts.push('**'); return; }
      if(tag === 'i' || tag === 'em'){ parts.push('*'); Array.prototype.forEach.call(node.childNodes, walk); parts.push('*'); return; }
      if(tag === 'li'){ parts.push('\n- '); Array.prototype.forEach.call(node.childNodes, walk); return; }
      var blockish = ['p','div','section','h1','h2','h3','h4','ul','ol'].indexOf(tag) !== -1;
      if(blockish) parts.push('\n\n');
      Array.prototype.forEach.call(node.childNodes, walk);
      if(blockish) parts.push('\n\n');
    }
    walk(root);
    return parts.join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }


  function baseRdpStep(type){
    return { type: type, text:'', url:'', preText:'', postText:'',
      align:'left', preTextAlign:'left', postTextAlign:'left',
      opciones: [], unica: true, allowWrite: false, nota: '', cond: null, book: null };
  }


  var MEDIA_TYPES = ['imagen', 'video', 'audio', 'pdf', 'enlace'];
  var BOOKISH_TYPES = ['libro', 'youcat', 'enciclica', 'yconf', 'estilo'];

  // Convierte un paso de Encuentros a su equivalente de RDP. `idToIdx` mapea
  // el id (string) de cada paso de Encuentros a su índice en el array final
  // de pasos de RDP (para poder resolver `cond.step`, que en Encuentros
  // apunta a un id y en RDP a un índice). Devuelve `{step, pendingFile}` —
  // `pendingFile` es `{fid, name, mime}` si el paso cita un archivo subido
  // directo (no un link) que hay que resolver aparte (ver
  // `convertEncuentroToRdpImport`), o `null` si no hace falta.
  function convertEncuentroStep(s, idToIdx, warnings){
    var titlePrefix = s.title ? ('**' + String(s.title).trim() + '**\n\n') : '';
    var pendingFile = null;

    function resolveCond(st){
      if(s.cond && s.cond.step !== undefined && Object.prototype.hasOwnProperty.call(idToIdx, s.cond.step)){
        st.cond = { step: idToIdx[s.cond.step], val: s.cond.val || '' };
      } else if(s.cond){
        warnings.push('Se perdió una condición de visibilidad en un paso ("' + (s.title || s.question || s.type) + '") — no se encontró el paso al que hacía referencia.');
      }
    }

    if(s.type === 'texto'){
      var st = baseRdpStep('texto');
      st.text = titlePrefix + passthroughText(s.body);
      st.align = s.align || 'left';
      st.nota = s.nota || '';
      return { step: st, pendingFile: null };
    }
    if(s.type === 'proposito'){
      var st = baseRdpStep('proposito');
      st.text = titlePrefix + passthroughText(s.body || s.question);
      st.nota = s.nota || '';
      return { step: st, pendingFile: null };
    }
    if(s.type === 'pregunta'){
      var st = baseRdpStep('pregunta');
      st.preText = titlePrefix + passthroughText(s.pre);
      st.text = passthroughText(s.question);
      st.postText = passthroughText(s.post);
      st.opciones = (s.opciones || '').split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
      // Encuentros: sin `unica` (o en falso) significa opción múltiple por
      // default; RDP es al revés (sin especificar = selección única) — hay
      // que invertir el default explícito acá, no solo copiar el valor.
      st.unica = !!s.unica;
      st.allowWrite = !!s.write;
      st.nota = s.nota || '';
      resolveCond(st);
      return { step: st, pendingFile: null };
    }
    if(MEDIA_TYPES.indexOf(s.type) !== -1){
      var st = baseRdpStep(s.type);
      st.preText = titlePrefix + passthroughText(s.pre);
      st.postText = passthroughText(s.post);
      st.nota = s.nota || '';
      if(s.url){
        st.url = s.url;
      } else if(s.file && s.file.fid){
        pendingFile = { fid: s.file.fid, name: s.file.name || 'archivo', mime: s.file.mime || '' };
      }
      resolveCond(st);
      return { step: st, pendingFile: pendingFile };
    }
    if(BOOKISH_TYPES.indexOf(s.type) !== -1){
      var st = baseRdpStep('libro');
      st.preText = titlePrefix + passthroughText(s.pre);
      st.postText = passthroughText(s.post);
      st.nota = s.nota || '';
      var rdpLib = ENC_TYPE_TO_RDP_LIB[s.type] || (s.type === 'libro' && s.book ? ENC_LIBRO_LIB_TO_RDP_LIB[s.book.lib] : null);
      if(rdpLib){
        st.book = { lib: rdpLib, n: String((s.book && s.book.n) != null ? s.book.n : ''), titulo:'', autor:'', color:'#6b6b6b', texto:'' };
      } else {
        var srcLibId = s.type === 'libro' ? ((s.book && s.book.lib) || '') : s.type;
        var titulo = CUSTOM_LIB_TITLES[srcLibId] || s.title || 'Cita';
        var texto = s.html ? stripBookHtmlToText(s.html) : '';
        if(!texto){
          texto = '(No se pudo traer el texto de esta cita automáticamente — pegalo acá a mano.)';
          warnings.push('La cita "' + titulo + '" quedó sin texto — hay que pegarla a mano.');
        }
        st.book = { lib:'custom', titulo: titulo, autor:'', color:'#6b6b6b', texto: texto };
      }
      resolveCond(st);
      return { step: st, pendingFile: null };
    }
    if(s.type === 'grupo'){
      // RDP ya soporta "grupo" de forma nativa (08/10/2026, puerto del
      // constructor de pasos de "Encuentros") — se copia tal cual, sin
      // perder nada: título, condición propia, y si estaba marcado para
      // mostrarse como una portada (`slide`), ese texto también.
      var st = { type:'grupo', title: s.title || '', body: passthroughText(s.body) || '', closed: !!s.closed, slide: !!s.slide, cond: null };
      resolveCond(st);
      return { step: st, pendingFile: null };
    }
    // Tipo sin equivalente en RDP. No debería pasar con ninguno de los tipos
    // que Encuentros exporta hoy, pero por las dudas se descarta con un
    // aviso en vez de romper el import.
    warnings.push('Se descartó un paso de tipo "' + s.type + '" (sin equivalente en esta página).');
    return { step: null, pendingFile: null };
  }


  // Convierte un encuentro entero (ya parseado por `parseEncuentrosHtml`) a
  // `{title, steps, pendingFiles, warnings}`, listo para precargar el
  // formulario de "Agregar contenido" de RDP (ver `attachPanelEvents` en
  // `components/form.js`). `pendingFiles` son los archivos subidos directo
  // (no como link) que todavía necesitan resolverse — `{stepIndex, fid,
  // name, mime}`, con `stepIndex === -1` para la música de fondo de la
  // entrada en vez de un paso puntual.
  export function convertEncuentroToRdpImport(enc){
    var idToIdx = {};
    // "grupo" ya tiene equivalente en RDP (08/10/2026) — se convierte como
    // cualquier otro paso, así que ya no hace falta filtrarlo antes de armar
    // el índice de ids → índices (el índice final coincide 1 a 1 con
    // `enc.steps`, salvo los pocos tipos realmente sin equivalente que
    // `convertEncuentroStep` descarta con un aviso).
    var realSteps = enc.steps;
    realSteps.forEach(function(s, i){ if(s.id) idToIdx[s.id] = i; });

    var warnings = [];
    var steps = [];
    var pendingFiles = [];
    realSteps.forEach(function(s){
      var converted = convertEncuentroStep(s, idToIdx, warnings);
      if(!converted.step) return;
      var stepIndex = steps.length;
      steps.push(converted.step);
      if(converted.pendingFile){
        pendingFiles.push(Object.assign({ stepIndex: stepIndex }, converted.pendingFile));
      }
    });

    // El "intro" del encuentro (texto de bienvenida antes del primer paso)
    // no tiene equivalente directo en RDP — se precarga como un paso de
    // Texto más, al principio; el "objetivo" (para quien coordina, no para
    // quien participa) se guarda en la nota interna de ese mismo paso, así
    // no se pierde del todo aunque RDP no tenga un campo propio para eso a
    // nivel de toda la entrada.
    if(enc.intro || enc.goal){
      var introStep = baseRdpStep('texto');
      introStep.text = enc.intro || '';
      introStep.nota = enc.goal || '';
      steps.unshift(introStep);
      // Como se agregó un paso al principio, todos los índices de
      // `pendingFiles` y los `cond.step` ya resueltos quedan corridos en 1.
      pendingFiles.forEach(function(pf){ pf.stepIndex += 1; });
      steps.forEach(function(st){ if(st.cond){ st.cond.step += 1; } });
      // ...salvo el propio paso nuevo, que nunca tiene condición.
      steps[0].cond = null;
    }

    var musicPending = null;
    var bgMusicUrl = '';
    if(enc.music){
      if(enc.music.url){ bgMusicUrl = enc.music.url; }
      else if(enc.music.file && enc.music.file.fid){
        musicPending = { stepIndex: -1, fid: enc.music.file.fid, name: enc.music.file.name || 'musica', mime: enc.music.file.mime || '' };
        pendingFiles.push(musicPending);
      }
    }

    return { title: enc.title || 'Encuentro importado', steps: steps, pendingFiles: pendingFiles, warnings: warnings, bgMusicUrl: bgMusicUrl };
  }


  // Reconstruye un File a partir de un data: URI ya en memoria (ver
  // `fileMap` de `parseEncuentrosHtml`) — se usa para subirlo al Drive del
  // usuario con `uploadEntryFile()` (ya existente), igual que si lo hubiera
  // elegido a mano con el selector de archivos del formulario.
  export function dataUrlToFile(dataUrl, name, mime){
    return fetch(dataUrl).then(function(res){ return res.blob(); }).then(function(blob){
      return new File([blob], name || 'archivo', { type: mime || blob.type || 'application/octet-stream' });
    });
  }


  // ===== EXPORTAR =====

  // Convierte un paso de RDP a su equivalente de Encuentros. `id` ya viene
  // generado (ver `convertRdpEntryToEncuentro`, que arma los ids de todos
  // los pasos primero para poder resolver `cond` en una segunda pasada).
  function convertRdpStep(step, id){
    var out = { id: id, type: step.type };
    if(step.nota) out.nota = step.nota;
    switch(step.type){
      case 'texto':
        out.body = step.text || '';
        if(step.align && step.align !== 'left') out.align = step.align;
        break;
      case 'proposito':
        out.body = step.text || '';
        break;
      case 'pregunta':
        out.question = step.text || '';
        if(step.preText) out.pre = step.preText;
        if(step.postText) out.post = step.postText;
        if(step.opciones && step.opciones.length) out.opciones = step.opciones.join('\n');
        if(step.unica) out.unica = true;
        if(step.allowWrite) out.write = 'guardar';
        break;
      case 'imagen': case 'video': case 'audio': case 'pdf': case 'enlace':
        out.url = step.url || '';
        if(step.preText) out.pre = step.preText;
        if(step.postText) out.post = step.postText;
        break;
      case 'libro':
        var book = step.book || {};
        if(RDP_LIB_TO_ENC_TYPE[book.lib]){
          out.type = RDP_LIB_TO_ENC_TYPE[book.lib];
          out.book = { n: isNaN(parseInt(book.n, 10)) ? book.n : parseInt(book.n, 10) };
        } else if(RDP_LIB_TO_ENC_LIBRO_LIB[book.lib]){
          out.type = 'libro';
          out.book = { lib: RDP_LIB_TO_ENC_LIBRO_LIB[book.lib], n: isNaN(parseInt(book.n, 10)) ? book.n : parseInt(book.n, 10) };
        } else {
          // "Personalizado" (book.lib==='custom'): Encuentros no tiene un
          // tipo de "cita pegada a mano" — baja a un paso de Texto con la
          // cita formateada, lo más parecido sin inventar un tipo nuevo del
          // lado de Encuentros.
          out.type = 'texto';
          var head = book.titulo ? ('**' + book.titulo + '**' + (book.autor ? ' — ' + book.autor : '') + '\n\n') : '';
          out.body = (step.preText ? step.preText + '\n\n' : '') + head + (book.texto || '') + (step.postText ? '\n\n' + step.postText : '');
        }
        break;
      default:
        return null;
    }
    return out;
  }


  // Arma el payload `{kind:'encuentro', app:'Encuentros', ..., enc:{...}}`
  // que espera el importador de Encuentros, a partir de una entrada
  // "secuencial" de RDP. Como RDP nunca guarda archivos embebidos (solo
  // links, Drive incluido), este sentido es puramente sincrónico — no hace
  // falta resolver ningún blob.
  export function convertRdpEntryToEncuentro(entry){
    var ids = (entry.steps || []).map(function(){ return 's' + uid(); });
    var steps = (entry.steps || []).map(function(step, i){ return convertRdpStep(step, ids[i]); }).filter(Boolean);
    // Segunda pasada: resolver `cond.step` (índice de RDP) al id generado
    // del paso al que apunta — si ese paso se descartó en la conversión
    // (no debería pasar, todos los tipos de RDP tienen equivalente), se
    // deja sin condición en vez de apuntar a un id que no existe.
    (entry.steps || []).forEach(function(step, i){
      if(step.cond && step.cond.val && ids[step.cond.step] && steps[i]){
        steps[i].cond = { step: ids[step.cond.step], val: step.cond.val };
      }
    });
    var enc = {
      id: 'rdp-' + (entry.id || uid()),
      title: entry.title || 'Encuentro',
      steps: steps
    };
    if(entry.bgMusicUrl){ enc.music = { url: entry.bgMusicUrl }; }
    return { kind:'encuentro', app:'Encuentros', version:1, exportedAt: Date.now(), attr: [], enc: enc };
  }


  // Nombre de archivo seguro para la descarga — mismo criterio que
  // `safeName()` del lado de Encuentros, para que el archivo se vea y se
  // comporte igual de un lado que del otro.
  export function safeEncuentroFileName(title){
    var s = String(title || 'encuentro')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
    return s || 'encuentro';
  }


  // Arma el .html mínimo que el importador de Encuentros sabe leer — no hay
  // que replicar su reproductor completo, `importEnc()` del otro lado solo
  // busca el <script id="enc-data"> acá adentro.
  export function buildEncuentroExportHtml(payload){
    var json = JSON.stringify(payload).replace(/</g, '\\u003c');
    var title = (payload.enc && payload.enc.title) || 'Encuentro';
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + escapeHtmlAttr(title) + '</title></head>' +
      '<body><p>Este archivo es un encuentro exportado desde FORDOC Reino del Padre (compatible con la fordoquera). ' +
      'Importalo desde ahí con el botón "📥 Importar un encuentro".</p>' +
      '<script type="application/json" id="enc-data">' + json + '<\/script></body></html>';
  }

  function escapeHtmlAttr(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
