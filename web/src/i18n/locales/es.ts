// Spanish (es): the interface text of web/src/strings.ts, key for key.
//
// Neutral Latin American Spanish, addressing the reader as usted, in the plain and warm style of
// the English. Key terms follow docs/i18n/glossary-es.md, so the catalog, the registry text and
// the content pages say the same thing the same way. How the catalogs work, and how to check
// them, is in docs/TRANSLATING.md.
//
// Rules: keep each key's meaning and every value a template shows (the tests check), no dashes
// as punctuation, and proper names as they are (Placekeepers, Philly311, LandCare).

import type { Catalog } from '../catalog.ts';
import { formatDecimal, formatNumber, plural } from '../format.ts';
import { distanceWords } from '../../strings.ts';

/** "subió 61%", "bajó 3%", "no cambió": a change in percent, in words. */
function variacion(n: number): string {
  if (n > 0) return `subió ${formatNumber(n)}%`;
  if (n < 0) return `bajó ${formatNumber(-n)}%`;
  return 'no cambió';
}

/** " (más o menos 6 puntos)", or nothing when there is no margin: a survey's margin of error. */
function masOMenos(margin: number | null, unit: 'points' | 'homes'): string {
  if (margin === null) return '';
  return ` (más o menos ${unit === 'points' ? plural(margin, { one: '# punto', other: '# puntos' }) : formatNumber(margin)})`;
}

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

  field: {
    nearMe: 'Cerca de mí',
    nearMeBusy: 'Buscando dónde está usted',
    nearMeDenied: 'La ubicación está desactivada para este sitio. Aun así puede mover el mapa con la mano.',
    nearMeUnavailable: 'Su dispositivo no pudo encontrar su ubicación. Aun así puede mover el mapa con la mano.',
    nearMeUnsupported: 'Este navegador no puede compartir su ubicación. Aun así puede mover el mapa con la mano.',
    nearMeOutside: 'Parece que está fuera de Filadelfia. Este mapa cubre solo Filadelfia.',
    nearMePrivacy: 'Su ubicación se queda en su dispositivo. Placekeepers nunca la envía a ningún lado ni la pone en un enlace.',
    youAreHere: 'Usted está aquí',
    stopLocation: 'Dejar de usar mi ubicación',
    locationInUse: 'Usando su ubicación. Se queda en este dispositivo y fuera de cualquier enlace que copie.',
    stop: 'Dejar',
    myLists: 'Mis listas',
    listsTitle: 'Listas guardadas',
    chipsLabel: 'Capas principales',
    moreLayers: 'Más capas',
    layersTitle: 'Capas',
  },

  chips: {
    lots: 'Lotes',
    streets: 'Calles',
    memorials: 'Memoriales',
    stops: 'Paradas de autobús',
    comingSoon: 'próximamente',
  },

  sheet: {
    title: 'Lo que puede hacer cerca',
    show: 'Mostrar lugares cercanos',
    hide: 'Ocultar lugares cercanos',
    countLabel: (n) => plural(n, { one: '# lugar', other: '# lugares' }),
    zoomIn: 'Mueva o acerque el mapa a un vecindario para ver lugares cercanos.',
    finding: 'Buscando los lugares cercanos.',
    noLotsLayer: 'Active la capa de Lotes o la de Paradas de autobús para ver lugares cercanos.',
    nothingHere: 'Ningún lote ni edificio vacío coincide con sus ajustes en esta parte del mapa.',
    nothingHereStops: 'Ningún lote, edificio vacío ni parada de autobús coincide con sus ajustes en esta parte del mapa.',
    noStopsHere: 'Ninguna parada de autobús o tranvía coincide con sus ajustes en esta parte del mapa.',
    showOnMap: 'Mostrar en el mapa',
    openLotPage: 'Abrir la página del lote',
    nearestToYou: 'Primero los más cercanos a usted.',
    nearestToCenter: 'Primero los más cercanos al centro del mapa. Mueva el mapa o toque "Cerca de mí".',
    noneWithSuggestion: 'Ningún lugar de aquí tiene una sugerencia activada. Active sugerencias en Ajustes o mueva el mapa.',
    showMore: 'Mostrar más lugares',
    distance: (meters, fromYou) => {
      const feet = meters * 3.28084;
      const far =
        feet < 1000
          ? `${formatNumber(Math.max(10, Math.round(feet / 10) * 10))} pies`
          : `${formatDecimal(feet / 5280, 1)} millas`;
      return `A unos ${far} ${fromYou ? 'de usted' : 'del centro del mapa'}`;
    },
  },

  place: {
    kindLot: 'Lote vacío',
    kindBuilding: 'Edificio vacío',
    kindUnknown: 'Parcela vacía',
    parcel: (id) => `Parcela ${id}`,
    priority: (score, lens) => `Prioridad ${score} de 100 para ${lens.toLowerCase()}`,
    mainReason: (label) => `Razón principal: ${label}.`,
    bestSuggestion: 'Lo que podría hacer',
    firstStep: 'Primer paso legal',
    cost: (cost) => `Costo: ${cost}`,
    confidence: { 1: 'No estamos muy seguros de que esté vacío', 2: 'Probablemente vacío', 3: 'Muy probablemente vacío' },
    confidenceTitle: 'Qué tan seguros estamos',
    ownerTitle: 'Tipo de dueño',
    landcare: 'Ya lo mantiene PHS LandCare',
    listed: 'Indicado como disponible por las agencias de tierras de la Ciudad',
    suggestionsTitle: 'Sugerencias',
    clearSelection: 'Quitar la selección',
    selectedTitle: 'Lugar seleccionado',
  },

  ownerTypes: {
    0: 'Desconocido',
    1: 'Persona',
    2: 'Empresa',
    3: 'Ciudad de Filadelfia',
    4: 'Philadelphia Land Bank',
    5: 'Autoridad de Redesarrollo',
    6: 'Autoridad de vivienda',
    7: 'Organización sin fines de lucro',
    8: 'Otra agencia pública',
  },

  why: {
    title: 'Por qué este puntaje',
    caption: 'El valor de cada factor de 0 a 100, su peso y los puntos que suma al puntaje',
    intro: 'El puntaje es un promedio ponderado de estos factores. Cada uno va de 0 a 100, donde 100 significa la mayor necesidad.',
    factor: 'Factor',
    value: 'De 100',
    weight: 'Peso',
    adds: 'Suma',
    noData: 'sin datos',
    off: 'apagado',
    total: 'Puntaje',
    missingNote: 'Los factores sin datos para este lugar se dejan fuera de su promedio.',
  },

  reasons: {
    title: 'Por qué creemos que está vacío',
    againstTitle: 'Lo que nos hace dudar',
    notPublished: 'Las razones para este lugar todavía no se han publicado.',
    city_land: (date) =>
      date
        ? `La Ciudad lo incluye como terreno probablemente vacío (lista del ${date})`
        : 'La Ciudad lo incluye como terreno probablemente vacío',
    city_building: (date) =>
      date
        ? `La Ciudad lo incluye como edificio probablemente vacío (lista del ${date})`
        : 'La Ciudad lo incluye como edificio probablemente vacío',
    assessor_vacant_land: 'La Oficina de Evaluación de Propiedades (OPA) lo clasifica como terreno vacío',
    no_building: 'No hay ningún edificio en la parcela',
    demolished: (year) =>
      year ? `Demolido en ${year}, y no se ha construido nada desde entonces` : 'Demolido, y no se ha construido nada desde entonces',
    vacant_lot_record: 'L&I registró una infracción o una queja por lote vacío en los últimos dos años',
    landcare: 'Está en PHS LandCare, que cuida lotes vacíos',
    sealed: (year) =>
      year ? `Sellado por la Ciudad en ${year}, sin permisos desde entonces` : 'Sellado por la Ciudad, sin permisos desde entonces',
    unsafe: 'L&I lo registra como inseguro, sin permisos desde entonces',
    imminently_dangerous: 'L&I lo declaró de peligro inminente, sin permisos desde entonces',
    vacant_building_record: 'L&I registró una infracción o una queja por propiedad vacía en los últimos dos años',
    assessor_exterior: 'La Oficina de Evaluación de Propiedades (OPA) anotó que su exterior está vacío o sellado',
    built_since: (year) =>
      year
        ? `En ${year} se emitió un permiso de construcción nueva, así que ahora puede haber un edificio`
        : 'Se emitió un permiso de construcción nueva, así que ahora puede haber un edificio',
    construction_starting: (year) =>
      year
        ? `En ${year} se emitió un permiso de construcción nueva, así que puede estar por empezar una obra`
        : 'Se emitió un permiso de construcción nueva, así que puede estar por empezar una obra',
    side_yard: 'El dueño de la casa habitada de al lado también es dueño de este lote, así que puede ser un patio lateral',
    land_use_shows_use: 'El mapa de uso del suelo de la Ciudad lo muestra en uso',
    recent_permit: 'En los últimos dos años se emitió un permiso de obra o de zonificación',
    building_stands: 'Hay la huella de un edificio sobre la parcela, aunque los registros dicen terreno vacío',
    homestead: 'El dueño tiene una exención por vivienda familiar (homestead): los registros de la Ciudad dicen que aquí vive, o vivía, alguien',
  },

  lens: {
    title: 'Lente',
    presets: 'Combinaciones listas',
    presetActive: 'en uso',
    weightLabel: (factor) => `Peso de ${factor}`,
    weightValue: (w) => (w === 0 ? 'Apagado' : `${w} de 5`),
    resetWeights: 'Volver a los pesos iniciales',
    allOff: 'Todos los factores están apagados. Active uno para colorear los lotes.',
    allOffFor: (appliesTo) =>
      appliesTo === 'segment'
        ? 'Todos los factores están apagados. Active uno para colorear las calles.'
        : appliesTo === 'stop'
          ? 'Todos los factores están apagados. Active uno para colorear las paradas de autobús y tranvía.'
          : 'Todos los factores están apagados. Active uno para colorear los lotes.',
    explainToggle: 'Por qué este factor',
    shown: (layer, lens) => `Ahora se muestra "${layer}", coloreado con el lente de ${lens.toLowerCase()}.`,
    notShown: (layer) => `Por ahora el mapa no muestra este lente en "${layer}".`,
    showOnMap: 'Mostrarlo en el mapa',
    legendLow: 'Menor prioridad',
    legendHigh: 'Mayor prioridad',
    legendNoData: 'Sin puntaje',
  },

  filters: {
    title: 'Filtros',
    intro:
      'Elija opciones para reducir los lotes del mapa, la lista ordenada y el gráfico. Un grupo sin ninguna opción elegida lo muestra todo.',
    ownerType: 'Tipo de dueño',
    landcare: 'Ya en LandCare',
    inLandcare: 'Mantenido por PHS LandCare',
    notInLandcare: 'No está en LandCare',
    confidence: 'Qué tan seguros estamos',
    kind: 'Lote o edificio',
    listed: 'Indicados como disponibles por las agencias de tierras de la Ciudad',
    clear: 'Quitar los filtros',
    showAll: 'Mostrar todo',
    noneSelected: (group) => `No hay nada elegido en "${group}", así que no se muestra ningún lote.`,
    narrowedNote: (n) =>
      n === 1
        ? 'Un filtro de la vista de análisis está reduciendo estos lugares.'
        : `${formatNumber(n)} filtros de la vista de análisis están reduciendo estos lugares.`,
  },

  permission: {
    title: 'Primer paso para obtener permiso',
    short: {
      0: 'Aún no hay una vía clara',
      1: 'Community LandCare',
      2: 'Acuerdo o licencia de jardín',
      3: 'Preguntar a PHDC',
      4: 'Preguntar a la agencia pública',
      5: 'Preguntar al dueño',
    },
    long: {
      0: 'Aún no hay una vía clara: los registros de la Ciudad no dan el nombre de ningún dueño',
      1: 'PHS LandCare ya lo cuida: cuidado por parte de Community LandCare',
      2: 'La Ciudad o el Land Bank es dueño: un acuerdo o una licencia de jardín',
      3: 'La Autoridad de Redesarrollo o PHDC es dueña: pregunte a PHDC',
      4: 'La autoridad de vivienda u otra entidad pública es dueña: pregunte a la agencia',
      5: 'Un dueño privado: pregunte al dueño',
    },
    notPublished: 'Todavía no se ha publicado',
    filterHelp:
      'A quién preguntar primero, según el dueño que nombran los registros de la Ciudad. Es un tipo de paso, no una medida de qué tan probable es que alguien diga que sí.',
    noRoute: 'Aún no hay una vía clara: los registros de la Ciudad no dan el nombre de ningún dueño. La página del lote muestra lo que sabemos.',
    seeLotPage: 'La página del lote enumera las vías legales para este lugar.',
  },

  layers: {
    title: 'Capas',
    show: (label) => `Mostrar ${label}`,
    details: 'Acerca de esta capa',
    settings: 'Ajustes de la capa',
    sources: 'Fuentes',
    legend: 'Leyenda',
    license: 'Licencia',
    noData: 'Todavía no hay datos publicados',
    dataError: 'No se pudo cargar esta capa.',
    resetAll: 'Volver a los valores iniciales',
    resetDone: 'Los ajustes volvieron a sus valores iniciales.',
    guide: 'Cómo puede ayudar a mejorar esta capa',
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

  analysis: {
    leftTitle: 'Lente, filtros y capas',
    rightTitle: 'Detalles',
    openLeft: 'Lente y capas',
    openRight: 'Detalles',
    closePanel: 'Cerrar el panel',
    areaTitle: 'En esta parte del mapa',
    areaLots: (n) => plural(n, { one: '# lote vacío', other: '# lotes vacíos' }),
    areaBuildings: (n) => plural(n, { one: '# edificio vacío', other: '# edificios vacíos' }),
    areaHigh: (n) => `${formatNumber(n)} de ellos muy probablemente vacíos`,
    areaLandcare: (n) => `${formatNumber(n)} ya mantenidos por PHS LandCare`,
    areaEmpty: 'Ningún lote ni edificio vacío coincide con sus ajustes aquí. Pruebe alejar el mapa o cambiar los filtros.',
    areaHint: 'Seleccione un lote en el mapa o en la lista para ver por qué tiene ese puntaje.',
    sampleArea:
      'Con el mapa tan alejado, solo se muestra una muestra de los lotes y edificios vacíos, así que aquí no se cuentan. Acerque el mapa para contar todos los lugares.',
    sampleList:
      'Acerque el mapa para enumerar todos los lugares. Con el mapa tan alejado, solo se muestra una muestra de los lotes y edificios vacíos, así que una lista o un gráfico aquí dejaría lugares fuera.',
    sampleTab: 'acerque el mapa',
    tableCaption: 'Lugares a la vista, ordenados según la mezcla de lentes actual',
    rank: 'Posición',
    place: 'Lugar',
    score: 'Puntaje',
    reason: 'Razón principal',
    save: 'Guardar',
    sortHighFirst: 'Primero el puntaje más alto. Elija esto para poner primero el más bajo.',
    sortLowFirst: 'Primero el puntaje más bajo. Elija esto para poner primero el más alto.',
    tableEmpty: 'No hay nada que ordenar a la vista.',
    noScores: 'Los puntajes de prioridad todavía no se han publicado, así que esta lista sigue el orden del número de parcela.',
    tableMore: (shown, total) =>
      `Se muestran los primeros ${formatNumber(shown)} de ${formatNumber(total)}. Acerque el mapa o reduzca los filtros para ver el resto, o descárguelos todos.`,
    drawerLabel: 'Lugares a la vista',
    tabTable: 'Lista ordenada',
    tabPlot: 'Necesidad y primer paso',
    tabLists: 'Listas guardadas',
    tabMemorials: 'Memoriales',
    tabBlocks: 'Cuadras',
  },

  plot: {
    title: 'Necesidad y primer paso para obtener permiso',
    intro:
      'Cada punto es un lugar a la vista. De lado a lado: su prioridad según su mezcla de lentes, de 0 a 100. De arriba abajo: el primer paso para obtener permiso, un tipo de paso, no una medida de qué tan probable es que alguien diga que sí. Elija un punto para abrir la página de su lote.',
    axisX: 'Prioridad según su mezcla de lentes',
    empty: 'No hay lugares a la vista para mostrar en el gráfico.',
    noScore: (n) =>
      n === 1
        ? `${formatNumber(n)} lugar no tiene puntaje y no se muestra.`
        : `${formatNumber(n)} lugares no tienen puntaje y no se muestran.`,
    noStep: (n) =>
      n === 1
        ? `${formatNumber(n)} lugar todavía no tiene un primer paso publicado y no se muestra.`
        : `${formatNumber(n)} lugares todavía no tienen un primer paso publicado y no se muestran.`,
    dot: (place, score, step) => `${place}: prioridad ${score}. ${step}.`,
    tableNote: 'La lista ordenada muestra los mismos lugares, con el mismo primer paso, para el teclado y los lectores de pantalla.',
    capped: (shown, total) =>
      `Se muestran los ${formatNumber(shown)} lugares con los puntajes más altos, de ${formatNumber(total)} a la vista. Acerque el mapa para verlos todos.`,
    summary: (rows) => `Lugares a la vista según el primer paso para obtener permiso: ${rows}.`,
    rowSummary: (label, n) => `${label}, ${plural(n, { one: '# lugar', other: '# lugares' })}`,
  },

  export: {
    title: 'Descargar estos lugares',
    help: (limit) =>
      `Un archivo con hasta ${formatNumber(limit)} lugares y lo que dice la página de cada lote sobre el dueño, incluidos los indicadores sobre el dueño. Su primera línea remite a las condiciones de uso.`,
    csv: 'Descargar CSV',
    geojson: 'Descargar GeoJSON',
    inView: 'Lugares a la vista',
    working: (done, total) => `Reuniendo los datos de los dueños: ${formatNumber(done)} de ${formatNumber(total)} archivos`,
    done: (n) => plural(n, { one: 'Se descargó # lugar.', other: 'Se descargaron # lugares.' }),
    leftOut: (n, limit) =>
      `${plural(n, { one: '# lugar más quedó fuera', other: '# lugares más quedaron fuera' })}, porque una descarga contiene como máximo ${formatNumber(limit)}. Acerque el mapa o reduzca los filtros para descargar el resto.`,
    withoutDetails: (n) =>
      plural(n, {
        one: '# lugar no tiene detalles publicados, así que sus columnas de dueño están vacías.',
        other: '# lugares no tienen detalles publicados, así que sus columnas de dueño están vacías.',
      }),
    nothing: 'No hay lugares para descargar.',
    sampleOff: 'Las descargas incluyen todos los lugares a la vista, y con el mapa tan alejado solo se muestra una muestra. Acerque el mapa para descargar.',
    failed: 'No se pudo hacer la descarga. Inténtelo de nuevo en un momento.',
    yes: 'sí',
    no: 'no',
    termsLine: (url) => `Descarga de Placekeepers: solo para el cuidado comunitario y la acción legal. Lea primero las condiciones de uso: ${url}`,
    englishColumns: 'Los nombres de las columnas están en inglés en todos los idiomas para que los archivos se puedan combinar y volver a abrir.',
    madeLine: (n, title, day, dataDay) =>
      `${plural(n, { one: '# lugar', other: '# lugares' })} de ${title}. Hecho el ${day}${dataDay ? ` con los datos semanales del ${dataDay}` : ''}.`,
    ownerLine:
      'Los nombres y las direcciones postales de los dueños son como los publica la Ciudad. Cada indicador sobre el dueño tiene una nota de cuidado y un siguiente paso que protege: léalos en la página del lote antes de actuar. No es asesoría legal.',
    scoreLine: (lens, weights) => `Los puntajes usan el lente de ${lens} con estos pesos: ${weights}.`,
    greeningLine: (caution) => `Sobre las sugerencias de reverdecimiento: ${caution}`,
    placemakingLine: (caution) => `Sobre jardines, asientos y arte: ${caution}`,
  },

  lists: {
    title: 'Listas guardadas',
    privacy:
      'Las listas se quedan en este navegador, en este dispositivo. No se envía nada a ningún lado. Para pasar una lista a otro dispositivo o compartirla, descárguela como archivo y abra ese archivo allá.',
    notKept:
      'Este navegador no está guardando listas ahora, quizás por una ventana privada o por almacenamiento bloqueado. Descargue su lista antes de cerrar la página.',
    empty: 'Todavía no hay listas. Guarde un lugar desde su tarjeta, la lista ordenada o la página de su lote, y empieza una lista.',
    inUse: 'Lista en uso',
    defaultName: 'Mi lista',
    untitled: 'Lista',
    newList: 'Lista nueva',
    newName: 'Nombre para la lista nueva',
    create: 'Crear la lista',
    rename: 'Cambiar el nombre',
    renameLabel: 'Nombre nuevo para esta lista',
    saveName: 'Guardar el nombre',
    cancel: 'Cancelar',
    delete: 'Borrar esta lista',
    made: (name) => `Se creó la lista "${name}". Los lugares que guarde ahora van a ella.`,
    renamed: (name) => `La lista ahora se llama "${name}".`,
    deleted: (name) => `Se borró "${name}" de este navegador.`,
    confirmDelete: (name, n) =>
      `¿Borrar "${name}" y ${plural(n, { one: 'su # lugar', other: 'sus # lugares' })} de este navegador? No se podrá recuperar, a menos que la haya descargado.`,
    count: (n) => plural(n, { one: '# lugar', other: '# lugares' }),
    noPlaces: 'Esta lista está vacía. Guarde lugares desde sus tarjetas, la lista ordenada o las páginas de sus lotes.',
    open: (place) => `Abrir la página del lote de ${place}`,
    remove: 'Quitar',
    removeLabel: (place) => `Quitar ${place} de la lista`,
    save: 'Guardar en mi lista',
    saveShort: 'Guardar',
    savedShort: 'Guardado',
    saveShortLabel: (place, list) => `Guardar ${place} en ${list}`,
    saveTo: (name) => `Guardar en ${name}`,
    saved: (name) => `Guardado en ${name}`,
    savedLabel: (name) => `Guardado en ${name}. Elija esto para quitarlo.`,
    added: (name) => `Guardado en "${name}". Las listas se quedan en este navegador.`,
    removed: (name) => `Quitado de "${name}".`,
    full: (limit) => `Esta lista está llena: una lista tiene como máximo ${formatNumber(limit)} lugares.`,
    tooMany: (limit) => `Este navegador guarda hasta ${formatNumber(limit)} listas. Borre una para crear otra.`,
    download: 'Descargar esta lista',
    importTitle: 'Abrir un archivo de lista',
    importHelp: 'Un archivo CSV o GeoJSON descargado de Placekeepers, o cualquier archivo de texto con números de parcela de nueve dígitos.',
    imported: (name, n) => `Se abrió "${name}" con ${plural(n, { one: '# lugar', other: '# lugares' })}.`,
    importFailed: 'Ese archivo no tiene números de parcela que podamos leer.',
    importTooBig: 'Ese archivo es demasiado grande para ser una lista.',
    importLeftOut: (n, limit) =>
      `${plural(n, { one: '# lugar quedó fuera', other: '# lugares quedaron fuera' })}: una lista tiene como máximo ${formatNumber(limit)}.`,
  },

  displacement: {
    // Word for word passage (docs/ETHICS.md, "Displacement").
    caution: 'El reverdecimiento puede subir los precios de los alrededores. Considere combinarlo con protecciones.',
    // Word for word passage (docs/ETHICS.md, "Displacement").
    placemakingCaution:
      'Los jardines, los lugares para sentarse y el arte nuevos pueden hacer que una cuadra sea más buscada y subir los precios y los alquileres de los alrededores. Combínelos con protecciones para los vecinos que alquilan o que están atrasados con los impuestos.',
    protections: 'Maneras de proteger a los vecinos',
    inWatch: (signs) =>
      `Este lugar está en una zona en observación por desplazamiento, con señales de que los precios están subiendo aquí: ${signs}.`,
    protectionsTitle: 'Protecciones para combinar con esto',
    jumpToWatch: 'Ver las señales de aquí y las maneras de proteger a los vecinos',
    jumpToProtections: 'Ver las maneras de proteger a los vecinos',
    listIntro:
      'Algunos de estos lugares están en zonas en observación por desplazamiento, con señales en los registros públicos de que los precios están subiendo allí. La tarjeta de cada uno nombra las señales de su zona.',
    printSeeAbove: 'Vea "Observación del desplazamiento" arriba.',
    protectionLabels: {
      neighborhood_gardens_trust: 'Neighborhood Gardens Trust',
      community_land_trust: 'Fideicomisos comunitarios de tierras',
      homestead_exemption: 'La exención por vivienda familiar (Homestead) de la Ciudad',
      longtime_owner_occupants: 'El Programa para Propietarios Ocupantes de Muchos Años (LOOP) de la Ciudad',
      tangled_title_help: 'Ayuda con un título entrecruzado',
    },
    checked: (date) => `revisado el ${date}`,
    signShort: {
      prices: 'precios de las casas que suben más rápido que en el resto de la ciudad',
      assessments: 'avalúos de la Ciudad que suben más rápido que en el resto de la ciudad',
      mva: 'el Análisis del Valor de Mercado de la Ciudad halla que los precios de las casas se alejan de lo que pueden pagar los residentes de muchos años',
      companies: 'empresas que compran muchas de las casas que se venden',
      renters: 'al menos tres de cada cinco casas alquiladas',
      rent_burden: 'muchos inquilinos que pagan la mitad de sus ingresos o más en alquiler',
    },
    heading: 'Señales de que los precios están subiendo aquí',
    areaTitle: (tract) => `Sector censal ${tract}`,
    around: (place) => `Alrededor de ${place}`,
    signsHere: 'Señales aquí',
    alsoMeasured: 'También se midió, pero no es una señal aquí',
    signTitle: {
      prices: 'Precios de venta de las casas',
      assessments: 'Los avalúos de la Ciudad',
      mva: 'El Análisis del Valor de Mercado de la Ciudad',
      companies: 'Compradores que son empresas',
      renters: 'Inquilinos',
      rent_burden: 'Inquilinos que pagan la mitad de sus ingresos o más en alquiler',
    },
    span: (a0, a1, b0, b1) => `ventas de ${a0} a ${a1} y de ${b0} a ${b1}`,
    pricesText: (p0, p1, change, city, span) =>
      `El precio mediano de las casas vendidas pasó de ${p0} a ${p1}: ${variacion(change)}${city === null ? '' : `, mientras que en toda la ciudad ${variacion(city)}`}${span ? ` (${span})` : ''}.`,
    companiesText: (share, sales, city) =>
      `Las empresas compraron ${share}% de las ${formatNumber(sales)} casas vendidas en los últimos tres años${city === null ? '' : `, frente a ${city}% en toda la ciudad`}.`,
    assessmentsText: (change, homes, city, years) =>
      `El valor de mercado de la casa mediana, según la Ciudad, ${variacion(change)}${years ? ` de ${years[0]} a ${years[1]}` : ''} (${plural(homes, { one: '# casa', other: '# casas' })})${city === null ? '' : `, mientras que en toda la ciudad ${variacion(city)}`}.`,
    rentersText: (share, city, years) =>
      `${share}% de las casas donde vive la gente aquí están alquiladas${city === null ? '' : `, frente a ${city}% en toda la ciudad`}${years ? ` (encuesta de la Oficina del Censo, ${years[0]} a ${years[1]})` : ''}.`,
    mvaText: (rising, groups, edition) => {
      const name = edition ? `el estudio "${edition}"` : 'el Análisis del Valor de Mercado';
      const blockGroups = plural(groups, { one: '# grupo de bloques censales', other: '# grupos de bloques censales' });
      return rising > 0
        ? `En ${rising} de ${blockGroups} de aquí, ${name} que The Reinvestment Fund hizo para la Ciudad halla una presión creciente: precios de casas que se alejan de lo que ganan los residentes de muchos años.`
        : `En ninguno de ${blockGroups} de aquí halla ${name} una presión creciente.`;
    },
    mvaNone: 'El Análisis del Valor de Mercado no cubre esta zona.',
    tooFewSales: (earlier, recent, needed) =>
      `Hay muy pocas ventas de casas para saberlo (${formatNumber(earlier)} y ${formatNumber(recent)}; se necesitan al menos ${formatNumber(needed)} en cada período).`,
    tooFewHomes: 'Hay muy pocas casas con valor en los dos años para saberlo.',
    tooFewHouseholds: 'Hay muy pocos hogares en la encuesta del Censo para saberlo.',
    rule: 'Una zona entra en la observación cuando se cumplen al menos dos de estas señales, y al menos una tiene que ver con los precios: precios de venta, avalúos o el Análisis del Valor de Mercado.',
    meaning:
      'El reverdecimiento y otras mejoras aquí pueden subir aún más los precios. Combínelos con protecciones para los vecinos que viven aquí ahora.',
    cannotTell:
      'Estas son señales en registros públicos, no un pronóstico. No pueden decir quién se ha mudado ni por qué, ni quién vive aquí; los números de la encuesta del Censo son un promedio de cinco años, así que no pueden decir cuánto son los alquileres hoy. Una zona fuera de la observación también puede sentir la subida de los precios.',
    contextTitle: 'Alquileres, ingresos y casas vacías aquí',
    contextIntro: (years) =>
      `De la encuesta de la Oficina del Censo${years ? `, ${years[0]} a ${years[1]}` : ''}. Contexto para los vecinos, no una señal: estos números no cambian ninguna zona.`,
    contextNoisy:
      'Son estimaciones de una encuesta a algunas casas durante cinco años, así que en una zona pequeña son aproximadas: el número verdadero probablemente está dentro del margen que se muestra (el margen de error de la Oficina del Censo, con 90 por ciento de confianza).',
    contextTitles: {
      rent: 'Alquiler mediano',
      income: 'Ingreso mediano del hogar',
      vacant: 'Casas vacías',
    },
    burdenText: (share, margin, households, city, years) =>
      `${share}% de los ${formatNumber(households)} hogares que alquilan aquí pagan la mitad de sus ingresos o más en alquiler y servicios${masOMenos(margin, 'points')}${city === null ? '' : `, frente a ${city}% en toda la ciudad`}${years ? ` (encuesta de la Oficina del Censo, ${years[0]} a ${years[1]})` : ''}. Las subidas del alquiler los golpean más fuerte.`,
    burdenTooFew: 'Hay muy pocos hogares que alquilan en la encuesta del Censo para saberlo.',
    rentText: (rent, margin, city) =>
      `${rent} al mes, con los servicios que paga el inquilino${margin ? ` (más o menos ${margin})` : ''}${city ? `, frente a ${city} en toda la ciudad` : ''}.`,
    rentNone: 'La encuesta del Censo tiene muy pocas respuestas aquí para dar un alquiler mediano.',
    incomeText: (income, margin, city) =>
      `${income} al año${margin ? ` (más o menos ${margin})` : ''}${city ? `, frente a ${city} en toda la ciudad` : ''}.`,
    incomeNone: 'La encuesta del Censo tiene muy pocas respuestas aquí para dar un ingreso mediano.',
    vacantText: (vacant, homes, share, margin, city) =>
      `${formatNumber(vacant)} de las ${formatNumber(homes)} casas de aquí, ${share}%${masOMenos(margin, 'points')}${city === null ? '' : `, frente a ${city}% en toda la ciudad`}.`,
    vacantTooFew: 'Hay muy pocas casas en la encuesta del Censo para saberlo.',
    whyEmpty: 'Por qué están vacías',
    whyRows: {
      vr: 'En alquiler',
      vs: 'En venta',
      vn: 'Alquiladas o vendidas, todavía sin mudarse nadie',
      vz: 'Para uso de temporada o de vez en cuando',
      vo: 'Fuera del mercado por otras razones, como reparaciones, problemas legales de una familia o abandono',
    },
    whyRow: (label, n, margin) => `${label}: ${formatNumber(n)}${masOMenos(margin, 'homes')}`,
    legendArea: 'Una zona con señales de que los precios están subiendo',
    legendTap: 'Toque dentro de una zona, o muy cerca de su borde, para ver sus señales.',
    legendNote:
      'Señales en registros públicos, no un pronóstico. Las tarjetas de reverdecimiento, jardines, asientos y arte en estas zonas agregan maneras de proteger a los vecinos.',
    exportColumn: (signs) => `Zona en observación por desplazamiento: ${signs}`,
    exportLine: (caution, links) =>
      `Sobre el reverdecimiento en zonas en observación por desplazamiento: ${caution} Maneras de proteger a los vecinos: ${links}`,
    placemakingExportLine: (caution, links) =>
      `Sobre jardines, asientos y arte en zonas en observación por desplazamiento: ${caution} Maneras de proteger a los vecinos: ${links}`,
    watchTitle: 'Observación del desplazamiento',
  },

  evidence: {
    strong: { label: 'Evidencia sólida', meaning: 'Un ensayo aleatorizado, de preferencia en Filadelfia, encontró el efecto.' },
    moderate: {
      label: 'Evidencia moderada',
      meaning: 'Comparaciones cuidadosas de antes y después, con zonas de control, encontraron el efecto.',
    },
    mixed: { label: 'Evidencia mixta', meaning: 'Buenos estudios no coinciden, o el efecto depende del contexto.' },
    weak: { label: 'Evidencia débil', meaning: 'Solo encuestas de percepción o correlaciones, o un estudio pequeño.' },
    not_violence: {
      label: 'No se trata de violencia',
      meaning: 'Valioso por otras razones. No se afirma nada sobre la violencia.',
    },
    context: {
      label: 'Contexto',
      meaning: 'Información de fondo que muestra dónde el cuidado puede ayudar más. No afirma qué funciona.',
    },
  },

  legend: {
    parcelsFill: 'Color de relleno: prioridad según su mezcla de lentes',
    parcelsFillLens: (lens) => `Color de relleno: prioridad según el lente de ${lens.toLowerCase()}`,
    parcelsSure: 'Contorno: qué tan seguros estamos de que está vacío',
    sureHigh: 'Muy probablemente vacío',
    sureMedium: 'Probablemente vacío',
    sureLow: 'No muy seguros',
    parcelPoint: 'Puntos: con el mapa alejado, una muestra de las parcelas vacías; de cerca, una parcela sin forma en el mapa',
    parcelsListed:
      'Solo se muestran las parcelas que las agencias de tierras de la Ciudad indican como disponibles. Una parcela que el mapa no considera vacía no se dibuja; el mapa propio del Land Bank las muestra todas.',
    selected: 'Lugar seleccionado',
    landcare: 'Lote mantenido por PHS LandCare: ya está cuidado',
    garden: 'Huerto o granja comunitaria',
    hin: 'Calle de la Red de Lesiones Graves',
    hexIntro: (window) => `Personas baleadas, por hexágono, ${window.toLowerCase()}`,
    hexNone: 'Los hexágonos sin tiroteos se dejan en blanco.',
    countBin: (lo, hi) =>
      hi === null ? `${formatNumber(lo)} o más` : lo === hi ? formatNumber(lo) : `${formatNumber(lo)} a ${formatNumber(hi)}`,
    segmentsFill: 'Color de la línea: puntaje de seguridad en la calle según su mezcla de lentes',
    segmentsShown: (min) =>
      min <= 1 ? 'Se muestra cada cuadra con un puntaje mayor que cero.' : `Se muestran las cuadras con ${formatNumber(min)} o más puntos de 100.`,
    segmentsZoom:
      'Con el mapa alejado, solo se dibujan las cuadras con daños registrados o en la Red de Lesiones Graves. Acerque el mapa para ver el resto.',
    crashSeverity: {
      3: 'Alguien murió',
      2: 'Alguien resultó gravemente herido',
      1: 'Alguien resultó herido',
      0: 'No se informó que nadie resultara herido',
    },
    crashesZoom: 'Acerque el mapa para ver choques en los que nadie resultó gravemente herido.',
    crashesSource: 'De los registros de choques de PennDOT, que llegan casi un año después de los choques.',
    memorial: 'Una persona que murió al caminar, andar en bicicleta o ir en un scooter',
    memorialEveryone: 'Una persona que murió en un choque de tránsito',
    memorialNames: 'Un anillo más lleno significa que una lista pública de memoriales comparte el nombre de la persona. Abra el marcador para leerlo.',
    memorialNamesWaiting: 'Todavía no se muestra ningún nombre. Aparecerán solo cuando las familias tengan una forma privada de pedir que se retire uno.',
    memorialNamesHidden: 'Los nombres están ocultos.',
    stopShelter: 'Un refugio, o toda la parada está bajo techo',
    stopBench: 'Un banco, pero ningún refugio en el mapa',
    stopNeither: 'Sin refugio ni banco',
    stopUnknown: 'Todavía sin revisar: OpenStreetMap aún no lo dice',
    stopSurvey: 'Cómo revisar una parada con StreetComplete',
    stopsCoverage: 'Aquí solo aparecen las paradas que alguien ha agregado a OpenStreetMap, así que muchas paradas todavía no se muestran.',
    stopSurveyRoute: 'Imprimir una hoja de revisión para toda una ruta',
  },

  streets: {
    popupLabel: 'Acerca de este lugar en el mapa',
    detailsTitle: (style) =>
      style === 'memorials'
        ? 'Memorial'
        : style === 'crashes'
          ? 'Choque'
          : style === 'street_segments'
            ? 'Cuadra'
            : style === 'transit_stops'
              ? 'Parada'
              : style === 'transit_routes'
                ? 'Ruta'
                : style === 'stop_amenities'
                  ? 'Refugio y banco'
                  : style === 'city_trees'
                    ? 'Árbol'
                    : style === 'amenity'
                      ? 'Tal como está en OpenStreetMap'
                      : style === 'public_place'
                        ? 'Lugar'
                        : style === 'condition'
                          ? 'Reportado al 311'
                          : style === 'public_art'
                            ? 'Arte público'
                            : style === 'traffic_stress'
                              ? 'Estrés del tráfico para bicicletas'
                              : style === 'parking_reports'
                                ? 'Problemas de estacionamiento reportados'
                                : style === 'city_shelters'
                                  ? 'Refugio de autobús'
                                  : style === 'street_poles'
                                    ? 'Poste de la calle'
                                    : style === 'traffic_calming'
                                      ? 'Medida para calmar el tránsito'
                                      : style === 'crossing_guards'
                                        ? 'Guardia de cruce escolar'
                                        : style === 'redlining'
                                          ? 'Mapa de redlining de 1937'
                                          : 'Detalles',
    memorialTitle: 'En memoria',
    peopleHere: (n) => plural(n, { one: '# persona es recordada aquí', other: '# personas son recordadas aquí' }),
    killed: {
      walk: 'Murió al caminar',
      bike: 'Murió al andar en bicicleta',
      scooter: 'Murió al ir en un scooter',
      motorcycle: 'Murió al ir en una motocicleta',
      other: 'Murió en un choque de tránsito',
    },
    killedOn: (what, date) => `${what} el ${date}.`,
    memorialSource: 'Leer el memorial público',
    blessing: 'Solo con la bendición de la familia.',
    families: 'Families for Safe Streets apoya a las familias después de un choque.',
    canDo: 'Lo que pueden hacer los vecinos aquí',
    firstStep: 'Primer paso',
    cost: (cost) => `Costo: ${cost}`,
    memorialsNearby: 'Memoriales cercanos',
    memorialsInView: 'Memoriales a la vista',
    memorialsIntro: 'Cada uno recuerda a una persona que murió en un choque de tránsito. Abra uno para leer más.',
    memorialCount: (n) => plural(n, { one: '# memorial', other: '# memoriales' }),
    memorialsMore: (n) =>
      `${plural(n, { one: '# memorial más está', other: '# memoriales más están' })} a la vista. Acerque el mapa para enumerarlos aquí.`,
    memorialsLayerOff: 'Active la capa Memoriales para enumerar los memoriales a la vista.',
    memorialsNone: 'No hay memoriales en esta parte del mapa.',
    blocksNearby: 'Cuadras cercanas',
    blocksInView: 'Cuadras a la vista',
    blocksIntro: 'Cada cuadra dibujada en el mapa, con su prioridad de seguridad en la calle y la razón principal. Abra una para leer por qué.',
    blockCount: (n) => plural(n, { one: '# cuadra', other: '# cuadras' }),
    blockNoScore: 'Sin puntaje de seguridad en la calle.',
    blocksMore: (n) =>
      `${plural(n, { one: '# cuadra más está', other: '# cuadras más están' })} a la vista. Acerque el mapa para enumerarlas aquí.`,
    blocksLayerOff: (layer) => `Active la capa "${layer}" para enumerar las cuadras a la vista.`,
    blocksNone: 'No hay cuadras dibujadas en esta parte del mapa.',
    crashesNearby: 'Choques cercanos',
    crashesInView: 'Choques a la vista',
    crashesIntro: 'De los registros de choques de PennDOT, según los ajustes de la capa de choques. Abra uno para leer más.',
    crashCount: (n) => plural(n, { one: '# choque', other: '# choques' }),
    crashesMore: (n) =>
      `${plural(n, { one: '# choque más está', other: '# choques más están' })} a la vista. Acerque el mapa para enumerarlos aquí.`,
    crashNear: (street) => `Cerca de ${street}`,
    crashesNone: 'No hay choques dibujados en esta parte del mapa.',
    removal: 'Pedir que se retire',
    removalNote: (hasEmail) =>
      hasEmail
        ? 'Cualquiera puede pedirnos que quitemos este memorial, por correo privado. Lo hacemos sin preguntar por qué.'
        : 'Cualquiera puede pedirnos que quitemos este memorial, sin dar una razón. Pronto habrá una dirección de correo privada para esto; mientras tanto, la página de Contacto explica cómo pedirlo en una incidencia de GitHub, que cualquiera puede leer.',
    crashTitle: (year) => `Choque en ${year}`,
    crashesHere: (n) => plural(n, { one: '# choque en este lugar', other: '# choques en este lugar' }),
    involved: 'Quiénes estaban involucrados',
    involvedModes: {
      walk: 'alguien caminando',
      bike: 'alguien en bicicleta',
      motorcycle: 'alguien en motocicleta',
      scooter: 'alguien en scooter',
    },
    involvedOthers: 'personas en autos u otros vehículos',
    crashSource: 'De los registros de choques de PennDOT.',
    segmentScore: (score, lens) => `${lens}: ${score} de 100 según su mezcla de lentes`,
    segmentNoScore: 'Sin puntaje de seguridad en la calle para esta cuadra.',
    onHin: 'En la Red de Lesiones Graves',
    ksi: (n) =>
      `${plural(n, { one: '# persona murió o resultó gravemente herida', other: '# personas murieron o resultaron gravemente heridas' })} al caminar o andar en bicicleta en esta cuadra o en sus esquinas, en los últimos cinco años de registros de PennDOT`,
    noKsi: 'Ninguna persona registrada como muerta o gravemente herida al caminar o andar en bicicleta aquí en los últimos cinco años de registros de PennDOT',
    killed2: (n) => `${plural(n, { one: '# persona murió', other: '# personas murieron' })} aquí en los últimos dos años`,
    school: 'Una escuela a 400 metros o menos',
  },

  streetsStops: {
    shelterLegend: 'Un refugio de la lista de la Ciudad, como un anillo alrededor de su parada',
    shelterLegendLens: 'Una parada con un refugio de la Ciudad cuenta como protegida en el lente de comodidad del transporte público.',
    shelterLegendDate: 'La Ciudad cambió su lista por última vez en enero de 2025, así que puede faltar un refugio que se haya puesto o quitado desde entonces.',
    shelterTitle: 'Un refugio de autobús de la lista de la Ciudad',
    shelterAt: (stop) => `Sirve a la parada de SEPTA ${stop}.`,
    shelterListed: (number) => `La Ciudad lo incluye con el número de parada ${number}.`,
    shelterByNumber: 'Se relacionó con la parada de SEPTA por el número de parada de la lista de la Ciudad.',
    shelterByPlace: 'Se relacionó con la parada de SEPTA más cercana, a 15 metros o menos: la lista de la Ciudad no da ningún número de parada que coincida.',
    shelterNoStop: 'No encontramos ninguna parada de SEPTA a la que sirva: está a más de 15 metros de cada parada, o su parada cerró.',
    shelterDigital: 'Su panel de publicidad es una pantalla digital.',
    shelterLens: 'La parada a la que sirve cuenta como protegida en el lente de comodidad del transporte público.',
    shelterPartner: 'La Ciudad instala y mantiene estos refugios con su socio de publicidad, y la publicidad los paga.',
    shelterSource: 'De la lista de refugios de autobús de la Ciudad (Oficina de Transporte y Sistemas de Infraestructura, OTIS).',
    sheltersHere: (n) => plural(n, { one: '# refugio en este lugar', other: '# refugios en este lugar' }),

    poleLed: 'Una lámpara LED que la Ciudad incluye en su lista',
    poleOther: 'Una lámpara más vieja de vapor de sodio de alta presión',
    poleUnknown: 'Una lámpara de un tipo que la Ciudad no nombra',
    poleNone: 'Un poste sin lámpara en la lista, como un poste de semáforo o de servicios',
    polesNote: 'Las lámparas que la Ciudad incluye en su lista, no si una lámpara funciona esta noche. Reporte una luz apagada a Philly311.',
    polesZoom: 'Acerque el mapa a unas pocas cuadras para ver los postes.',
    poleTitle: (number) => (number ? `Poste de la calle ${number}` : 'Un poste de la calle sin número en la lista'),
    poleKind: {
      0: 'La Ciudad no incluye ninguna lámpara en este poste.',
      1: 'La Ciudad incluye una lámpara LED en este poste.',
      2: 'La Ciudad incluye una lámpara más vieja de vapor de sodio de alta presión en este poste.',
      3: 'La Ciudad incluye una lámpara en este poste, pero no dice de qué tipo.',
    },
    poleOwner: {
      1: 'El poste es del Departamento de Calles de la Ciudad.',
      2: 'El poste es de PECO.',
      3: 'El poste es de PennDOT.',
      4: 'El poste es de alguien que no es la Ciudad, PECO ni PennDOT.',
    },
    poleReport: (number) => `Si una luz de aquí está apagada, dígale a Philly311 el número del poste, ${number}.`,
    poleReportNoNumber: 'Si una luz de aquí está apagada, dígale a Philly311 dónde está.',
    polesHere: (n) => plural(n, { one: '# poste en este lugar', other: '# postes en este lugar' }),
    poleSource: 'De la lista de postes de la calle del Departamento de Calles, que se actualiza cada semana.',

    calmingLegend: 'Un reductor de velocidad (cojín, lomo o mesa)',
    calmingLegendNote: 'Los vecinos pueden pedirle a la Ciudad medidas para calmar el tránsito en una calle residencial.',
    zoomStreets: 'Acerque el mapa a unos pocos vecindarios para verlos.',
    calmingTitle: 'Medidas para calmar el tránsito',
    calmingWhat: 'Un reductor de velocidad (cojín, lomo o mesa) que el Departamento de Calles incluye en su lista, para que los conductores vayan más despacio.',
    calmingOn: (street) => `En ${street}`,
    calmingSince: (date) => `Se puso el ${date}.`,
    calmingHere: (n) => plural(n, { one: '# dispositivo en este lugar', other: '# dispositivos en este lugar' }),
    calmingSource: 'De la lista de dispositivos para calmar el tránsito del Departamento de Calles.',

    guardLegend: 'Una esquina donde la Ciudad pone a un guardia de cruce escolar',
    guardLegendNote:
      'Los guardias de cruce ayudan a los niños y a todos los demás a cruzar cerca de las escuelas al comienzo y al final del día escolar.',
    guardTitle: 'Guardia de cruce escolar',
    guardHere: 'La Ciudad pone a un guardia de cruce escolar en esta esquina.',
    guardSchool: (school) => `La escuela más cercana de la lista de la Ciudad, a 400 metros o menos: ${school}.`,
    guardWhat:
      'Los guardias de cruce ayudan a los niños y a todos los demás a cruzar con seguridad cerca de las escuelas al comienzo y al final del día escolar.',
    guardsHere: (n) => plural(n, { one: '# puesto en este lugar', other: '# puestos en este lugar' }),
    guardSource: 'De la lista de lugares de guardias de cruce escolar de la Ciudad.',

    blockPoles: (poles, lamps, led) =>
      lamps === 0
        ? `La Ciudad incluye ${plural(poles, { one: '# poste', other: '# postes' })} a lo largo de esta cuadra, sin ninguna lámpara en la lista.`
        : `La Ciudad incluye ${plural(poles, { one: '# poste', other: '# postes' })} a lo largo de esta cuadra: ${formatNumber(lamps)} con lámpara, ${led === lamps ? (lamps === 1 ? 'que es LED' : 'todas ellas LED') : `${formatNumber(led)} de ellas LED`}.`,
    blockNoPoles: 'La Ciudad no incluye ningún poste de la calle a lo largo de esta cuadra.',
    blockCalming: (n, year) =>
      year
        ? `Medidas para calmar el tránsito aquí desde ${year}: la Ciudad incluye ${plural(n, { one: '# reductor de velocidad (cojín, lomo o mesa)', other: '# reductores de velocidad (cojines, lomos o mesas)' })} en esta cuadra.`
        : `La Ciudad incluye ${plural(n, { one: '# reductor de velocidad (cojín, lomo o mesa)', other: '# reductores de velocidad (cojines, lomos o mesas)' })} en esta cuadra.`,
    blockNoCalming: 'Todavía no hay medidas para calmar el tránsito registradas aquí.',
    blockArterial:
      'Los reductores de velocidad de la Ciudad son para calles residenciales. En una calle como esta, pregunte a la Oficina de Transporte y Sistemas de Infraestructura de la Ciudad por otros cambios.',
    memorialCalming: (n, year) =>
      year
        ? `Medidas para calmar el tránsito en esta cuadra desde ${year}: la Ciudad incluye ${plural(n, { one: '# dispositivo', other: '# dispositivos' })}.`
        : `La Ciudad incluye ${plural(n, { one: '# dispositivo para calmar el tránsito', other: '# dispositivos para calmar el tránsito' })} en esta cuadra.`,
    memorialNoCalming: 'Todavía no hay medidas para calmar el tránsito registradas en esta cuadra.',
    lightsPoles: (poles, lamps, led) =>
      lamps === 0
        ? `La Ciudad incluye ${plural(poles, { one: '# poste', other: '# postes' })} a lo largo de esta cuadra, sin ninguna lámpara en la lista.`
        : `A lo largo de esta cuadra, la Ciudad incluye ${plural(lamps, { one: '# poste con lámpara', other: '# postes con lámpara' })}, ${led === lamps ? (lamps === 1 ? 'LED' : 'todos LED') : `${formatNumber(led)} de ellos LED`}. Active "Postes de la calle y las lámparas que la Ciudad incluye en su lista" y acerque el mapa para encontrar el número de cada poste.`,
    stopLamps: (lamps, led) =>
      lamps === 0
        ? 'La Ciudad no incluye ningún poste con lámpara a 30 metros o menos de esta parada.'
        : `La Ciudad incluye ${plural(lamps, { one: '# poste con lámpara', other: '# postes con lámpara' })} a 30 metros o menos de esta parada, ${led === lamps ? (lamps === 1 ? 'LED' : 'todos LED') : `${formatNumber(led)} de ellos LED`}.`,
    cityShelter: (n) =>
      n === 1
        ? 'La lista de refugios de autobús de la Ciudad tiene un refugio aquí.'
        : `La lista de refugios de autobús de la Ciudad tiene ${formatNumber(n)} refugios aquí.`,
    noCityShelter:
      'No hay refugio aquí en la lista de refugios de autobús de la Ciudad, que incluye los refugios que maneja con su socio de publicidad.',
    disagree:
      'La lista de la Ciudad tiene un refugio aquí, pero OpenStreetMap dice que no hay ninguno. Uno de los dos puede estar desactualizado: una revisión en persona lo aclara. Mientras tanto, la prioridad cuenta el refugio de la Ciudad.',
    cityShelterLens: 'La prioridad cuenta el refugio de la Ciudad.',
    answerCityShelter: 'Todavía sin revisar en OpenStreetMap, pero en la lista de la Ciudad',
  },

  parking: {
    kinds: {
      all: 'Vehículos que bloquean el paso',
      sidewalk: 'En una acera',
      bike_lane: 'En un carril para bicicletas',
      crosswalk: 'En un cruce peatonal',
      corner: 'En una esquina',
      ramp: 'Bloqueando una rampa de la acera',
    },
    window: (start, end) => `De ${start} a ${end}`,
    windowUnknown: 'En 12 meses',
    heatTitle: (window) => `Con el mapa alejado: dónde se juntan los reportes. ${window}.`,
    fewer: 'Menos reportes',
    more: 'Más reportes',
    binsTitle: 'De cerca: reportes en cada zona de aproximadamente una cuadra de ancho',
    bins: (low, high) => (high === null ? `${formatNumber(low)} o más` : `${formatNumber(low)} a ${formatNumber(high)}`),
    threshold: (min) =>
      `Las zonas con menos de ${min} reportes se dejan fuera, para que no se vea ningún reporte individual. Acerque el mapa y toque una zona para ver sus cifras.`,
    oneApp:
      'Dónde las personas que usan una sola aplicación, Laser Vision de Philly Bike Action, reportaron vehículos en el camino. No todos los problemas se reportan.',
    title: 'Esta zona, de aproximadamente una cuadra de ancho',
    summary: (n, window) => `${plural(n, { one: '# reporte', other: '# reportes' })} de vehículos que bloquean el paso. ${window}.`,
    count: (n) => formatNumber(n),
    fewerThan: (min) => `menos de ${min}`,
    byKind: 'Por tipo',
    meaning:
      'Son reportes de personas que usan una sola aplicación, así que muestran dónde esas personas notaron vehículos en el camino, no todos los problemas. Un tipo con menos de 5 reportes aquí no se da como número, para que no se vea ningún reporte individual.',
    fixes:
      'Muchos reportes en un mismo lugar son evidencia a favor de arreglos físicos: extensiones de la acera, bolardos, esquinas despejadas, carriles protegidos para bicicletas y zonas de carga.',
    askCity: 'Preguntar a la Ciudad por un arreglo',
    source: 'Del mapa Laser Vision de Philly Bike Action',
    refreshed: 'Se cuenta de nuevo cada semana, con permiso de Philly Bike Action.',
  },

  transit: {
    waitTitle: 'Cada cuánto pasa un autobús o tren al mediodía en días de semana',
    waitBins: [
      'Cada 10 minutos o menos',
      'Cada 11 a 15 minutos',
      'Cada 16 a 30 minutos',
      'Cada 31 a 60 minutos',
      'Menos de una vez por hora',
    ],
    noMidday: 'Sin servicio de 10 a 2 en días de semana',
    boardingsTitle: 'Personas que suben aquí en un día de semana promedio',
    boardingBins: ['1,000 o más', '200 a 999', '50 a 199', '10 a 49', 'Menos de 10'],
    noCount: 'Sin conteo de SEPTA para esta parada',
    boardingsNote: 'De los conteos propios de SEPTA, que van una o dos temporadas detrás de los horarios.',
    station: 'Estación de metro, de El o de Regional Rail',
    zoomNote: 'Acerque el mapa a unos pocos vecindarios para ver las paradas.',
    lensTitle: 'Prioridad según el lente de comodidad del transporte público',
    lensUnsurveyed: 'Donde nadie ha revisado todavía una parada, su refugio y su banco cuentan a medias.',
    lensCityShelter: 'Una parada con un refugio en la lista de la Ciudad cuenta como protegida.',
    lensStations: 'El lente califica solo las paradas de autobús y tranvía, así que las estaciones aparecen huecas.',
    lensTunnel:
      'Las paradas de tranvía del túnel bajo Center City y University City también aparecen huecas: el lente las deja fuera, igual que a las estaciones.',
    findTitle: 'Lo que encuentran los pasajeros aquí',
    notInOsm: 'Todavía no encontramos una parada que coincida en OpenStreetMap, así que nadie ha registrado si tiene refugio o banco.',
    matchedByNumber: 'Se relacionó con la parada de OpenStreetMap que tiene el mismo número de parada, en el mismo lugar.',
    matchedByPlace: 'Se relacionó con la parada de OpenStreetMap que está en el mismo lugar, a 15 metros o menos.',
    halfway: 'Las respuestas "todavía sin revisar" cuentan a medias (50 de 100) en el puntaje hasta que alguien las registre.',
    canopy: (percent) =>
      `Las copas de los árboles cubren más o menos ${formatNumber(percent)} por ciento del terreno alrededor de la parada, en una zona de unas dos cuadras de ancho (el estudio de la Ciudad sobre las copas de los árboles de 2018).`,
    onHin: 'La parada está en la Red de Lesiones Graves, las calles donde ocurren la mayoría de las muertes y lesiones graves de tránsito en Filadelfia.',
    noScore: 'El lente de comodidad del transporte público califica solo las paradas de autobús y tranvía.',
    tunnelStation:
      'Esta parada de tranvía es subterránea, en el túnel, así que el lente de comodidad del transporte público la deja fuera, igual que a las estaciones de metro y de tren.',
    answersLoading: 'Cargando lo que dice OpenStreetMap sobre esta parada.',
    answersUnavailable:
      'Ahora no se pudo cargar lo que dice OpenStreetMap sobre esta parada, así que su refugio y su banco cuentan como todavía sin revisar.',
    canDo: 'Lo que pueden hacer los vecinos aquí',
    routeDetails: 'Pasos, contactos y enlaces',
    surveyGuide: 'Cómo revisar una parada con StreetComplete',
    osmSource: 'Refugio, banco y luz de OpenStreetMap, © OpenStreetMap contributors, actualizado cada semana.',
    routeBus: 'Ruta de autobús',
    routeTrolley: 'Ruta de tranvía',
    routeMetro: 'Metro o El',
    routeRail: 'Regional Rail',
    allRoutes: 'Donde varias rutas comparten una calle, sus líneas se superponen.',
    frequentRoutes: 'Solo rutas con un autobús o tren cada 15 minutos o menos al mediodía en días de semana.',
    detailsTitle: 'Parada',
    stationName: (name) => `Estación ${name}`,
    stopsHere: (n) => plural(n, { one: '# parada en este lugar', other: '# paradas en este lugar' }),
    kinds: {
      bus: 'Parada de autobús',
      trolley: 'Parada de tranvía',
      busTrolley: 'Parada de autobús y tranvía',
      metro: 'Estación de metro o El',
      rail: 'Estación de Regional Rail',
    },
    vehicles: { bus: 'autobús', trolley: 'tranvía', busTrolley: 'autobús o tranvía', train: 'tren' },
    vehiclesMany: { bus: 'autobuses', trolley: 'tranvías', busTrolley: 'autobuses o tranvías', train: 'trenes' },
    routes: (list) => `Rutas: ${list}.`,
    route: (name) => `Ruta ${name}.`,
    howOften: 'Cada cuánto pasa',
    every: (vehicle, minutes) =>
      minutes <= 1 ? `un ${vehicle} más o menos cada minuto` : `un ${vehicle} más o menos cada ${formatNumber(minutes)} minutos`,
    only: (one, many, n) => (n === 1 ? `solo un ${one}` : `solo ${formatNumber(n)} ${many}`),
    peak: (text) => `Mañanas de días de semana de 7 a 9: ${text}.`,
    midday: (day, text) => `${day} de 10 a 2: ${text}.`,
    noService: (day) => `${day} de 10 a 2: ninguno.`,
    days: { wk: 'Días de semana', sa: 'Sábados', su: 'Domingos' },
    trips: (wk, sa, su) =>
      `${plural(wk, { one: '# salida', other: '# salidas' })} en un día de semana típico, ${formatNumber(sa)} los sábados y ${formatNumber(su)} los domingos.`,
    busiest: (n) => `Hora más ocupada en días de semana: ${plural(n, { one: '# salida', other: '# salidas' })}.`,
    firstLast: (first, last) => `En días de semana la primera sale a las ${first} y la última a las ${last}.`,
    afterMidnight: (time) => `${time} después de medianoche`,
    allNight: 'El servicio funciona toda la noche en días de semana.',
    evening: (n) =>
      n === 0
        ? 'No hay salidas después de las 8 de la noche en días de semana.'
        : `Después de las 8 de la noche en días de semana: ${plural(n, { one: '# salida', other: '# salidas' })}.`,
    noWeekday: 'No hay servicio en días de semana.',
    riders: 'Pasajeros',
    boardings: (n, period) =>
      n === 0
        ? `Casi nadie sube aquí en un día de semana promedio (conteo de SEPTA, ${period}).`
        : `Aproximadamente ${plural(n, { one: '# persona sube', other: '# personas suben' })} aquí en un día de semana promedio (conteo de SEPTA, ${period}).`,
    countedAt: (id) => `Se contó en la parada ${id} de SEPTA, a la que esta parada reemplazó.`,
    noBoardings:
      'SEPTA todavía no tiene un conteo para esta parada. Las paradas nuevas y las que cambiaron de número reciben uno cuando SEPTA publica su próximo conteo.',
    noStationCounts: 'SEPTA no publica conteos de cada andén del metro o del El.',
    noRailCounts: 'SEPTA cuenta a los pasajeros de Regional Rail por estación una vez al año; este mapa todavía no muestra esos conteos.',
    stopNumber: (id) => `Número de parada de SEPTA: ${id}.`,
    formerNumbers: (ids) => `Antes era la parada ${ids} de SEPTA.`,
    wheelchair: {
      1: 'SEPTA indica que se puede llegar a esta parada en silla de ruedas.',
      2: 'SEPTA indica que no se puede llegar a esta parada en silla de ruedas.',
    },
    source: 'De los horarios de SEPTA para una semana típica. Las esperas son promedios: los autobuses se juntan y los intervalos se alargan.',
  },

  stopAmenities: {
    unnamed: 'Una parada sin nombre en OpenStreetMap',
    number: (ref) => `Parada número ${ref}`,
    served: { 1: 'Parada de autobús', 2: 'Parada de tranvía', 3: 'Parada de autobús y tranvía' },
    comfort: {
      3: 'Un refugio, o toda la parada está bajo techo',
      2: 'Un banco, pero ningún refugio en el mapa',
      1: 'Sin refugio ni banco',
      0: 'Todavía sin revisar',
    },
    factsTitle: 'Lo que dice OpenStreetMap',
    answers: {
      sh: 'Refugio',
      bn: 'Banco',
      bi: 'Cesto de basura',
      lt: 'Con luz de noche',
      tp: 'Pavimento táctil para personas ciegas',
      wc: 'Acceso en silla de ruedas',
      db: 'Tablero de salidas',
      cv: 'Toda la parada bajo techo',
    },
    yes: 'Sí',
    no: 'No',
    limited: 'Limitado',
    unknown: 'Todavía sin revisar',
    nearby: 'mapeado por separado junto a la parada',
    unknownNote: '"Todavía sin revisar" significa que nadie lo ha registrado aún. No significa que la parada no tenga nada.',
    survey: 'Cómo revisar esta parada con StreetComplete',
    openOsm: 'Ver esta parada en OpenStreetMap',
    surveyRoute: 'Revisar una ruta completa con una hoja imprimible',
    source: 'De OpenStreetMap, © OpenStreetMap contributors, actualizado cada semana.',
  },

  heat: {
    tractsTitle: {
      vulnerability: 'Vulnerabilidad al calor: el calor y las personas en riesgo, por sector censal',
      exposure: 'Exposición al calor: qué tanto calor hace en cada sector censal en verano',
      sensitivity: 'Sensibilidad al calor: cuántas personas de cada sector censal están en riesgo con el calor',
    },
    fifths: {
      vulnerability: ['Quinto de sectores menos vulnerable', 'Menos vulnerable', 'Quinto del medio', 'Más vulnerable', 'Quinto más vulnerable'],
      exposure: ['Quinto de sectores más fresco', 'Más fresco', 'Quinto del medio', 'Más caluroso', 'Quinto más caluroso'],
      sensitivity: ['Quinto con menos personas en riesgo', 'Menos', 'Quinto del medio', 'Más', 'Quinto con más personas en riesgo'],
    },
    priority: 'Con contorno: sectores que la Ciudad califica con una vulnerabilidad al calor muy alta',
    tractsNone: 'Los sectores que el índice no incluye, como los parques grandes y el aeropuerto, se dejan en blanco.',
    tractsSource:
      'Del Índice de Vulnerabilidad al Calor de la Ciudad (Departamento de Salud Pública y Oficina de Sostenibilidad), datos de 2017 a 2019.',
    treeBig: 'Un árbol de la Ciudad: cuanto más grande el punto, más ancho su tronco',
    treeSmall: 'Un árbol pequeño, a menudo joven y que necesita riego',
    treesZoom: 'Acerque el mapa a unas pocas cuadras para ver los árboles.',
    treesYards: 'Los árboles de patios privados no están en el inventario de la Ciudad, así que una cuadra puede tener más sombra de la que parece aquí.',
    floodHigh: 'La llanura aluvial con 1 por ciento de probabilidad anual: una inundación tiene al menos 1 probabilidad en 100 cada año',
    floodway: 'El cauce de crecida: el canal que se mantiene abierto para que pasen las inundaciones',
    floodModerate: 'La zona con 0.2 por ciento de probabilidad anual: 1 probabilidad en 500 cada año',
    floodCare:
      'Una razón para tener cuidado, nunca parte de un puntaje: allí las plantas deben aguantar el suelo mojado, y todo lo que se construya sigue las reglas de la Ciudad para llanuras aluviales.',
    treeUnnamed: 'Un árbol que el inventario no nombra',
    treeTrunk: (inches) => `Su tronco mide unas ${formatNumber(inches)} pulgadas de ancho a la altura del pecho.`,
    treeNoTrunk: 'El inventario no da el tamaño de su tronco.',
    treeYoung: 'Un árbol joven necesita unos 20 galones de agua por semana de marzo a diciembre, según TreePhilly.',
    treesHere: (n) => plural(n, { one: '# árbol en este lugar', other: '# árboles en este lugar' }),
    treeSource: 'Del inventario de árboles de Parques y Recreación, los árboles que la Ciudad cuida en sus calles y parques.',
  },

  art: {
    legend: {
      mural: 'Murales y pinturas de pared',
      sculpture: 'Esculturas y estatuas',
      mosaic: 'Mosaicos',
      other: 'Otros tipos: instalaciones, fuentes, monumentos y más',
    },
    allOff: 'Todos los tipos de arte están apagados en los ajustes de esta capa.',
    insideHidden: 'Las obras dentro de edificios están ocultas.',
    memorialNote: 'Las obras de arte que recuerdan a alguien se muestran sin nombres.',
    coverage:
      'De la lista de Percent for Art de la Ciudad, OpenStreetMap y Wikidata. Muchos murales todavía no están en ellas; Mural Arts Philadelphia mantiene la lista más grande en su propio sitio.',
    kinds: {
      0: 'Una obra de arte público',
      1: 'Un mural',
      2: 'Una pintura',
      3: 'Arte callejero',
      4: 'Un mosaico',
      5: 'Una escultura',
      6: 'Una estatua',
      7: 'Un busto',
      8: 'Un relieve',
      9: 'Una instalación',
      10: 'Una fuente',
      11: 'Un monumento',
      12: 'Un memorial',
      13: 'Un vitral',
      14: 'Una placa',
    },
    untitled: 'No hay un título registrado.',
    by: (artist) => `Obra de ${artist}.`,
    made: (year) => `Hecha en ${year}.`,
    medium: (medium) => `Hecha de: ${medium}.`,
    where: (place) => `Dónde: ${place}.`,
    inside: 'Dentro de un edificio, así que solo se puede ver cuando el edificio está abierto.',
    memorialTitle: 'Obra de arte conmemorativa',
    memorialText:
      'Esta obra de arte recuerda a alguien. Placekeepers no muestra nombres en los memoriales; las fuentes de abajo dicen más.',
    worksHere: (n) => plural(n, { one: '# obra de arte en este lugar', other: '# obras de arte en este lugar' }),
    sourcesTitle: 'Fuentes',
    cityRecord: 'El registro de la Ciudad de esta obra (PDF)',
    cityList: 'La lista Percent for Art de la Ciudad',
    openOsm: 'Verla en OpenStreetMap',
    openWikidata: 'Verla en Wikidata',
    openWikipedia: 'Leer sobre ella en Wikipedia',
    website: (site) => `Más sobre ella en ${site}`,
    siteNames: {
      'associationforpublicart.org': 'el sitio de la Association for Public Art',
      'muralarts.org': 'el sitio de Mural Arts Philadelphia',
      'philart.net': 'philart.net',
    },
    muralArts: 'Buscar en la lista propia de murales de Mural Arts Philadelphia',
    fix: '¿Falta algo o está mal? Agréguelo o corríjalo en OpenStreetMap; los cambios llegan a este mapa en más o menos una semana.',
    fixLink: 'Editar en OpenStreetMap',
    credit: 'Arte público de la Ciudad de Filadelfia, OpenStreetMap (© OpenStreetMap contributors) y Wikidata.',
  },

  survey: {
    pageTitle: 'Revisar una ruta',
    intro:
      'Elija una ruta de autobús o tranvía de SEPTA y una dirección para obtener una hoja de revisión: sus paradas en Filadelfia en orden, lo que OpenStreetMap muestra ahora en cada una y casillas para llenar. Imprímala, o marque las casillas en su teléfono mientras camina.',
    guideLink: 'Cómo revisar paradas de autobús',
    loading: 'Cargando las rutas…',
    loadFailed: 'No se pudo cargar la lista de rutas. Revise su conexión e inténtelo de nuevo.',
    notPublished: 'Las hojas de revisión todavía no se han publicado. Aparecen después de la próxima actualización semanal.',
    sheetFailed: 'No se pudo cargar la hoja de esta ruta. Revise su conexión e inténtelo de nuevo.',
    retry: 'Intentar de nuevo',
    routeLabel: 'Ruta',
    routePlaceholder: 'Elija una ruta',
    buses: 'Rutas de autobús',
    trolleys: 'Rutas de tranvía',
    directionLabel: 'Dirección',
    partsLabel: 'Dividir entre',
    partsChoice: (n) => (n === 1 ? 'una persona o pareja' : `${n} personas o parejas`),
    directionTo: (dir, to) => `${dir} a ${to}`,
    towards: (to) => `Hacia ${to}`,
    directionNumber: (n) => `Dirección ${n}`,
    stopCount: (n) => plural(n, { one: '# parada', other: '# paradas' }),
    title: (route, direction) => `Ruta ${route}, ${direction}`,
    summary: (stops, miles) => `${plural(stops, { one: '# parada', other: '# paradas' })} en Filadelfia, ${miles} de la primera a la última en línea recta.`,
    outside: (n) => `${plural(n, { one: '# parada más está', other: '# paradas más están' })} fuera de Filadelfia y no aparecen en esta hoja.`,
    answersMissing:
      'Ahora no se pudo cargar lo que dice OpenStreetMap sobre estas paradas, así que las paradas que conoce aparecen como todavía sin revisar.',
    statusTitle: 'Lo que muestra OpenStreetMap ahora',
    status: {
      shelter: 'Refugio',
      bench: 'Solo banco',
      neither: 'Ninguno',
      unsurveyed: 'Todavía sin revisar',
      missing: 'No se encontró en OpenStreetMap',
    },
    statusLong: {
      shelter: 'con un refugio o techo',
      bench: 'con un banco pero sin refugio en el mapa',
      neither: 'sin ninguno de los dos',
      unsurveyed: 'en OpenStreetMap pero todavía sin revisar',
      missing: 'no se encontró en OpenStreetMap',
    },
    estimateTitle: 'Cuánto tarda',
    estimate: (time) => `Nuestro cálculo: ${time} para una persona o pareja.`,
    estimateBasis:
      'Es un cálculo propio, no una medición: caminar unas 3 millas por hora de parada en parada, y alrededor de un minuto en cada parada. Llegar a la primera parada y volver a casa es aparte.',
    trolleyTunnel:
      'Las rutas de tranvía T1 a T5 van bajo tierra en su extremo de Center City, en un túnel con estaciones desde la calle 13 hasta la calle 37. Deje fuera esas estaciones: esta revisión es para paradas en la calle.',
    asOf: (osm, schedules) =>
      [
        osm ? `Lo que muestra OpenStreetMap es del ${osm}.` : null,
        schedules ? `Las paradas son de los horarios de SEPTA (${schedules}).` : null,
      ]
        .filter(Boolean)
        .join(' '),
    print: 'Imprimir la hoja',
    printAll: 'Imprimir todas las partes',
    printPart: (n) => `Imprimir solo la parte ${n}`,
    part: (n, of) => `Parte ${n} de ${of}`,
    partStops: (first, last) => (first === last ? `parada ${first}` : `paradas ${first} a ${last}`),
    partEstimate: (time, miles) => `Nuestro cálculo: ${time} (${miles} de caminata).`,
    sheetFor: (route, direction) => `Hoja de revisión: ruta ${route}, ${direction}`,
    howToFill:
      'Marque S o N por cada cosa que encuentre en la parada. "Con luz" quiere decir que una luz alumbra la parada de noche: una lámpara en el refugio o un farol de la calle justo al lado. "Necesita reparación" quiere decir un refugio, banco, letrero o cesto de basura roto. Si no puede saberlo, deje la casilla vacía: por favor, nunca adivine.',
    nameLine: 'Nombre:',
    dateLine: 'Fecha:',
    columns: {
      number: '#',
      stop: 'Parada',
      now: 'OpenStreetMap ahora',
      sh: 'Refugio',
      bn: 'Banco',
      bi: 'Cesto de basura',
      lt: 'Con luz',
      rp: 'Necesita reparación',
      nt: 'Notas',
    },
    yes: 'Sí',
    no: 'No',
    yesShort: 'S',
    noShort: 'N',
    stopNumber: (sid) => `Parada ${sid} de SEPTA`,
    answerLabel: (n, name, question, answer) => `Parada ${n}, ${name}: ${question}, ${answer}`,
    repairLabel: (n, name) => `Parada ${n}, ${name}: necesita reparación`,
    notesLabel: (n, name) => `Parada ${n}, ${name}: notas`,
    openOsm: 'Ver en OpenStreetMap',
    editOsm: 'Editar',
    answered: (n, of) => `Ha llenado ${formatNumber(n)} de ${plural(of, { one: '# parada', other: '# paradas' })} en este dispositivo.`,
    kept: 'Lo que marque y escriba aquí se queda en este navegador, solo en este dispositivo. No se envía nada a ningún lado.',
    notKept:
      'Este navegador no está guardando lo que usted marca, así que se perderá si sale de la página. Imprima la hoja o anótelo.',
    clear: 'Borrar lo que llené',
    clearConfirm: '¿Borrar cada casilla y nota que llenó para esta dirección?',
    safetyTitle: 'Antes de salir: cuídese',
    safety: [
      'Quédese en la acera. Nunca se pare en la calle ni entre a un carril de autobús para mirar una parada.',
      'Vaya de día y con un amigo o una amiga.',
      'Deje de caminar antes de mirar esta hoja o su teléfono, y mire hacia arriba antes de cruzar.',
      'Hágase a un lado para que los pasajeros puedan esperar y subir. No fotografíe a las personas.',
    ],
    answersTitle: 'Cómo llevar sus respuestas a OpenStreetMap',
    withApp:
      'Con la aplicación StreetComplete: responda sus preguntas sobre cada parada mientras está allí. Sus respuestas van directo a OpenStreetMap.',
    withoutApp: 'Sin una aplicación en el teléfono, en una computadora de regreso en casa, use el editor propio de OpenStreetMap:',
    editorSteps: [
      'Inicie sesión en openstreetmap.org. Una cuenta es gratuita.',
      'Abra esta página otra vez y use el enlace "Editar" junto a cada parada. El editor se abre con la parada seleccionada.',
      'En el panel de la izquierda, haga clic en la casilla del refugio (Shelter). Debajo de "Add field:" (agregar campo) agregue Banco (Bench), Cesto de basura (Waste Bin) y Con luz (Lit), y haga clic también en sus casillas. Cada casilla cambia con cada clic: Sí (Yes), luego No, y de vuelta a Desconocido (Unknown).',
      'Haga clic en Save (guardar), escriba una nota corta sobre lo que hizo, como "Surveyed bus stop shelters and benches", y haga clic en Upload (subir).',
    ],
    notFound:
      'Donde la hoja dice "No se encontró en OpenStreetMap", mire con atención alrededor de la parada en el editor primero: puede estar dibujada a unos pasos. Si de verdad falta, haga clic en Point (punto), ponga el punto en la acera junto al letrero de la parada y elija Bus Stop (parada de autobús).',
    repairNote:
      'OpenStreetMap no registra daños, así que "Necesita reparación" y sus notas se quedan con su grupo. Sirven cuando hable con SEPTA o con la Ciudad sobre una parada.',
    updates: 'Placekeepers lee OpenStreetMap todos los lunes, así que sus respuestas llegan a nuestro mapa y a estas hojas en más o menos una semana.',
    printedFrom: 'Impreso desde Placekeepers, un mapa gratuito para los vecinos de Filadelfia. Paradas de SEPTA; datos del mapa © OpenStreetMap contributors.',
    routeTitle: (route) => `Ruta ${route}`,
    routesHere: (n) => plural(n, { one: '# ruta aquí', other: '# rutas aquí' }),
    surveyThisRoute: 'Revisar los refugios y bancos de las paradas de esta ruta',
  },

  amenities: {
    legend: {
      benches: 'Un banco',
      picnic_tables: 'Una mesa de picnic',
      drinking_water: 'Agua potable',
      toilets: 'Un baño público',
      bookcases: 'Una Little Free Library',
    },
    mappedNote: 'Aquí solo aparece lo que la gente ha agregado a OpenStreetMap, así que faltan muchos.',
    addMissing: 'Cómo agregar lo que falta',
    titles: {
      benches: 'Banco',
      picnic_tables: 'Mesa de picnic',
      drinking_water: 'Agua potable',
      toilets: 'Baño público',
      bookcases: 'Little Free Library',
    },
    facts: {
      br: ['Tiene respaldo', 'Sin respaldo'],
      cv: ['Bajo techo', 'Sin techo'],
      bt: ['Se puede llenar una botella aquí', 'No sirve para llenar una botella'],
      sn: ['Solo parte del año', 'Todo el año'],
      in: ['Adentro', 'Afuera'],
      fee: ['Tiene costo', 'Gratis'],
      ct: ['Tiene cambiador', 'Sin cambiador'],
    },
    access: { 1: 'Abierto a cualquiera', 2: 'Solo para clientes' },
    wheelchair: {
      1: 'Accesible en silla de ruedas',
      0: 'No accesible en silla de ruedas',
      2: 'Acceso limitado en silla de ruedas',
    },
    hours: (text) => `Horario tal como está en el mapa: ${text}`,
    nothingMore: 'OpenStreetMap todavía no dice más sobre esto.',
    unknownNote: 'Lo que no aparece en la lista todavía no se sabe. Eso no quiere decir que la respuesta sea no.',
    openOsm: 'Verlo en OpenStreetMap',
    fix: '¿Falta algo o está mal? Cómo corregirlo',
    source: 'Tal como está en OpenStreetMap, © OpenStreetMap contributors, actualizado cada semana.',
  },

  places: {
    legend: {
      park_water: 'Una fuente de agua potable en un parque',
      libraries: 'Una sucursal de la Free Library',
      recreation_centers: 'Un centro recreativo',
      playgrounds: 'Un parque infantil',
    },
    poolLegend: { 1: 'Una piscina', 2: 'Una zona de juegos de agua', 3: 'Un rociador' },
    notInService: 'Fuera de servicio este año',
    poolsShown: { in_service: 'Solo se muestran los que están en servicio este año.', all: 'Los círculos huecos están fuera de servicio este año.' },
    recreationKinds: {
      1: 'Centro recreativo',
      2: 'Centro para adultos mayores',
      3: 'Centro de educación ambiental',
    },
    poolKinds: { 1: 'Piscina', 2: 'Zona de juegos de agua', 3: 'Rociador' },
    waterKinds: { 1: 'Fuente de agua potable', 2: 'Estación para llenar botellas' },
    status: { 1: 'En servicio este año', 0: 'Fuera de servicio este año' },
    statusUnknown: 'Parques y Recreación no dice si está en servicio este año.',
    indoor: { 1: 'Adentro', 0: 'Afuera' },
    waterIndoor: 'Dentro de un edificio: abierta cuando el edificio está abierto.',
    accessible: { 1: 'Indicado como accesible para personas con discapacidades', 0: 'No indicado como accesible' },
    opened: (date) => `Abrió para la temporada el ${date}.`,
    gym: 'Tiene gimnasio.',
    noBuilding: 'Un sitio de programas sin un edificio propio.',
    inPark: (park) => `En ${park}.`,
    phone: (number) => `Teléfono: ${number}`,
    libraryPage: 'Horarios y eventos en el sitio web de la Free Library',
    seasonNote: 'Las piscinas abren solo en verano. Pregunte a Parques y Recreación por los horarios de esta semana.',
    source: {
      libraries: 'De la lista de sucursales de la Free Library of Philadelphia de la Ciudad.',
      parks: 'De Parques y Recreación de Filadelfia, tal como la Ciudad lo publica.',
    },
    cooling: {
      legendOpen: 'Un sitio para calentarse o refrescarse indicado como abierto',
      legendClosed: 'Indicado como cerrado, o sin estado',
      kindShown: {
        any: 'Sitios para tiempo caluroso y para tiempo frío.',
        cooling: 'Solo sitios para refrescarse, para tiempo caluroso.',
        warming: 'Solo sitios para calentarse, para tiempo frío.',
      },
      asListed: (copied, changed) =>
        `${copied ? `Tal como la Ciudad los indicó el ${copied}` : 'Tal como la Ciudad los indicó cuando este mapa copió la lista por última vez'}${changed ? ` (la lista se cambió por última vez el ${changed})` : ''}. No es en vivo: los sitios abren y cierran según el clima, así que llame al sitio o al 311 antes de ir.`,
      oneMarker: 'Una biblioteca o un centro recreativo que también es un sitio aparece una sola vez, como sitio.',
      kinds: {
        1: 'Sucursal de la Free Library',
        2: 'Sitio de Parques y Recreación',
        3: 'Socio comunitario',
        4: 'Centro comunitario de la Autoridad de Vivienda de Filadelfia',
      },
      title: 'Sitio para calentarse o refrescarse',
      status: { 1: 'Indicado como abierto', 0: 'Indicado como cerrado' },
      statusUnknown: 'No hay estado indicado',
      both: 'Indicado como sitio para calentarse y para refrescarse',
      cooling: 'Indicado como sitio para refrescarse',
      warming: 'Indicado como sitio para calentarse',
      neither: 'No indicado como sitio para calentarse ni para refrescarse',
      hours: (hours) => `Horario indicado: ${hours}`,
      services: (services) => `Lo que ofrece, según la lista: ${services}`,
      capacity: (n) => `Espacio para ${formatNumber(n)} personas, según la lista`,
      water: 'Tiene una estación de agua',
      restroom: 'Tiene un baño público',
      also: {
        lib: (name) => `También está en el mapa como sucursal de la Free Library: ${name}.`,
        rec: (name) => `También está en el mapa como sitio de Parques y Recreación: ${name}.`,
      },
      alsoSite: 'La Ciudad también lo indica como un sitio para calentarse o refrescarse.',
    },
    playgrounds: {
      kind: 'Parque infantil',
      ages: { 1: 'Para edades de 2 a 5', 2: 'Para edades de 5 a 12', 3: 'Para edades de 2 a 12' },
      installed: (year) => `Instalado en ${year}`,
    },
  },

  conditions: {
    legend: {
      dumping: 'Basura tirada ilegalmente',
      dark_lights: 'Una luz de calle o de callejón apagada',
      graffiti: 'Grafiti',
    },
    legendOpen: (what) => `${what}: una solicitud todavía abierta`,
    legendClosed: (what) => `${what}: todas las solicitudes cerradas`,
    legendSize: 'Un círculo más grande significa más solicitudes en esa cuadra.',
    legendWindow: 'Solicitudes a Philly311 en los últimos 90 días, contadas por cuadra, nunca por dirección.',
    openOnly: 'Solo se muestran las cuadras con una solicitud todavía abierta.',
    titles: {
      dumping: 'Basura tirada ilegalmente reportada',
      dark_lights: 'Luces apagadas reportadas',
      graffiti: 'Grafiti reportado',
    },
    summary: (n, open) =>
      `${plural(n, { one: '# solicitud', other: '# solicitudes' })} a Philly311 en los últimos 90 días, ${open === 0 ? 'ninguna' : formatNumber(open)} todavía ${open === 1 ? 'abierta' : 'abiertas'}.`,
    newest: (date) => `La más reciente se hizo el ${date}.`,
    alley: (n, total) =>
      n === total
        ? n === 1
          ? 'Fue sobre una luz de callejón.'
          : 'Todas fueron sobre luces de callejón.'
        : `${formatNumber(n)} de ellas sobre una luz de callejón.`,
    block: (street) => `En esta cuadra de ${street}.`,
    byBlock: 'Contado por cuadra, nunca por dirección, y no se muestra nada sobre quién reportó.',
    meaning: 'Una solicitud muestra que alguien lo notó y le pidió ayuda a la Ciudad. Algunas cuadras piden con más frecuencia que otras.',
    report: 'Reportarlo a Philly311',
    source: 'De los registros 311 de la Ciudad (Philly311), actualizados cada semana.',
  },

  walk: {
    walkTitle: {
      index: 'Qué tan caminable es cada zona (el índice de caminabilidad de la EPA)',
      corners: 'Esquinas: qué tan conectadas están las calles (EPA)',
      transit: 'Qué tan cerca está la parada de transporte público más cercana (EPA)',
      mix: 'Qué tan bien se mezclan viviendas, empleos y tiendas (EPA)',
    },
    walkCompared: {
      city: 'Comparado dentro de Filadelfia: cada tono tiene más o menos un quinto de los grupos de bloques censales de la ciudad.',
      nation: 'Comparado con todo el país, como la EPA clasifica cada grupo de bloques censales de Estados Unidos.',
    },
    walkFifths: {
      index: ['Quinto menos caminable', 'Menos caminable', 'Quinto del medio', 'Más caminable', 'Quinto más caminable'],
      corners: ['Menos esquinas', 'Menos', 'Quinto del medio', 'Más', 'Más esquinas'],
      transit: ['Más lejos del transporte público', 'Más lejos', 'Quinto del medio', 'Más cerca', 'Más cerca del transporte público'],
      mix: ['La menor mezcla', 'Menos mezclado', 'Quinto del medio', 'Más mezclado', 'La mayor mezcla'],
    },
    walkNationFifths: ['Quinto inferior del país', 'Por debajo del medio', 'Quinto del medio', 'Por encima del medio', 'Quinto superior del país'],
    walkClasses: [
      'Menos caminable: un índice de 1 a 5.75',
      'Por debajo del promedio: 5.76 a 10.5',
      'Por encima del promedio: 10.51 a 15.25',
      'Más caminable: 15.26 a 20',
    ],
    walkNationNote:
      'Comparada con todo el país, casi toda Filadelfia está por encima del promedio o entre las zonas más caminables, así que comparar dentro de la ciudad muestra mejor sus diferencias.',
    walkParts:
      'El índice califica de 1 a 20. Las esquinas y el transporte público cuentan un tercio cada uno, y dos medidas de la mezcla de viviendas, empleos y tiendas, un sexto cada una.',
    walkSource: 'De la Smart Location Database de la EPA (2021), hecha con datos de más o menos 2017 a 2019.',

    reachTitle: {
      people: 'Personas que viven a 5 minutos a pie (censo de 2020)',
      places: 'Tipos de lugares de todos los días a 10 minutos a pie',
      corners: 'Esquinas a 5 minutos a pie',
    },
    reachBins: {
      people: ['Menos de 1,000 personas', '1,000 a 2,499', '2,500 a 3,999', '4,000 a 5,999', '6,000 o más'],
      places: ['2 o menos de los 7 tipos', '3 o 4 tipos', '5 tipos', '6 tipos', 'Los 7 tipos'],
      corners: ['Menos de 10 esquinas', '10 a 24', '25 a 49', '50 a 74', '75 o más'],
    },
    reachKinds:
      'Los siete tipos: una biblioteca, un centro recreativo, una piscina o zona de juegos de agua en servicio, una fuente de agua potable en un parque, una escuela, una tienda de comestibles o un mercado que acepta SNAP, y una parada de autobús, tranvía o tren.',
    reachCorners:
      'Una esquina es donde se cruzan tres o más calles por las que se puede caminar. Más esquinas significan cuadras más cortas y más maneras de llegar a pie a algún lugar.',
    reachMeasured:
      'Se cuenta desde el medio de cada hexágono en línea recta: 400 metros para 5 minutos a pie, 800 para 10 minutos a pie. Eso llega un poco más lejos que caminar por las calles, y cruza vías de tren, autopistas y ríos.',
    reachSource: {
      people: 'Personas del censo de 2020, contadas por bloque.',
      places: 'Lugares de la Ciudad, Parques y Recreación, el USDA y SEPTA. Los lugares justo al otro lado del límite de la ciudad no se cuentan.',
      corners: 'Esquinas de los ejes centrales de calles de la Ciudad.',
    },

    stressLevels: {
      1: 'Nivel 1: lo bastante tranquilo para la mayoría de las personas de todas las edades',
      2: 'Nivel 2: bien para la mayoría de los adultos',
      3: 'Nivel 3: solo para ciclistas con confianza',
      4: 'Nivel 4: solo para los ciclistas más intrépidos',
    },
    stressShown: {
      stressful: 'Solo se muestran las calles con estrés, niveles 3 y 4.',
      calm: 'Solo se muestran las calles tranquilas, niveles 1 y 2.',
    },
    stressZoom:
      'Con el mapa alejado, se muestran las calles con estrés y las calles con un carril para bicicletas o un sendero. Acerque el mapa para ver cada calle.',
    stressSource:
      'De la red de Nivel de Estrés del Tráfico de la Comisión Regional de Planificación del Valle del Delaware (DVRPC): calificada según los carriles, la velocidad del tráfico y el tipo de carril para bicicletas, no andando en bicicleta por cada calle.',
    stressTitle: (level) => `Nivel ${level} de 4`,
    stressMeaning: {
      1: 'Lo bastante tranquilo para la mayoría de las personas de todas las edades, también los niños.',
      2: 'Bien para la mayoría de los adultos: un poco de estrés del tráfico.',
      3: 'Solo los ciclistas con confianza se sienten a gusto aquí.',
      4: 'Tráfico intenso y rápido: solo los ciclistas más intrépidos.',
    },
    stressOtherWay: (level) => `Andar en el otro sentido es más tranquilo: nivel ${level}.`,
    facilities: {
      0: 'Sin carril para bicicletas',
      1: 'Una ruta para bicicletas señalizada',
      2: 'Marcas de carril compartido (sharrows)',
      3: 'Un carril para bicicletas',
      4: 'Un carril para bicicletas con franja de separación',
      5: 'Un carril para bicicletas protegido',
      6: 'Un sendero o camino alejado del tráfico',
    },
    stressSpeed: (mph) => `El tráfico va a unas ${formatNumber(mph)} millas por hora, según el límite de velocidad o el cálculo de DVRPC.`,
    stressLanes: (n) => `${plural(n, { one: '# carril', other: '# carriles' })} en total.`,
    streetsHere: (n) => plural(n, { one: '# calle aquí', other: '# calles aquí' }),
    stressDetailsSource: 'De la red de Nivel de Estrés del Tráfico de DVRPC, calificada según carriles, velocidades y carriles para bicicletas.',
  },

  landBank: {
    pageTitle: 'El Land Bank en números',
    back: 'Volver al mapa',
    intro:
      'Cuántas propiedades han transferido el Philadelphia Land Bank y las otras agencias de tierras de la Ciudad, año por año, según los registros de escrituras de la propia Ciudad. Solo conteos y totales: sin nombres ni direcciones.',
    loading: 'Cargando los números',
    loadFailed: 'No se pudieron cargar los números. Revise su conexión e inténtelo de nuevo.',
    retry: 'Intentar de nuevo',
    missing: 'Los números todavía no se han publicado. Aparecen después de la próxima actualización semanal de los datos.',
    noStatus: 'Sin estado',
    agencyLabel: 'Agencia',
    agencyHelp: 'Cada sección de abajo sigue esta elección, salvo los conteos de la propia Ciudad por programa y el conteo semanal de lotes indicados como disponibles.',
    agencies: {
      all: 'Las cuatro agencias',
      PLB: 'Philadelphia Land Bank',
      PRA: 'Autoridad de Redesarrollo',
      PHDC: 'PHDC',
      PUB: 'Ciudad de Filadelfia',
    },
    agencyLong: {
      all: 'las cuatro agencias de tierras juntas',
      PLB: 'el Philadelphia Land Bank',
      PRA: 'la Autoridad de Redesarrollo de Filadelfia',
      PHDC: 'la Philadelphia Housing Development Corporation (PHDC)',
      PUB: 'la Ciudad de Filadelfia',
    },
    headline: (agency, n, deeds, from, to) =>
      `Según los registros de escrituras de la Ciudad de ${from} a ${to}, ${plural(n, { one: '# propiedad fue transferida', other: '# propiedades fueron transferidas' })} por ${agency} en ${plural(deeds, { one: '# escritura', other: '# escrituras' })}.`,
    movedAll: (n) =>
      `No se cuentan: ${plural(n, { one: '# traspaso', other: '# traspasos' })} de una propiedad de una agencia a otra, por ejemplo de la Ciudad al Land Bank.`,
    moved: (received, handed) =>
      `También recibió ${plural(received, { one: '# propiedad', other: '# propiedades' })} de las otras agencias y les entregó ${formatNumber(handed)}. Esos traspasos no se cuentan como transferencias.`,
    whatCounts:
      'Una transferencia, aquí, es una escritura de una agencia de tierras a alguien fuera de las cuatro agencias: una persona, una empresa, una organización sin fines de lucro u otra entidad pública, como la Autoridad de Vivienda de Filadelfia. Cada propiedad cuenta una vez. Se dejan fuera las correcciones, las cancelaciones de restricciones antiguas, los traspasos entre las agencias y los acuerdos registrados como escrituras.',
    partial: (year, date) => `${year} llega solo hasta el ${date}: los registros de escrituras de la Ciudad van unas ocho semanas atrasados.`,
    noNames:
      'Leemos los nombres de los compradores solo para distinguir a una persona de una empresa y para revisar la casa de al lado. No guardamos ninguno.',
    showNumbers: 'Mostrar los números',
    tableLabel: (what) => `Los números: ${what}`,
    downloadCsv: 'Descargar CSV',
    year: 'Año',
    total: 'Total',
    properties: 'Propiedades',
    chartLabel: (what, from, to, max) =>
      `${what}, ${from} a ${to}. El año más alto tiene ${max}. Los mismos números están en la tabla debajo del gráfico.`,
    perYear: {
      title: 'Transferencias por año',
      caption: 'Propiedades transferidas cada año. Una escritura puede transferir muchas propiedades.',
      deeds: 'Escrituras',
    },
    buyers: {
      title: 'Quiénes son los compradores',
      caption:
        'El tipo de cada comprador, leído del nombre que registra la escritura. Una organización sin fines de lucro se cuenta como tal solo cuando su nombre lo dice; muchas organizaciones sin fines de lucro tienen nombres como los de las empresas y se cuentan como empresas.',
      groups: {
        individual: 'Personas',
        company: 'Empresas',
        nonprofit: 'Organizaciones sin fines de lucro',
        public: 'Otras entidades públicas',
        unknown: 'No está claro',
      },
      share: (label, pct) => `${label}: ${pct}%`,
      shares: 'Parte de todas las propiedades transferidas en estos años',
    },
    programs: {
      title: 'Por programa',
      caption:
        'Las escrituras no dicen por cuál programa pasó una transferencia. Se puede deducir una: un solo lote transferido a una persona que es dueña de una casa que lo toca es probablemente un patio lateral o trasero. Este gráfico cuenta esos lotes, una deducción nuestra. De los demás no se sabe nada por los registros, lo que no significa que no fueran patios laterales.',
      series: 'Patios laterales o traseros, deducción nuestra',
      checked:
        'Cómo lo comprobamos (9 de octubre de 2026): 10 de estos lotes, elegidos al azar de 2019 a 2026, buscados a mano. En los 10, el comprador es el dueño registrado de la casa de al lado o de atrás del lote y recibe allí su correo. Si cada uno pasó por el programa de patio lateral sigue siendo una deducción nuestra.',
      compare: (cityTotal, ours, oursPlb, from, to) =>
        `Para los años fiscales ${from} a ${to}, el panel de la propia Ciudad contó ${formatNumber(cityTotal)} patios laterales. De las escrituras deducimos ${formatNumber(ours)} de las cuatro agencias, ${formatNumber(oursPlb)} de ellos del Land Bank.`,
      cityTitle: 'El conteo de la propia Ciudad por programa',
      cityCaption: (edited) =>
        `Del panel de Land Management de la Ciudad, por año fiscal (de julio a junio). Se actualizó por última vez el ${edited}, así que el último año está incompleto, y para vivienda cuenta casas construidas, no propiedades.`,
      fy: 'Año fiscal',
      sideYards: 'Patios laterales',
      gardens: 'Jardines o espacio abierto',
      business: 'Ampliación de negocios',
      homesBelow30: 'Viviendas, por debajo del 30% del ingreso del área',
      homes60to80: 'Viviendas, 60% a 80%',
      homes80to120: 'Viviendas, 80% a 120%',
      homesMarket: 'Viviendas, a precio de mercado',
      oursPlb: 'Nuestra deducción de patios laterales, Land Bank',
      oursAll: 'Nuestra deducción de patios laterales, las cuatro agencias',
      fyLabel: (fy) => `${fy - 1} a ${fy}`,
    },
    prices: {
      title: 'Precios registrados en las escrituras',
      caption: (max) =>
        `El precio es lo que la escritura registra para cada propiedad (su parte, cuando una escritura abarcó varias). No siempre es dinero pagado: algunos programas venden por un precio simbólico y protegen el uso del lote con una hipoteca a 30 años, y las escrituras de patios laterales a menudo registran el valor tasado del lote. El precio mediano tiene la mitad de los precios por debajo y la mitad por encima. "Simbólico" significa ${max} o menos.`,
      priced: 'Con precio',
      median: 'Precio mediano',
      nominal: 'Precio simbólico',
      none: 'Sin precio registrado',
      summary: (median, pct) => `Precio mediano en estos años: ${median}. ${pct}% se transfirieron por un precio simbólico.`,
    },
    districts: {
      title: 'Por distrito del Concejo',
      caption:
        'Dónde están las propiedades, según los límites actuales de los distritos del Concejo. Los límites de los distritos cambian después de cada censo, así que los años anteriores también se ubican según los límites actuales.',
      district: 'Distrito',
      districtName: (n) => `Distrito ${n}`,
      noLocation: 'Sin ubicación en los registros',
      allYears: 'Todos los años',
      chartLabel: 'Propiedades transferidas en cada distrito del Concejo. Los mismos números están en la tabla de abajo.',
    },
    listed: {
      title: 'Lotes indicados como disponibles, semana por semana',
      caption: (from) =>
        `La lista de propiedades públicas de la Ciudad, la misma que muestra el mapa de propiedades del Land Bank, contada cada semana en que se actualizó nuestra copia. El conteo empieza el ${from}; no hay conteos semanales anteriores.`,
      date: 'Fecha de la lista',
      records: 'Indicados como disponibles',
      parcels: 'Parcelas',
      sideYard: 'Abiertos a un vecino como patio lateral',
      oneWeek: 'Aparecerá un gráfico cuando haya dos semanas para comparar.',
      byStatus: (date) => `Cada lote de la lista según su estado, ${date}`,
      status: 'Estado',
      count: 'Registros',
      chartLabel: (from, to) =>
        `Lotes indicados como disponibles cada semana, de ${from} a ${to}. Los mismos números están en la tabla de abajo.`,
      mapLink: 'El mapa de propiedades de la lista del Land Bank',
    },
    limits: {
      title: 'Lo que estos números no pueden mostrar',
      items: [
        'Cuánto esperaron los solicitantes, cuántos solicitaron o a cuántos se les dijo que no. Los registros públicos tienen escrituras, no solicitudes.',
        'El programa detrás de la mayoría de las transferencias. Las escrituras no lo dicen; los patios laterales y traseros son una deducción nuestra, y los conteos de la propia Ciudad por programa se detienen en abril de 2023.',
        'Lo que se construyó o se cultivó después, o si se respetaron las restricciones de un lote.',
        'Lo que finalmente pagó un comprador. Una escritura registra un precio, y algunos programas combinan un precio simbólico con una hipoteca a 30 años.',
        'Terrenos que las agencias arriendan o dan en licencia, como los acuerdos de jardín. Ninguna escritura los registra.',
        'Escrituras anteriores a 2014, y escrituras de las últimas ocho semanas más o menos, que la Ciudad todavía no ha publicado.',
      ],
    },
    sources: {
      title: 'Fuentes y fechas',
      deeds: (fetched, last) =>
        `Escrituras: Ciudad de Filadelfia, Departamento de Registros, transferencias de bienes raíces, leídas el ${fetched}; la escritura más reciente es del ${last}.`,
      programs: (edited) =>
        `Conteos por programa: Ciudad de Filadelfia, Departamento de Planificación y Desarrollo, panel de Land Management, actualizado por última vez el ${edited}.`,
      listed:
        'Lotes de la lista: Ciudad de Filadelfia, Departamento de Planificación y Desarrollo (Land Management), tal como los muestra el mapa de propiedades del Philadelphia Land Bank.',
      districts: 'Distritos del Concejo: Ciudad de Filadelfia, límites actuales.',
      neighbours:
        'Para la deducción de patios laterales: la lista de dueños de la Ciudad (Oficina de Evaluación de Propiedades) y las formas de las parcelas (Departamento de Agua).',
      board: 'Las agendas de la junta del Land Bank, que enumeran cada disposición por programa',
      council: 'La legislación del Concejo Municipal, donde el Concejo aprueba cada disposición del Land Bank',
      method: 'Cómo contamos, en detalle',
      deedsLink: 'Las transferencias de bienes raíces de la Ciudad',
      programsLink: 'La tabla del panel de Land Management de la Ciudad',
    },
    csv: {
      years: (agency) => `Transferencias por año y agencia (las cuatro agencias y cada una; esta página mostraba ${agency}).`,
      districts: 'Transferencias por distrito del Concejo (límites actuales) y año, para las cuatro agencias y cada una.',
      programs: 'Los conteos de la propia Ciudad por programa y año fiscal, junto a nuestra deducción de patios laterales.',
      listed: 'Lotes de la lista de propiedades públicas de la Ciudad indicados como disponibles, cada semana desde el inicio del conteo.',
      counts: 'Solo conteos: sin nombres, sin direcciones y sin números de parcela.',
      dates: (fetched, last) => `Escrituras leídas el ${fetched}; la escritura más reciente es del ${last}.`,
      file: (part, day) => `placekeepers-land-bank-${part}-${day}.csv`,
    },
  },

  basemap: {
    missing: 'El mapa base no está disponible, así que las calles y los nombres de lugares están ocultos. Las capas de datos siguen funcionando.',
    unavailable: 'El mapa base no está disponible aquí, así que el mapa muestra un fondo liso.',
    legend: 'Calles, edificios, parques, agua y nombres de lugares, en color.',
    legendMuted: 'Calles, edificios, parques, agua y nombres de lugares, en gris, para que los datos resalten.',
  },

  credits: {
    basemap:
      '<a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    data: (statusUrl) => `Datos: Ciudad de Filadelfia y <a href="${statusUrl}">otras fuentes</a>`,
  },

  status: {
    pageTitle: 'Estado de los datos',
    intro:
      'Placekeepers actualiza sus datos cada semana. Si una fuente falla, el mapa conserva la última copia buena y lo dice aquí.',
    back: 'Volver al mapa',
    loading: 'Cargando el estado de los datos',
    loadFailed: 'No pudimos cargar el archivo del estado de los datos. Puede que el mapa todavía funcione con datos más antiguos.',
    retry: 'Intentar de nuevo',
    builtOn: (date) => `Última actualización: ${date}`,
    buildId: (id) => `Compilación ${id}`,
    summaryAllOk: 'Todas las fuentes están al día.',
    summary: (stale, failing, missing) => {
      const parts: string[] = [];
      if (stale) parts.push(plural(stale, { one: '# fuente está desactualizada', other: '# fuentes están desactualizadas' }));
      if (failing) parts.push(plural(failing, { one: '# fuente no funciona', other: '# fuentes no funcionan' }));
      if (missing) parts.push(plural(missing, { one: '# fuente todavía no se ha obtenido', other: '# fuentes todavía no se han obtenido' }));
      return `${parts.join(', ')}.`;
    },
    statusLabel: {
      ok: 'Al día',
      stale: 'Desactualizada',
      failing: 'No funciona',
      missing: 'Todavía no obtenida',
      unknown: 'Desconocido',
    },
    staleSince: (date) => `Se usa la última copia buena, del ${date}.`,
    staleNoDate: 'Se usa la última copia buena.',
    failingText: 'Ahora no hay ninguna copia utilizable, así que pueden faltar las capas que la necesitan.',
    missingText: 'Esta fuente todavía no se ha obtenido.',
    unknownText: 'El archivo de estado informa algo que no reconocemos.',
    lastSuccess: (date) => `Última descarga buena: ${date}`,
    neverSucceeded: 'Todavía no hay una descarga buena',
    lastAttempt: (date) => `Último intento: ${date}`,
    rows: (n) => plural(n, { one: '# registro', other: '# registros' }),
    newest: (date) => `Registro más reciente: ${date}`,
    message: (text) => `Nota de la actualización: ${text}`,
    publisher: 'Publicado por',
    homepage: 'De dónde viene',
    license: 'Licencia',
    cadence: {
      daily: 'Actualizado a diario por quien lo publica',
      weekly: 'Actualizado cada semana por quien lo publica',
      monthly: 'Actualizado cada mes por quien lo publica',
      yearly: 'Actualizado cada año por quien lo publica',
      irregular: 'Actualizado de vez en cuando por quien lo publica',
      frozen: 'Ya no lo actualiza quien lo publica',
    },
    problems: 'Problemas en el archivo de estado',
    notesTitle: 'Notas de la última actualización',
    notesInEnglish: 'Estas notas están escritas en inglés, para las personas que mantienen el mapa funcionando.',
    basemapLabel: { ok: 'Al día', failing: 'No disponible' },
    basemapMade: (date) =>
      `La actualización semanal hace una copia nueva del mapa base más o menos una vez al mes. Esta copia se hizo con datos de OpenStreetMap el ${date}.`,
    basemapNoDate: 'La actualización semanal hace una copia nueva del mapa base más o menos una vez al mes.',
    basemapMissing:
      'El mapa base no está disponible en esta copia del sitio, así que el mapa muestra un fondo liso. Las capas de datos siguen funcionando.',
  },

  search: {
    label: 'Buscar una dirección, una intersección o un número de parcela',
    placeholder: 'Dirección, intersección o número de parcela',
    button: 'Buscar',
    searching: 'Buscando',
    tooShort: 'Escriba una dirección, como 1234 Market St, o dos calles que se cruzan, como Broad y Girard.',
    notFound:
      'La Ciudad no pudo encontrar ese lugar. Pruebe con el número de una casa y la calle, dos calles que se cruzan, o un número de parcela de nueve dígitos.',
    failed: (reason) => `Problema con el servicio de direcciones de la Ciudad: ${reason}. Inténtelo de nuevo en un momento.`,
    liveOff:
      'La búsqueda de direcciones consulta el servicio de direcciones de la Ciudad, y los datos en vivo de la Ciudad están desactivados en Ajustes. Todavía puede buscar por un número de parcela de nueve dígitos.',
    resultsTitle: 'Elija un lugar',
    resultsCount: (n) => plural(n, { one: '# lugar coincide', other: '# lugares coinciden' }),
    intersection: 'Intersección',
    showing: (label) => `Mostrando ${label} en el mapa.`,
    noParcel: (label) => `Mostrando ${label} en el mapa. La Ciudad no tiene un registro de parcela para esta dirección exacta.`,
    privacy: 'Las búsquedas van de su navegador directo a la Ciudad de Filadelfia.',
  },

  pick: {
    looking: 'Buscando esta parcela con la Ciudad',
    nothing: 'La Ciudad no tiene ninguna parcela en este punto. Toque un lote o un edificio.',
    liveOff: 'Para abrir una parcela que no está en nuestra lista, active "Traer datos en vivo de la Ciudad" en Ajustes.',
    failed: (reason) => `Problema con el mapa de parcelas de la Ciudad: ${reason}. Inténtelo de nuevo en un momento.`,
  },

  historic: {
    liveOff:
      'Estas imágenes vienen directo de los servidores de la Ciudad, así que solo se pueden activar mientras "Traer datos en vivo de la Ciudad" está activado (en Ajustes, en "Privacidad y datos en vivo").',
    refused:
      'Las fotos aéreas antiguas y el atlas de 1860 vienen de los servidores de la Ciudad. Active los datos en vivo de la Ciudad en Ajustes para verlos.',
    serverError: 'El servidor de imágenes de la Ciudad no envió todas las partes de esta imagen. Inténtelo más tarde.',
    photoYear: (year) => `La foto aérea de ${year}, tomada desde un avión.`,
    gaps1975: 'Las fotos de 1975 dejan huecos en el extremo sur de la ciudad, alrededor del aeropuerto y del Navy Yard.',
    termsNotStated:
      'Quien las publica no indica condiciones de uso para estas fotos; se muestran tal como la Ciudad las aloja, con su crédito, y se retiran si quien las publica lo pide.',
    blackAndWhite: (year) => `Las fotos de ${year} son en blanco y negro.`,
    under: 'La foto queda debajo de todas las demás capas. Baje su intensidad para ver a través de ella las calles de hoy.',
    atlasCoverage: 'El atlas cubre solo Center City y Northern Liberties.',
    atlasCredit:
      'Atlas ajustado al mapa de hoy por la Greater Philadelphia GeoHistory Network y alojado por la Ciudad de Filadelfia con su permiso.',
    sliderRange: (first, last) => `De ${first} a ${last}`,
    lotTitle: 'Fotos aéreas antiguas',
    lotButton: 'Ver este lote en fotos aéreas antiguas',
    lotHelp: (year) =>
      `Abre el mapa en este lote con la foto aérea de ${year}, la más antigua de este mapa. Pase por los años desde entonces en "Antes y ahora", en las capas.`,
    lotLiveOff: 'Las fotos vienen directo de los servidores de la Ciudad, así que necesitan los datos en vivo de la Ciudad, que están desactivados.',
    shown: (year) => `Las fotos aéreas de ${year} están activadas. Pase por los años en "Antes y ahora", en las capas.`,
    statusOk:
      'Todos los servicios de imágenes respondieron en la última revisión semanal. Las imágenes se cargan directo de los servidores de la Ciudad cuando alguien activa su capa.',
    statusStale: (date) =>
      `En la última revisión semanal no todos los servicios de imágenes respondieron, así que puede que algunas imágenes no se vean. Todos respondieron por última vez el ${date}.`,
    statusFailing: 'Los servicios de imágenes no respondieron en la revisión semanal, así que puede que las imágenes no se vean.',
    services: (n) => plural(n, { one: '# servicio de imágenes revisado', other: '# servicios de imágenes revisados' }),
    lastCheck: (date) => `Última revisión en que todos los servicios respondieron: ${date}`,
  },

  redlining: {
    detailsTitle: 'Mapa de redlining de 1937',
    grades: {
      A: 'A, calificada como "la mejor" en 1937',
      B: 'B, calificada como "todavía deseable"',
      C: 'C, calificada como "claramente en declive"',
      D: 'D, calificada como "peligrosa" y delineada en rojo: con redlining',
    },
    ungraded: 'Sin calificación (terreno industrial y comercial)',
    area: (label, grade) => `Área ${label}, calificada ${grade} en 1937`,
    areaUngraded: (label) => `${label}: un área que el mapa de 1937 dejó sin calificar`,
    context:
      'En 1937 una agencia federal, la Home Owners\' Loan Corporation, calificó los vecindarios de la ciudad de la A a la D según qué tan seguro juzgaba que era prestar dinero para hipotecas allí. Las calificaciones dependían de quién vivía en cada área: las áreas donde vivían familias negras y muchas familias inmigrantes casi siempre recibían una D y se delineaban en rojo. Durante décadas fue más difícil conseguir préstamos allí, y esa práctica se llama redlining.',
    notToday:
      'Las calificaciones son un registro de cómo una agencia federal juzgó los lugares en 1937. No dicen nada sobre las personas que viven allí hoy.',
    legendTap: 'Toque un área para ver su calificación y un enlace a su descripción de 1937.',
    description: (label) => `Leer la descripción de 1937 del área ${label} en Mapping Inequality`,
    descriptionNote: 'Las descripciones de 1937 no se copian aquí: se quedan en Mapping Inequality, con la historia que las rodea.',
    credit:
      'Áreas y calificaciones de Mapping Inequality: Redlining in New Deal America, de Robert K. Nelson, LaDale Winling y otros, University of Richmond Digital Scholarship Lab. Placekeepers muestra solo las áreas y las calificaciones.',
    homepageLabel: 'Mapping Inequality: Philadelphia',
    nonCommercial:
      'Solo para uso no comercial. Con licencia Creative Commons Atribución-NoComercial 2.5, aparte del resto de los datos del mapa.',
    licenseLabel: 'CC BY-NC 2.5',
    statusNote:
      'Solo para uso no comercial: esta fuente tiene licencia para uso no comercial, así que el sitio la publica en un archivo aparte y nunca en una descarga.',
  },

  options: {
    title: 'Privacidad y datos en vivo',
    privacyLink: 'Cómo cuida Placekeepers su privacidad',
    turnOn: 'Activar los datos en vivo de la Ciudad',
    resetNote: 'Su elección sobre los datos en vivo de la Ciudad no cambia.',
  },

  failure: {
    timeout: 'no hubo respuesta a tiempo',
    network: 'no se pudo establecer la conexión',
    http: 'la respuesta fue un error',
    bad_data: 'la respuesta no se pudo leer',
    not_found: 'no hay ningún registro de eso',
    aborted: 'no se hizo la consulta',
    empty: 'no se hizo la consulta',
  },

  rulesMap: {
    legend: {
      district: 'Distrito histórico',
      property: 'En el registro histórico',
      overlay: 'Zonificación superpuesta',
      supplemental: 'Otra regla especial del Código de Zonificación',
      hearingZoning: 'Audiencia de zonificación',
      hearingOther: 'Audiencia ante otra junta',
      brownfield: 'Sitio brownfield de la EPA',
    },
    notes: {
      historic: 'Los cambios aquí pueden necesitar la revisión de la Comisión Histórica; pregúnteles primero.',
      overlays: 'Las zonas superpuestas se traslapan, y unas pocas cubren la mayor parte de la ciudad. Toque un punto para ver cada una de las que hay allí.',
      hearings: 'Toque una audiencia para ver cómo participar y para abrir la página del lote.',
      brownfields: 'No es un mapa de todo el suelo contaminado. Haga analizar el suelo antes de cultivar alimentos en uno de estos sitios o cerca de él.',
    },
    districtTitle: (name) => name,
    designated: (date) => `Designado el ${date}.`,
    noDate: 'La capa de la Ciudad no da el día de la designación.',
    propertyTitle: 'En el Registro de Lugares Históricos de Filadelfia',
    listedOn: (date) => `Incluido por sí solo el ${date}.`,
    listedAlone: 'Incluido por sí solo.',
    inDistrict: (district, date) => `Parte de ${district}${date ? `, designado el ${date}` : ''}.`,
    overlaysHere: (n) => (n === 1 ? 'Una zona superpuesta aquí' : `${formatNumber(n)} zonas superpuestas aquí`),
    hearingTitle: (board) => `Audiencia: ${board}`,
    hearingWhen: (date, time) => `${date}${time ? `, a las ${time}` : ''}`,
    hearingsHere: (n) => `${formatNumber(n)} audiencias aquí`,
    about: (address) => `Sobre ${address}.`,
    rco: (name) => `Organización comunitaria registrada notificada: ${name}.`,
    openLot: 'Abrir la página de este lote',
    namesNote: 'Quién presentó la apelación se muestra solo en la página del lote.',
    brownfieldTitle: 'Sitio brownfield de la EPA',
  },

  dossier: {
    pageTitle: 'Página del lote',
    loading: 'Cargando la página del lote',
    parcel: (opa) => `Cuenta OPA ${opa}`,
    printButton: 'Imprimir esta página del lote',
    showOnMap: 'Mostrar en el mapa',
    close: 'Cerrar la página del lote',
    clear: 'Quitar la selección',
    retry: 'Intentar de nuevo con la Ciudad',
    notFound: 'No pudimos encontrar esta parcela en los registros de la Ciudad ni en nuestra copia semanal.',
    noData:
      'Esta parcela no está en nuestra copia semanal, y los datos en vivo de la Ciudad están desactivados, así que todavía no hay nada que mostrar.',
    sections: {
      summary: 'Resumen',
      actions: 'Lo que puede hacer',
      rules: 'Reglas de este lote',
      owner: 'Quién es el dueño',
      history: 'Historia',
      nearby: 'Cerca',
      sources: 'Fuentes y actualización',
    },
    contents: 'En esta página',

    provenance: {
      live: (time) => `En vivo desde la Ciudad a las ${time}.`,
      snapshot: (date) => `De la copia semanal del ${date}.`,
      snapshotNoDate: 'De la copia semanal.',
      map: 'De los datos semanales del mapa.',
      checking: 'Buscando registros más recientes en la Ciudad.',
      asking: 'Consultando a la Ciudad.',
      failedSnapshot: (reason, date) => `Problema con los servidores de la Ciudad (${reason}), así que esta es la copia semanal del ${date}.`,
      failedNothing: (reason) => `Problema con los servidores de la Ciudad (${reason}), así que esta parte no se puede mostrar ahora.`,
      offSnapshot: (date) => `Los datos en vivo de la Ciudad están desactivados, así que esta es la copia semanal del ${date}.`,
      offNothing: 'Los datos en vivo de la Ciudad están desactivados, y nuestra copia semanal no cubre esta parte.',
      none: 'No hay registros para mostrar.',
    },
    banner: {
      live: 'En vivo desde la Ciudad de Filadelfia.',
      loading: 'Consultando a la Ciudad por los registros más recientes.',
      off: (date) => `Los datos en vivo de la Ciudad están desactivados. Esta página muestra la copia semanal del ${date}.`,
      offNoDate: 'Los datos en vivo de la Ciudad están desactivados. Esta página muestra la copia semanal.',
      partial: 'Algunas consultas a la Ciudad no funcionaron. Esas partes muestran la copia semanal, o nada, y lo dicen.',
      failed: 'Los servidores de la Ciudad no respondieron. Esta página muestra lo que tiene nuestra copia semanal.',
    },

    summary: {
      kind: { lot: 'Lote vacío', building: 'Edificio vacío' },
      notListed: 'No está en nuestra lista de lotes y edificios vacíos',
      notListedHelp: 'Si cree que esta parcela está vacía, reporte una corrección abajo.',
      noDetails: 'Todavía no hay detalles publicados',
      noPublishedDetails:
        'No hemos publicado detalles de esta parcela, así que esta página muestra lo que dicen ahora los servidores de la Ciudad.',
      confidence: {
        high: 'Muy probablemente vacío',
        medium: 'Probablemente vacío',
        low: 'No estamos muy seguros de que esté vacío',
      },
      confidenceTitle: 'Qué tan seguros estamos',
      signals: (n) =>
        `${plural(n, { one: '# registro independiente de la Ciudad coincide', other: '# registros independientes de la Ciudad coinciden' })} en que está vacío.`,
      cityCalls: (category) => `Los registros de propiedades de la Ciudad lo llaman: ${category}.`,
      lotSize: (frontage, depth) =>
        `La Oficina de Evaluación de Propiedades de la Ciudad lo registra con unos ${formatNumber(Math.round(frontage))} pies de ancho en la calle y ${formatNumber(Math.round(depth))} pies de fondo.`,
      landcare: 'Ya lo mantiene PHS LandCare.',
      landcareSince: (year) => `Lo mantiene PHS LandCare desde ${year}.`,
      garden: 'Aquí ya hay gente que cultiva. Pregúnteles antes de planear algo.',
      lensLine: (lens) => `Prioridad según el lente de ${lens.toLowerCase()}, el lente con el que el mapa colorea los lotes.`,
      flood: {
        1: 'Parte de este lote está en la llanura aluvial con 1 por ciento de probabilidad anual de la FEMA, donde una inundación tiene al menos 1 probabilidad en 100 cada año. Es una razón para tener cuidado, no parte de ningún puntaje: las plantas aquí deben aguantar el suelo mojado, todo lo que se construya debe seguir las reglas de la Ciudad para llanuras aluviales, y el reverdecimiento que absorbe la lluvia ayuda.',
        2: 'Parte de este lote está en la zona de la FEMA con 0.2 por ciento de probabilidad anual de inundación, donde una inundación tiene 1 probabilidad en 500 cada año. Es una razón para tener cuidado, no parte de ningún puntaje: las plantas aquí deberían aguantar el suelo mojado, y el reverdecimiento que absorbe la lluvia ayuda.',
      },
      floodTitle: 'Riesgo de inundación',
      linksTitle: 'Verlo en otros sitios',
      propertyPage: 'La página de propiedades de la Ciudad',
      atlas: 'Atlas, el mapa de la Ciudad de esta dirección',
      googleMaps: 'Google Maps',
      streetView: 'Google Street View',
      linksNote: 'Estos enlaces abren otros sitios web. Placekeepers enlaza fotos de la calle pero nunca las copia.',
    },

    actions: {
      intro: 'Empiece por la vía legal. Cada una dice quién puede hacerla y quién puede ayudar.',
      route: 'La vía legal',
      steps: 'Pasos',
      who: 'Quién puede hacerlo',
      cost: 'Costo',
      timeline: 'Cuánto tarda',
      lastChecked: (date) => `Revisado por última vez el ${date}.`,
      toConfirm: 'Todavía falta confirmarlo con la organización que se nombra aquí.',
      partners: 'Quién puede ayudar',
      otherRoutes: 'Otras vías legales para esta parcela',
      none: 'Todavía no hay ninguna sugerencia para este lugar.',
      notListed:
        'Esta parcela no está en nuestra lista de lotes y edificios probablemente vacíos, así que no tenemos ninguna sugerencia para ella. La página "Cómo hacerlo" explica las vías legales para cualquier lote.',
      howTo: 'Cómo hacerlo',
      // Word for word passage (docs/ETHICS.md, "Owner information").
      conservatorshipWarning:
        'La administración judicial (conservatorship) puede quitarle una propiedad a su dueño. Investigadores encontraron que se usa de forma desproporcionada en vecindarios que enfrentan gentrificación. Hable con la Garden Justice Legal Initiative antes de considerarla.',
      notLegalAdvice: 'Placekeepers no es asesoría legal. Consulte con las organizaciones que se nombran aquí antes de actuar.',
    },

    listing: {
      title: 'Indicado como disponible por las agencias de tierras de la Ciudad',
      text: (date) => `El ${date}, la lista de tierras públicas de la Ciudad mostraba esta propiedad como disponible.`,
      textNoDate: 'La lista de tierras públicas de la Ciudad muestra esta propiedad como disponible.',
      variants: {
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': 'Se ofrece para un acuerdo de jardín.',
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': 'No se puede construir nada en ella.',
        'OWNED - AVAILABLE (NOT FOR SY)': 'No se ofrece como patio lateral.',
      },
      sideYardLead: 'Si usted es dueño de la casa de al lado, empiece por el programa de patio lateral:',
      decline:
        'Estar en la lista no significa que el Land Bank vaya a decir que sí. Decide cada solicitud por separado y puede rechazar cualquier venta o arrendamiento, incluso de una propiedad que indica como disponible.',
      changes: 'La lista cambia seguido. Revise el mapa del Land Bank antes de actuar.',
      map: 'El mapa de propiedades disponibles del Land Bank',
      credit:
        'Lista: Ciudad de Filadelfia, Departamento de Planificación y Desarrollo (Land Management), tal como la muestra el mapa del Philadelphia Land Bank.',
    },

    ownerType: {
      noName: 'Los registros de la Ciudad no dan ningún nombre de dueño.',
      unclear: 'No pudimos saber por el nombre qué tipo de dueño es.',
      individual: 'El nombre del dueño parece el nombre de una persona.',
      publicName: (label) => `Los registros de la Ciudad nombran como dueño a ${label}.`,
      markerReason: (marker) => `El nombre del dueño incluye "${marker}".`,
      agencyConflict: (contact) =>
        `Los registros de propiedades de la Ciudad nombran a un dueño diferente, así que pregunte a ${contact} cuál es el actual.`,
      agencyContacts: { PUB: 'el Land Bank', PLB: 'el Land Bank', PRA: 'PHDC', PHDC: 'PHDC' },
      publicBodies: {
        land_bank: 'el Philadelphia Land Bank',
        redevelopment_authority: 'la Autoridad de Redesarrollo de Filadelfia',
        pha: 'la Autoridad de Vivienda de Filadelfia',
        housing_authority: 'una autoridad de vivienda',
        phdc: 'la Philadelphia Housing Development Corporation (PHDC)',
        pha_or_phdc: 'la Autoridad de Vivienda de Filadelfia o PHDC (el nombre está cortado)',
        city: 'la Ciudad de Filadelfia',
        school_district: 'el Distrito Escolar de Filadelfia',
        community_college: 'el Community College of Philadelphia',
        septa: 'SEPTA',
        commonwealth: 'el Commonwealth de Pensilvania',
        phfa: 'la Agencia de Financiamiento de Vivienda de Pensilvania',
        united_states: 'el gobierno de los Estados Unidos',
        hud: 'el Departamento de Vivienda y Desarrollo Urbano de EE. UU.',
        veterans_affairs: 'el Departamento de Asuntos de Veteranos de EE. UU.',
        paid: 'la Autoridad de Desarrollo Industrial de Filadelfia',
        port_authority: 'la Autoridad Portuaria Regional de Filadelfia',
        district_attorney: 'la Oficina del Fiscal de Distrito de Filadelfia',
        public_authority: 'una autoridad pública',
        pgw: 'Philadelphia Gas Works',
      },
      markers: {
        TR: 'TR, abreviatura de fiduciario',
        TRS: 'TRS, abreviatura de fiduciarios',
        TRST: 'TRST, abreviatura de fideicomiso',
        'T U W': 'T/U/W, un fideicomiso creado por un testamento',
        FBO: 'FBO, para beneficio de',
        CO: 'CO, abreviatura de compañía',
        LP: 'LP, una sociedad limitada',
        LLP: 'LLP, una sociedad de responsabilidad limitada',
        LTD: 'LTD, abreviatura de limitada',
        LL: 'LL, una versión abreviada de LLC',
        GP: 'GP, un socio general',
        'N A': 'N A, un banco nacional',
        FB: 'FB, una versión abreviada de FBO',
        CDC: 'CDC, una corporación de desarrollo comunitario',
      },
      labels: {
        individual: 'Una persona',
        company: 'Una empresa',
        city: 'La Ciudad de Filadelfia',
        land_bank: 'El Philadelphia Land Bank',
        redevelopment_authority: 'La Autoridad de Redesarrollo de Filadelfia',
        housing_authority: 'Una autoridad de vivienda',
        nonprofit: 'Una organización sin fines de lucro',
        other_public: 'Otra agencia pública',
        unknown: 'No está claro en los registros de la Ciudad',
      },
    },

    owner: {
      names: 'Dueño, como lo publica la Ciudad',
      noNames: 'Los registros de la Ciudad no dan ningún nombre de dueño.',
      mailing: 'Dirección postal, como la publica la Ciudad',
      noMailing: 'No hay dirección postal registrada.',
      type: 'Tipo de dueño',
      flagsTitle: 'Lo que sugieren los registros de la Ciudad',
      noFlags: 'Nada en los registros de la Ciudad pide una nota sobre este dueño.',
      heldBack:
        'No estamos seguros de que esta parcela esté vacía, así que puede ser la casa de alguien. Las notas sobre un dueño que puede ser una persona (dónde recibe su correo, una posible sucesión, deuda de impuestos, otras parcelas que tiene) aparecen solo en las parcelas que consideramos muy probablemente o probablemente vacías.',
      ownerChanged:
        'Los registros de la Ciudad nombran a un dueño diferente del de nuestra copia semanal, así que se dejan fuera las notas que eran sobre el dueño anterior.',
      parts: { meaning: 'Qué significa', careful: 'Tenga cuidado', next: 'Un siguiente paso con cuidado' },
      flagTitles: {
        absentee: 'Dónde recibe el dueño su correo',
        possible_estate: 'Posible sucesión',
        tax_debt_2025: 'Deuda de impuestos a julio de 2025',
        sheriff_sales: 'Ventas pasadas del sheriff',
        years_since_sale: 'Años desde la última venta',
        many_parcels: 'Un dueño de muchas parcelas vacías',
        fast_resales: 'Reventas rápidas',
        open_violations: 'Infracciones abiertas de L&I',
        unsafe: 'Edificio inseguro',
        imminently_dangerous: 'Edificio de peligro inminente',
      },
      otherFlag: 'Una nota de los registros de la Ciudad',
      taxTitle: 'Impuestos',
      taxNoDebt:
        'La Ciudad ya no publica el saldo de impuestos de cada propiedad como datos abiertos. La copia de julio de 2025 que tenemos no muestra impuestos sin pagar aquí.',
      taxUnknown: 'La Ciudad ya no publica el saldo de impuestos de cada propiedad como datos abiertos.',
      taxHeld:
        'La Ciudad ya no publica el saldo de impuestos de cada propiedad como datos abiertos. Nuestra copia de julio de 2025 se muestra, para un dueño que puede ser una persona, solo en las parcelas que consideramos muy probablemente o probablemente vacías.',
      taxCenter: 'Revise el saldo de hoy en el Tax Center de la Ciudad',
      deedFraudTitle: 'Proteja esta propiedad del robo de escrituras',
      // Word for word passage (docs/ETHICS.md, "Owner information").
      deedFraud:
        'El robo de escrituras ocurre cuando alguien presenta una escritura falsa para quedarse con una propiedad, a menudo una cuyo dueño ha fallecido o vive en otro lugar. Los dueños y las familias pueden inscribirse en las alertas gratuitas de Fraud Guard de la Ciudad, que envían un correo electrónico cuando se registra un documento que los nombra. Desde noviembre de 2025, la Ciudad también bloquea automáticamente las escrituras cuyo vendedor ya había muerto cuando supuestamente firmó.',
      fraudGuard: 'Inscríbase en las alertas gratuitas de Fraud Guard de la Ciudad',
      deedCheck: 'La revisión automática de la Ciudad que detiene el fraude de escrituras',
      helpTitle: 'Ayuda para dueños y familias',
      seeList: 'Ver las parcelas de este dueño en nuestra lista',
      cityListTitle: 'Lista de propiedades públicas de la Ciudad',
      cityList: 'La parcela está en la lista de propiedades públicas de la Ciudad.',
      cityListNames: (agency) => `La lista de propiedades públicas de la Ciudad nombra a ${agency} como dueño.`,
      cityListStatus: (status) => `Su estado allí: ${status}.`,
      cityStatuses: {
        'OWNED - AVAILABLE': ['indicada como disponible', 'El Land Bank la muestra en su mapa de propiedades que la gente puede solicitar.'],
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': ['indicada como disponible para un acuerdo de jardín', 'Se ofrece para cultivar bajo un acuerdo con el Land Bank.'],
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': ['indicada como disponible, sin permitir construcción', 'Se ofrece, pero no se puede construir nada en ella.'],
        'OWNED - AVAILABLE (NOT FOR SY)': ['indicada como disponible, pero no como patio lateral', 'Se ofrece, pero no al vecino de al lado como patio lateral.'],
        'OWNED - ON HOLD FOR AHD': ['reservada para vivienda asequible', 'Está apartada para viviendas asequibles, así que ahora no se ofrece a los vecinos.'],
        'OWNED - NOT AVAILABLE': ['no disponible', 'Las agencias de tierras de la Ciudad no la ofrecen ahora.'],
        'OWNED - PROCESSING APPLICANT, NOT AVAILABLE': ['alguien ha presentado una solicitud', 'Se está revisando una solicitud, así que ahora no se ofrece a nadie más.'],
        'OWNED - MANAGED AND NOT AVAILABLE': ['administrada y no disponible', 'Una agencia la cuida y no la ofrece.'],
        'OWNED - ON HOLD': ['en espera', 'Por ahora no se ofrece.'],
        'OWNED - SALE PENDING': ['venta pendiente', 'Hay una venta en trámite, así que no se ofrece a nadie más.'],
        'UNKNOWN - RESEARCH PENDING': ['todavía no se sabe', 'Las agencias de tierras de la Ciudad todavía lo están investigando.'],
        'OWNED - RFP RELEASED': ['ofrecida para desarrollo', 'Las agencias de tierras de la Ciudad pidieron propuestas para desarrollarla.'],
        'OWNED - ON HOLD FOR HOME SD': ['reservada para un programa de vivienda', 'Está reservada para un programa que la lista llama HOME SD, así que ahora no se ofrece a los vecinos.'],
        'OWNED - HELD FOR CITY COUNCIL MEMBER': ['reservada para el miembro del Concejo del distrito', 'Está reservada para el miembro del Concejo Municipal del distrito, así que ahora no se ofrece. La oficina del miembro puede decir por qué.'],
        'OWNED - TO BE FEATURED SOON': ['se ofrecerá pronto', 'Las agencias de tierras de la Ciudad planean ofrecerla pronto.'],
        'OWNED - NOT AVAILABLE (GSI PROJECT)': ['apartada para obras verdes de aguas pluviales', 'Está reservada para plantaciones que el Departamento de Agua construye para absorber la lluvia.'],
        'OWNED - COMPETITIVE BID POSTED': ['ofrecida por licitación', 'Las agencias de tierras de la Ciudad pidieron ofertas por ella.'],
      },
      sideYard: 'La Ciudad la marca como elegible para el programa de patio lateral, para el dueño de la casa de al lado.',
      agencies: {
        PUB: 'la Ciudad de Filadelfia',
        PLB: 'el Philadelphia Land Bank',
        PRA: 'la Autoridad de Redesarrollo de Filadelfia',
        PHDC: 'la Philadelphia Housing Development Corporation (PHDC)',
      },
      tangledTitle: 'El Tangled Title Fund, administrado por Philadelphia VIP',
      sheriffGuide: 'Grounded in Philly: ventas del sheriff',
      gjli: 'La Garden Justice Legal Initiative, para ayuda legal gratuita',
    },

    flags: {
      absentee: {
        outOfState: (where) => `El dueño recibe su correo en otro lugar: ${where} (fuera del estado).`,
        outsidePennsylvania: 'El dueño recibe su correo en otro lugar: fuera de Pensilvania.',
        outsideCity: (city) => `El dueño recibe su correo en otro lugar: ${city}, PA (fuera de Filadelfia).`,
        outsideCityUnknown: 'El dueño recibe su correo en otro lugar: fuera de Filadelfia.',
        poBox: 'El dueño recibe su correo en otro lugar: un apartado postal en Filadelfia.',
        elsewhere: 'El dueño recibe su correo en otro lugar: otra dirección en Filadelfia.',
        careful:
          'Esta es la dirección a la que la Ciudad envía las facturas de impuestos. Puede estar desactualizada, o pertenecer a un familiar, un abogado o un administrador, y un dueño que vive en otro lugar puede no saber cómo se ve hoy la propiedad.',
        next: 'Escriba al dueño a esta dirección para preguntarle antes de hacer algo en la propiedad, y pida a la Garden Justice Legal Initiative que revise cualquier acuerdo antes de que lo firme.',
      },
      // Word for word passage (docs/ETHICS.md, "Owner information"): three consecutive fixed sentences.
      possible_estate: {
        text: 'La persona que figura como dueña en los registros puede haber fallecido.',
        careful: 'Es posible que los familiares todavía tengan derecho a esta propiedad y no lo sepan.',
        next: 'Si usted conoce a la familia, el Tangled Title Fund (hasta $6,500 en ayuda legal) y Philadelphia VIP pueden ayudarla a conservarla. Las familias también pueden inscribirse en las alertas gratuitas de Fraud Guard de la Ciudad.',
      },
      tax_debt_2025: {
        text: (amount, years) =>
          `A julio de 2025, los registros de la Ciudad mostraban ${amount} en impuestos sobre bienes raíces sin pagar${years ? ` de ${plural(years, { one: '# año fiscal', other: '# años fiscales' })}` : ''}.`,
        careful:
          'Este es el último registro público, del 9 de julio de 2025, no el saldo de hoy: puede que el dueño haya pagado desde entonces, o que deba más. Unos tres años o más de impuestos sin pagar pueden llevar a una venta del sheriff, donde un lote que los vecinos cuidan puede venderse a un comprador de afuera.',
        next: 'Revise el saldo de hoy en el Tax Center de la Ciudad antes de confiar en esto. Si su cuadra cuida este lote, la guía de Grounded in Philly sobre las ventas del sheriff explica el riesgo y lo que usted puede hacer.',
      },
      sheriff_sales: {
        one: (sale) => `Vendido en una venta del sheriff el ${sale}.`,
        many: (n, sales) => `Vendido en ventas del sheriff ${n} veces: ${sales}.`,
        sale: (date, price) => (price ? `${date}, por ${price}` : date),
        andLast: (others, last) => `${others}; y ${last}`,
        careful:
          'En una venta del sheriff, la oferta ganadora cancela las deudas antiguas de la propiedad, así que un lote que los vecinos han cuidado puede pasar a un comprador de afuera. Una venta pasada no significa que la propiedad esté en venta ahora.',
        next: 'Si su cuadra cuida este lote, lea la guía de Grounded in Philly sobre las ventas del sheriff y pida ayuda legal gratuita a la Garden Justice Legal Initiative.',
      },
      years_since_sale: {
        lastSold: (year) => `Vendido por última vez en ${year}.`,
        notSoldSince: (year) => `No se ha vendido en el mercado abierto desde al menos ${year}.`,
        careful:
          'Aquí se dejan fuera las ventas por un precio simbólico y las ventas del sheriff; el historial completo está abajo. Muchas casas pasan de una generación a otra en las familias sin una venta nueva, así que mucho tiempo desde una venta no significa que el dueño haya abandonado la propiedad.',
        next: 'Si una familia heredó la propiedad sin una escritura nueva, el Tangled Title Fund y Philadelphia VIP pueden ayudarla a aclarar el título y conservarla.',
      },
      many_parcels: {
        text: (n) => `Este dueño tiene ${n} parcelas vacías en la ciudad.`,
        careful:
          'Relacionamos a los dueños por su nombre exacto en los registros de la Ciudad, así que un mismo dueño puede aparecer con varias grafías y dos dueños pueden compartir un nombre. Tener terrenos vacíos no es una falta por sí solo.',
        next: 'Use la lista para ver las otras parcelas de este dueño, y luego pida permiso por la vía legal: escriba al dueño y pida a la Garden Justice Legal Initiative que revise cualquier acuerdo.',
      },
      fast_resales: {
        since: (n, year) => `Vendido ${n} veces desde ${year}.`,
        inYear: (n, year) => `Vendido ${n} veces en ${year}.`,
        between: (n, first, last) => `Vendido ${n} veces de ${first} a ${last}.`,
        careful:
          'Las reventas rápidas pueden significar que la propiedad se está negociando para ganar dinero, y a veces una escritura falsificada. También pueden ser normales, como una familia que vende una casa heredada y el comprador que la revende después de repararla.',
        next: 'Mire quién vendió y quién compró en el historial de abajo. Los dueños y las familias pueden inscribirse en las alertas gratuitas de Fraud Guard de la Ciudad para enterarse cuando un documento los nombra.',
      },
      open_violations: {
        one: (when, what) => `L&I indica 1 infracción abierta${what ? `, por ${what}` : ''}${when ? `, del ${when}` : ''}.`,
        many: (n) => `L&I indica ${n} infracciones abiertas.`,
        mostRecent: (when, what) => (what ? `La más reciente, del ${when}, es por ${what}.` : `La más reciente es del ${when}.`),
        careful:
          'Una infracción es un aviso al dueño, que puede no tener los medios para corregirla, y la condición puede haber cambiado desde la inspección.',
        next: 'Reporte los problemas físicos, como basura tirada o un edificio abierto, a Philly311. Si conoce al dueño, avíselo: puede que no haya visto el aviso.',
      },
      unsafe: {
        text: (since) => (since ? `L&I indica que este edificio es inseguro, desde el ${since}.` : 'L&I indica que este edificio es inseguro.'),
        careful: 'No entre y mantenga alejados a los niños: L&I encontró que la estructura es insegura. No entre en ella ni intente asegurarla usted mismo.',
        next: 'Si se puede entrar, repórtelo a Philly311 para que la Ciudad lo selle.',
      },
      imminently_dangerous: {
        text: (since) =>
          since
            ? `L&I indica que este edificio es de peligro inminente, desde el ${since}.`
            : 'L&I indica que este edificio es de peligro inminente.',
        careful: 'L&I encontró que la estructura podría fallar en cualquier momento. Manténgase alejado de ella y mantenga alejados a los demás.',
        next: 'Reporte cualquier cambio, como ladrillos que caen o una puerta abierta, a Philly311.',
      },
    },

    history: {
      transfersTitle: 'Ventas y transferencias',
      transfersCaption: 'Cada venta y transferencia registrada de esta propiedad, la más reciente primero',
      date: 'Fecha',
      document: 'Documento',
      documentAndPrice: 'Documento y precio',
      fromAndTo: 'De y a',
      price: 'Precio',
      from: 'De',
      to: 'A',
      noDate: 'Sin fecha',
      noPrice: 'Ninguno registrado',
      share: (n) => `la parte de esta propiedad de una escritura de ${n} propiedades`,
      more: (n) => `y ${plural(n, { one: '# otro', other: '# otros' })}`,
      noTransfers: 'No hay escrituras registradas.',
      notInCopy: (parts) =>
        `Nuestra copia semanal no incluye ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0]} de esta parcela, así que esta página no puede decir si existen.`,
      partialParts: { transfers: 'los registros de escrituras', assessments: 'los avalúos', li: 'los registros de infracciones de L&I' },
      notInCopyOff: 'Los datos en vivo de la Ciudad pueden mostrarlos.',
      notInCopyFailed: 'La Ciudad no respondió. Inténtelo de nuevo para verlos.',
      recordsNote: 'Los registros de escrituras de la Ciudad están completos desde 2000. Puede que falten ventas más antiguas.',
      datesNote:
        'Cada fecha es la de la escritura y cada precio se redondea al dólar, como los muestra la página de propiedades de la Ciudad; la Ciudad registra una escritura días o semanas después. Cuando una escritura abarcó varias propiedades, el precio es la parte de esta propiedad.',
      documents: {
        DEED: 'Escritura',
        'DEED SHERIFF': 'Escritura del sheriff',
        "SHERIFF'S DEED": 'Escritura del sheriff',
        'DEED MISCELLANEOUS': 'Escritura diversa',
        'MISCELLANEOUS DEED': 'Escritura diversa',
        'DEED MISCELLANEOUS TAXABLE': 'Escritura diversa, sujeta a impuesto',
        'MISCELLANEOUS DEED TAXABLE': 'Escritura diversa, sujeta a impuesto',
        'DEED LAND BANK': 'Escritura del Land Bank',
        'DEED OF CONDEMNATION': 'Escritura de expropiación',
        'DEED - DECEASED': 'Escritura de una sucesión',
        'DEED - ADVERSE POSSESSION': 'Escritura por posesión adversa',
        'DEED RTT - OTHER': 'Otra escritura',
        'CERTIFICATE OF STOCK TRANSFER': 'Certificado de transferencia de acciones',
      },
      assessmentsTitle: 'Avalúos de la Ciudad',
      assessmentsCaption: 'El avalúo del valor de mercado de la Ciudad, por año',
      year: 'Año',
      marketValue: 'Valor de mercado según el avalúo',
      noValue: 'No registrado',
      noAssessments: 'No hay avalúos registrados.',
      assessmentNote: 'Un avalúo es el cálculo de la Ciudad del valor de mercado para los impuestos sobre la propiedad. No es un precio de venta.',
      chartLabel: (first, last, low, high) =>
        `Gráfico del avalúo de la Ciudad de ${first} a ${last}, entre ${low} y ${high}. Los mismos números están en la tabla de abajo.`,
      open: 'Abierta',
      liSummaryOpen: (n) => plural(n, { one: '# infracción abierta', other: '# infracciones abiertas' }),
      liSummaryLast: (date) => `Infracción más reciente: ${date}.`,
      liUnsafe: 'L&I indica que este edificio es inseguro.',
      liUnsafeSince: (date) => `L&I indica que este edificio es inseguro, desde el ${date}.`,
      liDangerous: 'L&I indica que este edificio es de peligro inminente.',
      liDangerousSince: (date) => `L&I indica que este edificio es de peligro inminente, desde el ${date}.`,
      liSince2016: (n) => `${plural(n, { one: '# infracción registrada', other: '# infracciones registradas' })} desde 2016.`,
      liSealed: (date) => `La Ciudad lo limpió y selló por última vez el ${date}.`,
      liDemolished: (date) => `La última demolición se completó el ${date}.`,
      liNeither: 'No figura como inseguro ni como de peligro inminente.',
      liNowTitle: 'L&I hoy',
      earlyDeed: 'Antes de 2000: de registros que la Ciudad dice que pueden estar incompletos.',
      timeline: {
        storyTitle: 'La historia de este lote',
        storySource: (source) => `De ${source}.`,
        noStory: 'Los registros que tenemos todavía no cuentan una historia sobre este lote.',
        title: 'Línea de tiempo',
        caption: 'Todo lo que hay registrado de esta propiedad, lo más reciente primero, por año',
        intro: 'Ventas, registros de L&I, apelaciones y registros de vacancia en una sola lista, lo más reciente primero. Apague un tipo para ocultarlo.',
        appeal: (board, kind) => (kind ? `${board}: ${kind}` : board),
        appealHearing: (date) => `audiencia ${date}`,
        show: 'Mostrar en la línea de tiempo',
        loading: 'Cargando la línea de tiempo de la copia semanal.',
        failed: 'No se pudo cargar la línea de tiempo de la copia semanal.',
        unpublished: 'Esta copia del mapa todavía no tiene archivos de línea de tiempo.',
        liMissing: 'Nuestra copia semanal no incluye registros de L&I de esta parcela, así que la línea de tiempo no puede decir si existen.',
        liMissingOff: 'Los datos en vivo de la Ciudad pueden mostrarlos.',
        none: 'No hay registros en la línea de tiempo.',
        allHidden: 'Todos los tipos de registro están apagados.',
        moreYears: (n) => `Mostrar ${plural(n, { one: '# año anterior', other: '# años anteriores' })}`,
        fewerYears: 'Mostrar solo los años recientes',
        noDate: 'Sin fecha',
        future: 'La Ciudad fechó esto en el futuro; su registro puede estar mal.',
        printTitle: 'Línea de tiempo, los 10 registros más recientes',
        recordColumn: 'Registro',
        whatColumn: 'Qué pasó',
        printWaiting: 'La página del lote en línea tiene la línea de tiempo completa; no estaba cargada cuando se imprimió esta página.',
        printMore: (n) => `${plural(n, { one: '# registro más antiguo', other: '# registros más antiguos' })} en la página del lote en línea.`,
        noPrice: 'sin precio registrado',
        to: (names) => `a ${names}`,
        times: (n) => `(${formatNumber(n)} veces)`,
        permit: 'Permiso',
        permitFor: (type, work) => `${type} para ${work}`,
        violation: 'Infracción',
        demolition: 'Demolición',
        byCity: 'por la Ciudad',
        privatePermit: 'con un permiso privado',
        demolitionWork: {
          city: 'Demolición de la Ciudad',
          complete: 'Demolición completa',
          small: 'Demolición de un edificio de hasta 3 pisos',
          large: 'Demolición de un edificio de más de 3 pisos o 40 pies',
          tank: 'Retiro de un tanque',
        },
        cleanSeal: 'Limpiado y sellado por la Ciudad',
        cleanSealClip: 'Limpiado y sellado por el Community Life Improvement Program de la Ciudad',
        kinds: {
          deed: 'Escritura',
          violation: 'Infracción',
          permit: 'Permiso',
          demolition: 'Demolición',
          unsafe: 'Aviso de edificio inseguro',
          imminently_dangerous: 'Aviso de edificio de peligro inminente',
          clean_seal: 'Limpieza y sellado',
          appeal: 'Apelación',
          vacancy: 'Registro de vacancia',
        },
        toggles: {
          deed: 'Ventas y transferencias',
          violation: 'Infracciones',
          permit: 'Permisos',
          demolition: 'Demoliciones',
          clean_seal: 'Limpieza y sellado',
          notice: 'Avisos de edificios inseguros y de peligro inminente',
          appeal: 'Apelaciones',
          vacancy: 'Registros de vacancia y de cuidado',
        },
        lists: {
          city_land: 'En la lista de terrenos vacíos de la Ciudad',
          city_building: 'En la lista de edificios vacíos de la Ciudad',
          june_2024_land: 'En la lista de terrenos vacíos de L&I de junio de 2024, tal como la mantiene Clean & Green Philly',
          june_2024_building: 'En la propia lista de edificios vacíos de junio de 2024 de Clean & Green Philly',
        },
        landcare: (program) =>
          program === 'community_landcare'
            ? 'Los vecinos empezaron a cuidar este lote con PHS Community LandCare'
            : 'PHS LandCare empezó a cuidar este lote',
        story: {
          cityDemolished: (year) => `Aquí había un edificio hasta ${year}, cuando la Ciudad lo demolió.`,
          privateDemolished: (year) => `Aquí había un edificio hasta ${year}, cuando se demolió con un permiso privado.`,
          newConstruction: (year) => `L&I emitió un permiso de construcción nueva aquí en ${year}.`,
          dangerous: (date) => `L&I indica que el edificio es de peligro inminente desde el ${date}.`,
          unsafe: (date) => `L&I indica que el edificio es inseguro desde el ${date}.`,
          sealed: (year, n) =>
            n > 1
              ? `La Ciudad envió por última vez a sus cuadrillas de limpieza y sellado aquí en ${year}; lo ha hecho ${formatNumber(n)} veces.`
              : `La Ciudad envió a sus cuadrillas de limpieza y sellado aquí en ${year}.`,
          sheriff: (year) => `Se vendió en una venta del sheriff en ${year}.`,
          cityList: (land, date, june) =>
            `La lista de ${land ? 'terrenos vacíos' : 'edificios vacíos'} de la Ciudad del ${date} lo incluye${june ? ', como lo hizo una lista de junio de 2024' : ''}.`,
          juneList: (land) =>
            land
              ? 'La lista de terrenos vacíos de L&I de junio de 2024 lo incluía.'
              : 'La lista de edificios vacíos de Clean & Green Philly de junio de 2024 lo incluía.',
          landcare: (year, program) =>
            program === 'community_landcare'
              ? `Los vecinos lo han cuidado con PHS Community LandCare desde ${year}.`
              : `PHS LandCare lo ha cuidado desde ${year}.`,
          sources: {
            demolitions: 'los registros de demolición de L&I',
            permits: 'los registros de permisos de L&I',
            notices: 'los registros de edificios inseguros y de peligro inminente de L&I',
            cleanSeal: 'los registros de limpieza y sellado de L&I',
            deeds: 'los registros de escrituras de la Ciudad',
            lists: (june) =>
              june
                ? 'la lista de propiedades vacías de la Ciudad, y la lista de L&I de junio de 2024 que mantiene Clean & Green Philly'
                : 'la lista de propiedades vacías de la Ciudad',
            june: (land) =>
              land ? 'la lista de L&I de junio de 2024, mantenida por Clean & Green Philly' : 'la lista de Clean & Green Philly de junio de 2024',
            landcare: 'la lista de PHS LandCare de los lotes que cuida',
          },
        },
      },
    },

    nearby: {
      intro: 'Lo que hay alrededor de este lote, para que el cuidado vaya donde más ayude.',
      careNote: 'Estos conteos muestran dónde más se necesita cuidado. No dicen nada sobre las personas que viven aquí.',
      areaSnapshot: 'En el área alrededor de este lote, de unas dos cuadras de ancho',
      within500: 'A 500 pies o menos de este lote',
      s12: (n) => `${plural(n, { one: '# persona baleada', other: '# personas baleadas' })} en los últimos 12 meses`,
      s36: (n) => `${plural(n, { one: '# persona baleada', other: '# personas baleadas' })} en los últimos 3 años`,
      killed: (n) => `${plural(n, { one: '# persona murió', other: '# personas murieron' })} en choques de tránsito desde 2019`,
      landcare: (n) => `${plural(n, { one: '# lote mantenido', other: '# lotes mantenidos' })} por PHS LandCare`,
      gardens: (n) => plural(n, { one: '# huerto comunitario', other: '# huertos comunitarios' }),
      hearings: (n) => `${plural(n, { one: '# audiencia', other: '# audiencias' })} todavía por venir sobre otras propiedades`,
      playgroundHeading: 'Parque infantil más cercano',
      playground: (name, meters) =>
        `${name}, a unos ${distanceWords(meters)} en línea recta${meters <= 400 ? ', a 5 minutos a pie o menos' : meters <= 800 ? ', a 10 minutos a pie o menos' : ''}.`,
      none: 'Todavía no hay conteos cercanos para este lugar.',
      showLayer: (label) => `Mostrar ${label} en el mapa`,
    },

    sources: {
      intro: 'De dónde viene cada parte de esta página, y qué tan reciente es.',
      live: (time) => `en vivo desde la Ciudad a las ${time}`,
      snapshot: (date) => `copia semanal del ${date}`,
      snapshotNoDate: 'copia semanal',
      newest: (date) => `registro más reciente ${date}`,
      taxSnapshot: 'la copia final de Clean & Green Philly, 9 de julio de 2025',
      by: (publisher) => `de ${publisher}`,
      correction: 'Reportar una corrección',
      correctionHelp: 'Abre un formulario en GitHub, ya llenado con esta parcela. Para enviarlo hace falta una cuenta gratuita de GitHub.',
      ownerNote:
        'Si usted es dueño de esta propiedad y un registro de la Ciudad sobre ella está mal, la oficina de la Ciudad que guarda el registro puede corregirlo en su origen: la Oficina de Evaluación de Propiedades para los nombres de dueños, las direcciones postales y los avalúos, el Departamento de Registros para las escrituras, y Licencias e Inspecciones para las infracciones y los permisos.',
    },

    ownerList: {
      title: 'Las parcelas de este dueño en nuestra lista',
      intro: (names) => `Parcelas de nuestra lista cuyo dueño está registrado como ${names}.`,
      others: 'Otras parcelas de nuestra lista cuyo dueño está registrado con los mismos nombres que este.',
      loading: 'Cargando la lista',
      missing: 'Esta lista no está disponible ahora.',
      open: (address) => `Abrir la página del lote de ${address}`,
      kind: (kind, confidence) => (confidence ? `${kind}, ${confidence.toLowerCase()}` : kind),
    },

    print: {
      printed: (date) => `Impreso desde Placekeepers el ${date}.`,
      recent: 'Historia reciente',
      moreOnline: (n) => `${plural(n, { one: '# registro más', other: '# registros más' })} en la página del lote en línea.`,
      lastAssessment: (year, value) => `Avalúo de la Ciudad de ${year}: ${value}.`,
      moreSources: (n) => `${plural(n, { one: '# fuente más', other: '# fuentes más' })} en la página del lote en línea.`,
      taxCenter: (url) => `Saldo de hoy: el Tax Center de la Ciudad, ${url}`,
      rules: 'Reglas de este lote',
    },

    rules: {
      intro:
        'Lo que dicen los registros de la Ciudad y federales que se aplica a este lote: designación histórica, zonificación y sus zonas superpuestas, registros de brownfields y apelaciones ante las juntas de la Ciudad. Nada de esto dice si se puede construir algo aquí. Pregunte a la oficina que se nombra antes de planear algo.',
      notOnList:
        'Las reglas se calculan cada semana para los lotes de nuestra lista, y esta parcela no está en ella. Atlas, el mapa de la Ciudad, muestra su zonificación y sus zonas superpuestas, y la Comisión Histórica puede decir si es histórica.',
      hearingTitle: 'Se acerca una audiencia',
      hearingSet: (board, date, time) =>
        `Hay una audiencia de ${board} sobre este lote fijada para el ${date}${time ? `, a las ${time}` : ''}.`,
      hearingBoard: { zoning: 'zonificación', li_review: 'la Junta de Revisión de L&I', building: 'la Junta de Normas de Construcción', other: 'una junta de la Ciudad' },
      seeAppeal: 'Ver la apelación',
      historicTitle: 'Designación histórica',
      inDistrict: (district, date) => `Este lote está en ${district}${date ? `, designado el ${date}` : ''}.`,
      districtName: (name) => (/district/i.test(name) ? `el ${name}` : `el distrito histórico ${name}`),
      listed: (date) => `Esta propiedad está incluida por sí sola en el Registro de Lugares Históricos de Filadelfia, desde el ${date}.`,
      listedNoDate: 'Esta propiedad está incluida por sí sola en el Registro de Lugares Históricos de Filadelfia.',
      listedInDistrict: (district) => `Esta propiedad está en el Registro de Lugares Históricos de Filadelfia como parte de ${district}.`,
      askFirst:
        'Los cambios aquí pueden necesitar la revisión de la Comisión Histórica; pregúnteles primero. Para un mural o un jardín, consulte a la Comisión antes de empezar.',
      contact: 'Comisión Histórica de Filadelfia: 215 686 7660, preservation@phila.gov.',
      confirm: 'La Ciudad pide a todos que confirmen con la Comisión el estado histórico de una propiedad.',
      commissionSite: 'El sitio web de la Comisión Histórica',
      projectReview: 'Cómo revisa la Comisión las obras en propiedades históricas',
      findHistoric: 'Encontrar una propiedad o un distrito histórico',
      notHistoric: 'Los registros de la Comisión Histórica no indican que este lote sea histórico. Pregunte a la Comisión para estar seguro.',
      zoningTitle: 'Zonificación',
      base: (code, group) => `Zonificación base: ${code}${group ? `, ${group}` : ''}.`,
      zoningGroups: {
        'RESIDENTIAL/MULTI-FAMILY/RESIDENTIAL MIXED-USE': 'un distrito residencial',
        'COMMERCIAL/COMMERCIAL MIXED-USE': 'un distrito comercial y de uso mixto',
        'INDUSTRIAL/INDUSTRIAL MIXED-USE': 'un distrito industrial',
        'SPECIAL PURPOSE': 'un distrito de propósito especial, como parques, instituciones o el aeropuerto',
      },
      basePending: 'Un proyecto de ley pendiente en el Concejo Municipal la cambiaría.',
      readBill: 'Leer el proyecto de ley',
      overlaysIntro: (n) => (n === 1 ? 'Una zona superpuesta agrega sus propias reglas aquí:' : `${formatNumber(n)} zonas superpuestas agregan sus propias reglas aquí:`),
      noOverlays: 'Ninguna zonificación superpuesta cubre este lote.',
      overlayKinds: { 1: 'Distrito superpuesto', 2: 'Regla especial', 3: 'Límite de pavimentación' },
      readRule: (section) => (section ? `Leer la regla: sección ${section} del Código de Zonificación` : 'Leer la regla en el Código de Zonificación'),
      sunset: (date) => `Está previsto que termine el ${date}.`,
      pending: (bill) => `Un proyecto de ley pendiente en el Concejo Municipal${bill ? `, el proyecto de ley ${bill},` : ''} la cambiaría.`,
      zoningNote:
        'La zonificación y las zonas superpuestas pueden cambiar lo que se permite en un lote. Los mapas de la Ciudad pueden ir atrasados respecto de proyectos de ley nuevos, así que consulte con la oficina de zonificación de la Ciudad antes de planear.',
      zoningHelp: 'La ayuda de zonificación y planificación de la Ciudad',
      atlasZoning: 'Esta dirección en Atlas, el mapa de la Ciudad',
      overlayMeaning: {
        '/CTR': 'Reglas adicionales para Center City: usos, letreros, alturas de edificios, estacionamiento y el frente de la calle.',
        '/NCO': 'Reglas que mantienen los edificios y ampliaciones nuevos en armonía con este vecindario.',
        '/NCA': 'Reglas para las tiendas y los usos a lo largo de esta calle comercial.',
        '/TOC': 'Reglas cerca de una estación de tren que favorecen viviendas y tiendas cerca del transporte público.',
        '/NIS': 'Reglas sobre dónde puede abrir un sitio de inyección supervisada. Cubre la mayor parte de la ciudad.',
        '/MIN': 'Reglas sobre viviendas asequibles en la vivienda nueva.',
        '/AHP': 'Reglas que fomentan conservar las viviendas asequibles.',
        '/AHC': 'Límites de altura cerca del aeropuerto.',
        '/HHC': 'Límites de altura cerca de un helipuerto.',
        '/ENV': 'Reglas que protegen características naturales como árboles, laderas empinadas y arroyos.',
        '/WWO': 'Reglas que protegen el Wissahickon Creek y sus arroyos.',
        '/DRC': 'Reglas para los terrenos a lo largo del río Delaware.',
        '/CDO': 'Reglas para la ribera central del Delaware.',
        '/FNE': 'Reglas adicionales para el Far Northeast.',
        '/NE': 'Reglas adicionales para el Northeast.',
        '/UED': 'Reglas sobre pantallas y letreros grandes iluminados.',
        council: 'Reglas adicionales que el Concejo Municipal fijó para parte de un distrito del Concejo.',
        flood: 'Reglas de protección contra inundaciones: límites a construir y rellenar terreno donde llegan las inundaciones.',
        steep: 'Límites a construir y nivelar en laderas empinadas.',
        coverage: 'Limita cuánto de un lote puede cubrirse con edificios y pavimento, para proteger el Wissahickon Creek.',
        animal: 'Un área donde el Código de Zonificación permite que la gente tenga algunos animales de granja, bajo sus reglas.',
        signs: 'Reglas sobre letreros y vallas publicitarias.',
        childCare: 'Reglas sobre el cuidado infantil familiar en casas.',
        parking: 'Reglas sobre cuánto estacionamiento necesitan los edificios nuevos.',
        loading: 'Reglas sobre las zonas de carga de los edificios.',
        dispensary: 'Reglas sobre qué tan cerca puede estar un dispensario de marihuana medicinal de otros lugares.',
        institutional: 'Reglas para las instituciones a lo largo de Germantown Avenue.',
        pump: 'Reglas cerca de una estación de bombeo de agua.',
        floorArea: 'Reglas sobre cuánta superficie construida pueden tener los edificios.',
        waterfront: 'Distancias mínimas para construir a lo largo de la ribera.',
        overlay: 'Un distrito superpuesto agrega sus propias reglas encima de la zonificación base aquí.',
        supplemental: 'Una regla especial que el Código de Zonificación agrega para esta área.',
      },
      brownfieldTitle: 'Registros de brownfields',
      // Word for word passage (docs/ETHICS.md, "Brownfield records"). The words in parentheses
      // explain "brownfield" for a reader who does not know the English word; they say nothing
      // about the ground being clean or safe.
      brownfield:
        'Se registró una evaluación o una limpieza federal de un "brownfield" (un terreno que pudo haber tenido contaminación) en esta dirección o cerca de ella. Haga analizar el suelo antes de cultivar alimentos.',
      brownfieldSite: (name, feet) => `${name}, a unos ${formatNumber(feet)} pies de este lote`,
      onLot: 'en este lote',
      brownfieldMore: (n) => `y ${plural(n, { one: '# registro más', other: '# registros más' })} a unos 330 pies o menos`,
      brownfieldNote:
        'Los registros de la EPA muestran dónde una subvención federal para brownfields pagó trabajos. No dicen qué hay en el suelo hoy.',
      soilTest: 'La prueba de suelo de Penn State Extension',
      gardenGuide: 'La guía de la EPA para cultivar en suelo de ciudad',
      epaRecord: 'Este registro en la EPA',
      appealsTitle: 'Apelaciones y audiencias',
      appealsIntro: 'Apelaciones ante las juntas de la Ciudad sobre esta propiedad, la más reciente primero, como las publica la Ciudad.',
      noAppeals: 'No hay apelaciones ante las juntas de la Ciudad registradas para esta propiedad.',
      appealsMissing:
        'Nuestra copia semanal se hizo sin los registros de apelaciones de la Ciudad, así que esta página no puede decir si existen.',
      appealsMissingOff: 'Los datos en vivo de la Ciudad pueden mostrarlos.',
      boards: {
        zoning: 'Junta de Ajuste de Zonificación',
        li_review: 'Junta de Revisión de L&I',
        building: 'Junta de Normas de Construcción',
        other: 'Otra junta de la Ciudad',
      },
      comingUp: 'Próximamente',
      filed: (date) => `Presentada el ${date}`,
      hearingOn: (date, time, upcoming) => `${upcoming ? 'Audiencia fijada para el' : 'Audiencia el'} ${date}${time ? `, a las ${time}` : ''}`,
      decidedOn: (date) => `Decidida el ${date}`,
      status: (status) => `Estado: ${status}`,
      decision: (decision) => `Decisión: ${decision}`,
      rco: (name) => `La Ciudad notificó a esta organización comunitaria registrada: ${name}.`,
      filedBy: 'Presentada por',
      ownerNamed: 'Dueño nombrado',
      namesNote: 'Los nombres son como los publica la Ciudad. Aparecen solo en la página de este lote, nunca en el mapa ni en las descargas.',
      grounds: 'Leer la apelación y sus fundamentos en la Ciudad (historial de la propiedad de L&I)',
      takePart: {
        zoning: 'Cómo participar en una audiencia de zonificación',
        li_review: 'La Junta de Revisión de L&I',
        building: 'La Junta de Normas de Construcción',
        other: 'El calendario de apelaciones de la Ciudad',
      },
      calendar: 'El calendario de audiencias de la Ciudad',
      decisions: {
        'GRANTED/PROV': 'Concedida con condiciones',
        'DENIED/PROV': 'Denegada con condiciones',
        'DISMI/ENFORC': 'Desestimada',
        'ADMIN/REVIEW': 'Enviada a revisión administrativa',
        'HELD/INFO': 'En espera de más información',
        NEWHEARNOT: 'No se concedió una nueva audiencia',
        BOARDAKNOWL: 'Reconocida por la junta',
        'LATE-APPRVD': 'Apelación tardía aprobada',
        'CITY AFFIRMED': 'Se mantiene la decisión de la Ciudad',
        AFFIRMED: 'Se mantiene la decisión de la Ciudad',
      },
      missing: {
        historic:
          'Nuestra copia semanal se hizo sin el registro histórico, así que esta página no puede decir si este lote es histórico. Pregunte a la Comisión Histórica.',
        overlays:
          'Nuestra copia semanal se hizo sin las zonas superpuestas de zonificación, así que esta página no puede enumerarlas. Atlas, el mapa de la Ciudad, las muestra.',
        brownfields:
          'Nuestra copia semanal se hizo sin los registros de brownfields de la EPA, así que esta página no puede decir si hay alguno cerca.',
      },
      none: 'Ninguno de estos registros nombra este lote.',
    },
  },
};

export default es;
