// PDF de solo texto, armado a mano (sin librerías): A4, fuentes estándar del
// PDF (Helvetica y Courier, no hace falta incrustarlas), corte de líneas y de
// páginas. Se usa para el PDF de una misa (js/views/misas.js), porque en la
// página instalada en el celular window.print() no anda (08/11/2026).

  var W = 595, H = 842, M = 50;            // A4 en puntos, margen
  var ANCHO = W - 2 * M;

  // Anchos (en milésimas del tamaño) de Helvetica y Helvetica-Bold, ASCII 32-126.
  var HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var HELVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

  var FUENTES = { normal:'F1', bold:'F2', italic:'F3', mono:'F4', monoBold:'F5' };
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
    if(fuente === 'mono' || fuente === 'monoBold') return 600;
    var tabla = fuente === 'bold' ? HELVB : HELV;
    var code = c.charCodeAt(0);
    if(code >= 32 && code <= 126) return tabla[code - 32];
    var base = c.normalize ? c.normalize('NFD')[0] : c;      // á → a
    var b = base.charCodeAt(0);
    if(b >= 32 && b <= 126) return tabla[b - 32];
    return 556;
  }
  function anchoTexto(s, fuente, tam){
    var w = 0;
    for(var i = 0; i < s.length; i++) w += anchoCar(s[i], fuente);
    return w * tam / 1000;
  }

  // Parte un texto en renglones que entren en `max` puntos.
  function cortar(s, fuente, tam, max){
    var palabras = String(s).split(/ +/), lineas = [], act = '';
    palabras.forEach(function(p){
      var prueba = act ? act + ' ' + p : p;
      if(!act || anchoTexto(prueba, fuente, tam) <= max){ act = prueba; return; }
      lineas.push(act); act = p;
    });
    lineas.push(act);
    return lineas;
  }

  function esc(s){ return aWinAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }

  // Documento: se le agregan "bloques" (grupos de renglones que no se parten)
  // y al final se pide el archivo. Con columnas:2 el texto va en dos columnas
  // (08/11/2026); los bloques con {completo:true} (encabezado) ocupan todo el
  // ancho y solo se usan al principio.
  var SEP = 22;                              // espacio entre columnas
  export function nuevoPdf(opts){
    var ncol = (opts && opts.columnas) || 1;
    var anchoCol = (ANCHO - SEP * (ncol - 1)) / ncol;
    var paginas = [[]], y = H - M, yTop = H - M, col = 0, vacio = true;

    function pagina(){ return paginas[paginas.length - 1]; }
    function x0(){ return M + col * (anchoCol + SEP); }
    function siguiente(){
      if(col < ncol - 1){ col++; y = yTop; }
      else { paginas.push([]); col = 0; y = yTop = H - M; }
      vacio = true;
    }

    // items: [{texto, fuente, tam, gris, sangria, mono (no corta), barra, lineaDebajo}]
    // antes: espacio previo. Si el bloque no entra en lo que queda de la
    // columna, pasa a la siguiente (salvo que no entre ni en una entera).
    function bloque(items, antes, o){
      var completo = o && o.completo;
      var ancho = completo ? ANCHO : anchoCol;
      var renglones = [];
      items.forEach(function(it){
        var tam = it.tam || 11, fuente = it.fuente || 'normal', sang = it.sangria || 0;
        var partes = it.mono ? [it.texto] : cortar(it.texto, fuente, tam, ancho - sang);
        partes.forEach(function(t){
          renglones.push({ t: t, fuente: fuente, tam: tam, gris: it.gris || 0, sang: sang, alto: tam * (it.interlinea || 1.35), barra: it.barra, linea: it.lineaDebajo });
        });
      });
      var alto = renglones.reduce(function(s, r){ return s + r.alto; }, 0);
      var esp = (vacio && !completo) ? 0 : (antes || 0);
      if(!completo && !vacio && y - esp - alto < M && alto <= yTop - M){ siguiente(); esp = 0; }
      y -= esp;
      renglones.forEach(function(r){
        if(y - r.alto < M){ siguiente(); }
        y -= r.alto;
        var x = completo ? M : x0();
        var base = y + r.alto * 0.25;
        var ops = pagina();
        ops.push(r.gris.toFixed(2) + ' g BT /' + FUENTES[r.fuente] + ' ' + r.tam + ' Tf ' + (x + r.sang).toFixed(1) + ' ' + base.toFixed(1) + ' Td (' + esc(r.t) + ') Tj ET');
        if(r.barra) ops.push('0.4 G 1.5 w ' + (x + 2) + ' ' + y.toFixed(1) + ' m ' + (x + 2) + ' ' + (y + r.alto).toFixed(1) + ' l S');
        if(r.linea) ops.push('0.6 G 0.7 w ' + x.toFixed(1) + ' ' + (y + 1).toFixed(1) + ' m ' + (x + ancho).toFixed(1) + ' ' + (y + 1).toFixed(1) + ' l S');
      });
      vacio = !!completo;                    // las columnas arrancan parejas
      if(completo) yTop = y;                 // y debajo del encabezado
    }

    function blob(titulo){
      var objs = [];
      objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
      var nombresF = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Courier', 'Courier-Bold'];
      var fuentesRes = nombresF.map(function(n, i){
        objs[3 + i] = '<< /Type /Font /Subtype /Type1 /BaseFont /' + n + ' /Encoding /WinAnsiEncoding >>';
        return '/F' + (i + 1) + ' ' + (3 + i) + ' 0 R';
      }).join(' ');
      var kids = [], n = 8;
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
    if(tactil && typeof File === 'function' && navigator.canShare){
      try {
        var f = new File([blob], archivo, { type: 'application/pdf' });
        if(navigator.canShare({ files: [f] })){
          await navigator.share({ files: [f], title: nombre });
          return;
        }
      } catch(e){
        if(e && e.name === 'AbortError') return;   // cerró el menú
      }
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = archivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  }
