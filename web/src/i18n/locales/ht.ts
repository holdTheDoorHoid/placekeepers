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
import { formatDate, formatDecimal, formatNumber, plural } from '../format.ts';
import { distanceWords } from '../../strings.ts';

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
    miles: (miles) => `${formatDecimal(miles, 1)} mil`,
    lessThanMiles: (miles) => `mwens pase ${formatDecimal(miles, 1)} mil`,
  },

  join: {
    labelled: (label, value) => `${label}: ${value}`,
    colon: (label) => `${label}:`,
    and: (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ak ${items.at(-1)}`),
    long: (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join('; ')}; epi ${items.at(-1)}`),
    names: (names) => names.join(' ak '),
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
      { slug: 'posting', label: 'Kote pou mete yon afich' },
      { slug: 'terms', label: 'Kondisyon' },
      { slug: 'privacy', label: 'Vi prive' },
      { slug: 'contact', label: 'Kontakte nou' },
    ],
  },

  views: {
    groupLabel: 'Chwazi yon afichaj',
    field: 'Nan ri',
    analysis: 'Analiz',
    fieldLong: 'Afichaj nan ri',
    analysisLong: 'Afichaj analiz',
    fieldHint: 'Pou lè ou kanpe sou blòk la: kote ki toupre ak premye etap legal la.',
    analysisHint: 'Pou òganizatè yo: lantiy, filtè, detay ak yon lis ki klase.',
    auto: 'Chwazi yon afichaj selon gwosè ekran mwen',
    autoHint: 'Telefòn yo jwenn afichaj nan ri a; pi gwo ekran yo jwenn afichaj analiz la.',
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
      date ? `Vil la mete l sou lis kòm teren ki pwobableman vid (lis la gen dat ${date})` : 'Vil la mete l sou lis kòm teren ki pwobableman vid',
    city_building: (date) =>
      date
        ? `Vil la mete l sou lis kòm bilding ki pwobableman vid (lis la gen dat ${date})`
        : 'Vil la mete l sou lis kòm bilding ki pwobableman vid',
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
      n === 1 ? 'Yon filtè nan afichaj analiz la ap redui kote sa yo.' : `${formatNumber(n)} filtè nan afichaj analiz la ap redui kote sa yo.`,
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
    viewTitle: 'Afichaj',
    layersTitle: 'Kouch yo ak paramèt yo',
    lensTitle: 'Pwa lantiy yo',
    suggestionsTitle: 'Sijesyon pou montre',
    suggestionShow: (label) => `Montre "${label}"`,
    resetTitle: 'Rekòmanse',
    resetHelp: 'Remete chak kouch, chak paramèt ak chak pwa sou valè orijinal afichaj sa a, epi bliye kopi ki sere nan navigatè sa a.',
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
    tableCaption: 'Kote ki sou ekran an, klase selon melanj lantiy kounye a',
    rank: 'Ran',
    place: 'Kote',
    score: 'Nòt',
    reason: 'Rezon prensipal',
    save: 'Sere',
    sortHighFirst: 'Pi gwo nòt la an premye. Chwazi pou mete pi ba a an premye.',
    sortLowFirst: 'Pi ba nòt la an premye. Chwazi pou mete pi gwo a an premye.',
    tableEmpty: 'Pa gen anyen pou klase sou ekran an.',
    noScores: 'Nòt priyorite yo poko pibliye, kidonk lis sa a suiv òd nimewo pasèl yo.',
    tableMore: (shown, total) =>
      `N ap montre ${formatNumber(shown)} premye yo sou ${formatNumber(total)}. Zoum antre oswa redui filtè yo pou wè rès la, oswa telechaje yo tout.`,
    drawerLabel: 'Kote ki sou ekran an',
    tabTable: 'Lis ki klase',
    tabPlot: 'Bezwen ak premye etap',
    tabLists: 'Lis ki sere',
    tabMemorials: 'Memoryal',
    tabBlocks: 'Blòk ri yo',
  },

  plot: {
    title: 'Bezwen ak premye etap pou jwenn pèmisyon',
    intro:
      'Chak pwen se yon kote ki sou ekran an. Orizontalman: priyorite li selon melanj lantiy ou, de 0 a 100. Vètikalman: premye etap pou jwenn pèmisyon, yon kalite etap, se pa yon mezi pou konnen ki chans yon moun gen pou l di wi. Chwazi yon pwen pou louvri paj teren li.',
    axisX: 'Priyorite selon melanj lantiy ou',
    empty: 'Pa gen kote sou ekran an pou mete sou graf la.',
    noScore: (n) => `${plural(n, { other: '# kote' })} pa gen nòt, kidonk ${n === 1 ? 'li' : 'yo'} pa parèt.`,
    noStep: (n) => `${plural(n, { other: '# kote' })} poko gen premye etap pibliye, kidonk ${n === 1 ? 'li' : 'yo'} pa parèt.`,
    dot: (place, score, step) => `${place}: priyorite ${score}. ${step}.`,
    tableNote: 'Lis ki klase a montre menm kote yo, ak menm premye etap la, pou klavye ak lektè ekran.',
    capped: (shown, total) =>
      `N ap montre ${formatNumber(shown)} kote ki gen pi gwo nòt yo sou ${formatNumber(total)} ki sou ekran an. Zoum antre pou wè yo tout.`,
    summary: (rows) => `Kote ki sou ekran an selon premye etap pou jwenn pèmisyon: ${rows}.`,
    rowSummary: (label, n) => `${label}, ${plural(n, { other: '# kote' })}`,
  },

  export: {
    title: 'Telechaje kote sa yo',
    help: (limit) =>
      `Yon fichye ak jiska ${formatNumber(limit)} kote ak sa paj chak teren di sou pwopriyetè a, ansanm ak drapo pwopriyetè yo. Premye liy fichye a montre kondisyon itilizasyon yo.`,
    csv: 'Telechaje CSV',
    geojson: 'Telechaje GeoJSON',
    inView: 'Kote ki sou ekran an',
    working: (done, total) => `N ap rasanble detay pwopriyetè yo: ${formatNumber(done)} sou ${formatNumber(total)} fichye`,
    done: (n) => `Telechaje ${plural(n, { other: '# kote' })}.`,
    leftOut: (n, limit) =>
      `${plural(n, { other: '# lòt kote' })} pa antre, paske yon telechajman pa ka gen plis pase ${formatNumber(limit)}. Zoum antre oswa redui filtè yo pou telechaje rès la.`,
    withoutDetails: (n) => `${plural(n, { other: '# kote' })} pa gen detay pibliye, kidonk kolòn pwopriyetè yo vid.`,
    nothing: 'Pa gen kote pou telechaje.',
    sampleOff: 'Telechajman yo gen chak kote ki sou ekran an, e lè ou zoum soti jan sa a kat la montre sèlman yon echantiyon. Zoum antre pou telechaje.',
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

  represent: {
    title: 'Ki moun ki reprezante ou',
    intro: 'Moun yo te eli pou adrès sa a, ak biwo ofisyèl yo. Rele yo oswa ekri yo sou teren sa a.',
    ward: (ward, division) => `Ward ${ward}, divizyon ${division}`,
    wardOnly: (ward) => `Ward ${ward}`,
    wardHelp: 'Ward ak divizyon ou deside kote ou vote ak ki moun ki manm komite katye ou a (committee people).',
    district: (n) => `Distri ${n}`,
    offices: {
      council: 'Konsèy Minisipal',
      house: 'Chanm Reprezantan Pensilvani (Pennsylvania House)',
      senate: 'Sena Pensilvani (Pennsylvania Senate)',
      congress: 'Chanm Reprezantan Etazini (U.S. House of Representatives)',
    },
    titles: {
      council: 'Manm Konsèy',
      house: 'Reprezantan eta',
      senate: 'Senatè eta',
      congress: 'Manm Kongrè',
    },
    office: 'Biwo',
    phone: 'Telefòn',
    website: 'Sit entènèt',
    vacant: 'Pa gen okenn manm ki make pou pòs sa a kounye a. Pòs la ka vid jiskaske gen yon eleksyon.',
    notWorkedOut: 'Nou pa t ka detèmine distri sa a pou teren an semèn sa a.',
    notInBuild: 'Kopi semèn sa a te bati san lis manm sa a, kidonk nou pa ka di ki moun ki okipe pòs la.',
    atLargeTitle: 'Manm Konsèy pou tout vil la',
    atLarge: 'Sèt lòt manm Konsèy eli pa tout vil la epi yo reprezante chak adrès:',
    rcoTitle: 'Òganizasyon Kominotè Anrejistre',
    rcoIntro: 'Vil la avèti òganizasyon sa yo sou apèl zonaj isit la. Yo se yon bon premye kontak pou yon pwojè katye.',
    noRco: 'Pa gen okenn Òganizasyon Kominotè Anrejistre ki kouvri teren sa a, jan Vil la trase yo.',
    rcosNotInBuild: 'Kopi semèn sa a te bati san òganizasyon kominotè yo, kidonk nou pa ka fè lis yo.',
    rcoUnknown: (n) => `${plural(n, { other: '# lòt òganizasyon' })} kouvri teren sa a, men kopi semèn sa a pa gen kontak pou ${n === 1 ? 'li' : 'yo'}.`,
    rcoAddress: 'Adrès',
    rcoMeeting: 'Reyinyon nan',
    rcoPreferred: 'Prefere',
    rcoContact: 'Kontak',
    rcoAsPublished: 'Kontak jan Vil la pibliye yo pou piblik la.',
    checked: (who, when) => `${who}, verifye ${when}`,
    sourceNames: {
      city_elected_officials: 'Vil Filadèlfi, lis ofisyèl ki eli yo',
      pa_legislators: 'Open States',
      us_legislators: 'pwojè congress-legislators',
      rco_contacts: 'Komisyon Planifikasyon Vil Filadèlfi',
    },
    loading: 'N ap chèche ki moun ki reprezante teren sa a.',
    unlisted:
      'Nou kalkile chak semèn ki moun ki reprezante chak teren, pou teren ki sou lis nou an. Atlas, kat Vil la, montre ofisyèl ki eli yo pou nenpòt adrès.',
    missing: 'Kopi semèn sa a pa di ki moun ki reprezante teren sa a. Atlas, kat Vil la, montre ofisyèl ki eli yo pou nenpòt adrès.',
    atlas: 'Ofisyèl ki eli pou adrès sa a sou Atlas, kat Vil la',
    officialOnly: 'Pou ofisyèl ki eli, se sèlman biwo ofisyèl yo ki sou lis: pa gen nimewo telefòn pèsonèl ni adrès imèl.',
    officesMove: 'Gen kèk fwa biwo yo deplase anvan lis yo ajou: sit entènèt chak manm gen dènye adrès ak telefòn.',
  },

  packet: {
    pageTitle: 'Fè yon pake',
    intro:
      'Yon pake pou enprime oswa pataje nan yon reyinyon: yon paj kouvèti ak yon kat, ki moun pou kontakte, ak yon paj pou chak kote, ak sa paj teren an di sou li. Li fèt nan navigatè sa a apati kopi chak semèn nou an nan dosye Vil la; anyen pa voye okenn kote.',
    make: 'Fè yon pake',
    makeHelp: 'Louvri yon pake ou ka enprime pou kote sa yo nan yon nouvo onglè.',
    makeFromView: 'Fè yon pake ak kote sa yo',
    makeFromViewHelp: (limit) => `${formatNumber(limit)} ki pi wo sou lis ki klase a, nan lòd li.`,
    viewName: 'Kote sou kat la',
    chooseList: 'Kote ki nan pake a',
    fromView: (name, n) => `${name} (${plural(n, { other: '# kote' })}, soti sou kat la)`,
    noLists: 'Poko gen lis ki sere nan navigatè sa a. Sere kote nan kat la, apre sa tounen, oswa louvri yon pake nan afichaj analiz la.',
    emptyList: 'Lis sa a poko gen kote.',
    lensLabel: 'Sijesyon selon lantiy la',
    print: 'Enprime pake a',
    printHelp: 'Enprime sou papye Letter an nwa ak blan: yon paj pou chak kote, apre paj kouvèti a ak paj kontak yo.',
    backToMap: 'Retounen nan kat la',
    loading: (done, total) => `N ap li kopi chak semèn lan: ${formatNumber(done)} sou ${formatNumber(total)} fichye.`,
    failed: 'Gen kèk pati nan kopi chak semèn lan ki pa t ka chaje. Verifye koneksyon ou epi eseye ankò.',
    retry: 'Eseye ankò',
    leftOut: (n, limit) =>
      `Yon pake ka gen jiska ${formatNumber(limit)} kote, kidonk ${plural(n, { other: '# kote sou lis sa a' })} pa antre. Fè yon lis ki pi piti pou rès la.`,
    coverKicker: 'Pake Placekeepers',
    made: (date) => `Fèt ${date}`,
    count: (n) => plural(n, { other: '# kote' }),
    dataFrom: (date) => `Soti nan kopi chak semèn nou an nan dosye Vil la ${date}. Chak paj teren sou entènèt gen dosye jodi a.`,
    lensUsed: (lens) => `Sijesyon selon lantiy la: ${lens}.`,
    contentsTitle: 'Nan pake sa a',
    contents: {
      contacts: 'Ki moun pou kontakte',
    },
    mapTitle: 'Kote kote yo ye',
    mapAlt: (n) => `Yon kat ${plural(n, { other: '# kote' })}, nimewote jan yo ye nan pake sa a.`,
    mapLoading: 'N ap trase kat la…',
    mapCredit: 'Kat: Protomaps, kontribitè OpenStreetMap.',
    mapPlain: 'Kat debaz la pa disponib isit la, kidonk kote yo montre kote yo ye, san ri.',
    noPoint: (n) => `${plural(n, { other: '# kote' })} pa gen okenn pwen ki konnen epi ${n === 1 ? 'li' : 'yo'} pa sou kat la.`,
    watchIntro:
      'Gen kèk kote nan pake sa a ki nan zòn pou veye deplasman, kote dosye piblik yo montre siy ki di pri yo ap monte. Paj kote sa yo montre isit la.',
    watchArea: (tract) => (tract ? `Sektè resansman ${tract}` : 'Yon zòn pou veye deplasman'),
    areaSigns: (signs) => `Siy isit la ki montre pri yo ap monte: ${signs}.`,
    watchLots: (list) => `Kote isit la: ${list}.`,
    seeFront: 'Gade "Veye deplasman" nan devan pake sa a.',
    contactsTitle: 'Ki moun pou kontakte',
    contactsIntro:
      'Chak òganizasyon ak chak biwo yon sèl fwa, ak kote nan pake sa a li kouvri. Se sèlman biwo ofisyèl, ak kontak òganizasyon kominotè jan Vil la pibliye yo. Chak kontak montre sous li ak dènye jou yo verifye l.',
    forLots: (list) => `Pou kote ${list}`,
    forLot: (n) => `Pou kote ${n}`,
    wardsTitle: 'Ward ak divizyon',
    wardsIntro: 'Kote vwazen nan chak kote vote, ak ki moun ki manm komite yo.',
    contactsMissing: 'Kopi semèn sa a pa di ki moun ki reprezante kote sa yo. Atlas, kat Vil la, montre ofisyèl ki eli yo pou nenpòt adrès.',
    contactsUnknown: (list) => `Nou pa t ka detèmine ki moun ki reprezante kote ${list} semèn sa a.`,
    lotPlace: (n) => `Kote ${n}`,
    parcel: (opa) => `Pasèl ${opa}`,
    lotPage: 'Paj teren sou entènèt',
    notListed:
      'Kopi chak semèn nou an pa gen paj pou pasèl sa a, kidonk pake sa a pa ka di plis. Paj teren li sou entènèt chèche l ak Vil la.',
    sections: {
      vacancy: 'Sa nou panse li ye',
      owner: 'Ki moun ki posede l',
      permission: 'Fason pou jwenn pèmisyon, nan lòd pou eseye yo',
      actions: 'Sa ou ta ka fè isit la',
      rules: 'Règ pou teren sa a',
      represent: 'Ki moun ki reprezante teren sa a',
      notChecked: 'Sa nou pa t ka verifye',
    },
    ownerType: (type) => `Kalite pwopriyetè: ${type}.`,
    noNames: 'Non pwopriyetè yo ak adrès postal yo sou paj teren sou entènèt la ak nan dosye Vil la.',
    firstStep: 'Premye etap',
    cost: 'Pri',
    gardenAsk: 'Mande vwazen yo an premye: yon jaden mache lè blòk la vle l.',
    representUnknown: 'Kopi semèn sa a pa di ki moun ki reprezante teren sa a.',
    rcoLine: (names) => `Òganizasyon Kominotè Anrejistre: ${names}.`,
    ownerLetter: 'Lèt bay pwopriyetè a pou mande pèmisyon',
    ownerLetterOffered: 'Ofri: ranpli l epi enprime l sou paj lèt yo.',
    otherLetters: 'Lèt bay biwo Konsèy la ak òganizasyon kominotè yo',
    lettersLink: 'Ekri yon lèt',
    notChecked: {
      line: (parts, date) =>
        [
          parts.length ? `${parts.join(' ')}` : '',
          'Ki moun ki itilize teren an jodi a, si li gen kloti oswa si yo pran swen li, ak nenpòt bagay ki pi nouvo pase dosye Vil la' +
            (date ? ` nan ${formatDate(date) ?? date}` : '') +
            ': gade an pèsòn ak sou paj teren sou entènèt la.',
        ]
          .filter(Boolean)
          .join(' '),
      noDossier: 'Pasèl sa a pa nan kopi chak semèn nou an.',
      partial: {
        transfers: 'Akt li yo pa nan kopi chak semèn nou an.',
        assessments: 'Evalyasyon li yo pa nan kopi chak semèn nou an.',
        li: 'Vyolasyon L&I li yo pa nan kopi chak semèn nou an.',
      },
      missing: {
        historic: 'Si li istorik (kopi chak semèn lan pa t gen rejis istorik la).',
        overlays: 'Zonaj siperpoze li yo (kopi chak semèn lan pa t genyen yo).',
        brownfields: 'Dosye brownfield federal toupre (kopi chak semèn lan pa t genyen yo).',
        appeals: 'Apèl ak odyans li yo (kopi chak semèn lan pa t genyen yo).',
      },
      represent: 'Ki moun ki reprezante l.',
    },
    privacy: 'Fèt nan navigatè sa a apati kopi chak semèn nou an. Anyen sou pake sa a pa voye okenn kote.',
  },

  flyer: {
    pageTitle: 'Fè yon afich pou vwazen',
    make: 'Fè yon afich pou vwazen',
    intro:
      'Yon panno pou kloti yon teren vid: li di moun k ap pase ke vwazen yo pran swen kote sa a ak ki jan pou jwenn youn lòt. Ou chwazi sa li di epi ou enprime l isit la. Anyen pa voye okenn kote.',
    noLot:
      'Louvri paj sa a depi yon paj teren oswa yon pake, pou afich la ka montre adrès teren an, yon kat ak yon kòd pou paj li.',
    loading: 'N ap li kopi chak semèn lan…',
    headline: 'Tit',
    defaultHeadline: 'Vwazen yo pran swen teren sa a',
    hopes: 'Sa ou espere fè',
    hopeOptions: {
      cleanup: 'Yon netwayaj',
      garden: 'Yon jaden',
      seating: 'Yon kote pou chita',
      mural: 'Yon miral',
      ask_city: 'Mande Vil la sou sa',
    },
    hopeLines: {
      cleanup: 'Netwaye l ansanm',
      garden: 'Plante yon jaden',
      seating: 'Fè yon kote pou chita',
      mural: 'Pentire yon miral, ak pèmisyon pwopriyetè mi an',
      ask_city: 'Mande Vil la sa ki ka rive isit la',
    },
    language: 'Lang afich la',
    languageHelp: 'Enprime afich la nan lang vwazen ou yo li. Sa ou tape enprime jan ou te tape l.',
    withEnglish: 'Ajoute angle bò kote l, nan yon dezyèm kolòn',
    ownWords: 'Oswa ak pwòp mo ou',
    contact: 'Ki jan vwazen yo ka jwenn ou',
    contactHelp: 'Yon lyen gwoup mesaj, yon imèl, yon telefòn, oswa yon lè ak yon kote reyinyon.',
    publicWarning:
      'Sa ou enprime se piblik: nenpòt moun ka li l epi pran foto l. Prefere yon lyen gwoup mesaj oswa yon imèl ki fèt pou pwojè a olye de yon adrès kay oswa yon nimewo telefòn pèsonèl.',
    publicCaution: 'Sa a sanble li ka yon adrès kay oswa yon nimewo telefòn pèsonèl. Yo pral enprime l pou nenpòt moun wè.',
    ownLink: 'Pwòp lyen ou pou yon dezyèm kòd QR (opsyonèl)',
    ownLinkHelp: 'Pa egzanp lyen envitasyon gwoup mesaj ou a. Li dwe kòmanse ak https://',
    ownLinkBad: 'Sa a pa sanble yon adrès entènèt, kidonk yo pa enprime dezyèm kòd la.',
    ownLinkLabel: 'Pou ki sa dezyèm kòd la ye (opsyonèl)',
    ownLinkLabelPlaceholder: 'Antre nan gwoup mesaj nou an',
    size: 'Papye',
    sizes: { letter: 'Yon afich sou yon paj Letter', half: 'Mwatye paj, de pa fèy' },
    print: 'Enprime afich la',
    clear: 'Efase sa mwen tape',
    confirmClear: 'Efase sa ou te tape pou afich yo nan navigatè sa a? Pa gen fason pou fè l tounen.',
    cleared: 'Efase. Anyen ou te tape pou afich yo pa rete nan navigatè sa a kounye a.',
    kept: 'Sa ou tape rete nan navigatè sa a sèlman, pou ou ka tounen ladan l. Anyen pa voye okenn kote.',
    where: 'Kote ou gen dwa afiche l',
    whereLead:
      'Pwòp fenèt oswa kloti ou, kloti pwopriyetè teren an ak pèmisyon li, tablo kominotè nan bibliyotèk ak sant rekreyasyon (mande anplwaye yo), ak biznis ki dakò.',
    whereNot:
      'Pa sou poto sèvis piblik, limyè ri, panno sikilasyon, pyebwa Vil la oswa pyebwa ri, ni abri SEPTA: kòd Vil la entèdi sa, ak amann depi $300 pa panno.',
    whereLink: 'Li gid la, ak sous li yo',
    preview: 'Afich la',
    hopeTitle: 'N ap espere',
    reachTitle: 'Jwenn nou',
    scanLot: 'Eskane pou wè teren sa a sou Placekeepers: sa dosye Vil la di ak ki jan vwazen yo ka ede.',
    scanOwn: 'Eskane pou lyen nou an',
    mapAlt: (address) => `Yon kat blòk ki alantou ${address}, ak teren an make.`,
    byNeighbors: 'Vwazen mete l, se pa Vil la ni pwopriyetè a. Fèt ak Placekeepers, yon kat gratis pou vwazen Filadèlfi.',
    qrLabel: (what) => `Kòd QR: ${what}`,
    qrCredit: 'Yo fè kòd QR yo nan navigatè sa a ak qrcode-generator pa Kazuhiko Arase (lisans MIT).',
  },

  letters: {
    pageTitle: 'Ekri yon lèt',
    intro:
      'Lèt ou ranpli isit la epi enprime. Sit la pa janm voye anyen: ou voye lèt la pa lapòs, pa imèl oswa ou pote l a men ou menm. Sa ou tape rete nan navigatè sa a sèlman.',
    unreviewed: 'Yon avoka poko revize lèt sa a. Se pa konsèy jiridik.',
    legalHelp: 'Pou èd jiridik, mande Grounded in Philly, yon pwojè Garden Justice Legal Initiative',
    legalHelpShort: 'Èd jiridik gratis: Grounded in Philly (Garden Justice Legal Initiative)',
    language: 'Lang lèt la',
    languageHelp:
      'Biwo yo, òganizasyon kominotè yo ak pwopriyetè yo lèt sa yo ale bay yo pi souvan li angle, kidonk lèt la enprime an angle sof si ou chwazi lang ou.',
    translationTitle: 'Lèt ou a nan lang ou',
    translationNote: 'Pou ou konnen sa ou siyen. Se sèlman lèt ki anwo a ki enprime; tradiksyon sa a rete sou ekran ou.',
    yourName: '[non ou]',
    senderNote: 'Nòt pou moun k ap voye a',
    chooseTemplate: 'Ki lèt',
    templates: {
      owner: 'Bay pwopriyetè teren an, pou mande pèmisyon pou pran swen li',
      council: 'Bay biwo Konsèy Minisipal la, pou mande sipò',
      rco: 'Bay yon Òganizasyon Kominotè Anrejistre, pou mande pou prezante',
      followup: 'Swivi yon rapò 311 ki toujou ouvè',
    },
    templateHelp: {
      owner:
        'Mande pwopriyetè a pèmisyon pou pran swen teren an pou yon ti tan: yon netwayaj, yon jaden oswa yon kote pou chita. Ekri bay yon sèl pwopriyetè alafwa.',
      council: 'Mande biwo manm Konsèy distri ou a sipò pou yon lakou sou kote, yon teren Land Bank oswa yon netwayaj.',
      rco: 'Prezante pwojè ou bay yon òganizasyon kominotè epi mande tan nan youn nan reyinyon li yo.',
      followup: 'Mande biwo Konsèy distri ou a pou ede ak yon demann Philly311 ki rete ouvè.',
    },
    forLot: (address) => `Pou ${address}`,
    forList: (name, n) => `Pou lis "${name}" (${plural(n, { other: '# kote' })})`,
    chooseLot: 'Ki kote',
    noLot:
      'Louvri paj sa a depi yon paj teren oswa yon pake pou ranpli adrès teren an, pwopriyetè li ak ki moun ki reprezante l. Ou ka tape yo ou menm tou.',
    loading: 'N ap li kopi chak semèn lan…',
    gate: {
      public:
        'Teren sa a se tè piblik. Mande atravè pwogram Land Bank pou vwazen yo olye de sa, oswa mande biwo Konsèy ou a sipò: gen yon lèt pou sa.',
      not_sure:
        'Nou pa sèten teren sa a vid, e li ka kay yon moun, kidonk sit la pa ofri yon lèt bay pwopriyetè li. Si ou konnen teren an vid, gade ankò an pèsòn, epi mande vwazen yo ki moun ki pwopriyetè a.',
      no_owner: 'Dosye Vil la pa bay non okenn pwopriyetè pou teren sa a, kidonk pa gen pèsonn pou adrese lèt sa a ba li.',
      not_listed:
        'Kopi chak semèn nou an pa gen paj pou pasèl sa a, kidonk sit la pa ka di si yon lèt bay pwopriyetè li bon isit la. Louvri paj teren li.',
    },
    notOffered: 'Lèt bay pwopriyetè a pa ofri isit la',
    fields: {
      date: 'Dat',
      senderName: 'Non ou',
      group: 'Gwoup ou oswa blòk ou, si genyen',
      contact: 'Ki jan pou jwenn ou',
      contactHelp: 'Yon telefòn, yon imèl oswa yon adrès postal. Li enprime sou lèt la.',
      ownerName: 'Non pwopriyetè a, jan Vil la pibliye l',
      ownerAddress: 'Adrès postal pwopriyetè a, jan Vil la pibliye l',
      lotAddress: 'Adrès teren an',
      plans: 'Sa ou espere fè',
      planOptions: {
        cleanup: 'netwaye l',
        garden: 'plante yon ti jaden',
        seating: 'monte yon kote pou chita',
      },
      duration: 'Pou konbyen tan',
      durationPlaceholder: 'sezon sa a',
      extra: 'Ak pwòp mo ou (opsyonèl)',
      recipientName: 'Bay',
      recipientAddress: 'Adrès',
      ask: 'Sa ou ap mande',
      askOptions: {
        side_yard: 'Sipò pou yon lakou sou kote (sèlman si ou rete bò kote a)',
        land_bank: 'Sipò pou pran swen yon teren Land Bank',
        cleanup: 'Èd pou òganize yon netwayaj',
      },
      project: 'Pwojè ou, an kèk mo',
      projectPlaceholder: 'yon netwayaj ak yon ti jaden',
      requestNumber: 'Nimewo demann Philly311',
      reportedOn: 'Kilè ou te rapòte l',
      problem: 'Ki pwoblèm nan',
      problemOptions: {
        dumping: 'fatra jete ilegalman',
        light: 'yon limyè ri ki kase',
        graffiti: 'grafiti',
        building: 'yon bilding vid ki ouvè',
        other: 'yon lòt pwoblèm ak kote a li menm',
      },
      problemOther: 'Pwoblèm nan, ak pwòp mo ou',
    },
    prefilledFrom: (source, date) => `Ranpli ak ${source}, ${date}. Verifye l anvan ou voye l.`,
    nameLeftOut: 'Non pwopriyetè a rete vid isit la. Ekri l jan ou konnen l, oswa kite l vid epi lèt la kòmanse ak "Chè pwopriyetè pwopriyete a".',
    cityRecords: 'dosye Vil la',
    print: 'Enprime lèt la',
    clear: 'Efase tout sa mwen tape',
    cleared: 'Efase. Anyen ou te tape pa rete nan navigatè sa a kounye a.',
    confirmClear: 'Efase tout sa ou te tape nan lèt sa yo nan navigatè sa a? Pa gen fason pou fè l tounen.',
    kept: 'Sa ou tape rete nan navigatè sa a sèlman, pou ou ka tounen ladan l. Anyen pa voye okenn kote.',
    notKept: 'Navigatè sa a pa kenbe sa ou tape kounye a, petèt yon fenèt prive. Enprime anvan ou fèmen paj la.',
    preview: 'Lèt la',
    salutation: (name) => `Chè ${name},`,
    dearOwner: 'Chè pwopriyetè pwopriyete a,',
    sincerely: 'Ak respè,',
    reachMe: (contact) => `Ou ka jwenn mwen nan ${contact}.`,
    reachMeBlank: 'Ou ka jwenn mwen nan [ki jan pou jwenn ou].',
    thanks: 'Mèsi paske w ap konsidere sa.',
    thanksHelp: 'Mèsi pou èd ou.',
    me: (name, group) => `Non m se ${name || '[non ou]'}${group ? `, epi m ap ekri pou ${group}` : ''}.`,
    owner: {
      intro: (lot) => `Mwen rete toupre ${lot || '[adrès teren an]'}, teren dosye Vil la mete sou non ou.`,
      ask: (plans) =>
        `Vwazen sou blòk sa a ta renmen pran swen teren an pou yon ti tan. N ap mande pèmisyon ou pou ${plans || '[sa ou espere fè]'}.`,
      terms: (duration) =>
        `${duration ? `Nou t ap fè sa ${duration}, n ap fè travay la tèt nou epi n ap peye pou nenpòt founiti.` : 'Nou t ap fè travay la tèt nou epi n ap peye pou nenpòt founiti.'} Nou t ap kenbe teren an pwòp epi an sekirite, epi nou pa t ap bati anyen pèmanan. Ou ka di non, epi si ou di wi ou ka mande nou sispann nenpòt ki lè.`,
      writing:
        'Si ou dakò, nou ta renmen mete akò nou an alekri, pou ou menm ak nou konnen sa nou te pwomèt. Nou kontan reponn nenpòt kesyon anvan.',
    },
    council: {
      dear: (name) => (name ? `Chè manm Konsèy ${name},` : 'Chè manm Konsèy,'),
      intro: (group, lot) =>
        `M ap ekri kòm yon vwazen nan distri ou${group ? `, ak ${group},` : ''} sou ${lot || '[adrès teren an]'}.`,
      ask: {
        side_yard:
          'Mwen rete bò kote a, epi m ta renmen pran swen teren an kòm yon lakou sou kote. Pwogram lakou sou kote Philadelphia Land Bank bezwen sipò biwo ou a, epi m ap mande sipò sa a.',
        land_bank:
          'Vwazen yo ta renmen pran swen teren sa a atravè youn nan pwogram Philadelphia Land Bank pou vwazen, tankou yon akò jaden. M ap mande sipò biwo ou a pou aplikasyon nou an.',
        cleanup: 'Teren sa a bezwen yon netwayaj. Vwazen yo pare pou ede, epi n ap mande biwo ou a pou ede nou òganize l ak Vil la.',
      },
      meet: 'Mwen ta kontan rankontre anplwaye ou yo oswa montre yo teren an.',
    },
    rco: {
      dear: (name) => (name ? `Chè vwazen ${name},` : 'Chè vwazen,'),
      intro: (project, lot) => `Nou se vwazen k ap travay sou ${project || '[pwojè ou]'} nan ${lot || '[adrès teren an]'}.`,
      ask: 'Nou ta renmen prezante pwojè a nan youn nan reyinyon ou yo, tande sa manm ou yo panse, epi reponn kesyon yo. Èske nou ta ka gen kèk minit sou òd jou yon pwochen reyinyon?',
    },
    followup: {
      dear: (name) => (name ? `Chè manm Konsèy ${name} ak anplwaye yo,` : 'Chè anplwaye biwo Konsèy la,'),
      reported: (when, problem, place, number) =>
        `Nan ${when || '[jou ou te rapòte l]'}, mwen te rapòte ${problem || '[pwoblèm nan]'} nan ${place || '[adrès la]'} bay Philly311. Nimewo demann lan se ${number || '[nimewo demann lan]'}. Demann lan toujou ouvè, epi pwoblèm nan toujou la.`,
      ask: 'M ap mande biwo ou a pou ede asire yo okipe l.',
      subject: (number) => `Sou demann Philly311 ${number || '[nimewo]'}`,
    },
  },

  projects: {
    kinds: {
      cleanup: 'Netwayaj',
      garden: 'Jaden',
      seating: 'Kote pou chita',
      art: 'Miral oswa atizay',
      trees: 'Pyebwa',
      city_install: 'Yon abri oswa yon ban Vil la enstale',
      fix_311: 'Yon repare 311',
      other: 'Yon lòt pwojè',
    },
    legend: 'Yon pwojè vwazen yo fini',
    legendNote: 'Placekeepers li epi apwouve chak rapò anvan li parèt.',
    detailsTitle: 'Pwojè vwazen yo fini',
    here: (n) => `${plural(n, { other: '# pwojè' })} isit la`,
    finished: (month) => `Fini nan ${month}`,
    by: (group) => `Pa ${group}`,
    whatItTook: 'Sa li te pran',
    report: 'Wè rapò a ak foto li yo sou GitHub',
    source: 'Li plis sou li',
    openLot: 'Louvri paj teren an',
    showLayer: 'Montre pwojè vwazen yo fini sou kat la',
    privacy: 'Kat la pa janm montre ki moun ki voye yon rapò, sèlman yon non gwoup yo te chwazi montre.',
    section: 'Pwojè isit la',
    loading: 'N ap chèche pwojè vwazen yo te rapòte isit la.',
    none: 'Pèsonn poko rapòte yon pwojè vwazen yo fini isit la.',
    unpublished: 'Kopi kat sa a poko gen lis pwojè vwazen yo fini.',
    failed: 'Nou pa t ka chaje lis pwojè vwazen yo fini. Eseye ankò pita.',
    tellUs: 'Di nou sou yon pwojè ou fini',
    tellUsHere: 'Di nou sou yon pwojè ou fini isit la',
    tellUsNote:
      'Fòm lan louvri sou GitHub, kote nenpòt moun ka li l. Yon moun li chak rapò anvan li parèt sou kat la. Foto yo rete sou GitHub: pa janm ak figi yon timoun oswa figi nenpòt moun ki pa t dakò, epi pa janm ak yon plak machin.',
    oneLot: 'Yon sèl teren poukont li pa ka montre si yon pwojè te mache.',
    timelineKind: 'Pwojè vwazen yo fini',
    timelineToggle: 'Pwojè vwazen yo fini',
    timelineText: (kind, group) => (group ? `${kind}, pa ${group}` : kind),
    printTitle: 'Pwojè vwazen yo fini isit la',
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
      longtime_owner_occupants: 'Pwogram Okipan yo Pwopriyetè Longtime (LOOP)',
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
    stopShelter: 'Yon abri, oswa tout estasyon an kouvri anba yon twati',
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
                                          : style === 'projects'
                                            ? 'Pwojè vwazen yo fini'
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
    memorialsInView: 'Memoryal ki sou ekran an',
    memorialsIntro: 'Chak youn onore yon moun ki mouri nan yon aksidan sikilasyon. Louvri youn pou li plis.',
    memorialCount: (n) => plural(n, { other: '# memoryal' }),
    memorialsMore: (n) => `${plural(n, { other: '# lòt memoryal' })} sou ekran an. Zoum antre pou fè lis yo isit la.`,
    memorialsLayerOff: 'Limen kouch Memoryal la pou fè lis memoryal ki sou ekran an.',
    memorialsNone: 'Pa gen memoryal nan pati sa a nan kat la.',
    blocksNearby: 'Blòk ri ki toupre',
    blocksInView: 'Blòk ri ki sou ekran an',
    blocksIntro: 'Chak blòk ki trase sou kat la, ak priyorite sekirite ri li ak rezon prensipal la. Louvri youn pou li poukisa.',
    blockCount: (n) => plural(n, { other: '# blòk' }),
    blockNoScore: 'Pa gen nòt sekirite ri.',
    blocksMore: (n) => `${plural(n, { other: '# lòt blòk' })} sou ekran an. Zoum antre pou fè lis yo isit la.`,
    blocksLayerOff: (layer) => `Limen kouch "${layer}" pou fè lis blòk ri ki sou ekran an.`,
    blocksNone: 'Pa gen okenn blòk ri ki trase nan pati sa a nan kat la.',
    crashesNearby: 'Aksidan ki toupre',
    crashesInView: 'Aksidan ki sou ekran an',
    crashesIntro: 'Soti nan dosye aksidan PennDOT, jan paramèt kouch aksidan an chwazi yo. Louvri youn pou li plis.',
    crashCount: (n) => plural(n, { other: '# aksidan' }),
    crashesMore: (n) => `${plural(n, { other: '# lòt aksidan' })} sou ekran an. Zoum antre pou fè lis yo isit la.`,
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

  parking: {
    kinds: {
      all: 'Veyikil ki bloke wout la',
      sidewalk: 'Sou yon twotwa',
      bike_lane: 'Nan yon liy bisiklèt',
      crosswalk: 'Sou yon pasaj pyeton',
      corner: 'Sou yon kwen',
      ramp: 'Ap bloke yon ranp twotwa',
    },
    window: (start, end) => `Soti ${start} jiska ${end}`,
    windowUnknown: 'Sou 12 mwa',
    heatTitle: (window) => `Zoum soti: kote rapò yo rasanble. ${window}.`,
    fewer: 'Mwens rapò',
    more: 'Plis rapò',
    binsTitle: 'Zoum antre: rapò nan chak zòn ki gen apeprè yon blòk lajè',
    bins: (low, high) => (high === null ? `${formatNumber(low)} oswa plis` : `${formatNumber(low)} a ${formatNumber(high)}`),
    threshold: (min) =>
      `Zòn ki gen mwens pase ${min} rapò pa parèt, pou pa gen yon sèl rapò ki parèt. Zoum antre epi tape yon zòn pou wè chif li yo.`,
    oneApp:
      'Kote moun k ap itilize yon sèl aplikasyon, Laser Vision Philly Bike Action, te rapòte veyikil ki nan wout la. Se pa chak pwoblèm ki rapòte.',
    title: 'Zòn sa a, apeprè yon blòk lajè',
    summary: (n, window) => `${plural(n, { other: '# rapò' })} sou veyikil ki bloke wout la. ${window}.`,
    count: (n) => formatNumber(n),
    fewerThan: (min) => `mwens pase ${min}`,
    byKind: 'Selon kalite',
    meaning:
      'Sa yo se rapò moun k ap itilize yon sèl aplikasyon, kidonk yo montre kote moun sa yo te remake veyikil ki nan wout la, se pa chak pwoblèm. Yon kalite ki gen mwens pase 5 rapò isit la pa bay kòm yon chif, pou pa gen yon sèl rapò ki parèt.',
    fixes:
      'Anpil rapò nan yon sèl kote se prèv pou amelyorasyon fizik: pwolonjman twotwa, poto pwoteksyon, kwen ki pi vizib, liy bisiklèt ki pwoteje ak zòn chajman.',
    askCity: 'Mande Vil la sou yon amelyorasyon',
    source: 'Soti nan kat Laser Vision Philly Bike Action',
    refreshed: 'Konte ankò chak semèn, ak pèmisyon Philly Bike Action.',
  },

  transit: {
    waitTitle: 'Chak konbyen tan yon bis oswa yon tren pase a midi nan jou lasemèn',
    waitBins: [
      'Chak 10 minit oswa pi byen',
      'Chak 11 a 15 minit',
      'Chak 16 a 30 minit',
      'Chak 31 a 60 minit',
      'Mwens pase yon fwa pa èdtan',
    ],
    noMidday: 'Pa gen sèvis ant 10 è ak 2 è nan jou lasemèn',
    boardingsTitle: 'Moun ki monte isit la nan yon jou lasemèn mwayen',
    boardingBins: ['1,000 oswa plis', '200 a 999', '50 a 199', '10 a 49', 'Mwens pase 10'],
    noCount: 'Pa gen okenn konte SEPTA pou estasyon sa a',
    boardingsNote: 'Soti nan pwòp konte SEPTA, ki an reta yon sezon oswa de sou orè yo.',
    station: 'Estasyon metwo, El oswa Regional Rail',
    zoomNote: 'Zoum antre sou kèk katye pou wè estasyon yo.',
    lensTitle: 'Priyorite selon lantiy konfò transpò a',
    lensUnsurveyed: 'Kote pèsonn poko verifye yon estasyon, abri ak ban li konte mwatye.',
    lensCityShelter: 'Yon estasyon ki gen yon abri sou lis Vil la konte kòm gen abri.',
    lensStations: 'Lantiy la bay nòt sèlman pou estasyon bis ak tramway, se poutèt sa estasyon yo parèt vid anndan.',
    lensTunnel:
      'Estasyon tramway nan tinèl anba Center City ak University City yo vid anndan tou: lantiy la kite yo deyò, menm jan l fè pou estasyon yo.',
    findTitle: 'Sa pasaje yo jwenn isit la',
    notInOsm: 'Nou poko jwenn okenn estasyon ki matche nan OpenStreetMap, kidonk pèsonn poko anrejistre si li gen yon abri oswa yon ban.',
    matchedByNumber: 'Matche ak estasyon OpenStreetMap ki gen menm nimewo estasyon an, nan menm kote a.',
    matchedByPlace: 'Matche ak estasyon OpenStreetMap ki nan menm kote a, nan 15 mèt.',
    halfway: 'Repons "poko verifye" yo konte mwatye (50 sou 100) nan nòt la jiskaske yon moun anrejistre yo.',
    canopy: (percent) =>
      `Kouvèti pyebwa kouvri apeprè ${formatNumber(percent)} pousan nan tè ki alantou estasyon an, nan yon zòn ki gen apeprè de blòk lajè (sondaj kouvèti pyebwa Vil la an 2018).`,
    onHin: 'Estasyon an sou High Injury Network, ri kote pi fò moun ki mouri ak ki blese grav nan trafik Filadèlfi pase.',
    noScore: 'Lantiy konfò transpò a bay nòt sèlman estasyon bis ak tramway.',
    tunnelStation:
      'Estasyon tramway sa a anba tè, nan tinèl la, kidonk lantiy konfò transpò a kite l deyò, menm jan l fè pou estasyon metwo ak tren yo.',
    answersLoading: 'N ap chaje sa OpenStreetMap di nan estasyon sa a.',
    answersUnavailable: 'Nou pa t ka chaje sa OpenStreetMap di nan estasyon sa a kounye a, kidonk abri ak ban li konte kòm poko verifye.',
    canDo: 'Sa vwazen yo ka fè isit la',
    routeDetails: 'Etap, kontak ak lyen',
    surveyGuide: 'Kijan pou verifye yon estasyon ak StreetComplete',
    osmSource: 'Abri, ban ak limyè ki soti nan OpenStreetMap, © kontribitè OpenStreetMap, mete ajou chak semèn.',
    routeBus: 'Liy bis',
    routeTrolley: 'Liy tramway',
    routeMetro: 'Metwo oswa El',
    routeRail: 'Regional Rail',
    allRoutes: 'Kote plizyè liy pataje yon ri, liy yo kouche youn sou lòt.',
    frequentRoutes: 'Sèlman liy ki gen yon bis oswa yon tren chak 15 minit oswa pi byen a midi nan jou lasemèn.',
    detailsTitle: 'Estasyon',
    stationName: (name) => `Estasyon ${name}`,
    stopsHere: (n) => `${plural(n, { other: '# estasyon' })} nan kote sa a`,
    kinds: {
      bus: 'Estasyon bis',
      trolley: 'Estasyon tramway',
      busTrolley: 'Estasyon bis ak tramway',
      metro: 'Estasyon metwo oswa El',
      rail: 'Estasyon Regional Rail',
    },
    vehicles: { bus: 'bis', trolley: 'tramway', busTrolley: 'bis oswa tramway', train: 'tren' },
    vehiclesMany: { bus: 'bis', trolley: 'tramway', busTrolley: 'bis oswa tramway', train: 'tren' },
    routes: (list) => `Liy yo: ${list}.`,
    route: (name) => `Liy ${name}.`,
    howOften: 'Chak konbyen tan',
    every: (vehicle, minutes) =>
      minutes <= 1 ? `yon ${vehicle} apeprè chak minit` : `yon ${vehicle} apeprè chak ${formatNumber(minutes)} minit`,
    only: (one, many, n) => (n === 1 ? `sèlman yon ${one}` : `sèlman ${formatNumber(n)} ${many}`),
    peak: (text) => `Nan maten jou lasemèn ant 7 è ak 9 è: ${text}.`,
    midday: (day, text) => `${day} ant 10 è ak 2 è: ${text}.`,
    noService: (day) => `${day} ant 10 è ak 2 è: pa gen.`,
    days: { wk: 'Jou lasemèn', sa: 'Samdi', su: 'Dimanch' },
    trips: (wk, sa, su) =>
      `${plural(wk, { other: '# depa' })} nan yon jou lasemèn òdinè, ${formatNumber(sa)} nan Samdi ak ${formatNumber(su)} nan Dimanch.`,
    busiest: (n) => `Èdtan ki pi okipe nan jou lasemèn: ${plural(n, { other: '# depa' })}.`,
    firstLast: (first, last) => `Nan jou lasemèn premye a pati a ${first} epi dènye a pati a ${last}.`,
    afterMidnight: (time) => `${time} apre minwi`,
    allNight: 'Sèvis la mache tout nwit nan jou lasemèn.',
    evening: (n) =>
      n === 0 ? 'Pa gen depa apre 8 è nan aswè nan jou lasemèn.' : `Apre 8 è nan aswè nan jou lasemèn: ${plural(n, { other: '# depa' })}.`,
    noWeekday: 'Pa gen sèvis nan jou lasemèn.',
    riders: 'Pasaje yo',
    boardings: (n, period) =>
      n === 0
        ? `Prèske pèsonn pa monte isit la nan yon jou lasemèn mwayen (konte SEPTA, ${period}).`
        : `Apeprè ${plural(n, { other: '# moun' })} monte isit la nan yon jou lasemèn mwayen (konte SEPTA, ${period}).`,
    countedAt: (id) => `Konte nan estasyon SEPTA ${id}, ke estasyon sa a ranplase.`,
    noBoardings: 'SEPTA poko gen okenn konte pou estasyon sa a. Nouvo estasyon ak estasyon ki chanje nimewo jwenn youn lè SEPTA pibliye pwochen konte li.',
    noStationCounts: 'SEPTA pa pibliye konte pou chak platfòm metwo oswa El.',
    noRailCounts: 'SEPTA konte pasaje Regional Rail yo pa estasyon yon fwa pa ane; kat sa a poko montre konte sa yo.',
    stopNumber: (id) => `Nimewo estasyon SEPTA ${id}.`,
    formerNumbers: (ids) => `Anvan sa li te estasyon SEPTA ${ids}.`,
    wheelchair: {
      1: 'SEPTA mete estasyon sa a sou lis kòm aksesib an chèz woulant.',
      2: 'SEPTA mete estasyon sa a sou lis kòm pa aksesib an chèz woulant.',
    },
    source: 'Soti nan orè SEPTA pou yon semèn òdinè. Tan datant yo se mwayèn: bis yo regwoupe epi espas ant yo ogmante.',
  },

  stopAmenities: {
    unnamed: 'Yon estasyon ki pa gen non nan OpenStreetMap',
    number: (ref) => `Estasyon nimewo ${ref}`,
    served: { 1: 'Estasyon bis', 2: 'Estasyon tramway', 3: 'Estasyon bis ak tramway' },
    comfort: {
      3: 'Yon abri, oswa tout estasyon an kouvri anba yon twati',
      2: 'Yon ban, men pa gen abri sou kat la',
      1: 'Pa gen abri ni ban',
      0: 'Poko verifye',
    },
    factsTitle: 'Sa OpenStreetMap di',
    answers: {
      sh: 'Abri',
      bn: 'Ban',
      bi: 'Panye fatra',
      lt: 'Gen limyè aswè',
      tp: 'Pavaj ki gen relyèf pou moun avèg',
      wc: 'Aksè pou chèz woulant',
      db: 'Tablo depa',
      cv: 'Tout estasyon an anba yon twati',
    },
    yes: 'Wi',
    no: 'Non',
    limited: 'Limite',
    unknown: 'Poko verifye',
    nearby: 'make sou kat la pou kont li bò estasyon an',
    unknownNote: 'Poko verifye vle di pèsonn poko anrejistre l. Sa pa vle di estasyon an pa gen anyen.',
    survey: 'Kijan pou verifye estasyon sa a ak StreetComplete',
    openOsm: 'Wè estasyon sa a sou OpenStreetMap',
    surveyRoute: 'Verifye yon liy konplè ak yon fèy ou ka enprime',
    source: 'Soti nan OpenStreetMap, © kontribitè OpenStreetMap, mete ajou chak semèn.',
  },

  heat: {
    tractsTitle: {
      vulnerability: 'Vilnerabilite chalè: chalè a ak moun ki an risk, pa sektè resansman',
      exposure: 'Ekspozisyon chalè: ki jan chak sektè resansman vin cho nan ete',
      sensitivity: 'Sansiblite chalè: konbyen moun nan chak sektè resansman ki an risk nan chalè a',
    },
    fifths: {
      vulnerability: ['Senkyèm sektè ki pi mwens vilnerab', 'Mwens vilnerab', 'Senkyèm nan mitan', 'Plis vilnerab', 'Senkyèm ki pi vilnerab'],
      exposure: ['Senkyèm sektè ki pi fre', 'Pi fre', 'Senkyèm nan mitan', 'Pi cho', 'Senkyèm ki pi cho'],
      sensitivity: ['Senkyèm ki gen pi piti moun an risk', 'Mwens', 'Senkyèm nan mitan', 'Plis', 'Senkyèm ki gen plis moun an risk'],
    },
    priority: 'Kontou: sektè Vil la evalye kòm gen vilnerabilite chalè trè wo',
    tractsNone: 'Sektè endèks la pa rapòte, tankou gwo pak yo ak ayewopò a, pa gen koulè.',
    tractsSource:
      'Soti nan Endèks Vilnerabilite Chalè Vil la (Depatman Sante Piblik ak Biwo Dirabilite), done 2017 a 2019.',
    treeBig: 'Yon pyebwa Vil la: pi gwo pwen an, pi lajè tij la',
    treeSmall: 'Yon ti pyebwa, souvan yon jenn pyebwa ki bezwen dlo',
    treesZoom: 'Zoum antre sou kèk blòk pou wè pyebwa yo.',
    treesYards: 'Pyebwa ki nan lakou prive yo pa nan envantè Vil la, kidonk yon blòk ka gen plis lonbraj pase sa ou wè isit la.',
    floodHigh: 'Plenn inondasyon ki gen 1 pousan chans chak ane: yon inondasyon gen omwen 1 chans sou 100 chak ane',
    floodway: 'Kanal inondasyon an: chenal ki rete louvri pou dlo inondasyon yo ka pase',
    floodModerate: 'Zòn ki gen 0.2 pousan chans chak ane: 1 chans sou 500 chak ane',
    floodCare:
      'Yon rezon pou pran prekosyon, jamè yon pati nan yon nòt: plant ki la yo dwe ka sipòte tè mouye, epi tout sa yo bati swiv règ Vil la pou plenn inondasyon.',
    treeUnnamed: 'Yon pyebwa envantè a pa bay non',
    treeTrunk: (inches) => `Tij li gen apeprè ${formatNumber(inches)} pous lajè a wotè lestomak.`,
    treeNoTrunk: 'Envantè a pa bay gwosè tij li.',
    treeYoung: 'Yon jenn pyebwa bezwen apeprè 20 galon dlo chak semèn depi mas jiska desanm, selon TreePhilly.',
    treesHere: (n) => `${plural(n, { other: '# pyebwa' })} nan kote sa a`,
    treeSource: 'Soti nan envantè pyebwa Depatman Pak ak Rekreyasyon an, pyebwa Vil la kenbe sou ri li yo ak nan pak li yo.',
  },

  art: {
    legend: {
      mural: 'Miral ak penti sou mi',
      sculpture: 'Eskilti ak estati',
      mosaic: 'Mozayik',
      other: 'Lòt kalite: enstalasyon, fontèn, moniman ak plis ankò',
    },
    allOff: 'Chak kalite atizay fèmen nan paramèt kouch sa a.',
    insideHidden: 'Zèv ki andedan bilding yo kache.',
    memorialNote: 'Zèv atizay ki onore yon moun parèt san non.',
    coverage:
      'Soti nan lis Percent for Art Vil la, OpenStreetMap ak Wikidata. Anpil miral poko nan yo; Mural Arts Philadelphia kenbe pi gwo lis la sou pwòp sit li.',
    kinds: {
      0: 'Yon zèv atizay piblik',
      1: 'Yon miral',
      2: 'Yon penti',
      3: 'Atizay nan ri',
      4: 'Yon mozayik',
      5: 'Yon eskilti',
      6: 'Yon estati',
      7: 'Yon biste',
      8: 'Yon relyèf',
      9: 'Yon enstalasyon',
      10: 'Yon fontèn',
      11: 'Yon moniman',
      12: 'Yon memoryal',
      13: 'Vit koulè',
      14: 'Yon plak',
    },
    untitled: 'Pa gen okenn tit ki anrejistre.',
    by: (artist) => `Pa ${artist}.`,
    made: (year) => `Fèt an ${year}.`,
    medium: (medium) => `Fèt ak: ${medium}.`,
    where: (place) => `Kote: ${place}.`,
    inside: 'Andedan yon bilding, kidonk yo ka wè l sèlman lè bilding lan louvri.',
    memorialTitle: 'Zèv atizay memoryal',
    memorialText: 'Zèv atizay sa a onore yon moun. Placekeepers pa montre okenn non sou memoryal yo; sous yo anba a di plis sou li.',
    worksHere: (n) => `${plural(n, { other: '# zèv atizay' })} nan kote sa a`,
    sourcesTitle: 'Sous yo',
    cityRecord: 'Dosye Vil la sou zèv sa a (PDF)',
    cityList: 'Lis Percent for Art Vil la',
    openOsm: 'Wè l sou OpenStreetMap',
    openWikidata: 'Wè l sou Wikidata',
    openWikipedia: 'Li sou li sou Wikipedia',
    website: (site) => `Plis sou li sou ${site}`,
    siteNames: {
      'associationforpublicart.org': 'sit Association for Public Art la',
      'muralarts.org': 'sit Mural Arts Philadelphia a',
      'philart.net': 'philart.net',
    },
    muralArts: 'Chèche nan pwòp lis miral Mural Arts Philadelphia',
    fix: 'Gen yon bagay ki manke oswa ki mal? Ajoute l oswa korije l sou OpenStreetMap; chanjman yo rive sou kat sa a nan apeprè yon semèn.',
    fixLink: 'Modifye sou OpenStreetMap',
    credit: 'Atizay piblik ki soti nan Vil Filadèlfi, OpenStreetMap (© kontribitè OpenStreetMap) ak Wikidata.',
  },

  survey: {
    pageTitle: 'Verifye yon liy',
    intro:
      'Chwazi yon liy bis oswa tramway SEPTA ak yon direksyon pou jwenn yon fèy verifikasyon: estasyon li yo nan Filadèlfi nan lòd, sa OpenStreetMap montre nan chak youn kounye a, ak bwat pou ranpli. Enprime l, oswa make bwat yo sou telefòn ou pandan w ap mache.',
    guideLink: 'Kijan pou verifye estasyon bis',
    loading: 'N ap chaje liy yo…',
    loadFailed: 'Nou pa t ka chaje lis liy yo. Verifye koneksyon ou epi eseye ankò.',
    notPublished: 'Fèy verifikasyon yo poko pibliye. Yo parèt apre pwochen mizajou semèn nan.',
    sheetFailed: 'Nou pa t ka chaje fèy liy sa a. Verifye koneksyon ou epi eseye ankò.',
    retry: 'Eseye ankò',
    routeLabel: 'Liy',
    routePlaceholder: 'Chwazi yon liy',
    buses: 'Liy bis',
    trolleys: 'Liy tramway',
    directionLabel: 'Direksyon',
    partsLabel: 'Pataje ant',
    partsChoice: (n) => (n === 1 ? 'yon moun oswa yon pè' : `${n} moun oswa pè`),
    directionTo: (dir, to) => `${dir} pou ale nan ${to}`,
    towards: (to) => `Pou ale nan ${to}`,
    directionNumber: (n) => `Direksyon ${n}`,
    stopCount: (n) => plural(n, { other: '# estasyon' }),
    title: (route, direction) => `Liy ${route}, ${direction}`,
    summary: (stops, miles) =>
      `${plural(stops, { other: '# estasyon' })} nan Filadèlfi, ${miles} de premye a rive nan dènye a an liy dwat.`,
    outside: (n) => `${plural(n, { other: '# lòt estasyon' })} deyò Filadèlfi epi yo pa sou fèy sa a.`,
    answersMissing:
      'Nou pa t ka chaje sa OpenStreetMap di nan estasyon sa yo kounye a, kidonk estasyon li konnen yo parèt kòm poko verifye.',
    statusTitle: 'Sa OpenStreetMap montre kounye a',
    status: {
      shelter: 'Abri',
      bench: 'Ban sèlman',
      neither: 'Okenn',
      unsurveyed: 'Poko verifye',
      missing: 'Pa jwenn nan OpenStreetMap',
    },
    statusLong: {
      shelter: 'ak yon abri oswa yon twati',
      bench: 'ak yon ban men pa gen abri sou kat la',
      neither: 'san youn ni lòt',
      unsurveyed: 'nan OpenStreetMap men poko verifye',
      missing: 'pa jwenn nan OpenStreetMap',
    },
    estimateTitle: 'Konbyen tan sa pran',
    estimate: (time) => `Estimasyon nou: ${time} pou yon moun oswa yon pè.`,
    duration: (hours, minutes) =>
      `apeprè ${[hours ? plural(hours, { other: '# èdtan' }) : '', minutes || !hours ? `${formatNumber(minutes)} minit` : ''].filter(Boolean).join(' ')}`,
    estimateBasis:
      'Sa se pwòp estimasyon nou, se pa yon mezi: mache apeprè 3 mil pa èdtan de yon estasyon a yon lòt, ak apeprè yon minit nan chak estasyon. Pou rive nan premye estasyon an epi retounen lakay, se plis tan.',
    trolleyTunnel:
      'Liy tramway T1 rive T5 pase anba tè nan bout Center City yo, nan yon tinèl ki gen estasyon depi 13th Street rive 37th Street. Kite estasyon sa yo deyò: verifikasyon sa a se pou estasyon ki sou ri.',
    asOf: (osm, schedules) =>
      [osm ? `Sa OpenStreetMap montre a se nan dat ${osm}.` : null, schedules ? `Estasyon ki soti nan orè SEPTA (${schedules}).` : null]
        .filter(Boolean)
        .join(' '),
    print: 'Enprime fèy la',
    printAll: 'Enprime chak pati',
    printPart: (n) => `Enprime sèlman pati ${n}`,
    part: (n, of) => `Pati ${n} sou ${of}`,
    partStops: (first, last) => (first === last ? `estasyon ${first}` : `estasyon ${first} a ${last}`),
    partEstimate: (time, miles) => `Estimasyon nou: ${time} (${miles} mache).`,
    sheetFor: (route, direction) => `Fèy verifikasyon: liy ${route}, ${direction}`,
    howToFill:
      'Make W (wi) oswa N (non) pou chak bagay ou jwenn nan estasyon an. "Limyè" vle di yon limyè klere estasyon an aswè: yon lanp nan abri a oswa yon lanp ri toupre li. "Bezwen reparasyon" vle di yon abri, yon ban, yon panno oswa yon panye fatra ki kase. Si ou pa ka di, kite bwat la vid: tanpri pa janm devine.',
    nameLine: 'Non:',
    dateLine: 'Dat:',
    columns: {
      number: '#',
      stop: 'Estasyon',
      now: 'OpenStreetMap kounye a',
      sh: 'Abri',
      bn: 'Ban',
      bi: 'Panye fatra',
      lt: 'Limyè',
      rp: 'Bezwen reparasyon',
      nt: 'Nòt',
    },
    yes: 'Wi',
    no: 'Non',
    yesShort: 'W',
    noShort: 'N',
    stopNumber: (sid) => `Estasyon SEPTA ${sid}`,
    answerLabel: (n, name, question, answer) => `Estasyon ${n}, ${name}: ${question}, ${answer}`,
    repairLabel: (n, name) => `Estasyon ${n}, ${name}: bezwen reparasyon`,
    notesLabel: (n, name) => `Estasyon ${n}, ${name}: nòt`,
    openOsm: 'Wè sou OpenStreetMap',
    editOsm: 'Modifye',
    answered: (n, of) => `Ou ranpli ${formatNumber(n)} sou ${plural(of, { other: '# estasyon' })} sou aparèy sa a.`,
    kept: 'Sa ou make ak sa ou tape isit la rete nan navigatè sa a sou aparèy sa a sèlman. Nou pa voye anyen okenn kote.',
    notKept: 'Navigatè sa a pa kenbe sa ou make, kidonk ou pral pèdi l si ou kite paj la. Enprime fèy la oswa ekri l.',
    clear: 'Efase sa mwen ranpli',
    clearConfirm: 'Efase chak bwat ak chak nòt ou ranpli pou direksyon sa a?',
    safetyTitle: 'Anvan ou ale: rete an sekirite',
    safety: [
      'Rete sou twotwa a. Pa janm kanpe nan ri a oswa antre nan bann bis la pou gade yon estasyon.',
      'Ale pandan jounen an, epi ale ak yon zanmi.',
      'Sispann mache anvan ou gade fèy sa a oswa telefòn ou, epi gade anlè anvan ou travèse.',
      'Pran sou kote pou pasaje yo ka tann epi monte. Pa pran foto moun.',
    ],
    answersTitle: 'Mete repons ou yo nan OpenStreetMap',
    withApp:
      'Ak aplikasyon StreetComplete: reponn kesyon li yo sou chak estasyon pandan w kanpe la. Repons ou yo ale dirèkteman nan OpenStreetMap.',
    withoutApp: 'San yon aplikasyon sou telefòn, sou yon òdinatè lè ou tounen lakay, itilize pwòp editè OpenStreetMap:',
    editorSteps: [
      'Konekte sou openstreetmap.org. Yon kont gratis.',
      'Louvri paj sa a ankò epi itilize lyen Modifye bò chak estasyon. Editè a louvri ak estasyon an chwazi.',
      'Nan panno agòch la, klike sou bwat Shelter (abri) la. Anba "Add field:" ajoute Bench (ban), Waste Bin (panye fatra a) ak Lit (limyè), epi klike sou bwat yo tou. Chak bwat chanje ak chak klik: Yes, apre No, epi tounen sou Unknown.',
      'Klike sou Save, ekri yon ti nòt sou sa ou fè, tankou "Surveyed bus stop shelters and benches", epi klike sou Upload.',
    ],
    notFound:
      'Kote fèy la di "Pa jwenn nan OpenStreetMap", gade byen alantou estasyon an nan editè a anvan: li ka trase kèk pa pi lwen. Si li reyèlman manke, klike sou Point, mete pwen an sou twotwa a bò panno estasyon an, epi chwazi Bus Stop.',
    repairNote:
      'OpenStreetMap pa anrejistre domaj, kidonk "Bezwen reparasyon" ak nòt ou yo rete ak gwoup ou a. Yo ede lè ou pale ak SEPTA oswa Vil la sou yon estasyon.',
    updates: 'Placekeepers li OpenStreetMap chak Lendi, kidonk repons ou yo rive sou kat nou an ak sou fèy sa yo nan apeprè yon semèn.',
    printedFrom: 'Enprime nan Placekeepers, yon kat gratis pou vwazen Filadèlfi. Estasyon ki soti nan SEPTA; done kat © kontribitè OpenStreetMap.',
    routeTitle: (route) => `Liy ${route}`,
    routesHere: (n) => `${plural(n, { other: '# liy' })} isit la`,
    surveyThisRoute: 'Verifye estasyon liy sa a pou abri ak ban',
  },

  amenities: {
    legend: {
      benches: 'Yon ban',
      picnic_tables: 'Yon tab pikonik',
      drinking_water: 'Dlo pou bwè',
      toilets: 'Yon twalèt piblik',
      bookcases: 'Yon ti bibliyotèk gratis',
    },
    mappedNote: 'Se sèlman sa moun te ajoute nan OpenStreetMap ki parèt isit la, kidonk anpil manke.',
    addMissing: 'Kijan pou ajoute sa ki manke a',
    titles: {
      benches: 'Ban',
      picnic_tables: 'Tab pikonik',
      drinking_water: 'Dlo pou bwè',
      toilets: 'Twalèt piblik',
      bookcases: 'Ti bibliyotèk gratis',
    },
    facts: {
      br: ['Gen yon apiye do', 'Pa gen apiye do'],
      cv: ['Anba yon twati', 'Pa anba yon twati'],
      bt: ['Ou ka ranpli yon boutèy isit la', 'Se pa pou ranpli yon boutèy'],
      sn: ['Yon pati nan ane a sèlman', 'Tout ane a'],
      in: ['Andedan', 'Deyò'],
      fee: ['Gen yon frè', 'Gratis'],
      ct: ['Gen yon tab pou chanje ti bebe', 'Pa gen tab pou chanje ti bebe'],
    },
    access: { 1: 'Louvri pou nenpòt moun', 2: 'Pou kliyan sèlman' },
    wheelchair: {
      1: 'Aksesib an chèz woulant',
      0: 'Pa aksesib an chèz woulant',
      2: 'Aksè limite pou chèz woulant',
    },
    hours: (text) => `Orè louvèti jan yo make sou kat la: ${text}`,
    nothingMore: 'OpenStreetMap poko di plis sou li.',
    unknownNote: 'Sa ki pa sou lis la, nou poko konnen l. Sa pa vle di repons lan se non.',
    openOsm: 'Wè l sou OpenStreetMap',
    fix: 'Manke oswa mal? Kijan pou korije l',
    source: 'Jan l make nan OpenStreetMap, © kontribitè OpenStreetMap, mete ajou chak semèn.',
  },

  places: {
    legend: {
      park_water: 'Yon fontèn pou bwè nan yon pak',
      libraries: 'Yon branch Free Library',
      recreation_centers: 'Yon sant rekreyasyon',
      playgrounds: 'Yon teren jwèt',
    },
    poolLegend: { 1: 'Yon pisin', 2: 'Yon zòn jwèt dlo', 3: 'Yon awozwa dlo' },
    notInService: 'Pa an sèvis ane sa a',
    poolsShown: { in_service: 'Se sèlman sa ki an sèvis ane sa a ki parèt.', all: 'Sèk vid yo pa an sèvis ane sa a.' },
    recreationKinds: {
      1: 'Sant rekreyasyon',
      2: 'Sant pou granmoun aje',
      3: 'Sant edikasyon sou anviwònman',
    },
    poolKinds: { 1: 'Pisin', 2: 'Zòn jwèt dlo', 3: 'Awozwa dlo' },
    waterKinds: { 1: 'Fontèn pou bwè', 2: 'Estasyon pou ranpli boutèy' },
    status: { 1: 'An sèvis ane sa a', 0: 'Pa an sèvis ane sa a' },
    statusUnknown: 'Parks and Recreation (Depatman Pak ak Rekreyasyon) pa di si li an sèvis ane sa a.',
    indoor: { 1: 'Andedan', 0: 'Deyò' },
    waterIndoor: 'Andedan yon bilding: li louvri lè bilding lan louvri.',
    accessible: { 1: 'Make kòm aksesib pou moun ki andikape', 0: 'Pa make kòm aksesib' },
    opened: (date) => `Te louvri pou sezon an nan ${date}.`,
    gym: 'Gen yon jimnazyòm.',
    noBuilding: 'Yon sit pwogram ki pa gen pwòp bilding li.',
    inPark: (park) => `Nan ${park}.`,
    phone: (number) => `Telefòn: ${number}`,
    libraryPage: 'Orè ak evènman sou sit entènèt Free Library la',
    seasonNote: 'Pisin yo louvri pou ete a sèlman. Verifye ak Parks and Recreation pou orè semèn sa a.',
    source: {
      libraries: 'Soti nan lis kote Free Library of Philadelphia Vil la.',
      parks: 'Soti nan Philadelphia Parks and Recreation, jan Vil la pibliye l.',
    },
    cooling: {
      legendOpen: 'Yon sit pou chofe oswa pou rafrechi ki make kòm louvri',
      legendClosed: 'Make kòm fèmen, oswa san okenn estati',
      kindShown: {
        any: 'Sit pou tan cho ak pou tan fwa.',
        cooling: 'Sèlman sit pou rafrechi, pou tan cho.',
        warming: 'Sèlman sit pou chofe, pou tan fwa.',
      },
      asListed: (copied, changed) =>
        `${copied ? `Jan Vil la te make yo nan ${copied}` : 'Jan Vil la te make yo lè kat sa a te kopye lis la pou dènye fwa'}${changed ? ` (lis la te chanje pou dènye fwa nan ${changed})` : ''}. Se pa an dirèk: sit yo louvri epi fèmen selon move tan an, kidonk rele sit la oswa 311 anvan ou ale.`,
      oneMarker: 'Yon bibliyotèk oswa yon sant rekreyasyon ki se yon sit tou parèt yon sèl fwa, kòm yon sit.',
      kinds: {
        1: 'Branch Free Library',
        2: 'Sit Parks and Recreation',
        3: 'Patnè kominotè',
        4: 'Sant kominotè Philadelphia Housing Authority',
      },
      title: 'Sit pou chofe oswa pou rafrechi',
      status: { 1: 'Make kòm louvri', 0: 'Make kòm fèmen' },
      statusUnknown: 'Pa gen okenn estati make',
      both: 'Make kòm yon sit pou chofe ak yon sit pou rafrechi',
      cooling: 'Make kòm yon sit pou rafrechi',
      warming: 'Make kòm yon sit pou chofe',
      neither: 'Pa make kòm yon sit pou chofe ni pou rafrechi',
      hours: (hours) => `Orè jan yo make: ${hours}`,
      services: (services) => `Sa li ofri, jan yo make: ${services}`,
      capacity: (n) => `Plas pou ${formatNumber(n)} moun, jan yo make`,
      water: 'Gen yon estasyon dlo',
      restroom: 'Gen yon twalèt piblik',
      also: {
        lib: (name) => `Li sou kat la tou kòm yon branch Free Library: ${name}.`,
        rec: (name) => `Li sou kat la tou kòm yon sit Parks and Recreation: ${name}.`,
      },
      alsoSite: 'Vil la mete l sou lis tou kòm yon sit pou chofe oswa pou rafrechi.',
    },
    playgrounds: {
      kind: 'Teren jwèt',
      ages: { 1: 'Pou timoun 2 a 5 an', 2: 'Pou timoun 5 a 12 an', 3: 'Pou timoun 2 a 12 an' },
      installed: (year) => `Enstale an ${year}`,
    },
  },

  conditions: {
    legend: {
      dumping: 'Fatra jete ilegalman',
      dark_lights: 'Yon limyè nan ri oswa nan koridò ki etenn',
      graffiti: 'Grafiti',
    },
    legendOpen: (what) => `${what}: yon demann ki toujou louvri`,
    legendClosed: (what) => `${what}: tout demann fèmen`,
    legendSize: 'Yon sèk ki pi gwo vle di plis demann sou blòk sa a.',
    legendWindow: 'Demann bay Philly311 nan dènye 90 jou yo, konte pa blòk, pa janm pa adrès.',
    openOnly: 'Se sèlman blòk ki gen yon demann ki toujou louvri ki parèt.',
    titles: {
      dumping: 'Fatra jete ilegalman rapòte',
      dark_lights: 'Limyè etenn rapòte',
      graffiti: 'Grafiti rapòte',
    },
    summary: (n, open) =>
      `${plural(n, { other: '# demann' })} bay Philly311 nan dènye 90 jou yo, ${open === 0 ? 'pa gen okenn ki' : `${formatNumber(open)} ki`} toujou louvri.`,
    newest: (date) => `Dènye a te fèt nan ${date}.`,
    alley: (n, total) =>
      n === total ? (n === 1 ? 'Li te sou yon limyè koridò.' : 'Tout te sou limyè koridò.') : `${formatNumber(n)} ladan yo sou yon limyè koridò.`,
    block: (street) => `Sou blòk ${street} sa a.`,
    byBlock: 'Konte pa blòk, pa janm pa adrès, e nou pa montre anyen sou ki moun ki fè rapò a.',
    meaning: 'Yon demann montre yon moun te remake epi te mande Vil la èd. Gen kèk blòk ki mande pi souvan pase lòt.',
    report: 'Rapòte l bay Philly311',
    source: 'Soti nan dosye 311 Vil la (Philly311), mete ajou chak semèn.',
  },

  walk: {
    walkTitle: {
      index: 'Ki jan chak zòn bon pou mache (endèks mache EPA a)',
      corners: 'Kwen ri: ki jan ri yo konekte (EPA)',
      transit: 'Ki jan estasyon transpò ki pi pre a toupre (EPA)',
      mix: 'Ki jan kay, travay ak magazen melanje byen (EPA)',
    },
    walkCompared: {
      city: 'Konpare andedan Filadèlfi: chak koulè gen apeprè yon senkyèm gwoup blòk vil la.',
      nation: 'Konpare ak tout peyi a, jan EPA klase chak gwoup blòk nan Etazini.',
    },
    walkFifths: {
      index: ['Senkyèm ki pi mwens bon pou mache', 'Mwens bon pou mache', 'Senkyèm nan mitan', 'Pi bon pou mache', 'Senkyèm ki pi bon pou mache'],
      corners: ['Pi piti kwen', 'Mwens', 'Senkyèm nan mitan', 'Plis', 'Pi plis kwen'],
      transit: ['Pi lwen transpò', 'Pi lwen', 'Senkyèm nan mitan', 'Pi pre', 'Pi pre transpò'],
      mix: ['Pi mwens melanje', 'Mwens melanje', 'Senkyèm nan mitan', 'Plis melanje', 'Pi melanje'],
    },
    walkNationFifths: ['Senkyèm anba nan peyi a', 'Anba mitan an', 'Senkyèm nan mitan', 'Anwo mitan an', 'Senkyèm anwo nan peyi a'],
    walkClasses: [
      'Pi mwens bon pou mache: yon endèks 1 a 5.75',
      'Anba mwayèn: 5.76 a 10.5',
      'Anwo mwayèn: 10.51 a 15.25',
      'Pi bon pou mache: 15.26 a 20',
    ],
    walkNationNote:
      'Konpare ak tout peyi a, prèske tout Filadèlfi anwo mwayèn oswa pami zòn ki pi bon pou mache, kidonk konpare andedan vil la montre diferans li yo pi byen.',
    walkParts:
      'Endèks la bay nòt de 1 a 20. Kwen ri yo ak transpò konte chak yon tyè nan li, epi de mezi melanj kay, travay ak magazen konte chak yon sizyèm.',
    walkSource: 'Soti nan Smart Location Database EPA a (2021), bati ak done apeprè 2017 a 2019.',

    reachTitle: {
      people: 'Moun ki rete nan 5 minit mache (resansman 2020)',
      places: 'Kalite kote chak jou nan 10 minit mache',
      corners: 'Kwen ri nan 5 minit mache',
    },
    reachBins: {
      people: ['Mwens pase 1,000 moun', '1,000 a 2,499', '2,500 a 3,999', '4,000 a 5,999', '6,000 oswa plis'],
      places: ['2 oswa mwens nan 7 kalite yo', '3 oswa 4 kalite', '5 kalite', '6 kalite', 'Tout 7 kalite yo'],
      corners: ['Mwens pase 10 kwen', '10 a 24', '25 a 49', '50 a 74', '75 oswa plis'],
    },
    reachKinds:
      'Sèt kalite yo: yon bibliyotèk, yon sant rekreyasyon, yon pisin oswa yon zòn jwèt dlo an sèvis, yon fontèn pou bwè nan yon pak, yon lekòl, yon makèt oswa yon mache ki aksepte SNAP, ak yon estasyon bis, tramway oswa tren.',
    reachCorners: 'Yon kwen se kote twa ri oswa plis moun ka mache sou yo rankontre. Plis kwen vle di blòk ki pi kout ak plis fason pou ale yon kote a pye.',
    reachMeasured:
      'Konte depi mitan chak egzagòn an liy dwat: 400 mèt pou 5 minit mache, 800 pou 10 minit mache. Sa rive yon ti jan pi lwen pase yon mache ak long ri yo, epi li travèse liy tren, otowout ak rivyè.',
    reachSource: {
      people: 'Moun ki soti nan resansman 2020, konte pa blòk.',
      places: 'Kote ki soti nan Vil la, Parks and Recreation, USDA ak SEPTA. Kote ki jis lòt bò limit vil la pa konte.',
      corners: 'Kwen ki soti nan liy mitan ri Vil la.',
    },

    stressLevels: {
      1: 'Nivo 1: ase kalm pou pifò moun de tout laj',
      2: 'Nivo 2: bon pou pifò granmoun',
      3: 'Nivo 3: sèlman pou moun ki konfyan',
      4: 'Nivo 4: sèlman pou moun ki pi brav',
    },
    stressShown: {
      stressful: 'Se sèlman ri ki estresan, nivo 3 ak 4, ki parèt.',
      calm: 'Se sèlman ri ki kalm, nivo 1 ak 2, ki parèt.',
    },
    stressZoom: 'Lè ou zoum soti, kat la montre ri ki estresan ak ri ki gen yon liy bisiklèt oswa yon santye. Zoum antre pou wè chak ri.',
    stressSource:
      'Soti nan rezo Level of Traffic Stress Delaware Valley Regional Planning Commission (DVRPC): evalye selon bann yo, vitès trafik la ak kalite liy bisiklèt la, se pa nan monte bisiklèt sou chak ri.',
    stressTitle: (level) => `Nivo ${level} sou 4`,
    stressMeaning: {
      1: 'Ase kalm pou pifò moun de tout laj, timoun yo tou.',
      2: 'Bon pou pifò granmoun: yon ti estrès trafik.',
      3: 'Se sèlman moun ki konfyan ki santi yo alèz isit la.',
      4: 'Trafik chaje ak rapid: sèlman moun ki pi brav yo.',
    },
    stressOtherWay: (level) => `Monte bisiklèt nan lòt direksyon an pi kalm: nivo ${level}.`,
    facilities: {
      0: 'Pa gen liy bisiklèt',
      1: 'Yon wout bisiklèt ki gen panno',
      2: 'Make liy pataje (sharrows)',
      3: 'Yon liy bisiklèt',
      4: 'Yon liy bisiklèt ak yon espas tanpon',
      5: 'Yon liy bisiklèt ki pwoteje',
      6: 'Yon santye oswa yon chemen lwen trafik',
    },
    stressSpeed: (mph) => `Trafik la ap woule apeprè ${formatNumber(mph)} mil pa èdtan, selon limit vitès la oswa estimasyon DVRPC.`,
    stressLanes: (n) => `${plural(n, { other: '# bann' })} an tout.`,
    streetsHere: (n) => `${plural(n, { other: '# ri' })} isit la`,
    stressDetailsSource: 'Soti nan rezo Level of Traffic Stress DVRPC, evalye selon bann yo, vitès yo ak liy bisiklèt yo.',
  },

  landBank: {
    pageTitle: 'Land Bank an chif',
    back: 'Retounen nan kat la',
    intro:
      'Konbyen pwopriyete Philadelphia Land Bank ak lòt ajans tè Vil la te transfere, ane pa ane, selon pwòp dosye akt Vil la. Se sèlman kantite ak total: pa gen non ni adrès.',
    loading: 'N ap chaje chif yo',
    loadFailed: 'Nou pa t ka chaje chif yo. Verifye koneksyon ou epi eseye ankò.',
    retry: 'Eseye ankò',
    missing: 'Chif yo poko pibliye. Yo parèt apre pwochen mizajou done semèn nan.',
    noStatus: 'Pa gen estati',
    agencyLabel: 'Ajans',
    agencyHelp: 'Tout seksyon anba yo swiv chwa sa a, eksepte konte pwòp Vil la pa pwogram ak konte chak semèn lis teren yo.',
    agencies: {
      all: 'Tout kat ajans yo',
      PLB: 'Philadelphia Land Bank',
      PRA: 'Otorite Redevlopman',
      PHDC: 'PHDC',
      PUB: 'Vil Filadèlfi',
    },
    agencyLong: {
      all: 'kat ajans tè yo ansanm',
      PLB: 'Philadelphia Land Bank',
      PRA: 'Philadelphia Redevelopment Authority (Otorite Redevlopman)',
      PHDC: 'Philadelphia Housing Development Corporation (PHDC)',
      PUB: 'Vil Filadèlfi',
    },
    headline: (agency, n, deeds, from, to) =>
      `Nan dosye akt Vil la depi ${from} jiska ${to}, ${agency} te transfere ${plural(n, { other: '# pwopriyete' })} nan ${plural(deeds, { other: '# akt' })}.`,
    movedAll: (n) =>
      `Pa konte: ${plural(n, { other: '# mouvman' })} yon pwopriyete soti nan yon ajans pou ale nan yon lòt, tankou soti nan Vil la pou ale nan Land Bank.`,
    moved: (received, handed) =>
      `Li te resevwa ${plural(received, { other: '# pwopriyete' })} nan men lòt ajans yo tou epi li te remèt ${formatNumber(handed)} ba yo. Mouvman sa yo pa konte kòm transfè pwopriyete.`,
    whatCounts:
      'Yon transfè isit la se yon akt ki soti nan yon ajans tè pou ale bay yon moun deyò kat ajans yo: yon moun, yon konpayi, yon òganizasyon san bi likratif, oswa yon lòt enstitisyon piblik tankou Philadelphia Housing Authority. Chak pwopriyete konte yon sèl fwa. Koreksyon, lage ansyen restriksyon, mouvman ant ajans yo ak akò ki anrejistre kòm akt yo kite deyò.',
    partial: (year, date) => `${year} rive sèlman jiska ${date}: dosye akt Vil la an reta apeprè uit semèn.`,
    noNames: 'Nou li non achtè yo sèlman pou fè diferans ant yon moun ak yon konpayi epi pou verifye kay ki bò kote a. Nou pa kenbe okenn ladan yo.',
    showNumbers: 'Montre chif yo',
    tableLabel: (what) => `Chif yo: ${what}`,
    downloadCsv: 'Telechaje CSV',
    year: 'Ane',
    total: 'Total',
    properties: 'Pwopriyete',
    chartLabel: (what, from, to, max) => `${what}, ${from} a ${to}. Ane ki pi wo a gen ${max}. Menm chif yo nan tablo anba graf la.`,
    perYear: {
      title: 'Transfè pa ane',
      caption: 'Pwopriyete ki transfere chak ane. Yon sèl akt ka transfere anpil pwopriyete.',
      deeds: 'Akt',
    },
    buyers: {
      title: 'Ki moun achtè yo ye',
      caption:
        'Kalite chak achtè, li nan non akt la anrejistre. Yon òganizasyon san bi likratif konte kòm youn sèlman lè non li di sa; anpil òganizasyon san bi likratif gen non tankou konpayi epi yo konte kòm konpayi.',
      groups: {
        individual: 'Moun',
        company: 'Konpayi',
        nonprofit: 'Òganizasyon san bi likratif',
        public: 'Lòt enstitisyon piblik',
        unknown: 'Pa klè',
      },
      share: (label, pct) => `${label}: ${pct}%`,
      shares: 'Pati nan tout pwopriyete ki transfere nan lane sa yo',
    },
    programs: {
      title: 'Pa pwogram',
      caption:
        'Akt yo pa di ki pwogram yon transfè te pase ladan l. Yo ka dedwi youn: yon sèl teren ki transfere bay yon moun ki posede yon kay ki manyen li se pwobableman yon lakou sou kote oswa dèyè. Graf sa a konte teren sa yo, se dedaksyon nou. Rès yo pa konnen nan dosye yo, sa pa vle di yo pa t lakou sou kote.',
      series: 'Lakou sou kote oswa dèyè, dedaksyon nou',
      checked:
        'Kijan nou verifye l (9 oktòb 2026): 10 nan teren sa yo, chwazi o aza ant 2019 ak 2026, chèche alamen. Nan 10 yo tout achtè a se pwopriyetè nan dosye kay ki bò kote oswa dèyè teren an epi li resevwa lapòs la. Si chak youn te pase nan pwogram lakou sou kote a, sa toujou se dedaksyon nou.',
      compare: (cityTotal, ours, oursPlb, from, to) =>
        `Pou ane fiskal ${from} a ${to} pwòp tablo Vil la te konte ${formatNumber(cityTotal)} lakou sou kote. Nan akt yo nou dedwi ${formatNumber(ours)} nan tout kat ajans yo, ${formatNumber(oursPlb)} ladan yo nan Land Bank.`,
      cityTitle: 'Pwòp konte Vil la pa pwogram',
      cityCaption: (edited) =>
        `Soti nan tablo Land Management Vil la, pa ane fiskal (jiyè a jen). Li te mete ajou pou dènye fwa ${edited}, kidonk dènye ane a pa konplè, epi pou lojman li konte kay yo bati, se pa pwopriyete.`,
      fy: 'Ane fiskal',
      sideYards: 'Lakou sou kote',
      gardens: 'Jaden oswa espas louvri',
      business: 'Ekspansyon biznis',
      homesBelow30: 'Kay, anba 30% revni zòn nan',
      homes60to80: 'Kay, 60% a 80%',
      homes80to120: 'Kay, 80% a 120%',
      homesMarket: 'Kay, pri mache',
      oursPlb: 'Dedaksyon nou sou lakou sou kote, Land Bank',
      oursAll: 'Dedaksyon nou sou lakou sou kote, tout kat yo',
      fyLabel: (fy) => `${fy - 1} a ${fy}`,
    },
    prices: {
      title: 'Pri ki anrejistre sou akt yo',
      caption: (max) =>
        `Pri a se sa akt la anrejistre pou chak pwopriyete (pòsyon li lè yon sèl akt kouvri plizyè). Se pa toujou lajan ki peye: gen kèk pwogram ki vann pou yon pri senbolik epi pwoteje itilizasyon teren an ak yon ipotèk 30 an, epi akt lakou sou kote yo souvan anrejistre valè evalyasyon teren an. Pri mitan an gen mwatye pri yo anba l ak mwatye anlè l. "Senbolik" vle di ${max} oswa mwens.`,
      priced: 'Ak yon pri',
      median: 'Pri mitan',
      nominal: 'Pri senbolik',
      none: 'Pa gen pri ki anrejistre',
      summary: (median, pct) => `Pri mitan nan lane sa yo: ${median}. ${pct}% te transfere pou yon pri senbolik.`,
    },
    districts: {
      title: 'Pa distrik konsèy',
      caption:
        'Kote pwopriyete yo ye, selon limit distrik konsèy jodi a. Limit distrik yo chanje apre chak resansman, kidonk ane ki pi bonè yo plase selon limit jodi a tou.',
      district: 'Distrik',
      districtName: (n) => `Distrik ${n}`,
      noLocation: 'Pa gen kote nan dosye yo',
      allYears: 'Tout ane yo',
      chartLabel: 'Pwopriyete ki transfere nan chak distrik konsèy. Menm chif yo nan tablo anba a.',
    },
    listed: {
      title: 'Teren ki sou lis kòm disponib, semèn pa semèn',
      caption: (from) =>
        `Lis pwopriyete piblik Vil la, menm lis kat pwopriyete Land Bank lan montre, konte chak semèn kopi nou an te mete ajou. Konte a kòmanse nan ${from}; pa gen konte semèn anvan sa.`,
      date: 'Dat lis la',
      records: 'Sou lis kòm disponib',
      parcels: 'Pasèl',
      sideYard: 'Louvri pou yon vwazen kòm lakou sou kote',
      oneWeek: 'Yon graf parèt lè gen de semèn pou konpare.',
      byStatus: (date) => `Chak teren sou lis la selon estati li, ${date}`,
      status: 'Estati',
      count: 'Dosye',
      chartLabel: (from, to) => `Teren ki sou lis kòm disponib chak semèn, ${from} a ${to}. Menm chif yo nan tablo anba a.`,
      mapLink: 'Kat Land Bank lan pou pwopriyete ki sou lis',
    },
    limits: {
      title: 'Sa chif sa yo pa ka montre',
      items: [
        'Konbyen tan moun ki mande yo te tann, konbyen te mande, oswa konbyen yo te refize. Dosye piblik yo gen akt, se pa demann.',
        'Pwogram ki dèyè pifò transfè yo. Akt yo pa di; lakou sou kote ak dèyè se dedaksyon nou, epi pwòp konte Vil la pa pwogram yo sispann an avril 2023.',
        'Sa yo te bati oswa kiltive apre sa, oswa si yo te respekte restriksyon yon teren.',
        'Sa yon achtè te peye finalman. Yon akt anrejistre yon pri, epi gen kèk pwogram ki mare yon pri senbolik ak yon ipotèk 30 an.',
        'Tè ajans yo lwe oswa bay lisans, tankou akò jaden. Pa gen okenn akt ki anrejistre sa yo.',
        'Akt anvan 2014, ak akt nan dènye uit semèn yo, ke Vil la poko pibliye.',
      ],
    },
    sources: {
      title: 'Sous ak dat',
      deeds: (fetched, last) =>
        `Akt: Vil Filadèlfi, Depatman Dosye (Department of Records), transfè byen imobilye, li ${fetched}; akt ki pi resan an gen dat ${last}.`,
      programs: (edited) =>
        `Konte pa pwogram: Vil Filadèlfi, Depatman Planifikasyon ak Devlopman (Department of Planning and Development), tablo Land Management, mete ajou pou dènye fwa ${edited}.`,
      listed:
        'Teren ki sou lis: Vil Filadèlfi, Depatman Planifikasyon ak Devlopman (Land Management), jan kat pwopriyete Philadelphia Land Bank lan montre yo.',
      districts: 'Distrik konsèy: Vil Filadèlfi, limit jodi a.',
      neighbours:
        'Pou dedaksyon sou lakou sou kote: lis pwopriyetè Vil la (Biwo Pwopriyete Evalyasyon, Office of Property Assessment) ak fòm pasèl yo (Depatman Dlo, Water Department).',
      board: 'Ajanda konsèy Land Bank lan, ki bay lis chak dispozisyon pa pwogram',
      council: 'Lejislasyon Konsèy Minisipal, kote Konsèy la apwouve chak dispozisyon Land Bank',
      method: 'Kijan nou konte, an detay',
      deedsLink: 'Transfè byen imobilye Vil la',
      programsLink: 'Tablo Land Management Vil la',
    },
    csv: {
      years: (agency) => `Transfè pa ane ak pa ajans (kat ajans yo ansanm ak chak youn; paj sa a te montre ${agency}).`,
      districts: 'Transfè pa distrik konsèy (limit jodi a) ak pa ane, pou kat ajans yo ansanm ak chak youn.',
      programs: 'Pwòp konte Vil la pa pwogram ak ane fiskal, bò kote dedaksyon nou sou lakou sou kote.',
      listed: 'Teren ki sou lis pwopriyete piblik Vil la kòm disponib, chak semèn depi kòmansman konte a.',
      counts: 'Kantite sèlman: pa gen non, pa gen adrès ak pa gen nimewo pasèl.',
      dates: (fetched, last) => `Akt li ${fetched}; akt ki pi resan an gen dat ${last}.`,
    },
  },

  basemap: {
    missing: 'Kat debaz la pa disponib, kidonk ri yo ak non kote yo kache. Kouch done yo toujou mache.',
    unavailable: 'Kat debaz la pa disponib isit la, kidonk kat la montre yon fon plen.',
    legend: 'Ri, bilding, pak, dlo ak non kote, an koulè.',
    legendMuted: 'Ri, bilding, pak, dlo ak non kote, an gri, pou done yo parèt pi byen.',
  },

  credits: {
    data: (statusUrl) => `Done: Vil Filadèlfi ak <a href="${statusUrl}">lòt yo</a>`,
  },

  status: {
    pageTitle: 'Eta done yo',
    intro: 'Placekeepers mete done li yo ajou chak semèn. Si yon sous kase, kat la kenbe dènye bon kopi a epi li di sa isit la.',
    back: 'Retounen nan kat la',
    loading: 'N ap chaje eta done yo',
    loadFailed: 'Nou pa t ka chaje fichye eta done yo. Kat la ka toujou mache ak done ki pi ansyen.',
    retry: 'Eseye ankò',
    builtOn: (date) => `Dènye mizajou: ${date}`,
    buildId: (id) => `Vèsyon konstwi ${id}`,
    summaryAllOk: 'Tout sous yo ajou.',
    summary: (stale, failing, missing) => {
      const parts: string[] = [];
      if (stale) parts.push(`${plural(stale, { other: '# sous' })} pa ajou`);
      if (failing) parts.push(`${plural(failing, { other: '# sous' })} pa mache`);
      if (missing) parts.push(`${plural(missing, { other: '# sous' })} poko rekipere`);
      return `${parts.join(', ')}.`;
    },
    statusLabel: {
      ok: 'Ajou',
      stale: 'Pa ajou',
      failing: 'Pa mache',
      missing: 'Poko rekipere',
      unknown: 'Enkoni',
    },
    staleSince: (date) => `N ap itilize dènye bon kopi a, ki soti ${date}.`,
    staleNoDate: 'N ap itilize dènye bon kopi a.',
    failingText: 'Pa gen okenn kopi ki itilizab kounye a, kidonk kouch ki bezwen l yo ka manke.',
    missingText: 'Sous sa a poko rekipere.',
    unknownText: 'Fichye eta a rapòte yon bagay nou pa rekonèt.',
    lastSuccess: (date) => `Dènye bon telechajman: ${date}`,
    neverSucceeded: 'Poko gen okenn bon telechajman',
    lastAttempt: (date) => `Dènye eseye: ${date}`,
    rows: (n) => `${plural(n, { other: '# dosye' })}`,
    newest: (date) => `Dosye ki pi resan an: ${date}`,
    message: (text) => `Nòt ki soti nan mizajou a: ${text}`,
    publisher: 'Pibliye pa',
    homepage: 'Kote li soti',
    license: 'Lisans',
    cadence: {
      daily: 'Piblikatè a mete l ajou chak jou',
      weekly: 'Piblikatè a mete l ajou chak semèn',
      monthly: 'Piblikatè a mete l ajou chak mwa',
      yearly: 'Piblikatè a mete l ajou chak ane',
      irregular: 'Piblikatè a mete l ajou detanzantan',
      frozen: 'Piblikatè a pa mete l ajou ankò',
    },
    problems: 'Pwoblèm nan fichye eta a',
    notesTitle: 'Nòt ki soti nan dènye mizajou a',
    notesInEnglish: 'Nòt sa yo ekri an angle, pou moun ki kenbe kat la ap mache yo.',
    basemapLabel: { ok: 'Ajou', failing: 'Pa disponib' },
    basemapMade: (date) =>
      `Mizajou chak semèn lan fè yon nouvo kopi kat debaz la apeprè yon fwa pa mwa. Kopi sa a te fèt apati OpenStreetMap nan ${date}.`,
    basemapNoDate: 'Mizajou chak semèn lan fè yon nouvo kopi kat debaz la apeprè yon fwa pa mwa.',
    basemapMissing: 'Kat debaz la pa disponib sou kopi sit sa a, kidonk kat la montre yon fon plen. Kouch done yo toujou mache.',
  },

  search: {
    label: 'Chèche yon adrès, yon kafou oswa yon nimewo pasèl',
    placeholder: 'Adrès, kafou oswa nimewo pasèl',
    button: 'Chèche',
    searching: 'N ap chèche',
    tooShort: 'Tape yon adrès, tankou 1234 Market St, oswa de ri ki kwaze, tankou Broad ak Girard.',
    notFound:
      'Vil la pa t ka jwenn kote sa a. Eseye yon nimewo kay ak yon ri, de ri ki kwaze, oswa yon nimewo pasèl ki gen nèf chif.',
    failed: (reason) => `Sèvis adrès Vil la ${reason}. Eseye ankò nan yon ti moman.`,
    liveOff:
      'Rechèch adrès mande sèvis adrès Vil la, e done an dirèk Vil la fèmen nan Paramèt. Ou ka toujou chèche ak yon nimewo pasèl ki gen nèf chif.',
    resultsTitle: 'Chwazi yon kote',
    resultsCount: (n) => plural(n, { other: '# kote matche' }),
    intersection: 'Kafou',
    showing: (label) => `N ap montre ${label} sou kat la.`,
    noParcel: (label) => `N ap montre ${label} sou kat la. Vil la pa gen okenn dosye pasèl pou egzakteman adrès sa a.`,
    privacy: 'Rechèch yo ale dirèkteman soti nan navigatè ou pou rive nan Vil Filadèlfi.',
  },

  pick: {
    looking: 'N ap chèche pasèl sa a ak Vil la',
    nothing: 'Vil la pa gen okenn pasèl nan kote sa a. Tape sou yon teren oswa yon bilding.',
    liveOff: 'Pou louvri yon pasèl ki pa sou lis nou an, limen "Rekipere done an dirèk nan Vil la" nan Paramèt.',
    failed: (reason) => `Kat pasèl Vil la ${reason}. Eseye ankò nan yon ti moman.`,
  },

  historic: {
    liveOff:
      'Imaj sa yo soti dirèkteman nan sèvè Vil la, kidonk ou ka limen yo sèlman lè "Rekipere done an dirèk nan Vil la" limen (nan Paramèt, anba "Vi prive ak done an dirèk").',
    refused: 'Ansyen foto ayeryen yo ak atlas 1860 la soti nan sèvè Vil la. Limen done an dirèk Vil la nan Paramèt pou wè yo.',
    serverError: 'Sèvè imaj Vil la pa t voye chak pati nan imaj sa a. Eseye ankò pita.',
    photoYear: (year) => `Foto ayeryen ${year}, pran depi yon avyon.`,
    gaps1975: 'Foto 1975 yo kite twou nan pati pi sid vil la, alantou ayewopò a ak Navy Yard.',
    termsNotStated:
      'Piblikatè li a pa bay okenn kondisyon itilizasyon pou foto sa yo; yo montre yo jan Vil la mete yo sou sèvè li, ak kredi, epi yo retire yo si piblikatè a mande.',
    blackAndWhite: (year) => `Foto ${year} yo an nwa ak blan.`,
    under: 'Foto a kouche anba tout lòt kouch yo. Bese fòs li pou wè ri jodi a atravè li.',
    atlasCoverage: 'Atlas la kouvri sèlman Center City ak Northern Liberties.',
    atlasCredit:
      'Atlas la ajiste sou kat jodi a pa Greater Philadelphia GeoHistory Network epi Vil Filadèlfi mete l sou sèvè li ak pèmisyon li.',
    sliderRange: (first, last) => `Soti ${first} jiska ${last}`,
    lotTitle: 'Ansyen foto ayeryen',
    lotButton: 'Wè teren sa a nan ansyen foto ayeryen',
    lotHelp: (year) =>
      `Louvri kat la sou teren sa a ak foto ayeryen ${year} la, pi ansyen an sou kat sa a. Glise nan ane yo depi lè sa a anba "Avan ak kounye a" nan kouch yo.`,
    lotLiveOff: 'Foto yo soti dirèkteman nan sèvè Vil la, kidonk yo bezwen done an dirèk Vil la, ki fèmen.',
    shown: (year) => `Foto ayeryen ${year} yo limen. Glise nan ane yo anba "Avan ak kounye a" nan kouch yo.`,
    statusOk:
      'Chak sèvis imaj te reponn nan dènye verifikasyon chak semèn lan. Imaj yo chaje dirèkteman soti nan sèvè Vil la lè yon moun limen kouch yo.',
    statusStale: (date) =>
      `Nan dènye verifikasyon chak semèn lan, pa chak sèvis imaj te reponn, kidonk gen kèk imaj ki ka pa parèt. Chak youn te reponn pou dènye fwa ${date}.`,
    statusFailing: 'Sèvis imaj yo pa t reponn nan verifikasyon chak semèn lan, kidonk imaj yo ka pa parèt.',
    services: (n) => `${plural(n, { other: '# sèvis imaj' })} verifye`,
    lastCheck: (date) => `Dènye verifikasyon kote chak sèvis te reponn: ${date}`,
  },

  redlining: {
    detailsTitle: 'Kat redlining 1937',
    grades: {
      A: 'A, klase "pi bon" an 1937',
      B: 'B, klase "toujou dezirab"',
      C: 'C, klase "an deklen definitivman"',
      D: 'D, klase "danjere" epi antoure an wouj: redlining',
    },
    ungraded: 'Pa klase (tè endistriyèl ak komèsyal)',
    area: (label, grade) => `Zòn ${label}, klase ${grade} an 1937`,
    areaUngraded: (label) => `${label}: yon zòn kat 1937 la pa t klase`,
    context:
      "An 1937 yon ajans federal, Home Owners' Loan Corporation, te bay katye vil la nòt de A a D selon jan li te jije prè ipotekè yo te an sekirite la. Nòt yo te depann de ki moun ki te rete nan chak zòn: zòn kote fanmi nwa ak anpil fanmi imigran te rete yo te anjeneral resevwa D epi yo te antoure an wouj. Li te pi difisil pou jwenn prè la pandan plizyè dizèn lane, epi yo rele pratik sa a redlining.",
    notToday: 'Nòt yo se yon dosye sou jan yon ajans federal te jije kote yo an 1937. Yo pa di anyen sou moun ki rete la jodi a.',
    legendTap: 'Tape yon zòn pou wè nòt li ak yon lyen nan deskripsyon li an 1937.',
    description: (label) => `Li deskripsyon 1937 zòn ${label} nan Mapping Inequality`,
    descriptionNote: 'Nou pa kopye deskripsyon 1937 yo isit la: yo rete sou Mapping Inequality, ak istwa ki antoure yo.',
    credit:
      'Zòn ak nòt ki soti nan Mapping Inequality: Redlining in New Deal America, pa Robert K. Nelson, LaDale Winling, et al., Digital Scholarship Lab University of Richmond. Placekeepers montre sèlman zòn yo ak nòt yo.',
    homepageLabel: 'Mapping Inequality: Philadelphia',
    nonCommercial: 'Itilizasyon ki pa komèsyal sèlman. Lisans Creative Commons Attribution NonCommercial 2.5, apa de rès done kat la.',
    licenseLabel: 'CC BY-NC 2.5',
    statusNote:
      'Itilizasyon ki pa komèsyal sèlman: sous sa a gen lisans pou itilizasyon ki pa komèsyal, kidonk sit la pibliye l nan yon fichye pou kont li epi li pa janm nan yon telechajman.',
  },

  options: {
    title: 'Vi prive ak done an dirèk',
    privacyLink: 'Kijan Placekeepers jere vi prive ou',
    turnOn: 'Limen done an dirèk Vil la',
    resetNote: 'Chwa ou sou done an dirèk Vil la rete jan l ye a.',
  },

  failure: {
    timeout: 'pa t reponn alè',
    network: 'pa t ka kontakte',
    http: 'te reponn ak yon erè',
    bad_data: 'te voye yon repons nou pa t ka li',
    not_found: 'pa gen okenn dosye sou li',
    aborted: 'pa t mande',
    empty: 'pa t mande',
  },

  rulesMap: {
    legend: {
      district: 'Distri istorik',
      property: 'Sou rejis istorik la',
      overlay: 'Zonaj siperpoze (overlay)',
      supplemental: 'Lòt règ espesyal Kòd Zonaj la',
      hearingZoning: 'Odyans zonaj',
      hearingOther: 'Odyans devan yon lòt komisyon',
      brownfield: 'Sit brownfield EPA',
    },
    notes: {
      historic: 'Chanjman isit la ka bezwen revizyon Komisyon Istorik la (Historical Commission); mande yo an premye.',
      overlays: 'Zonaj siperpoze yo chevoche, epi gen kèk ki kouvri pifò vil la. Tape yon kote pou wè chak zonaj siperpoze ki la.',
      hearings: 'Tape yon odyans pou wè kijan pou patisipe epi pou louvri paj teren an.',
      brownfields: 'Se pa yon kat tout tè ki kontamine. Teste tè a anvan ou plante manje sou yon sit oswa toupre youn.',
    },
    districtTitle: (name) => name,
    designated: (date) => `Deziyen nan ${date}.`,
    noDate: 'Kouch Vil la pa bay okenn dat deziyasyon.',
    propertyTitle: 'Sou Rejis Istorik Filadèlfi (Philadelphia Register of Historic Places)',
    listedOn: (date) => `Enskri poukont li nan ${date}.`,
    listedAlone: 'Enskri poukont li.',
    inDistrict: (district, date) => `Fè pati ${district}${date ? `, deziyen nan ${date}` : ''}.`,
    overlaysHere: (n) => (n === 1 ? 'Yon zonaj siperpoze isit la' : `${formatNumber(n)} zonaj siperpoze isit la`),
    hearingTitle: (board) => `Odyans ${board}`,
    hearingWhen: (date, time) => `${date}${time ? `, a ${time}` : ''}`,
    hearingsHere: (n) => `${formatNumber(n)} odyans isit la`,
    about: (address) => `Sou ${address}.`,
    rco: (name) => `Òganizasyon kominotè anrejistre ki te resevwa avi: ${name}.`,
    openLot: 'Louvri paj teren sa a',
    namesNote: 'Non moun ki depoze apèl la parèt sèlman sou paj teren an.',
    brownfieldTitle: 'Sit brownfield EPA',
  },

  dossier: {
    pageTitle: 'Paj teren',
    loading: 'N ap chaje paj teren an',
    parcel: (opa) => `Kont OPA ${opa}`,
    printButton: 'Enprime paj teren sa a',
    showOnMap: 'Montre sou kat la',
    close: 'Fèmen paj teren an',
    clear: 'Efase seleksyon an',
    retry: 'Eseye Vil la ankò',
    notFound: 'Nou pa t ka jwenn pasèl sa a nan dosye Vil la ni nan kopi chak semèn nou an.',
    noData: 'Pasèl sa a pa nan kopi chak semèn nou an, e done an dirèk Vil la fèmen, kidonk poko gen anyen pou montre.',
    sections: {
      summary: 'Rezime',
      actions: 'Sa ou ka fè',
      rules: 'Règ pou teren sa a',
      owner: 'Ki moun ki posede l',
      history: 'Istwa',
      nearby: 'Toupre',
      sources: 'Sous ak dat mizajou',
    },
    contents: 'Sou paj sa a',

    provenance: {
      live: (time) => `An dirèk nan Vil la a ${time}.`,
      snapshot: (date) => `Soti nan kopi chak semèn ${date}.`,
      snapshotNoDate: 'Soti nan kopi chak semèn.',
      map: 'Soti nan done chak semèn kat la.',
      checking: 'N ap verifye si Vil la gen dosye pi resan.',
      asking: 'N ap mande Vil la.',
      failedSnapshot: (reason, date) => `Sèvè Vil la yo ${reason}, kidonk sa a se kopi chak semèn ${date}.`,
      failedNothing: (reason) => `Sèvè Vil la yo ${reason}, kidonk nou pa ka montre pati sa a kounye a.`,
      offSnapshot: (date) => `Done an dirèk Vil la fèmen, kidonk sa a se kopi chak semèn ${date}.`,
      offNothing: 'Done an dirèk Vil la fèmen, e kopi chak semèn nou an pa kouvri pati sa a.',
      none: 'Pa gen dosye pou montre.',
    },
    banner: {
      live: 'An dirèk nan Vil Filadèlfi.',
      loading: 'N ap verifye ak Vil la pou dosye ki pi resan yo.',
      off: (date) => `Done an dirèk Vil la fèmen. Paj sa a montre kopi chak semèn ${date}.`,
      offNoDate: 'Done an dirèk Vil la fèmen. Paj sa a montre kopi chak semèn lan.',
      partial: 'Gen kèk rechèch nan Vil la ki pa t mache. Pati sa yo montre kopi chak semèn lan, oswa anyen, epi yo di sa.',
      failed: 'Sèvè Vil la yo pa t reponn. Paj sa a montre sa kopi chak semèn nou an genyen.',
    },

    summary: {
      kind: { lot: 'Teren vid', building: 'Bilding vid' },
      notListed: 'Pa sou lis teren ak bilding vid nou an',
      notListedHelp: 'Si ou panse pasèl sa a vid, rapòte yon koreksyon anba a.',
      noDetails: 'Poko gen detay pibliye',
      noPublishedDetails: 'Nou poko pibliye detay pou pasèl sa a, kidonk paj sa a montre sa sèvè Vil la yo di kounye a.',
      confidence: {
        high: 'Gen anpil chans li vid',
        medium: 'Pwobableman li vid',
        low: 'Nou pa two sèten li vid',
      },
      confidenceTitle: 'Konbyen nou sèten',
      signals: (n) => `${plural(n, { other: '# dosye endepandan Vil la' })} dakò ke li vid.`,
      cityCalls: (category) => `Dosye pwopriyete Vil la rele l: ${category}.`,
      lotSize: (frontage, depth) =>
        `Evalyatè Vil la anrejistre l apeprè ${formatNumber(Math.round(frontage))} pye lajè sou ri a ak ${formatNumber(Math.round(depth))} pye pwofondè.`,
      landcare: 'PHS LandCare deja ap antretni l.',
      landcareSince: (year) => `PHS LandCare ap antretni l depi ${year}.`,
      garden: 'Moun deja ap fè jaden isit la. Mande yo anvan ou planifye anyen.',
      lensLine: (lens) => `Priyorite selon lantiy ${lens.toLowerCase()} la, lantiy kat la itilize pou kolore teren yo.`,
      flood: {
        1: 'Yon pati nan teren sa a nan plenn inondasyon FEMA ki gen 1 pousan chans chak ane, kote yon inondasyon gen omwen 1 chans sou 100 chak ane. Se yon rezon pou pran prekosyon, se pa yon pati nan okenn nòt: plant isit la dwe ka sipòte tè mouye, tout sa yo bati dwe swiv règ Vil la pou plenn inondasyon, epi amenajman vèt ki absòbe lapli ede.',
        2: 'Yon pati nan teren sa a nan zòn inondasyon FEMA ki gen 0.2 pousan chans chak ane, kote yon inondasyon gen 1 chans sou 500 chak ane. Se yon rezon pou pran prekosyon, se pa yon pati nan okenn nòt: plant isit la ta dwe ka sipòte tè mouye, epi amenajman vèt ki absòbe lapli ede.',
      },
      floodTitle: 'Risk inondasyon',
      linksTitle: 'Wè l sou lòt sit',
      propertyPage: 'Paj pwopriyete Vil la',
      atlas: 'Atlas, kat Vil la pou adrès sa a',
      googleMaps: 'Google Maps',
      streetView: 'Google Street View',
      linksNote: 'Sa yo louvri lòt sit entènèt. Placekeepers mete lyen sou foto ri men li pa janm kopye yo.',
    },

    actions: {
      intro: 'Kòmanse ak wout legal la. Chak youn di ki moun ki ka fè l ak ki moun ki ka ede.',
      route: 'Wout legal la',
      steps: 'Etap yo',
      who: 'Ki moun ki ka fè l',
      cost: 'Pri',
      timeline: 'Konbyen tan sa pran',
      lastChecked: (date) => `Dènye verifikasyon ${date}.`,
      toConfirm: 'Poko konfime ak òganizasyon ki nome isit la.',
      partners: 'Ki moun ki ka ede',
      otherRoutes: 'Lòt wout legal pou pasèl sa a',
      none: 'Poko gen sijesyon pou kote sa a.',
      notListed:
        'Pasèl sa a pa sou lis teren ak bilding ki pwobableman vid nou an, kidonk nou pa gen sijesyon pou li. Paj Kijan pou fè l la eksplike wout legal yo pou nenpòt teren.',
      howTo: 'Kijan pou fè l',
      conservatorshipWarning:
        'Pwosedi konsèvatè pa tribinal (conservatorship) ka retire yon pwopriyete nan men pwopriyetè li. Chèchè yo jwenn yo itilize l anpil plis nan katye ki ap fè fas ak jantrifikasyon (lè pri yo monte nan yon katye) pase nan lòt kote. Pale ak Garden Justice Legal Initiative anvan ou konsidere l.',
      notLegalAdvice: 'Placekeepers pa bay konsèy jiridik. Verifye ak òganizasyon ki nome isit la yo anvan ou aji.',
    },

    listing: {
      title: 'Ajans tè Vil la mete l sou lis kòm disponib',
      text: (date) => `Nan ${date}, lis tè piblik Vil la te montre pwopriyete sa a kòm disponib.`,
      textNoDate: 'Lis tè piblik Vil la montre pwopriyete sa a kòm disponib.',
      variants: {
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': 'Yo ofri l pou yon akò jaden.',
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': 'Yo pa ka bati anyen sou li.',
        'OWNED - AVAILABLE (NOT FOR SY)': 'Yo pa ofri l kòm lakou sou kote.',
      },
      sideYardLead: 'Si ou posede kay ki bò kote a, kòmanse ak pwogram lakou sou kote a:',
      decline:
        'Lefèt li sou lis la pa vle di Land Bank ap di wi. Li deside chak demann poukont li epi li ka refize nenpòt vant oswa lokasyon, menm pou yon pwopriyete li mete sou lis kòm disponib.',
      changes: 'Lis la chanje souvan. Verifye kat Land Bank lan anvan ou aji.',
      map: 'Kat Land Bank lan pou pwopriyete ki disponib',
      credit: 'Lis: Vil Filadèlfi, Depatman Planifikasyon ak Devlopman (Land Management), jan kat Philadelphia Land Bank lan montre l.',
    },

    ownerType: {
      noName: 'Dosye Vil la pa bay non okenn pwopriyetè.',
      unclear: 'Nou pa t ka di ki kalite pwopriyetè sa a ye selon non an.',
      individual: 'Non pwopriyetè a sanble ak non yon moun.',
      publicName: (label) => `Dosye Vil la nonmen ${label} kòm pwopriyetè.`,
      markerReason: (marker) => `Non pwopriyetè a gen "${marker}" ladan l.`,
      agencyConflict: (contact) => `Dosye pwopriyete Vil la nonmen yon lòt pwopriyetè, kidonk mande ${contact} ki youn ki aktyèl.`,
      agencyContacts: { PUB: 'Land Bank', PLB: 'Land Bank', PRA: 'PHDC', PHDC: 'PHDC' },
      publicBodies: {
        land_bank: 'Philadelphia Land Bank',
        redevelopment_authority: 'Philadelphia Redevelopment Authority (Otorite Redevlopman)',
        pha: 'Philadelphia Housing Authority (Otorite Lojman)',
        housing_authority: 'yon otorite lojman',
        phdc: 'Philadelphia Housing Development Corporation (PHDC)',
        pha_or_phdc: 'Philadelphia Housing Authority oswa PHDC (non an koupe)',
        city: 'Vil Filadèlfi',
        school_district: 'Distrik Lekòl Filadèlfi (School District of Philadelphia)',
        community_college: 'Community College of Philadelphia',
        septa: 'SEPTA',
        commonwealth: 'Eta Pensilvani (Commonwealth of Pennsylvania)',
        phfa: 'Pennsylvania Housing Finance Agency',
        united_states: 'gouvènman Etazini',
        hud: 'Depatman Lojman ak Devlopman Iben Etazini (U.S. Department of Housing and Urban Development)',
        veterans_affairs: 'Depatman Zafè Veteran Etazini (U.S. Department of Veterans Affairs)',
        paid: 'Philadelphia Authority for Industrial Development',
        port_authority: 'Philadelphia Regional Port Authority',
        district_attorney: "Biwo Pwokirè Distrik Filadèlfi (Philadelphia District Attorney's Office)",
        public_authority: 'yon otorite piblik',
        pgw: 'Philadelphia Gas Works',
      },
      markers: {
        TR: 'TR, abrevyasyon pou trustee (fidiyè)',
        TRS: 'TRS, abrevyasyon pou trustees (fidiyè yo)',
        TRST: 'TRST, abrevyasyon pou trust (fidiyèsi)',
        'T U W': 'T/U/W, yon trust yon testaman kreye',
        FBO: 'FBO, pou benefis',
        CO: 'CO, abrevyasyon pou konpayi',
        LP: 'LP, yon patenarya limite',
        LLP: 'LLP, yon patenarya responsablite limite',
        LTD: 'LTD, abrevyasyon pou limite',
        LL: 'LL, yon LLC an kout',
        GP: 'GP, yon patnè jeneral',
        'N A': 'N A, yon bank nasyonal',
        FB: 'FB, yon FBO an kout',
        CDC: 'CDC, yon kòporasyon devlopman kominotè',
      },
      labels: {
        individual: 'Yon moun',
        company: 'Yon konpayi',
        city: 'Vil Filadèlfi',
        land_bank: 'Philadelphia Land Bank',
        redevelopment_authority: 'Philadelphia Redevelopment Authority (Otorite Redevlopman)',
        housing_authority: 'Yon otorite lojman',
        nonprofit: 'Yon òganizasyon san bi likratif',
        other_public: 'Yon lòt ajans piblik',
        unknown: 'Pa klè nan dosye Vil la',
      },
    },

    owner: {
      names: 'Pwopriyetè, jan Vil la pibliye l',
      noNames: 'Dosye Vil la pa bay non okenn pwopriyetè.',
      mailing: 'Adrès postal, jan Vil la pibliye l',
      noMailing: 'Pa gen okenn adrès postal nan dosye a.',
      type: 'Kalite pwopriyetè',
      flagsTitle: 'Sa dosye Vil la sigjere',
      noFlags: 'Pa gen anyen nan dosye Vil la ki mande yon nòt sou pwopriyetè sa a.',
      heldBack:
        'Nou pa sèten pasèl sa a vid, kidonk li ka kay yon moun. Nòt sou yon pwopriyetè ki ka yon moun (kote li resevwa lapòs, yon posib sikseswon, dèt taks, lòt pasèl li posede) parèt sèlman sou pasèl nou rele gen anpil chans oswa pwobableman vid.',
      ownerChanged:
        'Dosye Vil la nonmen yon lòt pwopriyetè pase sa kopi chak semèn nou an te genyen, kidonk nòt ki te sou pwopriyetè anvan an yo kite deyò.',
      parts: { meaning: 'Sa sa vle di', careful: 'Fè atansyon', next: 'Yon pwochen etap ki fèt ak prekosyon' },
      flagTitles: {
        absentee: 'Kote pwopriyetè a resevwa lapòs',
        possible_estate: 'Posib sikseswon',
        tax_debt_2025: 'Dèt taks dapre dosye jiyè 2025',
        sheriff_sales: 'Ansyen vant pa sherif',
        years_since_sale: 'Ane depi dènye vant',
        many_parcels: 'Yon pwopriyetè anpil pasèl vid',
        fast_resales: 'Revant rapid',
        open_violations: 'Vyolasyon L&I ki ouvè',
        unsafe: 'Bilding ki pa an sekirite',
        imminently_dangerous: 'Bilding ki se yon danje imedya',
      },
      otherFlag: 'Yon nòt nan dosye Vil la',
      taxTitle: 'Taks',
      taxNoDebt:
        'Vil la sispann pibliye balans taks chak pwopriyete kòm done ouvè. Kopi jiyè 2025 nou genyen an pa montre taks ki pa peye isit la.',
      taxUnknown: 'Vil la sispann pibliye balans taks chak pwopriyete kòm done ouvè.',
      taxHeld:
        'Vil la sispann pibliye balans taks chak pwopriyete kòm done ouvè. Nou montre kopi jiyè 2025 nou an pou yon pwopriyetè ki ka yon moun sèlman sou pasèl nou rele gen anpil chans oswa pwobableman vid.',
      taxCenter: 'Verifye balans jodi a sou Sant Taks Filadèlfi (Philadelphia Tax Center)',
      deedFraudTitle: 'Pwoteje pwopriyete sa a kont vòl akt',
      deedFraud:
        'Vòl akt rive lè yon moun depoze yon fo akt pou pran yon pwopriyete, souvan yon pwopriyete ki gen yon pwopriyetè ki mouri oswa ki rete yon lòt kote. Pwopriyetè ak fanmi yo ka enskri nan alèt Fraud Guard gratis Vil la, ki voye yon imèl lè yo anrejistre yon dokiman ki gen non yo ladan l. Depi novanm 2025 Vil la bloke otomatikman tou akt kote vandè a te deja mouri lè yo sipoze te siyen yo.',
      fraudGuard: 'Enskri nan alèt Fraud Guard gratis Vil la',
      deedCheck: 'Verifikasyon otomatik Vil la ki sispann fwod sou akt',
      helpTitle: 'Èd pou pwopriyetè ak fanmi yo',
      seeList: 'Wè pasèl pwopriyetè sa a sou lis nou an',
      cityListTitle: 'Lis pwopriyete piblik Vil la',
      cityList: 'Pasèl la sou lis pwopriyete piblik Vil la.',
      cityListNames: (agency) => `Lis pwopriyete piblik Vil la nonmen ${agency} kòm pwopriyetè.`,
      cityListStatus: (status) => `Estati li la: ${status}.`,
      cityStatuses: {
        'OWNED - AVAILABLE': ['sou lis kòm disponib', 'Land Bank montre l sou kat pwopriyete li kote moun ka aplike.'],
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': ['sou lis kòm disponib pou yon akò jaden', 'Yo ofri l pou fè jaden anba yon akò ak Land Bank.'],
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': ['sou lis kòm disponib, san pèmisyon pou bati', 'Yo ofri l, men yo pa ka bati anyen sou li.'],
        'OWNED - AVAILABLE (NOT FOR SY)': ['sou lis kòm disponib, men se pa kòm lakou sou kote', 'Yo ofri l, men se pa pou vwazen ki bò kote a kòm lakou sou kote.'],
        'OWNED - ON HOLD FOR AHD': ['rezève pou lojman abòdab', 'Li mete sou kote pou kay abòdab, kidonk yo pa ofri l bay vwazen yo kounye a.'],
        'OWNED - NOT AVAILABLE': ['pa disponib', 'Ajans tè Vil la pa ofri l kounye a.'],
        'OWNED - PROCESSING APPLICANT, NOT AVAILABLE': ['yon moun fè yon demann', 'Y ap egzaminen yon demann pou li, kidonk yo pa ofri l bay lòt moun kounye a.'],
        'OWNED - MANAGED AND NOT AVAILABLE': ['jere epi pa disponib', 'Yon ajans pran swen li epi li pa ofri l.'],
        'OWNED - ON HOLD': ['an atant', 'Yo pa ofri l pou kounye a.'],
        'OWNED - SALE PENDING': ['vant an kou', 'Yon vant ap fèt, kidonk yo pa ofri l bay lòt moun.'],
        'UNKNOWN - RESEARCH PENDING': ['poko konnen', 'Ajans tè Vil la ap toujou ap ankete sou li.'],
        'OWNED - RFP RELEASED': ['ofri pou devlopman', 'Ajans tè Vil la mande pwopozisyon pou devlope l.'],
        'OWNED - ON HOLD FOR HOME SD': ['rezève pou yon pwogram lojman', 'Li rezève pou yon pwogram lis la rele HOME SD, kidonk yo pa ofri l bay vwazen yo kounye a.'],
        'OWNED - HELD FOR CITY COUNCIL MEMBER': ['rezève pou manm Konsèy distri a', 'Li rezève pou manm Konsèy Minisipal nan distri a, kidonk yo pa ofri l kounye a. Biwo manm nan ka di poukisa.'],
        'OWNED - TO BE FEATURED SOON': ['pral ofri byento', 'Ajans tè Vil la planifye pou ofri l byento.'],
        'OWNED - NOT AVAILABLE (GSI PROJECT)': ['mete sou kote pou travay dlo lapli vèt', 'Li rezève pou plantasyon Depatman Dlo a bati pou absòbe lapli.'],
        'OWNED - COMPETITIVE BID POSTED': ['ofri pa òf konpetitif', 'Ajans tè Vil la mande òf pou li.'],
      },
      sideYard: 'Vil la make l kòm elijib pou pwogram lakou sou kote a, pou pwopriyetè kay ki bò kote a.',
      agencies: {
        PUB: 'Vil Filadèlfi',
        PLB: 'Philadelphia Land Bank',
        PRA: 'Philadelphia Redevelopment Authority (Otorite Redevlopman)',
        PHDC: 'Philadelphia Housing Development Corporation (PHDC)',
      },
      tangledTitle: 'Tangled Title Fund, ki jere pa Philadelphia VIP',
      sheriffGuide: 'Grounded in Philly: vant pa sherif',
      gjli: 'Garden Justice Legal Initiative, pou èd jiridik gratis',
    },

    flags: {
      absentee: {
        outOfState: (where) => `Pwopriyetè a resevwa lapòs yon lòt kote: ${where} (deyò eta a).`,
        outsidePennsylvania: 'Pwopriyetè a resevwa lapòs yon lòt kote: deyò Pensilvani.',
        outsideCity: (city) => `Pwopriyetè a resevwa lapòs yon lòt kote: ${city}, PA (deyò Filadèlfi).`,
        outsideCityUnknown: 'Pwopriyetè a resevwa lapòs yon lòt kote: deyò Filadèlfi.',
        poBox: 'Pwopriyetè a resevwa lapòs yon lòt kote: yon bwat postal nan Filadèlfi.',
        elsewhere: 'Pwopriyetè a resevwa lapòs yon lòt kote: yon lòt adrès nan Filadèlfi.',
        careful:
          'Sa a se adrès kote Vil la voye bòdwo taks yo. Li ka pa ajou, oswa li ka se adrès yon fanmi, yon avoka oswa yon jeran, epi yon pwopriyetè ki rete yon lòt kote ka pa konnen kijan pwopriyete a parèt jodi a.',
        next: 'Ekri pwopriyetè a nan adrès sa a pou mande anvan ou fè anyen sou pwopriyete a, epi mande Garden Justice Legal Initiative revize nenpòt akò anvan ou siyen l.',
      },
      possible_estate: {
        text: 'Li posib pwopriyetè ki nan dosye a te mouri.',
        careful: 'Manm fanmi yo ka toujou gen yon dwa sou pwopriyete sa a epi yo ka pa konnen sa.',
        next: 'Si ou konnen fanmi an, Tangled Title Fund (jiska $6,500 an èd jiridik) ak Philadelphia VIP ka ede yo kenbe l. Fanmi yo ka enskri tou nan alèt Fraud Guard gratis Vil la.',
      },
      tax_debt_2025: {
        text: (amount, years) =>
          `Dapre dosye Vil la nan jiyè 2025, te gen ${amount} nan taks byen imobilye ki pa peye${years ? ` ki soti nan ${plural(years, { other: '# ane taks' })}` : ''}.`,
        careful:
          'Sa a se dènye dosye piblik la, ki soti 9 jiyè 2025, se pa balans jodi a: pwopriyetè a ka te peye depi lè sa a, oswa li ka dwe plis. Apeprè twa lane taks ki pa peye oswa plis ka lakòz yon vant pa sherif, kote yon teren vwazen yo pran swen ka vann bay yon achtè ki soti deyò.',
        next: 'Verifye balans jodi a sou Sant Taks Filadèlfi (Philadelphia Tax Center) anvan ou konte sou sa a. Si blòk ou a pran swen teren sa a, gid Grounded in Philly sou vant pa sherif eksplike risk la ak sa ou ka fè.',
      },
      sheriff_sales: {
        one: (sale) => `Vann nan yon vant pa sherif nan ${sale}.`,
        many: (n, sales) => `Vann nan yon vant pa sherif ${n} fwa: ${sales}.`,
        sale: (date, price) => (price ? `${date}, pou ${price}` : date),
        andLast: (others, last) => `${others}; ak ${last}`,
        careful:
          'Nan yon vant pa sherif, òf ki genyen an efase ansyen dèt yo sou pwopriyete a, kidonk yon teren vwazen yo te pran swen ka pase bay yon achtè ki soti deyò. Yon ansyen vant pa vle di pwopriyete a ap vann kounye a.',
        next: 'Si blòk ou a pran swen teren sa a, li gid Grounded in Philly sou vant pa sherif epi mande Garden Justice Legal Initiative pou èd jiridik gratis.',
      },
      years_since_sale: {
        lastSold: (year) => `Dènye vant: ${year}.`,
        notSoldSince: (year) => `Pa vann sou mache ouvè depi omwen ${year}.`,
        careful:
          'Vant pou yon pri senbolik ak vant pa sherif yo kite deyò isit la; istwa konplè a anba a. Anpil kay pase nan fanmi san yon nouvo vant, kidonk yon bon bout tan depi yon vant pa vle di pwopriyetè a abandone pwopriyete a.',
        next: 'Si yon fanmi eritye pwopriyete a san yon nouvo akt, Tangled Title Fund ak Philadelphia VIP ka ede yo netwaye tit la epi kenbe l.',
      },
      many_parcels: {
        text: (n) => `Pwopriyetè sa a gen ${n} pasèl vid nan vil la.`,
        careful:
          'Nou matche pwopriyetè yo pa non egzak yo nan dosye Vil la, kidonk yon sèl pwopriyetè ka parèt anba plizyè òtograf epi de pwopriyetè ka gen menm non. Posede tè vid pa yon move aksyon poukont li.',
        next: 'Sèvi ak lis la pou wè lòt pasèl pwopriyetè sa a, apre sa mande pèmisyon an fason legal la: ekri pwopriyetè a, epi mande Garden Justice Legal Initiative revize nenpòt akò.',
      },
      fast_resales: {
        since: (n, year) => `Vann ${n} fwa depi ${year}.`,
        inYear: (n, year) => `Vann ${n} fwa an ${year}.`,
        between: (n, first, last) => `Vann ${n} fwa ant ${first} ak ${last}.`,
        careful:
          'Revant rapid ka vle di yo ap fè kòmès ak pwopriyete a pou fè pwofi, epi pafwa yon fo akt. Yo ka òdinè tou, tankou yon fanmi ki vann yon kay yo eritye epi achtè a ki revann li apre reparasyon.',
        next: 'Gade ki moun ki te vann ak ki moun ki te achte nan istwa anba a. Pwopriyetè ak fanmi yo ka enskri nan alèt Fraud Guard gratis Vil la pou konnen lè yon dokiman nonmen yo.',
      },
      open_violations: {
        one: (when, what) => `L&I mete 1 vyolasyon ki ouvè sou lis${what ? `, pou ${what}` : ''}${when ? `, ki soti ${when}` : ''}.`,
        many: (n) => `L&I mete ${n} vyolasyon ki ouvè sou lis.`,
        mostRecent: (when, what) => (what ? `Pi resan an, ki soti ${when}, se pou ${what}.` : `Pi resan an soti ${when}.`),
        careful:
          'Yon vyolasyon se yon avi bay pwopriyetè a, ki ka pa gen mwayen pou korije l, epi kondisyon an ka chanje depi enspeksyon an.',
        next: 'Rapòte pwoblèm fizik, tankou fatra jete oswa yon bilding ouvè, bay Philly311. Si ou konnen pwopriyetè a, fè l konnen: li ka pa t wè avi a.',
      },
      unsafe: {
        text: (since) =>
          since ? `L&I mete bilding sa a sou lis kòm pa an sekirite, depi ${since}.` : 'L&I mete bilding sa a sou lis kòm pa an sekirite.',
        careful: 'Rete deyò epi kenbe timoun yo lwen: L&I jwenn estrikti a pa an sekirite. Pa antre ladan l ni eseye sekirize l poukont ou.',
        next: 'Si li louvri pou antre, rapòte l bay Philly311 pou Vil la ka sele l.',
      },
      imminently_dangerous: {
        text: (since) =>
          since
            ? `L&I mete bilding sa a sou lis kòm yon danje imedya, depi ${since}.`
            : 'L&I mete bilding sa a sou lis kòm yon danje imedya.',
        careful: 'L&I jwenn estrikti a ka tonbe nenpòt ki lè. Rete lwen li, epi kenbe lòt moun lwen.',
        next: 'Rapòte nenpòt chanjman, tankou brik k ap tonbe oswa yon pòt ouvè, bay Philly311.',
      },
    },

    history: {
      transfersTitle: 'Vant ak transfè',
      transfersCaption: 'Chak vant ak transfè ki anrejistre pou pwopriyete sa a, pi resan an an premye',
      date: 'Dat',
      document: 'Dokiman',
      documentAndPrice: 'Dokiman ak pri',
      fromAndTo: 'Soti nan ak ale nan',
      price: 'Pri',
      from: 'Soti nan',
      to: 'Ale nan',
      noDate: 'Pa gen dat',
      noPrice: 'Pa gen anyen ki anrejistre',
      share: (n) => `pòsyon pwopriyete sa a nan yon akt pou ${n} pwopriyete`,
      more: (n) => `ak ${plural(n, { other: '# lòt' })}`,
      noTransfers: 'Pa gen okenn akt nan dosye.',
      notInCopy: (parts) =>
        `Kopi chak semèn nou an pa gen ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ak ${parts[parts.length - 1]}` : parts[0]} pou pasèl sa a, kidonk paj sa a pa ka di si gen.`,
      partialParts: { transfers: 'dosye akt', assessments: 'evalyasyon', li: 'dosye vyolasyon L&I' },
      notInCopyOff: 'Done an dirèk Vil la ka montre yo.',
      notInCopyFailed: 'Vil la pa t reponn. Eseye ankò pou wè yo.',
      recordsNote: 'Dosye akt Vil la konplè depi 2000. Ansyen vant yo ka manke.',
      datesNote:
        'Chak dat se dat sou akt la epi chak pri awondi nan dola, jan paj pwopriyete Vil la montre yo; Vil la anrejistre yon akt kèk jou oswa kèk semèn pita. Lè yon sèl akt te kouvri plizyè pwopriyete, pri a se pòsyon pwopriyete sa a.',
      documents: {
        DEED: 'Akt',
        'DEED SHERIFF': 'Akt sherif',
        "SHERIFF'S DEED": 'Akt sherif',
        'DEED MISCELLANEOUS': 'Akt divès',
        'MISCELLANEOUS DEED': 'Akt divès',
        'DEED MISCELLANEOUS TAXABLE': 'Akt divès, taksab',
        'MISCELLANEOUS DEED TAXABLE': 'Akt divès, taksab',
        'DEED LAND BANK': 'Akt Land Bank',
        'DEED OF CONDEMNATION': 'Akt kondanasyon',
        'DEED - DECEASED': 'Akt ki soti nan yon sikseswon',
        'DEED - ADVERSE POSSESSION': 'Akt pa posesyon advèsatif',
        'DEED RTT - OTHER': 'Lòt akt',
        'CERTIFICATE OF STOCK TRANSFER': 'Sètifika transfè aksyon',
      },
      assessmentsTitle: 'Evalyasyon Vil la',
      assessmentsCaption: 'Evalyasyon Vil la sou valè mache a, pa ane',
      year: 'Ane',
      marketValue: 'Valè mache evalye',
      noValue: 'Pa anrejistre',
      noAssessments: 'Pa gen okenn evalyasyon nan dosye.',
      assessmentNote: 'Yon evalyasyon se estimasyon Vil la sou valè mache a pou taks pwopriyete. Se pa yon pri vant.',
      chartLabel: (first, last, low, high) =>
        `Graf evalyasyon Vil la depi ${first} jiska ${last}, ant ${low} ak ${high}. Menm chif yo nan tablo anba a.`,
      open: 'Ouvè',
      liSummaryOpen: (n) => plural(n, { other: '# vyolasyon ki ouvè' }),
      liSummaryLast: (date) => `Vyolasyon ki pi resan: ${date}.`,
      liUnsafe: 'L&I mete bilding sa a sou lis kòm pa an sekirite.',
      liUnsafeSince: (date) => `L&I mete bilding sa a sou lis kòm pa an sekirite, depi ${date}.`,
      liDangerous: 'L&I mete bilding sa a sou lis kòm yon danje imedya.',
      liDangerousSince: (date) => `L&I mete bilding sa a sou lis kòm yon danje imedya, depi ${date}.`,
      liSince2016: (n) => `${plural(n, { other: '# vyolasyon' })} anrejistre depi 2016.`,
      liSealed: (date) => `Vil la te netwaye epi sele l pou dènye fwa nan ${date}.`,
      liDemolished: (date) => `Dènye demolisyon fini nan ${date}.`,
      liNeither: 'Pa sou lis kòm pa an sekirite ni kòm yon danje imedya.',
      liNowTitle: 'L&I jodi a',
      earlyDeed: 'Anvan 2000: soti nan dosye Vil la di ki ka pa konplè.',
      timeline: {
        storyTitle: 'Istwa teren sa a',
        storySource: (source) => `Soti nan ${source}.`,
        noStory: 'Dosye nou genyen yo poko rakonte yon istwa sou teren sa a.',
        title: 'Kronoloji',
        caption: 'Tout sa ki nan dosye pou pwopriyete sa a, pi resan an an premye, pa ane',
        intro: 'Vant, dosye L&I, apèl ak dosye vid nan yon sèl lis, pi resan an an premye. Fèmen yon kalite pou kache l.',
        appeal: (board, kind) => (kind ? `${board}: ${kind}` : board),
        appealHearing: (date) => `odyans ${date}`,
        show: 'Montre nan kronoloji a',
        loading: 'N ap chaje kronoloji a soti nan kopi chak semèn lan.',
        failed: 'Nou pa t ka chaje kronoloji a soti nan kopi chak semèn lan.',
        unpublished: 'Kopi kat sa a poko gen fichye kronoloji.',
        liMissing: 'Kopi chak semèn nou an pa gen dosye L&I pou pasèl sa a, kidonk kronoloji a pa ka di si gen.',
        liMissingOff: 'Done an dirèk Vil la ka montre yo.',
        none: 'Pa gen dosye nan kronoloji a.',
        allHidden: 'Chak kalite dosye fèmen.',
        moreYears: (n) => `Montre ${plural(n, { other: '# ane anvan' })}`,
        fewerYears: 'Montre sèlman ane resan yo',
        noDate: 'Pa gen dat',
        future: 'Vil la te mete yon dat nan lavni sou sa a; dosye li a ka mal.',
        printTitle: 'Kronoloji, 10 dosye ki pi resan',
        recordColumn: 'Dosye',
        whatColumn: 'Sa ki te pase',
        printWaiting: 'Paj teren an sou entènèt gen kronoloji konplè a; li pa t chaje lè yo te enprime paj sa a.',
        printMore: (n) => `${plural(n, { other: '# dosye ki pi ansyen' })} sou paj teren an sou entènèt.`,
        noPrice: 'pa gen pri ki anrejistre',
        to: (names) => `bay ${names}`,
        times: (n) => `(${formatNumber(n)} fwa)`,
        permit: 'Pèmi',
        permitFor: (type, work) => `${type} pou ${work}`,
        violation: 'Vyolasyon',
        demolition: 'Demolisyon',
        byCity: 'pa Vil la',
        privatePermit: 'anba yon pèmi prive',
        demolitionWork: {
          city: 'Demolisyon Vil la',
          complete: 'Demolisyon konplè',
          small: 'Demolisyon yon bilding ki gen jiska 3 etaj',
          large: 'Demolisyon yon bilding ki gen plis pase 3 etaj oswa 40 pye',
          tank: 'Retire yon rezèvwa',
        },
        cleanSeal: 'Netwaye epi sele pa Vil la',
        cleanSealClip: 'Netwaye epi sele pa Community Life Improvement Program Vil la',
        kinds: {
          deed: 'Akt',
          violation: 'Vyolasyon',
          permit: 'Pèmi',
          demolition: 'Demolisyon',
          unsafe: 'Avi bilding ki pa an sekirite',
          imminently_dangerous: 'Avi bilding ki se yon danje imedya',
          clean_seal: 'Netwaye epi sele',
          appeal: 'Apèl',
          vacancy: 'Dosye vid',
        },
        toggles: {
          deed: 'Vant ak transfè',
          violation: 'Vyolasyon',
          permit: 'Pèmi',
          demolition: 'Demolisyon',
          clean_seal: 'Netwaye epi sele',
          notice: 'Avi pa an sekirite ak danje imedya',
          appeal: 'Apèl',
          vacancy: 'Dosye vid ak swen',
        },
        lists: {
          city_land: 'Sou lis tè vid Vil la',
          city_building: 'Sou lis bilding vid Vil la',
          june_2024_land: 'Sou lis tè vid L&I jen 2024, jan Clean & Green Philly kenbe l',
          june_2024_building: 'Sou pwòp lis bilding vid Clean & Green Philly jen 2024',
        },
        landcare: (program) =>
          program === 'community_landcare'
            ? 'Vwazen yo te kòmanse pran swen teren sa a ak PHS Community LandCare'
            : 'PHS LandCare te kòmanse pran swen teren sa a',
        story: {
          cityDemolished: (year) => `Te gen yon bilding isit la jiska ${year}, lè Vil la te demoli l.`,
          privateDemolished: (year) => `Te gen yon bilding isit la jiska ${year}, lè yo te demoli l anba yon pèmi prive.`,
          newConstruction: (year) => `L&I te bay yon pèmi pou nouvo konstriksyon isit la an ${year}.`,
          dangerous: (date) => `L&I mete bilding lan sou lis kòm yon danje imedya depi ${date}.`,
          unsafe: (date) => `L&I mete bilding lan sou lis kòm pa an sekirite depi ${date}.`,
          sealed: (year, n) =>
            n > 1
              ? `Vil la te voye ekip netwayaj ak sele li yo isit la pou dènye fwa an ${year}; li te fè sa ${formatNumber(n)} fwa.`
              : `Vil la te voye ekip netwayaj ak sele li yo isit la an ${year}.`,
          sheriff: (year) => `Yo te vann li nan yon vant pa sherif an ${year}.`,
          cityList: (land, date, june) =>
            `Lis ${land ? 'tè vid' : 'bilding vid'} Vil la ki gen dat ${date} gen li${june ? ', menm jan ak yon lis jen 2024' : ''}.`,
          juneList: (land) =>
            land ? 'Lis tè vid L&I jen 2024 la te gen li.' : 'Lis bilding vid Clean & Green Philly jen 2024 la te gen li.',
          landcare: (year, program) =>
            program === 'community_landcare'
              ? `Vwazen yo ap pran swen li ak PHS Community LandCare depi ${year}.`
              : `PHS LandCare ap pran swen li depi ${year}.`,
          sources: {
            demolitions: 'dosye demolisyon L&I',
            permits: 'dosye pèmi L&I',
            notices: 'dosye bilding ki pa an sekirite ak danje imedya L&I',
            cleanSeal: 'dosye netwaye ak sele L&I',
            deeds: 'dosye akt Vil la',
            lists: (june) =>
              june ? 'lis pwopriyete vid Vil la, ak lis jen 2024 L&I ke Clean & Green Philly kenbe' : 'lis pwopriyete vid Vil la',
            june: (land) => (land ? 'lis jen 2024 L&I, ke Clean & Green Philly kenbe' : 'lis jen 2024 Clean & Green Philly'),
            landcare: 'lis teren PHS LandCare pran swen',
          },
        },
      },
    },

    nearby: {
      intro: 'Sa ki alantou teren sa a, pou swen ka ale kote li ede pi plis.',
      careNote: 'Chif sa yo montre kote swen pi nesesè. Yo pa di anyen sou moun ki rete isit la.',
      areaSnapshot: 'Nan zòn ki alantou teren sa a, apeprè de blòk lajè',
      within500: 'Nan 500 pye de teren sa a',
      s12: (n) => `${plural(n, { other: '# moun' })} ki pran bal nan dènye 12 mwa`,
      s36: (n) => `${plural(n, { other: '# moun' })} ki pran bal nan dènye 3 lane`,
      killed: (n) => `${plural(n, { other: '# moun' })} ki mouri nan aksidan sikilasyon depi 2019`,
      landcare: (n) => `${plural(n, { other: '# teren' })} PHS LandCare antretni`,
      gardens: (n) => `${plural(n, { other: '# jaden kominotè' })}`,
      hearings: (n) => `${plural(n, { other: '# odyans' })} ki poko fèt sou lòt pwopriyete`,
      playgroundHeading: 'Teren jwèt ki pi pre a',
      playground: (name, meters) =>
        `${name}, apeprè ${distanceWords(meters)} an liy dwat${meters <= 400 ? ', nan 5 minit mache' : meters <= 800 ? ', nan 10 minit mache' : ''}.`,
      none: 'Poko gen chif toupre pou kote sa a.',
      showLayer: (label) => `Montre ${label} sou kat la`,
    },

    sources: {
      intro: 'Kote chak pati nan paj sa a soti, ak ki jan li fre.',
      live: (time) => `an dirèk nan Vil la a ${time}`,
      snapshot: (date) => `kopi chak semèn ${date}`,
      snapshotNoDate: 'kopi chak semèn',
      newest: (date) => `dosye ki pi resan an ${date}`,
      taxSnapshot: 'dènye kopi Clean & Green Philly, 9 jiyè 2025',
      by: (publisher) => `soti nan ${publisher}`,
      correction: 'Rapòte yon koreksyon',
      correctionHelp: 'Louvri yon fòm sou GitHub, ranpli ak pasèl sa a. Pou voye l, ou bezwen yon kont GitHub gratis.',
      ownerNote:
        'Si ou posede pwopriyete sa a epi yon dosye Vil la sou li mal, biwo Vil la ki kenbe dosye a ka korije l nan sous la: Biwo Pwopriyete Evalyasyon (Office of Property Assessment) pou non pwopriyetè, adrès postal ak evalyasyon, Depatman Dosye (Department of Records) pou akt, ak Lisans ak Enspeksyon (Licenses and Inspections) pou vyolasyon ak pèmi.',
    },

    ownerList: {
      title: 'Pasèl pwopriyetè sa a sou lis nou an',
      intro: (names) => `Pasèl sou lis nou an ki gen pwopriyetè anrejistre kòm ${names}.`,
      others: 'Lòt pasèl sou lis nou an ki gen pwopriyetè anrejistre anba menm non ak sa a.',
      loading: 'N ap chaje lis la',
      missing: 'Lis sa a pa disponib kounye a.',
      open: (address) => `Louvri paj teren pou ${address}`,
      kind: (kind, confidence) => (confidence ? `${kind}, ${confidence.toLowerCase()}` : kind),
    },

    print: {
      printed: (date) => `Enprime nan Placekeepers nan ${date}.`,
      recent: 'Istwa resan',
      moreOnline: (n) => `${plural(n, { other: '# lòt dosye' })} sou paj teren an sou entènèt.`,
      lastAssessment: (year, value) => `Evalyasyon Vil la pou ${year}: ${value}.`,
      moreSources: (n) => `${plural(n, { other: '# lòt sous' })} sou paj teren an sou entènèt.`,
      taxCenter: (url) => `Balans jodi a: Sant Taks Filadèlfi, ${url}`,
      rules: 'Règ pou teren sa a',
    },

    rules: {
      intro:
        'Sa dosye Vil la ak dosye federal yo di ki aplike pou teren sa a: dezyen istorik, zonaj ak zonaj siperpoze li yo, dosye brownfield, ak apèl bay komisyon Vil la. Pa gen anyen nan sa ki di si yo ka bati yon bagay isit la. Mande biwo ki nome a anvan ou planifye anyen.',
      notOnList:
        'Nou kalkile règ yo chak semèn pou teren ki sou lis nou an, epi pasèl sa a pa sou li. Atlas, kat Vil la, montre zonaj li ak zonaj siperpoze li yo, epi Komisyon Istorik la ka di si li istorik.',
      hearingTitle: 'Gen yon odyans k ap vini',
      hearingSet: (board, date, time) => `Yon odyans ${board} sou teren sa a fikse pou ${date}${time ? `, a ${time}` : ''}.`,
      hearingBoard: {
        zoning: 'zonaj',
        li_review: 'Komisyon Revizyon L&I',
        building: 'Komisyon Estanda Bilding',
        other: 'komisyon Vil la',
      },
      seeAppeal: 'Wè apèl la',
      historicTitle: 'Dezyen istorik',
      inDistrict: (district, date) => `Teren sa a nan ${district}${date ? `, deziyen nan ${date}` : ''}.`,
      districtName: (name) => (/district/i.test(name) ? name : `distri istorik ${name}`),
      listed: (date) =>
        `Pwopriyete sa a enskri poukont li sou Philadelphia Register of Historic Places (Rejis Istorik Filadèlfi), depi ${date}.`,
      listedNoDate: 'Pwopriyete sa a enskri poukont li sou Philadelphia Register of Historic Places (Rejis Istorik Filadèlfi).',
      listedInDistrict: (district) =>
        `Pwopriyete sa a sou Philadelphia Register of Historic Places (Rejis Istorik Filadèlfi) kòm yon pati nan ${district}.`,
      askFirst:
        'Chanjman isit la ka bezwen revizyon Komisyon Istorik la (Historical Commission); mande yo an premye. Pou yon miral oswa yon jaden, mande Komisyon an anvan ou kòmanse.',
      contact: 'Philadelphia Historical Commission (Komisyon Istorik Filadèlfi): 215 686 7660, preservation@phila.gov.',
      confirm: 'Vil la mande tout moun konfime estati istorik yon pwopriyete ak Komisyon an.',
      commissionSite: 'Sit entènèt Komisyon Istorik la',
      projectReview: 'Kijan Komisyon an revize travay sou pwopriyete istorik',
      findHistoric: 'Jwenn yon pwopriyete oswa yon distri istorik',
      notHistoric: 'Dosye Komisyon Istorik la pa mete teren sa a sou lis kòm istorik. Mande Komisyon an pou asire w.',
      zoningTitle: 'Zonaj',
      base: (code, group) => `Zonaj debaz: ${code}${group ? `, ${group}` : ''}.`,
      zoningGroups: {
        'RESIDENTIAL/MULTI-FAMILY/RESIDENTIAL MIXED-USE': 'yon distri rezidansyèl',
        'COMMERCIAL/COMMERCIAL MIXED-USE': 'yon distri komèsyal ak itilizasyon melanje',
        'INDUSTRIAL/INDUSTRIAL MIXED-USE': 'yon distri endistriyèl',
        'SPECIAL PURPOSE': 'yon distri ki gen yon objektif espesyal, tankou pak, enstitisyon oswa ayewopò a',
      },
      basePending: 'Yon pwojè lwa ki an atant nan Konsèy Minisipal ta chanje l.',
      readBill: 'Li pwojè lwa a',
      overlaysIntro: (n) => (n === 1 ? 'Yon zonaj siperpoze ajoute pwòp règ li isit la:' : `${formatNumber(n)} zonaj siperpoze ajoute pwòp règ yo isit la:`),
      noOverlays: 'Okenn zonaj siperpoze pa kouvri teren sa a.',
      overlayKinds: { 1: 'Distri zonaj siperpoze', 2: 'Règ espesyal', 3: 'Limit sou pavaj' },
      readRule: (section) => (section ? `Li règ la: seksyon ${section} Kòd Zonaj la` : 'Li règ la nan Kòd Zonaj la'),
      sunset: (date) => `Fikse pou fini nan ${date}.`,
      pending: (bill) => `Yon pwojè lwa ki an atant nan Konsèy Minisipal${bill ? `, Pwojè ${bill},` : ''} ta chanje l.`,
      zoningNote:
        'Zonaj ak zonaj siperpoze yo ka chanje sa ki otorize sou yon teren. Kat Vil la yo ka an reta sou nouvo pwojè lwa, kidonk verifye ak biwo zonaj Vil la anvan ou planifye.',
      zoningHelp: 'Èd Vil la sou zonaj ak planifikasyon',
      atlasZoning: 'Adrès sa a sou Atlas, kat Vil la',
      overlayMeaning: {
        '/CTR': 'Règ siplemantè pou Center City: itilizasyon, panno, wotè bilding, estasyonman ak devan ri a.',
        '/NCO': 'Règ ki fè nouvo bilding ak ekstansyon rete an amoni ak katye sa a.',
        '/NCA': 'Règ pou magazen ak itilizasyon sou ri komèsyal sa a.',
        '/TOC': 'Règ toupre yon estasyon tren ki favorize kay ak magazen toupre transpò.',
        '/NIS': 'Règ sou kote yon sit piki sipèvize ka louvri. Li kouvri pifò vil la.',
        '/MIN': 'Règ sou lojman abòdab nan nouvo lojman.',
        '/AHP': 'Règ ki ankouraje kenbe lojman abòdab.',
        '/AHC': 'Limit wotè toupre ayewopò a.',
        '/HHC': 'Limit wotè toupre yon ayewopò elikoptè.',
        '/ENV': 'Règ ki pwoteje karakteristik natirèl tankou pyebwa, pant apik ak ti rivyè.',
        '/WWO': 'Règ ki pwoteje Wissahickon Creek ak ti rivyè li yo.',
        '/DRC': 'Règ pou tè ki bò Delaware River.',
        '/CDO': 'Règ pou bò rivyè Central Delaware.',
        '/FNE': 'Règ siplemantè pou Far Northeast.',
        '/NE': 'Règ siplemantè pou Northeast.',
        '/UED': 'Règ sou gwo ekran ak panno ki limen.',
        council: 'Règ siplemantè Konsèy Minisipal te fikse pou yon pati nan yon distri Konsèy.',
        flood: 'Règ pwoteksyon kont inondasyon: limit sou konstriksyon ak ranpli tè kote inondasyon rive.',
        steep: 'Limit sou konstriksyon ak nivèlman sou pant apik.',
        coverage: 'Limite ki kantite nan yon teren ki ka kouvri ak bilding ak pavaj, pou pwoteje Wissahickon Creek.',
        animal: 'Yon zòn kote Kòd Zonaj la pèmèt moun kenbe kèk bèt fèm, selon règ li yo.',
        signs: 'Règ sou panno ak gwo panno piblisite.',
        childCare: 'Règ sou gadri fanmi nan kay.',
        parking: 'Règ sou konbyen estasyonman nouvo bilding bezwen.',
        loading: 'Règ sou zòn chajman pou bilding.',
        dispensary: 'Règ sou ki jan yon dispansè marijwana medikal ka toupre lòt kote.',
        institutional: 'Règ pou enstitisyon sou Germantown Avenue.',
        pump: 'Règ toupre yon estasyon ponp dlo.',
        floorArea: 'Règ sou konbyen espas planch bilding yo ka genyen.',
        waterfront: 'Distans minimòm pou bilding bò dlo.',
        overlay: 'Yon distri zonaj siperpoze ajoute pwòp règ li anwo zonaj debaz la isit la.',
        supplemental: 'Yon règ espesyal Kòd Zonaj la ajoute pou zòn sa a.',
      },
      brownfieldTitle: 'Dosye brownfield',
      brownfield:
        'Yon evalyasyon oswa yon netwayaj brownfield federal (sit ki ka kontamine) te anrejistre nan oswa toupre adrès sa a. Teste tè a anvan ou plante manje.',
      brownfieldSite: (name, feet) => `${name}, apeprè ${formatNumber(feet)} pye de teren sa a`,
      onLot: 'sou teren sa a',
      brownfieldMore: (n) => `ak ${plural(n, { other: '# lòt dosye' })} nan apeprè 330 pye`,
      brownfieldNote: 'Dosye EPA yo montre kote yon sibvansyon brownfield federal te peye pou travay. Yo pa di sa ki nan tè a jodi a.',
      soilTest: 'Tès tè Penn State Extension',
      gardenGuide: 'Gid EPA pou fè jaden nan tè vil',
      epaRecord: 'Dosye sa a nan EPA',
      appealsTitle: 'Apèl ak odyans',
      appealsIntro: 'Apèl bay komisyon Vil la sou pwopriyete sa a, pi resan an an premye, jan Vil la pibliye yo.',
      noAppeals: 'Pa gen okenn apèl bay komisyon Vil la nan dosye pou pwopriyete sa a.',
      appealsMissing: 'Nou bati kopi chak semèn nou an san dosye apèl Vil la, kidonk paj sa a pa ka di si gen.',
      appealsMissingOff: 'Done an dirèk Vil la ka montre yo.',
      boards: {
        zoning: 'Zoning Board of Adjustment (Komisyon Ajisteman Zonaj)',
        li_review: 'L&I Review Board (Komisyon Revizyon L&I)',
        building: 'Board of Building Standards (Komisyon Estanda Bilding)',
        other: 'Yon lòt komisyon Vil la',
      },
      comingUp: 'K ap vini',
      filed: (date) => `Depoze ${date}`,
      hearingOn: (date, time, upcoming) => `${upcoming ? 'Odyans fikse pou' : 'Odyans'} ${date}${time ? `, a ${time}` : ''}`,
      decidedOn: (date) => `Deside ${date}`,
      status: (status) => `Estati: ${status}`,
      decision: (decision) => `Desizyon: ${decision}`,
      rco: (name) => `Vil la te avèti òganizasyon kominotè anrejistre sa a: ${name}.`,
      filedBy: 'Depoze pa',
      ownerNamed: 'Pwopriyetè ki nonmen',
      namesNote: 'Non yo se jan Vil la pibliye yo. Yo parèt sèlman sou paj teren sa a, pa janm sou kat la ni nan telechajman.',
      grounds: 'Li apèl la ak rezon li yo nan Vil la (istwa pwopriyete L&I)',
      takePart: {
        zoning: 'Kijan pou patisipe nan yon odyans zonaj',
        li_review: 'L&I Review Board',
        building: 'Board of Building Standards',
        other: 'Kalandriye apèl Vil la',
      },
      calendar: 'Kalandriye odyans Vil la',
      decisions: {
        'GRANTED/PROV': 'Akòde ak kondisyon',
        'DENIED/PROV': 'Refize ak kondisyon',
        'DISMI/ENFORC': 'Dosye a fèmen san swit',
        'ADMIN/REVIEW': 'Voye pou revizyon administratif',
        'HELD/INFO': 'Kenbe pou plis enfòmasyon',
        NEWHEARNOT: 'Pa akòde yon nouvo odyans',
        BOARDAKNOWL: 'Rekonèt pa komisyon an',
        'LATE-APPRVD': 'Apèl anreta apwouve',
        'CITY AFFIRMED': 'Desizyon Vil la rete',
        AFFIRMED: 'Desizyon Vil la rete',
      },
      missing: {
        historic: 'Nou bati kopi chak semèn nou an san rejis istorik la, kidonk paj sa a pa ka di si teren sa a istorik. Mande Komisyon Istorik la.',
        overlays: 'Nou bati kopi chak semèn nou an san zonaj siperpoze yo, kidonk paj sa a pa ka fè lis yo. Atlas, kat Vil la, montre yo.',
        brownfields: 'Nou bati kopi chak semèn nou an san dosye brownfield EPA yo, kidonk paj sa a pa ka di si gen kèk toupre.',
      },
      none: 'Pa gen okenn nan dosye sa yo ki nonmen teren sa a.',
    },
  },

};

export default ht;
