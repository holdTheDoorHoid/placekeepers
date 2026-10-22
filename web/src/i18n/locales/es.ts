// Spanish (es): the interface text of web/src/strings.ts, key for key.
//
// Seeded by the translation plumbing (issue #49, part A): the top bar, the language picker, the
// site menu, the settings drawer's headings, the translation note and the words content pages
// need. Every key left out shows the English text until it is translated here. How to add the
// rest, and how to check it, is in docs/TRANSLATING.md.
//
// Rules: keep each key's meaning and every value a template shows (the tests check), no dashes
// as punctuation, and proper names as they are (Placekeepers, Philly311, LandCare).

import type { Catalog } from '../catalog.ts';
import { formatDecimal, formatNumber } from '../format.ts';

const es: Catalog = {
  app: {
    name: 'Placekeepers',
    tagline: 'Un mapa gratuito para los vecinos de Filadelfia que cuidan su cuadra.',
    mapLabel: 'Mapa de Filadelfia. Las listas de lugares y de memoriales de esta página muestran lo mismo en texto.',
    loadingMap: 'Cargando el mapa',
    mapFailed: 'El mapa no pudo abrirse en este navegador. Pruebe con otro navegador o actualice este.',
    sampleData: 'Datos de muestra para pruebas. No son lugares reales.',
    earlyPreview: 'Versión 0.4: una primera versión pública. Confirme los datos con la Ciudad antes de actuar.',
    followAlong: 'Siga el proyecto',
    skipToList: 'Ir a la lista de lugares',
    hideNote: 'Ocultar',
    hideNoteLabel: 'Ocultar esta nota',
    close: 'Cerrar',
    notAffiliated: 'Sin relación con la Ciudad de Filadelfia ni con SEPTA. No es asesoría legal.',
    licenses: 'Código: GPL-3.0. Datos: cada fuente tiene su propia licencia. Textos: Creative Commons BY-SA 4.0.',
  },

  content: {
    tableLabel: 'Tabla, se desplaza hacia los lados',
    removalEmail: (email) =>
      `Escríbanos a [${email}](mailto:${email}). No usamos un formulario público para esto, porque una solicitud de retiro es personal y privada.`,
    removalComingSoon: (issueUrl) =>
      `Pronto habrá una dirección de correo privada para estas solicitudes. Mientras no exista, el mapa no muestra ningún nombre, y puede pedirlo en una [incidencia de GitHub](${issueUrl}). Cualquiera puede leer una incidencia de GitHub, así que escriba solo el número del memorial o dónde está: no tiene que dar un nombre, una razón ni decir quién es.`,
  },

  language: {
    button: 'Idioma',
    buttonLabel: (name) => `Idioma: ${name}. Elegir otro idioma`,
    title: 'Idioma',
    intro: 'Elija el idioma de este sitio. La página se abre de nuevo en ese idioma, y este navegador recuerda su elección.',
    inUse: 'En uso',
    notReady: 'Traducción en curso',
    listLabel: 'Idiomas',
    aiNote: 'Traducido con ayuda de inteligencia artificial y todavía no revisado por un hablante nativo.',
    fixLink: 'Corregir una traducción',
    pageInEnglish: 'Esta página todavía no está traducida, así que se muestra en inglés.',
    offerLabel: 'Oferta de idioma',
  },

  units: {
    meters: (n) => `${formatNumber(n)} metros`,
    kilometers: (km) => `${formatDecimal(km, 1)} kilómetros`,
  },

  header: {
    settings: 'Ajustes',
    share: 'Copiar enlace',
    shareDone: 'Enlace copiado. Quien lo abra verá este mismo mapa.',
    shareDoneNoMap: 'Enlace copiado. No incluye dónde está el mapa, porque el mapa está mostrando dónde está usted.',
    shareFailed: 'No se pudo copiar el enlace. Copie la dirección desde su navegador.',
    dataStatus: 'Estado de los datos',
  },

  nav: {
    menu: 'Menú',
    menuTitle: 'Menú del sitio',
    menuLabel: 'Páginas del sitio',
    map: 'Mapa',
    landBank: 'El Land Bank en números',
    pages: [
      { slug: 'about', label: 'Acerca de' },
      { slug: 'why', label: 'Por qué funciona' },
      { slug: 'how', label: 'Cómo hacerlo' },
      { slug: 'responsibly', label: 'Úselo con responsabilidad' },
      { slug: 'vacant-land', label: 'Cómo encontramos terrenos vacíos' },
      { slug: 'streetcomplete', label: 'Revisar paradas de autobús' },
      { slug: 'terms', label: 'Condiciones' },
      { slug: 'privacy', label: 'Privacidad' },
      { slug: 'contact', label: 'Contacto' },
    ],
  },

  views: {
    groupLabel: 'Elija una vista',
    field: 'Calle',
    analysis: 'Análisis',
    fieldLong: 'Vista de calle',
    analysisLong: 'Vista de análisis',
    fieldHint: 'Para cuando está en la cuadra: lugares cercanos y el primer paso legal.',
    analysisHint: 'Para organizadores: lentes, filtros, detalles y una lista ordenada.',
    auto: 'Elegir una vista según el tamaño de mi pantalla',
    autoHint: 'Los teléfonos usan la vista de calle; las pantallas más grandes, la vista de análisis.',
  },

  freshness: {
    checking: 'Revisando los datos',
    ok: (date) => `Datos del ${date}`,
    stale: 'Algunos datos están desactualizados',
    failing: 'Algunos datos no están cargando',
    unknown: 'Estado de los datos desconocido',
  },

  settings: {
    title: 'Ajustes',
    intro:
      'Todo lo que hay en el mapa es un ajuste. Sus opciones se guardan en este navegador y en el enlace, menos las de privacidad, que quedan solo en este navegador.',
    viewTitle: 'Vista',
    layersTitle: 'Capas y sus ajustes',
    lensTitle: 'Pesos de los lentes',
    suggestionsTitle: 'Sugerencias que se muestran',
    suggestionShow: (label) => `Mostrar "${label}"`,
    resetTitle: 'Empezar de nuevo',
    resetHelp:
      'Devuelve cada capa, ajuste y peso a los valores iniciales de esta vista, y olvida la copia guardada en este navegador.',
    reset: 'Volver a los valores iniciales',
    storageNote: 'Se guarda solo en este navegador. Placekeepers no tiene cuentas, cookies ni rastreo.',
  },

  options: {
    title: 'Privacidad y datos en vivo',
    privacyLink: 'Cómo cuida Placekeepers su privacidad',
    turnOn: 'Activar los datos en vivo de la Ciudad',
    resetNote: 'Su elección sobre los datos en vivo de la Ciudad no cambia.',
  },

  export: {
    englishColumns: 'Los nombres de las columnas están en inglés en todos los idiomas para que los archivos se puedan combinar y volver a abrir.',
  },
};

export default es;
