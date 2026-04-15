// ── excel-helpers.js ──────────────────────────────────────────────────────────
// Funciones de utilidad para parsear y normalizar datos del Excel.
// Se mezclan en methods de Vue via spread.
//   - toStrTrim               : convierte cualquier celda a string sin espacios
//   - normalizeHeader         : normaliza el nombre de una columna de cabecera
//   - isAlarmMark             : detecta si una celda es marca de alarma ('x')
//   - enToConfig              : convierte celda Enable a valor de AlarmConfig
//   - fmtNumberOrRaw          : formatea número o devuelve el string tal cual
//   - toIdentifier            : convierte un string a identificador PLC válido
//   - pickSheetHeaderRowIndex : localiza la fila de cabecera del Excel
// ─────────────────────────────────────────────────────────────────────────────

const excelHelpers = {

  // Convierte una celda del Excel a string limpio (sin espacios al inicio/fin).
  // Devuelve '' si el valor es null o undefined.
  toStrTrim(v) {
    return (v === null || v === undefined) ? '' : String(v).trim();
  },

  // Normaliza el texto de una cabecera de columna:
  // minúsculas, espacios múltiples → uno solo, quita caracteres no alfanuméricos.
  // Ejemplo: "  ALM Name " → "alm name"
  normalizeHeader(s) {
    return this.toStrTrim(s)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w ]/g, '');
  },

  // Devuelve true si la celda contiene la marca de alarma ('x' en minúsculas).
  isAlarmMark(v) {
    return this.toStrTrim(v).toLowerCase() === 'x';
  },

  // Convierte la celda Enable (columna en / en2 / en3 / en4) al valor
  // de AlarmConfig que debe usarse para ese umbral:
  //   vacío  → '0'  (desactivado)
  //   'x'/1/true → defaultConfig  (usa el AlarmConfig general)
  //   número → ese número directamente
  enToConfig(v, defaultConfig) {
    const s = this.toStrTrim(v).toLowerCase();
    if (!s) return '0';
    if (s === 'x' || s === '1' || s === 'true') return defaultConfig;
    const n = Number(s);
    if (!Number.isNaN(n) && Number.isFinite(n)) return String(n);
    return defaultConfig;
  },

  // Formatea un valor como número si es posible; si no, lo devuelve como string.
  // Si está vacío, devuelve fallback ('0' por defecto).
  fmtNumberOrRaw(v, fallback = '0') {
    const s = this.toStrTrim(v);
    if (!s) return fallback;
    const n = Number(s);
    if (!Number.isNaN(n) && Number.isFinite(n)) return String(n);
    return s;
  },

  // Convierte un string a un identificador PLC válido:
  // reemplaza cualquier carácter no alfanumérico por '_'.
  toIdentifier(s) {
    return this.toStrTrim(s).replace(/[^\w]/g, '_');
  },

  // Busca la fila de cabecera del Excel (la que contiene "NAME", "Alarm", etc.).
  // Estrategia:
  //   1. Intenta la fila configurada en headerRowNumber (desde config.js).
  //   2. Si no contiene 'name', escanea las primeras 50 filas buscando
  //      una que tenga 'name' + 'alarm', o al menos 'name'.
  //   3. Devuelve -1 si no encuentra nada (dispara error en generateAll).
  pickSheetHeaderRowIndex() {
    const fixedIdx  = Math.max(0, this.headerRowNumber - 1);
    const fixedRow  = this.rows[fixedIdx] || [];
    const fixedNorm = fixedRow.map(h => this.normalizeHeader(h));

    if (fixedNorm.includes('name')) return fixedIdx;

    const maxScan = Math.min(this.rows.length, 50);
    for (let i = 0; i < maxScan; i++) {
      const r = this.rows[i] || [];
      const n = r.map(h => this.normalizeHeader(h));
      if (n.includes('name') && n.includes('alarm')) return i;
      if (n.includes('name')) return i;
    }
    return -1;
  },

};
