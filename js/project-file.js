(function () {
  'use strict';

  const FORMAT = 'hub-tools-project';
  const VERSION = 1;
  const EXTENSION = '.hubproject';
  const MAX_ROWS = 100000;
  const MAX_COLUMNS = 500;

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function safeString(value, fallback = '', maxLength = 255) {
    if (typeof value !== 'string') return fallback;
    return value.slice(0, maxLength);
  }

  function sanitizeRows(rows, allowEmpty = true) {
    if (!Array.isArray(rows)) throw new Error('Project source rows must be an array.');
    if (!allowEmpty && rows.length === 0) throw new Error('This project does not contain Excel data.');
    if (rows.length > MAX_ROWS) throw new Error(`Project exceeds the ${MAX_ROWS} row limit.`);

    return rows.map((row, rowIndex) => {
      if (!Array.isArray(row)) throw new Error(`Project row ${rowIndex + 1} is invalid.`);
      if (row.length > MAX_COLUMNS) throw new Error(`Project row ${rowIndex + 1} exceeds the column limit.`);

      return row.map((cell) => {
        if (cell === null || typeof cell === 'string' || typeof cell === 'boolean') return cell;
        if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
        throw new Error(`Project row ${rowIndex + 1} contains an unsupported cell value.`);
      });
    });
  }

  function clonePlainObject(value, label) {
    if (!isPlainObject(value)) throw new Error(`${label} must be an object.`);
    return JSON.parse(JSON.stringify(value));
  }

  function createProject({ tool, source = {}, settings = {}, state = {} }) {
    if (typeof tool !== 'string' || !tool.trim()) throw new Error('Project tool is required.');

    return {
      format: FORMAT,
      version: VERSION,
      tool: tool.trim(),
      createdAt: new Date().toISOString(),
      source: {
        fileName: safeString(source.fileName),
        sheetName: safeString(source.sheetName),
        rows: sanitizeRows(source.rows || []),
      },
      settings: clonePlainObject(settings, 'Project settings'),
      state: clonePlainObject(state, 'Project state'),
    };
  }

  function parse(text, expectedTool) {
    let project;
    try {
      project = JSON.parse(text);
    } catch (err) {
      throw new Error('The selected file is not a valid HUB Tools project.');
    }

    if (!isPlainObject(project) || project.format !== FORMAT) {
      throw new Error('The selected file is not a HUB Tools project.');
    }
    if (project.version !== VERSION) {
      throw new Error(`Unsupported project version: ${String(project.version)}.`);
    }
    if (typeof project.tool !== 'string' || !project.tool) {
      throw new Error('The project does not identify its tool.');
    }
    if (expectedTool && project.tool !== expectedTool) {
      throw new Error(`This project belongs to "${project.tool}", not "${expectedTool}".`);
    }
    if (!isPlainObject(project.source)) throw new Error('Project source is invalid.');

    return {
      format: FORMAT,
      version: VERSION,
      tool: project.tool,
      createdAt: safeString(project.createdAt),
      source: {
        fileName: safeString(project.source.fileName),
        sheetName: safeString(project.source.sheetName),
        rows: sanitizeRows(project.source.rows || []),
      },
      settings: clonePlainObject(project.settings || {}, 'Project settings'),
      state: clonePlainObject(project.state || {}, 'Project state'),
    };
  }

  async function readFile(file, expectedTool) {
    if (!file || typeof file.text !== 'function') throw new Error('No project file was selected.');
    if (!String(file.name || '').toLowerCase().endsWith(EXTENSION)) {
      throw new Error(`Project files must use the ${EXTENSION} extension.`);
    }
    return parse(await file.text(), expectedTool);
  }

  function download(project, filename) {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function buildFilename(sourceFileName, toolSuffix) {
    const original = safeString(sourceFileName, 'project');
    const withoutExtension = original.replace(/\.[^.]+$/, '') || 'project';
    const safeBase = withoutExtension
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'project';
    return `${safeBase}-${toolSuffix}${EXTENSION}`;
  }

  window.HubProjectFile = {
    FORMAT,
    VERSION,
    EXTENSION,
    buildFilename,
    createProject,
    download,
    isPlainObject,
    parse,
    readFile,
    safeString,
    sanitizeRows,
  };
})();
