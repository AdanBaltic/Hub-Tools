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
      holdingBase: 40001,
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
      const s0 = String(cell ?? "").trim();
      if (!s0) return null;

      let s = s0;
      let bit = null;
      if (s.includes(".")) {
        const [a, b] = s.split(".");
        s = a;
        const bn = Number(b);
        if (Number.isFinite(bn) && bn >= 0 && bn <= 15) bit = Math.trunc(bn);
      }

      const digits = String(s).replace(/[^\d]/g, "");
      if (!digits) return null;

      let offset = null;

      if (digits.startsWith("4") && digits.length >= 2) {
        const rest = digits.slice(1);
        const regNum = Number(rest);
        if (!Number.isFinite(regNum)) return null;

        const baseRegNum = Number(String(this.holdingBase).replace(/[^\d]/g, "").slice(1));
        offset = Math.trunc(regNum - baseRegNum);
      } else {
        offset = Math.trunc(Number(digits));
      }

      if (!Number.isFinite(offset) || offset < 0 || offset > 65535) return null;

      return { offset, bit, raw: s0 };
    },

    buildVariableMappingProgram() {
      const lines = [];
      lines.push("// PROGRAM VariableMapping");
      lines.push("// Auto-generated mapping from Modbus buffers to GVL tags");
      lines.push("");

      const findReading = (dev, regOffset, words) => {
        for (let i = 0; i < (dev.readings?.length || 0); i++) {
          const rd = dev.readings[i];
          const start = this.toIntStrict(rd.address);
          const len = this.toIntStrict(rd.length);
          if (start === null || len === null) continue;

          const end = start + len - 1;
          const needEnd = regOffset + (words - 1);

          if (regOffset >= start && needEnd <= end) {
            const pos = (regOffset - start) + 1;
            return { readingIdx: i + 1, pos };
          }
        }
        return null;
      };

      const wordExpr = (dev, readingIdx, pos) => {
        const dataName = this.autoDataName(dev.name, 0);
        return `Modbus.${dataName}[${readingIdx}][${pos}]`;
      };

      const udint32Expr = (hiWord, loWord) =>
        `SHL(TO_UDINT(${hiWord}), 16) OR TO_UDINT(${loWord})`;

      for (const dev of (this.devices || [])) {
        const pts = dev.points || [];
        if (!pts.length) continue;

        lines.push(`// Device ${this.autoDevId(dev.name, 0)}`);
        lines.push("");

        const sorted = [...pts].sort((a, b) =>
          (a.start - b.start) ||
          ((a.bit ?? -1) - (b.bit ?? -1)) ||
          String(a.name).localeCompare(String(b.name))
        );

        for (const p of sorted) {
          const tag = this.toIdentifier(p.name);
          if (!tag) continue;

          const t = String(p.type || "").toUpperCase();
          const words = p.words || 1;

          const hit = findReading(dev, p.start, words);
          if (!hit) {
            lines.push(`// WARN: ${tag} at ${p.start}${p.bit!=null?'.'+p.bit:''} not covered by any reading`);
            continue;
          }

          const w0 = wordExpr(dev, hit.readingIdx, hit.pos);

          const isBool = (t.includes("DIGITAL") || t === "BOOL");
          if (isBool && p.bit != null) {
            lines.push(`${tag} := (${w0} AND SHL(WORD#1, ${p.bit})) <> WORD#0;`);
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
    wordsForType(typeRaw) {
      const t = this.toStrTrim(typeRaw).toUpperCase();
      if (!t) return null;

      if (t.includes("DIGITAL") || t === "BOOL") return 1;
      if (t === "BYTE" || t === "WORD" || t === "INT" || t === "UINT" || t === "SINT" || t === "USINT") return 1;
      if (t === "DINT" || t === "DUINT" || t === "REAL" || t === "DWORD") return 2;

      return null;
    },

    parseRegToOffset(regCell) {
      const s = this.toStrTrim(regCell);
      if (!s) return null;

      const n = Number(s);
      if (!Number.isFinite(n)) return null;

      const rounded = Math.trunc(n);
      const off = (rounded >= 40000) ? (rounded - this.holdingBase) : rounded;

      if (!Number.isFinite(off) || off < 0 || off > 65535) return null;
      return off;
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
        col["modbus register"];

      if (idxNAME === undefined || idxTYPE === undefined || idxModbusReg === undefined || idxLocation === undefined) {
        this.points = [];
        this.debug = `Missing columns. Need LOCATION, NAME, TYPE, and (Modbus declaration|Modbus|Modbus reg|Modbus register). Header row used: ${headerRowIndex + 1}`;
        return false;
      }

      const dataRows = this.rows.slice(headerRowIndex + 1);
      const pts = [];
      const typeErrors = [];

      for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i] || [];

        const name = this.toStrTrim(r[idxNAME]);
        if (!name) continue;

        const locationRaw = this.toStrTrim(r[idxLocation]);
        const loc = locationRaw.toLowerCase().replace(/\s+/g, "");
        if (!loc.includes("modbustcp")) continue;

        const type = this.toStrTrim(r[idxTYPE]);
        const words = this.wordsForType(type);
        if (!words) {
          typeErrors.push(`Row ${headerRowIndex + 2 + i}: unsupported TYPE "${type}" for tag ${name}`);
          continue;
        }

        const mb = this.parseModbusCell(r[idxModbusReg]);
        if (!mb) continue;

        const start = mb.offset;
        const end = start + words - 1;

        pts.push({
          name,
          type: type.toUpperCase(),
          start,
          end,
          bit: mb.bit,
          regRaw: mb.raw,
          words,
          root: this.rootFromName(name)
        });
      }

      this.points = pts;

      if (typeErrors.length) {
        this.debug = `Parsed points: ${pts.length}\nTYPE issues:\n- ${typeErrors.slice(0, 30).join("\n- ")}${typeErrors.length > 30 ? "\n- ..." : ""}`;
      }

      return true;
    },

    buildReadingsForDevice(points) {
      const items = [...points].sort((a,b) => a.start - b.start || a.end - b.end);

      const readings = [];
      let cur = null;

      const flush = () => {
        if (!cur) return;
        const len = (cur.end - cur.start + 1);
        readings.push({ id: crypto.randomUUID(), address: String(cur.start), length: String(len) });
        cur = null;
      };

      for (const it of items) {
        const itLen = it.words;

        if (!cur) {
          cur = { start: it.start, end: it.end, usedLen: itLen };
          continue;
        }

        const gap = it.start - (cur.end + 1);
        const newStart = cur.start;
        const newEnd = it.end;
        const newSpanLen = newEnd - newStart + 1;
        const newUsedLen = cur.usedLen + itLen;
        const waste = newSpanLen - newUsedLen;
        const wastePct = newSpanLen > 0 ? (waste / newSpanLen) * 100 : 0;

        const exceedMaxRegs = newSpanLen > this.maxRegsPerRead;
        const exceedGap = gap > this.maxGapRegs;
        const exceedWaste = wastePct > this.maxWastePct;

        if (exceedMaxRegs || exceedGap || exceedWaste) {
          flush();
          cur = { start: it.start, end: it.end, usedLen: itLen };
        } else {
          cur.end = it.end;
          cur.usedLen = newUsedLen;
        }
      }

      flush();
      return readings;
    },

    buildDevicesFromPoints() {
      const byRoot = new Map();
      for (const p of this.points) {
        if (!p.root) continue;
        if (!byRoot.has(p.root)) byRoot.set(p.root, []);
        byRoot.get(p.root).push(p);
      }

      const newDevices = [];
      let devIdxGlobal = 0;

      for (const [root, items] of byRoot.entries()) {
        items.sort((a,b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name));

        const rootDevices = [];

        for (const it of items) {
          let placed = false;

          for (const dev of rootDevices) {
            let collides = false;
            for (let r = it.start; r <= it.end; r++) {
              if (dev.used.has(r)) { collides = true; break; }
            }
            if (!collides) {
              for (let r = it.start; r <= it.end; r++) dev.used.add(r);
              dev.points.push(it);
              placed = true;
              break;
            }
          }

          if (!placed) {
            const used = new Set();
            for (let r = it.start; r <= it.end; r++) used.add(r);
            rootDevices.push({ used, points: [it] });
          }
        }

        rootDevices.forEach((d, idx) => {
          const deviceName = root;
          const prev = this.devices?.[devIdxGlobal++] ?? null;

          newDevices.push({
            id: prev?.id ?? crypto.randomUUID(),
            name: prev?.name ?? deviceName,
            ip: prev?.ip ?? "",
            slaveId: prev?.slaveId ?? "",
            dataType: prev?.dataType ?? "MW",
            readings: this.buildReadingsForDevice(d.points),
            points: d.points
          });
        });
      }

      newDevices.sort((a,b) => a.name.localeCompare(b.name));

      // Deduplicate names: same name → suffix _0, _1, …
      const nameCounts = new Map();
      newDevices.forEach(d => {
        const k = d.name.toLowerCase();
        nameCounts.set(k, (nameCounts.get(k) || 0) + 1);
      });
      const nameIdx = new Map();
      newDevices.forEach(d => {
        const k = d.name.toLowerCase();
        if ((nameCounts.get(k) || 0) > 1) {
          const idx = nameIdx.get(k) ?? 0;
          d.name = `${d.name}_${idx}`;
          nameIdx.set(k, idx + 1);
        }
      });

      this.devices = (newDevices.length ? newDevices : this.devices);
    },

    rebuildFromRows() {
      const n = Array.isArray(this.rows) ? this.rows.length : -1;
      this.debug = `Rebuild clicked. rows.length=${n}, usedSheet=${this.usedSheetName || '-'}`;

      if (!Array.isArray(this.rows) || this.rows.length === 0) {
        this.debug += "\nNo Excel loaded (rows is empty).";
        return;
      }

      const ok = this.buildPointsFromRows();
      if (!ok) {
        this.debug += "\nbuildPointsFromRows() returned false.";
        return;
      }

      this.devices = this.devices.filter(dev =>
        dev.name && dev.name.trim() !== 'Device' &&
        dev.name.trim() !== 'unnamed' &&
        !dev.name.startsWith('Device ')
      );

      this.buildDevicesFromPoints();
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

