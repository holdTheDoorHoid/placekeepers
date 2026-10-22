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
    unsafe: "L&I l'indique comme dangereux, sans permis depuis",
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
    hin: 'Rue du réseau des rues à blessures graves (High Injury Network)',
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

  // @@NEXT@@
};

export default fr;
