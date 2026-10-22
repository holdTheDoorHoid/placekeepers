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
import { formatDecimal, formatMoney, formatNumber, plural } from '../format.ts';

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
    listed: 'Ofrecido por las agencias de tierras de la Ciudad',
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
    assessor_vacant_land: 'El tasador lo clasifica como terreno vacío',
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
    assessor_exterior: 'El tasador anotó que su exterior está vacío o sellado',
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
    listed: 'Ofrecidos por las agencias de tierras de la Ciudad',
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
      'Solo se muestran las parcelas que las agencias de tierras de la Ciudad ofrecen. Una parcela que el mapa no considera vacía no se dibuja; el mapa propio del Land Bank las muestra todas.',
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

  options: {
    title: 'Privacidad y datos en vivo',
    privacyLink: 'Cómo cuida Placekeepers su privacidad',
    turnOn: 'Activar los datos en vivo de la Ciudad',
    resetNote: 'Su elección sobre los datos en vivo de la Ciudad no cambia.',
  },
};

export default es;
