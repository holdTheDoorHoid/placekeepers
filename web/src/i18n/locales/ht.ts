// Haitian Creole (ht): the interface text of web/src/strings.ts, key for key.
//
// Translated for issue #49, part B. Every key left out shows the English text. How to translate,
// and how to check the result, is in docs/TRANSLATING.md; the key terms are in
// docs/i18n/glossary-ht.md. Spelling follows the Akademi Kreyòl Ayisyen, and the reader is
// addressed as "ou".
//
// Rules: keep each key's meaning and every value a template shows (the tests check), no dashes
// as punctuation, and proper names as they are (Placekeepers, Philly311, LandCare).

import type { Catalog } from '../catalog.ts';
import { formatDecimal, formatNumber, plural } from '../format.ts';

/** A change in percent in words: "monte 61%", "bese 3%", "pa chanje". */
function changeWords(n: number): string {
  if (n > 0) return `monte ${formatNumber(n)}%`;
  if (n < 0) return `bese ${formatNumber(-n)}%`;
  return 'pa chanje';
}

/** " (plis oswa mwens 6 pwen)", or nothing when there is no margin: a survey's margin of error. */
function giveOrTake(margin: number | null, unit: 'points' | 'homes'): string {
  if (margin === null) return '';
  return ` (plis oswa mwens ${unit === 'points' ? `${formatNumber(margin)} pwen` : formatNumber(margin)})`;
}

