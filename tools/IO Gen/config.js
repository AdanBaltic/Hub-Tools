/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          I/O List Code Generator — Configuration File          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Edita este archivo para personalizar la herramienta.
 * No necesitas saber CSS, HTML ni JavaScript.
 *
 * ── COLORES ─────────────────────────────────────────────────────────
 * Puedes usar cualquiera de estos formatos:
 *   '#ff0000'          →  código hexadecimal (el más común)
 *   'rgb(255, 0, 0)'   →  formato RGB
 *   'red'              →  nombre de color en inglés
 *
 * ── NÚMEROS ─────────────────────────────────────────────────────────
 * Escribe solo el número, sin comillas ni unidades.
 *   fontSize: 14       →  correcto
 *   fontSize: '14px'   →  incorrecto
 */

window.APP_CONFIG = {

  // ════════════════════════════════════════════════════════════════════
  //  TEMA CLARO  (se activa al hacer clic en el icono luna/sol)
  //  Mismas claves que 'theme' y 'syntax' — solo cambia los valores
  // ════════════════════════════════════════════════════════════════════
  themeLight: {
    bgMain:          '#E8ECF0',
    bgGradient:      'linear-gradient(135deg, #dde3ea 0%, #e8ecf0 50%, #dfe5ec 100%)',
    bgSidebar:       '#f1f5f9',
    bgEditor:        '#ffffff',
    bgGutter:        '#f1f5f9',
    bgWindowBar:     '#e2e8f0',
    bgPanel:         '#e2e8f0',
    borderColor:     '#e2e8f0',
    borderDark:      '#cbd5e1',
    textMain:        '#111827',
    textCode:        '#334155',
    textMuted:       '#6B7280',
    lineNumbers:     '#94a3b8',
    accent:          '#0c2e62',
    uploadCardBg:    'rgba(255, 255, 255, 0.75)',
    uploadCardBorder:'rgba(255, 255, 255, 0.85)',
    uploadBtn:       '#0c2e62',
    uploadBtnText:   '#ffffff',
    navGlassBg:      'rgba(255, 255, 255, 0.55)',
    navGlassBorder:  'rgba(255, 255, 255, 0.7)',
    sliderBg:        '#d1d5db',
    sliderActive:    '#0c2e62',
  },

  syntaxLight: {
    // Paleta Xcode Light — diseñada por Apple para fondos blancos
    keyword:   '#ad3da4',   // magenta/morado  — VAR, END_VAR, AT, IF, THEN
    type:      '#3e8087',   // teal            — BOOL, INT, REAL, DINT
    comment:   '#5d6c79',   // gris pizarra    — // comentarios  (* *)
    string:    '#c41a16',   // rojo            — 'strings'
    number:    '#1c00cf',   // azul profundo   — 0, 1, 3.14
    hwAddress: '#836c28',   // dorado cálido   — %IX0.0  %QX0.1
    attribute: '#643820',   // marrón          — {attribute '...'}
    region:    '#2e6b3e',   // verde oscuro    — {region '...'}
    xmlTag:    '#0d68a8',   // azul            — <EventId>  <Name>
  },


  // ════════════════════════════════════════════════════════════════════
  //  CONFIGURACIÓN DE LA APLICACIÓN
  // ════════════════════════════════════════════════════════════════════
  app: {
    // Fila del Excel que contiene los encabezados de columna (NAME, Alarm, TYPE…)
    headerRowNumber: 10,

    // Nombre de la hoja de Excel que se usará
    // Si no existe esa hoja, se usará la primera que encuentre
    preferredSheetName: 'IO-list',
  },


  // ════════════════════════════════════════════════════════════════════
  //  EDITOR DE CÓDIGO  (los paneles de texto con el código PLC)
  // ════════════════════════════════════════════════════════════════════
  editor: {
    // Tipo de letra del editor
    fontFamily: 'Consolas, "Courier New", monospace',

    // Tamaño de la letra (en píxeles)
    fontSize: 13,

    // Espacio entre líneas
    //   1.0 = muy junto   |   1.7 = cómodo   |   2.0 = muy separado
    lineHeight: 1.7,

    // Ancho de un carácter TAB (en espacios)
    tabSize: 4,
  },


  // ════════════════════════════════════════════════════════════════════
  //  COLORES DE SINTAXIS PLC
  //  Qué color tiene cada elemento del código generado
  // ════════════════════════════════════════════════════════════════════
  syntax: {
    // Paleta Xcode Dark — diseñada por Apple para fondos negros
    // Palabras clave:  VAR  END_VAR  IF  THEN  FOR  AT  RETAIN …
    keyword:   '#fc5fa3',   // rosa Apple      — muy reconocible en Xcode

    // Tipos de datos:  BOOL  INT  REAL  DINT  STRING …
    type:      '#5dd8ff',   // cian claro      — armónico con el acento #38bdf8

    // Comentarios:  // esto es un comentario  y  (* también esto *)
    comment:   '#6c7986',   // gris pizarra    — discreto, no distrae

    // Cadenas de texto:  'valor entre comillas'
    string:    '#fc6a5d',   // coral           — cálido, contraste suave

    // Números:  0   1   3.14   16#FF
    number:    '#d9c97c',   // dorado cálido   — rompe el frío sin chirriar

    // Direcciones de hardware:  %IX0.0   %QX0.1   %IW2
    hwAddress: '#a167e6',   // lavanda         — se distingue bien del resto

    // Atributos del compilador:  {attribute 'qualified_only'}
    attribute: '#6c7986',   // gris pizarra   — discreto, no distrae

    // Región de código:  {region 'nombre'}   {endregion}
    region:    '#ffa14f',   // naranja suave     — diferente al attribute, fresco

    // Etiquetas XML  (sección Alarms.tmc):  <EventId>   <Name>
    xmlTag:    '#67b7a4',   // teal apagado    — diferente al tipo, coherente
  },


  // ════════════════════════════════════════════════════════════════════
  //  TEMA VISUAL  (colores generales de la interfaz)
  // ════════════════════════════════════════════════════════════════════
  theme: {
    // Fondo principal de la página
    bgMain:       '#0f172a',

    // Fondo de la barra lateral izquierda (menú de navegación)
    bgSidebar:    '#0d1117',

    // Fondo del editor de código
    bgEditor:     '#0d1117',

    // Fondo de la columna de números de línea
    bgGutter:     '#0a0e17',

    // Fondo de la barra de título de cada panel (donde están los botones Copy)
    bgWindowBar:  '#1e293b',

    // Fondo de tarjetas, píldoras y botones
    bgPanel:      '#1e293b',

    // Color de los bordes entre elementos
    borderColor:  '#1e293b',

    // Color de los bordes más marcados (separadores, bordes de ventana)
    borderDark:   '#334155',

    // Color del texto principal
    textMain:     '#f8fafc',

    // Color del texto dentro del editor (código sin resaltado)
    textCode:     '#adbac7',

    // Color del texto secundario (subtítulos, pistas)
    textMuted:    '#64748b',

    // Color de los números de línea del editor
    lineNumbers:  '#3d5063',

    // Color de acento: barra activa del menú, logo, botón de subir archivo
    accent:       '#38bdf8',

    // Fondo de la tarjeta de carga (pantalla inicial)
    uploadCardBg: 'rgba(30, 41, 59, 0.7)',

    // Color del botón de seleccionar archivo (pantalla inicial)
    uploadBtn:    '#0284c7',

    // Color del texto del botón de seleccionar archivo
    uploadBtnText: '#ffffff',

    // Olas del fondo (pantalla inicial)
    //   uploadWave1 = ola delantera (más clara, opaca al 50%)
    //   uploadWave2 = ola trasera (más oscura, opaca al 100%)
    uploadWave1:  '#0284c7',
    uploadWave2:  '#0369a1',

    // Navbar glass (pantalla inicial)
    bgGradient:   'linear-gradient(135deg, #0a0e17 0%, #0f172a 50%, #0a0e17 100%)',
    navGlassBg:   'rgba(13, 17, 23, 0.6)',
    navGlassBorder: 'rgba(255, 255, 255, 0.08)',
    sliderBg:     '#4b5563',
    sliderActive: '#38bdf8',
  },

};
