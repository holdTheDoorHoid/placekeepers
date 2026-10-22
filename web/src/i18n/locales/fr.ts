// French (fr): the interface text of web/src/strings.ts, key for key.
//
// Translated for issue #49, part B. Plain international French with "vous", readable by French
// speaking neighbors from West and Central Africa and Haiti as well as from France and Quebec.
// The key terms are fixed in docs/i18n/glossary-fr.md; keep them consistent here, in the registry
// text (registry/i18n/fr.yaml) and in the content pages (content/fr/).
//
// Rules: keep each key's meaning and every value a template shows (the tests check), no dashes
// as punctuation, and proper names as they are (Placekeepers, Philly311, LandCare). French
// typography: a narrow no break space (U+202F) before : ; ! ? and % and inside « guillemets ».

import type { Catalog } from '../catalog.ts';
import { formatDecimal, formatNumber, plural } from '../format.ts';
import { distanceWords } from '../../strings.ts';

/** A change in percent in words: "en hausse de 61 %", "en baisse de 3 %", "inchangé". */
function changeWords(n: number): string {
  if (n > 0) return `en hausse de ${formatNumber(n)} %`;
  if (n < 0) return `en baisse de ${formatNumber(-n)} %`;
  return 'inchangé';
}

/** " (à quelques points près : 6)", or nothing when there is no margin: a survey's margin of error. */
function giveOrTake(margin: number | null, unit: 'points' | 'homes'): string {
  if (margin === null) return '';
  return ` (marge d'erreur de ${unit === 'points' ? plural(margin, { one: '# point', other: '# points' }) : formatNumber(margin)})`;
}

