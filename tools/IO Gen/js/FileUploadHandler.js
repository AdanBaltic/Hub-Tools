// ── FileUploadHandler.js ──────────────────────────────────────────────────────
// Responsabilidad única: gestionar el estado UI del componente de subida.
// Recibe el validador y los elementos del DOM por inyección — no los busca él.
// ─────────────────────────────────────────────────────────────────────────────

const FileUploadHandler = (() => {

    function _showError(errorEl, message) {
        if (!errorEl) return;
        errorEl.textContent    = message;
        errorEl.style.display  = 'block';
    }

    function _clearError(errorEl) {
        if (!errorEl) return;
        errorEl.textContent    = '';
        errorEl.style.display  = 'none';
    }

    // inputEl   → <input type="file">
    // errorEl   → elemento donde mostrar errores
    // validator → objeto con método validate(file)
    // onFile    → callback(file) cuando el archivo es válido
    function init({ inputEl, errorEl, validator, onFile }) {
        inputEl.setAttribute('accept', validator.getAcceptAttribute());

        inputEl.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const { valid, error } = validator.validate(file);

            if (!valid) {
                _showError(errorEl, error);
                e.target.value = '';
                return;
            }

            _clearError(errorEl);
            onFile(file);
        });
    }

    return { init };
})();