const ht: Catalog = {
  app: {
    name: 'Placekeepers',
    tagline: 'Yon kat gratis pou vwazen Filadèlfi ki pran swen blòk yo.',
    mapLabel: 'Kat Filadèlfi. Lis kote yo ak lis memoryal yo sou paj sa a montre menm bagay yo an tèks.',
    loadingMap: 'Kat la ap chaje',
    mapFailed: 'Kat la pa t ka louvri nan navigatè sa a. Eseye yon lòt navigatè, oswa mete sa a ajou.',
    sampleData: 'Done egzanp pou fè tès. Se pa vrè kote yo ye.',
    earlyPreview: 'Vèsyon 0.4: yon premye vèsyon piblik. Verifye enfòmasyon yo ak Vil la anvan ou aji.',
    followAlong: 'Swiv pwojè a',
    skipToList: 'Ale nan lis kote yo',
    hideNote: 'Kache',
    hideNoteLabel: 'Kache nòt sa a',
    close: 'Fèmen',
    notAffiliated: 'Pa gen okenn relasyon ak Vil Filadèlfi ni ak SEPTA. Se pa konsèy jiridik.',
    licenses: 'Kòd: GPL-3.0. Done: chak sous gen pwòp lisans li. Tèks: Creative Commons BY-SA 4.0.',
  },

  content: {
    tableLabel: 'Tablo, li glise sou kote',
    removalEmail: (email) =>
      `Ekri nou nan [${email}](mailto:${email}). Nou pa itilize yon fòm piblik pou sa, paske yon demann pou retire yon non se yon bagay pèsonèl ak prive.`,
    removalComingSoon: (issueUrl) =>
      `N ap prepare yon adrès imèl prive pou demann sa yo, li ap disponib byento. Jiskaske li egziste, kat la pa montre okenn non ditou, epi ou ka fè demann lan nan yon [pwoblèm sou GitHub](${issueUrl}). Nenpòt moun ka li yon pwoblèm sou GitHub, kidonk ekri sèlman nimewo memoryal la oswa kote li ye: ou pa bezwen bay yon non, yon rezon, ni di ki moun ou ye.`,
  },

  language: {
    button: 'Lang',
    buttonLabel: (name) => `Lang: ${name}. Chwazi yon lòt lang`,
    title: 'Lang',
    intro: 'Chwazi lang pou sit sa a. Paj la louvri ankò nan lang sa a, epi navigatè sa a sonje chwa ou.',
    inUse: 'N ap itilize l',
    notReady: 'Tradiksyon an ap fèt',
    listLabel: 'Lang yo',
    aiNote: 'Entèlijans atifisyèl te ede tradui sa a, e yon moun ki pale lang lan depi li piti poko verifye l.',
    fixLink: 'Korije yon tradiksyon',
    pageInEnglish: 'Paj sa a poko tradui, se poutèt sa li parèt an angle.',
    offerLabel: 'Òf lang',
  },

  units: {
    meters: (n) => `${formatNumber(n)} mèt`,
    kilometers: (km) => `${formatDecimal(km, 1)} kilomèt`,
  },

  header: {
    settings: 'Paramèt',
    share: 'Kopye lyen an',
    shareDone: 'Lyen an kopye. Nenpòt moun ki louvri l ap wè menm kat sa a.',
    shareDoneNoMap: 'Lyen an kopye. Li pa gen kote kat la ye ladan l, paske kat la ap montre kote ou ye.',
    shareFailed: 'Nou pa t ka kopye lyen an. Kopye adrès la nan navigatè ou olye de sa.',
    dataStatus: 'Eta done yo',
  },

  nav: {
    menu: 'Meni',
    menuTitle: 'Meni sit la',
    menuLabel: 'Paj sit la',
    map: 'Kat',
    landBank: 'Land Bank an chif',
    pages: [
      { slug: 'about', label: 'Apwopo' },
      { slug: 'why', label: 'Poukisa sa mache' },
      { slug: 'how', label: 'Kijan pou fè l' },
      { slug: 'responsibly', label: 'Itilize l avèk responsablite' },
      { slug: 'vacant-land', label: 'Kijan nou jwenn teren vid' },
      { slug: 'streetcomplete', label: 'Verifye estasyon bis yo' },
      { slug: 'terms', label: 'Kondisyon' },
      { slug: 'privacy', label: 'Vi prive' },
      { slug: 'contact', label: 'Kontakte nou' },
    ],
  },

  views: {
    groupLabel: 'Chwazi yon vi',
    field: 'Nan ri',
    analysis: 'Analiz',
    fieldLong: 'Vi nan ri',
    analysisLong: 'Vi analiz',
    fieldHint: 'Pou lè ou kanpe sou blòk la: kote ki toupre ak premye etap legal la.',
    analysisHint: 'Pou òganizatè yo: lantiy, filtè, detay ak yon lis ki klase.',
    auto: 'Chwazi yon vi selon gwosè ekran mwen',
    autoHint: 'Telefòn yo jwenn vi nan ri a; pi gwo ekran yo jwenn vi analiz la.',
  },

  freshness: {
    checking: 'N ap verifye done yo',
    ok: (date) => `Done ki soti ${date}`,
    stale: 'Gen kèk done ki pa ajou',
    failing: 'Gen kèk done ki pa chaje',
    unknown: 'Nou pa konnen eta done yo',
  },

  field: {
    nearMe: 'Toupre mwen',
    nearMeBusy: 'N ap chèche kote ou ye',
    nearMeDenied: 'Lokalizasyon an fèmen pou sit sa a. Ou ka toujou deplase kat la ak men ou.',
    nearMeUnavailable: 'Aparèy ou a pa t ka jwenn kote ou ye. Ou ka toujou deplase kat la ak men ou.',
    nearMeUnsupported: 'Navigatè sa a pa kapab pataje kote ou ye. Ou ka toujou deplase kat la ak men ou.',
    nearMeOutside: 'Sanble ou deyò Filadèlfi. Kat sa a kouvri Filadèlfi sèlman.',
    nearMePrivacy: 'Kote ou ye rete sou aparèy ou a. Placekeepers pa janm voye l okenn kote, e li pa janm mete l nan yon lyen.',
    youAreHere: 'Ou isit la',
    stopLocation: 'Sispann itilize kote mwen ye',
    locationInUse: 'N ap itilize kote ou ye. Li rete sou aparèy sa a, e li pa antre nan okenn lyen ou kopye.',
    stop: 'Sispann',
    myLists: 'Lis mwen yo',
    listsTitle: 'Lis ki sere',
    chipsLabel: 'Kouch prensipal yo',
    moreLayers: 'Plis kouch',
    layersTitle: 'Kouch yo',
  },

  chips: {
    lots: 'Teren',
    streets: 'Ri',
    memorials: 'Memoryal',
    stops: 'Estasyon bis',
    comingSoon: 'byento',
  },

  sheet: {
    title: 'Sa ou ka fè toupre',
    show: 'Montre kote ki toupre',
    hide: 'Kache kote ki toupre',
    countLabel: (n) => plural(n, { other: '# kote' }),
    zoomIn: 'Deplase kat la oswa zoum sou yon katye pou wè kote ki toupre.',
    finding: 'N ap chèche kote ki toupre.',
    noLotsLayer: 'Limen kouch Teren an oswa kouch Estasyon bis la pou wè kote ki toupre.',
    nothingHere: 'Pa gen okenn teren vid oswa bilding vid ki matche ak paramèt ou yo nan pati sa a nan kat la.',
    nothingHereStops: 'Pa gen okenn teren vid, bilding vid oswa estasyon bis ki matche ak paramèt ou yo nan pati sa a nan kat la.',
    noStopsHere: 'Pa gen okenn estasyon bis oswa tramway ki matche ak paramèt ou yo nan pati sa a nan kat la.',
    showOnMap: 'Montre sou kat la',
    openLotPage: 'Louvri paj teren an',
    nearestToYou: 'Pi pre ou yo an premye.',
    nearestToCenter: 'Pi pre mitan kat la yo an premye. Deplase kat la, oswa peze Toupre mwen.',
    noneWithSuggestion: 'Pa gen okenn kote isit la ki gen yon sijesyon ki limen. Limen sijesyon yo nan Paramèt, oswa deplase kat la.',
    showMore: 'Montre plis kote',
    distance: (meters, fromYou) => {
      const feet = meters * 3.28084;
      const far = feet < 1000 ? `${formatNumber(Math.max(10, Math.round(feet / 10) * 10))} pye` : `${formatDecimal(feet / 5280, 1)} mil`;
      return `Anviwon ${far} de ${fromYou ? 'ou' : 'mitan kat la'}`;
    },
  },

  place: {
    kindLot: 'Teren vid',
    kindBuilding: 'Bilding vid',
    kindUnknown: 'Pasèl vid',
    parcel: (id) => `Pasèl ${id}`,
    priority: (score, lens) => `Priyorite ${score} sou 100 pou lantiy ${lens.toLowerCase()}`,
    mainReason: (label) => `Rezon prensipal: ${label}.`,
    bestSuggestion: 'Sa ou ka fè',
    firstStep: 'Premye etap legal',
    cost: (cost) => `Pri: ${cost}`,
    confidence: { 1: 'Nou pa two sèten li vid', 2: 'Pwobableman li vid', 3: 'Gen anpil chans li vid' },
    confidenceTitle: 'Konbyen nou sèten',
    ownerTitle: 'Kalite pwopriyetè',
    landcare: 'PHS LandCare deja ap antretni l',
    listed: 'Ajans tè Vil la mete l sou lis kòm disponib',
    suggestionsTitle: 'Sijesyon',
    clearSelection: 'Efase seleksyon an',
    selectedTitle: 'Kote ou chwazi a',
  },

  ownerTypes: {
    0: 'Enkoni',
    1: 'Yon moun',
    2: 'Yon konpayi',
    3: 'Vil Filadèlfi',
    4: 'Philadelphia Land Bank',
    5: 'Otorite Redevlopman',
    6: 'Otorite lojman',
    7: 'Òganizasyon san bi likratif',
    8: 'Yon lòt ajans piblik',
  },

  why: {
    title: 'Poukisa nòt sa a',
    caption: 'Valè chak faktè sou 100, pwa li, ak pwen li ajoute nan nòt la',
    intro: 'Nòt la se yon mwayèn ki konte pwa chak faktè. Chak faktè ale de 0 a 100, kote 100 vle di pi gwo bezwen.',
    factor: 'Faktè',
    value: 'Sou 100',
    weight: 'Pwa',
    adds: 'Li ajoute',
    noData: 'pa gen done',
    off: 'fèmen',
    total: 'Nòt',
    missingNote: 'Faktè ki pa gen done pou kote sa a pa antre nan mwayèn li.',
  },

  reasons: {
    title: 'Poukisa nou panse li vid',
    againstTitle: 'Sa ki fè nou ezite',
    notPublished: 'Rezon pou kote sa a poko pibliye.',
    city_land: (date) =>
      date ? `Vil la mete l sou lis kòm teren ki gen anpil chans pou l vid (lis la gen dat ${date})` : 'Vil la mete l sou lis kòm teren ki gen anpil chans pou l vid',
    city_building: (date) =>
      date
        ? `Vil la mete l sou lis kòm bilding ki gen anpil chans pou l vid (lis la gen dat ${date})`
        : 'Vil la mete l sou lis kòm bilding ki gen anpil chans pou l vid',
    assessor_vacant_land: 'Evalyatè a klase l kòm teren vid',
    no_building: 'Pa gen okenn bilding sou pasèl la',
    demolished: (year) =>
      year ? `Yo demoli l an ${year}, e pa gen anyen ki bati depi lè sa a` : 'Yo demoli l, e pa gen anyen ki bati depi lè sa a',
    vacant_lot_record: 'L&I te anrejistre yon vyolasyon oswa yon plent sou teren vid nan dènye de lanne yo',
    landcare: 'Li nan PHS LandCare, ki pran swen teren vid yo',
    sealed: (year) =>
      year ? `Vil la te sele l an ${year}, san okenn pèmi depi lè sa a` : 'Vil la te sele l, san okenn pèmi depi lè sa a',
    unsafe: 'L&I mete l sou lis kòm pa an sekirite, san okenn pèmi depi lè sa a',
    imminently_dangerous: 'L&I te deklare l yon danje imedya, san okenn pèmi depi lè sa a',
    vacant_building_record: 'L&I te anrejistre yon vyolasyon oswa yon plent sou pwopriyete vid nan dènye de lanne yo',
    assessor_exterior: 'Evalyatè a te note deyò li kòm vid oswa sele',
    built_since: (year) =>
      year
        ? `Yo te bay yon nouvo pèmi konstriksyon an ${year}, kidonk kapab gen yon bilding la kounye a`
        : 'Yo te bay yon nouvo pèmi konstriksyon, kidonk kapab gen yon bilding la kounye a',
    construction_starting: (year) =>
      year
        ? `Yo te bay yon nouvo pèmi konstriksyon an ${year}, kidonk konstriksyon an kapab ap kòmanse`
        : 'Yo te bay yon nouvo pèmi konstriksyon, kidonk konstriksyon an kapab ap kòmanse',
    side_yard: 'Moun ki posede kay kote moun ap viv la, ki bò kote l, se li menm ki posede l tou, kidonk li kapab yon lakou sou kote',
    land_use_shows_use: 'Kat itilizasyon tè Vil la montre l ap itilize',
    recent_permit: 'Yo te bay yon pèmi pou travay konstriksyon oswa pou zonaj nan dènye de lanne yo',
    building_stands: 'Gen anprent yon bilding sou li, byenke dosye yo di se teren vid',
    homestead: 'Pwopriyetè a gen yon egzanpsyon homestead: dosye Vil la di gen yon moun k ap viv isit la, oswa te viv isit la',
  },

  lens: {
    title: 'Lantiy',
    presets: 'Chwa ki pare',
    presetActive: 'n ap itilize l',
    weightLabel: (factor) => `Pwa pou ${factor}`,
    weightValue: (w) => (w === 0 ? 'Fèmen' : `${w} sou 5`),
    resetWeights: 'Remete pwa yo',
    allOff: 'Tout faktè fèmen. Limen youn pou kolore teren yo.',
    allOffFor: (appliesTo) =>
      appliesTo === 'segment'
        ? 'Tout faktè fèmen. Limen youn pou kolore ri yo.'
        : appliesTo === 'stop'
          ? 'Tout faktè fèmen. Limen youn pou kolore estasyon bis ak tramway yo.'
          : 'Tout faktè fèmen. Limen youn pou kolore teren yo.',
    explainToggle: 'Poukisa faktè sa a',
    shown: (layer, lens) => `Kounye a n ap montre "${layer}", kolore ak lantiy ${lens.toLowerCase()} la.`,
    notShown: (layer) => `Kat la pa ap montre lantiy sa a sou "${layer}" kounye a.`,
    showOnMap: 'Montre l sou kat la',
    legendLow: 'Priyorite ki pi ba',
    legendHigh: 'Priyorite ki pi wo',
    legendNoData: 'Pa gen nòt',
  },

  filters: {
    title: 'Filtè',
    intro:
      'Chwazi bouton yo pou redui teren yo sou kat la, nan lis ki klase a ak sou graf la. Yon gwoup kote pa gen okenn bouton ki chwazi montre tout bagay.',
    ownerType: 'Kalite pwopriyetè',
    landcare: 'Deja nan LandCare',
    inLandcare: 'PHS LandCare ap antretni l',
    notInLandcare: 'Pa nan LandCare',
    confidence: 'Konbyen nou sèten',
    kind: 'Teren oswa bilding',
    listed: 'Ajans tè Vil la mete l sou lis',
    clear: 'Efase filtè yo',
    showAll: 'Montre tout',
    noneSelected: (group) => `Pa gen anyen ki chwazi anba "${group}", kidonk pa gen okenn teren k ap parèt.`,
    narrowedNote: (n) =>
      n === 1 ? 'Yon filtè nan vi analiz la ap redui kote sa yo.' : `${formatNumber(n)} filtè nan vi analiz la ap redui kote sa yo.`,
  },

  permission: {
    title: 'Premye etap pou jwenn pèmisyon',
    short: {
      0: 'Poko gen okenn wout klè',
      1: 'Community LandCare',
      2: 'Akò jaden oswa lisans',
      3: 'Mande PHDC',
      4: 'Mande ajans piblik la',
      5: 'Mande pwopriyetè a',
    },
    long: {
      0: 'Poko gen okenn wout klè: dosye Vil la pa bay non okenn pwopriyetè',
      1: 'PHS LandCare deja pran swen li: Community LandCare',
      2: 'Vil la oswa Land Bank posede l: yon akò jaden oswa yon lisans',
      3: 'Otorite Redevlopman oswa PHDC posede l: mande PHDC',
      4: 'Otorite lojman an oswa yon lòt enstitisyon piblik posede l: mande ajans lan',
      5: 'Yon pwopriyetè prive: mande pwopriyetè a',
    },
    notPublished: 'Poko pibliye',
    filterHelp:
      'Ki moun pou mande an premye, selon pwopriyetè dosye Vil la bay non. Se yon kalite etap, se pa yon mezi pou konnen ki chans yon moun gen pou l di wi.',
    noRoute: 'Poko gen okenn wout klè: dosye Vil la pa bay non okenn pwopriyetè. Paj teren an montre sa nou konnen.',
    seeLotPage: 'Paj teren an bay lis wout legal pou kote sa a.',
  },

  layers: {
    title: 'Kouch yo',
    show: (label) => `Montre ${label}`,
    details: 'Sou kouch sa a',
    settings: 'Paramèt kouch la',
    sources: 'Sous yo',
    legend: 'Lejand',
    license: 'Lisans',
    noData: 'Poko gen done pibliye',
    dataError: 'Kouch sa a pa t ka chaje.',
    resetAll: 'Remete sou valè orijinal yo',
    resetDone: 'Paramèt yo tounen sou valè orijinal yo.',
    guide: 'Kijan ou ka ede amelyore kouch sa a',
  },

  settings: {
    title: 'Paramèt',
    intro:
      'Tout sa ki sou kat la se yon paramèt. Chwa ou yo sere nan navigatè sa a ak nan lyen an, eksepte chwa vi prive ou yo, ki rete nan navigatè sa a sèlman.',
    viewTitle: 'Vi',
    layersTitle: 'Kouch yo ak paramèt yo',
    lensTitle: 'Pwa lantiy yo',
    suggestionsTitle: 'Sijesyon pou montre',
    suggestionShow: (label) => `Montre "${label}"`,
    resetTitle: 'Rekòmanse',
    resetHelp: 'Remete chak kouch, chak paramèt ak chak pwa sou valè orijinal vi sa a, epi bliye kopi ki sere nan navigatè sa a.',
    reset: 'Remete sou valè orijinal yo',
    storageNote: 'Sere nan navigatè sa a sèlman. Placekeepers pa gen kont, ni cookies, ni okenn swivi.',
  },

  analysis: {
    leftTitle: 'Lantiy, filtè ak kouch',
    rightTitle: 'Detay',
    openLeft: 'Lantiy ak kouch',
    openRight: 'Detay',
    closePanel: 'Fèmen panno a',
    areaTitle: 'Nan pati sa a nan kat la',
    areaLots: (n) => plural(n, { other: '# teren vid' }),
    areaBuildings: (n) => plural(n, { other: '# bilding vid' }),
    areaHigh: (n) => `${formatNumber(n)} ladan yo gen anpil chans pou yo vid`,
    areaLandcare: (n) => `PHS LandCare deja ap antretni ${formatNumber(n)} ladan yo`,
    areaEmpty: 'Pa gen okenn teren vid oswa bilding vid ki matche ak paramèt ou yo isit la. Eseye zoum soti oswa chanje filtè yo.',
    areaHint: 'Chwazi yon teren sou kat la oswa nan lis la pou wè poukisa li gen nòt li a.',
    sampleArea:
      'Lè ou zoum soti jan sa a, kat la montre sèlman yon echantiyon teren vid ak bilding vid, kidonk yo pa konte isit la. Zoum antre pou konte chak kote.',
    sampleList:
      'Zoum antre pou fè lis chak kote. Lè ou zoum soti jan sa a, kat la montre sèlman yon echantiyon teren vid ak bilding vid, kidonk yon lis oswa yon graf isit la t ap kite kèk kote deyò.',
    sampleTab: 'zoum antre',
    tableCaption: 'Kote ki nan vi a, klase selon melanj lantiy kounye a',
    rank: 'Ran',
    place: 'Kote',
    score: 'Nòt',
    reason: 'Rezon prensipal',
    save: 'Sere',
    sortHighFirst: 'Pi gwo nòt la an premye. Chwazi pou mete pi ba a an premye.',
    sortLowFirst: 'Pi ba nòt la an premye. Chwazi pou mete pi gwo a an premye.',
    tableEmpty: 'Pa gen anyen pou klase nan vi a.',
    noScores: 'Nòt priyorite yo poko pibliye, kidonk lis sa a suiv òd nimewo pasèl yo.',
    tableMore: (shown, total) =>
      `N ap montre ${formatNumber(shown)} premye yo sou ${formatNumber(total)}. Zoum antre oswa redui filtè yo pou wè rès la, oswa telechaje yo tout.`,
    drawerLabel: 'Kote ki nan vi a',
    tabTable: 'Lis ki klase',
    tabPlot: 'Bezwen ak premye etap',
    tabLists: 'Lis ki sere',
    tabMemorials: 'Memoryal',
    tabBlocks: 'Blòk ri yo',
  },

  plot: {
    title: 'Bezwen ak premye etap pou jwenn pèmisyon',
    intro:
      'Chak pwen se yon kote ki nan vi a. Orizontalman: priyorite li selon melanj lantiy ou, de 0 a 100. Vètikalman: premye etap pou jwenn pèmisyon, yon kalite etap, se pa yon mezi pou konnen ki chans yon moun gen pou l di wi. Chwazi yon pwen pou louvri paj teren li.',
    axisX: 'Priyorite selon melanj lantiy ou',
    empty: 'Pa gen kote nan vi a pou mete sou graf la.',
    noScore: (n) => `${plural(n, { other: '# kote' })} pa gen nòt, kidonk ${n === 1 ? 'li' : 'yo'} pa parèt.`,
    noStep: (n) => `${plural(n, { other: '# kote' })} poko gen premye etap pibliye, kidonk ${n === 1 ? 'li' : 'yo'} pa parèt.`,
    dot: (place, score, step) => `${place}: priyorite ${score}. ${step}.`,
    tableNote: 'Lis ki klase a montre menm kote yo, ak menm premye etap la, pou klavye ak lektè ekran.',
    capped: (shown, total) =>
      `N ap montre ${formatNumber(shown)} kote ki gen pi gwo nòt yo sou ${formatNumber(total)} ki nan vi a. Zoum antre pou wè yo tout.`,
    summary: (rows) => `Kote ki nan vi a selon premye etap pou jwenn pèmisyon: ${rows}.`,
    rowSummary: (label, n) => `${label}, ${plural(n, { other: '# kote' })}`,
  },

  export: {
    title: 'Telechaje kote sa yo',
    help: (limit) =>
      `Yon fichye ak jiska ${formatNumber(limit)} kote ak sa paj chak teren di sou pwopriyetè a, ansanm ak drapo pwopriyetè yo. Premye liy fichye a montre kondisyon itilizasyon yo.`,
    csv: 'Telechaje CSV',
    geojson: 'Telechaje GeoJSON',
    inView: 'Kote ki nan vi a',
    working: (done, total) => `N ap rasanble detay pwopriyetè yo: ${formatNumber(done)} sou ${formatNumber(total)} fichye`,
    done: (n) => `Telechaje ${plural(n, { other: '# kote' })}.`,
    leftOut: (n, limit) =>
      `${plural(n, { other: '# lòt kote' })} pa antre, paske yon telechajman pa ka gen plis pase ${formatNumber(limit)}. Zoum antre oswa redui filtè yo pou telechaje rès la.`,
    withoutDetails: (n) => `${plural(n, { other: '# kote' })} pa gen detay pibliye, kidonk kolòn pwopriyetè yo vid.`,
    nothing: 'Pa gen kote pou telechaje.',
    sampleOff: 'Telechajman yo gen chak kote ki nan vi a, e lè ou zoum soti jan sa a kat la montre sèlman yon echantiyon. Zoum antre pou telechaje.',
    failed: 'Nou pa t ka fè telechajman an. Eseye ankò nan yon ti moman.',
    yes: 'wi',
    no: 'non',
    termsLine: (url) => `Ekspòtasyon Placekeepers: sèlman pou swen kominote a ak aksyon legal. Li kondisyon itilizasyon yo an premye: ${url}`,
    englishColumns: 'Non kolòn yo an angle nan tout lang pou fichye yo ka konbine epi li ankò.',
    madeLine: (n, title, day, dataDay) =>
      `${plural(n, { other: '# kote' })} ki soti nan ${title}. Fèt nan ${day}${dataDay ? ` ak done semèn ${dataDay}` : ''}.`,
    ownerLine:
      'Non pwopriyetè yo ak adrès postal yo se jan Vil la pibliye yo. Chak drapo pwopriyetè gen yon nòt prekosyon ak yon pwochen etap pwoteksyon: li yo sou paj teren an anvan ou aji. Se pa konsèy jiridik.',
    scoreLine: (lens, weights) => `Nòt yo itilize lantiy ${lens} la ak pwa sa yo: ${weights}.`,
    greeningLine: (caution) => `Sou sijesyon amenajman vèt yo: ${caution}`,
    placemakingLine: (caution) => `Sou jaden, plas pou chita ak atizay: ${caution}`,
  },

  lists: {
    title: 'Lis ki sere',
    privacy:
      'Lis yo rete nan navigatè sa a, sou aparèy sa a. Nou pa voye anyen okenn kote. Pou mete yon lis sou yon lòt aparèy oswa pou pataje l, telechaje l kòm yon fichye epi louvri fichye sa a la.',
    notKept:
      'Navigatè sa a pa ap kenbe lis yo kounye a, petèt paske ou nan yon fenèt prive oswa estokaj la bloke. Telechaje lis ou a anvan ou fèmen paj la.',
    empty: 'Poko gen lis. Sere yon kote nan fich li, nan lis ki klase a oswa nan paj teren li, epi yon lis kòmanse.',
    inUse: 'Lis n ap itilize a',
    defaultName: 'Lis mwen',
    untitled: 'Lis',
    newList: 'Nouvo lis',
    newName: 'Non pou nouvo lis la',
    create: 'Fè lis la',
    rename: 'Chanje non',
    renameLabel: 'Nouvo non pou lis sa a',
    saveName: 'Sere non an',
    cancel: 'Anile',
    delete: 'Efase lis sa a',
    made: (name) => `Lis "${name}" fèt. Kote ou sere kounye a ap ale ladan l.`,
    renamed: (name) => `Lis la rele "${name}" kounye a.`,
    deleted: (name) => `"${name}" efase nan navigatè sa a.`,
    confirmDelete: (name, n) =>
      `Efase "${name}" ak ${plural(n, { other: '# kote' })} li yo nan navigatè sa a? Pa gen fason pou fè l tounen sof si ou te telechaje l.`,
    count: (n) => plural(n, { other: '# kote' }),
    noPlaces: 'Lis sa a vid. Sere kote yo nan fich yo, nan lis ki klase a oswa nan paj teren yo.',
    open: (place) => `Louvri paj teren pou ${place}`,
    remove: 'Retire',
    removeLabel: (place) => `Retire ${place} nan lis la`,
    save: 'Sere nan lis mwen',
    saveShort: 'Sere',
    savedShort: 'Sere deja',
    saveShortLabel: (place, list) => `Sere ${place} nan ${list}`,
    saveTo: (name) => `Sere nan ${name}`,
    saved: (name) => `Sere nan ${name}`,
    savedLabel: (name) => `Sere nan ${name}. Chwazi pou retire l.`,
    added: (name) => `Sere nan "${name}". Lis yo rete nan navigatè sa a.`,
    removed: (name) => `Retire nan "${name}".`,
    full: (limit) => `Lis sa a plen: yon lis ka gen jiska ${formatNumber(limit)} kote.`,
    tooMany: (limit) => `Navigatè sa a ka kenbe jiska ${formatNumber(limit)} lis. Efase youn pou fè yon lòt.`,
    download: 'Telechaje lis sa a',
    importTitle: 'Louvri yon fichye lis',
    importHelp: 'Yon fichye CSV oswa GeoJSON ou te telechaje nan Placekeepers, oswa nenpòt fichye tèks ki gen nimewo pasèl ki gen nèf chif.',
    imported: (name, n) => `Louvri "${name}" ak ${plural(n, { other: '# kote' })}.`,
    importFailed: 'Fichye sa a pa gen okenn nimewo pasèl nou ka li.',
    importTooBig: 'Fichye sa a two gwo pou l yon lis.',
    importLeftOut: (n, limit) => `${plural(n, { other: '# kote' })} pa antre: yon lis ka gen jiska ${formatNumber(limit)}.`,
  },

  displacement: {
    caution: 'Amenajman vèt ka fè pri yo monte toupre. Panse pou ou mete pwoteksyon ansanm ak li.',
    placemakingCaution:
      'Nouvo jaden, plas pou chita ak atizay ka fè plis moun vle vin sou yon blòk, epi fè pri ak lwaye toupre yo monte. Mete pwoteksyon ansanm ak yo pou vwazen ki lokatè oswa ki an reta nan peman taks yo.',
    protections: 'Fason pou pwoteje vwazen yo',
    inWatch: (signs) => `Kote sa a nan yon zòn pou veye deplasman, kote gen siy ki montre pri yo ap monte: ${signs}.`,
    protectionsTitle: 'Pwoteksyon pou mete ansanm ak li',
    jumpToWatch: 'Wè siy yo isit la ak fason pou pwoteje vwazen yo',
    jumpToProtections: 'Wè fason pou pwoteje vwazen yo',
    listIntro:
      'Kèk nan kote sa yo nan zòn pou veye deplasman, kote dosye piblik yo montre siy ki di pri yo ap monte la. Fich chak kote bay siy zòn li a.',
    printSeeAbove: 'Gade "Veye deplasman" pi wo a.',
    protectionLabels: {
      neighborhood_gardens_trust: 'Neighborhood Gardens Trust',
      community_land_trust: 'Trust tè kominotè',
      homestead_exemption: 'Egzanpsyon Homestead Vil la',
      longtime_owner_occupants: 'Pwogram Longtime Owner Occupants Vil la (LOOP)',
      tangled_title_help: 'Èd pou yon tit pwopriyete ki mele',
    },
    checked: (date) => `verifye ${date}`,
    signShort: {
      prices: 'pri kay yo ap monte pi vit pase nan rès vil la',
      assessments: 'valè Vil la evalye yo ap monte pi vit pase nan rès vil la',
      mva: 'Analiz Valè Mache Vil la (Market Value Analysis) ki jwenn pri kay yo ap monte pi wo pase sa moun ki rete la depi lontan ka peye',
      companies: 'konpayi ki achte anpil nan kay yo vann',
      renters: 'omwen twa sou senk kay yo gen lokatè ladan yo',
      rent_burden: 'anpil lokatè ap peye mwatye revni yo oswa plis pou lwaye',
    },
    heading: 'Siy ki montre pri yo ap monte isit la',
    areaTitle: (tract) => `Sektè resansman ${tract}`,
    around: (place) => `Alantou ${place}`,
    signsHere: 'Siy isit la',
    alsoMeasured: 'Nou te mezire tou, men se pa yon siy isit la',
    signTitle: {
      prices: 'Pri vant kay yo',
      assessments: 'Valè Vil la evalye yo',
      mva: 'Analiz Valè Mache Vil la',
      companies: 'Achtè ki se konpayi',
      renters: 'Lokatè',
      rent_burden: 'Lokatè ki peye mwatye revni yo oswa plis pou lwaye',
    },
    span: (a0, a1, b0, b1) => `vant ${a0} a ${a1} ak ${b0} a ${b1}`,
    pricesText: (p0, p1, change, city, span) =>
      `Pri mitan kay yo vann yo te soti nan ${p0} pou rive nan ${p1}, ${changeWords(change)}${city === null ? '' : `, kont ${changeWords(city)} nan tout vil la`}${span ? ` (${span})` : ''}.`,
    companiesText: (share, sales, city) =>
      `Konpayi te achte ${share}% nan ${formatNumber(sales)} kay yo te vann nan dènye twa lane yo${city === null ? '' : `, kont ${city}% nan tout vil la`}.`,
    assessmentsText: (change, homes, city, years) =>
      `Valè mache Vil la bay kay ki nan mitan an ${changeWords(change)}${years ? ` ant ${years[0]} ak ${years[1]}` : ''} (${plural(homes, { other: '# kay' })})${city === null ? '' : `, kont ${changeWords(city)} nan tout vil la`}.`,
    rentersText: (share, city, years) =>
      `${share}% nan kay kote moun ap viv isit la se kay yo lwe${city === null ? '' : `, kont ${city}% nan tout vil la`}${years ? ` (sondaj Biwo Resansman, ${years[0]} a ${years[1]})` : ''}.`,
    mvaText: (rising, groups, edition) =>
      rising > 0
        ? `Nan ${rising} sou ${plural(groups, { other: '# gwoup blòk' })} isit la, ${edition ?? 'Analiz Valè Mache'} Reinvestment Fund fè pou Vil la jwenn yon presyon k ap monte: pri kay yo ap monte pi wo pase sa moun ki rete la depi lontan ka peye.`
        : `Nan okenn nan ${plural(groups, { other: '# gwoup blòk' })} isit la, ${edition ?? 'Analiz Valè Mache'} pa jwenn presyon k ap monte.`,
    mvaNone: 'Analiz Valè Mache a pa kouvri zòn sa a.',
    tooFewSales: (earlier, recent, needed) =>
      `Twò piti vant kay pou nou ka di (${formatNumber(earlier)} ak ${formatNumber(recent)}; nou bezwen omwen ${formatNumber(needed)} nan chak peryòd).`,
    tooFewHomes: 'Twò piti kay ki gen yon valè nan de lane yo pou nou ka di.',
    tooFewHouseholds: 'Twò piti fanmi nan sondaj Resansman an pou nou ka di.',
    rule: 'Yon zòn nan siveyans lè omwen de nan siy sa yo la, e omwen youn ladan yo se sou pri: pri vant yo, valè evalyasyon yo oswa Analiz Valè Mache a.',
    meaning: 'Amenajman vèt ak lòt amelyorasyon isit la ka fè pri yo monte plis. Mete pwoteksyon ansanm ak yo pou vwazen ki rete isit la kounye a.',
    cannotTell:
      'Sa yo se siy nan dosye piblik, se pa yon prevwa. Yo pa ka di ki moun ki deplase kite zòn nan ni poukisa, ni ki moun k ap viv isit la; chif sondaj Resansman an se yon mwayèn senk lane, kidonk yo pa ka di konbyen lwaye a ye jodi a. Yon zòn ki deyò siveyans lan ka toujou santi pri yo ap monte.',
    contextTitle: 'Lwaye, revni ak kay vid isit la',
    contextIntro: (years) =>
      `Soti nan sondaj Biwo Resansman an${years ? `, ${years[0]} a ${years[1]}` : ''}. Kontèks pou vwazen yo, se pa yon siy: chif sa yo pa chanje okenn zòn.`,
    contextNoisy:
      'Sa yo se estimasyon ki soti nan yon sondaj sou kèk kay pandan senk lane, kidonk nan yon ti zòn yo apwoksimatif: vrè chif la gen anpil chans pou l andedan maj ki montre a (maj erè Biwo Resansman an, ak 90 pousan konfyans).',
    contextTitles: {
      rent: 'Lwaye mitan',
      income: 'Revni mitan yon fanmi',
      vacant: 'Kay vid',
    },
    burdenText: (share, margin, households, city, years) =>
      `${share}% nan ${formatNumber(households)} fanmi lokatè isit la peye mwatye revni yo oswa plis pou lwaye ak sèvis piblik${giveOrTake(margin, 'points')}${city === null ? '' : `, kont ${city}% nan tout vil la`}${years ? ` (sondaj Biwo Resansman, ${years[0]} a ${years[1]})` : ''}. Se sou yo lwaye k ap monte a peze pi plis.`,
    burdenTooFew: 'Twò piti fanmi lokatè nan sondaj Resansman an pou nou ka di.',
    rentText: (rent, margin, city) =>
      `${rent} pa mwa, ak sèvis piblik lokatè a peye${margin ? ` (plis oswa mwens ${margin})` : ''}${city ? `, kont ${city} nan tout vil la` : ''}.`,
    rentNone: 'Sondaj Resansman an pa gen ase repons isit la pou yon lwaye mitan.',
    incomeText: (income, margin, city) =>
      `${income} pa ane${margin ? ` (plis oswa mwens ${margin})` : ''}${city ? `, kont ${city} nan tout vil la` : ''}.`,
    incomeNone: 'Sondaj Resansman an pa gen ase repons isit la pou yon revni mitan.',
    vacantText: (vacant, homes, share, margin, city) =>
      `${formatNumber(vacant)} sou ${formatNumber(homes)} kay isit la, ${share}%${giveOrTake(margin, 'points')}${city === null ? '' : `, kont ${city}% nan tout vil la`}.`,
    vacantTooFew: 'Twò piti kay nan sondaj Resansman an pou nou ka di.',
    whyEmpty: 'Poukisa yo vid',
    whyRows: {
      vr: 'Pou lwe',
      vs: 'Pou vann',
      vn: 'Lwe oswa vann, men pèsonn poko antre ladan yo',
      vz: 'Pou itilizasyon sezonye oswa detanzantan',
      vo: 'Retire sou mache a pou lòt rezon, tankou reparasyon, pwoblèm jiridik yon fanmi oswa abandon',
    },
    whyRow: (label, n, margin) => `${label}: ${formatNumber(n)}${giveOrTake(margin, 'homes')}`,
    legendArea: 'Yon zòn ki gen siy ki montre pri yo ap monte',
    legendTap: 'Tape andedan yon zòn, oswa toupre kwen li, pou wè siy li yo.',
    legendNote: 'Siy nan dosye piblik, se pa yon prevwa. Fich amenajman vèt, jaden, plas pou chita ak atizay nan zòn sa yo ajoute fason pou pwoteje vwazen yo.',
    exportColumn: (signs) => `Zòn pou veye deplasman: ${signs}`,
    exportLine: (caution, links) => `Sou amenajman vèt nan zòn pou veye deplasman: ${caution} Fason pou pwoteje vwazen yo: ${links}`,
    placemakingExportLine: (caution, links) =>
      `Sou jaden, plas pou chita ak atizay nan zòn pou veye deplasman: ${caution} Fason pou pwoteje vwazen yo: ${links}`,
    watchTitle: 'Veye deplasman',
  },

  evidence: {
    strong: { label: 'Prèv solid', meaning: 'Yon esè o aza, de preferans nan Filadèlfi, te jwenn efè a.' },
    moderate: {
      label: 'Prèv modere',
      meaning: 'Konparezon anvan ak apre ki fèt avèk atansyon, ak zòn kontwòl, te jwenn efè a.',
    },
    mixed: { label: 'Prèv melanje', meaning: 'Bon etid yo pa dakò, oswa efè a depann de kontèks la.' },
    weak: { label: 'Prèv fèb', meaning: 'Se sèlman sondaj sou sa moun santi oswa korelasyon, oswa yon sèl ti etid.' },
    not_violence: {
      label: 'Pa sou vyolans',
      meaning: 'Gen valè pou lòt rezon. Nou pa fè okenn deklarasyon sou vyolans.',
    },
    context: {
      label: 'Kontèks',
      meaning: 'Enfòmasyon ki montre ki kote swen ka ede pi plis. Se pa yon deklarasyon sou sa ki mache.',
    },
  },

  legend: {
    parcelsFill: 'Koulè ranpli: priyorite selon melanj lantiy ou',
    parcelsFillLens: (lens) => `Koulè ranpli: priyorite selon lantiy ${lens.toLowerCase()} la`,
    parcelsSure: 'Kontou: konbyen nou sèten li vid',
    sureHigh: 'Gen anpil chans li vid',
    sureMedium: 'Pwobableman li vid',
    sureLow: 'Pa two sèten',
    parcelPoint: 'Pwen: lè ou zoum soti, yon echantiyon pasèl vid; lè ou zoum antre, yon pasèl ki pa gen fòm sou kat la',
    parcelsListed:
      'N ap montre sèlman pasèl ajans tè Vil la mete sou lis kòm disponib. Yon pasèl kat la pa rele vid pa trase; pwòp kat Land Bank lan montre yo tout.',
    selected: 'Kote ou chwazi a',
    landcare: 'Teren PHS LandCare ap antretni: yo deja pran swen li',
    garden: 'Jaden kominotè oswa fèm',
    hin: 'Ri ki sou High Injury Network (rezo ri kote anpil moun blese)',
    hexIntro: (window) => `Moun ki pran bal, pou chak egzagòn, ${window.toLowerCase()}`,
    hexNone: 'Egzagòn kote pa gen okenn tire pa gen koulè.',
    countBin: (lo, hi) =>
      hi === null ? `${formatNumber(lo)} oswa plis` : lo === hi ? formatNumber(lo) : `${formatNumber(lo)} a ${formatNumber(hi)}`,
    segmentsFill: 'Koulè liy lan: nòt sekirite ri a selon melanj lantiy ou',
    segmentsShown: (min) =>
      min <= 1 ? 'Chak blòk ki gen yon nòt pi wo pase zewo parèt.' : `Blòk ki gen ${formatNumber(min)} oswa plis sou 100 parèt.`,
    segmentsZoom:
      'Lè ou zoum soti, se sèlman blòk ki gen domaj ki anrejistre oswa ki sou High Injury Network yo ki trase. Zoum antre pou wè rès yo.',
    crashSeverity: {
      3: 'Yon moun te mouri',
      2: 'Yon moun te blese grav',
      1: 'Yon moun te blese',
      0: 'Pa gen moun ki rapòte blese',
    },
    crashesZoom: 'Zoum antre pou wè aksidan kote pa gen moun ki te blese grav.',
    crashesSource: 'Soti nan dosye aksidan PennDOT, ki rive apeprè yon lane apre aksidan yo.',
    memorial: 'Yon moun ki mouri pandan l t ap mache, ap monte bisiklèt oswa ap monte eskouteur',
    memorialEveryone: 'Yon moun ki mouri nan yon aksidan sikilasyon',
    memorialNames: 'Yon bag ki pi plen vle di yon lis memoryal piblik pataje non moun nan. Louvri makè a pou li l.',
    memorialNamesWaiting: 'Nou poko montre okenn non. Yo pral parèt sèlman lè fanmi yo gen yon fason prive pou mande pou yo retire youn.',
    memorialNamesHidden: 'Non yo kache.',
    stopShelter: 'Yon abri, oswa tout estasyon an kouvri anba yon do',
    stopBench: 'Yon ban, men pa gen abri sou kat la',
    stopNeither: 'Pa gen abri ni ban',
    stopUnknown: 'Poko verifye: OpenStreetMap poko di',
    stopSurvey: 'Kijan pou verifye yon estasyon ak StreetComplete',
    stopsCoverage: 'Se sèlman estasyon yon moun te ajoute nan OpenStreetMap ki parèt isit la, kidonk anpil estasyon poko parèt.',
    stopSurveyRoute: 'Enprime yon fèy verifikasyon pou yon liy konplè',
  },

  streets: {
    popupLabel: 'Sou kote sa a nan kat la',
    detailsTitle: (style) =>
      style === 'memorials'
        ? 'Memoryal'
        : style === 'crashes'
          ? 'Aksidan'
          : style === 'street_segments'
            ? 'Blòk ri'
            : style === 'transit_stops'
              ? 'Estasyon'
              : style === 'transit_routes'
                ? 'Liy'
                : style === 'stop_amenities'
                  ? 'Abri ak ban'
                  : style === 'city_trees'
                    ? 'Pyebwa'
                    : style === 'amenity'
                      ? 'Jan li sou kat OpenStreetMap'
                      : style === 'public_place'
                        ? 'Kote'
                        : style === 'condition'
                          ? 'Rapòte bay 311'
                          : style === 'public_art'
                            ? 'Atizay piblik'
                            : style === 'traffic_stress'
                              ? 'Estrès sikilasyon pou bisiklèt'
                              : style === 'parking_reports'
                                ? 'Pwoblèm estasyonman yo rapòte'
                                : style === 'city_shelters'
                                  ? 'Abri bis'
                                  : style === 'street_poles'
                                    ? 'Poto ri'
                                    : style === 'traffic_calming'
                                      ? 'Ralanti trafik'
                                      : style === 'crossing_guards'
                                        ? 'Gad travèse lekòl'
                                        : style === 'redlining'
                                          ? 'Kat redlining 1937'
                                          : 'Detay',
    memorialTitle: 'An memwa',
    peopleHere: (n) => `Nou sonje ${plural(n, { other: '# moun' })} isit la`,
    killed: {
      walk: 'Mouri pandan l t ap mache',
      bike: 'Mouri pandan l t ap monte bisiklèt',
      scooter: 'Mouri pandan l t ap monte eskouteur',
      motorcycle: 'Mouri pandan l t ap monte motosiklèt',
      other: 'Mouri nan yon aksidan sikilasyon',
    },
    killedOn: (what, date) => `${what}, ${date}.`,
    memorialSource: 'Li memoryal piblik la',
    blessing: 'Sèlman ak benediksyon fanmi an.',
    families: 'Families for Safe Streets ap sipòte fanmi yo apre yon aksidan.',
    canDo: 'Sa vwazen yo ka fè isit la',
    firstStep: 'Premye etap',
    cost: (cost) => `Pri: ${cost}`,
    memorialsNearby: 'Memoryal ki toupre',
    memorialsInView: 'Memoryal ki nan vi a',
    memorialsIntro: 'Chak youn onore yon moun ki mouri nan yon aksidan sikilasyon. Louvri youn pou li plis.',
    memorialCount: (n) => plural(n, { other: '# memoryal' }),
    memorialsMore: (n) => `${plural(n, { other: '# lòt memoryal' })} nan vi a. Zoum antre pou fè lis yo isit la.`,
    memorialsLayerOff: 'Limen kouch Memoryal la pou fè lis memoryal ki nan vi a.',
    memorialsNone: 'Pa gen memoryal nan pati sa a nan kat la.',
    blocksNearby: 'Blòk ri ki toupre',
    blocksInView: 'Blòk ri ki nan vi a',
    blocksIntro: 'Chak blòk ki trase sou kat la, ak priyorite sekirite ri li ak rezon prensipal la. Louvri youn pou li poukisa.',
    blockCount: (n) => plural(n, { other: '# blòk' }),
    blockNoScore: 'Pa gen nòt sekirite ri.',
    blocksMore: (n) => `${plural(n, { other: '# lòt blòk' })} nan vi a. Zoum antre pou fè lis yo isit la.`,
    blocksLayerOff: (layer) => `Limen kouch "${layer}" pou fè lis blòk ri ki nan vi a.`,
    blocksNone: 'Pa gen okenn blòk ri ki trase nan pati sa a nan kat la.',
    crashesNearby: 'Aksidan ki toupre',
    crashesInView: 'Aksidan ki nan vi a',
    crashesIntro: 'Soti nan dosye aksidan PennDOT, jan paramèt kouch aksidan an chwazi yo. Louvri youn pou li plis.',
    crashCount: (n) => plural(n, { other: '# aksidan' }),
    crashesMore: (n) => `${plural(n, { other: '# lòt aksidan' })} nan vi a. Zoum antre pou fè lis yo isit la.`,
    crashNear: (street) => `Toupre ${street}`,
    crashesNone: 'Pa gen okenn aksidan ki trase nan pati sa a nan kat la.',
    removal: 'Mande pou retire l',
    removalNote: (hasEmail) =>
      hasEmail
        ? 'Nenpòt moun ka mande nou pou nou retire memoryal sa a, pa imèl prive. Nou fè l san nou pa mande poukisa.'
        : 'Nenpòt moun ka mande nou pou nou retire memoryal sa a, san bay okenn rezon. N ap prepare yon adrès imèl prive pou sa, li ap disponib byento; jiskaske sa fèt, paj Kontakte nou an di kijan pou mande nan yon pwoblèm sou GitHub, ke nenpòt moun ka li.',
    crashTitle: (year) => `Aksidan an ${year}`,
    crashesHere: (n) => `${plural(n, { other: '# aksidan' })} nan kote sa a`,
    involved: 'Ki moun ki te enplike',
    involvedModes: {
      walk: 'yon moun k ap mache',
      bike: 'yon moun k ap monte bisiklèt',
      motorcycle: 'yon moun sou yon motosiklèt',
      scooter: 'yon moun sou yon eskouteur',
    },
    involvedOthers: 'moun nan machin oswa nan lòt veyikil',
    crashSource: 'Soti nan dosye aksidan PennDOT.',
    segmentScore: (score, lens) => `${lens}: ${score} sou 100 selon melanj lantiy ou`,
    segmentNoScore: 'Pa gen nòt sekirite ri pou blòk sa a.',
    onHin: 'Sou High Injury Network',
    ksi: (n) =>
      `${plural(n, { other: '# moun' })} te mouri oswa te blese grav pandan yo t ap mache oswa ap monte bisiklèt sou blòk sa a oswa nan kwen li yo, nan dènye senk lane dosye PennDOT yo`,
    noKsi: 'Pa gen moun ki anrejistre mouri oswa blese grav pandan l t ap mache oswa ap monte bisiklèt isit la nan dènye senk lane dosye PennDOT yo',
    killed2: (n) => `${plural(n, { other: '# moun' })} te mouri isit la nan dènye de lane yo`,
    school: 'Yon lekòl nan 400 mèt',
  },

  streetsStops: {
    shelterLegend: 'Yon abri ki sou lis Vil la, kòm yon bag alantou estasyon li',
    shelterLegendLens: 'Yon estasyon ki gen yon abri Vil la konte kòm gen abri nan lantiy konfò transpò a.',
    shelterLegendDate: 'Vil la te chanje lis li a pou dènye fwa an janvye 2025, kidonk yon abri yo mete oswa yo retire depi lè sa a kapab manke.',
    shelterTitle: 'Yon abri bis ki sou lis Vil la',
    shelterAt: (stop) => `Li sèvi estasyon SEPTA ${stop}.`,
    shelterListed: (number) => `Vil la mete l sou lis ak nimewo estasyon ${number}.`,
    shelterByNumber: 'Nou matche l ak estasyon SEPTA a selon nimewo estasyon ki sou lis Vil la.',
    shelterByPlace: 'Nou matche l ak estasyon SEPTA ki pi pre a, nan 15 mèt: lis Vil la pa bay okenn nimewo estasyon ki koresponn.',
    shelterNoStop: 'Nou pa jwenn okenn estasyon SEPTA li sèvi: li pi lwen pase 15 mèt de chak estasyon, oswa estasyon li an fèmen.',
    shelterDigital: 'Panno piblisite li a se yon ekran dijital.',
    shelterLens: 'Estasyon li sèvi a konte kòm gen abri nan lantiy konfò transpò a.',
    shelterPartner: 'Vil la enstale ak antretni abri sa yo ak patnè piblisite li, ki peye pou yo ak piblisite a.',
    shelterSource: 'Soti nan lis abri bis Vil la (Biwo Transpò ak Sistèm Enfrastrikti, Office of Transportation and Infrastructure Systems).',
    sheltersHere: (n) => `${plural(n, { other: '# abri' })} nan kote sa a`,

    poleLed: 'Yon lanp LED Vil la mete sou lis',
    poleOther: 'Yon lanp sodyòm presyon wo ki pi ansyen',
    poleUnknown: 'Yon lanp ki gen yon kalite Vil la pa bay non',
    poleNone: 'Yon poto ki pa gen lanp sou lis, tankou yon poto siyal oswa yon poto sèvis piblik',
    polesNote: 'Lanp Vil la mete sou lis, se pa si yon lanp mache aswè a. Rapòte yon limyè ki etenn bay Philly311.',
    polesZoom: 'Zoum antre sou kèk blòk pou wè poto yo.',
    poleTitle: (number) => (number ? `Poto ri ${number}` : 'Yon poto ri ki pa gen nimewo sou lis'),
    poleKind: {
      0: 'Vil la pa mete okenn lanp sou lis sou poto sa a.',
      1: 'Vil la mete yon lanp LED sou lis sou poto sa a.',
      2: 'Vil la mete yon lanp sodyòm presyon wo ki pi ansyen sou lis sou poto sa a.',
      3: 'Vil la mete yon lanp sou lis sou poto sa a, men pa kalite li.',
    },
    poleOwner: {
      1: 'Depatman Ri Vil la (Streets Department) posede poto a.',
      2: 'PECO posede poto a.',
      3: 'PennDOT posede poto a.',
      4: 'Yon lòt moun ki pa Vil la, PECO oswa PennDOT posede poto a.',
    },
    poleReport: (number) => `Si yon limyè isit la etenn, bay Philly311 nimewo poto a, ${number}.`,
    poleReportNoNumber: 'Si yon limyè isit la etenn, di Philly311 kote li ye.',
    polesHere: (n) => `${plural(n, { other: '# poto' })} nan kote sa a`,
    poleSource: 'Soti nan lis poto ri Depatman Ri a, ki mete ajou chak semèn.',

    calmingLegend: 'Yon kousen vitès, yon dòdàn oswa yon tab vitès',
    calmingLegendNote: 'Vwazen yo ka mande Vil la pou ralanti trafik sou yon ri rezidansyèl.',
    zoomStreets: 'Zoum antre sou kèk katye pou wè yo.',
    calmingTitle: 'Ralanti trafik',
    calmingWhat: 'Yon kousen vitès, yon dòdàn oswa yon tab vitès Depatman Ri a mete sou lis, pou ralanti chofè yo.',
    calmingOn: (street) => `Sou ${street}`,
    calmingSince: (date) => `Yo te enstale l nan ${date}.`,
    calmingHere: (n) => `${plural(n, { other: '# aparèy' })} nan kote sa a`,
    calmingSource: 'Soti nan lis aparèy pou ralanti trafik Depatman Ri a.',

    guardLegend: 'Yon kwen kote Vil la mete yon gad travèse lekòl',
    guardLegendNote: 'Gad travèse yo ede timoun ak tout lòt moun travèse toupre lekòl yo nan kòmansman ak nan fen jounen lekòl la.',
    guardTitle: 'Gad travèse lekòl',
    guardHere: 'Vil la mete yon gad travèse lekòl nan kwen sa a.',
    guardSchool: (school) => `Lekòl ki pi pre sou lis Vil la, nan 400 mèt: ${school}.`,
    guardWhat: 'Gad travèse yo ede timoun ak tout lòt moun travèse an sekirite toupre lekòl yo nan kòmansman ak nan fen jounen lekòl la.',
    guardsHere: (n) => `${plural(n, { other: '# pòs' })} nan kote sa a`,
    guardSource: 'Soti nan lis kote gad travèse lekòl Vil la.',

    blockPoles: (poles, lamps, led) =>
      lamps === 0
        ? `Vil la mete ${plural(poles, { other: '# poto' })} sou lis ak long blòk sa a, san okenn lanp sou lis sou ${poles === 1 ? 'li' : 'yo'}.`
        : `Vil la mete ${plural(poles, { other: '# poto' })} sou lis ak long blòk sa a, ${formatNumber(lamps)} ladan yo gen yon lanp, ${led === lamps ? (lamps === 1 ? 'ki se LED' : 'tout se LED') : `${formatNumber(led)} ladan yo se LED`}.`,
    blockNoPoles: 'Vil la pa mete okenn poto ri sou lis ak long blòk sa a.',
    blockCalming: (n, year) =>
      year
        ? `Ralanti trafik isit la depi ${year}: Vil la mete ${plural(n, { other: '# kousen, dòdàn oswa tab vitès' })} sou lis sou blòk sa a.`
        : `Vil la mete ${plural(n, { other: '# kousen, dòdàn oswa tab vitès' })} sou lis sou blòk sa a.`,
    blockNoCalming: 'Poko gen okenn ralanti trafik ki anrejistre isit la.',
    blockArterial:
      'Kousen vitès Vil la yo se pou ri rezidansyèl yo. Sou yon ri tankou sa a, mande Biwo Transpò ak Sistèm Enfrastrikti Vil la (Office of Transportation and Infrastructure Systems) sou lòt chanjman.',
    memorialCalming: (n, year) =>
      year
        ? `Ralanti trafik sou blòk sa a depi ${year}: Vil la mete ${plural(n, { other: '# aparèy' })} sou lis.`
        : `Vil la mete ${plural(n, { other: '# aparèy pou ralanti trafik' })} sou lis sou blòk sa a.`,
    memorialNoCalming: 'Poko gen okenn ralanti trafik ki anrejistre sou blòk sa a.',
    lightsPoles: (poles, lamps, led) =>
      lamps === 0
        ? `Vil la mete ${plural(poles, { other: '# poto' })} sou lis ak long blòk sa a, san okenn lanp sou lis.`
        : `Ak long blòk sa a Vil la mete ${plural(lamps, { other: '# poto' })} ki gen yon lanp sou lis, ${led === lamps ? (lamps === 1 ? 'LED' : 'tout se LED') : `${formatNumber(led)} ladan yo se LED`}. Limen "Poto ri ak lanp Vil la mete sou lis" epi zoum antre pou jwenn nimewo chak poto.`,
    stopLamps: (lamps, led) =>
      lamps === 0
        ? 'Vil la pa mete okenn poto ki gen yon lanp sou lis nan 30 mèt de estasyon sa a.'
        : `Vil la mete ${plural(lamps, { other: '# poto' })} ki gen yon lanp sou lis nan 30 mèt de estasyon sa a, ${led === lamps ? (lamps === 1 ? 'LED' : 'tout se LED') : `${formatNumber(led)} ladan yo se LED`}.`,
    cityShelter: (n) => (n === 1 ? 'Lis abri bis Vil la gen yon abri isit la.' : `Lis abri bis Vil la gen ${formatNumber(n)} abri isit la.`),
    noCityShelter: 'Pa gen abri isit la sou lis abri bis Vil la, ki gen abri Vil la jere ak patnè piblisite li.',
    disagree:
      'Lis Vil la gen yon abri isit la, men OpenStreetMap di pa gen okenn. Youn ladan yo ka pa ajou: yon verifikasyon sou plas regle sa. Jiskaske sa fèt, priyorite a konte abri Vil la.',
    cityShelterLens: 'Priyorite a konte abri Vil la.',
    answerCityShelter: 'Poko verifye nan OpenStreetMap, men li sou lis Vil la',
  },

  // @@NEXT@@
};

export default ht;
