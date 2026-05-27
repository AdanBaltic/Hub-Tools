// ── generators.js ─────────────────────────────────────────────────────────────
// Generadores de código PLC a partir de los datos del Excel.
// Se mezclan en methods de Vue via spread.
//
//   generateAll          → orquestador principal (llama a los dos sub-generadores)
//   _buildIOTagsAndGVL   → genera IO_Tags, GVL y VariableScale
//   _buildAlarmOutputs   → genera Alarm_tags, Declarations, Program y .tmc
// ─────────────────────────────────────────────────────────────────────────────

const generators = {

  // ════════════════════════════════════════════════════════
  // Generador principal
  // Localiza la cabecera del Excel, mapea las columnas y
  // delega la generación en los dos sub-generadores.
  // ════════════════════════════════════════════════════════
  generateAll() {
    const headerRowIndex = this.pickSheetHeaderRowIndex();
    if (headerRowIndex === -1) {
      this.tags                    = [];
      this.tagsText                = '';
      this.alarmDigitalText        = '';
      this.alarmAnalogText         = '';
      this.alarmTagsText           = '';
      this.alarmsTwinCatDeclaration = '';
      this.alarmsTwinCatProgram    = '';
      this.debug = `Header row not found. Expected row ${this.headerRowNumber} or a row containing NAME/Alarm.`;
      return;
    }

    const headerRaw    = this.rows[headerRowIndex] || [];
    const headerNorm   = headerRaw.map(h => this.normalizeHeader(h));
    const startDataIndex = headerRowIndex + 1;

    // Mapa columna → índice: { 'name': 0, 'alarm': 1, … }
    const col = {};
    headerNorm.forEach((h, i) => { if (h) col[h] = i; });

    // Columnas obligatorias
    const idxNAME  = col['name'];
    const idxAlarm = col['alarm'];
    const idxTYPE  = col['type'];
    const idxHMI   = col['hmi'];

    if (idxNAME  === undefined) { this.debug = `"NAME" column not found on header row ${headerRowIndex + 1}.`;  return; }
    if (idxAlarm === undefined) { this.debug = `"Alarm" column not found on header row ${headerRowIndex + 1}.`; return; }
    if (idxTYPE  === undefined) { this.debug = `"TYPE" column not found on header row ${headerRowIndex + 1}.`;  return; }
    if (idxHMI   === undefined) { this.variableScalingProgram = ''; this.debug += '\nHMI column not found.'; }

    const dataRows = this.rows.slice(startDataIndex);

    this._buildIOTagsAndGVL(dataRows, col, startDataIndex);
    this._buildAlarmOutputs(dataRows, col, startDataIndex);
	this._buildIOTestOutputs(dataRows, col, startDataIndex);

    if (!this.debug || !this.debug.startsWith('Error:')) {
	  this.debug =
		`Data start row: ${startDataIndex + 1}\n` +
		`Total IOs (control column): ${this.controlCount}\n` +
		`Digital alarms: ${this.maxID}\n` +
		`Analog alarms: ${this.maxIDA}\n`;
	}
  },

  // ════════════════════════════════════════════════════════
  // Sub-generador: IO_Tags y GVL
  // Itera las filas marcadas como Control o HMI.
  //
  // Produce:
  //   this.tagsText              → IO_Tags GVL (hardware linked tags)
  //   this.GVLtags               → GVL interno (HMI tags + subsystems)
  //   this.variableScalingProgram → VariableScale PRG
  //   this.tags, this.controlCount
  //
  // Columnas Excel:
  //   name, control, hmi, type, hardware declaration, comment,
  //   location, modbus declaration/modbus/modbus reg,
  //   rawzero, rawfull, scaledzero, scaledfull, sub system
  // ════════════════════════════════════════════════════════
  _buildIOTagsAndGVL(dataRows, col, startDataIndex) {
    const idxNAME         = col['name'];
    const idxControl      = col['control'];
    const idxHMI          = col['hmi'];
    const idxTYPE         = col['type'];
    const idxHardwareDecl = col['hardware declaration'];
    const idxComment      = col['comment'];
    const idxSubSystem    = col['sub system'];
    const idxLocation     = col['location'];
    const idxModbusReg    = col['modbus declaration'] ?? col['modbus'] ?? col['modbus reg'] ?? col['modbus register'];
    const idxRawZero      = col['rawzero'];
    const idxRawFull      = col['rawfull'];
    const idxScaledZero   = col['scaledzero'];
    const idxScaledFull   = col['scaledfull'];

    const ioTagDeclLines = [];
    const stAiDeclLines  = [];
    const scalingLines   = [];
    let controlCount     = 0;

    // GVL (internal tags)
    const gvlLines          = [];
    const gvlLinesModbusTCP = [];  // Location = ModbusTCP
    const gvlLinesModbus    = [];  // Location = Modbus
    const gvlErrors         = [];
    const allowedGvlTypes   = new Set(['DIGITAL','BOOL','INT','UINT','DINT','SINT','USINT','DUINT','REAL','WORD','DWORD','BYTE']);
    const normalizeGvlType  = (typeRaw) => {
      const t = this.toStrTrim(typeRaw).toUpperCase();
      if (!t) return null;
      if (t.includes('DIGITAL') || t.includes('BOOL')) return 'BOOL';
      return allowedGvlTypes.has(t) ? t : null;
    };

    // SubSystem: se recopilan de todas las filas (únicos)
    const subSystemMap = new Map(); // key: SubSystem_<id>, value: texto original

    // Escapa comillas simples en strings ST: ' → ''
    const stEscape = (s) => String(s ?? '').replace(/'/g, "''");

    const producedTags = new Set();

    for (const [i, r] of dataRows.entries()) {
      const controlCell = (idxControl !== undefined) ? this.toStrTrim(r[idxControl]) : '';
      const isControl   = (controlCell.trim().toLowerCase() === 'x');

      const hmiCell = (idxHMI !== undefined) ? this.toStrTrim(r[idxHMI]) : '';
      const isHmi   = (hmiCell.trim().toLowerCase() === 'x');
	  
	  const tag = this.toStrTrim(r[idxNAME]);
	  const hwDecl        = (idxHardwareDecl !== undefined) ? this.toStrTrim(r[idxHardwareDecl]) : '';
	  const comment       = (idxComment      !== undefined) ? this.toStrTrim(r[idxComment])      : '';
	  const commentSuffix = comment ? ` // ${comment}` : '';
	
	  // GVL: tipo 
      const typeRaw     = (idxTYPE     !== undefined) ? this.toStrTrim(r[idxTYPE])     : '';
      const gvlType     = normalizeGvlType(typeRaw);
	  
      // Recopilar SubSystem de TODAS las filas (no solo Control/HMI)
      const subSystemRaw = (idxSubSystem !== undefined) ? this.toStrTrim(r[idxSubSystem]) : '';
      if (subSystemRaw) {
        const varName = `SubSystem_${this.toIdentifier(subSystemRaw)}`;
        if (!subSystemMap.has(varName)) subSystemMap.set(varName, subSystemRaw);
      }

	  // Declaraciones GVL  
	  if (!isControl) {		
		// GVL: localización
        const locationRaw   = (idxLocation !== undefined) ? this.toStrTrim(r[idxLocation]) : '';
        const locationLower = locationRaw.toLowerCase();
        const isModbusTCP   = locationLower.includes('modbustcp');
        const isModbus      = !isModbusTCP && locationLower.includes('modbus');

        if (!gvlType) {
          const excelRow = startDataIndex + 1 + i;
          gvlErrors.push(`Row ${excelRow}: invalid TYPE '${typeRaw}' for tag '${tag}'`);
        } else {
          const cmt = comment || '';
          if (isModbusTCP) gvlLinesModbusTCP.push(`${tag}: ${gvlType} ;       //${cmt}`);
          else if (isModbus)    gvlLinesModbus.push(`${tag}: ${gvlType} ;       //${cmt}`);
          else             gvlLines.push(`${tag}: ${gvlType} ;       //${cmt}`);
        }
      }
	  
      // Solo procesar filas Control o HMI
      if (!isControl && !isHmi) continue;
	  if (isControl) {
		  if (!tag) continue;
		  controlCount++;
			
		  // Ignorar tags de reserva
		  const tagLower = tag.toLowerCase();
		  if (tagLower === 'spare_di' || tagLower === 'spare_do' || tagLower === 'spare_ai' || tagLower === 'spare_ao') continue;

		  // Determinar declaración AT según sufijo del tag
		  let atDecl = '';
		  if      (tag.endsWith('_DI')) atDecl = 'AT %I* : BOOL';
		  else if (tag.endsWith('_DO')) atDecl = 'AT %Q* : BOOL';
		  else if (tag.endsWith('_AI')) atDecl = 'AT %I* : INT';
		  else if (tag.endsWith('_AO')) atDecl = 'AT %Q* : INT';

		  // Declaración base de IO_Tags
		  if (hwDecl) ioTagDeclLines.push(hwDecl);
		  ioTagDeclLines.push(`${tag} ${atDecl};${commentSuffix}`);
		}
      
	  // Declaraciones HMI + Control
      if (isHmi && isControl) {
        	
		if (typeRaw.toLowerCase() === 'digital') continue;
		
		const stVar = `st_${tag}`;
        const rawZero    = this.fmtNumberOrRaw((idxRawZero    !== undefined) ? r[idxRawZero]    : null, 0);
        const rawFull    = this.fmtNumberOrRaw((idxRawFull    !== undefined) ? r[idxRawFull]    : null, 0);
        const scaledZero = this.fmtNumberOrRaw((idxScaledZero !== undefined) ? r[idxScaledZero] : null, 0);
        const scaledFull = this.fmtNumberOrRaw((idxScaledFull !== undefined) ? r[idxScaledFull] : null, 0);

        stAiDeclLines.push(`${stVar}: ST_AI := (RawZero:=${rawZero}, RawFull:=${rawFull}, ScaledZero:=${scaledZero}, ScaledFull:=${scaledFull});`);
        scalingLines.push(`${stVar}.Raw := ${tag}; ${stVar}.Scaled := F_AiScale(${stVar});`);
	  }
	  
      producedTags.add(tag);
      this.controlCount = controlCount;
    }

    // Formateo final: primero IO tags, luego instancias ST_AI
    const separator = (stAiDeclLines.length > 0) ? '\n' : '';
    this.tagsText =
      `{attribute 'global_init_slot' := '40500'}\n` +
      `VAR_GLOBAL\n` +
      `{region "I/O Tags"}	// I/O hardware linked tags\n` +
      this.alignDecls(ioTagDeclLines).join('\n') + separator +
      `{endregion}\n\n` +
      `{region "Scaling"}		// Analog tags scalings\n` +
      stAiDeclLines.join('\n') + `\n` +
      `{endregion}\n\n` +
      `END_VAR`;

    this.variableScalingProgram = scalingLines.join('\n').trim();
    this.tags = [...producedTags];

    // GVL: subsystems ordenados alfabéticamente
    const internalLines = Array.from(subSystemMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([varName, raw]) => `${varName}: FB_TcSourceInfo:= (sName:='${stEscape(raw)}');`);

    const sections = [
      `VAR_GLOBAL`,
      `// Internal tags\n${this.alignDecls(gvlLines).join('\n')}`,
      gvlLinesModbusTCP.length ? `// ModbusTCP tags\n${this.alignDecls(gvlLinesModbusTCP).join('\n')}` : '',
      gvlLinesModbus.length    ? `// Modbus tags\n${this.alignDecls(gvlLinesModbus).join('\n')}`       : '',
      `// Sub systems\n${internalLines.join('\n')}`,
      `END_VAR`
    ];

    this.GVLtags = sections.filter(Boolean).join('\n\n');

    if (gvlErrors.length) {
      this.debug = (this.debug ? (this.debug + '\n') : '') + 'GVL TYPE errors:\n' + gvlErrors.join('\n');
    }
  },

  // ════════════════════════════════════════════════════════
  // Sub-generador: Alarm_tags y Alarms PRG
  // Itera las filas marcadas con 'x' en la columna Alarm.
  //
  // Produce:
  //   this.alarmDigitalText          → declaraciones digitales (Alarm_tags)
  //   this.alarmAnalogText           → declaraciones analógicas (Alarm_tags)
  //   this.alarmTagsText             → GVL completo Alarm_tags
  //   this.alarmsTwinCatDeclaration  → VAR del PROGRAM Alarms
  //   this.alarmsTwinCatProgram      → cuerpo del PROGRAM Alarms
  //   this.tmcText                   → fichero Alarms.tmc
  //   this.tmcDigitalEventsText      → eventos digitales (fragmento .tmc)
  //   this.tmcAnalogEventsText       → eventos analógicos (fragmento .tmc)
  //   this.maxID, this.maxIDA        → IDs máximos para los arrays
  //
  // Columnas Excel:
  //   name, alarm, type, alm name, sub system, id, ida, inv,
  //   alarmconfig, alarmdelay, condition, deadband,
  //   en/lowlowlimit/lowlowdelay, en2/lowlimit/lowdelay,
  //   en3/highlimit/highdelay, en4/highhighlimit/highhighdelay,
  //   id1, id2, id3, id4, digital alarm severity
  // ════════════════════════════════════════════════════════
  _buildAlarmOutputs(dataRows, col, startDataIndex) {
  	const idxNAME      = col['name'];
  	const idxAlarm     = col['alarm'];
	const idxControl   = col['control'];
  	const idxTYPE      = col['type'];
  	const idxALMNAME   = col['alm name'];
  	const idxSubSystem = col['sub system'];
	const idxLocation  = col['location'];
  
  	// Columnas alarmas digitales
  	const idxID          = col['id'];
  	const idxInv         = col['inv'];
  	const idxAlarmConfig = col['alarmconfig'];
  	const idxAlarmDelay  = col['alarmdelay'];
  
  	// Columnas alarmas analógicas
  	const idxIDA           = col['ida'];
  	const idxCondition     = col['condition'];
  	const idxDeadband      = col['deadband'];
  	const idxAlarmConfigLL = col['en'];
  	const idxLowLowLimit   = col['lowlowlimit'];
  	const idxLowLowDelay   = col['lowlowdelay'];
  	const idxAlarmConfigL  = col['en2'];
  	const idxLowLimit      = col['lowlimit'];
  	const idxLowDelay      = col['lowdelay'];
  	const idxAlarmConfigH  = col['en3'];
  	const idxHighLimit     = col['highlimit'];
  	const idxHighDelay     = col['highdelay'];
  	const idxAlarmConfigHH = col['en4'];
  	const idxHighHighLimit = col['highhighlimit'];
  	const idxHighHighDelay = col['highhighdelay'];
  
  	// Columnas fichero .tmc
  	const idx1           = col['id1'];
  	const idx2           = col['id2'];
  	const idx3           = col['id3'];
  	const idx4           = col['id4'];
  	const idxDigSeverity = col['digital alarm severity'];
  
  	const xmlEscapeAttr = (s) => this.xmlEscape(s ?? '').replace(/\\"/g, '&quot;');
  	const tmcEvent = (id, eventName, displayName, severity, systemValue) => {
  	  const idAttr = xmlEscapeAttr(String(id ?? '').trim());
  	  const disp   = String(displayName ?? '').trim();
  	  const sev    = String(severity ?? '').trim();
  	  const sys    = this.xmlEscape(String(systemValue ?? '').trim());
  	  return (`			<EventId>
  				<Name Id="${idAttr}">${eventName}</Name>
  				<DisplayName TxtId=""><![CDATA[${disp}]]></DisplayName>
  				<Severity>${sev}</Severity>
  				<Properties>
  					<Property>
  						<Name>System</Name>
  						<Value>${sys}</Value>
  					</Property>
  				</Properties>
  			</EventId>`);
  	};
  
  	const tmcDigitalEvents = [];
  	const tmcAnalogEvents  = [];
  
  	const digitalAlarmItems = [];
  	const analogAlarmItems  = [];
  
  	const fbDeclDigital    = [];
  	const fbDeclAnalog     = [];
  	const eventDeclDigital = [];
  	const eventDeclAnalog  = [];
  
  	const programFbLinesDigital       = [];
  	const programFbLinesAnalog        = [];
  	const programCreateExLinesDigital = [];
  	const programCreateExLinesAnalog  = [];
  
  	const typeErrors = [];
  	let maxID  = null;
  	let maxIDA = null;
  
  	const parsePositiveInt = (raw) => {
  	  const s = String(raw ?? '').trim();
  	  if (!s) return null;
  	  const n = Number(s);
  	  return (Number.isInteger(n) && n > 0) ? n : null;
  	};
  
  	for (const [i, r] of dataRows.entries()) {
  	  const tag = this.toStrTrim(r[idxNAME]);
  	  if (!tag) continue;
  	  if (!this.isAlarmMark(r[idxAlarm])) continue;
  
  	  const excelRow = startDataIndex + 1 + i;
  
  	  const typeRaw = this.toStrTrim(r[idxTYPE]);
  	  if (!typeRaw) {
  		typeErrors.push(`Row ${excelRow}: 'TYPE' column is empty (${tag})`);
  		continue;
  	  }
  
  	  const typeUpper = typeRaw.toUpperCase();
  	  const isDigital = (typeUpper === 'DIGITAL' || typeUpper === 'BOOL');
  	  const isAnalog  = !isDigital;
  
  	  const almName = (idxALMNAME !== undefined) ? this.toStrTrim(r[idxALMNAME]) : '';
  	  const sysCell = (idxSubSystem !== undefined) ? this.toStrTrim(r[idxSubSystem]) : '';

	  const controlCell = (idxControl !== undefined) ? this.toStrTrim(r[idxControl]) : '';
	  const isControl = (controlCell.trim().toLowerCase() === 'x');
  
  	  if (isDigital) {
  		const idRaw        = (idxID !== undefined) ? this.toStrTrim(r[idxID]) : '';
  		const almNameCell  = almName;
  		const alarmConfig  = this.fmtNumberOrRaw(idxAlarmConfig !== undefined ? r[idxAlarmConfig] : '', '0');
  		const alarmDelay   = this.fmtNumberOrRaw(idxAlarmDelay  !== undefined ? r[idxAlarmDelay]  : '', '0');
  
  		const id1 = (idx1 !== undefined) ? this.toStrTrim(r[idx1]) : '';
  		const sev = (idxDigSeverity !== undefined) ? this.toStrTrim(r[idxDigSeverity]) : 'Warning';
  		if (id1) tmcDigitalEvents.push(tmcEvent(id1, `Event_${tag}`, almName, sev, sysCell));
  
  		digitalAlarmItems.push({
  		  excelRow,
  		  tag,
  		  idRaw,
  		  id: null,
  		  lineTemplate: `st_al_${tag}: ST_ALARM_DI := (ID:=__ID__, Tag:='${tag}', TagInfo:='${almNameCell}', AlarmConfig:=${alarmConfig}, AlarmDelay:=${alarmDelay}, Snooze:=0);`
  		});
  	  }

	  const locationRaw = (idxLocation !== undefined) ? this.toStrTrim(r[idxLocation]) : '';
	  const isModbusTCP = locationRaw.toLowerCase().includes('modbustcp');

  	  if (isAnalog) {
  		const idaRaw       = (idxIDA !== undefined) ? this.toStrTrim(r[idxIDA]) : '';
  		const almNameCell  = almName;
  		const alarmConfig  = this.fmtNumberOrRaw(idxAlarmConfig !== undefined ? r[idxAlarmConfig] : '', '0');
  
  		const deadband      = this.fmtNumberOrRaw(idxDeadband      !== undefined ? r[idxDeadband]      : '', '0');
  		const lowLowLimit   = this.fmtNumberOrRaw(idxLowLowLimit   !== undefined ? r[idxLowLowLimit]   : '', '0');
  		const lowLowDelay   = this.fmtNumberOrRaw(idxLowLowDelay   !== undefined ? r[idxLowLowDelay]   : '', '0');
  		const lowLimit      = this.fmtNumberOrRaw(idxLowLimit      !== undefined ? r[idxLowLimit]      : '', '0');
  		const lowDelay      = this.fmtNumberOrRaw(idxLowDelay      !== undefined ? r[idxLowDelay]      : '', '0');
  		const highLimit     = this.fmtNumberOrRaw(idxHighLimit     !== undefined ? r[idxHighLimit]     : '', '0');
  		const highDelay     = this.fmtNumberOrRaw(idxHighDelay     !== undefined ? r[idxHighDelay]     : '', '0');
  		const highHighLimit = this.fmtNumberOrRaw(idxHighHighLimit !== undefined ? r[idxHighHighLimit] : '', '0');
  		const highHighDelay = this.fmtNumberOrRaw(idxHighHighDelay !== undefined ? r[idxHighHighDelay] : '', '0');
  		const alarmConfigLL = this.enToConfig(idxAlarmConfigLL !== undefined ? r[idxAlarmConfigLL] : '', alarmConfig);
  		const alarmConfigL  = this.enToConfig(idxAlarmConfigL  !== undefined ? r[idxAlarmConfigL]  : '', alarmConfig);
  		const alarmConfigH  = this.enToConfig(idxAlarmConfigH  !== undefined ? r[idxAlarmConfigH]  : '', alarmConfig);
  		const alarmConfigHH = this.enToConfig(idxAlarmConfigHH !== undefined ? r[idxAlarmConfigHH] : '', alarmConfig);
  
  		const id1 = (idx1 !== undefined) ? this.toStrTrim(r[idx1]) : '';
  		const id2 = (idx2 !== undefined) ? this.toStrTrim(r[idx2]) : '';
  		const id3 = (idx3 !== undefined) ? this.toStrTrim(r[idx3]) : '';
  		const id4 = (idx4 !== undefined) ? this.toStrTrim(r[idx4]) : '';
		const scaledMaxExpr = isModbusTCP ? '32767' : `st_${tag}.ScaledFull`;

  		if (id1) tmcAnalogEvents.push(tmcEvent(id1, `EventHH_${tag}`, `${almName} high high`, 'Critical', sysCell));
  		if (id2) tmcAnalogEvents.push(tmcEvent(id2, `EventH_${tag}`,  `${almName} high`,      'Warning',  sysCell));
  		if (id3) tmcAnalogEvents.push(tmcEvent(id3, `EventL_${tag}`,  `${almName} low`,       'Warning',  sysCell));
  		if (id4) tmcAnalogEvents.push(tmcEvent(id4, `EventLL_${tag}`, `${almName} low low`,   'Critical', sysCell));
		
  		analogAlarmItems.push({
  		  excelRow,
  		  tag,
  		  idRaw: idaRaw,
  		  id: null,
  		  lineTemplate:
  			`st_al_${tag}: ST_ALARM_AI := (` +
  			  `ID:=__ID__, ` +
  			  `TAG:='${tag}', ` +
  			  `ScaledMax:=${scaledMaxExpr}, ` +
  			  `TagInfo:='${almNameCell}', ` +
  			  `AlarmConfigLL:=${alarmConfigLL}, AlarmConfigL:=${alarmConfigL}, AlarmConfigH:=${alarmConfigH}, AlarmConfigHH:=${alarmConfigHH}, ` +
  			  `Deadband:=${deadband}, ` +
  			  `LowLowLimit:=${lowLowLimit}, LowLowDelay:=${lowLowDelay}, ` +
  			  `LowLimit:=${lowLimit}, LowDelay:=${lowDelay}, ` +
  			  `HighLimit:=${highLimit}, HighDelay:=${highDelay}, ` +
  			  `HighHighLimit:=${highHighLimit}, HighHighDelay:=${highHighDelay}` +
  			`);`
  		});
  	  }
  
  	  if (isDigital) fbDeclDigital.push(`fb_${tag}: FB_DI;`);
  	  if (isAnalog)  fbDeclAnalog.push(`fb_${tag}: FB_AI;`);
  
  	  if (isDigital) {
  		eventDeclDigital.push(`Event_${tag}: FB_TcAlarm;`);
  	  }
  	  if (isAnalog) {
  		eventDeclAnalog.push(`EventL_${tag}: FB_TcAlarm;`);
  		eventDeclAnalog.push(`EventLL_${tag}: FB_TcAlarm;`);
  		eventDeclAnalog.push(`EventH_${tag}: FB_TcAlarm;`);
  		eventDeclAnalog.push(`EventHH_${tag}: FB_TcAlarm;`);
  	  }
  
  	  const invMark    = (idxInv !== undefined) ? this.toStrTrim(r[idxInv]).toLowerCase() : '';
  	  const isInverted = (invMark === 'x');
  
  	  const subSystemRaw  = (idxSubSystem !== undefined) ? this.toStrTrim(r[idxSubSystem]) : '';
  	  const subSystemExpr = subSystemRaw ? `SubSystem_${this.toIdentifier(subSystemRaw)}` : '0';
  	  const condRaw       = (idxCondition !== undefined) ? this.toStrTrim(r[idxCondition]) : '';
  	  const bCondition    = condRaw ? condRaw : 'True';
  
  	  if (isDigital) {
  		const varExpr = isInverted ? `NOT ${tag}` : `${tag}`;
  
  		programFbLinesDigital.push([
  		  `fb_${tag}`,
  		  `(i_bVariable:=${varExpr},`,
  		  `i_bConfig:=bAlarmSetupActive, ST_Variable:=st_al_${tag},`,
  		  `FB_Alarm:=Event_${tag});`,
  		]);
  
  		programCreateExLinesDigital.push(
  		  `Event_${tag}.CreateEx(TC_Events.AlarmClass.Event_${tag}, TRUE, ${subSystemExpr});`
  		);
  	  }
  
  	  if (isAnalog) {
  		const analogVarExpr = isControl ? `st_${tag}.Scaled` : `${tag}`;
		
		programFbLinesAnalog.push([
  		  `fb_${tag}`,
  		  `(i_nVariable:=${analogVarExpr},`,
  		  `i_bCondition:=${bCondition}, i_bConfig:=bAlarmSetupActive, ST_Variable:=st_al_${tag},`,
  		  `FB_LowAlarm:=EventL_${tag},`,
  		  `FB_LowLowAlarm:=EventLL_${tag},`,
  		  `FB_HighAlarm:=EventH_${tag},`,
  		  `FB_HighHighAlarm:=EventHH_${tag});`,
  		]);
  
  		programCreateExLinesAnalog.push(`EventL_${tag}.CreateEx(TC_Events.AlarmClass.EventL_${tag}, TRUE, ${subSystemExpr});`);
  		programCreateExLinesAnalog.push(`EventLL_${tag}.CreateEx(TC_Events.AlarmClass.EventLL_${tag}, TRUE, ${subSystemExpr});`);
  		programCreateExLinesAnalog.push(`EventH_${tag}.CreateEx(TC_Events.AlarmClass.EventH_${tag}, TRUE, ${subSystemExpr});`);
  		programCreateExLinesAnalog.push(`EventHH_${tag}.CreateEx(TC_Events.AlarmClass.EventHH_${tag}, TRUE, ${subSystemExpr});`);
  	  }
  	}
  
  	const resolveIds = (items, label) => {
  	  const hasAnyId = items.some(item => item.idRaw !== '');
  
  	  if (!hasAnyId) {
  		items.forEach((item, idx) => { item.id = idx + 1; });
  		return;
  	  }
  
  	  const used = new Set();
  
  	  for (const item of items) {
  		if (item.idRaw === '') {
  		  typeErrors.push(`Row ${item.excelRow}: missing ${label} for tag '${item.tag}'`);
  		  continue;
  		}
  
  		const parsed = parsePositiveInt(item.idRaw);
  		if (parsed === null) {
  		  typeErrors.push(`Row ${item.excelRow}: invalid ${label} '${item.idRaw}' for tag '${item.tag}'`);
  		  continue;
  		}
  
  		if (used.has(parsed)) {
  		  typeErrors.push(`Row ${item.excelRow}: duplicated ${label} '${parsed}' for tag '${item.tag}'`);
  		  continue;
  		}
  
  		item.id = parsed;
  		used.add(parsed);
  	  }
  	};
  
  	resolveIds(digitalAlarmItems, 'ID');
  	resolveIds(analogAlarmItems, 'IDA');
  
  	if (typeErrors.length) {
  	  this.alarmDigitalText         = '';
  	  this.alarmAnalogText          = '';
  	  this.alarmTagsText            = '';
  	  this.alarmsTwinCatDeclaration = '';
  	  this.alarmsTwinCatProgram     = '';
  	  this.tmcDigitalEventsText     = '';
  	  this.tmcAnalogEventsText      = '';
  	  this.maxID                    = null;
  	  this.maxIDA                   = null;
  	  this.debug = 'Error:\n' + typeErrors.join('\n');
  	  return;
  	}
  
  	digitalAlarmItems.sort((a, b) => a.id - b.id);
  	analogAlarmItems.sort((a, b) => a.id - b.id);
  
  	this.alarmDigitalText = digitalAlarmItems
  	  .map(item => item.lineTemplate.replace('__ID__', String(item.id)))
  	  .join('\n');
  
  	this.alarmAnalogText = analogAlarmItems
  	  .map(item => item.lineTemplate.replace('__ID__', String(item.id)))
  	  .join('\n');
  
  	maxID  = digitalAlarmItems.length ? Math.max(...digitalAlarmItems.map(item => item.id)) : null;
  	maxIDA = analogAlarmItems.length  ? Math.max(...analogAlarmItems.map(item => item.id))  : null;
  
  	this.maxID  = maxID;
  	this.maxIDA = maxIDA;
  
  	this.tmcDigitalEventsText = tmcDigitalEvents.join('\n');
  	this.tmcAnalogEventsText  = tmcAnalogEvents.join('\n');
  
	const digitalBlock =
	  `{region "Digital alarms"}\t// Digital alarms structure declaration from I/O list\n` +
	  `${this.alarmDigitalText || ''}\n` +
	  `{endregion}`;

	const analogBlock =
	  `{region "Analog alarms"}\t// Analog alarms structure declaration from I/O list\n` +
	  `${this.alarmAnalogText || ''}\n` +
	  `{endregion}`;

	this.alarmTagsText =
	`{attribute 'global_init_slot' := '40502'}
VAR_GLOBAL PERSISTENT
${digitalBlock}
${analogBlock}
END_VAR

VAR_GLOBAL CONSTANT
//Digital alarm array size
ArrMinD: INT := 1;
ArrMaxD: INT := ${maxID ?? '-'};
//Analog alarm array size
ArrMinA: INT := 1;
ArrMaxA: INT := ${maxIDA ?? '-'};
END_VAR

VAR_GLOBAL
//Array needs to be at least as big as the highest digital struct ID
Arr_AlarmDigital: ARRAY[ArrMinD..ArrMaxD] OF ST_ALARM_DI;
//Array needs to be at least as big as the highest analog struct ID
Arr_AlarmAnalog: ARRAY[ArrMinA..ArrMaxA] OF ST_ALARM_AI;
END_VAR`.trim() + '\n';
  
  	const allFbDecls = [
  	  ...this.alignDecls(fbDeclDigital),
  	  ...(fbDeclDigital.length && fbDeclAnalog.length ? [''] : []),
  	  ...this.alignDecls(fbDeclAnalog),
  	];
  
  	const allEvtDecls = [
  	  ...this.alignDecls(eventDeclDigital),
  	  ...(eventDeclDigital.length && eventDeclAnalog.length ? [''] : []),
  	  ...this.alignDecls(eventDeclAnalog),
  	];
  
  	const allOtherDecls = this.alignDecls([
  	  '\tfbEventlogger: FB_TcEventLogger;',
  	  '\tbSilence: BOOL;',
  	  '\tbTemp: BOOL;',
  	  '\ti: INT;',
  	  '\to_bBuzzerD: BOOL;',
  	  '\to_bBuzzerA: BOOL;',
  	  '\to_bAlarmLightD: BOOL;',
  	  '\to_bAlarmLightA: BOOL;',
  	  '\tbTempA: BOOL;',
  	  '\tfbSRLight: RS;',
  	  '\tfbTRIGLight: R_TRIG;',
  	  '\tbIsInitalized: BOOL;',
  	  '\tbConfirm: BOOL;',
  	  '\tbConfirmAll: BOOL;',
  	  '\tbAlarmSetupActive: BOOL;',
  	  '\tbClearAll: BOOL;',
  	  '\tbDigitalCounter: INT;',
  	  '\tbAnalogCounter: INT;',
  	]);
  
  	this.alarmsTwinCatDeclaration =
  `PROGRAM Alarms
  VAR
  {region "Alarms FB declarations"}	// Digital + analog
  ${allFbDecls.join('\n')}
  {endregion}\n
  {region "Events declaration"}		// Digital + analog
  ${allEvtDecls.join('\n')}
  {endregion}\n
  //Other tags
  ${allOtherDecls.join('\n')}
  END_VAR`.trim() + '\n';
  
  	const createExIndented = [
  	  programCreateExLinesDigital.join('\n'),
  	  programCreateExLinesAnalog.join('\n')
  	].filter(s => (s ?? '').trim().length).join('\n\n');
  
  	const programFbLinesOrdered = [
  	  this.alignFbCalls(programFbLinesDigital).join('\n'),
  	  this.alignFbCalls(programFbLinesAnalog).join('\n')
  	].filter(s => (s ?? '').trim().length).join('\n\n');
  
  	this.alarmsTwinCatProgram =
  `{attribute 'global_init_slot' := '40503'}
  IF NOT bIsInitalized THEN
  	bIsInitalized := TRUE;
  ${createExIndented}
  END_IF
  
  {region "Alarms"}	// Alarm functions
  ${programFbLinesOrdered}
  {endregion}
  
  IF bConfirmAll THEN
  	bConfirmAll := FALSE;
  	fbEventLogger.ConfirmAllAlarms(0);
  	fbSRLight(RESET1 := TRUE);
  ELSE
  	fbSRLight(RESET1 := FALSE);
  END_IF
  
  FOR i := ArrMinD TO ArrMaxD-1 BY 1 DO  // Buzzer activation for digital alarms
  	IF Arr_AlarmDigital[i].AlarmRaised THEN
  		o_bBuzzerD := 1;
  	END_IF
  	IF Arr_AlarmDigital[i].AlarmActive THEN
  		o_bAlarmLightD := 1;
  		bTemp :=1;
  	END_IF
  END_FOR
  
  FOR i := ArrMinA TO ArrMaxA-1 BY 1 DO	// Buzzer activation for analog alarms
  	IF Arr_AlarmAnalog[i].AlarmRaised THEN
  		o_bBuzzerA := 1;
  	END_IF
  END_FOR
  
  IF bSilence THEN	//silence of buzzers
  	bSilence := 0;
  	o_bBuzzerD := 0;
  	o_bBuzzerA := 0;
  END_IF
  
  IF ((o_bBuzzerD OR o_bBuzzerA) THEN		// Buzzer activation at ¿?
  	// Add buzzers here = 1;
  ELSE
  	// Add buzzers here = 0;
  END_IF
  
  IF (o_bBuzzerD OR o_bBuzzerA) THEN 		// Alarm light SET
  	fbTRIGLight(CLK:=TRUE);
  	fbSRLight(SET := fbTRIGLight.Q);
  ELSE
  	fbSRLight(SET := FALSE);
  	fbTRIGLight(CLK:=FALSE);
  END_IF
  
  bTemp :=0;
  bTempA :=0;
  
  //alarm light output
  IF fbSRLight.Q1 THEN
  	// Add light *_DO here = 1;
  ELSE
  	// Add light *_DO here = 0;
  END_IF`.trim() + '\n';
  
  	this.tmcText =
  	  this.tplTmcHeader('AlarmClass') +
  	  tmcDigitalEvents.join('\n') + '\n' +
  	  tmcAnalogEvents.join('\n')  + '\n' +
  	  this.tplTmcFooter;
  },
  // ════════════════════════════════════════════════════════
  // Sub-generador: IO_Test PRG y IO_Test.tmc
  // Itera las filas con tags *_DI y *_DO.
  //
  // Produce:
  // this.ioTestDeclaration → VAR del PROGRAM IO_Test
  // this.ioTestProgram → cuerpo del PROGRAM IO_Test
  // this.ioTestTmcText → fichero IO_Test.tmc
  //
  // Columnas Excel:
  // name, sub system
  // ════════════════════════════════════════════════════════
  _buildIOTestOutputs(dataRows, col, startDataIndex) {
	const idxNAME = col['name'];
	const idxSubSystem = col['sub system'];

	const fbDeclLines = [];
	const eventDeclLines = [];
	const programFbLines = [];
	const programCreateExLines = [];
	const tmcEvents = [];

	let riseId = 1;
	let fallId = 1001;

	// Helper local: bloque .tmc con el formato del Excel antiguo
	const tmcEvent = (id, eventName, displayName) => {
	return (`			<EventId>
				<Name Id="${id}">${eventName}</Name>
				<DisplayName TxtId=""><![CDATA[${displayName}]]></DisplayName>
				<Severity>Info</Severity>
			</EventId>`
		);
	};

	for (const [i, r] of dataRows.entries()) {
	const tag = this.toStrTrim(r[idxNAME]);
	if (!tag) continue;

	const isDigitalIO = tag.endsWith('_DI') || tag.endsWith('_DO');
	if (!isDigitalIO) continue;

	const subSystemRaw = (idxSubSystem !== undefined) ? this.toStrTrim(r[idxSubSystem]) : '';
	const subSystemExpr = subSystemRaw ? `SubSystem_${this.toIdentifier(subSystemRaw)}` : '0';

	const riseEvent = `${tag}_rise`;
	const fallEvent = `${tag}_fall`;

	// ── Declarations ─────────────────────────────────────────────
	fbDeclLines.push(`fb_${tag}: FB_IO_Test;`);
	eventDeclLines.push(`${riseEvent}: TcEventEntry;`);
	eventDeclLines.push(`${fallEvent}: TcEventEntry;`);

	// ── Program (CreateEx + llamada FB) ─────────────────────────
	//programCreateExLines.push(
	//`${riseEvent}.CreateEx(TC_Events.InputEvent.${riseEvent}, TRUE, ${subSystemExpr});`
	//);
	//programCreateExLines.push(
	//`${fallEvent}.CreateEx(TC_Events.InputEvent.${fallEvent}, TRUE, ${subSystemExpr});`
	//);

	programFbLines.push([
	`fb_${tag}`,
	`(bSignal := ${tag},`,
	`bEnable := bEnable, Subsystem := ${subSystemExpr},`,
	`stEventEntryOn := ${riseEvent},`,
	`stEventEntryOff := ${fallEvent});`,
	]);

	// ── .tmc ───────────────────────────────────────────────────
	tmcEvents.push(
	tmcEvent(
	riseId,
	riseEvent,
	`${tag} - Input activated`
	)
	);

	tmcEvents.push(
	tmcEvent(
	fallId,
	fallEvent,
	`${tag} - Input deactivated`
	)
	);

	riseId++;
	fallId++;
	}

	// ── Declarations ────────────────────────────────────────────
	const allFbDecls = this.alignDecls(fbDeclLines);
	const allEvtDecls = this.alignDecls(eventDeclLines);
	const allOtherDecls = this.alignDecls([
	'\tbEnable: BOOL := TRUE;',
	'\tbIsInitalized: BOOL;',
	]);

	this.ioTestDeclaration =
	`PROGRAM IO_Test
	VAR
	{region "IO_Test FB declarations"} // Digital inputs / outputs
	${allFbDecls.join('\n')}
	{endregion}\n
	{region "Events declaration"} // Rise + fall
	${allEvtDecls.join('\n')}
	{endregion}\n
	//Other tags
	${allOtherDecls.join('\n')}
	END_VAR`.trim() + '\n';

	// ── Program ─────────────────────────────────────────────────
	const createExIndented = programCreateExLines.join('\n');
	const programFbLinesOrdered = this.alignFbCalls(programFbLines).join('\n');

	this.ioTestProgram =
	`IF NOT bIsInitalized THEN
	bIsInitalized := TRUE;
	${createExIndented}
	END_IF

	{region "IO_Test"} // IO test functions
	${programFbLinesOrdered}
	{endregion}`.trim() + '\n';

	// ── .tmc file ───────────────────────────────────────────────
	this.ioTestTmcText =
	this.tplTmcHeader('InputEvent') +
	tmcEvents.join('\n') + '\n' +
	this.tplTmcFooter;
	},
};
