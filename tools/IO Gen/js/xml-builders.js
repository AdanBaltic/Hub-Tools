// ── xml-builders.js ───────────────────────────────────────────────────────────
// Construcción de contenido XML y descarga de archivos.
// Se mezclan en methods de Vue via spread.
//   - xmlEscape         : escapa caracteres especiales XML (&, <, >)
//   - buildIOTagsXml    : inserta el texto PLC en la plantilla IO_Tags / GVL
//   - buildAlarmTagsXml : inserta el texto PLC y los límites en Alarm_tags
//   - buildTmc          : ensambla el fichero Alarms.tmc
//   - downloadTextFile  : descarga genérica de un string como archivo
//   - downloadXmlIO     : descarga IO_Tags.xml
//   - downloadXmlGVL    : descarga GVL.xml
//   - downloadXmlAlarm  : descarga Alarm_tags.xml
//   - downloadTmc       : descarga Alarms.tmc
// ─────────────────────────────────────────────────────────────────────────────

const xmlBuilders = {

  // Escapa los caracteres especiales XML: & → &amp;  < → &lt;  > → &gt;
  xmlEscape(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  // Inserta el texto PLC generado en la plantilla XML de IO_Tags o GVL.
  // El marcador "// Insert code here" se sustituye por el contenido escapado.
  buildIOTagsXml(templateXml, ioTagsStText) {
    return (templateXml ?? '').replace(
      '// Insert code here',
      this.xmlEscape((ioTagsStText ?? '').trimEnd())
    );
  },

  // Inserta el texto PLC y los valores máximos en la plantilla de Alarm_tags.
  // Sustituye __MAX_ID__ / __MAX_IDA__ y el marcador "// Insert code here".
  buildAlarmTagsXml(templateXml, persistentST, maxID, maxIDA) {
    let xml = String(templateXml ?? '');

    xml = xml.replace(/ArrMaxD\s*:\s*INT\s*:=\s*__MAX_ID__\s*;/g,  `ArrMaxD: INT := ${maxID};`);
    xml = xml.replace(/ArrMaxA\s*:\s*INT\s*:=\s*__MAX_IDA__\s*;/g, `ArrMaxA: INT := ${maxIDA};`);

    xml = xml.replace(
      '// Insert code here',
      this.xmlEscape((persistentST ?? '').trimEnd())
    );

    return xml;
  },

  // Ensambla el fichero Alarms.tmc uniendo cabecera + eventos + pie.
  buildTmc(tplHeader, tplFooter, digitalEventsText, analogEventsText) {
    const digital = (digitalEventsText ?? '').trimEnd();
    const analog  = (analogEventsText  ?? '').trimEnd();
    const middle  = [digital, analog].filter(Boolean).join('\n');
    return String(tplHeader ?? '') + middle + '\n' + String(tplFooter ?? '');
  },

  // Descarga genérica: crea un Blob y dispara la descarga en el navegador.
  downloadTextFile(content, filename, mime = 'application/xml') {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Descargas específicas ────────────────────────────────────────────────

  downloadXmlIO() {
    const xml = this.buildIOTagsXml(this.tplXmlIOTags, this.tagsText);
    this.downloadTextFile(xml, 'IO_Tags.xml');
  },

  downloadXmlGVL() {
    const xml = this.buildIOTagsXml(this.tplXmlGVL, this.GVLtags);
    this.downloadTextFile(xml, 'GVL.xml');
  },

  downloadXmlAlarm() {
    const persistentST = [this.alarmDigitalText, this.alarmAnalogText]
      .filter(Boolean)
      .join('\n')
      .trimEnd();

    const xml = this.buildAlarmTagsXml(
      this.tplXmlAlarmTags,
      persistentST,
      this.maxID,
      this.maxIDA
    );
    this.downloadTextFile(xml, 'Alarm_tags.xml');
  },

  downloadTmc() {
    const tmc = this.buildTmc(
      this.tplTmcHeader,
      this.tplTmcFooter,
      this.tmcDigitalEventsText,
      this.tmcAnalogEventsText
    );
    this.downloadTextFile(tmc, 'Alarms.tmc', 'application/xml');
  },

};
