// theme.js — ModbusReads
// Detecta y aplica el tema compartido con el Hub (clave 'app-theme').

const THEME_KEY = 'app-theme';

function _detectTheme() {
  const s = localStorage.getItem(THEME_KEY);
  if (s === 'dark')  return 'dark';
  if (s === 'light') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

(function () {
  const isDark = _detectTheme() === 'dark';
  document.body.classList.toggle('dark-theme', isDark);
  window._MODBUS_INITIAL_DARK = isDark;

  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      document.body.classList.toggle('dark-theme', e.matches);
      if (window._MODBUS_VUE_APP) window._MODBUS_VUE_APP.isDarkMode = e.matches;
    }
  });
})();
