// ── FileValidator.js ─────────────────────────────────────────────────────────
// Responsabilidad única: validar que un archivo tiene una extensión permitida.
// No conoce el DOM ni el estado de la UI.
// ─────────────────────────────────────────────────────────────────────────────

const FileValidator = (() => {
    const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.xlsm'];

    function validate(file) {
        const name  = (file && file.name) ? file.name.toLowerCase() : '';
        const valid = ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext));
        return {
            valid,
            error: valid
                ? null
                : `Formato no válido. Solo se aceptan: ${ACCEPTED_EXTENSIONS.join(', ')}`,
        };
    }

    function getAcceptAttribute() {
        return ACCEPTED_EXTENSIONS.join(',');
    }

    return { validate, getAcceptAttribute };
})();
