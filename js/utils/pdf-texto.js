// PDF de solo texto, armado a mano (sin librerías): A4, fuentes estándar del
// PDF (Helvetica, Times y Courier, no hace falta incrustarlas), corte de líneas y de
// páginas. Se usa para el PDF de una misa (js/views/misas.js), porque en la
// página instalada en el celular window.print() no anda (08/11/2026).

  var W = 595, H = 842, M = 46;            // A4 en puntos, margen
  var ABAJO = M + 18;                      // límite de abajo (deja lugar al pie)
  var ANCHO = W - 2 * M;

  // Anchos (milésimas del tamaño) de las fuentes estándar, ASCII 32-126.
  var HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var HELVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  var TIMES = [250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541];
  var TIMESB = [250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520];
  var TIMESI = [250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541];

  // Fuentes estándar del PDF (no hace falta incrustarlas).
  var FUENTES = {
    normal:   { id:'F1', base:'Helvetica',             tabla:HELV },
    bold:     { id:'F2', base:'Helvetica-Bold',        tabla:HELVB },
    italic:   { id:'F3', base:'Helvetica-Oblique',     tabla:HELV },
    serif:    { id:'F4', base:'Times-Roman',           tabla:TIMES },
    serifBold:{ id:'F5', base:'Times-Bold',            tabla:TIMESB },
    serifItal:{ id:'F6', base:'Times-Italic',          tabla:TIMESI },
    mono:     { id:'F7', base:'Courier',               tabla:null },
    monoBold: { id:'F8', base:'Courier-Bold',          tabla:null }
  };
  var CP1252 = { '‘':0x91, '’':0x92, '“':0x93, '”':0x94, '–':0x96, '—':0x97, '…':0x85, '•':0x95, '€':0x80 };

  // Texto → caracteres de un byte (WinAnsi). Lo que no entra, sin acento o «?».
  function aWinAnsi(s){
    var out = '';
    for(var i = 0; i < s.length; i++){
      var ch = s[i], c = s.charCodeAt(i);
      if(CP1252[ch]) out += String.fromCharCode(CP1252[ch]);
      else if(c === 9) out += ' ';
      else if(c >= 32 && c < 127) out += ch;
      else if(c >= 160 && c <= 255) out += ch;
      else {
        var base = ch.normalize ? ch.normalize('NFD').replace(/[̀-ͯ]/g, '') : '';
        out += (base && base.charCodeAt(0) < 127) ? base : '?';
      }
    }
    return out;
  }

  function anchoCar(c, fuente){
    var tabla = (FUENTES[fuente] || FUENTES.normal).tabla;
    if(!tabla) return 600;
    var code = c.charCodeAt(0);
    if(code >= 32 && code <= 126) return tabla[code - 32];
    var base = c.normalize ? c.normalize('NFD')[0] : c;      // á → a
    var b = base.charCodeAt(0);
    if(b >= 32 && b <= 126) return tabla[b - 32];
    return 500;
  }
  function anchoTexto(s, fuente, tam, tracking){
    var w = 0;
    for(var i = 0; i < s.length; i++) w += anchoCar(s[i], fuente);
    return w * tam / 1000 + (tracking || 0) * s.length;
  }

  // Parte un texto en renglones que entren en `max` puntos.
  function cortar(s, fuente, tam, max, tracking){
    var palabras = String(s).split(/ +/), lineas = [], act = '';
    palabras.forEach(function(p){
      var prueba = act ? act + ' ' + p : p;
      if(!act || anchoTexto(prueba, fuente, tam, tracking) <= max){ act = prueba; return; }
      lineas.push(act); act = p;
    });
    lineas.push(act);
    return lineas;
  }

  function esc(s){ return aWinAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  function rgb(c){ return c.map(function(v){ return (+v).toFixed(3); }).join(' '); }

  // Colores (de la paleta de la página, en tinta de imprenta).
  export var PDF_COLOR = {
    tinta: [0.086, 0.161, 0.216],          // marino #162937
    suave: [0.38, 0.42, 0.46],
    turquesa: [0, 0.53, 0.62],             // #009bb3 un poco más oscuro, para papel
    linea: [0.78, 0.82, 0.85]
  };

  // Documento: se le agregan "bloques" (grupos de renglones que no se parten)
  // y al final se pide el archivo. Con columnas:2 el texto va en dos columnas;
  // los bloques con {completo:true} (encabezado) ocupan todo el ancho y solo
  // se usan al principio. opts.pie: texto al pie de cada página (con el
  // número de página a la derecha).
  var SEP = 26;                              // espacio entre columnas
  export function nuevoPdf(opts){
    opts = opts || {};
    var ncol = opts.columnas || 1;
    var anchoCol = (ANCHO - SEP * (ncol - 1)) / ncol;
    var paginas = [[]], topes = [H - M], y = H - M, yTop = H - M, col = 0, vacio = true;

    function pagina(){ return paginas[paginas.length - 1]; }
    function x0(){ return M + col * (anchoCol + SEP); }
    function siguiente(){
      if(col < ncol - 1){ col++; y = yTop; }
      else { paginas.push([]); topes.push(H - M); col = 0; y = yTop = H - M; }
      vacio = true;
    }

    // items: [{texto, fuente, tam, color|gris, sangria, mono (no corta),
    //   interlinea, tracking, align:'center', numero (al margen, 1er renglón),
    //   barra (raya turquesa a la izquierda), punteado (raya punteada gris),
    //   lineaDebajo, espacioAntes}]
    // antes: espacio previo. Si el bloque no entra en lo que queda de la
    // columna, pasa a la siguiente (salvo que no entre ni en una entera).
    function bloque(items, antes, o){
      var completo = o && o.completo;
      var ancho = completo ? ANCHO : anchoCol;
      var renglones = [];
      items.forEach(function(it){
        var tam = it.tam || 11, fuente = it.fuente || 'normal', sang = it.sangria || 0;
        var partes = it.mono ? [it.texto] : cortar(it.texto, fuente, tam, ancho - sang, it.tracking);
        partes.forEach(function(t, k){
          renglones.push({ t: t, fuente: fuente, tam: tam, sang: sang, it: it, primero: k === 0,
            alto: tam * (it.interlinea || 1.35) + (k === 0 ? (it.espacioAntes || 0) : 0) });
        });
      });
      var alto = renglones.reduce(function(s, r){ return s + r.alto; }, 0);
      var esp = (vacio && !completo) ? 0 : (antes || 0);
      if(!completo && !vacio && y - esp - alto < ABAJO && alto <= yTop - ABAJO){ siguiente(); esp = 0; }
      y -= esp;
      renglones.forEach(function(r){
        if(y - r.alto < ABAJO){ siguiente(); }
        y -= r.alto;
        var it = r.it;
        var x = completo ? M : x0();
        var base = y + r.tam * (it.interlinea || 1.35) * 0.27;
        var tx = x + r.sang;
        if(it.align === 'center') tx = x + (ancho - anchoTexto(r.t, r.fuente, r.tam, it.tracking)) / 2;
        var color = it.color || [it.gris || 0, it.gris || 0, it.gris || 0];
        var f = FUENTES[r.fuente] || FUENTES.normal;
        var ops = pagina();
        ops.push(rgb(color) + ' rg BT /' + f.id + ' ' + r.tam + ' Tf ' + (it.tracking ? it.tracking + ' Tc ' : '0 Tc ') + tx.toFixed(1) + ' ' + base.toFixed(1) + ' Td (' + esc(r.t) + ') Tj ET');
        if(r.primero && it.numero){
          var nt = String(it.numero), nw = anchoTexto(nt, 'bold', 7.5);
          ops.push(rgb(PDF_COLOR.suave) + ' rg BT /F2 7.5 Tf 0 Tc ' + (x + r.sang - 6 - nw).toFixed(1) + ' ' + (base + 1).toFixed(1) + ' Td (' + nt + ') Tj ET');
        }
        if(it.barra) ops.push(rgb(PDF_COLOR.turquesa) + ' RG [] 0 d 1.2 w ' + (x + 3).toFixed(1) + ' ' + y.toFixed(1) + ' m ' + (x + 3).toFixed(1) + ' ' + (y + r.alto).toFixed(1) + ' l S');
        if(it.punteado) ops.push(rgb(PDF_COLOR.linea) + ' RG [1 2.2] 0 d 1 w ' + (x + 6).toFixed(1) + ' ' + y.toFixed(1) + ' m ' + (x + 6).toFixed(1) + ' ' + (y + r.alto).toFixed(1) + ' l S [] 0 d');
        if(it.lineaDebajo) ops.push(rgb(PDF_COLOR.linea) + ' RG [] 0 d 0.6 w ' + x.toFixed(1) + ' ' + (y + 0.5).toFixed(1) + ' m ' + (x + ancho).toFixed(1) + ' ' + (y + 0.5).toFixed(1) + ' l S');
      });
      vacio = !!completo;                    // las columnas arrancan parejas
      if(completo){ yTop = y; topes[topes.length - 1] = y; }
    }

    function blob(titulo){
      var total = paginas.length;
      // Raya fina entre columnas y pie de página.
      paginas.forEach(function(ops, i){
        if(ncol > 1){
          var xs = M + anchoCol + SEP / 2;
          ops.push(rgb(PDF_COLOR.linea) + ' RG [] 0 d 0.5 w ' + xs.toFixed(1) + ' ' + (topes[i] - 4).toFixed(1) + ' m ' + xs.toFixed(1) + ' ' + ABAJO.toFixed(1) + ' l S');
        }
        var yp = M - 10;
        ops.push(rgb(PDF_COLOR.linea) + ' RG 0.5 w ' + M + ' ' + (yp + 12) + ' m ' + (W - M) + ' ' + (yp + 12) + ' l S');
        if(opts.pie) ops.push(rgb(PDF_COLOR.suave) + ' rg BT /F3 8 Tf 0 Tc ' + M + ' ' + yp + ' Td (' + esc(opts.pie) + ') Tj ET');
        var num = (i + 1) + ' / ' + total;
        ops.push(rgb(PDF_COLOR.suave) + ' rg BT /F1 8 Tf 0 Tc ' + (W - M - anchoTexto(num, 'normal', 8)).toFixed(1) + ' ' + yp + ' Td (' + num + ') Tj ET');
      });
      var objs = [];
      objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
      var lista = Object.keys(FUENTES).map(function(k){ return FUENTES[k]; });
      var fuentesRes = lista.map(function(f, i){
        objs[3 + i] = '<< /Type /Font /Subtype /Type1 /BaseFont /' + f.base + ' /Encoding /WinAnsiEncoding >>';
        return '/' + f.id + ' ' + (3 + i) + ' 0 R';
      }).join(' ');
      var kids = [], n = 3 + lista.length;
      paginas.forEach(function(ops){
        var contenido = ops.join('\n');
        objs[n] = '<< /Length ' + contenido.length + ' >>\nstream\n' + contenido + '\nendstream';
        objs[n + 1] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << ' + fuentesRes + ' >> >> /Contents ' + n + ' 0 R >>';
        kids.push((n + 1) + ' 0 R');
        n += 2;
      });
      objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
      objs[n] = '<< /Title (' + esc(titulo || '') + ') /Producer (Reino del Padre) >>';
      var out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', offs = [];
      for(var i = 1; i <= n; i++){ offs[i] = out.length; out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
      var xref = out.length;
      out += 'xref\n0 ' + (n + 1) + '\n0000000000 65535 f \n';
      for(var j = 1; j <= n; j++) out += String(offs[j]).padStart(10, '0') + ' 00000 n \n';
      out += 'trailer\n<< /Size ' + (n + 1) + ' /Root 1 0 R /Info ' + n + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
      var bytes = new Uint8Array(out.length);
      for(var k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 255;
      return new Blob([bytes], { type: 'application/pdf' });
    }

    return { bloque: bloque, blob: blob, ancho: anchoCol };
  }

  // Entrega el archivo: en celular, con el menú de compartir (anda en la
  // página instalada; ahí se elige «Guardar en Archivos», WhatsApp, etc.); si
  // no, descarga directa.
  export async function entregarPdf(blob, nombre){
    var archivo = nombre.replace(/[\\/:*?"<>|]+/g, '').trim() || 'misa';
    archivo += '.pdf';
    var tactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if(tactil && typeof File === 'function' && navigator.share){
      var f = new File([blob], archivo, { type: 'application/pdf' });
      if(!navigator.canShare || navigator.canShare({ files: [f] })){
        try {
          await navigator.share({ files: [f], title: nombre });
          return 'compartido';
        } catch(e){
          if(e && e.name === 'AbortError') return 'cancelado';   // cerró el menú
          throw e;                                              // que se vea el error
        }
      }
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = archivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return tactil ? 'descarga-celular' : 'descarga';
  }
