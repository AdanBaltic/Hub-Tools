const { createApp } = Vue;

window._MODBUS_VUE_APP = createApp({
  data() {
    return {
      isDarkMode: window._MODBUS_INITIAL_DARK ?? false,
      activeTab: 'configuration',

      // Excel settings
      preferredSheetName: "IO-list",
      usedSheetName: "",
      headerRowNumber: 10,

      // Modbus addressing + packing rules
      modbusIndexBase: 1,
      maxRegsPerRead: 125,
      maxGapRegs: 5,
      maxWastePct: 25,

      // Excel raw data
      rows: [],
      points: [],

      // Manual / generated config
      devices: [
        {
          id: crypto.randomUUID(),
          name: "Device",
          ip: "",
          slaveId: "",
          dataType: "MW",
          readings: [
            { id: crypto.randomUUID(), address: "", length: "" }
          ]
        }
      ],

      stDecl: "",
      stProg: "",
      stVarMap: "",

      // Roots
      showRoots: false,

      debug: ""
    };
  },

  computed: {
    rootsCount() {
      const roots = this.points.map(p => p.root).filter(Boolean);
      return new Set(roots).size;
    },
    rootsList() {
      const roots = this.points.map(p => p.root).filter(Boolean);
      return Array.from(new Set(roots)).sort();
    },
    totalReadings() {
      return (this.devices || []).reduce((acc, d) => acc + (d.readings?.length || 0), 0);
    },
    excelLoaded() {
      return Array.isArray(this.rows) && this.rows.length > 0;
    },

    stDeclHtml()   { return this.highlightPLC(this.stDecl); },
    stProgHtml()   { return this.highlightPLC(this.stProg); },
    stVarMapHtml() { return this.highlightPLC(this.stVarMap); },

    deviceErrors() {
      const nameMap = new Map();
      this.devices.forEach((dev) => {
        const key = String(dev.name ?? '').trim().toLowerCase();
        if (key) nameMap.set(key, (nameMap.get(key) || 0) + 1);
      });

      return this.devices.map((dev) => {
        const nameKey = String(dev.name ?? '').trim().toLowerCase();
        const slave   = this.toIntStrict(dev.slaveId);

        return {
          name:    !String(dev.name ?? '').trim() || (nameKey && (nameMap.get(nameKey) || 0) > 1),
          ip:      !String(dev.ip ?? '').trim(),
          slaveId: slave === null || slave < 0 || slave > 255,
          readings: (dev.readings || []).map(rd => {
            const adr = this.toIntStrict(rd.address);
            const len = this.toIntStrict(rd.length);
            return {
              address: adr === null || adr < 0 || adr > 65535,
              length:  len === null || len < 1  || len > 65535,
            };
          }),
        };
      });
    },
  },

  methods: {
    toIdentifier(s) {
      const raw = String(s ?? "").trim();
      if (!raw) return "";
      const cleaned = raw
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9_]/g, "_")
        .replace(/_+/g, "_");
      const startsOk = /^[A-Za-z_]/.test(cleaned) ? cleaned : ("_" + cleaned);
      return startsOk;
    },

    autoDevId(deviceName, dIdxFallback) {
      const id = this.toIdentifier(deviceName);
      return id || ("Device" + (dIdxFallback + 1));
    },

    autoReadFbName(deviceName, dIdxFallback) {
      const devId = this.autoDevId(deviceName, dIdxFallback);
      return `Read_${devId}`;
    },
    autoAdrArrayName(deviceName, dIdxFallback) {
      const devId = this.autoDevId(deviceName, dIdxFallback);
      return `Modbus${devId}_adr`;
    },
    autoDataName(deviceName, dIdxFallback) {
      const devId = this.autoDevId(deviceName, dIdxFallback);
      return `${devId}_Data`;
    },
    autoNReadName(deviceName, dIdxFallback) {
      const devId = this.autoDevId(deviceName, dIdxFallback);
      return `nRead${devId}`;
    },
    autoSizeRegName(deviceName, dIdxFallback) {
      const devId = this.autoDevId(deviceName, dIdxFallback);
      return `sizeReg${devId}`;
    },

    onExcelSettingChange() {
      if (this.excelLoaded) this.rebuildFromRows();
      else this.generate();
    },

    uniqueDeviceName(base, excludeIdx) {
      const existing = new Set(
        this.devices
          .filter((_, i) => i !== excludeIdx)
          .map(d => String(d.name ?? '').trim().toLowerCase())
      );
      if (!existing.has(base.toLowerCase())) return base;
      for (let n = 0; ; n++) {
        const candidate = `${base}_${n}`;
        if (!existing.has(candidate.toLowerCase())) return candidate;
      }
    },

    addDevice() {
      const base = "Device" + (this.devices.length + 1);
      this.devices.push({
        id: crypto.randomUUID(),
        name: this.uniqueDeviceName(base, null),
        ip: "",
        slaveId: "",
        dataType: "MW",
        readings: [{ id: crypto.randomUUID(), address: "", length: "" }]
      });
      this.debug = "Device added.";
      this.generate();
    },

    removeDevice(dIdx) {
      if (this.devices.length <= 1) return;
      this.devices.splice(dIdx, 1);
      this.debug = "Device removed.";
      this.generate();
    },

    addReading(dIdx) {
      this.devices[dIdx].readings.push({ id: crypto.randomUUID(), address: "", length: "" });
      this.debug = "Reading added.";
      this.generate();
    },

    removeReading(dIdx, rIdx) {
      const dev = this.devices[dIdx];
      if (rIdx === 0) return;
      dev.readings.splice(rIdx, 1);
      this.debug = "Reading removed.";
      this.generate();
    },

    resetAll() {
      this.devices = [
        {
          id: crypto.randomUUID(),
          name: "Device",
          ip: "",
          slaveId: "",
          dataType: "MW",
          readings: [{ id: crypto.randomUUID(), address: "", length: "" }]
        }
      ];
      this.stDecl = "";
      this.stProg = "";
      this.debug = "Reset done.";
      this.generate();
    },

    toIntStrict(val) {
      const s = String(val ?? "").trim();
      if (s === "") return null;
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      return Math.trunc(n);
    },

    parseModbusCell(cell) {
		const raw = String(cell ?? "").trim();
		if (!raw) return null;

		const m = raw.match(/^(\d{5,6})(?:[.,](\d+))?$/);
		if (!m) return null;

		const logicalAddress = m[1];
		const bitText = m[2] ?? null;
		const areaPrefix = logicalAddress[0];
		const digitsMode = logicalAddress.length;
		const pointDigits = logicalAddress.slice(1);

		let area = null;
		let objectKind = null;
		let dataType = null;

		if (areaPrefix === "0") {
		area = "coil";
		objectKind = "bit";
		dataType = "MX";
		} else if (areaPrefix === "1") {
		area = "discreteInput";
		objectKind = "bit";
		dataType = "IX";
		} else if (areaPrefix === "3") {
		area = "inputRegister";
		objectKind = "word";
		dataType = "IW";
		} else if (areaPrefix === "4") {
		area = "holdingRegister";
		objectKind = "word";
		dataType = "MW";
		} else {
		return null;
		}

		if (!/^\d+$/.test(pointDigits)) return null;
		const visibleIndex = Number(pointDigits);
		if (!Number.isInteger(visibleIndex)) return null;

		let minVisibleIndex;
		let maxVisibleIndex;

		if (digitsMode === 5) {
		minVisibleIndex = this.modbusIndexBase;
		maxVisibleIndex = this.modbusIndexBase === 0 ? 9999 : 9999;
		} else if (digitsMode === 6) {
		minVisibleIndex = this.modbusIndexBase;
		maxVisibleIndex = this.modbusIndexBase === 0 ? 65535 : 65536;
		} else {
		return null;
		}

		if (visibleIndex < minVisibleIndex || visibleIndex > maxVisibleIndex) {
		return null;
		}

		let bit = null;
		if (bitText !== null) {
		bit = Number(bitText);
		if (!Number.isInteger(bit) || bit < 0 || bit > 15) return null;
		}

		if (objectKind === "bit" && bit !== null) {
		return null;
		}

		const offset = visibleIndex - this.modbusIndexBase;
		if (!Number.isInteger(offset) || offset < 0 || offset > 65535) return null;

		return {
		raw,
		logicalAddress,
		digitsMode,
		area,
		objectKind,
		dataType,
		offset,
		bit,
		isBitFromRegister: objectKind === "word" && bit !== null,
		isNativeBitObject: objectKind === "bit",
		isBool: objectKind === "bit" || bit !== null
		};
    },

	parseModbusSpec(cell) {
		const raw = String(cell ?? "").trim();
		if (!raw) return null;

		if (!raw.includes(":")) {
		const mb = this.parseModbusCell(raw);
		if (!mb) return null;

		return {
		raw,
		kind: "single",
		area: mb.area,
		objectKind: mb.objectKind,
		dataType: mb.dataType,
		start: mb.offset,
		end: mb.offset,
		bit: mb.bit,
		isBitFromRegister: mb.isBitFromRegister,
		isNativeBitObject: mb.isNativeBitObject,
		isBool: mb.isBool,
		digitsMode: mb.digitsMode,
		logicalAddress: mb.logicalAddress
		};
		}

		const parts = raw.split(":").map(x => String(x ?? "").trim()).filter(Boolean);
		if (parts.length !== 2) return null;

		const a = this.parseModbusCell(parts[0]);
		const b = this.parseModbusCell(parts[1]);
		if (!a || !b) return null;

		if (a.area !== b.area) return null;
		if (a.objectKind !== "word" || b.objectKind !== "word") return null;
		if (a.bit != null || b.bit != null) return null;
		if (b.offset < a.offset) return null;

		return {
		raw,
		kind: "range",
		area: a.area,
		objectKind: "word",
		dataType: a.dataType,
		start: a.offset,
		end: b.offset,
		bit: null,
		isBitFromRegister: false,
		isNativeBitObject: false,
		isBool: false,
		digitsMode: a.digitsMode,
		logicalAddress: `${a.logicalAddress}:${b.logicalAddress}`
		};
	},

    buildVariableMappingProgram() {
		const lines = [];
		lines.push("// PROGRAM VariableMapping");
		lines.push("// Auto-generated mapping from Modbus buffers to GVL tags");
		lines.push("");

		const findReading = (dev, area, startOffset, spanLen = 1) => {
		for (let i = 0; i < (dev.readings?.length || 0); i++) {
		const rd = dev.readings[i];
		if (String(rd.area || "") !== String(area || "")) continue;

		const start = this.toIntStrict(rd.address);
		const len = this.toIntStrict(rd.length);
		if (start === null || len === null) continue;

		const end = start + len - 1;
		const needEnd = startOffset + spanLen - 1;

		if (startOffset >= start && needEnd <= end) {
		const pos = (startOffset - start) + 1;
		return { readingIdx: i + 1, pos };
		}
		}
		return null;
		};

		const wordExpr = (dev, readingIdx, pos) => {
		const dataName = this.autoDataName(dev.name, 0);
		return `Modbus.${dataName}[${readingIdx}][${pos}]`;
		};

		const bitAccessExpr = (dev, readingIdx, pos, bit) => {
		const dataName = this.autoDataName(dev.name, 0);
		return `Modbus.${dataName}[${readingIdx}][${pos}].${bit}`;
		};

		const udint32Expr = (hiWord, loWord) =>
		`SHL(TO_UDINT(${hiWord}), 16) OR TO_UDINT(${loWord})`;

		for (const dev of (this.devices || [])) {
		const pts = dev.points || [];
		if (!pts.length) continue;

		lines.push(`// Device ${this.autoDevId(dev.name, 0)}`);
		lines.push("");

		const sorted = [...pts].sort((a, b) =>
		String(a.area).localeCompare(String(b.area)) ||
		(a.start - b.start) ||
		((a.bit ?? -1) - (b.bit ?? -1)) ||
		String(a.name).localeCompare(String(b.name))
		);

		for (const p of sorted) {
		const tag = this.toIdentifier(p.name);
		if (!tag) continue;

		const t = String(p.type || "").toUpperCase();
		const words = p.words || 1;
		const area = p.area || "holdingRegister";
		const spanLen = (area === "coil" || area === "discreteInput") ? 1 : words;

		const hit = findReading(dev, area, p.start, spanLen);
		if (!hit) {
		lines.push(`// WARN: ${tag} at ${p.regRaw || p.start} (${area}) not covered by any reading`);
		continue;
		}

		const w0 = wordExpr(dev, hit.readingIdx, hit.pos);
		const isNativeBitObject = area === "coil" || area === "discreteInput";
		const isBool = !!p.isBool || t.includes("DIGITAL") || t === "BOOL";

		if (isNativeBitObject) {
		lines.push(`${tag} := ${w0};`);
		continue;
		}

		if (isBool && p.bit != null) {
		lines.push(`${tag} := ${bitAccessExpr(dev, hit.readingIdx, hit.pos, p.bit)};`);
		continue;
		}

		if (isBool) {
		lines.push(`${tag} := ${w0} <> WORD#0;`);
		continue;
		}

		if (words === 2) {
		const w1 = wordExpr(dev, hit.readingIdx, hit.pos + 1);
		const u32 = udint32Expr(w0, w1);

		if (t === "DUINT" || t === "UDINT") lines.push(`${tag} := ${u32};`);
		else if (t === "DINT") lines.push(`${tag} := TO_DINT(${u32});`);
		else if (t === "DWORD") lines.push(`${tag} := TO_DWORD(${u32});`);
		else if (t === "REAL") lines.push(`${tag} := TO_REAL(${u32});`);
		else lines.push(`// WARN: ${tag} TYPE=${t} uses 2 regs but no rule, raw=${u32}`);

		continue;
		}

		if (t === "WORD") lines.push(`${tag} := ${w0};`);
		else if (t === "BYTE") lines.push(`${tag} := TO_BYTE(${w0});`);
		else if (t === "INT") lines.push(`${tag} := TO_INT(${w0});`);
		else if (t === "UINT") lines.push(`${tag} := TO_UINT(${w0});`);
		else if (t === "SINT") lines.push(`${tag} := TO_SINT(${w0});`);
		else if (t === "USINT") lines.push(`${tag} := TO_USINT(${w0});`);
		else if (t === "REAL") lines.push(`${tag} := TO_REAL(${w0});`);
		else lines.push(`// WARN: ${tag} unsupported TYPE=${t}, raw=${w0}`);
		}

		lines.push("");
		}

		return lines.join("\n").trimEnd();
    },

    validate() {
      const errors = [];
      const warnings = [];
      const usedNames = new Set();
      let totalReadings = 0;

      const checkUnique = (name, ctx) => {
        const key = String(name).toLowerCase();
        if (usedNames.has(key)) errors.push(`Duplicate identifier: ${name} (${ctx}).`);
        usedNames.add(key);
      };

      this.devices.forEach((dev, dIdx) => {
        totalReadings += (dev.readings?.length ?? 0);

        const devName = String(dev.name ?? "").trim();
        if (!devName) errors.push(`Device #${dIdx + 1}: Device name is required.`);
        if (!String(dev.ip ?? "").trim()) errors.push(`Device #${dIdx + 1}: IP address is required.`);

        const slave = this.toIntStrict(dev.slaveId);
        if (slave === null) errors.push(`Device #${dIdx + 1}: Slave ID is required.`);
        else if (slave < 0 || slave > 255) errors.push(`Device #${dIdx + 1}: Slave ID must be 0..255.`);

        if (!String(dev.dataType ?? "").trim()) errors.push(`Device #${dIdx + 1}: Data type is required.`);

        checkUnique(this.autoReadFbName(dev.name, dIdx), `Device #${dIdx + 1}`);
        checkUnique(this.autoAdrArrayName(dev.name, dIdx), `Device #${dIdx + 1}`);
        checkUnique(this.autoDataName(dev.name, dIdx), `Device #${dIdx + 1}`);
        checkUnique(this.autoNReadName(dev.name, dIdx), `Device #${dIdx + 1}`);
        checkUnique(this.autoSizeRegName(dev.name, dIdx), `Device #${dIdx + 1}`);

        dev.readings.forEach((rd, rIdx) => {
          const adr = this.toIntStrict(rd.address);
          const len = this.toIntStrict(rd.length);

          if (adr === null) errors.push(`Device #${dIdx + 1} Reading #${rIdx + 1}: Address is required.`);
          else if (adr < 0 || adr > 65535) errors.push(`Device #${dIdx + 1} Reading #${rIdx + 1}: Address must be 0..65535.`);

          if (len === null) errors.push(`Device #${dIdx + 1} Reading #${rIdx + 1}: Length is required.`);
          else if (len < 1 || len > 65535) errors.push(`Device #${dIdx + 1} Reading #${rIdx + 1}: Length must be 1..65535.`);
        });

        const id = this.toIdentifier(devName);
        if (!id) warnings.push(`Device #${dIdx + 1}: Device name becomes an empty identifier after sanitizing.`);
      });

      if (this.devices.length === 0) errors.push("At least one device is required.");
      if (totalReadings === 0) errors.push("At least one reading is required.");

      return { errors, warnings, totalReadings };
    },

    generate() {
      const { errors, warnings, totalReadings } = this.validate();

      const dbg = [];
      dbg.push(`Devices: ${this.devices.length}`);
      dbg.push(`Total readings: ${totalReadings}`);
      dbg.push(`Excel sheet: ${this.usedSheetName || "-"}`);
      dbg.push(`Excel points parsed: ${this.points.length}`);
      if (warnings.length) dbg.push(`Warnings:\n- ${warnings.join("\n- ")}`);

      if (errors.length) {
        dbg.push(`Errors:\n- ${errors.join("\n- ")}`);
        this.debug = dbg.join("\n");
        this.stDecl = "";
        this.stProg = "";
        return;
      }

      const decl = [];
      const prog = [];

      decl.push("PROGRAM Modbus");
      decl.push("");
      decl.push("VAR CONSTANT");
      this.devices.forEach((dev, dIdx) => {
        const devId = this.autoDevId(dev.name, dIdx);

        const nRead = dev.readings.length;
        const sizes = dev.readings.map(r => this.toIntStrict(r.length));
        const sizeReg = sizes.reduce((acc, x) => acc + (x ?? 0), 0);

        const nReadName = this.autoNReadName(dev.name, dIdx);
        const sizeRegName = this.autoSizeRegName(dev.name, dIdx);

        decl.push(`\t// DATA ${dIdx + 1} - ${devId} unit`);
        decl.push(`\t${nReadName} : INT := ${nRead};`);
        decl.push(`\t${sizeRegName} : INT := ${sizeReg};`);
        decl.push("");
      });
      decl.push("END_VAR");
      decl.push("");

      decl.push("VAR");
      decl.push("\texecute_read : BOOL;");
      decl.push("");

      this.devices.forEach((dev, dIdx) => {
        const devId = this.autoDevId(dev.name, dIdx);
        const ip = String(dev.ip ?? "").trim();
        const slaveId = this.toIntStrict(dev.slaveId);
        const dt = String(dev.dataType ?? "").trim();

        const nRead = dev.readings.length;
        const sizes = dev.readings.map(r => this.toIntStrict(r.length));
        const sizeReg = sizes.reduce((acc, x) => acc + (x ?? 0), 0);

        const fbName = this.autoReadFbName(dev.name, dIdx);
        const adrName = this.autoAdrArrayName(dev.name, dIdx);
        const dataName = this.autoDataName(dev.name, dIdx);
        const nReadName = this.autoNReadName(dev.name, dIdx);
        const sizeRegName = this.autoSizeRegName(dev.name, dIdx);

        decl.push(`\t// DATA ${dIdx + 1} - ${devId} unit`);
        decl.push(`\t${fbName} : FB_Modbus_ReadDevice;`);
        decl.push(`\t${adrName} : ARRAY [1..${nReadName}] OF ST_ModbusRead := [`);

        dev.readings.forEach((r, rIdx) => {
          const adr = this.toIntStrict(r.address);
          const len = this.toIntStrict(r.length);
          const comma = (rIdx < dev.readings.length - 1) ? "," : "";
          decl.push(`\t\t(Length := ${len}, Address := ${adr})${comma} //`);
        });

        decl.push("\t];");
        decl.push(`\t${dataName} : ARRAY [1..${sizeRegName}] OF WORD;`);
        decl.push("");

        prog.push(`// Read ${devId}`);
        prog.push(`${fbName}(`);
        prog.push(`\tIPaddr    := '${ip}',`);
        prog.push(`\tslaveID   := ${slaveId},`);
        prog.push(`\tdataType  := ENUM_ModbusDataType.${dt},`);
        prog.push(`\taddresses := ${adrName},`);
        prog.push(`\tdata      := ${dataName},`);
        prog.push(`\texecute   := execute_read`);
        prog.push(").");
        prog.push("");
      });

      decl.push("END_VAR");

      this.stDecl = decl.join("\n").trimEnd();
      this.stProg = prog.join("\n").trimEnd();
      this.stVarMap = this.buildVariableMappingProgram();
      dbg.push("Generation OK.");
	  dbg.push(`Modbus index base: ${this.modbusIndexBase}`);
      this.debug = dbg.join("\n");
    },

    async copyText(text, label) {
      const value = (text ?? "").toString();
      if (!value.trim()) {
        this.debug = `Nothing to copy (${label ?? "output"}).`;
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
          this.debug = `Copied (${label ?? "output"}).`;
          return;
        }
      } catch (err) {}

      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        document.execCommand("copy");
        document.body.removeChild(ta);
        this.debug = `Copied (${label ?? "output"}) using fallback.`;
      } catch (err) {
        this.debug = `Copy failed (${label ?? "output"}): ${err?.message ? err.message : String(err)}`;
      }
    },

    toStrTrim(v) {
      return (v === null || v === undefined) ? "" : String(v).trim();
    },
    normalizeHeader(s) {
      return this.toStrTrim(s).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
    },
    pickSheetHeaderRowIndex() {
      const fixedIdx = Math.max(0, this.headerRowNumber - 1);
      const fixedRow = this.rows[fixedIdx] || [];
      const fixedNorm = fixedRow.map(this.normalizeHeader);
      if (fixedNorm.includes("name")) return fixedIdx;

      const maxScan = Math.min(this.rows.length, 50);
      for (let i = 0; i < maxScan; i++) {
        const r = this.rows[i] || [];
        const n = r.map(this.normalizeHeader);
        if (n.includes("name") && n.includes("type")) return i;
        if (n.includes("name")) return i;
      }
      return -1;
    },
    rootFromName(name) {
      const s = this.toStrTrim(name);
      if (!s) return "";
      const idx = s.indexOf("_");
      return idx === -1 ? s : s.slice(0, idx);
    },
	secondWordFromName(name) {
	const s = this.toStrTrim(name);
	if (!s) return "";
	const parts = s.split("_").map(x => x.trim()).filter(Boolean);
	return parts.length >= 2 ? parts[1] : "";
	},
	deviceBaseNameFromTag(name) {
	const s = this.toStrTrim(name);
	if (!s) return "";

	const parts = s.split("_").map(x => x.trim()).filter(Boolean);
	if (parts.length === 0) return "";
	if (parts.length === 1) return parts[0];

	return `${parts[0]}_${parts[1]}`;
	},
	wordsForType(typeRaw, modbusKind = "single") {
	const t = this.toStrTrim(typeRaw).toUpperCase();
	if (!t) return null;

	if (t.includes("DIGITAL") || t === "BOOL") return 1;

	if (t === "BYTE" || t === "WORD" || t === "INT" || t === "UINT" || t === "SINT" || t === "USINT") {
	return 1;
	}

	if (t === "DINT" || t === "DUINT" || t === "DWORD") {
	return modbusKind === "range" ? 2 : 1;
	}

	if (t === "REAL") {
	return modbusKind === "range" ? 2 : 1;
	}

	return null;
	},

    parseRegToOffset(regCell) {
		const mb = this.parseModbusCell(regCell);
		return mb ? mb.offset : null;
	},

    buildPointsFromRows() {
		const headerRowIndex = this.pickSheetHeaderRowIndex();
		if (headerRowIndex === -1) {
		this.points = [];
		this.debug = `Header row not found (expected row ${this.headerRowNumber} or a row containing NAME/TYPE).`;
		return false;
		}

		const headerRaw = this.rows[headerRowIndex] || [];
		const headerNorm = headerRaw.map(this.normalizeHeader);

		const col = {};
		headerNorm.forEach((h, i) => { if (h) col[h] = i; });

		const idxLocation = col["location"];
		const idxNAME = col["name"];
		const idxTYPE = col["type"];
		const idxModbusReg =
		col["modbus declaration"] ??
		col["modbus"] ??
		col["modbus reg"] ??
		col["modbus address"] ??
		col["modbus register"];

		if (idxNAME === undefined || idxTYPE === undefined || idxModbusReg === undefined || idxLocation === undefined) {
		this.points = [];
		this.debug = `Missing columns. Need LOCATION, NAME, TYPE, and (Modbus declaration|Modbus|Modbus reg|Modbus register|Modbus address). Header row used: ${headerRowIndex + 1}`;
		return false;
		}

		const dataRows = this.rows.slice(headerRowIndex + 1);
		const pts = [];
		const typeErrors = [];
		const parseErrors = [];

		for (let i = 0; i < dataRows.length; i++) {
		const r = dataRows[i] || [];

		const name = this.toStrTrim(r[idxNAME]);
		if (!name) continue;

		const locationRaw = this.toStrTrim(r[idxLocation]);
		const loc = locationRaw.toLowerCase().replace(/\s+/g, "");
		if (!loc.includes("modbustcp")) continue;

		const type = this.toStrTrim(r[idxTYPE]).toUpperCase();
		const mb = this.parseModbusSpec(r[idxModbusReg]);

		if (!mb) {
		parseErrors.push(`Row ${headerRowIndex + 2 + i}: invalid Modbus address "${this.toStrTrim(r[idxModbusReg])}" for tag ${name}`);
		continue;
		}

		let words = this.wordsForType(type, mb.kind);

		if (mb.isNativeBitObject || mb.isBitFromRegister) {
		if (type !== "BOOL" && !type.includes("DIGITAL")) {
		typeErrors.push(`Row ${headerRowIndex + 2 + i}: ${name} uses ${mb.raw} and should be BOOL/DIGITAL, not ${type}`);
		continue;
		}
		words = 1;
		} else {
		if (!words) {
		typeErrors.push(`Row ${headerRowIndex + 2 + i}: unsupported TYPE "${type}" for tag ${name}`);
		continue;
		}
		}

		const start = mb.start;
		let end = mb.end;

		if (mb.kind === "single" && mb.objectKind === "word") {
		end = start + (words - 1);
		}

		if (mb.kind === "range") {
		const declaredWords = (mb.end - mb.start + 1);
		if (declaredWords !== words) {
		typeErrors.push(`Row ${headerRowIndex + 2 + i}: ${name} uses ${mb.raw} (${declaredWords} regs) but TYPE ${type} expects ${words}.`);
		continue;
		}
		}

		pts.push({
		name,
		type,
		start,
		end,
		bit: mb.bit,
		regRaw: mb.raw,
		words,
		root: this.rootFromName(name),
		deviceBaseName: this.deviceBaseNameFromTag(name),
		area: mb.area,
		objectKind: mb.objectKind,
		dataType: mb.dataType,
		digitsMode: mb.digitsMode,
		logicalAddress: mb.logicalAddress,
		isBool: mb.isBool,
		isBitFromRegister: mb.isBitFromRegister,
		isNativeBitObject: mb.isNativeBitObject
		});
		}

		this.points = pts;

		const debugParts = [];
		debugParts.push(`Parsed points: ${pts.length}`);
		if (parseErrors.length) debugParts.push(`Address issues:\n- ${parseErrors.slice(0, 30).join("\n- ")}${parseErrors.length > 30 ? "\n- ..." : ""}`);
		if (typeErrors.length) debugParts.push(`TYPE issues:\n- ${typeErrors.slice(0, 30).join("\n- ")}${typeErrors.length > 30 ? "\n- ..." : ""}`);
		if (debugParts.length > 1) this.debug = debugParts.join("\n");
		return true;

    },

    buildReadingsForDevice(points) {
		const grouped = new Map();

		for (const p of points) {
		const key = p.area || "holdingRegister";
		if (!grouped.has(key)) grouped.set(key, []);
		grouped.get(key).push(p);
		}

		const readings = [];

		const flushGrouped = (items, area) => {
		const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);

		let cur = null;

		const flush = () => {
		if (!cur) return;
		const len = (cur.end - cur.start + 1);
		readings.push({
		id: crypto.randomUUID(),
		address: String(cur.start),
		length: String(len),
		area
		});
		cur = null;
		};

		for (const it of sorted) {
		const spanEnd = Math.max(it.start, it.end);
		const itLen = spanEnd - it.start + 1;

		if (!cur) {
		cur = { start: it.start, end: spanEnd, usedLen: itLen };
		continue;
		}

		const gap = it.start - (cur.end + 1);
		const newStart = cur.start;
		const newEnd = spanEnd;
		const newSpanLen = newEnd - newStart + 1;
		const newUsedLen = cur.usedLen + itLen;
		const waste = newSpanLen - newUsedLen;
		const wastePct = newSpanLen > 0 ? (waste / newSpanLen) * 100 : 0;

		const exceedMaxRegs = newSpanLen > this.maxRegsPerRead;
		const exceedGap = gap > this.maxGapRegs;
		const exceedWaste = wastePct > this.maxWastePct;

		if (exceedMaxRegs || exceedGap || exceedWaste) {
		flush();
		cur = { start: it.start, end: spanEnd, usedLen: itLen };
		} else {
		cur.end = spanEnd;
		cur.usedLen = newUsedLen;
		}
		}

		flush();
		};

		for (const [area, items] of grouped.entries()) {
		flushGrouped(items, area);
		}

		return readings.sort((a, b) =>
		String(a.area).localeCompare(String(b.area)) ||
		(Number(a.address) - Number(b.address))
		);
    },

    buildDevicesFromPoints(previousByKey = new Map()) {
		const byRoot = new Map();

		for (const p of this.points) {
		const key = p.root || "";
		if (!key) continue;
		if (!byRoot.has(key)) byRoot.set(key, []);
		byRoot.get(key).push(p);
		}

		const newDevices = [];

		for (const [root, items] of byRoot.entries()) {
		items.sort((a, b) =>
		String(a.area).localeCompare(String(b.area)) ||
		(a.start - b.start) ||
		(a.end - b.end) ||
		((a.bit ?? -1) - (b.bit ?? -1)) ||
		a.name.localeCompare(b.name)
		);

		const rootDevices = [];

		const pointCollides = (dev, it) => {
		const isBitPoint = !!it.isBitFromRegister && it.bit != null && it.start === it.end;

		if (isBitPoint) {
		const reg = it.start;

		if (dev.usedRegs.has(reg)) return true;

		const usedBits = dev.usedBitsByReg.get(reg);
		if (!usedBits) return false;

		return usedBits.has(it.bit);
		}

		for (let r = it.start; r <= it.end; r++) {
		if (dev.usedRegs.has(r)) return true;

		const usedBits = dev.usedBitsByReg.get(r);
		if (usedBits && usedBits.size > 0) return true;
		}

		return false;
		};

		const addPointUsage = (dev, it) => {
		const isBitPoint = !!it.isBitFromRegister && it.bit != null && it.start === it.end;

		if (isBitPoint) {
		if (!dev.usedBitsByReg.has(it.start)) {
		dev.usedBitsByReg.set(it.start, new Set());
		}
		dev.usedBitsByReg.get(it.start).add(it.bit);
		return;
		}

		for (let r = it.start; r <= it.end; r++) {
		dev.usedRegs.add(r);
		}
		};

		for (const it of items) {
		let placed = false;

		for (const dev of rootDevices) {
		if (dev.area !== it.area) continue;

		if (!pointCollides(dev, it)) {
		addPointUsage(dev, it);
		dev.points.push(it);
		placed = true;
		break;
		}
		}

		if (!placed) {
		const dev = {
		area: it.area,
		dataType: it.dataType,
		usedRegs: new Set(),
		usedBitsByReg: new Map(),
		points: [it]
		};

		addPointUsage(dev, it);
		rootDevices.push(dev);
		}
		}

		const areaDataTypeMap = {
		coil: "MX",
		discreteInput: "IX",
		inputRegister: "IW",
		holdingRegister: "MW"
		};

		const getSecondWordForDevice = (dev) => {
		const counts = new Map();

		for (const p of (dev.points || [])) {
		const second = this.secondWordFromName(p.name);
		if (!second) continue;

		const key = second.toLowerCase();
		counts.set(key, {
		value: second,
		count: (counts.get(key)?.count || 0) + 1
		});
		}

		let best = "";
		let bestCount = -1;

		for (const item of counts.values()) {
		if (item.count > bestCount) {
		best = item.value;
		bestCount = item.count;
		}
		}

		return best;
		};

		const rootDeviceCount = rootDevices.length;

		rootDevices.forEach((d) => {
		const secondWord = getSecondWordForDevice(d);

		const baseLogicalName =
		(rootDeviceCount > 1 && secondWord)
		? `${root}_${secondWord}`
		: root;

		const sameBaseDifferentAreas = rootDevices.filter((x) => {
		const xSecond = getSecondWordForDevice(x);
		const xBase = (rootDeviceCount > 1 && xSecond) ? `${root}_${xSecond}` : root;
		return xBase.toLowerCase() === baseLogicalName.toLowerCase() && String(x.area || "") !== String(d.area || "");
		}).length > 0;

		const finalDeviceName = sameBaseDifferentAreas
		? `${baseLogicalName}_${areaDataTypeMap[d.area] || d.dataType || d.area || ""}`
		: baseLogicalName;

		const prevKey = `${finalDeviceName.trim().toLowerCase()}|${String(d.area || "").trim()}`;
		const prev = previousByKey.get(prevKey) || null;

		newDevices.push({
		id: prev?.id ?? crypto.randomUUID(),
		name: prev?.name ?? finalDeviceName,
		ip: prev?.ip ?? "",
		slaveId: prev?.slaveId ?? "",
		dataType: prev?.dataType ?? d.dataType ?? "MW",
		modbusArea: d.area,
		readings: this.buildReadingsForDevice(d.points),
		points: d.points
		});
		});
		}

		newDevices.sort((a, b) => a.name.localeCompare(b.name));

		this.devices = newDevices;
    },

    rebuildFromRows() {
		const n = Array.isArray(this.rows) ? this.rows.length : -1;
		this.debug = `Rebuild clicked. rows.length=${n}, usedSheet=${this.usedSheetName || '-'}, modbusIndexBase=${this.modbusIndexBase}`;

		if (!Array.isArray(this.rows) || this.rows.length === 0) {
		this.debug += "\nNo Excel loaded (rows is empty).";
		return;
		}

		const ok = this.buildPointsFromRows();
		if (!ok) {
		this.debug += "\nbuildPointsFromRows() returned false.";
		return;
		}

		// Guardar solo datos editables del usuario para intentar reusarlos
		const previousByKey = new Map();
		for (const dev of (this.devices || [])) {
		const key = `${String(dev.name || "").trim().toLowerCase()}|${String(dev.modbusArea || "").trim()}`;
		previousByKey.set(key, {
		id: dev.id,
		name: dev.name,
		ip: dev.ip,
		slaveId: dev.slaveId,
		dataType: dev.dataType
		});
		}

		this.devices = [];
		this.buildDevicesFromPoints(previousByKey);

		this.debug += `\nDevices=${this.devices.length}, points=${this.points.length}`;
		this.generate();
    },

    clearExcel() {
      this.rows = [];
      this.points = [];
      this.usedSheetName = "";
      this.debug = "Excel cleared (manual mode).";
      this.generate();
    },

    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      document.body.classList.toggle('dark-theme', this.isDarkMode);
      localStorage.setItem('app-theme', this.isDarkMode ? 'dark' : 'light');
    },

    // ── Syntax highlighter (PLC / Structured Text) ───────────────────
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
        'THIS','SUPER','NEW','DELETE','SHL','SHR','TO_INT','TO_UINT','TO_DINT',
        'TO_UDINT','TO_REAL','TO_BYTE','TO_WORD','TO_DWORD','TO_SINT','TO_USINT'
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

        // Number (digit at word boundary)
        if (/[0-9]/.test(ch) && (i === 0 || /\W/.test(raw[i - 1]))) {
          let j = i;
          while (j < len && /[0-9_.#EeXx]/.test(raw[j])) j++;
          out += span('plc-number', raw.slice(i, j));
          i = j;
          continue;
        }

        // Identifier → keyword / type / plain
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

      return out.split('\n')
        .map(l => `<span class="line">${l}</span>`)
        .join('');
    },

    onFile(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) { this.debug = "No file selected."; return; }

      this.debug = `Loading file: ${file.name}`;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });

        const sheetName = wb.SheetNames.includes(this.preferredSheetName)
          ? this.preferredSheetName
          : wb.SheetNames[0];

        this.usedSheetName = sheetName;
        const ws = wb.Sheets[sheetName];

        this.rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: "" });

        this.debug = `Excel loaded. sheet=${sheetName}, rows=${this.rows.length}`;
        this.rebuildFromRows();
      };
      reader.readAsArrayBuffer(file);
    }
  },

  mounted() {
    this.generate();
  }
}).mount("#app");

