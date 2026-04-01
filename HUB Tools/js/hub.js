// ── hub.js ──────────────────────────────────────────────────────────────────
// Lógica principal del Hub: carga de herramientas, búsqueda y gestión del tema.
// ─────────────────────────────────────────────────────────────────────────────

// ── Módulo de tema ───────────────────────────────────────────────────────────
// Responsabilidad: detectar, aplicar y persistir la preferencia de tema.
const ThemeManager = (() => {
    const STORAGE_KEY = 'hub-theme';
    const DARK_CLASS  = 'dark-theme';
    const LIGHT_CLASS = 'light-theme';

    const LOGO_DARK  = 'assets/company/by-logo-simple-white.png';
    const LOGO_LIGHT = 'assets/company/by-logo-simple-blue.png';

    // Detecta el tema a aplicar:
    //   1. Preferencia guardada por el usuario (override manual)
    //   2. Preferencia del sistema operativo/navegador
    //   3. Claro por defecto si nada de lo anterior aplica
    function detect() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === DARK_CLASS || stored === LIGHT_CLASS) return stored;

        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return DARK_CLASS;
        }
        return LIGHT_CLASS;
    }

    function apply(theme) {
        document.body.className = theme;
        const logo = document.getElementById('hubLogo');
        if (logo) logo.src = (theme === DARK_CLASS) ? LOGO_DARK : LOGO_LIGHT;
    }

    function save(theme) {
        localStorage.setItem(STORAGE_KEY, theme);
    }

    function isDark() {
        return document.body.classList.contains(DARK_CLASS);
    }

    // Escucha cambios en la preferencia del sistema y los aplica
    // solo si el usuario no tiene un override guardado.
    function watchSystem() {
        if (!window.matchMedia) return;
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(STORAGE_KEY)) {
                apply(e.matches ? DARK_CLASS : LIGHT_CLASS);
            }
        });
    }

    function init(toggleEl) {
        const theme = detect();
        apply(theme);
        if (toggleEl) toggleEl.checked = (theme === DARK_CLASS);
        watchSystem();
    }

    function toggle(toggleEl) {
        const theme = isDark() ? LIGHT_CLASS : DARK_CLASS;
        apply(theme);
        save(theme);
        if (toggleEl) toggleEl.checked = (theme === DARK_CLASS);
    }

    return { init, toggle };
})();

// ── Módulo de renderizado ────────────────────────────────────────────────────
// Responsabilidad: leer tools.json y generar las tarjetas en el DOM.
const ToolsRenderer = (() => {
    function createCard(tool) {
        const isExternal = tool.href.startsWith('http');
        const a = document.createElement('a');
        a.href = tool.href;
        a.className = 'tool-card';
        if (isExternal) a.target = '_blank';

        a.innerHTML = `
            <span class="tool-icon">${tool.icon}</span>
            <div class="card-text">
                <h2 class="tool-title">${tool.title}</h2>
                <p class="tool-desc">${tool.description}</p>
            </div>`;

        return a;
    }

    async function render(gridEl, noResultsEl) {
        try {
            const res   = await fetch('tools.json');
            const tools = await res.json();

            tools.forEach(tool => {
                gridEl.insertBefore(createCard(tool), noResultsEl);
            });
        } catch (err) {
            console.error('No se pudo cargar tools.json:', err);
        }
    }

    return { render };
})();

// ── Módulo de búsqueda ───────────────────────────────────────────────────────
// Responsabilidad: filtrar las tarjetas de herramientas según el texto buscado.
const SearchManager = (() => {
    function normalize(str) {
        return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function filter(searchTerm, gridEl, noResultsEl) {
        const term  = normalize(searchTerm);
        const cards = gridEl.querySelectorAll('.tool-card');
        let hasVisible = false;

        cards.forEach(card => {
            const title = normalize(card.querySelector('.tool-title').textContent);
            const desc  = normalize(card.querySelector('.tool-desc').textContent);
            const match = title.includes(term) || desc.includes(term);
            card.style.display = match ? 'flex' : 'none';
            if (match) hasVisible = true;
        });

        noResultsEl.style.display = hasVisible ? 'none' : 'block';
    }

    function init(inputEl, gridEl, noResultsEl) {
        inputEl.addEventListener('input', (e) => filter(e.target.value, gridEl, noResultsEl));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.activeElement === inputEl) {
                inputEl.value = '';
                inputEl.dispatchEvent(new Event('input'));
                inputEl.blur();
            }
        });
    }

    return { init };
})();

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const toggleEl  = document.getElementById('themeToggle');
    const searchEl  = document.getElementById('searchInput');
    const gridEl    = document.getElementById('toolGrid');
    const noResults = document.getElementById('noResults');

    ThemeManager.init(toggleEl);
    toggleEl.addEventListener('change', () => ThemeManager.toggle(toggleEl));

    // Las tarjetas se generan desde tools.json antes de iniciar la búsqueda.
    await ToolsRenderer.render(gridEl, noResults);
    SearchManager.init(searchEl, gridEl, noResults);
});
