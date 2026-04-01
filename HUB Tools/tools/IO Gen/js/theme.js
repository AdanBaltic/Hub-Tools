// ── theme.js ──────────────────────────────────────────────────────────────────
// Aplica las variables CSS del tema y la sintaxis definidas en config.js.
// Debe cargarse DESPUÉS de config.js y ANTES de app.js.
//
// Responsabilidad única: detectar la preferencia de tema y aplicar
// las CSS variables correspondientes al arrancar la página.
// ─────────────────────────────────────────────────────────────────────────────

const _cfg = window.APP_CONFIG || {};

const THEME_STORAGE_KEY = 'io-gen-theme';

// Detecta el tema a usar:
//   1. Override manual guardado por el usuario
//   2. Preferencia del sistema operativo/navegador
//   3. Claro por defecto si ninguno de los anteriores aplica
function _detectInitialTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

// Aplica los colores del tema (fondo, textos, bordes, barco…) como CSS variables.
function _applyThemeVars(t) {
  const root = document.documentElement;
  const set  = (v, val) => { if (val != null) root.style.setProperty(v, String(val)); };
  set('--upload-card-bg',  t.uploadCardBg);
  set('--bg-main',         t.bgMain);
  set('--bg-sidebar',      t.bgSidebar);
  set('--bg-editor',       t.bgEditor);
  set('--bg-gutter',       t.bgGutter);
  set('--bg-window-bar',   t.bgWindowBar);
  set('--bg-panel',        t.bgPanel);
  set('--border-color',    t.borderColor);
  set('--border-dark',     t.borderDark);
  set('--text-main',       t.textMain);
  set('--text-code',       t.textCode);
  set('--text-muted',      t.textMuted);
  set('--line-numbers',    t.lineNumbers);
  set('--accent',          t.accent);
  set('--upload-btn',       t.uploadBtn);
  set('--upload-btn-text',  t.uploadBtnText);
  set('--bg-gradient',      t.bgGradient);
  set('--nav-glass-bg',     t.navGlassBg);
  set('--nav-glass-border', t.navGlassBorder);
  set('--slider-bg',        t.sliderBg);
  set('--slider-active',    t.sliderActive);
}

// Aplica los colores del resaltado de sintaxis PLC como CSS variables.
function _applySyntaxVars(s) {
  const root = document.documentElement;
  const set  = (v, val) => { if (val != null) root.style.setProperty(v, String(val)); };
  set('--plc-kw',      s.keyword);
  set('--plc-type',    s.type);
  set('--plc-comment', s.comment);
  set('--plc-string',  s.string);
  set('--plc-number',  s.number);
  set('--plc-hwaddr',  s.hwAddress);
  set('--plc-attr',    s.attribute);
  set('--plc-xmltag',  s.xmlTag);
}

// Aplica el tema inicial detectado y registra un listener para cambios del sistema.
(function () {
  const root = document.documentElement;
  const set  = (v, val) => { if (val != null) root.style.setProperty(v, String(val)); };

  const initialTheme = _detectInitialTheme();
  const isDark = (initialTheme === 'dark');

  _applySyntaxVars(isDark ? (_cfg.syntax      || {}) : (_cfg.syntaxLight || {}));
  _applyThemeVars (isDark ? (_cfg.theme       || {}) : (_cfg.themeLight  || {}));

  // Expone el tema inicial para que app.js inicialice isDarkMode correctamente.
  window._IO_GEN_INITIAL_DARK = isDark;

  const e = _cfg.editor || {};
  if (e.fontFamily) set('--editor-font-family', e.fontFamily);
  if (e.fontSize)   set('--editor-font-size',   e.fontSize + 'px');
  if (e.lineHeight) set('--editor-line-height',  String(e.lineHeight));
  if (e.tabSize)    set('--editor-tab-size',     String(e.tabSize));

  // Escucha cambios en la preferencia del sistema (p. ej. el usuario cambia el tema del SO)
  // Solo se aplica si el usuario no tiene un override guardado manualmente.
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (evt) => {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        const t = evt.matches ? (_cfg.theme  || {}) : (_cfg.themeLight  || {});
        const s = evt.matches ? (_cfg.syntax || {}) : (_cfg.syntaxLight || {});
        _applyThemeVars(t);
        _applySyntaxVars(s);
        // Notifica a Vue si ya está montado
        if (window._IO_GEN_VUE_APP) {
          window._IO_GEN_VUE_APP.isDarkMode = evt.matches;
        }
      }
    });
  }
})();
