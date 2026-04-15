// ── plc-helpers.js ────────────────────────────────────────────────────────────
// Helpers de formateo de texto PLC. Se mezclan en methods de Vue via spread.
//   - alignFbCalls : alinea llamadas a FBs en columnas verticales
//   - alignDecls   : alinea declaraciones de variables (name : TYPE)
//   - highlightPLC : resaltador de sintaxis PLC para el editor de código
// ─────────────────────────────────────────────────────────────────────────────

const plcHelpers = {

  // Alinea llamadas a FBs en columnas verticales.
  // Recibe un array de arrays de strings: cada fila es una llamada FB,
  // cada elemento del array es una "columna" de esa llamada.
  // Ejemplo de entrada (analog):
  //   ['fb_Tag', '(i_nVariable:=st_Tag.Scaled,', 'i_bCondition:=True, ...', 'FB_LowAlarm:=...,', ...]
  // Resultado: todas las filas con sus columnas alineadas verticalmente.
  alignFbCalls(rows) {
    if (!rows || !rows.length) return [];
    const numCols = Math.max(...rows.map(r => r.length));
    const colWidths = Array(numCols - 1).fill(0);
    for (const row of rows) {
      for (let c = 0; c < row.length - 1; c++) {
        colWidths[c] = Math.max(colWidths[c], row[c].length);
      }
    }
    return rows.map(row =>
      row.map((cell, c) => c < row.length - 1 ? cell.padEnd(colWidths[c]) : cell).join('  ')
    );
  },

  // Alinea columnas en declaraciones de variables PLC.
  // Soporta dos formatos:
  //   IO_Tags : "name AT %addr : TYPE; // comment"
  //   Simple  : "name: TYPE; // comment"  (GVL, instancias de FB, etc.)
  // Las líneas que no encajan con ningún patrón pasan sin modificarse.
  alignDecls(lines) {
    if (!lines || !lines.length) return lines;

    const parsed = lines.map(line => {
      // Formato IO_Tags: nombre + AT %addr + : TYPE
      const ioM = line.match(/^(\s*)([A-Za-z_]\w*)\s+(AT\s+\S+)\s*:\s*([A-Za-z_]\w+)\s*;(.*)$/i);
      if (ioM) return { fmt: 'io', indent: ioM[1] || '\t',
        name: ioM[2], at: ioM[3], type: ioM[4], rest: ioM[5].trim() };

      // Formato simple: nombre : TYPE  (sin inicialización := ni doble colon)
      const simM = line.match(/^(\s*)([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w+)\s*;(.*)$/);
      if (simM) return { fmt: 'sim', indent: simM[1] || '\t',
        name: simM[2], type: simM[3], rest: simM[4].trim() };

      return { fmt: 'raw', original: line };
    });

    const ios  = parsed.filter(p => p.fmt === 'io');
    const sims = parsed.filter(p => p.fmt === 'sim');

    if (ios.length) {
      const mxName = Math.max(...ios.map(p => p.name.length));
      const mxAt   = Math.max(...ios.map(p => p.at.length));
      const mxType = Math.max(...ios.map(p => p.type.length));
      return parsed.map(p => {
        if (p.fmt === 'raw') return p.original;
        const cmt = p.rest ? `  ${p.rest}` : '';
        if (p.fmt === 'io')
          return `${p.indent}${p.name.padEnd(mxName)}  ${p.at.padEnd(mxAt)}  : ${p.type.padEnd(mxType)};${cmt}`;
        return `${p.indent}${p.name}  : ${p.type};${cmt}`;
      });
    }

    if (sims.length) {
      const mxName = Math.max(...sims.map(p => p.name.length));
      const mxType = Math.max(...sims.map(p => p.type.length));
      return parsed.map(p => {
        if (p.fmt === 'raw') return p.original;
        const cmt = p.rest ? `  ${p.rest}` : '';
        return `${p.indent}${p.name.padEnd(mxName)}  : ${p.type.padEnd(mxType)};${cmt}`;
      });
    }

    return lines;
  },

  // Resaltador de sintaxis PLC para el editor de código.
  // Detecta: keywords, tipos de datos, strings, comentarios (// y (* *)),
  // hardware addresses (%IX…), pragmas ({attribute…}) y etiquetas XML.
  // Envuelve cada línea en <span class="line"> para el contador CSS de líneas.
  highlightPLC(raw) {
    if (!raw) return '';

    const KEYWORDS = new Set([
      'VAR','VAR_GLOBAL','VAR_INPUT','VAR_OUTPUT','VAR_IN_OUT','VAR_TEMP','VAR_STAT',
      'END_VAR','PROGRAM','FUNCTION','FUNCTION_BLOCK','END_PROGRAM','END_FUNCTION',
      'END_FUNCTION_BLOCK','METHOD','END_METHOD','PROPERTY','END_PROPERTY',
      'IF','THEN','ELSE','ELSIF','END_IF','FOR','TO','BY','DO','END_FOR',
      'WHILE','END_WHILE','REPEAT','UNTIL','END_REPEAT','CASE','OF','END_CASE',
      'RETURN','EXIT','NOT','AND','OR','XOR','MOD','TRUE','FALSE',
      'AT','RETAIN','PERSISTENT','CONSTANT','TYPE','END_TYPE',
      'STRUCT','END_STRUCT','UNION','END_UNION','ARRAY','POINTER','REF_TO',
      'INTERFACE','END_INTERFACE','EXTENDS','IMPLEMENTS',
      'PUBLIC','PRIVATE','PROTECTED','INTERNAL','ABSTRACT','FINAL',
      'THIS','SUPER','NEW','DELETE'
    ]);

    const TYPES = new Set([
      'BOOL','BYTE','WORD','DWORD','LWORD',
      'SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT',
      'REAL','LREAL','TIME','DATE','DT','TOD','STRING','WSTRING',
      'ANY','ANY_INT','ANY_REAL','ANY_NUM','ANY_BIT','ANY_DATE',
      'ANY_ELEMENTARY','ANY_DERIVED','PVOID','XINT','UXINT'
    ]);

    let out = '';
    let i = 0;
    const len = raw.length;

    const esc  = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const span = (cls, text) => `<span class="${cls}">${esc(text)}</span>`;

    while (i < len) {
      const ch  = raw[i];
      const ch2 = raw[i + 1] || '';

      // Block comment (* ... *)
      if (ch === '(' && ch2 === '*') {
        const end   = raw.indexOf('*)', i + 2);
        const chunk = end === -1 ? raw.slice(i) : raw.slice(i, end + 2);
        out += span('plc-comment', chunk);
        i += chunk.length;
        continue;
      }

      // Line comment //
      if (ch === '/' && ch2 === '/') {
        const end   = raw.indexOf('\n', i);
        const chunk = end === -1 ? raw.slice(i) : raw.slice(i, end);
        out += span('plc-comment', chunk);
        i += chunk.length;
        continue;
      }

      // Single-quoted string 'x'
      if (ch === "'") {
        let j = i + 1;
        while (j < len && raw[j] !== "'" && raw[j] !== '\n') j++;
        if (raw[j] === "'") j++;
        out += span('plc-string', raw.slice(i, j));
        i = j;
        continue;
      }

      // XML tag  <Tag ...>  (solo si < va seguido de letra / ? ! /)
      if (ch === '<' && /[a-zA-Z?!/]/.test(ch2)) {
        const end = raw.indexOf('>', i);
        if (end !== -1) {
          out += span('plc-xmltag', raw.slice(i, end + 1));
          i = end + 1;
          continue;
        }
      }

      // Hardware address  %IX0.0  %QX0.0  %MW1
      if (ch === '%') {
        let j = i + 1;
        while (j < len && /[\w.]/.test(raw[j])) j++;
        out += span('plc-hwaddr', raw.slice(i, j));
        i = j;
        continue;
      }

      // Pragma / attribute  {attribute 'x'}
      if (ch === '{') {
        const end   = raw.indexOf('}', i);
        const chunk = end === -1 ? raw.slice(i) : raw.slice(i, end + 1);
        out += span('plc-attr', chunk);
        i += chunk.length;
        continue;
      }

      // Número  (dígito en límite de palabra)
      if (/[0-9]/.test(ch) && (i === 0 || /\W/.test(raw[i - 1]))) {
        let j = i;
        while (j < len && /[0-9_.#EeXx]/.test(raw[j])) j++;
        out += span('plc-number', raw.slice(i, j));
        i = j;
        continue;
      }

      // Identificador → keyword / tipo / variable
      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < len && /[\w]/.test(raw[j])) j++;
        const word  = raw.slice(i, j);
        const upper = word.toUpperCase();
        if (KEYWORDS.has(upper))   out += span('plc-kw',   word);
        else if (TYPES.has(upper)) out += span('plc-type', word);
        else                       out += esc(word);
        i = j;
        continue;
      }

      out += esc(ch);
      i++;
    }

    // Envuelve cada línea para que CSS pueda renderizar los números de línea
    return out.split('\n')
      .map(l => `<span class="line">${l}</span>`)
      .join('');
  },

};