const fr: Catalog = {
  app: {
    name: 'Placekeepers',
    tagline: 'Une carte gratuite pour les voisins de Philadelphie qui prennent soin de leur rue.',
    mapLabel: 'Carte de Philadelphie. Les listes de lieux et de mémoriaux de cette page montrent les mêmes choses en texte.',
    loadingMap: 'Chargement de la carte',
    mapFailed: "La carte n'a pas pu démarrer dans ce navigateur. Essayez un autre navigateur, ou mettez celui-ci à jour.",
    sampleData: "Données d'exemple pour des tests. Ce ne sont pas de vrais lieux.",
    earlyPreview: "Version 0.4 : une première version publique. Vérifiez les faits auprès de la Ville avant d'agir.",
    followAlong: 'Suivre le projet',
    skipToList: 'Aller à la liste des lieux',
    hideNote: 'Masquer',
    hideNoteLabel: 'Masquer cette note',
    close: 'Fermer',
    notAffiliated: "Sans lien avec la Ville de Philadelphie ni avec la SEPTA. Ce n'est pas un avis juridique.",
    licenses: 'Code : GPL-3.0. Données : chaque source a sa propre licence. Textes : Creative Commons BY-SA 4.0.',
  },

  content: {
    tableLabel: 'Tableau, défile sur les côtés',
    removalEmail: (email) =>
      `Écrivez-nous à [${email}](mailto:${email}). Nous n'utilisons pas de formulaire public pour cela, car une demande de retrait est personnelle et privée.`,
    removalComingSoon: (issueUrl) =>
      `Une adresse e-mail privée pour ces demandes arrive bientôt. En attendant, la carte n'affiche aucun nom, et vous pouvez faire votre demande dans une [issue GitHub](${issueUrl}). Tout le monde peut lire une issue GitHub : écrivez donc seulement le numéro du mémorial ou son emplacement. Vous n'avez pas besoin de donner un nom, une raison ni de dire qui vous êtes.`,
  },

  language: {
    button: 'Langue',
    buttonLabel: (name) => `Langue : ${name}. Choisir une autre langue`,
    title: 'Langue',
    intro: 'Choisissez la langue de ce site. La page se rouvre dans cette langue, et ce navigateur se souvient de votre choix.',
    inUse: 'Langue actuelle',
    notReady: 'Traduction en cours',
    listLabel: 'Langues',
    aiNote: "Traduit avec l'aide de l'intelligence artificielle et pas encore vérifié par une personne de langue maternelle française.",
    fixLink: 'Corriger une traduction',
    pageInEnglish: "Cette page n'est pas encore traduite, elle s'affiche donc en anglais.",
    offerLabel: 'Proposition de langue',
  },

  units: {
    meters: (n) => `${formatNumber(n)} mètres`,
    kilometers: (km) => `${formatDecimal(km, 1)} kilomètres`,
  },

  header: {
    settings: 'Paramètres',
    share: 'Copier le lien',
    shareDone: "Lien copié. Toute personne qui l'ouvre voit cette même carte.",
    shareDoneNoMap: "Lien copié. Il n'inclut pas l'endroit où se trouve la carte, parce que la carte montre l'endroit où vous êtes.",
    shareFailed: "Impossible de copier le lien. Copiez plutôt l'adresse depuis votre navigateur.",
    dataStatus: 'État des données',
  },

  nav: {
    menu: 'Menu',
    menuTitle: 'Menu du site',
    menuLabel: 'Pages du site',
    map: 'Carte',
    landBank: 'La Land Bank en chiffres',
    pages: [
      { slug: 'about', label: 'À propos' },
      { slug: 'why', label: 'Pourquoi ça marche' },
      { slug: 'how', label: 'Comment faire' },
      { slug: 'responsibly', label: 'À utiliser avec responsabilité' },
      { slug: 'vacant-land', label: 'Comment nous trouvons les terrains vacants' },
      { slug: 'streetcomplete', label: 'Relever les arrêts de bus' },
      { slug: 'terms', label: "Conditions d'utilisation" },
      { slug: 'privacy', label: 'Confidentialité' },
      { slug: 'contact', label: 'Contact' },
    ],
  },

  views: {
    groupLabel: 'Choisissez une vue',
    field: 'Rue',
    analysis: 'Analyse',
    fieldLong: 'Vue de la rue',
    analysisLong: "Vue d'analyse",
    fieldHint: 'Pour quand vous êtes dans la rue : les lieux proches et la première démarche légale.',
    analysisHint: 'Pour les organisateurs : angles, filtres, détails et une liste classée.',
    auto: "Choisir une vue selon la taille de mon écran",
    autoHint: "Les téléphones affichent la vue de la rue ; les écrans plus grands, la vue d'analyse.",
  },

  freshness: {
    checking: 'Vérification des données',
    ok: (date) => `Données du ${date}`,
    stale: 'Certaines données ne sont pas à jour',
    failing: 'Certaines données ne se chargent pas',
    unknown: "État des données inconnu",
  },

  field: {
    nearMe: 'Près de moi',
    nearMeBusy: 'Recherche de votre position',
    nearMeDenied: 'La localisation est désactivée pour ce site. Vous pouvez quand même déplacer la carte à la main.',
    nearMeUnavailable: "Votre appareil n'a pas pu trouver votre position. Vous pouvez quand même déplacer la carte à la main.",
    nearMeUnsupported: 'Ce navigateur ne peut pas partager votre position. Vous pouvez quand même déplacer la carte à la main.',
    nearMeOutside: 'Vous semblez être en dehors de Philadelphie. Cette carte couvre seulement Philadelphie.',
    nearMePrivacy: "Votre position reste sur votre appareil. Placekeepers ne l'envoie jamais nulle part et ne la met jamais dans un lien.",
    youAreHere: 'Vous êtes ici',
    stopLocation: 'Ne plus utiliser ma position',
    locationInUse: 'Votre position est utilisée. Elle reste sur cet appareil, et en dehors de tout lien que vous copiez.',
    stop: 'Arrêter',
    myLists: 'Mes listes',
    listsTitle: 'Listes enregistrées',
    chipsLabel: 'Couches principales',
    moreLayers: 'Plus de couches',
    layersTitle: 'Couches',
  },

  chips: {
    lots: 'Terrains',
    streets: 'Rues',
    memorials: 'Mémoriaux',
    stops: 'Arrêts de bus',
    comingSoon: 'bientôt',
  },

  sheet: {
    title: 'Ce que vous pouvez faire près de chez vous',
    show: 'Afficher les lieux à proximité',
    hide: 'Masquer les lieux à proximité',
    countLabel: (n) => plural(n, { one: '# lieu', other: '# lieux' }),
    zoomIn: 'Déplacez la carte ou zoomez sur un quartier pour voir les lieux à proximité.',
    finding: 'Recherche des lieux à proximité.',
    noLotsLayer: 'Activez la couche Terrains ou Arrêts de bus pour voir les lieux à proximité.',
    nothingHere: 'Aucun terrain ni bâtiment vacant ne correspond à vos paramètres dans cette partie de la carte.',
    nothingHereStops: 'Aucun terrain vacant, bâtiment vacant ni arrêt de bus ne correspond à vos paramètres dans cette partie de la carte.',
    noStopsHere: 'Aucun arrêt de bus ou de tramway ne correspond à vos paramètres dans cette partie de la carte.',
    showOnMap: 'Voir sur la carte',
    openLotPage: 'Ouvrir la page du terrain',
    nearestToYou: "Les plus proches de vous d'abord.",
    nearestToCenter: "Les plus proches du centre de la carte d'abord. Déplacez la carte, ou touchez Près de moi.",
    noneWithSuggestion: "Aucun lieu ici n'a de suggestion activée. Activez les suggestions dans les Paramètres, ou déplacez la carte.",
    showMore: 'Afficher plus de lieux',
    distance: (meters, fromYou) => {
      const feet = meters * 3.28084;
      const far = feet < 1000 ? `${formatNumber(Math.max(10, Math.round(feet / 10) * 10))} pieds` : `${formatDecimal(feet / 5280, 1)} miles`;
      return `À environ ${far} ${fromYou ? 'de vous' : 'du centre de la carte'}`;
    },
  },

  place: {
    kindLot: 'Terrain vacant',
    kindBuilding: 'Bâtiment vacant',
    kindUnknown: 'Parcelle vacante',
    parcel: (id) => `Parcelle ${id}`,
    priority: (score, lens) => `Priorité ${score} sur 100 pour l'angle « ${lens.toLowerCase()} »`,
    mainReason: (label) => `Raison principale : ${label}.`,
    bestSuggestion: 'Ce que vous pourriez faire',
    firstStep: 'Première démarche légale',
    cost: (cost) => `Coût : ${cost}`,
    confidence: { 1: "Nous ne sommes pas très sûrs qu'il soit vacant", 2: 'Probablement vacant', 3: 'Très probablement vacant' },
    confidenceTitle: 'Notre degré de certitude',
    ownerTitle: 'Type de propriétaire',
    landcare: 'Déjà entretenu par PHS LandCare',
    listed: 'Indiqué comme disponible par les agences foncières de la Ville',
    suggestionsTitle: 'Suggestions',
    clearSelection: 'Effacer la sélection',
    selectedTitle: 'Lieu sélectionné',
  },

  ownerTypes: {
    0: 'Inconnu',
    1: 'Particulier',
    2: 'Entreprise',
    3: 'Ville de Philadelphie',
    4: 'Philadelphia Land Bank',
    5: 'Redevelopment Authority',
    6: 'Autorité du logement public',
    7: 'Organisme à but non lucratif',
    8: 'Autre organisme public',
  },

  why: {
    title: 'Pourquoi ce score',
    caption: "La valeur de chaque facteur de 0 à 100, son poids et les points qu'il ajoute au score",
    intro: 'Le score est une moyenne pondérée de ces facteurs. Chacun va de 0 à 100, où 100 signifie le plus grand besoin.',
    factor: 'Facteur',
    value: 'Sur 100',
    weight: 'Poids',
    adds: 'Ajoute',
    noData: 'pas de données',
    off: 'désactivé',
    total: 'Score',
    missingNote: 'Les facteurs sans données pour ce lieu sont laissés de côté dans sa moyenne.',
  },

  reasons: {
    title: "Pourquoi nous pensons qu'il est vacant",
    againstTitle: 'Ce qui nous fait hésiter',
    notPublished: "Les raisons pour ce lieu ne sont pas encore publiées.",
    city_land: (date) =>
      date ? `La Ville l'indique comme terrain probablement vacant (liste datée du ${date})` : "La Ville l'indique comme terrain probablement vacant",
    city_building: (date) =>
      date
        ? `La Ville l'indique comme bâtiment probablement vacant (liste datée du ${date})`
        : "La Ville l'indique comme bâtiment probablement vacant",
    assessor_vacant_land: "L'évaluateur foncier le classe comme terrain vacant",
    no_building: "Aucun bâtiment ne se trouve sur la parcelle",
    demolished: (year) =>
      year ? `Démoli en ${year}, sans rien de construit depuis` : 'Démoli, sans rien de construit depuis',
    vacant_lot_record: 'L&I a enregistré une infraction ou une plainte pour terrain vacant au cours des deux dernières années',
    landcare: 'Il fait partie de PHS LandCare, qui entretient les terrains vacants',
    sealed: (year) =>
      year ? `Scellé par la Ville en ${year}, sans permis depuis` : 'Scellé par la Ville, sans permis depuis',
    unsafe: "L&I l'indique comme non sûr, sans permis depuis",
    imminently_dangerous: "L&I l'a déclaré en danger imminent, sans permis depuis",
    vacant_building_record: 'L&I a enregistré une infraction ou une plainte pour propriété vacante au cours des deux dernières années',
    assessor_exterior: "L'évaluateur foncier a noté que son extérieur est vacant ou scellé",
    built_since: (year) =>
      year
        ? `Un nouveau permis de construire a été délivré en ${year}, donc un bâtiment s'y trouve peut-être maintenant`
        : "Un nouveau permis de construire a été délivré, donc un bâtiment s'y trouve peut-être maintenant",
    construction_starting: (year) =>
      year
        ? `Un nouveau permis de construire a été délivré en ${year}, donc les travaux commencent peut-être`
        : 'Un nouveau permis de construire a été délivré, donc les travaux commencent peut-être',
    side_yard: "Le propriétaire de la maison habitée voisine en est aussi propriétaire, donc ce peut être un jardin latéral",
    land_use_shows_use: "La carte d'occupation du sol de la Ville le montre en usage",
    recent_permit: 'Un permis de travaux ou de zonage a été délivré au cours des deux dernières années',
    building_stands: "L'empreinte d'un bâtiment s'y trouve, bien que les registres indiquent un terrain vacant",
    homestead: "Le propriétaire bénéficie d'une Homestead Exemption (exonération fiscale pour résidence principale) : les registres de la Ville indiquent que quelqu'un y habite, ou y a habité",
  },

  lens: {
    title: 'Angle',
    presets: 'Préréglages',
    presetActive: 'actif',
    weightLabel: (factor) => `Poids de ${factor}`,
    weightValue: (w) => (w === 0 ? 'Désactivé' : `${w} sur 5`),
    resetWeights: 'Réinitialiser les poids',
    allOff: 'Tous les facteurs sont désactivés. Activez-en un pour colorier les terrains.',
    allOffFor: (appliesTo) =>
      appliesTo === 'segment'
        ? 'Tous les facteurs sont désactivés. Activez-en un pour colorier les rues.'
        : appliesTo === 'stop'
          ? 'Tous les facteurs sont désactivés. Activez-en un pour colorier les arrêts de bus et de tramway.'
          : 'Tous les facteurs sont désactivés. Activez-en un pour colorier les terrains.',
    explainToggle: 'Pourquoi ce facteur',
    shown: (layer, lens) => `La carte affiche maintenant « ${layer} », coloriée selon l'angle « ${lens.toLowerCase()} ».`,
    notShown: (layer) => `La carte n'affiche pas cet angle sur « ${layer} » pour le moment.`,
    showOnMap: 'Voir sur la carte',
    legendLow: 'Priorité plus faible',
    legendHigh: 'Priorité plus élevée',
    legendNoData: 'Pas de score',
  },

  filters: {
    title: 'Filtres',
    intro:
      'Choisissez des pastilles pour réduire les terrains sur la carte, la liste classée et le graphique. Un groupe où aucune pastille n\'est choisie montre tout.',
    ownerType: 'Type de propriétaire',
    landcare: 'Déjà dans LandCare',
    inLandcare: 'Entretenu par PHS LandCare',
    notInLandcare: 'Pas dans LandCare',
    confidence: 'Notre degré de certitude',
    kind: 'Terrain ou bâtiment',
    listed: 'Indiqué par les agences foncières de la Ville',
    clear: 'Effacer les filtres',
    showAll: 'Tout afficher',
    noneSelected: (group) => `Rien n'est choisi sous « ${group} », donc aucun terrain n'est affiché.`,
    narrowedNote: (n) =>
      n === 1
        ? "Un filtre de la vue d'analyse réduit ces lieux."
        : `${formatNumber(n)} filtres de la vue d'analyse réduisent ces lieux.`,
  },

  permission: {
    title: "Première démarche pour obtenir l'autorisation",
    short: {
      0: 'Pas encore de voie claire',
      1: 'Community LandCare',
      2: 'Accord ou licence de jardin',
      3: 'Demander à la PHDC',
      4: "Demander à l'organisme public",
      5: 'Demander au propriétaire',
    },
    long: {
      0: 'Pas encore de voie claire : les registres de la Ville ne donnent aucun nom de propriétaire',
      1: "PHS LandCare s'en occupe déjà : prise en charge par Community LandCare",
      2: 'La Ville ou la Land Bank en est propriétaire : un accord ou une licence de jardin',
      3: 'La Redevelopment Authority ou la PHDC en est propriétaire : demandez à la PHDC',
      4: "L'autorité du logement ou un autre organisme public en est propriétaire : demandez à l'organisme",
      5: 'Un propriétaire privé : demandez au propriétaire',
    },
    notPublished: 'Pas encore publié',
    filterHelp:
      "Qui demander en premier, d'après le propriétaire que nomment les registres de la Ville. C'est un type de démarche, pas une mesure de la probabilité que quelqu'un réponde oui.",
    noRoute: 'Pas encore de voie claire : les registres de la Ville ne donnent aucun nom de propriétaire. La page du terrain montre ce que nous savons.',
    seeLotPage: 'La page du terrain énumère les voies légales pour ce lieu.',
  },

  layers: {
    title: 'Couches',
    show: (label) => `Afficher ${label}`,
    details: 'À propos de cette couche',
    settings: 'Paramètres de la couche',
    sources: 'Sources',
    legend: 'Légende',
    license: 'Licence',
    noData: 'Pas encore de données publiées',
    dataError: "Cette couche n'a pas pu être chargée.",
    resetAll: 'Revenir aux valeurs par défaut',
    resetDone: 'Les paramètres sont revenus à leurs valeurs par défaut.',
    guide: 'Comment vous pouvez aider à améliorer cette couche',
  },

  settings: {
    title: 'Paramètres',
    intro:
      "Tout ce qui est sur la carte est un paramètre. Vos choix sont enregistrés dans ce navigateur et dans le lien, sauf vos choix de confidentialité, qui restent seulement dans ce navigateur.",
    viewTitle: 'Vue',
    layersTitle: 'Couches et leurs paramètres',
    lensTitle: 'Poids des angles',
    suggestionsTitle: 'Suggestions à afficher',
    suggestionShow: (label) => `Afficher « ${label} »`,
    resetTitle: 'Recommencer',
    resetHelp:
      'Remet chaque couche, paramètre et poids aux valeurs par défaut de cette vue, et oublie la copie enregistrée dans ce navigateur.',
    reset: 'Revenir aux valeurs par défaut',
    storageNote: "Enregistré seulement dans ce navigateur. Placekeepers n'a ni comptes, ni cookies, ni suivi.",
  },

  analysis: {
    leftTitle: 'Angle, filtres et couches',
    rightTitle: 'Détails',
    openLeft: 'Angle et couches',
    openRight: 'Détails',
    closePanel: 'Fermer le panneau',
    areaTitle: 'Dans cette partie de la carte',
    areaLots: (n) => plural(n, { one: '# terrain vacant', other: '# terrains vacants' }),
    areaBuildings: (n) => plural(n, { one: '# bâtiment vacant', other: '# bâtiments vacants' }),
    areaHigh: (n) => `dont ${formatNumber(n)} très probablement vacants`,
    areaLandcare: (n) => `${formatNumber(n)} déjà entretenus par PHS LandCare`,
    areaEmpty: "Aucun terrain ni bâtiment vacant ne correspond à vos paramètres ici. Essayez de dézoomer ou de changer les filtres.",
    areaHint: 'Choisissez un terrain sur la carte ou dans la liste pour voir pourquoi il a ce score.',
    sampleArea:
      "À ce niveau de dézoom, la carte ne montre qu'un échantillon des terrains et bâtiments vacants, ils ne sont donc pas comptés ici. Zoomez pour compter tous les lieux.",
    sampleList:
      "Zoomez pour lister tous les lieux. À ce niveau de dézoom, la carte ne montre qu'un échantillon des terrains et bâtiments vacants, donc une liste ou un graphique ici omettrait des lieux.",
    sampleTab: 'zoomez',
    tableCaption: "Lieux à l'écran, classés selon le mélange d'angles actuel",
    rank: 'Rang',
    place: 'Lieu',
    score: 'Score',
    reason: 'Raison principale',
    save: 'Enregistrer',
    sortHighFirst: "Score le plus élevé d'abord. Choisissez pour mettre le plus bas d'abord.",
    sortLowFirst: "Score le plus bas d'abord. Choisissez pour mettre le plus élevé d'abord.",
    tableEmpty: "Rien à classer à l'écran.",
    noScores: "Les scores de priorité ne sont pas encore publiés, cette liste suit donc l'ordre des numéros de parcelle.",
    tableMore: (shown, total) =>
      `Affichage des ${formatNumber(shown)} premiers sur ${formatNumber(total)}. Zoomez ou réduisez les filtres pour voir le reste, ou téléchargez-les tous.`,
    drawerLabel: "Lieux à l'écran",
    tabTable: 'Liste classée',
    tabPlot: 'Besoin et première démarche',
    tabLists: 'Listes enregistrées',
    tabMemorials: 'Mémoriaux',
    tabBlocks: 'Tronçons de rue',
  },

  plot: {
    title: "Besoin et première démarche pour obtenir l'autorisation",
    intro:
      "Chaque point est un lieu à l'écran. Horizontalement : sa priorité selon votre mélange d'angles, de 0 à 100. Verticalement : la première démarche pour obtenir l'autorisation, un type de démarche, pas une mesure de la probabilité que quelqu'un réponde oui. Choisissez un point pour ouvrir la page de son terrain.",
    axisX: "Priorité selon votre mélange d'angles",
    empty: "Aucun lieu à l'écran à représenter.",
    noScore: (n) =>
      `${plural(n, { one: "# lieu n'a pas de score et n'est pas affiché", other: "# lieux n'ont pas de score et ne sont pas affichés" })}.`,
    noStep: (n) =>
      `${plural(n, { one: "# lieu n'a pas encore de première démarche publiée et n'est pas affiché", other: "# lieux n'ont pas encore de première démarche publiée et ne sont pas affichés" })}.`,
    dot: (place, score, step) => `${place} : priorité ${score}. ${step}.`,
    tableNote: "La liste classée montre les mêmes lieux, avec la même première démarche, pour les claviers et les lecteurs d'écran.",
    capped: (shown, total) =>
      `Affichage des ${formatNumber(shown)} lieux au score le plus élevé sur ${formatNumber(total)} à l'écran. Zoomez pour les voir tous.`,
    summary: (rows) => `Lieux à l'écran selon la première démarche pour obtenir l'autorisation : ${rows}.`,
    rowSummary: (label, n) => `${label}, ${plural(n, { one: '# lieu', other: '# lieux' })}`,
  },

  export: {
    title: 'Télécharger ces lieux',
    help: (limit) =>
      `Un fichier de ${formatNumber(limit)} lieux au plus, avec ce que dit chaque page de terrain sur le propriétaire, y compris les indicateurs sur le propriétaire. Sa première ligne renvoie aux conditions d'utilisation.`,
    csv: 'Télécharger le CSV',
    geojson: 'Télécharger le GeoJSON',
    inView: "Lieux à l'écran",
    working: (done, total) => `Collecte des détails sur les propriétaires : ${formatNumber(done)} fichiers sur ${formatNumber(total)}`,
    done: (n) => `${plural(n, { one: '# lieu téléchargé', other: '# lieux téléchargés' })}.`,
    leftOut: (n, limit) =>
      `${plural(n, { one: '# lieu de plus a été laissé de côté', other: '# lieux de plus ont été laissés de côté' })}, parce qu'un téléchargement contient au plus ${formatNumber(limit)} lieux. Zoomez ou réduisez les filtres pour télécharger le reste.`,
    withoutDetails: (n) =>
      `${plural(n, { one: "# lieu n'a pas de détails publiés, donc ses colonnes sur le propriétaire sont vides", other: "# lieux n'ont pas de détails publiés, donc leurs colonnes sur le propriétaire sont vides" })}.`,
    nothing: "Il n'y a aucun lieu à télécharger.",
    sampleOff: "Les téléchargements contiennent chaque lieu à l'écran, et à ce niveau de dézoom la carte n'en montre qu'un échantillon. Zoomez pour télécharger.",
    failed: "Le téléchargement n'a pas pu être créé. Réessayez dans un instant.",
    yes: 'oui',
    no: 'non',
    termsLine: (url) => `Export Placekeepers : pour le soin communautaire et l'action légale seulement. Lisez d'abord les conditions d'utilisation : ${url}`,
    englishColumns: 'Les noms des colonnes sont en anglais dans toutes les langues pour que les fichiers puissent être combinés et relus.',
    madeLine: (n, title, day, dataDay) =>
      `${plural(n, { one: '# lieu', other: '# lieux' })} de ${title}. Créé le ${day}${dataDay ? ` à partir des données hebdomadaires du ${dataDay}` : ''}.`,
    ownerLine:
      "Les noms des propriétaires et les adresses postales sont tels que la Ville les publie. Chaque indicateur sur le propriétaire comporte une note de prudence et une prochaine étape protectrice : lisez-les sur la page du terrain avant d'agir. Ce n'est pas un avis juridique.",
    scoreLine: (lens, weights) => `Les scores utilisent l'angle « ${lens} » avec ces poids : ${weights}.`,
    greeningLine: (caution) => `À propos des suggestions de verdissement : ${caution}`,
    placemakingLine: (caution) => `À propos des jardins, des places assises et de l'art : ${caution}`,
  },

  lists: {
    title: 'Listes enregistrées',
    privacy:
      "Les listes restent dans ce navigateur, sur cet appareil. Rien n'est envoyé nulle part. Pour déplacer une liste vers un autre appareil ou la partager, téléchargez-la comme fichier et ouvrez ce fichier là-bas.",
    notKept:
      "Ce navigateur ne conserve pas les listes pour le moment, peut-être à cause d'une fenêtre privée ou d'un stockage bloqué. Téléchargez votre liste avant de fermer la page.",
    empty: "Pas encore de listes. Enregistrez un lieu depuis sa fiche, la liste classée ou la page de son terrain, et une liste est créée.",
    inUse: 'Liste utilisée',
    defaultName: 'Ma liste',
    untitled: 'Liste',
    newList: 'Nouvelle liste',
    newName: 'Nom de la nouvelle liste',
    create: 'Créer la liste',
    rename: 'Renommer',
    renameLabel: 'Nouveau nom de cette liste',
    saveName: 'Enregistrer le nom',
    cancel: 'Annuler',
    delete: 'Supprimer cette liste',
    made: (name) => `La liste « ${name} » est créée. Les lieux que vous enregistrez maintenant y sont ajoutés.`,
    renamed: (name) => `La liste s'appelle maintenant « ${name} ».`,
    deleted: (name) => `« ${name} » est supprimée de ce navigateur.`,
    confirmDelete: (name, n) =>
      `Supprimer « ${name} » et ${plural(n, { one: 'son lieu', other: 'ses # lieux' })} de ce navigateur ? Elle ne pourra pas être récupérée, sauf si vous l'avez téléchargée.`,
    count: (n) => plural(n, { one: '# lieu', other: '# lieux' }),
    noPlaces: "Cette liste est vide. Enregistrez des lieux depuis leurs fiches, la liste classée ou les pages de leurs terrains.",
    open: (place) => `Ouvrir la page du terrain de ${place}`,
    remove: 'Retirer',
    removeLabel: (place) => `Retirer ${place} de la liste`,
    save: 'Enregistrer dans ma liste',
    saveShort: 'Enregistrer',
    savedShort: 'Enregistré',
    saveShortLabel: (place, list) => `Enregistrer ${place} dans ${list}`,
    saveTo: (name) => `Enregistrer dans ${name}`,
    saved: (name) => `Enregistré dans ${name}`,
    savedLabel: (name) => `Enregistré dans ${name}. Choisissez pour le retirer.`,
    added: (name) => `Enregistré dans « ${name} ». Les listes restent dans ce navigateur.`,
    removed: (name) => `Retiré de « ${name} ».`,
    full: (limit) => `Cette liste est pleine : une liste contient jusqu'à ${formatNumber(limit)} lieux.`,
    tooMany: (limit) => `Ce navigateur conserve jusqu'à ${formatNumber(limit)} listes. Supprimez-en une pour en créer une autre.`,
    download: 'Télécharger cette liste',
    importTitle: 'Ouvrir un fichier de liste',
    importHelp: 'Un fichier CSV ou GeoJSON téléchargé depuis Placekeepers, ou tout fichier texte de numéros de parcelle à neuf chiffres.',
    imported: (name, n) => `« ${name} » est ouverte avec ${plural(n, { one: '# lieu', other: '# lieux' })}.`,
    importFailed: "Ce fichier ne contient aucun numéro de parcelle que nous ayons pu lire.",
    importTooBig: 'Ce fichier est trop grand pour être une liste.',
    importLeftOut: (n, limit) =>
      `${plural(n, { one: '# lieu a été laissé de côté', other: '# lieux ont été laissés de côté' })} : une liste contient jusqu'à ${formatNumber(limit)} lieux.`,
  },

  displacement: {
    caution: "Le verdissement peut faire monter les prix à proximité. Pensez à l'associer à des protections.",
    placemakingCaution:
      "De nouveaux jardins, de nouvelles places assises et de l'art peuvent rendre une rue plus recherchée et faire monter les prix et les loyers à proximité. Associez-les à des protections pour les voisins qui sont locataires ou en retard sur leurs impôts fonciers.",
    protections: 'Moyens de protéger les voisins',
    inWatch: (signs) => `Ce lieu se trouve dans une zone de vigilance sur les déplacements d'habitants, avec des signes que les prix y montent : ${signs}.`,
    protectionsTitle: 'Protections à associer',
    jumpToWatch: 'Voir les signes ici et les moyens de protéger les voisins',
    jumpToProtections: 'Voir les moyens de protéger les voisins',
    listIntro:
      "Certains de ces lieux se trouvent dans des zones de vigilance sur les déplacements d'habitants, avec des signes dans les registres publics que les prix y montent. La fiche de chacun nomme les signes de sa zone.",
    printSeeAbove: 'Voir « Vigilance sur les déplacements » plus haut.',
    protectionLabels: {
      neighborhood_gardens_trust: 'Neighborhood Gardens Trust',
      community_land_trust: 'Fiducies foncières communautaires (community land trusts)',
      homestead_exemption: "La Homestead Exemption de la Ville (exonération fiscale pour résidence principale)",
      longtime_owner_occupants: "Le programme de la Ville pour les propriétaires occupants de longue date (Longtime Owner Occupants Program, LOOP)",
      tangled_title_help: "Aide pour un titre de propriété embrouillé",
    },
    checked: (date) => `vérifié le ${date}`,
    signShort: {
      prices: "prix des logements qui montent plus vite que dans l'ensemble de la ville",
      assessments: "valeurs d'évaluation de la Ville qui montent plus vite que dans l'ensemble de la ville",
      mva: "l'analyse de la valeur marchande de la Ville (Market Value Analysis) montre des prix de logements qui deviennent inaccessibles aux habitants de longue date",
      companies: 'des entreprises qui achètent beaucoup des logements vendus',
      renters: 'au moins trois logements sur cinq sont loués',
      rent_burden: 'beaucoup de locataires paient la moitié de leur revenu ou plus en loyer',
    },
    heading: 'Signes que les prix montent ici',
    areaTitle: (tract) => `Secteur de recensement ${tract}`,
    around: (place) => `Autour de ${place}`,
    signsHere: 'Signes ici',
    alsoMeasured: "Aussi mesuré, mais pas un signe ici",
    signTitle: {
      prices: 'Prix de vente des logements',
      assessments: "Valeurs d'évaluation de la Ville",
      mva: 'Analyse de la valeur marchande de la Ville (Market Value Analysis)',
      companies: 'Acheteurs qui sont des entreprises',
      renters: 'Locataires',
      rent_burden: 'Locataires qui paient la moitié de leur revenu ou plus en loyer',
    },
    span: (a0, a1, b0, b1) => `ventes de ${a0} à ${a1} et de ${b0} à ${b1}`,
    pricesText: (p0, p1, change, city, span) =>
      `Le prix médian des logements vendus est passé de ${p0} à ${p1}, ${changeWords(change)}${city === null ? '' : `, contre ${changeWords(city)} dans l'ensemble de la ville`}${span ? ` (${span})` : ''}.`,
    companiesText: (share, sales, city) =>
      `Des entreprises ont acheté ${share} % des ${formatNumber(sales)} logements vendus ces trois dernières années${city === null ? '' : `, contre ${city} % dans l'ensemble de la ville`}.`,
    assessmentsText: (change, homes, city, years) =>
      `La valeur marchande du logement médian selon la Ville est ${changeWords(change)}${years ? ` de ${years[0]} à ${years[1]}` : ''} (${plural(homes, { one: '# logement', other: '# logements' })})${city === null ? '' : `, contre ${changeWords(city)} dans l'ensemble de la ville`}.`,
    rentersText: (share, city, years) =>
      `${share} % des logements où les gens habitent ici sont loués${city === null ? '' : `, contre ${city} % dans l'ensemble de la ville`}${years ? ` (enquête du Bureau du recensement, ${years[0]} à ${years[1]})` : ''}.`,
    mvaText: (rising, groups, edition) =>
      rising > 0
        ? `Dans ${rising} des ${plural(groups, { one: '# groupe d\'îlots', other: '# groupes d\'îlots' })} d'ici, la ${edition ?? 'Market Value Analysis'} de Reinvestment Fund pour la Ville constate une pression à la hausse : des prix de logements qui deviennent inaccessibles à ce que gagnent les habitants de longue date.`
        : `Dans aucun des ${plural(groups, { one: '# groupe d\'îlots', other: '# groupes d\'îlots' })} d'ici, la ${edition ?? 'Market Value Analysis'} ne constate de pression à la hausse.`,
    mvaNone: "L'analyse de la valeur marchande (Market Value Analysis) ne couvre pas cette zone.",
    tooFewSales: (earlier, recent, needed) =>
      `Trop peu de ventes de logements pour le dire (${formatNumber(earlier)} et ${formatNumber(recent)} ; il en faut au moins ${formatNumber(needed)} par période).`,
    tooFewHomes: 'Trop peu de logements avec une valeur les deux années pour le dire.',
    tooFewHouseholds: "Trop peu de ménages dans l'enquête du recensement pour le dire.",
    rule: "Une zone est en vigilance quand au moins deux de ces signes se vérifient, dont au moins un concerne les prix : prix de vente, valeurs d'évaluation ou analyse de la valeur marchande.",
    meaning: 'Le verdissement et les autres améliorations ici peuvent faire monter encore les prix. Associez-les à des protections pour les voisins qui habitent ici maintenant.',
    cannotTell:
      "Ce sont des signes dans des registres publics, pas une prévision. Ils ne disent pas qui est parti ni pourquoi, ni qui habite ici ; les chiffres de l'enquête du recensement sont des moyennes sur cinq ans, ils ne disent donc pas quels sont les loyers aujourd'hui. Une zone hors de la vigilance peut quand même subir une hausse des prix.",
    contextTitle: 'Loyers, revenus et logements vides ici',
    contextIntro: (years) =>
      `D'après l'enquête du Bureau du recensement${years ? `, ${years[0]} à ${years[1]}` : ''}. Du contexte pour les voisins, pas un signe : ces chiffres ne changent aucune zone.`,
    contextNoisy:
      "Ce sont des estimations tirées d'une enquête auprès de quelques logements sur cinq ans, donc dans une petite zone elles sont approximatives : le vrai chiffre se trouve probablement dans la marge indiquée (la marge d'erreur du Bureau du recensement, à 90 pour cent de confiance).",
    contextTitles: {
      rent: 'Loyer médian',
      income: 'Revenu médian des ménages',
      vacant: 'Logements vides',
    },
    burdenText: (share, margin, households, city, years) =>
      `${share} % des ${formatNumber(households)} ménages locataires d'ici paient la moitié de leur revenu ou plus en loyer et charges${giveOrTake(margin, 'points')}${city === null ? '' : `, contre ${city} % dans l'ensemble de la ville`}${years ? ` (enquête du Bureau du recensement, ${years[0]} à ${years[1]})` : ''}. Les hausses de loyer les touchent le plus durement.`,
    burdenTooFew: "Trop peu de ménages locataires dans l'enquête du recensement pour le dire.",
    rentText: (rent, margin, city) =>
      `${rent} par mois, avec les charges que paie le locataire${margin ? ` (marge d'erreur de ${margin})` : ''}${city ? `, contre ${city} dans l'ensemble de la ville` : ''}.`,
    rentNone: "L'enquête du recensement a trop peu de réponses ici pour calculer un loyer médian.",
    incomeText: (income, margin, city) =>
      `${income} par an${margin ? ` (marge d'erreur de ${margin})` : ''}${city ? `, contre ${city} dans l'ensemble de la ville` : ''}.`,
    incomeNone: "L'enquête du recensement a trop peu de réponses ici pour calculer un revenu médian.",
    vacantText: (vacant, homes, share, margin, city) =>
      `${formatNumber(vacant)} des ${formatNumber(homes)} logements d'ici, soit ${share} %${giveOrTake(margin, 'points')}${city === null ? '' : `, contre ${city} % dans l'ensemble de la ville`}.`,
    vacantTooFew: "Trop peu de logements dans l'enquête du recensement pour le dire.",
    whyEmpty: 'Pourquoi ils sont vides',
    whyRows: {
      vr: 'À louer',
      vs: 'À vendre',
      vn: 'Loués ou vendus, pas encore habités',
      vz: 'Pour un usage saisonnier ou occasionnel',
      vo: "Retirés du marché pour d'autres raisons, comme des réparations, des ennuis juridiques d'une famille ou l'abandon",
    },
    whyRow: (label, n, margin) => `${label} : ${formatNumber(n)}${giveOrTake(margin, 'homes')}`,
    legendArea: 'Une zone avec des signes que les prix montent',
    legendTap: "Touchez l'intérieur d'une zone, ou tout près de son bord, pour voir ses signes.",
    legendNote: "Des signes dans des registres publics, pas une prévision. Les fiches de verdissement, de jardin, de places assises et d'art dans ces zones ajoutent des moyens de protéger les voisins.",
    exportColumn: (signs) => `Zone de vigilance sur les déplacements d'habitants : ${signs}`,
    exportLine: (caution, links) => `À propos du verdissement dans les zones de vigilance sur les déplacements d'habitants : ${caution} Moyens de protéger les voisins : ${links}`,
    placemakingExportLine: (caution, links) =>
      `À propos des jardins, des places assises et de l'art dans les zones de vigilance sur les déplacements d'habitants : ${caution} Moyens de protéger les voisins : ${links}`,
    watchTitle: "Vigilance sur les déplacements",
  },

  evidence: {
    strong: { label: 'Preuves solides', meaning: 'Un essai randomisé, idéalement à Philadelphie, a constaté cet effet.' },
    moderate: {
      label: 'Preuves modérées',
      meaning: 'Des comparaisons avant et après, faites avec soin et avec des zones témoins, ont constaté cet effet.',
    },
    mixed: { label: 'Preuves partagées', meaning: "De bonnes études ne s'accordent pas, ou l'effet dépend du contexte." },
    weak: { label: 'Preuves faibles', meaning: "Seulement des enquêtes de perception ou des corrélations, ou une seule petite étude." },
    not_violence: {
      label: 'Sans lien avec la violence',
      meaning: "Utile pour d'autres raisons. Aucune affirmation n'est faite sur la violence.",
    },
    context: {
      label: 'Contexte',
      meaning: "Des informations de fond qui montrent où le soin peut aider le plus. Ce n'est pas une affirmation sur ce qui fonctionne.",
    },
  },

  legend: {
    parcelsFill: 'Couleur de remplissage : priorité selon votre mélange d\'angles',
    parcelsFillLens: (lens) => `Couleur de remplissage : priorité selon l'angle « ${lens.toLowerCase()} »`,
    parcelsSure: "Contour : notre degré de certitude que c'est vacant",
    sureHigh: 'Très probablement vacant',
    sureMedium: 'Probablement vacant',
    sureLow: 'Pas très sûr',
    parcelPoint: "Points : en dézoomant, un échantillon des parcelles vacantes ; de près, une parcelle sans forme sur la carte",
    parcelsListed: "N'affiche que les parcelles que les agences foncières de la Ville indiquent comme disponibles. Une parcelle que la carte ne dit pas vacante n'est pas dessinée ; la carte de la Land Bank elle-même les montre toutes.",
    selected: 'Lieu sélectionné',
    landcare: 'Terrain entretenu par PHS LandCare : déjà pris en charge',
    garden: 'Jardin ou ferme communautaire',
    hin: 'Rue du réseau High Injury Network',
    hexIntro: (window) => `Personnes blessées par balle, par hexagone, ${window.toLowerCase()}`,
    hexNone: 'Les hexagones sans aucune fusillade restent vides.',
    countBin: (lo, hi) =>
      hi === null ? `${formatNumber(lo)} ou plus` : lo === hi ? formatNumber(lo) : `${formatNumber(lo)} à ${formatNumber(hi)}`,
    segmentsFill: "Couleur de la ligne : score de sécurité de la rue selon votre mélange d'angles",
    segmentsShown: (min) =>
      min <= 1 ? 'Tous les tronçons avec un score supérieur à zéro sont affichés.' : `Les tronçons qui obtiennent ${formatNumber(min)} sur 100 ou plus sont affichés.`,
    segmentsZoom:
      "En dézoomant, seuls les tronçons où des dommages ont été enregistrés ou qui sont sur le réseau High Injury Network sont dessinés. Zoomez pour voir le reste.",
    crashSeverity: {
      3: "Quelqu'un a été tué",
      2: "Quelqu'un a été grièvement blessé",
      1: "Quelqu'un a été blessé",
      0: "Aucune personne blessée n'a été signalée",
    },
    crashesZoom: 'Zoomez pour voir les accidents où personne n\'a été gravement blessé.',
    crashesSource: 'D\'après les registres d\'accidents de PennDOT, qui arrivent environ un an après les accidents.',
    memorial: 'Une personne tuée à pied, à vélo ou en trottinette',
    memorialEveryone: 'Une personne tuée dans un accident de la route',
    memorialNames: "Un anneau plus plein signifie qu'une liste de mémoriaux publique partage le nom de la personne. Ouvrez le marqueur pour le lire.",
    memorialNamesWaiting: "Aucun nom n'est affiché pour le moment. Ils n'apparaîtront qu'une fois que les familles auront un moyen privé de demander qu'un nom soit retiré.",
    memorialNamesHidden: 'Les noms sont masqués.',
    stopShelter: "Un abribus, ou l'arrêt entier est sous un toit",
    stopBench: 'Un banc, mais aucun abribus sur la carte',
    stopNeither: 'Ni abribus ni banc',
    stopUnknown: "Pas encore relevé : OpenStreetMap ne le dit pas encore",
    stopSurvey: 'Comment relever un arrêt avec StreetComplete',
    stopsCoverage: "Seuls les arrêts que quelqu'un a ajoutés à OpenStreetMap apparaissent ici, donc beaucoup d'arrêts ne sont pas encore affichés.",
    stopSurveyRoute: 'Imprimer une feuille de relevé pour toute une ligne',
  },

  streets: {
    popupLabel: 'À propos de ce lieu sur la carte',
    detailsTitle: (style) =>
      style === 'memorials'
        ? 'Mémorial'
        : style === 'crashes'
          ? 'Accident'
          : style === 'street_segments'
            ? 'Tronçon de rue'
            : style === 'transit_stops'
              ? 'Arrêt'
              : style === 'transit_routes'
                ? 'Ligne'
                : style === 'stop_amenities'
                  ? 'Abribus et banc'
                  : style === 'city_trees'
                    ? 'Arbre'
                    : style === 'amenity'
                      ? 'Tel que cartographié dans OpenStreetMap'
                      : style === 'public_place'
                        ? 'Lieu'
                        : style === 'condition'
                          ? 'Signalé au 311'
                          : style === 'public_art'
                            ? 'Art public'
                            : style === 'traffic_stress'
                              ? 'Stress de la circulation pour les vélos'
                              : style === 'parking_reports'
                                ? 'Problèmes de stationnement signalés'
                                : style === 'city_shelters'
                                  ? 'Abribus'
                                  : style === 'street_poles'
                                    ? 'Poteau de rue'
                                    : style === 'traffic_calming'
                                      ? 'Modération de la circulation'
                                      : style === 'crossing_guards'
                                        ? 'Brigadier scolaire'
                                        : style === 'redlining'
                                          ? 'Carte du redlining de 1937'
                                          : 'Détails',
    memorialTitle: 'En mémoire',
    peopleHere: (n) => `${plural(n, { one: '# personne est commémorée', other: '# personnes sont commémorées' })} ici`,
    killed: {
      walk: 'Personne tuée à pied',
      bike: 'Personne tuée à vélo',
      scooter: 'Personne tuée en trottinette',
      motorcycle: 'Personne tuée à moto',
      other: 'Personne tuée dans un accident de la route',
    },
    killedOn: (what, date) => `${what} le ${date}.`,
    memorialSource: 'Lire le mémorial public',
    blessing: "Seulement avec la bénédiction de la famille.",
    families: 'Families for Safe Streets soutient les familles après un accident.',
    canDo: 'Ce que les voisins peuvent faire ici',
    firstStep: 'Première démarche',
    cost: (cost) => `Coût : ${cost}`,
    memorialsNearby: 'Mémoriaux à proximité',
    memorialsInView: "Mémoriaux à l'écran",
    memorialsIntro: "Chacun rend hommage à une personne tuée dans un accident de la route. Ouvrez-en un pour en savoir plus.",
    memorialCount: (n) => plural(n, { one: '# mémorial', other: '# mémoriaux' }),
    memorialsMore: (n) =>
      `${plural(n, { one: '# autre mémorial est', other: '# autres mémoriaux sont' })} à l'écran. Zoomez pour les lister ici.`,
    memorialsLayerOff: "Activez la couche Mémoriaux pour lister les mémoriaux à l'écran.",
    memorialsNone: 'Aucun mémorial dans cette partie de la carte.',
    blocksNearby: 'Tronçons de rue à proximité',
    blocksInView: "Tronçons de rue à l'écran",
    blocksIntro:
      "Chaque tronçon dessiné sur la carte, avec sa priorité de sécurité de la rue et sa raison principale. Ouvrez-en un pour lire pourquoi.",
    blockCount: (n) => plural(n, { one: '# tronçon', other: '# tronçons' }),
    blockNoScore: 'Pas de score de sécurité de la rue.',
    blocksMore: (n) =>
      `${plural(n, { one: '# autre tronçon est', other: '# autres tronçons sont' })} à l'écran. Zoomez pour les lister ici.`,
    blocksLayerOff: (layer) => `Activez la couche « ${layer} » pour lister les tronçons de rue à l'écran.`,
    blocksNone: "Aucun tronçon de rue n'est dessiné dans cette partie de la carte.",
    crashesNearby: 'Accidents à proximité',
    crashesInView: "Accidents à l'écran",
    crashesIntro: "D'après les registres d'accidents de PennDOT, tels que les paramètres de la couche des accidents les choisissent. Ouvrez-en un pour en savoir plus.",
    crashCount: (n) => plural(n, { one: '# accident', other: '# accidents' }),
    crashesMore: (n) =>
      `${plural(n, { one: '# autre accident est', other: '# autres accidents sont' })} à l'écran. Zoomez pour les lister ici.`,
    crashNear: (street) => `Près de ${street}`,
    crashesNone: "Aucun accident n'est dessiné dans cette partie de la carte.",
    removal: 'Demander le retrait',
    removalNote: (hasEmail) =>
      hasEmail
        ? "Toute personne peut nous demander de retirer ce mémorial, par e-mail privé. Nous le faisons sans demander pourquoi."
        : "Toute personne peut nous demander de retirer ce mémorial, sans donner de raison. Une adresse e-mail privée pour cela arrive bientôt ; en attendant, la page Contact explique comment faire la demande dans une issue GitHub, que tout le monde peut lire.",
    crashTitle: (year) => `Accident en ${year}`,
    crashesHere: (n) => `${plural(n, { one: '# accident', other: '# accidents' })} à cet endroit`,
    involved: 'Qui était impliqué',
    involvedModes: {
      walk: 'une personne à pied',
      bike: 'une personne à vélo',
      motorcycle: 'une personne à moto',
      scooter: 'une personne en trottinette',
    },
    involvedOthers: "des personnes dans des voitures ou d'autres véhicules",
    crashSource: "D'après les registres d'accidents de PennDOT.",
    segmentScore: (score, lens) => `${lens} : ${score} sur 100 selon votre mélange d'angles`,
    segmentNoScore: 'Pas de score de sécurité de la rue pour ce tronçon.',
    onHin: 'Sur le réseau High Injury Network',
    ksi: (n) =>
      `${plural(n, { one: '# personne tuée ou grièvement blessée', other: '# personnes tuées ou grièvement blessées' })} à pied ou à vélo sur ce tronçon ou à ses coins, dans les cinq dernières années des registres de PennDOT`,
    noKsi: "Aucune personne enregistrée comme tuée ou grièvement blessée à pied ou à vélo ici dans les cinq dernières années des registres de PennDOT",
    killed2: (n) => `${plural(n, { one: '# personne tuée', other: '# personnes tuées' })} ici dans les deux dernières années`,
    school: 'Une école à moins de 400 mètres',
  },

  streetsStops: {
    shelterLegend: "Un abribus de la liste de la Ville, en anneau autour de son arrêt",
    shelterLegendLens: "Un arrêt avec un abribus de la Ville compte comme abrité dans l'angle « confort aux arrêts ».",
    shelterLegendDate: "La Ville a modifié sa liste pour la dernière fois en janvier 2025, donc un abribus installé ou retiré depuis peut manquer.",
    shelterTitle: "Un abribus de la liste de la Ville",
    shelterAt: (stop) => `Il dessert l'arrêt SEPTA ${stop}.`,
    shelterListed: (number) => `La Ville le répertorie avec le numéro d'arrêt ${number}.`,
    shelterByNumber: "Associé à l'arrêt SEPTA grâce au numéro d'arrêt de la liste de la Ville.",
    shelterByPlace: "Associé à l'arrêt SEPTA le plus proche, à moins de 15 mètres : la liste de la Ville ne donne aucun numéro d'arrêt qui convienne.",
    shelterNoStop: "Nous n'avons trouvé aucun arrêt SEPTA qu'il dessert : il se trouve à plus de 15 mètres de chaque arrêt, ou son arrêt est fermé.",
    shelterDigital: 'Son panneau publicitaire est un écran numérique.',
    shelterLens: "L'arrêt qu'il dessert compte comme abrité dans l'angle « confort aux arrêts ».",
    shelterPartner: "La Ville installe et entretient ces abribus avec son partenaire publicitaire, et c'est la publicité qui les finance.",
    shelterSource: "D'après la liste des abribus de la Ville (Office of Transportation and Infrastructure Systems).",
    sheltersHere: (n) => `${plural(n, { one: '# abribus', other: '# abribus' })} à cet endroit`,

    poleLed: 'Une lampe LED répertoriée par la Ville',
    poleOther: 'Une ancienne lampe au sodium haute pression',
    poleUnknown: "Une lampe d'un type que la Ville ne précise pas",
    poleNone: 'Un poteau sans lampe répertoriée, comme un poteau de feux de circulation ou de service public',
    polesNote: "Les lampes que la Ville répertorie, pas si une lampe fonctionne ce soir. Signalez une lumière éteinte à Philly311.",
    polesZoom: 'Zoomez sur quelques rues pour voir les poteaux.',
    poleTitle: (number) => (number ? `Poteau de rue ${number}` : 'Un poteau de rue sans numéro répertorié'),
    poleKind: {
      0: 'La Ville ne répertorie aucune lampe sur ce poteau.',
      1: 'La Ville répertorie une lampe LED sur ce poteau.',
      2: 'La Ville répertorie une ancienne lampe au sodium haute pression sur ce poteau.',
      3: 'La Ville répertorie une lampe sur ce poteau, mais pas son type.',
    },
    poleOwner: {
      1: 'Le Streets Department de la Ville est propriétaire du poteau.',
      2: 'PECO est propriétaire du poteau.',
      3: 'PennDOT est propriétaire du poteau.',
      4: "Quelqu'un d'autre que la Ville, PECO ou PennDOT est propriétaire du poteau.",
    },
    poleReport: (number) => `Si une lumière est éteinte ici, indiquez à Philly311 le numéro du poteau : ${number}.`,
    poleReportNoNumber: 'Si une lumière est éteinte ici, dites à Philly311 où elle se trouve.',
    polesHere: (n) => `${plural(n, { one: '# poteau', other: '# poteaux' })} à cet endroit`,
    poleSource: "D'après la liste des poteaux de rue du Streets Department (le service des rues de la Ville), actualisée chaque semaine.",

    calmingLegend: "Un coussin ralentisseur, un dos d'âne ou un plateau",
    calmingLegendNote: 'Les voisins peuvent demander à la Ville des aménagements de modération de la circulation dans une rue résidentielle.',
    zoomStreets: 'Zoomez sur quelques quartiers pour les voir.',
    calmingTitle: 'Modération de la circulation',
    calmingWhat: "Un coussin ralentisseur, un dos d'âne ou un plateau que le Streets Department répertorie, pour ralentir les conducteurs.",
    calmingOn: (street) => `Sur ${street}`,
    calmingSince: (date) => `Il a été installé le ${date}.`,
    calmingHere: (n) => `${plural(n, { one: '# dispositif', other: '# dispositifs' })} à cet endroit`,
    calmingSource: "D'après la liste des dispositifs de modération de la circulation du Streets Department.",

    guardLegend: 'Un coin de rue où la Ville place un brigadier scolaire',
    guardLegendNote: "Les brigadiers scolaires aident les enfants et tout le monde à traverser près des écoles au début et à la fin de la journée d'école.",
    guardTitle: 'Brigadier scolaire',
    guardHere: 'La Ville place un brigadier scolaire à ce coin de rue.',
    guardSchool: (school) => `L'école la plus proche de la liste de la Ville, à moins de 400 mètres : ${school}.`,
    guardWhat: "Les brigadiers scolaires aident les enfants et tout le monde à traverser en sécurité près des écoles au début et à la fin de la journée d'école.",
    guardsHere: (n) => `${plural(n, { one: '# poste', other: '# postes' })} à cet endroit`,
    guardSource: "D'après la liste des emplacements de brigadiers scolaires de la Ville.",

    blockPoles: (poles, lamps, led) =>
      lamps === 0
        ? `La Ville répertorie ${plural(poles, { one: '# poteau', other: '# poteaux' })} le long de ce tronçon, sans aucune lampe répertoriée sur ${poles === 1 ? 'lui' : 'eux'}.`
        : `La Ville répertorie ${plural(poles, { one: '# poteau', other: '# poteaux' })} le long de ce tronçon, dont ${formatNumber(lamps)} avec une lampe, ${led === lamps ? (lamps === 1 ? 'de type LED' : 'toutes de type LED') : `${formatNumber(led)} de type LED`}.`,
    blockNoPoles: 'La Ville ne répertorie aucun poteau de rue le long de ce tronçon.',
    blockCalming: (n, year) =>
      year
        ? `Modération de la circulation ici depuis ${year} : la Ville répertorie ${plural(n, { one: "# coussin ralentisseur, dos d'âne ou plateau", other: "# coussins ralentisseurs, dos d'âne ou plateaux" })} sur ce tronçon.`
        : `La Ville répertorie ${plural(n, { one: "# coussin ralentisseur, dos d'âne ou plateau", other: "# coussins ralentisseurs, dos d'âne ou plateaux" })} sur ce tronçon.`,
    blockNoCalming: 'Aucune modération de la circulation enregistrée ici pour le moment.',
    blockArterial:
      "Les coussins ralentisseurs de la Ville sont pour les rues résidentielles. Dans une rue comme celle-ci, interrogez l'Office of Transportation and Infrastructure Systems de la Ville sur d'autres changements.",
    memorialCalming: (n, year) =>
      year
        ? `Modération de la circulation sur ce tronçon depuis ${year} : la Ville répertorie ${plural(n, { one: '# dispositif', other: '# dispositifs' })}.`
        : `La Ville répertorie ${plural(n, { one: '# dispositif de modération de la circulation', other: '# dispositifs de modération de la circulation' })} sur ce tronçon.`,
    memorialNoCalming: 'Aucune modération de la circulation enregistrée sur ce tronçon pour le moment.',
    lightsPoles: (poles, lamps, led) =>
      lamps === 0
        ? `La Ville répertorie ${plural(poles, { one: '# poteau', other: '# poteaux' })} le long de ce tronçon, sans aucune lampe répertoriée.`
        : `Le long de ce tronçon, la Ville répertorie ${plural(lamps, { one: '# poteau', other: '# poteaux' })} avec une lampe, ${led === lamps ? (lamps === 1 ? 'de type LED' : 'tous de type LED') : `${formatNumber(led)} de type LED`}. Activez « Poteaux de rue et lampes répertoriées par la Ville » et zoomez pour trouver le numéro de chaque poteau.`,
    stopLamps: (lamps, led) =>
      lamps === 0
        ? 'La Ville ne répertorie aucun poteau avec une lampe à moins de 30 mètres de cet arrêt.'
        : `La Ville répertorie ${plural(lamps, { one: '# poteau', other: '# poteaux' })} avec une lampe à moins de 30 mètres de cet arrêt, ${led === lamps ? (lamps === 1 ? 'de type LED' : 'tous de type LED') : `${formatNumber(led)} de type LED`}.`,
    cityShelter: (n) => (n === 1 ? "La liste des abribus de la Ville indique un abribus ici." : `La liste des abribus de la Ville indique ${formatNumber(n)} abribus ici.`),
    noCityShelter: "Pas d'abribus ici dans la liste des abribus de la Ville, qui contient les abribus qu'elle gère avec son partenaire publicitaire.",
    disagree:
      "La liste de la Ville indique un abribus ici, mais OpenStreetMap dit qu'il n'y en a pas. L'une des deux peut être périmée : un relevé sur place tranche. D'ici là, la priorité compte l'abribus de la Ville.",
    cityShelterLens: "La priorité compte l'abribus de la Ville.",
    answerCityShelter: "Pas encore relevé dans OpenStreetMap, mais dans la liste de la Ville",
  },

  parking: {
    kinds: {
      all: 'Véhicules qui bloquent le passage',
      sidewalk: 'Sur un trottoir',
      bike_lane: 'Dans une piste cyclable',
      crosswalk: 'Sur un passage piéton',
      corner: 'Sur un coin de rue',
      ramp: 'Bloquant une rampe de trottoir',
    },
    window: (start, end) => `De ${start} à ${end}`,
    windowUnknown: 'Sur 12 mois',
    heatTitle: (window) => `En dézoomant : où les signalements se regroupent. ${window}.`,
    fewer: 'Moins de signalements',
    more: 'Plus de signalements',
    binsTitle: "De près : les signalements dans chaque zone d'environ une rue de large",
    bins: (low, high) => (high === null ? `${formatNumber(low)} ou plus` : `${formatNumber(low)} à ${formatNumber(high)}`),
    threshold: (min) => `Les zones avec moins de ${min} signalements sont laissées de côté, afin qu'aucun signalement isolé n'apparaisse. Zoomez et touchez une zone pour voir ses chiffres.`,
    oneApp: "Là où des personnes qui utilisent une seule application, Laser Vision de Philly Bike Action, ont signalé des véhicules qui gênaient le passage. Tous les problèmes ne sont pas signalés.",
    title: "Cette zone, d'environ une rue de large",
    summary: (n, window) => `${plural(n, { one: '# signalement', other: '# signalements' })} de véhicules qui bloquent le passage. ${window}.`,
    count: (n) => formatNumber(n),
    fewerThan: (min) => `moins de ${min}`,
    byKind: 'Par type',
    meaning:
      "Ce sont des signalements de personnes qui utilisent une seule application ; ils montrent donc où ces personnes ont remarqué des véhicules qui gênaient, pas tous les problèmes. Un type avec moins de 5 signalements ici n'est pas donné en chiffre, afin qu'aucun signalement isolé n'apparaisse.",
    fixes:
      "Beaucoup de signalements au même endroit sont une preuve en faveur d'aménagements physiques : avancées de trottoir, bornes, angles dégagés, pistes cyclables protégées et zones de livraison.",
    askCity: 'Interroger la Ville sur un aménagement',
    source: "D'après la carte Laser Vision de Philly Bike Action",
    refreshed: 'Recomptés chaque semaine, avec la permission de Philly Bike Action.',
  },

  transit: {
    waitTitle: 'Fréquence des bus ou des trains en milieu de journée en semaine',
    waitBins: [
      'Toutes les 10 minutes ou mieux',
      'Toutes les 11 à 15 minutes',
      'Toutes les 16 à 30 minutes',
      'Toutes les 31 à 60 minutes',
      "Moins d'une fois par heure",
    ],
    noMidday: 'Aucun service de 10 h à 14 h en semaine',
    boardingsTitle: 'Personnes qui montent ici un jour de semaine moyen',
    boardingBins: ['1 000 ou plus', '200 à 999', '50 à 199', '10 à 49', 'Moins de 10'],
    noCount: 'Pas de comptage de la SEPTA pour cet arrêt',
    boardingsNote: "D'après les comptages de la SEPTA elle-même, qui ont une saison ou deux de retard sur les horaires.",
    station: "Station de métro, d'El (métro aérien) ou de Regional Rail (train régional)",
    zoomNote: 'Zoomez sur quelques quartiers pour voir les arrêts.',
    lensTitle: "Priorité selon l'angle « confort aux arrêts »",
    lensUnsurveyed: "Là où personne n'a encore relevé un arrêt, son abribus et son banc comptent à moitié.",
    lensCityShelter: "Un arrêt avec un abribus de la liste de la Ville compte comme abrité.",
    lensStations: "L'angle ne note que les arrêts de bus et de tramway, donc les stations sont creuses.",
    lensTunnel: "Les arrêts de tramway du tunnel sous Center City et University City sont creux aussi : l'angle les laisse de côté, comme les stations.",
    findTitle: 'Ce que trouvent les usagers ici',
    notInOsm: "Nous n'avons pas encore trouvé d'arrêt correspondant dans OpenStreetMap, donc personne n'a noté s'il a un abribus ou un banc.",
    matchedByNumber: "Associé à l'arrêt OpenStreetMap qui a le même numéro d'arrêt, au même endroit.",
    matchedByPlace: "Associé à l'arrêt OpenStreetMap au même endroit, à moins de 15 mètres.",
    halfway: 'Les réponses « pas encore relevé » comptent à moitié (50 sur 100) dans le score jusqu\'à ce que quelqu\'un les note.',
    canopy: (percent) =>
      `Les arbres couvrent environ ${formatNumber(percent)} % du terrain autour de l'arrêt, dans une zone d'environ deux rues de large (relevé du couvert arboré de la Ville, 2018).`,
    onHin: "L'arrêt se trouve sur le réseau High Injury Network, les rues où se produisent la plupart des décès et des blessures graves de la circulation à Philadelphie.",
    noScore: "L'angle « confort aux arrêts » ne note que les arrêts de bus et de tramway.",
    tunnelStation: "Cet arrêt de tramway est souterrain, dans le tunnel, donc l'angle « confort aux arrêts » le laisse de côté, comme les stations de métro et de train.",
    answersLoading: 'Chargement de ce que dit OpenStreetMap à cet arrêt.',
    answersUnavailable: "Ce que dit OpenStreetMap à cet arrêt n'a pas pu être chargé pour le moment, donc son abribus et son banc comptent comme pas encore relevés.",
    canDo: 'Ce que les voisins peuvent faire ici',
    routeDetails: 'Étapes, contacts et liens',
    surveyGuide: 'Comment relever un arrêt avec StreetComplete',
    osmSource: "Abribus, banc et éclairage d'après OpenStreetMap, © OpenStreetMap contributors, mis à jour chaque semaine.",
    routeBus: 'Ligne de bus',
    routeTrolley: 'Ligne de tramway',
    routeMetro: 'Métro ou El',
    routeRail: 'Regional Rail',
    allRoutes: 'Là où plusieurs lignes partagent une rue, leurs tracés se superposent.',
    frequentRoutes: 'Seulement les lignes avec un bus ou un train toutes les 15 minutes ou mieux en milieu de journée en semaine.',
    detailsTitle: 'Arrêt',
    stationName: (name) => `Station ${name}`,
    stopsHere: (n) => `${plural(n, { one: '# arrêt', other: '# arrêts' })} à cet endroit`,
    kinds: {
      bus: 'Arrêt de bus',
      trolley: 'Arrêt de tramway',
      busTrolley: 'Arrêt de bus et de tramway',
      metro: "Station de métro ou d'El",
      rail: 'Station de Regional Rail',
    },
    vehicles: { bus: 'bus', trolley: 'tramway', busTrolley: 'bus ou tramway', train: 'train' },
    vehiclesMany: { bus: 'bus', trolley: 'tramways', busTrolley: 'bus ou tramways', train: 'trains' },
    routes: (list) => `Lignes : ${list}.`,
    route: (name) => `Ligne ${name}.`,
    howOften: 'Fréquence',
    every: (vehicle, minutes) =>
      minutes <= 1 ? `un ${vehicle} environ chaque minute` : `un ${vehicle} environ toutes les ${formatNumber(minutes)} minutes`,
    only: (one, many, n) => (n === 1 ? `un seul ${one}` : `seulement ${formatNumber(n)} ${many}`),
    peak: (text) => `En semaine, le matin de 7 h à 9 h : ${text}.`,
    midday: (day, text) => `${day} de 10 h à 14 h : ${text}.`,
    noService: (day) => `${day} de 10 h à 14 h : aucun.`,
    days: { wk: 'En semaine', sa: 'Le samedi', su: 'Le dimanche' },
    trips: (wk, sa, su) =>
      `${plural(wk, { one: '# départ', other: '# départs' })} un jour de semaine typique, ${formatNumber(sa)} le samedi et ${formatNumber(su)} le dimanche.`,
    busiest: (n) => `Heure la plus chargée en semaine : ${plural(n, { one: '# départ', other: '# départs' })}.`,
    firstLast: (first, last) => `En semaine, le premier part à ${first} et le dernier à ${last}.`,
    afterMidnight: (time) => `${time} après minuit`,
    allNight: 'Le service fonctionne toute la nuit en semaine.',
    evening: (n) =>
      n === 0 ? 'Aucun départ après 20 h en semaine.' : `Après 20 h en semaine : ${plural(n, { one: '# départ', other: '# départs' })}.`,
    noWeekday: 'Pas de service en semaine.',
    riders: 'Usagers',
    boardings: (n, period) =>
      n === 0
        ? `Presque personne ne monte ici un jour de semaine moyen (comptage de la SEPTA, ${period}).`
        : `Environ ${plural(n, { one: '# personne monte', other: '# personnes montent' })} ici un jour de semaine moyen (comptage de la SEPTA, ${period}).`,
    countedAt: (id) => `Compté à l'arrêt SEPTA ${id}, que cet arrêt a remplacé.`,
    noBoardings: "La SEPTA n'a pas encore de comptage pour cet arrêt. Les arrêts nouveaux ou renumérotés en reçoivent un quand la SEPTA publie son prochain comptage.",
    noStationCounts: "La SEPTA ne publie pas de comptage pour chaque quai de métro ou d'El.",
    noRailCounts: "La SEPTA compte les usagers de Regional Rail par station une fois par an ; cette carte n'affiche pas encore ces comptages.",
    stopNumber: (id) => `Numéro d'arrêt SEPTA ${id}.`,
    formerNumbers: (ids) => `Avant cela, c'était l'arrêt SEPTA ${ids}.`,
    wheelchair: {
      1: 'La SEPTA indique que cet arrêt est accessible en fauteuil roulant.',
      2: "La SEPTA indique que cet arrêt n'est pas accessible en fauteuil roulant.",
    },
    source: "D'après les horaires de la SEPTA pour une semaine typique. Les attentes sont des moyennes : les bus se regroupent et les écarts s'allongent.",
  },

  stopAmenities: {
    unnamed: 'Un arrêt sans nom dans OpenStreetMap',
    number: (ref) => `Arrêt numéro ${ref}`,
    served: { 1: 'Arrêt de bus', 2: 'Arrêt de tramway', 3: 'Arrêt de bus et de tramway' },
    comfort: {
      3: "Un abribus, ou l'arrêt entier est sous un toit",
      2: 'Un banc, mais aucun abribus sur la carte',
      1: 'Ni abribus ni banc',
      0: 'Pas encore relevé',
    },
    factsTitle: 'Ce que dit OpenStreetMap',
    answers: {
      sh: 'Abribus',
      bn: 'Banc',
      bi: 'Poubelle',
      lt: 'Éclairé la nuit',
      tp: 'Dalles podotactiles pour les personnes aveugles',
      wc: 'Accès en fauteuil roulant',
      db: 'Panneau des départs',
      cv: "Arrêt entier sous un toit",
    },
    yes: 'Oui',
    no: 'Non',
    limited: 'Limité',
    unknown: 'Pas encore relevé',
    nearby: "cartographié à part à côté de l'arrêt",
    unknownNote: "Pas encore relevé veut dire que personne ne l'a encore noté. Cela ne veut pas dire que l'arrêt n'a rien.",
    survey: 'Comment relever cet arrêt avec StreetComplete',
    openOsm: 'Voir cet arrêt sur OpenStreetMap',
    surveyRoute: 'Relever toute une ligne avec une feuille imprimable',
    source: "D'après OpenStreetMap, © OpenStreetMap contributors, mis à jour chaque semaine.",
  },

  heat: {
    tractsTitle: {
      vulnerability: 'Vulnérabilité à la chaleur : la chaleur et les personnes à risque, par secteur de recensement',
      exposure: "Exposition à la chaleur : à quel point chaque secteur de recensement devient chaud l'été",
      sensitivity: 'Sensibilité à la chaleur : combien de personnes de chaque secteur de recensement sont à risque par forte chaleur',
    },
    fifths: {
      vulnerability: ['Cinquième de secteurs le moins vulnérable', 'Moins vulnérable', 'Cinquième du milieu', 'Plus vulnérable', 'Cinquième le plus vulnérable'],
      exposure: ['Cinquième de secteurs le plus frais', 'Plus frais', 'Cinquième du milieu', 'Plus chaud', 'Cinquième le plus chaud'],
      sensitivity: ['Cinquième avec le moins de personnes à risque', 'Moins', 'Cinquième du milieu', 'Plus', 'Cinquième avec le plus de personnes à risque'],
    },
    priority: 'Contour : secteurs que la Ville classe très haut en vulnérabilité à la chaleur',
    tractsNone: "Les secteurs que l'indice ne couvre pas, comme les grands parcs et l'aéroport, restent vides.",
    tractsSource:
      "D'après l'indice de vulnérabilité à la chaleur de la Ville (Heat Vulnerability Index, Department of Public Health et Office of Sustainability), données de 2017 à 2019.",
    treeBig: 'Un arbre de la Ville : plus le point est gros, plus son tronc est large',
    treeSmall: "Un petit arbre, souvent un jeune arbre qu'il faut arroser",
    treesZoom: 'Zoomez sur quelques rues pour voir les arbres.',
    treesYards: "Les arbres des cours privées ne sont pas dans l'inventaire de la Ville, donc une rue peut être plus ombragée qu'elle ne le paraît ici.",
    floodHigh: 'La zone inondable à 1 pour cent de chance par an : une inondation a au moins 1 chance sur 100 chaque année',
    floodway: "Le lit d'écoulement (floodway) : le chenal gardé libre pour que les crues puissent passer",
    floodModerate: 'La zone à 0,2 pour cent de chance par an : 1 chance sur 500 chaque année',
    floodCare:
      "Une raison de faire attention, jamais une part d'un score : les plantes y doivent supporter un sol détrempé, et tout ce qui est construit suit les règles de la Ville sur les zones inondables.",
    treeUnnamed: "Un arbre que l'inventaire ne nomme pas",
    treeTrunk: (inches) => `Son tronc fait environ ${formatNumber(inches)} pouces de diamètre à hauteur de poitrine.`,
    treeNoTrunk: "L'inventaire ne donne pas la taille de son tronc.",
    treeYoung: "Un jeune arbre a besoin d'environ 20 gallons d'eau (environ 75 litres) par semaine de mars à décembre, selon TreePhilly.",
    treesHere: (n) => `${plural(n, { one: '# arbre', other: '# arbres' })} à cet endroit`,
    treeSource: "D'après l'inventaire des arbres de Parks and Recreation, les arbres que la Ville entretient dans ses rues et ses parcs.",
  },

  art: {
    legend: {
      mural: 'Fresques et peintures murales',
      sculpture: 'Sculptures et statues',
      mosaic: 'Mosaïques',
      other: 'Autres types : installations, fontaines, monuments et plus',
    },
    allOff: "Tous les types d'art sont désactivés dans les paramètres de cette couche.",
    insideHidden: "Les œuvres à l'intérieur des bâtiments sont masquées.",
    memorialNote: "Les œuvres qui rendent hommage à quelqu'un sont montrées sans noms.",
    coverage:
      "D'après la liste Percent for Art de la Ville, OpenStreetMap et Wikidata. Beaucoup de fresques n'y figurent pas encore ; Mural Arts Philadelphia tient la plus grande liste sur son propre site.",
    kinds: {
      0: "Une œuvre d'art public",
      1: 'Une fresque',
      2: 'Une peinture',
      3: "Un art de rue",
      4: 'Une mosaïque',
      5: 'Une sculpture',
      6: 'Une statue',
      7: 'Un buste',
      8: 'Un relief',
      9: 'Une installation',
      10: 'Une fontaine',
      11: 'Un monument',
      12: 'Un mémorial',
      13: 'Un vitrail',
      14: 'Une plaque',
    },
    untitled: "Aucun titre n'est enregistré.",
    by: (artist) => `Par ${artist}.`,
    made: (year) => `Année de création : ${year}.`,
    medium: (medium) => `Matériau : ${medium}.`,
    where: (place) => `Emplacement : ${place}.`,
    inside: "À l'intérieur d'un bâtiment, donc visible seulement quand le bâtiment est ouvert.",
    memorialTitle: 'Œuvre commémorative',
    memorialText:
      "Cette œuvre rend hommage à quelqu'un. Placekeepers n'affiche aucun nom sur les mémoriaux ; les sources ci-dessous en disent plus.",
    worksHere: (n) => `${plural(n, { one: "# œuvre d'art", other: "# œuvres d'art" })} à cet endroit`,
    sourcesTitle: 'Sources',
    cityRecord: 'La fiche de la Ville sur cette œuvre (PDF)',
    cityList: 'La liste Percent for Art de la Ville',
    openOsm: 'Voir sur OpenStreetMap',
    openWikidata: 'Voir sur Wikidata',
    openWikipedia: 'En lire plus sur Wikipédia',
    website: (site) => `En savoir plus sur ${site}`,
    siteNames: {
      'associationforpublicart.org': "le site de l'Association for Public Art",
      'muralarts.org': 'le site de Mural Arts Philadelphia',
      'philart.net': 'philart.net',
    },
    muralArts: 'Chercher dans la propre liste de fresques de Mural Arts Philadelphia',
    fix: 'Quelque chose manque ou est faux ? Ajoutez-le ou corrigez-le sur OpenStreetMap ; les changements arrivent sur cette carte en environ une semaine.',
    fixLink: 'Modifier sur OpenStreetMap',
    credit: "Art public de la Ville de Philadelphie, d'OpenStreetMap (© OpenStreetMap contributors) et de Wikidata.",
  },

  survey: {
    pageTitle: 'Relever une ligne',
    intro:
      "Choisissez une ligne de bus ou de tramway de la SEPTA et une direction pour obtenir une feuille de relevé : ses arrêts à Philadelphie dans l'ordre, ce qu'OpenStreetMap montre à chacun maintenant, et des cases à remplir. Imprimez-la, ou cochez les cases sur votre téléphone au fur et à mesure.",
    guideLink: 'Comment relever les arrêts de bus',
    loading: 'Chargement des lignes…',
    loadFailed: "La liste des lignes n'a pas pu être chargée. Vérifiez votre connexion et réessayez.",
    notPublished: 'Les feuilles de relevé ne sont pas encore publiées. Elles apparaissent après la prochaine mise à jour hebdomadaire.',
    sheetFailed: "La feuille de cette ligne n'a pas pu être chargée. Vérifiez votre connexion et réessayez.",
    retry: 'Réessayer',
    routeLabel: 'Ligne',
    routePlaceholder: 'Choisissez une ligne',
    buses: 'Lignes de bus',
    trolleys: 'Lignes de tramway',
    directionLabel: 'Direction',
    partsLabel: 'À partager entre',
    partsChoice: (n) => (n === 1 ? 'une personne ou un duo' : `${n} personnes ou duos`),
    directionTo: (dir, to) => `${dir} vers ${to}`,
    towards: (to) => `Vers ${to}`,
    directionNumber: (n) => `Direction ${n}`,
    stopCount: (n) => plural(n, { one: '# arrêt', other: '# arrêts' }),
    title: (route, direction) => `Ligne ${route}, ${direction}`,
    summary: (stops, miles) =>
      `${plural(stops, { one: '# arrêt', other: '# arrêts' })} à Philadelphie, ${miles} du premier au dernier en ligne droite.`,
    outside: (n) =>
      `${plural(n, { one: "# autre arrêt est en dehors de Philadelphie et n'est pas sur cette feuille", other: "# autres arrêts sont en dehors de Philadelphie et ne sont pas sur cette feuille" })}.`,
    answersMissing:
      "Ce que dit OpenStreetMap à ces arrêts n'a pas pu être chargé pour le moment, donc les arrêts qu'il connaît apparaissent comme pas encore relevés.",
    statusTitle: "Ce qu'OpenStreetMap montre maintenant",
    status: {
      shelter: 'Abribus',
      bench: 'Banc seulement',
      neither: "Ni l'un ni l'autre",
      unsurveyed: 'Pas encore relevé',
      missing: 'Introuvable dans OpenStreetMap',
    },
    statusLong: {
      shelter: 'avec un abribus ou un toit',
      bench: 'avec un banc mais aucun abribus sur la carte',
      neither: "avec ni l'un ni l'autre",
      unsurveyed: 'dans OpenStreetMap mais pas encore relevé',
      missing: 'introuvable dans OpenStreetMap',
    },
    estimateTitle: 'Combien de temps cela prend',
    estimate: (time) => `Notre estimation : ${time} pour une personne ou un duo.`,
    estimateBasis:
      "C'est notre propre estimation, pas une mesure : en marchant à environ 3 miles à l'heure d'un arrêt à l'autre, et environ une minute à chaque arrêt. Pour aller au premier arrêt et rentrer chez vous, il faut compter en plus.",
    trolleyTunnel:
      "Les lignes de tramway T1 à T5 passent sous terre à leur extrémité de Center City, dans un tunnel avec des stations de la 13th Street à la 37th Street. Laissez ces stations de côté : ce relevé concerne les arrêts dans la rue.",
    asOf: (osm, schedules) =>
      [osm ? `Ce que montre OpenStreetMap date du ${osm}.` : null, schedules ? `Arrêts d'après les horaires de la SEPTA (${schedules}).` : null]
        .filter(Boolean)
        .join(' '),
    print: 'Imprimer la feuille',
    printAll: 'Imprimer toutes les parties',
    printPart: (n) => `Imprimer seulement la partie ${n}`,
    part: (n, of) => `Partie ${n} sur ${of}`,
    partStops: (first, last) => (first === last ? `arrêt ${first}` : `arrêts ${first} à ${last}`),
    partEstimate: (time, miles) => `Notre estimation : ${time} (${miles} de marche).`,
    sheetFor: (route, direction) => `Feuille de relevé : ligne ${route}, ${direction}`,
    howToFill:
      "Cochez O (oui) ou N (non) pour chaque chose que vous trouvez à l'arrêt. « Éclairé » veut dire qu'une lumière éclaire l'arrêt la nuit : une lampe dans l'abribus ou un lampadaire juste à côté. « À réparer » veut dire un abribus, un banc, un panneau ou une poubelle cassé. Si vous ne pouvez pas savoir, laissez la case vide : ne devinez jamais, s'il vous plaît.",
    nameLine: 'Nom :',
    dateLine: 'Date :',
    columns: {
      number: '#',
      stop: 'Arrêt',
      now: 'OpenStreetMap maintenant',
      sh: 'Abribus',
      bn: 'Banc',
      bi: 'Poubelle',
      lt: 'Éclairé',
      rp: 'À réparer',
      nt: 'Notes',
    },
    yes: 'Oui',
    no: 'Non',
    yesShort: 'O',
    noShort: 'N',
    stopNumber: (sid) => `Arrêt SEPTA ${sid}`,
    answerLabel: (n, name, question, answer) => `Arrêt ${n}, ${name} : ${question}, ${answer}`,
    repairLabel: (n, name) => `Arrêt ${n}, ${name} : à réparer`,
    notesLabel: (n, name) => `Arrêt ${n}, ${name} : notes`,
    openOsm: 'Voir sur OpenStreetMap',
    editOsm: 'Modifier',
    answered: (n, of) => `Sur cet appareil, vous avez rempli ${plural(n, { one: '# arrêt', other: '# arrêts' })} sur ${formatNumber(of)}.`,
    kept: "Ce que vous cochez et saisissez ici reste dans ce navigateur, sur cet appareil seulement. Rien n'est envoyé nulle part.",
    notKept: "Ce navigateur ne conserve pas ce que vous cochez, donc cela sera perdu si vous quittez la page. Imprimez la feuille ou notez-le.",
    clear: "Effacer ce que j'ai rempli",
    clearConfirm: 'Effacer chaque case et chaque note que vous avez remplies pour cette direction ?',
    safetyTitle: 'Avant de partir : restez en sécurité',
    safety: [
      "Restez sur le trottoir. Ne vous tenez jamais dans la rue et n'entrez jamais dans une voie de bus pour regarder un arrêt.",
      'Allez-y de jour, et avec une autre personne.',
      'Arrêtez-vous de marcher avant de regarder cette feuille ou votre téléphone, et levez les yeux avant de traverser.',
      'Écartez-vous pour que les usagers puissent attendre et monter. Ne photographiez pas les gens.',
    ],
    answersTitle: 'Envoyer vos réponses dans OpenStreetMap',
    withApp:
      "Avec l'application StreetComplete : répondez à ses questions sur chaque arrêt pendant que vous y êtes. Vos réponses vont directement dans OpenStreetMap.",
    withoutApp: "Sans application sur téléphone, sur un ordinateur une fois rentré chez vous, utilisez l'éditeur d'OpenStreetMap :",
    editorSteps: [
      'Connectez-vous sur openstreetmap.org. Un compte est gratuit.',
      "Rouvrez cette page et utilisez le lien Modifier à côté de chaque arrêt. L'éditeur s'ouvre avec l'arrêt sélectionné.",
      "Dans le panneau de gauche, cliquez sur la case Shelter (abribus). Sous « Add field: », ajoutez Bench (banc), Waste Bin (la poubelle) et Lit (éclairé), et cliquez aussi sur leurs cases. Chaque case change à chaque clic : Yes (oui), puis No (non), puis retour à Unknown (inconnu). L'éditeur peut afficher ces mots en français.",
      "Cliquez sur Save, écrivez une courte note sur ce que vous avez fait, par exemple « Relevé des abribus et des bancs d'arrêts de bus », puis cliquez sur Upload.",
    ],
    notFound:
      "Là où la feuille dit « Introuvable dans OpenStreetMap », regardez d'abord de près autour de l'arrêt dans l'éditeur : il peut être dessiné à quelques pas. S'il manque vraiment, cliquez sur Point, placez le point sur le trottoir à côté du panneau de l'arrêt, et choisissez Bus Stop (arrêt de bus).",
    repairNote:
      "OpenStreetMap n'enregistre pas les dégâts, donc « À réparer » et vos notes restent avec votre groupe. Elles aident quand vous parlez d'un arrêt avec la SEPTA ou la Ville.",
    updates: 'Placekeepers lit OpenStreetMap chaque lundi, donc vos réponses arrivent sur notre carte et ces feuilles en environ une semaine.',
    printedFrom: 'Imprimé depuis Placekeepers, une carte gratuite pour les voisins de Philadelphie. Arrêts de la SEPTA ; données de la carte © OpenStreetMap contributors.',
    routeTitle: (route) => `Ligne ${route}`,
    routesHere: (n) => `${plural(n, { one: '# ligne', other: '# lignes' })} ici`,
    surveyThisRoute: 'Relever les arrêts de cette ligne pour les abribus et les bancs',
  },

  amenities: {
    legend: {
      benches: 'Un banc',
      picnic_tables: 'Une table de pique-nique',
      drinking_water: "De l'eau potable",
      toilets: 'Des toilettes publiques',
      bookcases: 'Une boîte à livres (Little Free Library)',
    },
    mappedNote: "Seul ce que des personnes ont ajouté à OpenStreetMap apparaît ici, donc beaucoup manquent.",
    addMissing: 'Comment ajouter ce qui manque',
    titles: {
      benches: 'Banc',
      picnic_tables: 'Table de pique-nique',
      drinking_water: 'Eau potable',
      toilets: 'Toilettes publiques',
      bookcases: 'Boîte à livres (Little Free Library)',
    },
    facts: {
      br: ['A un dossier', 'Pas de dossier'],
      cv: ['Sous un toit', 'Pas sous un toit'],
      bt: ['On peut y remplir une bouteille', 'Pas pour remplir une bouteille'],
      sn: ["Seulement une partie de l'année", "Toute l'année"],
      in: ["À l'intérieur", "À l'extérieur"],
      fee: ['Payant', 'Gratuit'],
      ct: ['A une table à langer', 'Pas de table à langer'],
    },
    access: { 1: "Ouvert à tout le monde", 2: 'Réservé aux clients' },
    wheelchair: {
      1: 'Accessible en fauteuil roulant',
      0: 'Non accessible en fauteuil roulant',
      2: 'Accès limité en fauteuil roulant',
    },
    hours: (text) => `Horaires d'ouverture tels que cartographiés : ${text}`,
    nothingMore: "OpenStreetMap n'en dit pas plus pour le moment.",
    unknownNote: "Ce qui n'est pas indiqué n'est pas encore connu. Cela ne veut pas dire que la réponse est non.",
    openOsm: 'Voir sur OpenStreetMap',
    fix: 'Manquant ou faux ? Comment le corriger',
    source: 'Tel que cartographié dans OpenStreetMap, © OpenStreetMap contributors, mis à jour chaque semaine.',
  },

  places: {
    legend: {
      park_water: 'Une fontaine à boire dans un parc',
      libraries: 'Une bibliothèque de la Free Library',
      recreation_centers: 'Un centre de loisirs',
      playgrounds: 'Une aire de jeux',
    },
    poolLegend: { 1: 'Une piscine', 2: "Une aire de jeux d'eau", 3: "Un jet d'eau" },
    notInService: 'Hors service cette année',
    poolsShown: { in_service: 'Seules celles en service cette année sont affichées.', all: 'Les cercles creux sont hors service cette année.' },
    recreationKinds: {
      1: 'Centre de loisirs',
      2: 'Centre pour personnes âgées',
      3: "Centre d'éducation à l'environnement",
    },
    poolKinds: { 1: 'Piscine', 2: "Aire de jeux d'eau", 3: "Jet d'eau" },
    waterKinds: { 1: 'Fontaine à boire', 2: 'Point de remplissage de bouteilles' },
    status: { 1: 'En service cette année', 0: 'Hors service cette année' },
    statusUnknown: "Parks and Recreation ne dit pas si c'est en service cette année.",
    indoor: { 1: "À l'intérieur", 0: "À l'extérieur" },
    waterIndoor: "À l'intérieur d'un bâtiment : ouvert quand le bâtiment l'est.",
    accessible: { 1: 'Indiqué comme accessible aux personnes handicapées', 0: 'Non indiqué comme accessible' },
    opened: (date) => `Ouvert pour la saison le ${date}.`,
    gym: 'A une salle de sport.',
    noBuilding: 'Un site de programme sans bâtiment propre.',
    inPark: (park) => `Dans ${park}.`,
    phone: (number) => `Téléphone : ${number}`,
    libraryPage: 'Horaires et événements sur le site de la Free Library',
    seasonNote: "Les piscines ouvrent seulement pour l'été. Vérifiez auprès de Parks and Recreation les horaires de cette semaine.",
    source: {
      libraries: "D'après la liste de la Ville des sites de la Free Library of Philadelphia.",
      parks: "D'après Philadelphia Parks and Recreation, tel que la Ville le publie.",
    },
    cooling: {
      legendOpen: 'Un refuge contre le froid ou la chaleur indiqué comme ouvert',
      legendClosed: 'Indiqué comme fermé, ou sans statut',
      kindShown: {
        any: 'Refuges contre la chaleur et contre le froid.',
        cooling: 'Seulement les refuges contre la chaleur, pour le temps chaud.',
        warming: 'Seulement les refuges contre le froid, pour le temps froid.',
      },
      asListed: (copied, changed) =>
        `${copied ? `Tels que la Ville les a répertoriés le ${copied}` : 'Tels que la Ville les a répertoriés lors de la dernière copie de la liste par cette carte'}${changed ? ` (la liste a été modifiée pour la dernière fois le ${changed})` : ''}. Pas en direct : les sites ouvrent et ferment selon la météo, appelez donc le site ou le 311 avant de vous déplacer.`,
      oneMarker: "Une bibliothèque ou un centre de loisirs qui est aussi un refuge n'apparaît qu'une fois, comme refuge.",
      kinds: {
        1: 'Bibliothèque de la Free Library',
        2: 'Site de Parks and Recreation',
        3: 'Partenaire communautaire',
        4: 'Centre communautaire de la Philadelphia Housing Authority',
      },
      title: 'Refuge contre le froid ou la chaleur',
      status: { 1: 'Indiqué comme ouvert', 0: 'Indiqué comme fermé' },
      statusUnknown: 'Aucun statut indiqué',
      both: 'Indiqué comme refuge contre le froid et contre la chaleur',
      cooling: 'Indiqué comme refuge contre la chaleur',
      warming: 'Indiqué comme refuge contre le froid',
      neither: 'Pas indiqué comme refuge contre le froid ni contre la chaleur',
      hours: (hours) => `Horaires indiqués : ${hours}`,
      services: (services) => `Ce qu'il offre, tel qu'indiqué : ${services}`,
      capacity: (n) => `Place pour ${formatNumber(n)} personnes, telle qu'indiquée`,
      water: "A un point d'eau",
      restroom: 'A des toilettes publiques',
      also: {
        lib: (name) => `Aussi sur la carte comme bibliothèque de la Free Library : ${name}.`,
        rec: (name) => `Aussi sur la carte comme site de Parks and Recreation : ${name}.`,
      },
      alsoSite: "La Ville l'indique aussi comme refuge contre le froid ou la chaleur.",
    },
    playgrounds: {
      kind: 'Aire de jeux',
      ages: { 1: 'Pour les 2 à 5 ans', 2: 'Pour les 5 à 12 ans', 3: 'Pour les 2 à 12 ans' },
      installed: (year) => `Installée en ${year}`,
    },
  },

  conditions: {
    legend: {
      dumping: 'Dépôt sauvage',
      dark_lights: 'Un lampadaire de rue ou de ruelle éteint',
      graffiti: 'Graffitis',
    },
    legendOpen: (what) => `${what} : une demande encore ouverte`,
    legendClosed: (what) => `${what} : toutes les demandes sont closes`,
    legendSize: 'Un cercle plus grand veut dire plus de demandes sur ce tronçon de rue.',
    legendWindow: 'Demandes à Philly311 au cours des 90 derniers jours, comptées par tronçon de rue, jamais par adresse.',
    openOnly: "Seuls les tronçons avec une demande encore ouverte sont affichés.",
    titles: {
      dumping: 'Dépôt sauvage signalé',
      dark_lights: 'Lumières éteintes signalées',
      graffiti: 'Graffitis signalés',
    },
    summary: (n, open) =>
      `${plural(n, { one: '# demande', other: '# demandes' })} à Philly311 au cours des 90 derniers jours, ${open === 0 ? 'aucune' : formatNumber(open)} encore ouverte${open > 1 ? 's' : ''}.`,
    newest: (date) => `La plus récente date du ${date}.`,
    alley: (n, total) =>
      n === total
        ? n === 1
          ? "Elle concernait un éclairage de ruelle."
          : 'Toutes concernaient des éclairages de ruelle.'
        : `${formatNumber(n)} d'entre elles concernaient un éclairage de ruelle.`,
    block: (street) => `Sur ce tronçon de ${street}.`,
    byBlock: "Compté par tronçon de rue, jamais par adresse, et rien n'est montré sur la personne qui a signalé.",
    meaning: "Une demande montre que quelqu'un a remarqué quelque chose et a demandé de l'aide à la Ville. Certains tronçons demandent plus souvent que d'autres.",
    report: 'Le signaler à Philly311',
    source: "D'après les registres 311 de la Ville (Philly311), actualisés chaque semaine.",
  },

  walk: {
    walkTitle: {
      index: "Dans quelle mesure chaque zone est praticable à pied (l'indice de marchabilité de l'EPA)",
      corners: "Coins de rue : à quel point les rues sont reliées entre elles (EPA)",
      transit: "À quelle distance se trouve l'arrêt de transport en commun le plus proche (EPA)",
      mix: 'À quel point logements, emplois et commerces sont mélangés (EPA)',
    },
    walkCompared: {
      city: "Comparé au sein de Philadelphie : chaque teinte contient environ un cinquième des groupes d'îlots de la ville.",
      nation: "Comparé à l'ensemble du pays, comme l'EPA classe chaque groupe d'îlots des États-Unis.",
    },
    walkFifths: {
      index: ['Cinquième le moins praticable à pied', 'Moins praticable', 'Cinquième du milieu', 'Plus praticable', 'Cinquième le plus praticable'],
      corners: ['Le moins de coins', 'Moins', 'Cinquième du milieu', 'Plus', 'Le plus de coins'],
      transit: ['Le plus loin des transports', 'Plus loin', 'Cinquième du milieu', 'Plus près', 'Le plus près des transports'],
      mix: ['Le moins mélangé', 'Moins mélangé', 'Cinquième du milieu', 'Plus mélangé', 'Le plus mélangé'],
    },
    walkNationFifths: ['Cinquième inférieur du pays', 'Sous le milieu', 'Cinquième du milieu', 'Au-dessus du milieu', 'Cinquième supérieur du pays'],
    walkClasses: [
      'Le moins praticable à pied : indice de 1 à 5,75',
      'Sous la moyenne : 5,76 à 10,5',
      'Au-dessus de la moyenne : 10,51 à 15,25',
      'Le plus praticable à pied : 15,26 à 20',
    ],
    walkNationNote:
      "Comparée à l'ensemble du pays, presque toute Philadelphie est au-dessus de la moyenne ou parmi les zones les plus praticables à pied, donc comparer au sein de la ville montre mieux ses différences.",
    walkParts:
      "L'indice va de 1 à 20. Les coins de rue et les transports comptent chacun pour un tiers, et deux mesures du mélange de logements, d'emplois et de commerces pour un sixième chacune.",
    walkSource: "D'après la Smart Location Database de l'EPA, l'agence américaine de protection de l'environnement (2021), construite à partir de données d'environ 2017 à 2019.",

    reachTitle: {
      people: 'Personnes qui habitent à moins de 5 minutes à pied (recensement de 2020)',
      places: 'Types de lieux du quotidien à moins de 10 minutes à pied',
      corners: 'Coins de rue à moins de 5 minutes à pied',
    },
    reachBins: {
      people: ['Moins de 1 000 personnes', '1 000 à 2 499', '2 500 à 3 999', '4 000 à 5 999', '6 000 ou plus'],
      places: ['2 types ou moins sur 7', '3 ou 4 types', '5 types', '6 types', 'Les 7 types'],
      corners: ['Moins de 10 coins', '10 à 24', '25 à 49', '50 à 74', '75 ou plus'],
    },
    reachKinds:
      "Les sept types : une bibliothèque, un centre de loisirs, une piscine ou une aire de jeux d'eau en service, une fontaine à boire dans un parc, une école, une épicerie ou un marché qui accepte le SNAP (aide alimentaire), et un arrêt de bus, de tramway ou de train.",
    reachCorners: "Un coin est l'endroit où se rejoignent trois rues ou plus où l'on peut marcher. Plus de coins veut dire des pâtés de maisons plus courts et plus de façons d'aller quelque part à pied.",
    reachMeasured:
      "Compté depuis le milieu de chaque hexagone en ligne droite : 400 mètres pour 5 minutes de marche, 800 pour 10 minutes de marche. Cela va un peu plus loin qu'une marche le long des rues, et cela traverse les voies ferrées, les autoroutes et les rivières.",
    reachSource: {
      people: "Personnes d'après le recensement de 2020, comptées par îlot.",
      places: "Lieux de la Ville, de Parks and Recreation, de l'USDA et de la SEPTA. Les lieux juste de l'autre côté de la limite de la ville ne sont pas comptés.",
      corners: "Coins d'après les axes de rues de la Ville.",
    },

    stressLevels: {
      1: 'Niveau 1 : assez calme pour la plupart des personnes de tout âge',
      2: 'Niveau 2 : acceptable pour la plupart des adultes',
      3: "Niveau 3 : seulement pour les cyclistes sûrs d'eux",
      4: 'Niveau 4 : seulement pour les cyclistes les plus intrépides',
    },
    stressShown: {
      stressful: 'Seules les rues stressantes, niveaux 3 et 4, sont affichées.',
      calm: 'Seules les rues calmes, niveaux 1 et 2, sont affichées.',
    },
    stressZoom: 'En dézoomant, la carte montre les rues stressantes et les rues avec une piste cyclable ou un sentier. Zoomez pour voir chaque rue.',
    stressSource:
      "D'après le réseau Level of Traffic Stress de la Delaware Valley Regional Planning Commission (DVRPC) : noté d'après les voies, la vitesse de la circulation et le type de piste cyclable, pas en roulant dans chaque rue.",
    stressTitle: (level) => `Niveau ${level} sur 4`,
    stressMeaning: {
      1: 'Assez calme pour la plupart des personnes de tout âge, les enfants aussi.',
      2: 'Acceptable pour la plupart des adultes : un peu de stress de circulation.',
      3: "Seuls les cyclistes sûrs d'eux s'y sentent à l'aise.",
      4: 'Circulation dense et rapide : seulement les cyclistes les plus intrépides.',
    },
    stressOtherWay: (level) => `Rouler dans l'autre sens est plus calme : niveau ${level}.`,
    facilities: {
      0: 'Pas de piste cyclable',
      1: 'Un itinéraire cyclable signalé',
      2: 'Marquages de voie partagée (sharrows)',
      3: 'Une piste cyclable',
      4: 'Une piste cyclable avec zone tampon',
      5: 'Une piste cyclable protégée',
      6: "Un sentier ou un chemin à l'écart de la circulation",
    },
    stressSpeed: (mph) => `La circulation va à environ ${formatNumber(mph)} miles à l'heure, selon la limite de vitesse ou l'estimation de la DVRPC.`,
    stressLanes: (n) => `${plural(n, { one: '# voie', other: '# voies' })} en tout.`,
    streetsHere: (n) => `${plural(n, { one: '# rue', other: '# rues' })} ici`,
    stressDetailsSource: "D'après le réseau Level of Traffic Stress de la DVRPC, noté d'après les voies, les vitesses et les pistes cyclables.",
  },

  landBank: {
    pageTitle: 'La Land Bank en chiffres',
    back: 'Retour à la carte',
    intro:
      "Combien de propriétés la Philadelphia Land Bank et les autres agences foncières de la Ville ont cédées, année par année, d'après les registres d'actes de la Ville. Seulement des comptes et des totaux : aucun nom et aucune adresse.",
    loading: 'Chargement des chiffres',
    loadFailed: "Les chiffres n'ont pas pu être chargés. Vérifiez votre connexion et réessayez.",
    retry: 'Réessayer',
    missing: "Les chiffres ne sont pas encore publiés. Ils apparaissent après la prochaine actualisation hebdomadaire des données.",
    noStatus: 'Sans statut',
    agencyLabel: 'Agence',
    agencyHelp: "Chaque section ci-dessous suit ce choix, sauf les comptes de la Ville elle-même par programme et le compte hebdomadaire des terrains répertoriés.",
    agencies: {
      all: 'Les quatre agences',
      PLB: 'Philadelphia Land Bank',
      PRA: 'Redevelopment Authority',
      PHDC: 'PHDC',
      PUB: 'Ville de Philadelphie',
    },
    agencyLong: {
      all: 'les quatre agences foncières ensemble',
      PLB: 'la Philadelphia Land Bank',
      PRA: 'la Philadelphia Redevelopment Authority',
      PHDC: 'la Philadelphia Housing Development Corporation (PHDC)',
      PUB: 'la Ville de Philadelphie',
    },
    headline: (agency, n, deeds, from, to) =>
      `Dans les registres d'actes de la Ville, de ${from} à ${to}, ${plural(n, { one: '# propriété a été cédée', other: '# propriétés ont été cédées' })} par ${agency}, dans ${plural(deeds, { one: '# acte', other: '# actes' })}.`,
    movedAll: (n) =>
      `Non comptés : ${plural(n, { one: '# transfert', other: '# transferts' })} d'une propriété d'une agence à une autre, par exemple de la Ville à la Land Bank.`,
    moved: (received, handed) =>
      `Elle a aussi reçu ${plural(received, { one: '# propriété', other: '# propriétés' })} des autres agences et en a remis ${formatNumber(handed)} à celles-ci. Ces transferts ne sont pas comptés comme des cessions.`,
    whatCounts:
      "Une cession, ici, est un acte d'une agence foncière à quelqu'un en dehors des quatre agences : une personne, une entreprise, un organisme à but non lucratif, ou un autre organisme public comme la Philadelphia Housing Authority. Chaque propriété compte une fois. Les corrections, les levées d'anciennes restrictions, les transferts entre les agences et les accords enregistrés comme actes sont exclus.",
    partial: (year, date) =>
      `${year} ne va que jusqu'au ${date} : les registres d'actes de la Ville ont environ huit semaines de retard.`,
    noNames: "Nous ne lisons les noms des acheteurs que pour distinguer une personne d'une entreprise et pour vérifier la maison voisine. Nous n'en gardons aucun.",
    showNumbers: 'Afficher les chiffres',
    tableLabel: (what) => `Les chiffres : ${what}`,
    downloadCsv: 'Télécharger le CSV',
    year: 'Année',
    total: 'Total',
    properties: 'Propriétés',
    chartLabel: (what, from, to, max) => `${what}, ${from} à ${to}. L'année la plus haute compte ${max}. Les mêmes chiffres sont dans le tableau sous le graphique.`,
    perYear: {
      title: 'Cessions par année',
      caption: 'Propriétés cédées chaque année. Un acte peut céder plusieurs propriétés.',
      deeds: 'Actes',
    },
    buyers: {
      title: 'Qui sont les acheteurs',
      caption:
        "Le type de chaque acheteur, lu d'après le nom que l'acte enregistre. Un organisme à but non lucratif n'est compté comme tel que si son nom l'indique ; beaucoup d'organismes à but non lucratif ont un nom comme celui d'une entreprise et sont comptés comme des entreprises.",
      groups: {
        individual: 'Personnes',
        company: 'Entreprises',
        nonprofit: 'Organismes à but non lucratif',
        public: 'Autres organismes publics',
        unknown: 'Pas clair',
      },
      share: (label, pct) => `${label} : ${pct} %`,
      shares: 'Part de toutes les propriétés cédées ces années-là',
    },
    programs: {
      title: 'Par programme',
      caption:
        "Les actes ne disent pas par quel programme une cession est passée. On peut en déduire un : un terrain seul cédé à une personne qui possède une maison attenante est probablement un jardin latéral ou arrière. Ce graphique compte ces terrains, selon notre déduction. Pour les autres, les registres ne disent rien, ce qui ne veut pas dire que ce n'étaient pas des jardins latéraux.",
      series: 'Jardins latéraux ou arrière, selon notre déduction',
      checked:
        "Comment nous l'avons vérifié (9 octobre 2026) : 10 de ces terrains, tirés au hasard entre 2019 et 2026, recherchés à la main. Dans les 10 cas, l'acheteur est le propriétaire enregistré de la maison à côté ou derrière le terrain et y reçoit son courrier. Savoir si chacun est passé par le programme de jardin latéral reste notre déduction.",
      compare: (cityTotal, ours, oursPlb, from, to) =>
        `Pour les exercices ${from} à ${to}, le tableau de bord de la Ville a compté ${formatNumber(cityTotal)} jardins latéraux. D'après les actes, nous en déduisons ${formatNumber(ours)} pour les quatre agences, dont ${formatNumber(oursPlb)} de la Land Bank.`,
      cityTitle: 'Les comptes de la Ville elle-même par programme',
      cityCaption: (edited) =>
        `D'après le tableau de bord Land Management de la Ville, par exercice (de juillet à juin). Il a été mis à jour pour la dernière fois le ${edited}, donc le dernier exercice est incomplet, et pour le logement il compte les logements construits, pas les propriétés.`,
      fy: 'Exercice',
      sideYards: 'Jardins latéraux',
      gardens: 'Jardins ou espaces ouverts',
      business: "Expansion d'entreprise",
      homesBelow30: 'Logements, sous 30 % du revenu de la zone',
      homes60to80: 'Logements, 60 % à 80 %',
      homes80to120: 'Logements, 80 % à 120 %',
      homesMarket: 'Logements, au prix du marché',
      oursPlb: 'Notre déduction de jardins latéraux, Land Bank',
      oursAll: 'Notre déduction de jardins latéraux, les quatre',
      fyLabel: (fy) => `${fy - 1} à ${fy}`,
    },
    prices: {
      title: 'Prix enregistrés sur les actes',
      caption: (max) =>
        `Le prix est ce que l'acte enregistre pour chaque propriété (sa part quand un acte en couvrait plusieurs). Ce n'est pas toujours de l'argent payé : certains programmes vendent à un prix symbolique et protègent l'usage du terrain par un prêt hypothécaire de 30 ans, et les actes de jardin latéral enregistrent souvent la valeur estimée du terrain. Le prix médian a la moitié des prix en dessous et la moitié au-dessus. « Symbolique » veut dire ${max} ou moins.`,
      priced: 'Avec un prix',
      median: 'Prix médian',
      nominal: 'Prix symbolique',
      none: 'Aucun prix enregistré',
      summary: (median, pct) => `Prix médian sur ces années : ${median}. ${pct} % ont été cédées à un prix symbolique.`,
    },
    districts: {
      title: 'Par district du Conseil municipal',
      caption:
        "Où se trouvent les propriétés, selon les limites actuelles des districts du Conseil municipal. Les limites changent après chaque recensement, donc les années antérieures sont aussi placées selon les limites actuelles.",
      district: 'District',
      districtName: (n) => `District ${n}`,
      noLocation: "Pas d'emplacement dans les registres",
      allYears: 'Toutes les années',
      chartLabel: 'Propriétés cédées dans chaque district du Conseil municipal. Les mêmes chiffres sont dans le tableau en dessous.',
    },
    listed: {
      title: 'Terrains indiqués comme disponibles, semaine par semaine',
      caption: (from) =>
        `La liste de la Ville des propriétés publiques, la même liste que montre la carte des propriétés de la Land Bank, comptée chaque semaine où notre copie a été actualisée. Le comptage commence le ${from} ; il n'y a pas de comptages hebdomadaires plus anciens.`,
      date: 'Date de la liste',
      records: 'Indiqués comme disponibles',
      parcels: 'Parcelles',
      sideYard: 'Ouvert à un voisin comme jardin latéral',
      oneWeek: "Un graphique apparaît dès qu'il y a deux semaines à comparer.",
      byStatus: (date) => `Chaque terrain de la liste selon son statut, ${date}`,
      status: 'Statut',
      count: 'Entrées',
      chartLabel: (from, to) => `Terrains indiqués comme disponibles chaque semaine, ${from} à ${to}. Les mêmes chiffres sont dans le tableau en dessous.`,
      mapLink: 'La carte des propriétés répertoriées de la Land Bank',
    },
    limits: {
      title: 'Ce que ces chiffres ne peuvent pas montrer',
      items: [
        "Combien de temps les candidats ont attendu, combien ont candidaté, ou combien ont été refusés. Les registres publics contiennent des actes, pas des candidatures.",
        "Le programme derrière la plupart des cessions. Les actes ne le disent pas ; les jardins latéraux et arrière sont notre déduction, et les comptes de la Ville elle-même par programme s'arrêtent en avril 2023.",
        "Ce qui a été construit ou cultivé ensuite, ou si les restrictions d'un terrain ont été respectées.",
        "Ce qu'un acheteur a finalement payé. Un acte enregistre un prix, et certains programmes associent un prix symbolique à un prêt hypothécaire de 30 ans.",
        "Les terrains que les agences louent ou concèdent sous licence, comme les accords de jardin. Aucun acte ne les enregistre.",
        "Les actes d'avant 2014, et les actes des huit dernières semaines environ, que la Ville n'a pas encore publiés.",
      ],
    },
    sources: {
      title: 'Sources et dates',
      deeds: (fetched, last) =>
        `Actes : Ville de Philadelphie, Department of Records, transferts de biens immobiliers, lus le ${fetched} ; l'acte le plus récent est daté du ${last}.`,
      programs: (edited) =>
        `Comptes par programme : Ville de Philadelphie, Department of Planning and Development, tableau de bord Land Management, mis à jour pour la dernière fois le ${edited}.`,
      listed:
        "Terrains répertoriés : Ville de Philadelphie, Department of Planning and Development (Land Management), tels que les montre la carte des propriétés de la Philadelphia Land Bank.",
      districts: 'Districts du Conseil municipal : Ville de Philadelphie, limites actuelles.',
      neighbours:
        "Pour la déduction des jardins latéraux : la liste des propriétaires de la Ville (Office of Property Assessment) et les formes des parcelles (Water Department).",
      board: "Les ordres du jour du conseil d'administration de la Land Bank, qui énumèrent chaque cession par programme",
      council: "La législation du Conseil municipal, où le Conseil approuve chaque cession de la Land Bank",
      method: 'Comment nous comptons, en détail',
      deedsLink: 'Les transferts de biens immobiliers de la Ville',
      programsLink: 'Le tableau du tableau de bord Land Management de la Ville',
    },
    csv: {
      years: (agency) => `Cessions par année et par agence (les quatre agences et chacune ; cette page montrait ${agency}).`,
      districts: 'Cessions par district du Conseil municipal (limites actuelles) et par année, pour les quatre agences et chacune.',
      programs: 'Les comptes de la Ville elle-même par programme et par exercice, à côté de notre déduction de jardins latéraux.',
      listed: 'Terrains de la liste de la Ville des propriétés publiques indiqués comme disponibles, chaque semaine depuis le début du comptage.',
      counts: 'Comptes seulement : aucun nom, aucune adresse et aucun numéro de parcelle.',
      dates: (fetched, last) => `Actes lus le ${fetched} ; l'acte le plus récent est daté du ${last}.`,
      file: (part, day) => `placekeepers-land-bank-${part}-${day}.csv`,
    },
  },

  basemap: {
    missing: 'Le fond de carte n\'est pas disponible, donc les rues et les noms de lieux sont masqués. Les couches de données fonctionnent toujours.',
    unavailable: "Le fond de carte n'est pas disponible ici, donc la carte affiche un arrière-plan uni.",
    legend: 'Rues, bâtiments, parcs, eau et noms de lieux, en couleur.',
    legendMuted: 'Rues, bâtiments, parcs, eau et noms de lieux, en gris, pour que les données ressortent.',
  },

  credits: {
    basemap:
      '<a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    data: (statusUrl) => `Données : Ville de Philadelphie et <a href="${statusUrl}">d'autres</a>`,
  },

  status: {
    pageTitle: 'État des données',
    intro:
      'Placekeepers actualise ses données chaque semaine. Si une source tombe en panne, la carte garde la dernière bonne copie et le dit ici.',
    back: 'Retour à la carte',
    loading: "Chargement de l'état des données",
    loadFailed: "Nous n'avons pas pu charger le fichier d'état des données. La carte peut quand même fonctionner avec des données plus anciennes.",
    retry: 'Réessayer',
    builtOn: (date) => `Dernière actualisation : ${date}`,
    buildId: (id) => `Build ${id}`,
    summaryAllOk: 'Toutes les sources sont à jour.',
    summary: (stale, failing, missing) => {
      const parts: string[] = [];
      if (stale) parts.push(plural(stale, { one: '# source est périmée', other: '# sources sont périmées' }));
      if (failing) parts.push(plural(failing, { one: '# source ne fonctionne pas', other: '# sources ne fonctionnent pas' }));
      if (missing) parts.push(plural(missing, { one: "# source n'a pas encore été récupérée", other: "# sources n'ont pas encore été récupérées" }));
      return `${parts.join(', ')}.`;
    },
    statusLabel: {
      ok: 'À jour',
      stale: 'Périmée',
      failing: 'Ne fonctionne pas',
      missing: 'Pas encore récupérée',
      unknown: 'Inconnu',
    },
    staleSince: (date) => `Utilise la dernière bonne copie, du ${date}.`,
    staleNoDate: 'Utilise la dernière bonne copie.',
    failingText: "Il n'y a pas de copie utilisable pour le moment, donc les couches qui en ont besoin peuvent manquer.",
    missingText: "Cette source n'a pas encore été récupérée.",
    unknownText: "Le fichier d'état signale quelque chose que nous ne reconnaissons pas.",
    lastSuccess: (date) => `Dernier bon téléchargement : ${date}`,
    neverSucceeded: 'Pas encore de bon téléchargement',
    lastAttempt: (date) => `Dernière tentative : ${date}`,
    rows: (n) => plural(n, { one: '# enregistrement', other: '# enregistrements' }),
    newest: (date) => `Enregistrement le plus récent : ${date}`,
    message: (text) => `Note de l'actualisation : ${text}`,
    publisher: 'Publié par',
    homepage: "D'où cela vient",
    license: 'Licence',
    cadence: {
      daily: "Mis à jour chaque jour par l'éditeur",
      weekly: "Mis à jour chaque semaine par l'éditeur",
      monthly: "Mis à jour chaque mois par l'éditeur",
      yearly: "Mis à jour chaque année par l'éditeur",
      irregular: "Mis à jour de temps en temps par l'éditeur",
      frozen: "N'est plus mis à jour par l'éditeur",
    },
    problems: "Problèmes dans le fichier d'état",
    notesTitle: 'Notes de la dernière actualisation',
    notesInEnglish: 'Ces notes sont écrites en anglais, pour les personnes qui font fonctionner la carte.',
    basemapLabel: { ok: 'À jour', failing: 'Indisponible' },
    basemapMade: (date) =>
      `L'actualisation hebdomadaire crée une nouvelle copie du fond de carte environ une fois par mois. Cette copie a été créée à partir d'OpenStreetMap le ${date}.`,
    basemapNoDate: "L'actualisation hebdomadaire crée une nouvelle copie du fond de carte environ une fois par mois.",
    basemapMissing: "Le fond de carte n'est pas disponible sur cette copie du site, donc la carte affiche un arrière-plan uni. Les couches de données fonctionnent toujours.",
  },

  search: {
    label: 'Rechercher une adresse, une intersection ou un numéro de parcelle',
    placeholder: 'Adresse, intersection ou numéro de parcelle',
    button: 'Rechercher',
    searching: 'Recherche en cours',
    tooShort: 'Tapez une adresse, comme 1234 Market St, ou deux rues qui se croisent, comme Broad et Girard.',
    notFound:
      "La Ville n'a pas trouvé ce lieu. Essayez un numéro de maison et une rue, deux rues qui se croisent, ou un numéro de parcelle à neuf chiffres.",
    failed: (reason) => `Problème avec le service d'adresses de la Ville (${reason}). Réessayez dans un instant.`,
    liveOff:
      "La recherche d'adresse interroge le service d'adresses de la Ville, et les données en direct de la Ville sont désactivées dans les Paramètres. Vous pouvez toujours chercher par numéro de parcelle à neuf chiffres.",
    resultsTitle: 'Choisissez un lieu',
    resultsCount: (n) => plural(n, { one: '# lieu correspond', other: '# lieux correspondent' }),
    intersection: 'Intersection',
    showing: (label) => `Affichage de ${label} sur la carte.`,
    noParcel: (label) => `Affichage de ${label} sur la carte. La Ville n'a pas de fiche de parcelle pour cette adresse exacte.`,
    privacy: 'Les recherches vont de votre navigateur directement à la Ville de Philadelphie.',
  },

  pick: {
    looking: 'Recherche de cette parcelle auprès de la Ville',
    nothing: "La Ville n'a aucune parcelle à cet endroit. Touchez un terrain ou un bâtiment.",
    liveOff: "Pour ouvrir une parcelle qui n'est pas dans notre liste, activez « Récupérer les données en direct de la Ville » dans les Paramètres.",
    failed: (reason) => `Problème avec la carte des parcelles de la Ville (${reason}). Réessayez dans un instant.`,
  },

  historic: {
    liveOff:
      "Ces images viennent directement des serveurs de la Ville, donc elles ne peuvent être activées que lorsque « Récupérer les données en direct de la Ville » est activé (dans les Paramètres, sous « Confidentialité et données en direct »).",
    refused: "Les anciennes photos aériennes et l'atlas de 1860 viennent des serveurs de la Ville. Activez les données en direct de la Ville dans les Paramètres pour les voir.",
    serverError: "Le serveur d'images de la Ville n'a pas envoyé toutes les parties de cette image. Réessayez plus tard.",
    photoYear: (year) => `La photo aérienne de ${year}, prise depuis un avion.`,
    gaps1975: "Les photos de 1975 laissent des trous à l'extrême sud de la ville, autour de l'aéroport et du Navy Yard.",
    termsNotStated: "Son éditeur n'indique aucune condition d'utilisation pour ces photos ; elles sont montrées telles que la Ville les héberge, avec mention de la source, et seront retirées si l'éditeur le demande.",
    blackAndWhite: (year) => `Les photos de ${year} sont en noir et blanc.`,
    under: "La photo se trouve sous toutes les autres couches. Baissez son intensité pour voir les rues d'aujourd'hui à travers.",
    atlasCoverage: "L'atlas ne couvre que Center City et Northern Liberties.",
    atlasCredit: "Atlas ajusté à la carte d'aujourd'hui par le Greater Philadelphia GeoHistory Network et hébergé par la Ville de Philadelphie avec sa permission.",
    sliderRange: (first, last) => `De ${first} à ${last}`,
    lotTitle: 'Anciennes photos aériennes',
    lotButton: "Voir ce terrain sur d'anciennes photos aériennes",
    lotHelp: (year) =>
      `Ouvre la carte à ce terrain avec la photo aérienne de ${year}, la plus ancienne de cette carte. Faites défiler les années depuis lors sous « Hier et aujourd'hui » dans les couches.`,
    lotLiveOff: 'Les photos viennent directement des serveurs de la Ville, donc elles ont besoin des données en direct de la Ville, qui sont désactivées.',
    shown: (year) => `Les photos aériennes de ${year} sont affichées. Faites défiler les années sous « Hier et aujourd'hui » dans les couches.`,
    statusOk: "Chaque service d'images a répondu au dernier contrôle hebdomadaire. Les images se chargent directement depuis les serveurs de la Ville quand quelqu'un active leur couche.",
    statusStale: (date) =>
      `Au dernier contrôle hebdomadaire, tous les services d'images n'ont pas répondu, donc certaines images peuvent ne pas s'afficher. Chacun a répondu pour la dernière fois le ${date}.`,
    statusFailing: "Les services d'images n'ont pas répondu au contrôle hebdomadaire, donc les images peuvent ne pas s'afficher.",
    services: (n) => `${plural(n, { one: "# service d'images vérifié", other: "# services d'images vérifiés" })}`,
    lastCheck: (date) => `Dernier contrôle où tous les services ont répondu : ${date}`,
  },

  redlining: {
    detailsTitle: 'Carte du redlining de 1937',
    grades: {
      A: 'A, noté « le meilleur » en 1937',
      B: 'B, noté « encore souhaitable »',
      C: 'C, noté « en déclin certain »',
      D: 'D, noté « dangereux » et entouré en rouge : zone de redlining',
    },
    ungraded: 'Sans note (terrains industriels et commerciaux)',
    area: (label, grade) => `Zone ${label}, notée ${grade} en 1937`,
    areaUngraded: (label) => `${label} : une zone que la carte de 1937 a laissée sans note`,
    context:
      "En 1937, un organisme fédéral, la Home Owners' Loan Corporation, a noté les quartiers de la ville de A à D selon le degré de sécurité qu'il jugeait pour les prêts hypothécaires à cet endroit. Les notes dépendaient des personnes qui habitaient chaque zone : les zones où vivaient des familles noires et de nombreuses familles immigrées étaient le plus souvent notées D et entourées en rouge. Pendant des décennies, il y était plus difficile d'obtenir un prêt, et cette pratique s'appelle le redlining.",
    notToday: "Les notes sont une trace de la façon dont un organisme fédéral jugeait les lieux en 1937. Elles ne disent rien des personnes qui y vivent aujourd'hui.",
    legendTap: 'Touchez une zone pour voir sa note et un lien vers sa description de 1937.',
    description: (label) => `Lire la description de 1937 de la zone ${label} sur Mapping Inequality`,
    descriptionNote: "Les descriptions de 1937 ne sont pas copiées ici : elles restent sur Mapping Inequality, avec l'histoire qui les entoure.",
    credit:
      "Zones et notes de Mapping Inequality : Redlining in New Deal America, par Robert K. Nelson, LaDale Winling et al., Digital Scholarship Lab de l'University of Richmond. Placekeepers montre seulement les zones et les notes.",
    homepageLabel: 'Mapping Inequality : Philadelphie',
    nonCommercial: "Usage non commercial seulement. Sous licence Creative Commons Attribution NonCommercial 2.5, à part du reste des données de la carte.",
    licenseLabel: 'CC BY-NC 2.5',
    statusNote: "Usage non commercial seulement : cette source est sous licence pour un usage non commercial, donc le site la publie dans un fichier à part et jamais dans un téléchargement.",
  },

  options: {
    title: 'Confidentialité et données en direct',
    privacyLink: 'Comment Placekeepers protège votre vie privée',
    turnOn: 'Activer les données en direct de la Ville',
    resetNote: 'Votre choix sur les données en direct de la Ville ne change pas.',
  },

  failure: {
    timeout: 'pas de réponse à temps',
    network: 'connexion impossible',
    http: 'réponse en erreur',
    bad_data: 'réponse illisible',
    not_found: 'aucun enregistrement trouvé',
    aborted: 'aucune demande envoyée',
    empty: 'aucune demande envoyée',
  },

  rulesMap: {
    legend: {
      district: 'Quartier historique',
      property: 'Au registre historique',
      overlay: 'Zonage superposé (overlay)',
      supplemental: 'Autre règle spéciale du Code de zonage',
      hearingZoning: 'Audience de zonage',
      hearingOther: 'Audience devant un autre comité',
      brownfield: "Site brownfield de l'EPA",
    },
    notes: {
      historic: "Les changements ici peuvent nécessiter l'examen de la Historical Commission ; demandez-leur d'abord.",
      overlays: "Les zonages superposés se chevauchent, et quelques-uns couvrent la plus grande partie de la ville. Touchez un endroit pour voir tous les zonages superposés qui s'y trouvent.",
      hearings: "Touchez une audience pour voir comment y participer et pour ouvrir la page du terrain.",
      brownfields: "Ce n'est pas une carte de tout le terrain contaminé. Testez le sol avant de cultiver de la nourriture sur un de ces sites ou près de l'un d'eux.",
    },
    districtTitle: (name) => name,
    designated: (date) => `Désigné le ${date}.`,
    noDate: "La couche de la Ville ne donne pas de jour de désignation.",
    propertyTitle: 'Au Philadelphia Register of Historic Places',
    listedOn: (date) => `Inscrit séparément le ${date}.`,
    listedAlone: 'Inscrit séparément.',
    inDistrict: (district, date) => `Fait partie de ${district}${date ? `, désigné le ${date}` : ''}.`,
    overlaysHere: (n) => (n === 1 ? 'Un zonage superposé ici' : `${formatNumber(n)} zonages superposés ici`),
    hearingTitle: (board) => `Audience : ${board}`,
    hearingWhen: (date, time) => `${date}${time ? `, à ${time}` : ''}`,
    hearingsHere: (n) => `${formatNumber(n)} audiences ici`,
    about: (address) => `À propos de ${address}.`,
    rco: (name) => `Organisation communautaire enregistrée (RCO) informée : ${name}.`,
    openLot: 'Ouvrir la page de ce terrain',
    namesNote: "La personne qui a déposé l'appel n'est indiquée que sur la page du terrain.",
    brownfieldTitle: "Site brownfield de l'EPA",
  },

  dossier: {
    pageTitle: 'Page du terrain',
    loading: 'Chargement de la page du terrain',
    parcel: (opa) => `Compte OPA ${opa}`,
    printButton: 'Imprimer cette page de terrain',
    showOnMap: 'Voir sur la carte',
    close: 'Fermer la page du terrain',
    clear: 'Effacer la sélection',
    retry: 'Réessayer auprès de la Ville',
    notFound: "Nous n'avons pas trouvé cette parcelle dans les registres de la Ville ni dans notre instantané hebdomadaire.",
    noData:
      "Cette parcelle n'est pas dans notre instantané hebdomadaire, et les données en direct de la Ville sont désactivées, donc il n'y a encore rien à montrer.",
    sections: {
      summary: 'Résumé',
      actions: 'Ce que vous pouvez faire',
      rules: 'Règles pour ce terrain',
      owner: 'À qui il appartient',
      history: 'Historique',
      nearby: 'À proximité',
      sources: 'Sources et fraîcheur',
    },
    contents: 'Sur cette page',

    provenance: {
      live: (time) => `En direct de la Ville à ${time}.`,
      snapshot: (date) => `D'après l'instantané hebdomadaire du ${date}.`,
      snapshotNoDate: "D'après l'instantané hebdomadaire.",
      map: "D'après les données hebdomadaires de la carte.",
      checking: 'Recherche de documents plus récents auprès de la Ville.',
      asking: 'Demande à la Ville.',
      failedSnapshot: (reason, date) => `Les serveurs de la Ville ont eu un problème (${reason}), donc ceci est l'instantané hebdomadaire du ${date}.`,
      failedNothing: (reason) => `Les serveurs de la Ville ont eu un problème (${reason}), donc cette partie ne peut pas être montrée pour le moment.`,
      offSnapshot: (date) => `Les données en direct de la Ville sont désactivées, donc ceci est l'instantané hebdomadaire du ${date}.`,
      offNothing: "Les données en direct de la Ville sont désactivées, et notre instantané hebdomadaire ne couvre pas cette partie.",
      none: 'Aucun enregistrement à montrer.',
    },
    banner: {
      live: 'En direct de la Ville de Philadelphie.',
      loading: 'Vérification auprès de la Ville des enregistrements les plus récents.',
      off: (date) => `Les données en direct de la Ville sont désactivées. Cette page montre l'instantané hebdomadaire du ${date}.`,
      offNoDate: "Les données en direct de la Ville sont désactivées. Cette page montre l'instantané hebdomadaire.",
      partial: "Certaines recherches auprès de la Ville n'ont pas fonctionné. Ces parties montrent l'instantané hebdomadaire, ou rien, et le disent.",
      failed: "Les serveurs de la Ville n'ont pas répondu. Cette page montre ce que contient notre instantané hebdomadaire.",
    },

    summary: {
      kind: { lot: 'Terrain vacant', building: 'Bâtiment vacant' },
      notListed: 'Pas dans notre liste de terrains et bâtiments vacants',
      notListedHelp: 'Si vous pensez que cette parcelle est vacante, signalez une correction ci-dessous.',
      noDetails: 'Pas encore de détails publiés',
      noPublishedDetails: "Nous n'avons pas publié de détails sur cette parcelle, donc cette page montre ce que disent les serveurs de la Ville en ce moment.",
      confidence: {
        high: 'Très probablement vacant',
        medium: 'Probablement vacant',
        low: "Nous ne sommes pas très sûrs qu'il soit vacant",
      },
      confidenceTitle: 'Notre degré de certitude',
      signals: (n) =>
        `${plural(n, { one: "# registre indépendant de la Ville s'accorde", other: "# registres indépendants de la Ville s'accordent" })} pour dire qu'il est vacant.`,
      cityCalls: (category) => `Les registres de propriété de la Ville le décrivent ainsi : ${category}.`,
      lotSize: (frontage, depth) =>
        `L'évaluateur foncier de la Ville l'enregistre comme d'environ ${formatNumber(Math.round(frontage))} pieds de large sur la rue et ${formatNumber(Math.round(depth))} pieds de profondeur.`,
      landcare: 'Déjà entretenu par PHS LandCare.',
      landcareSince: (year) => `Déjà entretenu par PHS LandCare depuis ${year}.`,
      garden: 'Des gens y font déjà du jardinage. Demandez-leur avant de planifier quoi que ce soit.',
      lensLine: (lens) => `Priorité selon l'angle « ${lens.toLowerCase()} », l'angle selon lequel la carte colorie les terrains.`,
      flood: {
        1: "Une partie de ce terrain se trouve dans la zone inondable à 1 pour cent de chance par an de la FEMA (l'agence américaine de gestion des urgences), où une inondation a au moins 1 chance sur 100 chaque année. C'est une raison de faire attention, pas une part d'un score : les plantes ici doivent supporter un sol détrempé, tout ce qui est construit doit suivre les règles de la Ville sur les zones inondables, et un verdissement qui absorbe la pluie aide.",
        2: "Une partie de ce terrain se trouve dans la zone d'inondation à 0,2 pour cent de chance par an de la FEMA, où une inondation a 1 chance sur 500 chaque année. C'est une raison de faire attention, pas une part d'un score : les plantes ici devraient supporter un sol détrempé, et un verdissement qui absorbe la pluie aide.",
      },
      floodTitle: "Risque d'inondation",
      linksTitle: "Voir sur d'autres sites",
      propertyPage: 'La page de la Ville sur cette propriété',
      atlas: 'Atlas, la carte de la Ville pour cette adresse',
      googleMaps: 'Google Maps',
      streetView: 'Google Street View',
      linksNote: "Ces liens ouvrent d'autres sites web. Placekeepers renvoie vers des photos de rue mais ne les copie jamais.",
    },

    actions: {
      intro: 'Commencez par la voie légale. Chacune dit qui peut la suivre et qui peut aider.',
      route: 'La voie légale',
      steps: 'Étapes',
      who: 'Qui peut le faire',
      cost: 'Coût',
      timeline: 'Combien de temps cela prend',
      lastChecked: (date) => `Dernière vérification : ${date}.`,
      toConfirm: "Reste à confirmer auprès de l'organisation nommée ici.",
      partners: 'Qui peut aider',
      otherRoutes: 'Autres voies légales pour cette parcelle',
      none: 'Pas encore de suggestion pour ce lieu.',
      notListed:
        "Cette parcelle n'est pas dans notre liste de terrains et bâtiments probablement vacants, donc nous n'avons pas de suggestion pour elle. La page Comment faire explique les voies légales pour n'importe quel terrain.",
      howTo: 'Comment faire',
      conservatorshipWarning:
        "La mise sous administration judiciaire (conservatorship) peut retirer un bien à son propriétaire. Des chercheurs ont constaté qu'elle est utilisée de façon disproportionnée dans les quartiers confrontés à la gentrification. Parlez au Garden Justice Legal Initiative avant de l'envisager.",
      notLegalAdvice: "Placekeepers n'est pas un avis juridique. Vérifiez auprès des organisations nommées ici avant d'agir.",
    },

    listing: {
      title: 'Indiqué comme disponible par les agences foncières de la Ville',
      text: (date) => `Le ${date}, la liste de la Ville des terrains publics montrait cette propriété comme disponible.`,
      textNoDate: 'La liste de la Ville des terrains publics montre cette propriété comme disponible.',
      variants: {
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': 'Elle est proposée pour un accord de jardin.',
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': 'Rien ne peut y être construit.',
        'OWNED - AVAILABLE (NOT FOR SY)': "Elle n'est pas proposée comme jardin latéral.",
      },
      sideYardLead: 'Si vous êtes propriétaire de la maison voisine, commencez par le programme de jardin latéral (side yard) :',
      decline:
        "Être sur la liste ne veut pas dire que la Land Bank dira oui. Elle décide de chaque demande séparément et peut refuser toute vente ou location, même d'une propriété qu'elle indique comme disponible.",
      changes: 'La liste change souvent. Vérifiez la carte de la Land Bank avant d\'agir.',
      map: 'La carte des propriétés disponibles de la Land Bank',
      credit: 'Liste : Ville de Philadelphie, Department of Planning and Development (Land Management), telle que la montre la carte de la Philadelphia Land Bank.',
    },

    ownerType: {
      noName: 'Les registres de la Ville ne donnent aucun nom de propriétaire.',
      unclear: "Nous n'avons pas pu dire d'après le nom de quel type de propriétaire il s'agit.",
      individual: 'Le nom du propriétaire ressemble à un nom de personne.',
      publicName: (label) => `Les registres de la Ville nomment ${label} comme propriétaire.`,
      markerReason: (marker) => `Le nom du propriétaire contient « ${marker} ».`,
      agencyConflict: (contact) => `Les registres de propriété de la Ville nomment un autre propriétaire, donc demandez à ${contact} lequel est à jour.`,
      agencyContacts: { PUB: 'la Land Bank', PLB: 'la Land Bank', PRA: 'la PHDC', PHDC: 'la PHDC' },
      publicBodies: {
        land_bank: 'la Philadelphia Land Bank',
        redevelopment_authority: 'la Philadelphia Redevelopment Authority',
        pha: 'la Philadelphia Housing Authority',
        housing_authority: 'une autorité du logement public',
        phdc: 'la Philadelphia Housing Development Corporation (PHDC)',
        pha_or_phdc: 'la Philadelphia Housing Authority ou la PHDC (le nom est tronqué)',
        city: 'la Ville de Philadelphie',
        school_district: 'le School District of Philadelphia (le district scolaire)',
        community_college: 'le Community College of Philadelphia',
        septa: 'la SEPTA',
        commonwealth: 'le Commonwealth de Pennsylvanie',
        phfa: 'la Pennsylvania Housing Finance Agency',
        united_states: 'le gouvernement des États-Unis',
        hud: 'le département américain du Logement et du Développement urbain (HUD)',
        veterans_affairs: 'le département américain des Anciens combattants (Veterans Affairs)',
        paid: 'la Philadelphia Authority for Industrial Development',
        port_authority: 'la Philadelphia Regional Port Authority',
        district_attorney: 'le bureau du procureur de district de Philadelphie',
        public_authority: 'une autorité publique',
        pgw: 'Philadelphia Gas Works',
      },
      markers: {
        TR: "TR, abréviation de « trustee » (fiduciaire)",
        TRS: "TRS, abréviation de « trustees » (fiduciaires)",
        TRST: "TRST, abréviation de « trust » (fiducie)",
        'T U W': 'T/U/W, une fiducie créée par un testament',
        FBO: 'FBO, pour le bénéfice de',
        CO: "CO, abréviation de « company » (société)",
        LP: 'LP, une société en commandite (limited partnership)',
        LLP: 'LLP, une société de personnes à responsabilité limitée (limited liability partnership)',
        LTD: "LTD, abréviation de « limited »",
        LL: 'LL, une forme abrégée de LLC',
        GP: 'GP, un commandité (general partner)',
        'N A': 'N A, une banque nationale',
        FB: 'FB, une forme abrégée de FBO',
        CDC: 'CDC, une société de développement communautaire (community development corporation)',
      },
      labels: {
        individual: 'Une personne',
        company: 'Une entreprise',
        city: 'La Ville de Philadelphie',
        land_bank: 'La Philadelphia Land Bank',
        redevelopment_authority: 'La Philadelphia Redevelopment Authority',
        housing_authority: 'Une autorité du logement public',
        nonprofit: 'Un organisme à but non lucratif',
        other_public: 'Un autre organisme public',
        unknown: "Pas clair d'après les registres de la Ville",
      },
    },

    owner: {
      names: 'Propriétaire, tel que la Ville le publie',
      noNames: 'Les registres de la Ville ne donnent aucun nom de propriétaire.',
      mailing: 'Adresse postale, telle que la Ville la publie',
      noMailing: 'Aucune adresse postale enregistrée.',
      type: 'Type de propriétaire',
      flagsTitle: 'Ce que suggèrent les registres de la Ville',
      noFlags: "Rien dans les registres de la Ville n'appelle une note sur ce propriétaire.",
      heldBack:
        "Nous ne sommes pas sûrs que cette parcelle soit vacante, donc ce peut être la maison de quelqu'un. Les notes sur un propriétaire qui peut être une personne (où il reçoit son courrier, une possible succession, des dettes d'impôts, d'autres parcelles qu'il possède) n'apparaissent que sur les parcelles que nous disons très probablement ou probablement vacantes.",
      ownerChanged:
        "Les registres de la Ville nomment un autre propriétaire que notre instantané hebdomadaire, donc les notes qui concernaient l'ancien propriétaire sont laissées de côté.",
      parts: { meaning: 'Ce que cela signifie', careful: 'Faites attention', next: 'Une prochaine étape prudente' },
      flagTitles: {
        absentee: 'Où le propriétaire reçoit son courrier',
        possible_estate: 'Succession possible',
        tax_debt_2025: "Dette d'impôts en juillet 2025",
        sheriff_sales: 'Anciennes ventes par le shérif (sheriff sales)',
        years_since_sale: 'Années depuis la dernière vente',
        many_parcels: 'Un propriétaire de nombreuses parcelles vacantes',
        fast_resales: 'Reventes rapides',
        open_violations: 'Infractions L&I ouvertes',
        unsafe: 'Bâtiment non sûr',
        imminently_dangerous: 'Bâtiment en danger imminent',
      },
      otherFlag: 'Une note des registres de la Ville',
      taxTitle: 'Impôts',
      taxNoDebt:
        "La Ville ne publie plus le solde d'impôts de chaque propriété en données ouvertes. L'instantané de juillet 2025 que nous avons ne montre pas d'impôts impayés ici.",
      taxUnknown: "La Ville ne publie plus le solde d'impôts de chaque propriété en données ouvertes.",
      taxHeld:
        "La Ville ne publie plus le solde d'impôts de chaque propriété en données ouvertes. Notre instantané de juillet 2025 n'est montré, pour un propriétaire qui peut être une personne, que sur les parcelles que nous disons très probablement ou probablement vacantes.",
      taxCenter: "Vérifier le solde d'aujourd'hui sur le Tax Center de la Ville",
      deedFraudTitle: "Protéger ce bien contre le vol d'acte de propriété",
      deedFraud:
        "Le vol d'acte de propriété a lieu quand quelqu'un dépose un faux acte pour s'emparer d'un bien, souvent un bien dont le propriétaire est décédé ou vit ailleurs. Les propriétaires et les familles peuvent s'inscrire aux alertes gratuites Fraud Guard de la Ville, qui envoient un e-mail quand un document à leur nom est enregistré. Depuis novembre 2025, la Ville bloque aussi automatiquement les actes dont le vendeur était déjà décédé au moment où il est censé les avoir signés.",
      fraudGuard: "S'inscrire aux alertes gratuites Fraud Guard de la Ville",
      deedCheck: "Le contrôle automatique de la Ville qui arrête la fraude aux actes",
      helpTitle: 'Aide pour les propriétaires et les familles',
      seeList: 'Voir les parcelles de ce propriétaire dans notre liste',
      cityListTitle: 'Liste de la Ville des propriétés publiques',
      cityList: 'La parcelle est sur la liste de la Ville des propriétés publiques.',
      cityListNames: (agency) => `La liste de la Ville des propriétés publiques nomme ${agency} comme propriétaire.`,
      cityListStatus: (status) => `Son statut sur cette liste : ${status}.`,
      cityStatuses: {
        'OWNED - AVAILABLE': ['indiqué comme disponible', 'La Land Bank le montre sur sa carte des propriétés que les gens peuvent demander.'],
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': ['indiqué comme disponible pour un accord de jardin', "Il est proposé pour le jardinage dans le cadre d'un accord avec la Land Bank."],
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': ['indiqué comme disponible, sans construction autorisée', "Il est proposé, mais rien ne peut y être construit."],
        'OWNED - AVAILABLE (NOT FOR SY)': ['indiqué comme disponible, mais pas comme jardin latéral', "Il est proposé, mais pas au voisin d'à côté comme jardin latéral."],
        'OWNED - ON HOLD FOR AHD': ['réservé au logement abordable', "Il est mis de côté pour des logements abordables, donc il n'est pas proposé aux voisins pour le moment."],
        'OWNED - NOT AVAILABLE': ['non disponible', "Les agences foncières de la Ville ne le proposent pas pour le moment."],
        'OWNED - PROCESSING APPLICANT, NOT AVAILABLE': ["quelqu'un a fait une demande", "Une demande le concernant est en cours d'examen, donc il n'est proposé à personne d'autre pour le moment."],
        'OWNED - MANAGED AND NOT AVAILABLE': ['géré et non disponible', "Une agence s'en occupe et ne le propose pas."],
        'OWNED - ON HOLD': ['en attente', "Il n'est pas proposé pour le moment."],
        'OWNED - SALE PENDING': ['vente en cours', "Une vente est en cours, donc il n'est proposé à personne d'autre."],
        'UNKNOWN - RESEARCH PENDING': ['pas encore connu', "Les agences foncières de la Ville l'examinent encore."],
        'OWNED - RFP RELEASED': ["proposé pour un projet d'aménagement", "Les agences foncières de la Ville ont lancé un appel à propositions pour l'aménager."],
        'OWNED - ON HOLD FOR HOME SD': ['réservé pour un programme de logement', "Il est réservé pour un programme que la liste appelle HOME SD, donc il n'est pas proposé aux voisins pour le moment."],
        'OWNED - HELD FOR CITY COUNCIL MEMBER': ['réservé au membre du Conseil du district', "Il est réservé au membre du Conseil municipal du district, donc il n'est pas proposé pour le moment. Le bureau du membre peut dire pourquoi."],
        'OWNED - TO BE FEATURED SOON': ['bientôt proposé', 'Les agences foncières de la Ville prévoient de le proposer bientôt.'],
        'OWNED - NOT AVAILABLE (GSI PROJECT)': ["mis de côté pour des travaux d'eaux pluviales vertes", 'Il est réservé pour des plantations que le Water Department aménage pour absorber la pluie.'],
        'OWNED - COMPETITIVE BID POSTED': ["proposé par appel d'offres", "Les agences foncières de la Ville ont demandé des offres pour l'acquérir."],
      },
      sideYard: 'La Ville le marque comme admissible au programme de jardin latéral, pour le propriétaire de la maison voisine.',
      agencies: {
        PUB: 'la Ville de Philadelphie',
        PLB: 'la Philadelphia Land Bank',
        PRA: 'la Philadelphia Redevelopment Authority',
        PHDC: 'la Philadelphia Housing Development Corporation (PHDC)',
      },
      tangledTitle: 'Le Tangled Title Fund, géré par Philadelphia VIP',
      sheriffGuide: 'Grounded in Philly : les ventes par le shérif',
      gjli: 'Le Garden Justice Legal Initiative, pour une aide juridique gratuite',
    },

    flags: {
      absentee: {
        outOfState: (where) => `Le propriétaire reçoit son courrier ailleurs : ${where} (hors de l'État).`,
        outsidePennsylvania: 'Le propriétaire reçoit son courrier ailleurs : en dehors de la Pennsylvanie.',
        outsideCity: (city) => `Le propriétaire reçoit son courrier ailleurs : ${city}, PA (en dehors de Philadelphie).`,
        outsideCityUnknown: 'Le propriétaire reçoit son courrier ailleurs : en dehors de Philadelphie.',
        poBox: 'Le propriétaire reçoit son courrier ailleurs : une boîte postale à Philadelphie.',
        elsewhere: 'Le propriétaire reçoit son courrier ailleurs : une autre adresse à Philadelphie.',
        careful:
          "C'est l'adresse où la Ville envoie les avis d'impôts. Elle peut être périmée, ou appartenir à un proche, un avocat ou un gestionnaire, et un propriétaire qui vit ailleurs peut ne pas savoir à quoi ressemble la propriété aujourd'hui.",
        next: "Écrivez au propriétaire à cette adresse pour demander avant de faire quoi que ce soit sur la propriété, et demandez au Garden Justice Legal Initiative de relire tout accord avant de le signer.",
      },
      possible_estate: {
        text: 'Il se peut que le propriétaire enregistré soit décédé.',
        careful: 'Des membres de la famille peuvent encore avoir un droit sur cette propriété et ne pas le savoir.',
        next: "Si vous connaissez la famille, le Tangled Title Fund (jusqu'à 6 500 $ d'aide juridique) et Philadelphia VIP peuvent l'aider à la garder. Les familles peuvent aussi s'inscrire aux alertes gratuites Fraud Guard de la Ville.",
      },
      tax_debt_2025: {
        text: (amount, years) =>
          `En juillet 2025, les registres de la Ville montraient ${amount} d'impôts fonciers impayés${years ? ` sur ${plural(years, { one: "# année d'imposition", other: "# années d'imposition" })}` : ''}.`,
        careful:
          "C'est le dernier registre public, du 9 juillet 2025, pas le solde d'aujourd'hui : le propriétaire a peut-être payé depuis, ou doit davantage. Environ trois ans d'impôts impayés ou plus peuvent mener à une vente par le shérif, où un terrain dont les voisins prennent soin peut être vendu à un acheteur extérieur.",
        next: "Vérifiez le solde d'aujourd'hui sur le Tax Center de la Ville avant de vous y fier. Si votre rue prend soin de ce terrain, le guide de Grounded in Philly sur les ventes par le shérif explique le risque et ce que vous pouvez faire.",
      },
      sheriff_sales: {
        one: (sale) => `Vendu par le shérif le ${sale}.`,
        many: (n, sales) => `Vendu par le shérif ${n} fois : ${sales}.`,
        sale: (date, price) => (price ? `${date}, pour ${price}` : date),
        andLast: (others, last) => `${others} ; et ${last}`,
        careful:
          "Lors d'une vente par le shérif, l'enchère gagnante efface les anciennes dettes de la propriété, donc un terrain dont les voisins ont pris soin peut passer à un acheteur extérieur. Une vente passée ne veut pas dire que la propriété est à vendre maintenant.",
        next: "Si votre rue prend soin de ce terrain, lisez le guide de Grounded in Philly sur les ventes par le shérif et demandez une aide juridique gratuite au Garden Justice Legal Initiative.",
      },
      years_since_sale: {
        lastSold: (year) => `Dernière vente en ${year}.`,
        notSoldSince: (year) => `Pas vendu sur le marché libre depuis au moins ${year}.`,
        careful:
          "Les ventes à prix symbolique et les ventes par le shérif sont exclues ici ; l'historique complet est plus bas. Beaucoup de maisons passent de génération en génération dans les familles sans nouvelle vente, donc un long temps depuis une vente ne veut pas dire que le propriétaire a abandonné la propriété.",
        next: "Si une famille a hérité de la propriété sans nouvel acte, le Tangled Title Fund et Philadelphia VIP peuvent l'aider à mettre le titre de propriété en règle et à le garder.",
      },
      many_parcels: {
        text: (n) => `Ce propriétaire détient ${formatNumber(n)} parcelles vacantes dans la ville.`,
        careful:
          "Nous associons les propriétaires par leur nom exact dans les registres de la Ville, donc un même propriétaire peut apparaître sous plusieurs orthographes et deux propriétaires peuvent partager un nom. Détenir des terrains vacants n'est pas en soi une faute.",
        next: "Utilisez la liste pour voir les autres parcelles de ce propriétaire, puis demandez la permission de façon légale : écrivez au propriétaire, et faites relire tout accord par le Garden Justice Legal Initiative.",
      },
      fast_resales: {
        since: (n, year) => `Vendu ${n} fois depuis ${year}.`,
        inYear: (n, year) => `Vendu ${n} fois en ${year}.`,
        between: (n, first, last) => `Vendu ${n} fois de ${first} à ${last}.`,
        careful:
          "Des reventes rapides peuvent signifier que la propriété est échangée pour du profit, et parfois un faux acte. Elles peuvent aussi être ordinaires, par exemple une famille qui vend une maison héritée et l'acheteur qui la revend après des réparations.",
        next: "Regardez qui a vendu et qui a acheté dans l'historique ci-dessous. Les propriétaires et les familles peuvent s'inscrire aux alertes gratuites Fraud Guard de la Ville pour savoir quand un document porte leur nom.",
      },
      open_violations: {
        one: (when, what) =>
          `L&I indique 1 infraction ouverte${what ? `, pour ${what}` : ''}${when ? `, datant du ${when}` : ''}.`,
        many: (n) => `L&I indique ${formatNumber(n)} infractions ouvertes.`,
        mostRecent: (when, what) => (what ? `La plus récente, du ${when}, concerne ${what}.` : `La plus récente date du ${when}.`),
        careful:
          "Une infraction est un avis adressé au propriétaire, qui n'a peut-être pas les moyens de la corriger, et l'état des lieux a pu changer depuis l'inspection.",
        next: "Signalez les problèmes physiques, comme des dépôts sauvages ou un bâtiment ouvert, à Philly311. Si vous connaissez le propriétaire, prévenez-le : il n'a peut-être pas vu l'avis.",
      },
      unsafe: {
        text: (since) => (since ? `L&I indique ce bâtiment comme non sûr, depuis le ${since}.` : 'L&I indique ce bâtiment comme non sûr.'),
        careful: "Tenez-vous à distance et tenez les enfants à distance : L&I a jugé la structure non sûre. N'y entrez pas et n'essayez pas de la sécuriser vous-même.",
        next: "S'il est ouvert à l'entrée, signalez-le à Philly311 pour que la Ville puisse le sceller.",
      },
      imminently_dangerous: {
        text: (since) =>
          since ? `L&I indique ce bâtiment comme en danger imminent, depuis le ${since}.` : 'L&I indique ce bâtiment comme en danger imminent.',
        careful: "L&I a constaté que la structure pourrait céder à tout moment. Tenez-vous à distance, et tenez les autres à distance.",
        next: 'Signalez tout changement, comme des briques qui tombent ou une porte ouverte, à Philly311.',
      },
    },

    history: {
      transfersTitle: 'Ventes et transferts',
      transfersCaption: 'Chaque vente et chaque transfert enregistré de cette propriété, du plus récent au plus ancien',
      date: 'Date',
      document: 'Document',
      documentAndPrice: 'Document et prix',
      fromAndTo: 'De et vers',
      price: 'Prix',
      from: 'De',
      to: 'Vers',
      noDate: 'Pas de date',
      noPrice: 'Aucun enregistré',
      share: (n) => `la part de cette propriété dans un acte portant sur ${n} propriétés`,
      more: (n) => `et ${plural(n, { one: '# autre', other: '# autres' })}`,
      noTransfers: 'Aucun acte enregistré.',
      notInCopy: (parts) =>
        `Notre copie hebdomadaire n'inclut pas ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}` : parts[0]} pour cette parcelle, donc cette page ne peut pas dire s'il y en a.`,
      partialParts: { transfers: "les registres d'actes", assessments: 'les évaluations', li: "les registres d'infractions L&I" },
      notInCopyOff: 'Les données en direct de la Ville peuvent les montrer.',
      notInCopyFailed: "La Ville n'a pas répondu. Réessayez pour les voir.",
      recordsNote: "Les registres d'actes de la Ville sont complets à partir de 2000. Les ventes plus anciennes peuvent manquer.",
      datesNote:
        "Chaque date est celle de l'acte et chaque prix est arrondi au dollar, comme le montre la page de la Ville sur la propriété ; la Ville enregistre un acte quelques jours ou semaines plus tard. Quand un acte couvrait plusieurs propriétés, le prix est la part de cette propriété.",
      documents: {
        DEED: 'Acte',
        'DEED SHERIFF': 'Acte du shérif',
        "SHERIFF'S DEED": 'Acte du shérif',
        'DEED MISCELLANEOUS': 'Acte divers',
        'MISCELLANEOUS DEED': 'Acte divers',
        'DEED MISCELLANEOUS TAXABLE': 'Acte divers, imposable',
        'MISCELLANEOUS DEED TAXABLE': 'Acte divers, imposable',
        'DEED LAND BANK': 'Acte de la Land Bank',
        'DEED OF CONDEMNATION': "Acte d'expropriation",
        'DEED - DECEASED': "Acte d'une succession",
        'DEED - ADVERSE POSSESSION': 'Acte par possession prolongée (adverse possession)',
        'DEED RTT - OTHER': 'Autre acte',
        'CERTIFICATE OF STOCK TRANSFER': "Certificat de transfert d'actions",
      },
      assessmentsTitle: 'Évaluations de la Ville',
      assessmentsCaption: "L'évaluation de la valeur marchande par la Ville, par année",
      year: 'Année',
      marketValue: 'Valeur marchande évaluée',
      noValue: 'Non enregistré',
      noAssessments: 'Aucune évaluation enregistrée.',
      assessmentNote: "Une évaluation est l'estimation de la valeur marchande par la Ville pour les impôts fonciers. Ce n'est pas un prix de vente.",
      chartLabel: (first, last, low, high) =>
        `Graphique de l'évaluation de la Ville de ${first} à ${last}, entre ${low} et ${high}. Les mêmes chiffres sont dans le tableau en dessous.`,
      open: 'Ouvert',
      liSummaryOpen: (n) => plural(n, { one: '# infraction ouverte', other: '# infractions ouvertes' }),
      liSummaryLast: (date) => `Infraction la plus récente : ${date}.`,
      liUnsafe: 'L&I indique ce bâtiment comme non sûr.',
      liUnsafeSince: (date) => `L&I indique ce bâtiment comme non sûr, depuis le ${date}.`,
      liDangerous: 'L&I indique ce bâtiment comme en danger imminent.',
      liDangerousSince: (date) => `L&I indique ce bâtiment comme en danger imminent, depuis le ${date}.`,
      liSince2016: (n) => `${plural(n, { one: '# infraction enregistrée', other: '# infractions enregistrées' })} depuis 2016.`,
      liSealed: (date) => `Dernier nettoyage et scellement par la Ville le ${date}.`,
      liDemolished: (date) => `Dernière démolition achevée le ${date}.`,
      liNeither: 'Non indiqué comme non sûr ou en danger imminent.',
      liNowTitle: "L&I aujourd'hui",
      earlyDeed: 'Avant 2000 : à partir de registres que la Ville dit pouvoir être incomplets.',
      timeline: {
        storyTitle: "L'histoire de ce terrain",
        storySource: (source) => `D'après ${source}.`,
        noStory: "Les registres que nous détenons ne racontent pas encore d'histoire sur ce terrain.",
        title: 'Chronologie',
        caption: 'Tout ce qui est enregistré pour cette propriété, du plus récent au plus ancien, par année',
        intro: 'Ventes, registres de L&I, appels et registres de vacance dans une seule liste, du plus récent au plus ancien. Désactivez un type pour le masquer.',
        appeal: (board, kind) => (kind ? `${board} : ${kind}` : board),
        appealHearing: (date) => `audience du ${date}`,
        show: 'Afficher dans la chronologie',
        loading: 'Chargement de la chronologie depuis la copie hebdomadaire.',
        failed: "La chronologie n'a pas pu être chargée depuis la copie hebdomadaire.",
        unpublished: "Cette copie de la carte n'a pas encore de fichiers de chronologie.",
        liMissing: "Notre copie hebdomadaire n'inclut pas les registres de L&I pour cette parcelle, donc la chronologie ne peut pas dire s'il y en a.",
        liMissingOff: 'Les données en direct de la Ville peuvent les montrer.',
        none: 'Aucun enregistrement dans la chronologie.',
        allHidden: "Tous les types d'enregistrements sont désactivés.",
        moreYears: (n) => `Afficher ${plural(n, { one: '# année antérieure', other: '# années antérieures' })}`,
        fewerYears: 'Afficher seulement les années récentes',
        noDate: 'Pas de date',
        future: 'La Ville a daté ceci dans le futur ; son enregistrement peut être faux.',
        printTitle: 'Chronologie, les 10 enregistrements les plus récents',
        recordColumn: 'Enregistrement',
        whatColumn: "Ce qui s'est passé",
        printWaiting: "La page du terrain en ligne contient la chronologie complète ; elle n'était pas chargée quand cette page a été imprimée.",
        printMore: (n) => `${plural(n, { one: '# enregistrement plus ancien', other: '# enregistrements plus anciens' })} sur la page du terrain en ligne.`,
        noPrice: 'aucun prix enregistré',
        to: (names) => `à ${names}`,
        times: (n) => `(${formatNumber(n)} fois)`,
        permit: 'Permis',
        permitFor: (type, work) => `${type} pour ${work}`,
        violation: 'Infraction',
        demolition: 'Démolition',
        byCity: 'par la Ville',
        privatePermit: 'sous un permis privé',
        demolitionWork: {
          city: 'Démolition par la Ville',
          complete: 'Démolition complète',
          small: "Démolition d'un bâtiment de 3 étages ou moins",
          large: "Démolition d'un bâtiment de plus de 3 étages ou de 40 pieds",
          tank: 'Retrait de réservoir',
        },
        cleanSeal: 'Nettoyé et scellé par la Ville',
        cleanSealClip: 'Nettoyé et scellé par le Community Life Improvement Program de la Ville',
        kinds: {
          deed: 'Acte',
          violation: 'Infraction',
          permit: 'Permis',
          demolition: 'Démolition',
          unsafe: 'Avis de bâtiment non sûr',
          imminently_dangerous: 'Avis de bâtiment en danger imminent',
          clean_seal: 'Nettoyage et scellement',
          appeal: 'Appel',
          vacancy: 'Registre de vacance',
        },
        toggles: {
          deed: 'Ventes et transferts',
          violation: 'Infractions',
          permit: 'Permis',
          demolition: 'Démolitions',
          clean_seal: 'Nettoyage et scellement',
          notice: 'Avis de bâtiment non sûr et en danger imminent',
          appeal: 'Appels',
          vacancy: "Registres de vacance et d'entretien",
        },
        lists: {
          city_land: 'Sur la liste de la Ville des terrains vacants',
          city_building: 'Sur la liste de la Ville des bâtiments vacants',
          june_2024_land: 'Sur la liste de L&I des terrains vacants de juin 2024, tenue par Clean & Green Philly',
          june_2024_building: 'Sur la propre liste de Clean & Green Philly des bâtiments vacants de juin 2024',
        },
        landcare: (program) =>
          program === 'community_landcare'
            ? "Des voisins ont commencé à s'occuper de ce terrain avec PHS Community LandCare"
            : "PHS LandCare a commencé à s'occuper de ce terrain",
        story: {
          cityDemolished: (year) => `Un bâtiment se trouvait ici jusqu'en ${year}, quand la Ville l'a démoli.`,
          privateDemolished: (year) => `Un bâtiment se trouvait ici jusqu'en ${year}, quand il a été démoli sous un permis privé.`,
          newConstruction: (year) => `L&I a délivré un permis de construction neuve ici en ${year}.`,
          dangerous: (date) => `L&I indique le bâtiment comme en danger imminent depuis le ${date}.`,
          unsafe: (date) => `L&I indique le bâtiment comme non sûr depuis le ${date}.`,
          sealed: (year, n) =>
            n > 1
              ? `La Ville a envoyé ses équipes de nettoyage et de scellement ici pour la dernière fois en ${year} ; elle l'a fait ${formatNumber(n)} fois.`
              : `La Ville a envoyé ses équipes de nettoyage et de scellement ici en ${year}.`,
          sheriff: (year) => `Il a été vendu par le shérif en ${year}.`,
          cityList: (land, date, june) =>
            `La liste de la Ville des ${land ? 'terrains vacants' : 'bâtiments vacants'} du ${date} l'inclut${june ? ', comme le faisait une liste de juin 2024' : ''}.`,
          juneList: (land) =>
            land ? "La liste de L&I des terrains vacants de juin 2024 l'incluait." : "La liste de Clean & Green Philly des bâtiments vacants de juin 2024 l'incluait.",
          landcare: (year, program) =>
            program === 'community_landcare' ? `Des voisins s'en occupent avec PHS Community LandCare depuis ${year}.` : `PHS LandCare s'en occupe depuis ${year}.`,
          sources: {
            demolitions: 'les registres de démolition de L&I',
            permits: 'les registres de permis de L&I',
            notices: 'les registres de L&I des bâtiments non sûrs et en danger imminent',
            cleanSeal: 'les registres de nettoyage et de scellement de L&I',
            deeds: "les registres d'actes de la Ville",
            lists: (june) => (june ? 'la liste de la Ville des propriétés vacantes, et la liste de L&I de juin 2024 tenue par Clean & Green Philly' : 'la liste de la Ville des propriétés vacantes'),
            june: (land) => (land ? 'la liste de L&I de juin 2024, tenue par Clean & Green Philly' : 'la liste de juin 2024 de Clean & Green Philly'),
            landcare: "la liste de PHS LandCare des terrains dont elle s'occupe",
          },
        },
      },
    },

    nearby: {
      intro: 'Ce qui se trouve autour de ce terrain, pour que le soin aille là où il aide le plus.',
      careNote: 'Ces chiffres montrent où le soin est le plus nécessaire. Ils ne disent rien des personnes qui vivent ici.',
      areaSnapshot: "Dans la zone autour de ce terrain, d'environ deux rues de large",
      within500: 'À moins de 500 pieds de ce terrain',
      s12: (n) => `${plural(n, { one: '# personne blessée par balle', other: '# personnes blessées par balle' })} ces 12 derniers mois`,
      s36: (n) => `${plural(n, { one: '# personne blessée par balle', other: '# personnes blessées par balle' })} ces 3 dernières années`,
      killed: (n) => `${plural(n, { one: '# personne tuée', other: '# personnes tuées' })} dans des accidents de la route depuis 2019`,
      landcare: (n) => `${plural(n, { one: '# terrain entretenu', other: '# terrains entretenus' })} par PHS LandCare`,
      gardens: (n) => `${plural(n, { one: '# jardin communautaire', other: '# jardins communautaires' })}`,
      hearings: (n) => `${plural(n, { one: '# audience encore à venir', other: '# audiences encore à venir' })} sur d'autres propriétés`,
      playgroundHeading: 'Aire de jeux la plus proche',
      playground: (name, meters) =>
        `${name}, à environ ${distanceWords(meters)} en ligne droite${meters <= 400 ? ', à moins de 5 minutes à pied' : meters <= 800 ? ', à moins de 10 minutes à pied' : ''}.`,
      none: 'Pas encore de chiffres à proximité pour ce lieu.',
      showLayer: (label) => `Afficher ${label} sur la carte`,
    },

    sources: {
      intro: "D'où vient chaque partie de cette page, et à quel point elle est récente.",
      live: (time) => `en direct de la Ville à ${time}`,
      snapshot: (date) => `instantané hebdomadaire du ${date}`,
      snapshotNoDate: 'instantané hebdomadaire',
      newest: (date) => `enregistrement le plus récent : ${date}`,
      taxSnapshot: 'dernier instantané de Clean & Green Philly, 9 juillet 2025',
      by: (publisher) => `de ${publisher}`,
      correction: 'Signaler une correction',
      correctionHelp: "Ouvre un formulaire sur GitHub, rempli avec cette parcelle. L'envoyer demande un compte GitHub gratuit.",
      ownerNote:
        "Si vous êtes propriétaire de ce bien et qu'un registre de la Ville à son sujet est faux, le service de la Ville qui tient le registre peut le corriger à la source : le service d'évaluation foncière (Office of Property Assessment) pour les noms de propriétaires, les adresses postales et les évaluations, le service des registres (Department of Records) pour les actes, et le service des permis et inspections (Licenses and Inspections) pour les infractions et les permis.",
    },

    ownerList: {
      title: 'Les parcelles de ce propriétaire sur notre liste',
      intro: (names) => `Parcelles de notre liste dont le propriétaire est enregistré sous ${names}.`,
      others: 'Autres parcelles de notre liste dont le propriétaire est enregistré sous les mêmes noms que celui-ci.',
      loading: 'Chargement de la liste',
      missing: "Cette liste n'est pas disponible pour le moment.",
      open: (address) => `Ouvrir la page du terrain de ${address}`,
      kind: (kind, confidence) => (confidence ? `${kind}, ${confidence.toLowerCase()}` : kind),
    },

    print: {
      printed: (date) => `Imprimé depuis Placekeepers le ${date}.`,
      recent: 'Historique récent',
      moreOnline: (n) => `${plural(n, { one: '# enregistrement de plus', other: '# enregistrements de plus' })} sur la page du terrain en ligne.`,
      lastAssessment: (year, value) => `Évaluation de la Ville pour ${year} : ${value}.`,
      moreSources: (n) => `${plural(n, { one: '# source de plus', other: '# sources de plus' })} sur la page du terrain en ligne.`,
      taxCenter: (url) => `Solde d'aujourd'hui : le Tax Center de la Ville, ${url}`,
      rules: 'Règles pour ce terrain',
    },

    rules: {
      intro:
        "Ce que disent les registres de la Ville et les registres fédéraux sur ce qui s'applique à ce terrain : désignation historique, zonage et ses zonages superposés, registres de brownfield, et appels devant les comités de la Ville. Rien de cela ne dit si l'on peut construire ici. Demandez au service nommé avant de planifier quoi que ce soit.",
      notOnList:
        "Les règles sont établies chaque semaine pour les terrains de notre liste, et cette parcelle n'y est pas. Atlas, la carte de la Ville, montre son zonage et ses zonages superposés, et la Historical Commission peut dire si elle est historique.",
      hearingTitle: 'Une audience approche',
      hearingSet: (board, date, time) => `Une audience ${board} sur ce terrain est fixée au ${date}${time ? `, à ${time}` : ''}.`,
      hearingBoard: {
        zoning: 'de zonage',
        li_review: 'devant le L&I Review Board',
        building: 'devant le Board of Building Standards',
        other: 'devant un comité de la Ville',
      },
      seeAppeal: "Voir l'appel",
      historicTitle: 'Désignation historique',
      inDistrict: (district, date) => `Ce terrain est dans ${district}${date ? `, désigné le ${date}` : ''}.`,
      districtName: (name) => (/district/i.test(name) ? `le ${name}` : `le quartier historique ${name}`),
      listed: (date) => `Cette propriété est inscrite séparément au Philadelphia Register of Historic Places depuis le ${date}.`,
      listedNoDate: 'Cette propriété est inscrite séparément au Philadelphia Register of Historic Places.',
      listedInDistrict: (district) => `Cette propriété figure au Philadelphia Register of Historic Places au titre de ${district}.`,
      askFirst:
        "Les changements ici peuvent nécessiter l'examen de la Historical Commission ; demandez-leur d'abord. Pour une fresque ou un jardin, demandez à la Commission avant de commencer.",
      contact: 'Philadelphia Historical Commission : 215 686 7660, preservation@phila.gov.',
      confirm: "La Ville demande à tout le monde de confirmer le statut historique d'une propriété auprès de la Commission.",
      commissionSite: 'Le site web de la Historical Commission',
      projectReview: 'Comment la Commission examine les travaux sur les propriétés historiques',
      findHistoric: 'Trouver une propriété ou un quartier historique',
      notHistoric: "Les registres de la Historical Commission n'indiquent pas ce terrain comme historique. Demandez à la Commission pour en être sûr.",
      zoningTitle: 'Zonage',
      base: (code, group) => `Zonage de base : ${code}${group ? `, ${group}` : ''}.`,
      zoningGroups: {
        'RESIDENTIAL/MULTI-FAMILY/RESIDENTIAL MIXED-USE': 'un quartier résidentiel',
        'COMMERCIAL/COMMERCIAL MIXED-USE': 'un quartier commercial et à usage mixte',
        'INDUSTRIAL/INDUSTRIAL MIXED-USE': 'un quartier industriel',
        'SPECIAL PURPOSE': "un quartier à usage spécial, comme les parcs, les institutions ou l'aéroport",
      },
      basePending: 'Un projet de loi en attente au Conseil municipal le changerait.',
      readBill: 'Lire le projet de loi',
      overlaysIntro: (n) => (n === 1 ? 'Un zonage superposé ajoute ses propres règles ici :' : `${formatNumber(n)} zonages superposés ajoutent leurs propres règles ici :`),
      noOverlays: 'Aucun zonage superposé ne couvre ce terrain.',
      overlayKinds: { 1: 'Zonage superposé', 2: 'Règle spéciale', 3: 'Limite sur le revêtement' },
      readRule: (section) => (section ? `Lire la règle : section ${section} du Code de zonage` : 'Lire la règle dans le Code de zonage'),
      sunset: (date) => `Prévu pour prendre fin le ${date}.`,
      pending: (bill) => `Un projet de loi en attente au Conseil municipal${bill ? `, le projet ${bill},` : ''} le changerait.`,
      zoningNote:
        "Le zonage et les zonages superposés peuvent changer ce qui est permis sur un terrain. Les cartes de la Ville peuvent être en retard sur les nouveaux projets de loi, donc vérifiez auprès du service de zonage de la Ville avant de planifier.",
      zoningHelp: "L'aide de la Ville pour le zonage et l'urbanisme",
      atlasZoning: 'Cette adresse sur Atlas, la carte de la Ville',
      overlayMeaning: {
        '/CTR': 'Règles supplémentaires pour Center City : usages, enseignes, hauteurs de bâtiments, stationnement et façade sur rue.',
        '/NCO': "Règles qui gardent les nouveaux bâtiments et les extensions en harmonie avec ce quartier.",
        '/NCA': 'Règles pour les commerces et les usages le long de cette rue commerçante.',
        '/TOC': "Règles près d'une gare qui favorisent les logements et les commerces proches des transports.",
        '/NIS': "Règles sur les endroits où un site d'injection supervisée peut ouvrir. Il couvre la plus grande partie de la ville.",
        '/MIN': 'Règles sur les logements abordables dans les nouveaux ensembles de logements.',
        '/AHP': 'Règles qui encouragent la conservation des logements abordables.',
        '/AHC': "Limites de hauteur près de l'aéroport.",
        '/HHC': "Limites de hauteur près d'un héliport.",
        '/ENV': "Règles qui protègent des éléments naturels comme les arbres, les pentes raides et les cours d'eau.",
        '/WWO': "Règles qui protègent le Wissahickon Creek et ses cours d'eau.",
        '/DRC': 'Règles pour les terrains le long du fleuve Delaware.',
        '/CDO': 'Règles pour le front de fleuve du Central Delaware.',
        '/FNE': 'Règles supplémentaires pour le Far Northeast.',
        '/NE': 'Règles supplémentaires pour le Northeast.',
        '/UED': 'Règles sur les grands écrans lumineux et les enseignes.',
        council: "Règles supplémentaires fixées par le Conseil municipal pour une partie d'un district du Conseil.",
        flood: "Règles de protection contre les inondations : limites sur la construction et le remblai là où les crues arrivent.",
        steep: 'Limites sur la construction et le terrassement sur les pentes raides.',
        coverage: "Limite la part d'un terrain qui peut être couverte par des bâtiments et du revêtement, pour protéger le Wissahickon Creek.",
        animal: "Une zone où le Code de zonage permet de garder certains animaux de ferme, selon ses règles.",
        signs: 'Règles sur les enseignes et les panneaux publicitaires.',
        childCare: "Règles sur la garde d'enfants en famille à domicile.",
        parking: 'Règles sur la quantité de stationnement dont les nouveaux bâtiments ont besoin.',
        loading: 'Règles sur les zones de chargement des bâtiments.',
        dispensary: "Règles sur la distance à laquelle un dispensaire de cannabis médical peut se trouver d'autres lieux.",
        institutional: 'Règles pour les institutions le long de Germantown Avenue.',
        pump: "Règles près d'une station de pompage d'eau.",
        floorArea: 'Règles sur la surface de plancher que les bâtiments peuvent avoir.',
        waterfront: 'Retraits obligatoires pour les constructions le long de la rive.',
        overlay: 'Un zonage superposé ajoute ses propres règles par-dessus le zonage de base ici.',
        supplemental: 'Une règle spéciale que le Code de zonage ajoute pour ce secteur.',
      },
      brownfieldTitle: 'Registres de brownfield',
      brownfield:
        "Une évaluation ou une dépollution fédérale de site brownfield a été enregistrée à cette adresse ou près d'elle. Testez le sol avant de cultiver de la nourriture.",
      brownfieldSite: (name, feet) => `${name}, à environ ${formatNumber(feet)} pieds de ce terrain`,
      onLot: 'sur ce terrain',
      brownfieldMore: (n) => `et ${plural(n, { one: '# enregistrement de plus', other: '# enregistrements de plus' })} dans un rayon d'environ 330 pieds`,
      brownfieldNote: "Les registres de l'EPA montrent où une subvention fédérale pour brownfield a payé des travaux. Ils ne disent pas ce qui se trouve dans le sol aujourd'hui.",
      soilTest: 'Le test de sol de Penn State Extension',
      gardenGuide: "Le guide de l'EPA sur le jardinage dans les sols urbains",
      epaRecord: "Cet enregistrement à l'EPA",
      appealsTitle: 'Appels et audiences',
      appealsIntro: "Les appels devant les comités de la Ville au sujet de cette propriété, du plus récent au plus ancien, tels que la Ville les publie.",
      noAppeals: "Aucun appel devant les comités de la Ville n'est enregistré pour cette propriété.",
      appealsMissing: "Notre copie hebdomadaire a été construite sans les registres d'appels de la Ville, donc cette page ne peut pas dire s'il y en a.",
      appealsMissingOff: 'Les données en direct de la Ville peuvent les montrer.',
      boards: {
        zoning: 'Zoning Board of Adjustment',
        li_review: 'L&I Review Board',
        building: 'Board of Building Standards',
        other: 'Un autre comité de la Ville',
      },
      comingUp: 'À venir',
      filed: (date) => `Déposé le ${date}`,
      hearingOn: (date, time, upcoming) => `${upcoming ? 'Audience fixée au' : 'Audience du'} ${date}${time ? `, à ${time}` : ''}`,
      decidedOn: (date) => `Décidé le ${date}`,
      status: (status) => `Statut : ${status}`,
      decision: (decision) => `Décision : ${decision}`,
      rco: (name) => `La Ville a informé cette organisation communautaire enregistrée (RCO) : ${name}.`,
      filedBy: 'Déposé par',
      ownerNamed: 'Propriétaire nommé',
      namesNote: "Les noms sont tels que la Ville les publie. Ils apparaissent seulement sur la page de ce terrain, jamais sur la carte ni dans les téléchargements.",
      grounds: "Lire l'appel et ses motifs auprès de la Ville (historique de la propriété sur L&I)",
      takePart: {
        zoning: 'Comment participer à une audience de zonage',
        li_review: 'Le L&I Review Board',
        building: 'Le Board of Building Standards',
        other: 'Le calendrier des appels de la Ville',
      },
      calendar: 'Le calendrier des audiences de la Ville',
      decisions: {
        'GRANTED/PROV': 'Accordé sous conditions',
        'DENIED/PROV': 'Refusé sous conditions',
        'DISMI/ENFORC': 'Rejeté',
        'ADMIN/REVIEW': 'Renvoyé pour examen administratif',
        'HELD/INFO': "En attente de plus d'informations",
        NEWHEARNOT: 'Nouvelle audience non accordée',
        BOARDAKNOWL: 'Pris en compte par le comité',
        'LATE-APPRVD': 'Appel tardif approuvé',
        'CITY AFFIRMED': 'La décision de la Ville est maintenue',
        AFFIRMED: 'La décision de la Ville est maintenue',
      },
      missing: {
        historic: "Notre copie hebdomadaire a été construite sans le registre historique, donc cette page ne peut pas dire si ce terrain est historique. Demandez à la Historical Commission.",
        overlays: "Notre copie hebdomadaire a été construite sans les zonages superposés, donc cette page ne peut pas les lister. Atlas, la carte de la Ville, les montre.",
        brownfields: "Notre copie hebdomadaire a été construite sans les registres de brownfield de l'EPA, donc cette page ne peut pas dire s'il y en a à proximité.",
      },
      none: 'Aucun de ces registres ne nomme ce terrain.',
    },
  },

  // @@NEXT@@
};

export default fr;
