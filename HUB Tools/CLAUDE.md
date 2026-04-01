# CLAUDE.md

Eres un disenador famoso que revoluciono Apple, eres senior de disenador grafico y web, tienes que disenar como si fuese IOS 26, anadiendo efectos glass donde tu creas, pero tienes que ser honesto antes de aplicar un diseno y decir si es una buena eleccion o no, todo lo que sea mala practica dimelo. Luego el diseno que buscas es hacer un diseno super minimalista y minimo, ademas, cuando estes aplicando disenos, deberas tambien pensar en el tema oscuro.

**Data flow**:
1. User uploads Excel file → `FileReader` API reads it as ArrayBuffer
2. `excel-helpers.js` parses it with SheetJS, normalizes headers, locates the data rows
3. `generators.js` iterates rows, detects tag types by name suffix (`_DI`, `_DO`, `_AI`, `_AO`), and builds PLC declaration strings and alarm logic
4. `plc-helpers.js` aligns column-formatted text and applies regex-based syntax highlighting
5. `xml-builders.js` substitutes generated code into static XML templates from `templates.js`
6. Download buttons create a `Blob` and trigger a browser file download

**Configuration**: `config.js` is the single source of truth for theme colors, editor fonts, and Excel parsing settings (header row number, preferred sheet name). It exports `window.APP_CONFIG`, consumed by `theme.js` (applies colors as CSS custom properties) and `app.js`.

## Key Files

| File | Purpose |
|------|---------|
| `IO Gen/config.js` | All customizable settings: colors, fonts, Excel column config |
| `IO Gen/js/generators.js` | Core logic: parses Excel rows, generates PLC variable declarations and alarm programs |
| `IO Gen/js/app.js` | Vue instance, reactive state, file upload handler |
| `IO Gen/js/excel-helpers.js` | SheetJS utilities: header normalization, row parsing |
| `IO Gen/js/plc-helpers.js` | Text alignment (`alignDecls`, `alignFbCalls`) and syntax highlighting (`highlightPLC`) |
| `IO Gen/js/templates.js` | Static XML/TMC template strings for output files |
| `IO Gen/js/xml-builders.js` | Template substitution, XML escaping, file download via Blob API |
| `IO Gen/js/theme.js` | Reads `APP_CONFIG` and applies theme as CSS custom properties on `:root` |

## Expected Excel Format

The tool expects an Excel file with a sheet named `IO-list` (configurable in `config.js`) and column headers on row 10:

- `NAME` — Tag identifier (suffix determines type: `_DI`, `_DO`, `_AI`, `_AO`)
- `ALARM` — Mark `x` to generate alarm code
- `DESCRIPTION` — Comment text
- `TYPE` — PLC data type (BOOL, INT, REAL, etc.)
- `CONTROL` / `HMI` — Tag scope
- `HARDWARE DECLARATION` — PLC address
- `RawZero`, `RawFull`, `ScaledZero`, `ScaledFull` — Analog scaling parameters

## Output Files Generated

- `IO_Tags.xml` — Hardware-linked variable declarations
- `GVL.xml` — Global variable list (HMI/Modbus tags)
- `Alarm_tags.xml` — Alarm variable declarations
- `Alarms.tmc` — TwinCAT Module Configuration
- Inline console panels: Declarations (ST), Program code (ST), Scaling program (ST)
