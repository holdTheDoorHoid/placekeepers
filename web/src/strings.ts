// Every piece of interface text lives here, so the site can be translated (Spanish first)
// and checked for plain language in one place. Text that the registry defines (layer
// labels, descriptions, routes, sources) comes from registry/*.yaml instead.
//
// House style: plain words a neighbor understands, and no dashes as punctuation.
// tests/strings.test.ts enforces the dash rule.

import type { Evidence } from './registry/types.ts';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'America/New_York' });
const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const shortDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/New_York',
});
const numberFormat = new Intl.NumberFormat('en-US');

/** Formats a date or timestamp in words, for example "October 5, 2026". Returns null if unreadable. */
export function formatDate(value: string | null | undefined, style: 'long' | 'short' = 'long'): string | null {
  if (!value) return null;
  // A bare date (2026-10-01) has no time zone; show it as written.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : style === 'long' ? dayFormat.format(d) : shortDateFormat.format(d);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return style === 'long' ? dateFormat.format(d) : shortDateFormat.format(d);
}

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

/** Whole dollars, for example "$1,500"; half a dollar rounds up, as on the City's property page. */
export function formatMoney(n: number): string {
  return moneyFormat.format(Math.round(n));
}

/** A time of day in Philadelphia, for example "2:14 PM". */
export function formatTime(ms: number): string {
  return timeFormat.format(new Date(ms));
}

/** CITY WORDS become "City words": for descriptions the City writes in capitals. */
export function sentenceCase(text: string): string {
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return lower ? lower[0]!.toUpperCase() + lower.slice(1) : lower;
}

function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** A change in percent in words: "up 61%", "down 3%", "unchanged". */
function changeWords(n: number): string {
  if (n > 0) return `up ${formatNumber(n)}%`;
  if (n < 0) return `down ${formatNumber(-n)}%`;
  return 'unchanged';
}

export const strings = {
  app: {
    name: 'Placekeepers',
    tagline: 'A free map for Philadelphia neighbors who care for their blocks.',
    mapLabel: 'Map of Philadelphia. The lists of places and memorials on this page show the same things as text.',
    loadingMap: 'Loading the map',
    mapFailed: 'The map could not start in this browser. Try another browser, or update this one.',
    sampleData: 'Sample data for testing. These are not real places.',
    earlyPreview: 'Version 0.1: a first public version. Check facts with the City before you act.',
    followAlong: 'Follow along',
    repoUrl: 'https://github.com/holdTheDoorHoid/placekeepers',
    skipToList: 'Skip to the list of places',
    hideNote: 'Hide',
    hideNoteLabel: 'Hide this note',
    close: 'Close',
    notAffiliated: 'Not affiliated with the City of Philadelphia or SEPTA. Not legal advice.',
    licenses: 'Code: GPL-3.0. Data: each source has its own license. Writing: Creative Commons BY-SA 4.0.',
  },

  content: {
    /** The name screen readers give a table box on a content page, which scrolls sideways. */
    tableLabel: 'Table, scrolls sideways',
  },

  header: {
    settings: 'Settings',
    share: 'Copy link',
    shareDone: 'Link copied. Anyone who opens it sees this same map.',
    shareDoneNoMap: 'Link copied. It leaves out where the map is, because the map is showing where you are.',
    shareFailed: 'Could not copy the link. Copy the address from your browser instead.',
    dataStatus: 'Data status',
  },

  nav: {
    menu: 'Menu',
    menuTitle: 'Site menu',
    menuLabel: 'Site pages',
    map: 'Map',
    pages: [
      { slug: 'about', label: 'About' },
      { slug: 'why', label: 'Why this works' },
      { slug: 'how', label: 'How to do it' },
      { slug: 'responsibly', label: 'Use this responsibly' },
      { slug: 'vacant-land', label: 'How we find vacant land' },
      { slug: 'streetcomplete', label: 'Survey bus stops' },
      { slug: 'terms', label: 'Terms' },
      { slug: 'privacy', label: 'Privacy' },
      { slug: 'contact', label: 'Contact' },
    ] as { slug: string; label: string }[],
  },

  views: {
    groupLabel: 'Choose a view',
    field: 'Field',
    analysis: 'Analysis',
    fieldLong: 'Field view',
    analysisLong: 'Analysis view',
    fieldHint: 'For standing on the block: places nearby and the first legal step.',
    analysisHint: 'For organizers: lenses, filters, details and a ranked list.',
    auto: 'Pick a view for my screen size',
    autoHint: 'Phones get the field view; larger screens get the analysis view.',
  },

  freshness: {
    checking: 'Checking data',
    ok: (date: string) => `Data from ${date}`,
    stale: 'Some data is out of date',
    failing: 'Some data is not loading',
    unknown: 'Data status unknown',
  },

  field: {
    nearMe: 'Near me',
    nearMeBusy: 'Finding you',
    nearMeDenied: 'Location is turned off for this site. You can still move the map by hand.',
    nearMeUnavailable: 'Your device could not find your location. You can still move the map by hand.',
    nearMeUnsupported: 'This browser cannot share your location. You can still move the map by hand.',
    nearMeOutside: 'You seem to be outside Philadelphia. This map covers Philadelphia only.',
    nearMePrivacy: 'Your location stays on your device. Placekeepers never sends it anywhere and never puts it in a link.',
    youAreHere: 'You are here',
    stopLocation: 'Stop using my location',
    locationInUse: 'Using your location. It stays on this device, and out of any link you copy.',
    /** The short button beside that note; its full name for screen readers is stopLocation. */
    stop: 'Stop',
    myLists: 'My lists',
    listsTitle: 'Saved lists',
    chipsLabel: 'Main layers',
    moreLayers: 'More layers',
    layersTitle: 'Layers',
  },

  chips: {
    lots: 'Lots',
    streets: 'Streets',
    memorials: 'Memorials',
    stops: 'Bus stops',
    comingSoon: 'coming soon',
  },

  sheet: {
    title: 'What you can do nearby',
    show: 'Show places nearby',
    hide: 'Hide places nearby',
    countLabel: (n: number) => plural(n, 'place', 'places'),
    zoomIn: 'Move or zoom the map to a neighborhood to see places nearby.',
    finding: 'Finding the places nearby.',
    noLotsLayer: 'Turn on the Lots or Bus stops layer to see places nearby.',
    nothingHere: 'No vacant lots or buildings match your settings in this part of the map.',
    nothingHereStops: 'No vacant lots, buildings or bus stops match your settings in this part of the map.',
    noStopsHere: 'No bus or trolley stops match your settings in this part of the map.',
    showOnMap: 'Show on map',
    openLotPage: 'Open lot page',
    nearestToYou: 'Nearest to you first.',
    nearestToCenter: 'Nearest to the middle of the map first. Move the map, or tap Near me.',
    noneWithSuggestion: 'No place here has a suggestion that is turned on. Turn suggestions on in Settings, or move the map.',
    showMore: 'Show more places',
    distance: (meters: number, fromYou: boolean) => {
      const feet = meters * 3.28084;
      const far = feet < 1000 ? `${formatNumber(Math.max(10, Math.round(feet / 10) * 10))} feet` : `${(feet / 5280).toFixed(1)} miles`;
      return `About ${far} from ${fromYou ? 'you' : 'the middle of the map'}`;
    },
  },

  place: {
    kindLot: 'Vacant lot',
    kindBuilding: 'Vacant building',
    kindUnknown: 'Vacant parcel',
    parcel: (id: string) => `Parcel ${id}`,
    priority: (score: number, lens: string) => `Priority ${score} of 100 for ${lens.toLowerCase()}`,
    mainReason: (label: string) => `Main reason: ${label}.`,
    bestSuggestion: 'What you could do',
    firstStep: 'First legal step',
    cost: (cost: string) => `Cost: ${cost}`,
    confidence: { 1: 'We are not very sure it is vacant', 2: 'Probably vacant', 3: 'Very likely vacant' } as Record<
      number,
      string
    >,
    confidenceTitle: 'How sure we are',
    ownerTitle: 'Owner type',
    landcare: 'Already maintained by PHS LandCare',
    suggestionsTitle: 'Suggestions',
    clearSelection: 'Clear selection',
    selectedTitle: 'Selected place',
  },

  ownerTypes: {
    0: 'Unknown',
    1: 'Individual',
    2: 'Company',
    3: 'City of Philadelphia',
    4: 'Philadelphia Land Bank',
    5: 'Redevelopment Authority',
    6: 'Housing authority',
    7: 'Nonprofit',
    8: 'Other public agency',
  } as Record<number, string>,

  why: {
    title: 'Why this score',
    caption: "Each factor's value from 0 to 100, its weight, and the points it adds to the score",
    intro: 'The score is a weighted average of these factors. Each runs from 0 to 100, where 100 means the most need.',
    factor: 'Factor',
    value: 'Out of 100',
    weight: 'Weight',
    adds: 'Adds',
    noData: 'no data',
    off: 'off',
    total: 'Score',
    missingNote: 'Factors with no data for this place are left out of its average.',
  },

  // The vacancy model's reasons for a parcel, one sentence per bit of the tile property `rs`
  // (docs/CONTRACTS.md section 4). Bits 12 and up are reasons for doubt. `date` is the City
  // list's date in words; `year` comes from the tile (dy, sy or ny) and may be missing.
  reasons: {
    title: 'Why we think it is vacant',
    againstTitle: 'What gives us pause',
    notPublished: 'The reasons for this place are not published yet.',
    city_land: (date: string | null) =>
      date ? `The City lists it as likely vacant land (list dated ${date})` : 'The City lists it as likely vacant land',
    city_building: (date: string | null) =>
      date
        ? `The City lists it as a likely vacant building (list dated ${date})`
        : 'The City lists it as a likely vacant building',
    assessor_vacant_land: 'The assessor classifies it as vacant land',
    no_building: 'No building stands on the parcel',
    demolished: (year: number | null) =>
      year ? `Demolished in ${year}, with nothing built since` : 'Demolished, with nothing built since',
    vacant_lot_record: 'L&I recorded a vacant lot violation or complaint in the last two years',
    landcare: 'It is in PHS LandCare, which looks after vacant lots',
    sealed: (year: number | null) =>
      year ? `Sealed by the City in ${year}, with no permit since` : 'Sealed by the City, with no permit since',
    unsafe: 'L&I lists it as unsafe, with no permit since',
    imminently_dangerous: 'L&I declared it imminently dangerous, with no permit since',
    vacant_building_record: 'L&I recorded a vacant property violation or complaint in the last two years',
    assessor_exterior: 'The assessor noted its outside as vacant or sealed',
    built_since: (year: number | null) =>
      year
        ? `A new construction permit was issued in ${year}, so a building may stand there now`
        : 'A new construction permit was issued, so a building may stand there now',
    construction_starting: (year: number | null) =>
      year
        ? `A new construction permit was issued in ${year}, so building may be starting`
        : 'A new construction permit was issued, so building may be starting',
    side_yard: 'The owner of the lived in house next door also owns it, so it may be a side yard',
    land_use_shows_use: "The City's land use map shows it in use",
    recent_permit: 'A permit for building work or zoning was issued in the last two years',
    building_stands: 'A building footprint stands on it, although the records say vacant land',
    homestead: 'The owner has a homestead exemption: City records say someone lives here, or did',
  },

  lens: {
    title: 'Lens',
    presets: 'Presets',
    presetActive: 'in use',
    weightLabel: (factor: string) => `Weight for ${factor}`,
    weightValue: (w: number) => (w === 0 ? 'Off' : `${w} of 5`),
    resetWeights: 'Reset weights',
    allOff: 'Every factor is off. Turn one on to color the lots.',
    allOffFor: (appliesTo: string) =>
      appliesTo === 'segment'
        ? 'Every factor is off. Turn one on to color the streets.'
        : appliesTo === 'stop'
          ? 'Every factor is off. Turn one on to color the bus and trolley stops.'
          : 'Every factor is off. Turn one on to color the lots.',
    explainToggle: 'Why this factor',
    shown: (layer: string, lens: string) => `Now showing "${layer}", colored by the ${lens.toLowerCase()} lens.`,
    notShown: (layer: string) => `The map is not showing this lens on "${layer}" right now.`,
    showOnMap: 'Show it on the map',
    legendLow: 'Lower priority',
    legendHigh: 'Higher priority',
    legendNoData: 'No score',
  },

  filters: {
    title: 'Filters',
    intro:
      'Choose chips to narrow the lots on the map, the ranked list and the plot. A group with no chip chosen shows everything.',
    ownerType: 'Owner type',
    landcare: 'Already in LandCare',
    inLandcare: 'Kept up by PHS LandCare',
    notInLandcare: 'Not in LandCare',
    confidence: 'How sure we are',
    kind: 'Lot or building',
    clear: 'Clear filters',
    showAll: 'Show all',
    noneSelected: (group: string) => `Nothing is chosen under "${group}", so no lots are shown.`,
    narrowedNote: (n: number) =>
      n === 1 ? 'A filter from the analysis view is narrowing these places.' : `${formatNumber(n)} filters from the analysis view are narrowing these places.`,
  },

  // The first lawful step to get permission (`rt`, src/config/permission.ts). A category, never a
  // score: never call it easy or hard, and never use words about buying or acquiring land.
  permission: {
    title: 'First step to get permission',
    short: {
      0: 'No clear route yet',
      1: 'Community LandCare',
      2: 'Garden agreement or license',
      3: 'Ask PHDC',
      4: 'Ask the public agency',
      5: 'Ask the owner',
    } satisfies Record<0 | 1 | 2 | 3 | 4 | 5, string>,
    long: {
      0: 'No clear route yet: City records give no owner name',
      1: 'PHS LandCare already cares for it: Community LandCare stewardship',
      2: 'The City or the Land Bank owns it: a garden agreement or license',
      3: 'The Redevelopment Authority or PHDC owns it: ask PHDC',
      4: 'The housing authority or another public body owns it: ask the agency',
      5: 'A private owner: ask the owner',
    } satisfies Record<0 | 1 | 2 | 3 | 4 | 5, string>,
    notPublished: 'Not published yet',
    filterHelp:
      'Who to ask first, from the owner City records name. It is a kind of step, not a measure of how likely anyone is to say yes.',
    noRoute: 'No clear route yet: City records give no owner name. The lot page shows what we know.',
    seeLotPage: 'The lot page lists the lawful routes for this place.',
  },

  layers: {
    title: 'Layers',
    show: (label: string) => `Show ${label}`,
    details: 'About this layer',
    settings: 'Layer settings',
    sources: 'Sources',
    legend: 'Legend',
    license: 'License',
    noData: 'No data published yet',
    dataError: 'This layer could not be loaded.',
    resetAll: 'Reset to defaults',
    resetDone: 'Settings are back to their defaults.',
    guide: 'How you can help improve this layer',
  },

  settings: {
    title: 'Settings',
    intro:
      'Everything on the map is a setting. Your choices are saved in this browser and in the link, except your privacy choices, which stay in this browser only.',
    viewTitle: 'View',
    layersTitle: 'Layers and their settings',
    lensTitle: 'Lens weights',
    suggestionsTitle: 'Suggestions to show',
    suggestionShow: (label: string) => `Show "${label}"`,
    resetTitle: 'Start over',
    resetHelp: 'Puts every layer, setting and weight back to the defaults for this view, and forgets the copy saved in this browser.',
    reset: 'Reset to defaults',
    storageNote: 'Saved only in this browser. Placekeepers has no accounts, cookies or tracking.',
  },

  analysis: {
    leftTitle: 'Lens, filters and layers',
    rightTitle: 'Details',
    openLeft: 'Lens and layers',
    openRight: 'Details',
    closePanel: 'Close panel',
    areaTitle: 'In this part of the map',
    areaLots: (n: number) => plural(n, 'vacant lot', 'vacant lots'),
    areaBuildings: (n: number) => plural(n, 'vacant building', 'vacant buildings'),
    areaHigh: (n: number) => `${formatNumber(n)} of them very likely vacant`,
    areaLandcare: (n: number) => `${formatNumber(n)} already maintained by PHS LandCare`,
    areaEmpty: 'No vacant lots or buildings match your settings here. Try zooming out or changing the filters.',
    areaHint: 'Select a lot on the map or in the list to see why it scores the way it does.',
    // Zoomed out, the map draws only a sample of the parcels (src/places/sample.ts).
    sampleArea:
      'Zoomed out this far, the map shows only a sample of the vacant lots and buildings, so they are not counted here. Zoom in to count every place.',
    sampleList:
      'Zoom in to list every place. Zoomed out this far, the map shows only a sample of the vacant lots and buildings, so a list or a plot here would leave places out.',
    sampleTab: 'zoom in',
    tableCaption: 'Places in view, ranked by the current lens blend',
    rank: 'Rank',
    place: 'Place',
    score: 'Score',
    reason: 'Main reason',
    save: 'Save',
    sortHighFirst: 'Highest score first. Choose to put the lowest first.',
    sortLowFirst: 'Lowest score first. Choose to put the highest first.',
    tableEmpty: 'Nothing to rank in view.',
    noScores: 'Priority scores are not published yet, so this list is in parcel number order.',
    tableMore: (shown: number, total: number) =>
      `Showing the first ${formatNumber(shown)} of ${formatNumber(total)}. Zoom in or narrow the filters to see the rest, or download them all.`,
    drawerLabel: 'Places in view',
    tabTable: 'Ranked list',
    tabPlot: 'Need and first step',
    tabLists: 'Saved lists',
    tabMemorials: 'Memorials',
  },

  // The plot of need against the first step to get permission (docs/DESIGN.md section 5.4).
  plot: {
    title: 'Need and the first step to get permission',
    intro:
      'Each dot is a place in view. Across: its priority under your lens blend, from 0 to 100. Down: the first step to get permission, a kind of step, not a measure of how likely anyone is to say yes. Choose a dot to open its lot page.',
    axisX: 'Priority under your lens blend',
    empty: 'No places in view to plot.',
    noScore: (n: number) => `${plural(n, 'place has', 'places have')} no score and ${n === 1 ? 'is' : 'are'} not shown.`,
    noStep: (n: number) => `${plural(n, 'place has', 'places have')} no first step published yet and ${n === 1 ? 'is' : 'are'} not shown.`,
    dot: (place: string, score: number, step: string) => `${place}: priority ${score}. ${step}.`,
    tableNote: 'The ranked list shows the same places, with the same first step, for keyboards and screen readers.',
    capped: (shown: number, total: number) =>
      `Showing the ${formatNumber(shown)} places with the highest scores of ${formatNumber(total)} in view. Zoom in to see them all.`,
    summary: (rows: string) => `Places in view by the first step to get permission: ${rows}.`,
    rowSummary: (label: string, n: number) => `${label}, ${plural(n, 'place', 'places')}`,
  },

  // Downloads of places in view or of a saved list (docs/ETHICS.md, "Bulk export"). The notes at
  // the top of a CSV file avoid commas, so they stay on one line in a spreadsheet.
  export: {
    title: 'Download these places',
    help: (limit: number) =>
      `A file with up to ${formatNumber(limit)} places and what each lot page says about the owner, including the owner flags. Its first line points to the terms of use.`,
    csv: 'Download CSV',
    geojson: 'Download GeoJSON',
    inView: 'Places in view',
    working: (done: number, total: number) => `Gathering owner details: ${formatNumber(done)} of ${formatNumber(total)} files`,
    done: (n: number) => `Downloaded ${plural(n, 'place', 'places')}.`,
    leftOut: (n: number, limit: number) =>
      `${plural(n, 'more place was', 'more places were')} left out, because a download holds at most ${formatNumber(limit)}. Zoom in or narrow the filters to download the rest.`,
    withoutDetails: (n: number) => `${plural(n, 'place has', 'places have')} no published details, so ${n === 1 ? 'its' : 'their'} owner columns are empty.`,
    nothing: 'There are no places to download.',
    sampleOff: 'Downloads hold every place in view, and zoomed out this far the map shows only a sample. Zoom in to download.',
    failed: 'The download could not be made. Try again in a moment.',
    yes: 'yes',
    no: 'no',
    termsLine: (url: string) => `Placekeepers export: for community care and lawful action only. Read the terms of use first: ${url}`,
    madeLine: (n: number, title: string, day: string, dataDay: string | null) =>
      `${plural(n, 'place', 'places')} from ${title}. Made on ${day}${dataDay ? ` from the weekly data of ${dataDay}` : ''}.`,
    ownerLine:
      'Owner names and mailing addresses are as the City publishes them. Every owner flag has a careful note and a protective next step: read them on the lot page before you act. Not legal advice.',
    scoreLine: (lens: string, weights: string) => `Scores use the ${lens} lens with these weights: ${weights}.`,
    greeningLine: (caution: string) => `About greening suggestions: ${caution}`,
  },

  // Saved lists, kept only in this browser (src/places/lists.svelte.ts).
  lists: {
    title: 'Saved lists',
    privacy:
      'Lists stay in this browser, on this device. Nothing is sent anywhere. To move a list to another device or share it, download it as a file and open that file there.',
    notKept:
      'This browser is not keeping lists right now, perhaps a private window or blocked storage. Download your list before you close the page.',
    empty: 'No lists yet. Save a place from its card, the ranked list or its lot page, and a list starts.',
    inUse: 'List in use',
    defaultName: 'My list',
    untitled: 'List',
    newList: 'New list',
    newName: 'Name for the new list',
    create: 'Make the list',
    rename: 'Rename',
    renameLabel: 'New name for this list',
    saveName: 'Save the name',
    cancel: 'Cancel',
    delete: 'Delete this list',
    made: (name: string) => `Made the list "${name}". Places you save now go to it.`,
    renamed: (name: string) => `The list is now called "${name}".`,
    deleted: (name: string) => `Deleted "${name}" from this browser.`,
    confirmDelete: (name: string, n: number) =>
      `Delete "${name}" and its ${plural(n, 'place', 'places')} from this browser? It cannot be brought back unless you downloaded it.`,
    count: (n: number) => plural(n, 'place', 'places'),
    noPlaces: 'This list is empty. Save places from their cards, the ranked list or their lot pages.',
    open: (place: string) => `Open the lot page for ${place}`,
    remove: 'Remove',
    removeLabel: (place: string) => `Remove ${place} from the list`,
    save: 'Save to my list',
    saveShort: 'Save',
    savedShort: 'Saved',
    saveShortLabel: (place: string, list: string) => `Save ${place} to ${list}`,
    saveTo: (name: string) => `Save to ${name}`,
    saved: (name: string) => `Saved to ${name}`,
    savedLabel: (name: string) => `Saved to ${name}. Choose to remove it.`,
    added: (name: string) => `Saved to "${name}". Lists stay in this browser.`,
    removed: (name: string) => `Removed from "${name}".`,
    full: (limit: number) => `This list is full: a list holds up to ${formatNumber(limit)} places.`,
    tooMany: (limit: number) => `This browser keeps up to ${formatNumber(limit)} lists. Delete one to make another.`,
    download: 'Download this list',
    importTitle: 'Open a list file',
    importHelp: 'A CSV or GeoJSON file downloaded from Placekeepers, or any text file of nine digit parcel numbers.',
    imported: (name: string, n: number) => `Opened "${name}" with ${plural(n, 'place', 'places')}.`,
    importFailed: 'That file has no parcel numbers we could read.',
    importTooBig: 'That file is too large to be a list.',
    importLeftOut: (n: number, limit: number) => `${plural(n, 'place was', 'places were')} left out: a list holds up to ${formatNumber(limit)}.`,
  },

  // The caution beside every greening suggestion (docs/ETHICS.md, "Displacement", word for word;
  // docs/VERIFICATION.md, decision D12), and the displacement watch (M4.1, src/displacement/):
  // in a watch area the card adds the area's signs and the ways to protect neighbors.
  displacement: {
    caution: 'Greening can raise nearby prices. Consider pairing it with protections.',
    protections: 'Ways to protect neighbors',
    inWatch: (signs: string) => `This place is in a displacement watch area, with signs that prices are rising here: ${signs}.`,
    protectionsTitle: 'Protections to pair it with',
    protectionLabels: {
      neighborhood_gardens_trust: 'Neighborhood Gardens Trust',
      community_land_trust: 'Community land trusts',
      homestead_exemption: "The City's Homestead Exemption",
      longtime_owner_occupants: "The City's Longtime Owner Occupants Program (LOOP)",
      tangled_title_help: 'Help with a tangled title',
    } as Record<string, string>,
    checked: (date: string) => `checked ${date}`,
    signShort: {
      prices: 'home prices rising faster than across the city',
      assessments: "the City's assessed values rising faster than across the city",
      mva: "the City's Market Value Analysis finds rising pressure",
      companies: 'companies buying many of the homes sold',
      renters: 'most homes rented',
    },
    // A tapped watch area (src/components/displacement/WatchDetails.svelte).
    heading: 'Signs that prices are rising here',
    areaTitle: (tract: string) => `Census tract ${tract}`,
    around: (place: string) => `Around ${place}`,
    signsHere: 'Signs here',
    alsoMeasured: 'Also measured, not a sign here',
    signTitle: {
      prices: 'Home sale prices',
      assessments: "The City's assessed values",
      mva: "The City's Market Value Analysis",
      companies: 'Buyers that are companies',
      renters: 'Renters',
    },
    span: (a0: string, a1: string, b0: string, b1: string) => `sales of ${a0} to ${a1} and of ${b0} to ${b1}`,
    pricesText: (p0: string, p1: string, change: number, city: number | null, span: string) =>
      `The middle price of the homes sold went from ${p0} to ${p1}, ${changeWords(change)}${city === null ? '' : `, against ${changeWords(city)} across the city`}${span ? ` (${span})` : ''}.`,
    companiesText: (share: number, sales: number, city: number | null) =>
      `Companies bought ${share}% of the ${formatNumber(sales)} homes sold in the last three years${city === null ? '' : `, against ${city}% across the city`}.`,
    assessmentsText: (change: number, homes: number, city: number | null, years: readonly [number, number] | null) =>
      `The City's market value of the middle home went ${changeWords(change)}${years ? ` from ${years[0]} to ${years[1]}` : ''} (${plural(homes, 'home', 'homes')})${city === null ? '' : `, against ${changeWords(city)} across the city`}.`,
    rentersText: (share: number, city: number | null, years: readonly [number, number] | null) =>
      `${share}% of the homes people live in here are rented${city === null ? '' : `, against ${city}% across the city`}${years ? ` (Census Bureau survey, ${years[0]} to ${years[1]})` : ''}.`,
    mvaText: (rising: number, groups: number, edition: string | null) =>
      rising > 0
        ? `In ${rising} of the ${plural(groups, 'block group', 'block groups')} here, Reinvestment Fund's ${edition ?? 'Market Value Analysis'} for the City finds rising pressure: home prices climbing out of reach of what longtime residents earn.`
        : `In none of the ${plural(groups, 'block group', 'block groups')} here does the ${edition ?? 'Market Value Analysis'} find rising pressure.`,
    mvaNone: 'The Market Value Analysis does not cover this area.',
    tooFewSales: (earlier: number, recent: number, needed: number) =>
      `Too few home sales to tell (${formatNumber(earlier)} and ${formatNumber(recent)}; at least ${formatNumber(needed)} in each period are needed).`,
    tooFewHomes: 'Too few homes with values in both years to tell.',
    tooFewHouseholds: 'Too few households in the Census survey to tell.',
    rule: 'An area is in the watch when at least two of these signs hold, and at least one of them is about prices: sale prices, assessed values or the Market Value Analysis.',
    meaning: 'Greening and other improvements here can raise prices further. Pair them with protections for the neighbors who live here now.',
    cannotTell:
      'These are signs in public records, not a forecast. They cannot tell who has moved away or why, what rents are, or who lives here, and an area outside the watch can still feel rising prices.',
    legendArea: 'An area with signs that prices are rising',
    legendTap: 'Tap inside an area, or its edge close in, to see its signs.',
    legendNote: 'Signs in public records, not a forecast. Greening cards in these areas add ways to protect neighbors.',
    exportColumn: (signs: string) => `Displacement watch area: ${signs}`,
    exportLine: (caution: string, links: string) => `About greening in displacement watch areas: ${caution} Ways to protect neighbors: ${links}`,
    printTitle: 'Displacement watch',
  },

  evidence: {
    strong: { label: 'Strong evidence', meaning: 'A randomized trial, ideally in Philadelphia, found the effect.' },
    moderate: {
      label: 'Moderate evidence',
      meaning: 'Careful before and after comparisons with control areas found the effect.',
    },
    mixed: { label: 'Mixed evidence', meaning: 'Good studies disagree, or the effect depends on context.' },
    weak: { label: 'Weak evidence', meaning: 'Only perception surveys or correlations, or one small study.' },
    not_violence: {
      label: 'Not about violence',
      meaning: 'Valuable for other reasons. No claim is made about violence.',
    },
    context: {
      label: 'Context',
      meaning: 'Background that shows where care can help most. It is not a claim about what works.',
    },
  } satisfies Record<Evidence, { label: string; meaning: string }>,

  legend: {
    parcelsFill: 'Fill color: priority under your lens blend',
    parcelsFillLens: (lens: string) => `Fill color: priority under the ${lens.toLowerCase()} lens`,
    parcelsSure: 'Outline: how sure we are that it is vacant',
    sureHigh: 'Very likely vacant',
    sureMedium: 'Probably vacant',
    sureLow: 'Not very sure',
    parcelPoint: 'Dots: zoomed out, a sample of the vacant parcels; up close, a parcel with no mapped shape',
    selected: 'Selected place',
    landcare: 'Lot kept up by PHS LandCare: already cared for',
    garden: 'Community garden or farm',
    hin: 'Street on the High Injury Network',
    hexIntro: (window: string) => `People shot, per hexagon, ${window.toLowerCase()}`,
    hexNone: 'Hexagons with no shootings are left clear.',
    countBin: (lo: number, hi: number | null) =>
      hi === null ? `${formatNumber(lo)} or more` : lo === hi ? formatNumber(lo) : `${formatNumber(lo)} to ${formatNumber(hi)}`,
    segmentsFill: 'Line color: street safety score under your lens blend',
    segmentsShown: (min: number) =>
      min <= 1 ? 'Every block with a score above zero is shown.' : `Blocks that score ${formatNumber(min)} or more out of 100 are shown.`,
    segmentsZoom:
      'Zoomed out, only blocks with recorded harm or on the High Injury Network are drawn. Zoom in to see the rest.',
    crashSeverity: {
      3: 'Someone was killed',
      2: 'Someone was seriously injured',
      1: 'Someone was injured',
      0: 'No one was reported hurt',
    } as Record<number, string>,
    crashesZoom: 'Zoom in to see crashes where no one was seriously hurt.',
    crashesSource: 'From PennDOT crash records, which arrive about a year after the crashes.',
    memorial: 'A person killed while walking, cycling or riding a scooter',
    memorialEveryone: 'A person killed in a traffic crash',
    memorialNames: 'A fuller ring means a public memorial list shares the person\'s name. Open the marker to read it.',
    /** While there is no private way to ask for a name to come down, no name can appear (D7). */
    memorialNamesWaiting: 'No names are shown yet. They will appear only once families have a private way to ask for one to come down.',
    memorialNamesHidden: 'Names are hidden.',
    // Shelters and benches at stops (src/map/styles/stop_amenities.ts). Unknown is never worded
    // as missing.
    stopShelter: 'A shelter, or the whole stop is under a roof',
    stopBench: 'A bench, but no shelter mapped',
    stopNeither: 'No shelter and no bench',
    stopUnknown: 'Not yet surveyed: OpenStreetMap does not say yet',
    stopSurvey: 'How to survey a stop with StreetComplete',
    stopsCoverage: 'Only stops someone has added to OpenStreetMap appear here, so many stops are not shown yet.',
    stopSurveyRoute: 'Print a survey sheet for a whole route',
  },

  streets: {
    popupLabel: 'About this place on the map',
    detailsTitle: (style: string) =>
      style === 'memorials'
        ? 'Memorial'
        : style === 'crashes'
          ? 'Crash'
          : style === 'street_segments'
            ? 'Street block'
            : style === 'transit_stops'
              ? 'Stop'
              : style === 'transit_routes'
                ? 'Route'
                : style === 'stop_amenities'
                  ? 'Shelter and bench'
                  : style === 'city_trees'
                    ? 'Tree'
                    : style === 'amenity'
                      ? 'As mapped in OpenStreetMap'
                      : style === 'public_place'
                        ? 'Place'
                        : style === 'condition'
                          ? 'Reported to 311'
                          : style === 'public_art'
                            ? 'Public art'
                            : 'Details',
    memorialTitle: 'In memory',
    peopleHere: (n: number) => `${plural(n, 'person is', 'people are')} remembered here`,
    killed: {
      walk: 'Killed while walking',
      bike: 'Killed while cycling',
      scooter: 'Killed while riding a scooter',
      motorcycle: 'Killed while riding a motorcycle',
      other: 'Killed in a traffic crash',
    },
    killedOn: (what: string, date: string) => `${what} on ${date}.`,
    memorialSource: 'Read the public memorial',
    blessing: 'Only with the family\'s blessing.',
    families: 'Families for Safe Streets supports families after a crash.',
    canDo: 'What neighbors can do here',
    firstStep: 'First step',
    cost: (cost: string) => `Cost: ${cost}`,
    memorialsNearby: 'Memorials nearby',
    memorialsInView: 'Memorials in view',
    memorialsIntro: 'Each one remembers a person killed in a traffic crash. Open one to read more.',
    memorialCount: (n: number) => plural(n, 'memorial', 'memorials'),
    memorialsMore: (n: number) => `${plural(n, 'more memorial is', 'more memorials are')} in view. Zoom in to list them here.`,
    memorialsLayerOff: 'Turn on the Memorials layer to list the memorials in view.',
    memorialsNone: 'No memorials in this part of the map.',
    removal: 'Request removal',
    /** Beside "Request removal". No text promises an email address before it exists (docs/VERIFICATION.md, D7). */
    removalNote: (hasEmail: boolean) =>
      hasEmail
        ? 'Anyone can ask us to take this memorial down, by private email. We do it without asking why.'
        : 'Anyone can ask us to take this memorial down, without giving a reason. A private email address for this is coming soon; until then the Contact page says how to ask in a GitHub issue, which anyone can read.',
    removalSubject: (id: string) => `Memorial removal request ${id}`,
    removalBody: (id: string) =>
      `Please remove memorial ${id} from Placekeepers. You do not need to give a reason or any proof.`,
    crashTitle: (year: string) => `Crash in ${year}`,
    crashesHere: (n: number) => `${plural(n, 'crash', 'crashes')} at this spot`,
    involved: 'Who was involved',
    involvedModes: {
      walk: 'someone walking',
      bike: 'someone cycling',
      motorcycle: 'someone on a motorcycle',
      scooter: 'someone on a scooter',
    },
    involvedOthers: 'people in cars or other vehicles',
    crashSource: 'From PennDOT crash records.',
    segmentScore: (score: number, lens: string) => `${lens}: ${score} of 100 under your lens blend`,
    segmentNoScore: 'No street safety score for this block.',
    onHin: 'On the High Injury Network',
    ksi: (n: number) =>
      `${plural(n, 'person', 'people')} killed or seriously injured while walking or cycling on this block or at its corners, in the last five years of PennDOT records`,
    noKsi: 'No one recorded killed or seriously injured while walking or cycling here in the last five years of PennDOT records',
    killed2: (n: number) => `${plural(n, 'person', 'people')} killed here in the last two years`,
    school: 'A school within 400 meters',
  },

  // SEPTA stops and routes (M2.1): the legends and what a stop's details panel says. Waits are
  // the typical time between departures; times are SEPTA's service day, which runs past midnight.
  transit: {
    waitTitle: 'How often a bus or train comes at midday on weekdays',
    waitBins: [
      'Every 10 minutes or better',
      'Every 11 to 15 minutes',
      'Every 16 to 30 minutes',
      'Every 31 to 60 minutes',
      'Less than once an hour',
    ],
    noMidday: 'No service from 10 to 2 on weekdays',
    boardingsTitle: 'People who get on here on an average weekday',
    boardingBins: ['1,000 or more', '200 to 999', '50 to 199', '10 to 49', 'Fewer than 10'],
    noCount: 'No SEPTA count for this stop',
    boardingsNote: "From SEPTA's own counts, which run a season or two behind the schedules.",
    station: 'Subway, El or Regional Rail station',
    zoomNote: 'Zoom in to a few neighborhoods to see the stops.',
    lensTitle: 'Priority under the transit comfort lens',
    lensUnsurveyed: 'Where no one has surveyed a stop yet, its shelter and bench count halfway.',
    lensStations: 'The lens scores bus and trolley stops only, so stations are hollow.',
    lensTunnel: 'The trolley stops in the tunnel under Center City and University City are hollow too: the lens leaves them out, as it does stations.',
    // The transit comfort lens at a stop (src/transit/comfort.ts).
    findTitle: 'What riders find here',
    notInOsm: 'We found no matching stop in OpenStreetMap yet, so no one has recorded whether it has a shelter or a bench.',
    matchedByNumber: 'Matched to the OpenStreetMap stop with the same stop number, at the same place.',
    matchedByPlace: 'Matched to the OpenStreetMap stop at the same place, within 15 meters.',
    halfway: 'Not yet surveyed answers count halfway (50 of 100) in the score until someone records them.',
    canopy: (percent: number) =>
      `Tree canopy covers about ${formatNumber(percent)} percent of the land around the stop, in an area about two blocks across (the City's 2018 tree canopy survey).`,
    onHin: 'The stop is on the High Injury Network, the streets where most traffic deaths and serious injuries in Philadelphia happen.',
    noScore: 'The transit comfort lens scores bus and trolley stops only.',
    tunnelStation: 'This trolley stop is underground, in the tunnel, so the transit comfort lens leaves it out, as it does the subway and rail stations.',
    answersLoading: 'Loading what OpenStreetMap says at this stop.',
    answersUnavailable: 'What OpenStreetMap says at this stop could not be loaded right now, so its shelter and bench count as not yet surveyed.',
    canDo: 'What neighbors can do here',
    routeDetails: 'Steps, contacts and links',
    surveyGuide: 'How to survey a stop with StreetComplete',
    osmSource: 'Shelter, bench and light from OpenStreetMap, © OpenStreetMap contributors, updated every week.',
    routeBus: 'Bus route',
    routeTrolley: 'Trolley route',
    routeMetro: 'Subway or El',
    routeRail: 'Regional Rail',
    allRoutes: 'Where several routes share a street, their lines lie on top of each other.',
    frequentRoutes: 'Only routes with a bus or train every 15 minutes or better at midday on weekdays.',
    detailsTitle: 'Stop',
    stationName: (name: string) => `${name} station`,
    stopsHere: (n: number) => `${plural(n, 'stop', 'stops')} at this spot`,
    kinds: {
      bus: 'Bus stop',
      trolley: 'Trolley stop',
      busTrolley: 'Bus and trolley stop',
      metro: 'Subway or El station',
      rail: 'Regional Rail station',
    },
    vehicles: { bus: 'bus', trolley: 'trolley', busTrolley: 'bus or trolley', train: 'train' } as Record<string, string>,
    vehiclesMany: { bus: 'buses', trolley: 'trolleys', busTrolley: 'buses or trolleys', train: 'trains' } as Record<string, string>,
    routes: (list: string) => `Routes: ${list}.`,
    route: (name: string) => `Route ${name}.`,
    howOften: 'How often',
    every: (vehicle: string, minutes: number) =>
      minutes <= 1 ? `a ${vehicle} about every minute` : `a ${vehicle} about every ${formatNumber(minutes)} minutes`,
    only: (one: string, many: string, n: number) => (n === 1 ? `only one ${one}` : `only ${formatNumber(n)} ${many}`),
    peak: (text: string) => `Weekday mornings from 7 to 9: ${text}.`,
    midday: (day: string, text: string) => `${day} from 10 to 2: ${text}.`,
    noService: (day: string) => `${day} from 10 to 2: none.`,
    days: { wk: 'Weekdays', sa: 'Saturdays', su: 'Sundays' } as Record<string, string>,
    trips: (wk: number, sa: number, su: number) =>
      `${plural(wk, 'departure', 'departures')} on a typical weekday, ${formatNumber(sa)} on Saturdays and ${formatNumber(su)} on Sundays.`,
    busiest: (n: number) => `Busiest hour on weekdays: ${plural(n, 'departure', 'departures')}.`,
    firstLast: (first: string, last: string) => `On weekdays the first departs at ${first} and the last at ${last}.`,
    afterMidnight: (time: string) => `${time} after midnight`,
    allNight: 'Service runs through the night on weekdays.',
    evening: (n: number) =>
      n === 0 ? 'No departures after 8 at night on weekdays.' : `After 8 at night on weekdays: ${plural(n, 'departure', 'departures')}.`,
    noWeekday: 'No weekday service.',
    riders: 'Riders',
    boardings: (n: number, period: string) =>
      n === 0
        ? `Almost no one gets on here on an average weekday (SEPTA's count, ${period}).`
        : `About ${plural(n, 'person gets', 'people get')} on here on an average weekday (SEPTA's count, ${period}).`,
    countedAt: (id: string) => `Counted at SEPTA stop ${id}, which this stop replaced.`,
    noBoardings: 'SEPTA has no count for this stop yet. New and renumbered stops get one when SEPTA publishes its next count.',
    noStationCounts: 'SEPTA does not publish counts for each subway or El platform.',
    noRailCounts: "SEPTA counts Regional Rail riders by station once a year; this map does not show those counts yet.",
    stopNumber: (id: string) => `SEPTA stop number ${id}.`,
    formerNumbers: (ids: string) => `Before that it was SEPTA stop ${ids}.`,
    wheelchair: {
      1: 'SEPTA lists this stop as reachable in a wheelchair.',
      2: 'SEPTA lists this stop as not reachable in a wheelchair.',
    } as Record<number, string>,
    source: "From SEPTA's schedules for a typical week. Waits are averages: buses bunch and gaps grow.",
  },

  // Shelters and benches at a stop someone tapped, from OpenStreetMap
  // (src/components/transit/StopAmenityDetails.svelte). An answer OpenStreetMap does not have yet
  // reads "not yet surveyed".
  stopAmenities: {
    unnamed: 'A stop with no name in OpenStreetMap',
    number: (ref: string) => `Stop number ${ref}`,
    served: { 1: 'Bus stop', 2: 'Trolley stop', 3: 'Bus and trolley stop' } as Record<number, string>,
    comfort: {
      3: 'A shelter, or the whole stop is under a roof',
      2: 'A bench, but no shelter mapped',
      1: 'No shelter and no bench',
      0: 'Not yet surveyed',
    } as Record<number, string>,
    factsTitle: 'What OpenStreetMap says',
    answers: {
      sh: 'Shelter',
      bn: 'Bench',
      bi: 'Waste basket',
      lt: 'Lit at night',
      tp: 'Tactile paving for people who are blind',
      wc: 'Wheelchair access',
      db: 'Departures board',
      cv: 'Whole stop under a roof',
    } as Record<string, string>,
    yes: 'Yes',
    no: 'No',
    limited: 'Limited',
    unknown: 'Not yet surveyed',
    nearby: 'mapped on its own beside the stop',
    unknownNote: 'Not yet surveyed means no one has recorded it yet. It does not mean the stop has nothing.',
    survey: 'How to survey this stop with StreetComplete',
    openOsm: 'See this stop on OpenStreetMap',
    surveyRoute: 'Survey a whole route with a printable sheet',
    source: 'From OpenStreetMap, © OpenStreetMap contributors, updated every week.',
  },

  // Heat, trees and the floodplain (M3.1): the legends of src/map/styles/heat_tracts.ts,
  // city_trees.ts and floodplain.ts, and a tree someone tapped
  // (src/components/heat/TreeDetails.svelte).
  heat: {
    tractsTitle: {
      vulnerability: 'Heat vulnerability: the heat and the people at risk, by census tract',
      exposure: 'Heat exposure: how hot each census tract gets in summer',
      sensitivity: 'Heat sensitivity: how many people in each census tract are at risk in the heat',
    } as Record<string, string>,
    fifths: {
      vulnerability: ['Least vulnerable fifth of tracts', 'Less vulnerable', 'Middle fifth', 'More vulnerable', 'Most vulnerable fifth'],
      exposure: ['Coolest fifth of tracts', 'Cooler', 'Middle fifth', 'Hotter', 'Hottest fifth'],
      sensitivity: ['Fifth with the fewest people at risk', 'Fewer', 'Middle fifth', 'More', 'Fifth with the most people at risk'],
    } as Record<string, string[]>,
    priority: 'Outlined: tracts the City rates very high in heat vulnerability',
    tractsNone: 'Tracts the index does not report, such as large parks and the airport, are left clear.',
    tractsSource:
      "From the City's Heat Vulnerability Index (Department of Public Health and Office of Sustainability), data of 2017 to 2019.",
    treeBig: 'A City tree: the bigger the dot, the wider its trunk',
    treeSmall: 'A small tree, often a young one that needs watering',
    treesZoom: 'Zoom in to a few blocks to see the trees.',
    treesYards: "Trees in private yards are not in the City's inventory, so a block can be shadier than it looks here.",
    floodHigh: 'The 1 percent annual chance floodplain: a flood has at least a 1 in 100 chance each year',
    floodway: 'The floodway: the channel kept open so floods can pass',
    floodModerate: 'The 0.2 percent annual chance area: a 1 in 500 chance each year',
    floodCare:
      "A reason for care, never part of a score: plants there must stand wet ground, and anything built follows the City's floodplain rules.",
    treeUnnamed: 'A tree the inventory does not name',
    treeTrunk: (inches: number) => `Its trunk is about ${formatNumber(inches)} inches across at chest height.`,
    treeNoTrunk: 'The inventory does not give the size of its trunk.',
    treeYoung: 'A young tree needs about 20 gallons of water a week from March through December, TreePhilly says.',
    treesHere: (n: number) => `${plural(n, 'tree', 'trees')} at this spot`,
    treeSource: "From Parks and Recreation's tree inventory, the trees the City keeps on its streets and in its parks.",
  },

  // Public art (M3.2): the legend of src/map/styles/public_art.ts and a work someone tapped
  // (src/components/art/ArtDetails.svelte, src/art/describe.ts). A memorial artwork shows no title,
  // artist, year or place in words, only that it is a memorial and its sources (docs/ETHICS.md).
  art: {
    legend: {
      mural: 'Murals and wall paintings',
      sculpture: 'Sculptures and statues',
      mosaic: 'Mosaics',
      other: 'Other kinds: installations, fountains, monuments and more',
    },
    allOff: "Every kind of art is switched off in this layer's settings.",
    insideHidden: 'Works inside buildings are hidden.',
    memorialNote: 'Artworks that remember someone are shown without names.',
    coverage:
      "From the City's Percent for Art list, OpenStreetMap and Wikidata. Many murals are not in them yet; Mural Arts Philadelphia keeps the largest list on its own site.",
    kinds: {
      0: 'A work of public art',
      1: 'A mural',
      2: 'A painting',
      3: 'Street art',
      4: 'A mosaic',
      5: 'A sculpture',
      6: 'A statue',
      7: 'A bust',
      8: 'A relief',
      9: 'An installation',
      10: 'A fountain',
      11: 'A monument',
      12: 'A memorial',
      13: 'Stained glass',
      14: 'A plaque',
    } as Record<number, string>,
    untitled: 'No title is recorded.',
    by: (artist: string) => `By ${artist}.`,
    made: (year: number) => `Made in ${year}.`,
    medium: (medium: string) => `Made of: ${medium}.`,
    where: (place: string) => `Where: ${place}.`,
    inside: 'Inside a building, so it can be seen only when the building is open.',
    memorialTitle: 'Memorial artwork',
    memorialText:
      'This artwork remembers someone. Placekeepers shows no names on memorials; the sources below say more about it.',
    worksHere: (n: number) => `${plural(n, 'work', 'works')} of art at this spot`,
    sourcesTitle: 'Sources',
    cityRecord: "The City's record of this work (PDF)",
    cityList: "The City's Percent for Art list",
    openOsm: 'See it on OpenStreetMap',
    openWikidata: 'See it on Wikidata',
    openWikipedia: 'Read about it on Wikipedia',
    website: (site: string) => `More about it on ${site}`,
    siteNames: {
      'associationforpublicart.org': "the Association for Public Art's site",
      'muralarts.org': "Mural Arts Philadelphia's site",
      'philart.net': 'philart.net',
    } as Record<string, string>,
    muralArts: "Search Mural Arts Philadelphia's own list of murals",
    fix: 'Something missing or wrong? Add or fix it on OpenStreetMap; changes reach this map within about a week.',
    fixLink: 'Edit on OpenStreetMap',
    credit: 'Public art from the City of Philadelphia, OpenStreetMap (© OpenStreetMap contributors) and Wikidata.',
  },

  // The route survey sheet page (M2.4, web/survey/, src/survey/). Times are our own estimate and
  // say so. "Not found in OpenStreetMap" rather than "missing": the stop may be drawn a few steps
  // away, under no number we could match.
  survey: {
    pageTitle: 'Survey a route',
    intro:
      'Pick a SEPTA bus or trolley route and a direction to get a survey sheet: its stops in Philadelphia in order, what OpenStreetMap shows at each one now, and boxes to fill in. Print it, or tick the boxes on your phone as you go.',
    guideLink: 'How to survey bus stops',
    loading: 'Loading the routes…',
    loadFailed: 'The list of routes could not be loaded. Check your connection and try again.',
    notPublished: 'Survey sheets are not published yet. They appear after the next weekly update.',
    sheetFailed: 'This route\'s sheet could not be loaded. Check your connection and try again.',
    retry: 'Try again',
    routeLabel: 'Route',
    routePlaceholder: 'Choose a route',
    buses: 'Bus routes',
    trolleys: 'Trolley routes',
    directionLabel: 'Direction',
    partsLabel: 'Split among',
    partsChoice: (n: number) => (n === 1 ? 'one person or pair' : `${n} people or pairs`),
    directionTo: (dir: string, to: string) => `${dir} to ${to}`,
    towards: (to: string) => `Toward ${to}`,
    directionNumber: (n: number) => `Direction ${n}`,
    stopCount: (n: number) => plural(n, 'stop', 'stops'),
    title: (route: string, direction: string) => `Route ${route}, ${direction}`,
    summary: (stops: number, miles: string) =>
      `${plural(stops, 'stop', 'stops')} in Philadelphia, ${miles} from the first to the last in straight lines.`,
    outside: (n: number) => `${plural(n, 'more stop is', 'more stops are')} outside Philadelphia and not on this sheet.`,
    answersMissing:
      'What OpenStreetMap says at these stops could not be loaded right now, so the stops it knows show as not yet surveyed.',
    statusTitle: 'What OpenStreetMap shows now',
    status: {
      shelter: 'Shelter',
      bench: 'Bench only',
      neither: 'Neither',
      unsurveyed: 'Not yet surveyed',
      missing: 'Not found in OpenStreetMap',
    } as Record<string, string>,
    statusLong: {
      shelter: 'with a shelter or roof',
      bench: 'with a bench but no shelter mapped',
      neither: 'with neither',
      unsurveyed: 'in OpenStreetMap but not yet surveyed',
      missing: 'not found in OpenStreetMap',
    } as Record<string, string>,
    estimateTitle: 'How long it takes',
    estimate: (time: string) => `Our estimate: ${time} for one person or pair.`,
    estimateBasis:
      'This is our own estimate, not a measurement: walking about 3 miles an hour from stop to stop, and about a minute at each stop. Getting to the first stop and home is extra.',
    trolleyTunnel:
      'Trolley routes T1 to T5 run underground at their Center City end, in a tunnel with stations from 13th Street to 37th Street. Leave those stations out: this survey is for stops on the street.',
    asOf: (osm: string | null, schedules: string | null) =>
      [osm ? `What OpenStreetMap shows is as of ${osm}.` : null, schedules ? `Stops from SEPTA's schedules (${schedules}).` : null]
        .filter(Boolean)
        .join(' '),
    print: 'Print the sheet',
    printAll: 'Print every part',
    printPart: (n: number) => `Print part ${n} only`,
    part: (n: number, of: number) => `Part ${n} of ${of}`,
    partStops: (first: number, last: number) => (first === last ? `stop ${first}` : `stops ${first} to ${last}`),
    partEstimate: (time: string, miles: string) => `Our estimate: ${time} (${miles} of walking).`,
    sheetFor: (route: string, direction: string) => `Survey sheet: route ${route}, ${direction}`,
    howToFill:
      'Tick Y or N for each thing you find at the stop. Lit means a light shines on the stop at night: a lamp in the shelter or a streetlight right beside it. Needs repair means a broken shelter, bench, sign or waste basket. If you cannot tell, leave the box empty: please never guess.',
    nameLine: 'Name:',
    dateLine: 'Date:',
    columns: {
      number: '#',
      stop: 'Stop',
      now: 'OpenStreetMap now',
      sh: 'Shelter',
      bn: 'Bench',
      bi: 'Waste basket',
      lt: 'Lit',
      rp: 'Needs repair',
      nt: 'Notes',
    } as Record<string, string>,
    yes: 'Yes',
    no: 'No',
    yesShort: 'Y',
    noShort: 'N',
    stopNumber: (sid: string) => `SEPTA stop ${sid}`,
    answerLabel: (n: number, name: string, question: string, answer: string) => `Stop ${n}, ${name}: ${question}, ${answer}`,
    repairLabel: (n: number, name: string) => `Stop ${n}, ${name}: needs repair`,
    notesLabel: (n: number, name: string) => `Stop ${n}, ${name}: notes`,
    openOsm: 'See on OpenStreetMap',
    editOsm: 'Edit',
    answered: (n: number, of: number) => `You have filled in ${formatNumber(n)} of ${plural(of, 'stop', 'stops')} on this device.`,
    kept: 'What you tick and type here stays in this browser on this device only. Nothing is sent anywhere.',
    notKept: 'This browser is not keeping what you tick, so it will be lost if you leave the page. Print the sheet or write it down.',
    clear: 'Clear what I filled in',
    clearConfirm: 'Clear every box and note you filled in for this direction?',
    safetyTitle: 'Before you go: stay safe',
    safety: [
      'Stay on the sidewalk. Never stand in the street or step into a bus lane to look at a stop.',
      'Go in daylight, and go with a friend.',
      'Stop walking before you look at this sheet or your phone, and look up before you cross.',
      'Step aside so riders can wait and board. Do not photograph people.',
    ],
    answersTitle: 'Getting your answers into OpenStreetMap',
    withApp:
      'With the StreetComplete app: answer its questions about each stop while you stand there. Your answers go straight into OpenStreetMap.',
    withoutApp: 'Without a phone app, on a computer back home, use OpenStreetMap\'s own editor:',
    editorSteps: [
      'Log in at openstreetmap.org. An account is free.',
      'Open this page again and use the Edit link beside each stop. The editor opens with the stop selected.',
      'In the panel on the left, click the Shelter box. Under "Add field:" add Bench, Waste Bin (the waste basket) and Lit, and click their boxes too. Each box changes with every click: Yes, then No, then back to Unknown.',
      'Click Save, write a short note about what you did, such as "Surveyed bus stop shelters and benches", and click Upload.',
    ],
    notFound:
      'Where the sheet says "Not found in OpenStreetMap", look closely around the stop in the editor first: it may be drawn a few steps away. If it is really missing, click Point, put the point on the sidewalk next to the stop\'s sign, and choose Bus Stop.',
    repairNote:
      'OpenStreetMap does not record damage, so "Needs repair" and your notes stay with your group. They help when you talk with SEPTA or the City about a stop.',
    updates: 'Placekeepers reads OpenStreetMap every Monday, so your answers reach our map and these sheets within about a week.',
    printedFrom: 'Printed from Placekeepers, a free map for Philadelphia neighbors. Stops from SEPTA; map data © OpenStreetMap contributors.',
    // A route someone tapped on the map (src/components/transit/RouteDetails.svelte).
    routeTitle: (route: string) => `Route ${route}`,
    routesHere: (n: number) => `${plural(n, 'route', 'routes')} here`,
    surveyThisRoute: 'Survey the stops of this route for shelters and benches',
  },

  // Amenities from OpenStreetMap (M3.5, src/map/styles/amenity.ts, AmenityDetails.svelte). Only
  // what people have mapped appears, and unknown is never worded as no.
  amenities: {
    legend: {
      benches: 'A bench',
      picnic_tables: 'A picnic table',
      drinking_water: 'Drinking water',
      toilets: 'A public toilet',
      bookcases: 'A little free library',
    } as Record<string, string>,
    mappedNote: 'Only what people have added to OpenStreetMap appears here, so many are missing.',
    addMissing: 'How to add what is missing',
    titles: {
      benches: 'Bench',
      picnic_tables: 'Picnic table',
      drinking_water: 'Drinking water',
      toilets: 'Public toilet',
      bookcases: 'Little free library',
    } as Record<string, string>,
    /** Yes, then no, for each answer an amenity can have. */
    facts: {
      br: ['Has a backrest', 'No backrest'],
      cv: ['Under a roof', 'Not under a roof'],
      bt: ['A bottle can be filled here', 'Not for filling a bottle'],
      sn: ['Only part of the year', 'All year'],
      in: ['Indoors', 'Outdoors'],
      fee: ['There is a fee', 'Free'],
      ct: ['Has a changing table', 'No changing table'],
    } as Record<string, [string, string]>,
    access: { 1: 'Open to anyone', 2: 'For customers only' } as Record<number, string>,
    wheelchair: {
      1: 'Wheelchair accessible',
      0: 'Not wheelchair accessible',
      2: 'Limited wheelchair access',
    } as Record<number, string>,
    hours: (text: string) => `Opening hours as mapped: ${text}`,
    nothingMore: 'OpenStreetMap does not say more about it yet.',
    unknownNote: 'Anything not listed is not known yet. That does not mean the answer is no.',
    openOsm: 'See it on OpenStreetMap',
    fix: 'Missing or wrong? How to fix it',
    source: 'As mapped in OpenStreetMap, © OpenStreetMap contributors, updated every week.',
  },

  // Public places from the City (M3.5, src/map/styles/public_place.ts, PlaceDetails.svelte).
  places: {
    legend: {
      park_water: 'A drinking fountain in a park',
      libraries: 'A Free Library branch',
      recreation_centers: 'A recreation center',
    } as Record<string, string>,
    poolLegend: { 1: 'A pool', 2: 'A sprayground', 3: 'A sprinkler' } as Record<number, string>,
    notInService: 'Not in service this year',
    poolsShown: { in_service: 'Only those in service this year are shown.', all: 'Hollow circles are not in service this year.' } as Record<string, string>,
    recreationKinds: {
      1: 'Recreation center',
      2: 'Older adult center',
      3: 'Environmental education center',
    } as Record<number, string>,
    poolKinds: { 1: 'Pool', 2: 'Sprayground', 3: 'Sprinkler' } as Record<number, string>,
    waterKinds: { 1: 'Drinking fountain', 2: 'Bottle filling station' } as Record<number, string>,
    status: { 1: 'In service this year', 0: 'Not in service this year' } as Record<number, string>,
    statusUnknown: 'Parks and Recreation does not say whether it is in service this year.',
    indoor: { 1: 'Indoors', 0: 'Outdoors' } as Record<number, string>,
    waterIndoor: 'Inside a building: open when the building is.',
    accessible: { 1: 'Listed as accessible for people with disabilities', 0: 'Not listed as accessible' } as Record<number, string>,
    opened: (date: string) => `Opened for the season on ${date}.`,
    gym: 'Has a gym.',
    noBuilding: 'A program site without a building of its own.',
    inPark: (park: string) => `In ${park}.`,
    phone: (number: string) => `Phone: ${number}`,
    libraryPage: 'Hours and events on the Free Library website',
    seasonNote: 'Pools open for the summer only. Check with Parks and Recreation for this week\'s hours.',
    source: {
      libraries: "From the City's list of Free Library of Philadelphia locations.",
      parks: 'From Philadelphia Parks and Recreation, as the City publishes it.',
    } as Record<string, string>,
  },

  // Conditions reported to 311, counted by block (M3.5, src/map/styles/condition.ts,
  // ConditionDetails.svelte). Physical conditions only, never people (docs/ETHICS.md).
  conditions: {
    legend: {
      dumping: 'Illegal dumping',
      dark_lights: 'A street or alley light out',
      graffiti: 'Graffiti',
    } as Record<string, string>,
    legendOpen: (what: string) => `${what}: a request still open`,
    legendClosed: (what: string) => `${what}: every request closed`,
    legendSize: 'A bigger circle means more requests on that block.',
    legendWindow: 'Requests to Philly311 in the last 90 days, counted by block, never by address.',
    openOnly: 'Only blocks with a request still open are shown.',
    titles: {
      dumping: 'Illegal dumping reported',
      dark_lights: 'Lights reported out',
      graffiti: 'Graffiti reported',
    } as Record<string, string>,
    summary: (n: number, open: number) =>
      `${plural(n, 'request', 'requests')} to Philly311 in the last 90 days, ${open === 0 ? 'none' : formatNumber(open)} still open.`,
    newest: (date: string) => `The newest was made on ${date}.`,
    alley: (n: number, total: number) =>
      n === total ? (n === 1 ? 'It was about an alley light.' : 'All were about alley lights.') : `${formatNumber(n)} of them about an alley light.`,
    block: (street: string) => `On this block of ${street}.`,
    byBlock: 'Counted by block, never by address, and nothing about who reported is shown.',
    meaning: 'A request shows that someone noticed and asked the City for help. Some blocks ask more often than others.',
    report: 'Report it to Philly311',
    source: "From the City's 311 records (Philly311), refreshed every week.",
  },

  basemap: {
    missing: 'The base map is not available, so streets and place names are hidden. The data layers still work.',
    unavailable: 'The base map is not available here, so the map shows a plain background.',
    legend: 'Streets, buildings, parks, water and place names, in color.',
    legendMuted: 'Streets, buildings, parks, water and place names, in gray, so the data stands out.',
  },

  // The short credits line on the map (HTML). The full list of sources, each with its license, is on
  // the Data status page and in each layer's "About this layer".
  credits: {
    basemap:
      '<a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    data: (statusUrl: string) => `Data: City of Philadelphia and <a href="${statusUrl}">others</a>`,
  },

  status: {
    pageTitle: 'Data status',
    intro:
      'Placekeepers refreshes its data every week. If a source breaks, the map keeps the last good copy and says so here.',
    back: 'Back to the map',
    loading: 'Loading the data status',
    loadFailed: 'We could not load the data status file. The map may still work with older data.',
    retry: 'Try again',
    builtOn: (date: string) => `Last refresh: ${date}`,
    buildId: (id: string) => `Build ${id}`,
    summaryAllOk: 'Every source is up to date.',
    summary: (stale: number, failing: number, missing: number) => {
      const parts: string[] = [];
      if (stale) parts.push(`${plural(stale, 'source is', 'sources are')} out of date`);
      if (failing) parts.push(`${plural(failing, 'source is', 'sources are')} not working`);
      if (missing) parts.push(`${plural(missing, 'source has', 'sources have')} not been fetched yet`);
      return `${parts.join(', ')}.`;
    },
    statusLabel: {
      ok: 'Up to date',
      stale: 'Out of date',
      failing: 'Not working',
      missing: 'Not fetched yet',
      unknown: 'Unknown',
    },
    staleSince: (date: string) => `Using the last good copy, from ${date}.`,
    staleNoDate: 'Using the last good copy.',
    failingText: 'There is no usable copy right now, so layers that need it may be missing.',
    missingText: 'This source has not been fetched yet.',
    unknownText: 'The status file reports something we do not recognize.',
    lastSuccess: (date: string) => `Last good download: ${date}`,
    neverSucceeded: 'No good download yet',
    lastAttempt: (date: string) => `Last attempt: ${date}`,
    rows: (n: number) => `${plural(n, 'record', 'records')}`,
    newest: (date: string) => `Newest record: ${date}`,
    message: (text: string) => `Note from the refresh: ${text}`,
    publisher: 'Published by',
    homepage: 'Where it comes from',
    license: 'License',
    cadence: {
      daily: 'Updated daily by the publisher',
      weekly: 'Updated weekly by the publisher',
      monthly: 'Updated monthly by the publisher',
      yearly: 'Updated yearly by the publisher',
      irregular: 'Updated now and then by the publisher',
      frozen: 'No longer updated by the publisher',
    } as Record<string, string>,
    problems: 'Problems in the status file',
    notesTitle: 'Notes from the latest refresh',
    basemapLabel: { ok: 'Up to date', failing: 'Not available' } as Record<string, string>,
    basemapMade: (date: string) =>
      `The weekly refresh makes a new copy of the base map about once a month. This copy was made from OpenStreetMap on ${date}.`,
    basemapNoDate: 'The weekly refresh makes a new copy of the base map about once a month.',
    basemapMissing: 'The base map is not available on this copy of the site, so the map shows a plain background. The data layers still work.',
  },

  search: {
    label: 'Search for an address, an intersection or a parcel number',
    placeholder: 'Address, intersection or parcel number',
    button: 'Search',
    searching: 'Searching',
    tooShort: 'Type an address, such as 1234 Market St, or two streets that cross, such as Broad and Girard.',
    notFound:
      'The City could not find that place. Try a house number and street, two streets that cross, or a nine digit parcel number.',
    failed: (reason: string) => `The City's address service ${reason}. Try again in a moment.`,
    liveOff:
      'Address search asks the City\'s address service, and live City data is turned off in Settings. You can still search by a nine digit parcel number.',
    resultsTitle: 'Choose a place',
    resultsCount: (n: number) => plural(n, 'place matches', 'places match'),
    intersection: 'Intersection',
    showing: (label: string) => `Showing ${label} on the map.`,
    noParcel: (label: string) => `Showing ${label} on the map. The City has no parcel record for this exact address.`,
    privacy: 'Searches go from your browser straight to the City of Philadelphia.',
  },

  pick: {
    looking: 'Looking up this parcel with the City',
    nothing: 'The City has no parcel at this spot. Tap a lot or a building.',
    liveOff: 'To open a parcel that is not on our list, turn on "Fetch live City data" in Settings.',
    failed: (reason: string) => `The City's parcel map ${reason}. Try again in a moment.`,
  },

  options: {
    title: 'Privacy and live data',
    privacyLink: 'How Placekeepers handles your privacy',
    turnOn: 'Turn on live City data',
    resetNote: 'Your choice about live City data stays as it is.',
  },

  /** Why a live lookup did not work, as the end of a sentence about a City server. */
  failure: {
    timeout: 'did not answer in time',
    network: 'could not be reached',
    http: 'answered with an error',
    bad_data: 'sent an answer we could not read',
    not_found: 'has no record of it',
    aborted: 'was not asked',
    empty: 'was not asked',
  } as Record<string, string>,

  dossier: {
    pageTitle: 'Lot page',
    loading: 'Loading the lot page',
    parcel: (opa: string) => `OPA account ${opa}`,
    printButton: 'Print this lot page',
    showOnMap: 'Show on map',
    close: 'Close the lot page',
    clear: 'Clear selection',
    retry: 'Try the City again',
    notFound: 'We could not find this parcel in City records or in our weekly snapshot.',
    noData:
      'This parcel is not in our weekly snapshot, and live City data is turned off, so there is nothing to show yet.',
    sections: {
      summary: 'Summary',
      actions: 'What you can do',
      owner: 'Who owns it',
      history: 'History',
      nearby: 'Nearby',
      sources: 'Sources and freshness',
    },
    contents: 'On this page',

    provenance: {
      live: (time: string) => `Live from the City at ${time}.`,
      snapshot: (date: string) => `From the weekly snapshot of ${date}.`,
      snapshotNoDate: 'From the weekly snapshot.',
      map: 'From the map\'s weekly data.',
      checking: 'Checking the City for newer records.',
      asking: 'Asking the City.',
      failedSnapshot: (reason: string, date: string) => `The City's servers ${reason}, so this is the weekly snapshot of ${date}.`,
      failedNothing: (reason: string) => `The City's servers ${reason}, so this part cannot be shown right now.`,
      offSnapshot: (date: string) => `Live City data is off, so this is the weekly snapshot of ${date}.`,
      offNothing: 'Live City data is off, and our weekly snapshot does not cover this part.',
      none: 'No records to show.',
    },
    banner: {
      live: 'Live from the City of Philadelphia.',
      loading: 'Checking with the City for the newest records.',
      off: (date: string) => `Live City data is off. This page shows the weekly snapshot of ${date}.`,
      offNoDate: 'Live City data is off. This page shows the weekly snapshot.',
      partial: 'Some City lookups did not work. Those parts show the weekly snapshot, or nothing, and say so.',
      failed: 'The City\'s servers did not answer. This page shows what our weekly snapshot has.',
    },

    summary: {
      kind: { lot: 'Vacant lot', building: 'Vacant building' } as Record<string, string>,
      notListed: 'Not on our list of vacant lots and buildings',
      notListedHelp: 'If you think this parcel is vacant, report a correction below.',
      noDetails: 'No details published yet',
      noPublishedDetails: 'We have not published details for this parcel, so this page shows what the City\'s servers say right now.',
      confidence: {
        high: 'Very likely vacant',
        medium: 'Probably vacant',
        low: 'We are not very sure it is vacant',
      } as Record<string, string>,
      confidenceTitle: 'How sure we are',
      signals: (n: number) => `${plural(n, 'independent City record agrees', 'independent City records agree')} that it is vacant.`,
      cityCalls: (category: string) => `City property records call it: ${category}.`,
      landcare: 'Already maintained by PHS LandCare.',
      landcareSince: (year: number) => `Already maintained by PHS LandCare since ${year}.`,
      garden: 'People already garden here. Ask them before you plan anything.',
      /** The lens behind the score on the lot page (M3.1: the lots can be colored by either lens). */
      lensLine: (lens: string) => `Priority under the ${lens.toLowerCase()} lens, the lens the map colors the lots by.`,
      /**
       * FEMA's floodplain on the lot (`fp`, M3.1): a reason for care, never part of a score
       * (docs/DESIGN.md section 5.3).
       */
      flood: {
        1: "Part of this lot lies in FEMA's 1 percent annual chance floodplain, where a flood has at least a 1 in 100 chance each year. That is a reason for care, not part of any score: plants here must stand wet ground, anything built must follow the City's floodplain rules, and greening that soaks up rain helps.",
        2: "Part of this lot lies in FEMA's 0.2 percent annual chance flood area, where a flood has a 1 in 500 chance each year. That is a reason for care, not part of any score: plants here should stand wet ground, and greening that soaks up rain helps.",
      } as Record<number, string>,
      floodTitle: 'Flood risk',
      linksTitle: 'See it on other sites',
      propertyPage: 'The City\'s property page',
      atlas: 'Atlas, the City\'s map of this address',
      googleMaps: 'Google Maps',
      streetView: 'Google Street View',
      linksNote: 'These open other websites. Placekeepers links to street photos but never copies them.',
    },

    actions: {
      intro: 'Start with the lawful route. Each one says who can do it and who can help.',
      route: 'The lawful route',
      steps: 'Steps',
      who: 'Who can do it',
      cost: 'Cost',
      timeline: 'How long it takes',
      lastChecked: (date: string) => `Last checked ${date}.`,
      toConfirm: 'Still to be confirmed with the organization named here.',
      partners: 'Who can help',
      otherRoutes: 'Other lawful routes for this parcel',
      none: 'No suggestion for this place yet.',
      notListed:
        'This parcel is not on our list of likely vacant lots and buildings, so we have no suggestion for it. The How to do it page explains the lawful routes for any lot.',
      howTo: 'How to do it',
      conservatorshipWarning:
        'Conservatorship can take a property away from its owner. Researchers found it is used disproportionately in neighborhoods facing gentrification. Talk to the Garden Justice Legal Initiative before you consider it.',
      notLegalAdvice: 'Placekeepers is not legal advice. Check with the organizations named here before you act.',
    },

    ownerType: {
      noName: 'City records give no owner name.',
      unclear: 'We could not tell what kind of owner this is from the name.',
      individual: 'The owner name looks like a person\'s name.',
      publicName: (label: string) => `City records name ${label} as the owner.`,
      markerReason: (marker: string) => `The owner name includes "${marker}".`,
      markers: {
        TR: 'TR, short for trustee',
        TRS: 'TRS, short for trustees',
        TRST: 'TRST, short for trust',
        'T U W': 'T/U/W, a trust set up by a will',
        FBO: 'FBO, for the benefit of',
        CO: 'CO, short for company',
        LP: 'LP, a limited partnership',
        LLP: 'LLP, a limited liability partnership',
        LTD: 'LTD, short for limited',
        LL: 'LL, a shortened LLC',
        GP: 'GP, a general partner',
        'N A': 'N A, a national bank',
        FB: 'FB, a shortened FBO',
        CDC: 'CDC, a community development corporation',
      } as Record<string, string>,
      labels: {
        individual: 'A person',
        company: 'A company',
        city: 'The City of Philadelphia',
        land_bank: 'The Philadelphia Land Bank',
        redevelopment_authority: 'The Philadelphia Redevelopment Authority',
        housing_authority: 'A housing authority',
        nonprofit: 'A nonprofit',
        other_public: 'Another public agency',
        unknown: 'Not clear from City records',
      } as Record<string, string>,
    },

    owner: {
      names: 'Owner, as the City publishes it',
      noNames: 'City records give no owner name.',
      mailing: 'Mailing address, as the City publishes it',
      noMailing: 'No mailing address on record.',
      type: 'Kind of owner',
      flagsTitle: 'What City records suggest',
      noFlags: 'Nothing in City records calls for a note about this owner.',
      heldBack:
        'We are not sure this parcel is vacant, so it may be someone\'s home. Notes about an owner who may be a person (where they get mail, a possible estate, tax debt, other parcels they own) appear only on parcels we call very likely or probably vacant.',
      ownerChanged:
        'City records name a different owner than our weekly snapshot did, so notes that were about the earlier owner are left out.',
      parts: { meaning: 'What it means', careful: 'Be careful', next: 'A careful next step' },
      flagTitles: {
        absentee: 'Where the owner gets mail',
        possible_estate: 'Possible estate',
        tax_debt_2025: 'Tax debt as of July 2025',
        sheriff_sales: 'Past sheriff sales',
        years_since_sale: 'Years since the last sale',
        many_parcels: 'An owner of many vacant parcels',
        fast_resales: 'Fast resales',
        open_violations: 'Open L&I violations',
        unsafe: 'Unsafe building',
        imminently_dangerous: 'Imminently dangerous building',
      } as Record<string, string>,
      otherFlag: 'A note from City records',
      taxTitle: 'Taxes',
      taxNoDebt:
        'The City no longer publishes each property\'s tax balance as open data. The July 2025 snapshot we have does not show unpaid taxes here.',
      taxUnknown: 'The City no longer publishes each property\'s tax balance as open data.',
      taxHeld:
        'The City no longer publishes each property\'s tax balance as open data. Our July 2025 snapshot is shown for an owner who may be a person only on parcels we call very likely or probably vacant.',
      taxCenter: 'Check today\'s balance on the City\'s Tax Center',
      deedFraudTitle: 'Protect this property from deed theft',
      deedFraud:
        'Deed theft happens when someone files a fake deed to take a property, often one whose owner has died or lives elsewhere. Owners and families can sign up for the City\'s free Fraud Guard alerts, which send an email when a document naming them is recorded. Since November 2025 the City also automatically blocks deeds whose seller had already died when they supposedly signed.',
      fraudGuard: 'Sign up for the City\'s free Fraud Guard alerts',
      deedCheck: 'The City\'s automated check that stops deed fraud',
      helpTitle: 'Help for owners and families',
      seeList: 'See this owner\'s parcels on our list',
      cityListTitle: 'City list of public property',
      cityList: 'The parcel is on the City\'s list of public property.',
      cityListNames: (agency: string) => `The City's list of public property names ${agency} as the owner.`,
      cityListStatus: (status: string) => `Its status there: ${status}.`,
      sideYard: 'The City marks it eligible for the side yard program, for the owner of the house next door.',
      agencies: {
        PUB: 'the City of Philadelphia',
        PLB: 'the Philadelphia Land Bank',
        PRA: 'the Philadelphia Redevelopment Authority',
        PHDC: 'the Philadelphia Housing Development Corporation (PHDC)',
      } as Record<string, string>,
      tangledTitle: 'The Tangled Title Fund, run by Philadelphia VIP',
      sheriffGuide: 'Grounded in Philly: sheriff sales',
      gjli: 'The Garden Justice Legal Initiative, for free legal help',
    },

    flags: {
      absentee: {
        outOfState: (where: string) => `The owner gets mail somewhere else: ${where} (out of state).`,
        outsidePennsylvania: 'The owner gets mail somewhere else: outside Pennsylvania.',
        outsideCity: (city: string) => `The owner gets mail somewhere else: ${city}, PA (outside Philadelphia).`,
        outsideCityUnknown: 'The owner gets mail somewhere else: outside Philadelphia.',
        poBox: 'The owner gets mail somewhere else: a post office box in Philadelphia.',
        elsewhere: 'The owner gets mail somewhere else: another address in Philadelphia.',
        careful:
          'This is the address where the City sends tax bills. It can be out of date, or belong to a relative, a lawyer or a manager, and an owner who lives elsewhere may not know how the property looks today.',
        next: 'Write to the owner at this address to ask before you do anything on the property, and ask the Garden Justice Legal Initiative to review any agreement before you sign it.',
      },
      possible_estate: {
        text: 'The owner of record may have died.',
        careful: 'Family members may still have a right to this property and may not know it.',
        next: 'If you know the family, the Tangled Title Fund (up to $6,500 in legal help) and Philadelphia VIP can help them keep it. Families can also sign up for the City\'s free Fraud Guard alerts.',
      },
      tax_debt_2025: {
        careful:
          'This is the last public record, from July 9, 2025, not today\'s balance: the owner may have paid since, or owe more. About three or more years of unpaid taxes can lead to a sheriff sale, where a lot neighbors care for can be sold to an outside buyer.',
        next: 'Check today\'s balance on the City\'s Tax Center before you rely on this. If your block cares for this lot, Grounded in Philly\'s guide to sheriff sales explains the risk and what you can do.',
      },
      sheriff_sales: {
        // Several sales are separated by semicolons, since each date already holds a comma.
        one: (sale: string) => `Sold at sheriff sale on ${sale}.`,
        many: (n: number, sales: string) => `Sold at sheriff sale ${n} times: ${sales}.`,
        sale: (date: string, price: string | null) => (price ? `${date}, for ${price}` : date),
        careful:
          'At a sheriff sale the winning bid clears old debts on the property, so a lot neighbors have cared for can pass to an outside buyer. A past sale does not mean the property is for sale now.',
        next: 'If your block cares for this lot, read Grounded in Philly\'s guide to sheriff sales and ask the Garden Justice Legal Initiative for free legal help.',
      },
      years_since_sale: {
        lastSold: (year: number) => `Last sold in ${year}.`,
        notSoldSince: (year: number) => `Not sold on the open market since at least ${year}.`,
        careful:
          'Sales for a token price and sheriff sales are left out here; the full history is below. Many homes pass down in families without a new sale, so a long time since a sale does not mean the owner has given the property up.',
        next: 'If a family has inherited the property without a new deed, the Tangled Title Fund and Philadelphia VIP can help them clear the title and keep it.',
      },
      many_parcels: {
        text: (n: number) => `This owner holds ${n} vacant parcels in the city.`,
        careful:
          'We match owners by their exact name in City records, so one owner can appear under several spellings and two owners can share a name. Holding vacant land is not wrongdoing by itself.',
        next: 'Use the list to see this owner\'s other parcels, then ask permission the lawful way: write to the owner, and have the Garden Justice Legal Initiative review any agreement.',
      },
      fast_resales: {
        since: (n: number, year: number) => `Sold ${n} times since ${year}.`,
        inYear: (n: number, year: number) => `Sold ${n} times in ${year}.`,
        between: (n: number, first: number, last: number) => `Sold ${n} times from ${first} to ${last}.`,
        careful:
          'Quick resales can mean the property is being traded for profit, and sometimes a forged deed. They can also be ordinary, such as a family selling an inherited house and the buyer reselling it after repairs.',
        next: 'Look at who sold and who bought in the history below. Owners and families can sign up for the City\'s free Fraud Guard alerts to learn when a document names them.',
      },
      open_violations: {
        one: (when: string | null, what: string | null) =>
          `L&I lists 1 open violation${what ? `, for ${what}` : ''}${when ? `, from ${when}` : ''}.`,
        many: (n: number) => `L&I lists ${n} open violations.`,
        mostRecent: (when: string, what: string | null) => (what ? `The most recent, from ${when}, is for ${what}.` : `The most recent is from ${when}.`),
        careful:
          'A violation is a notice to the owner, who may not have the means to fix it, and the condition may have changed since the inspection.',
        next: 'Report physical problems, such as dumping or an open building, to Philly311. If you know the owner, let them know: they may not have seen the notice.',
      },
      unsafe: {
        text: (since: string | null) => (since ? `L&I lists this building as unsafe, since ${since}.` : 'L&I lists this building as unsafe.'),
        careful: 'Keep out and keep children away: L&I found the structure unsafe. Do not enter it or try to secure it yourself.',
        next: 'If it is open to entry, report it to Philly311 so the City can seal it.',
      },
      imminently_dangerous: {
        text: (since: string | null) =>
          since ? `L&I lists this building as imminently dangerous, since ${since}.` : 'L&I lists this building as imminently dangerous.',
        careful: 'L&I found the structure could fail at any time. Keep away from it, and keep others away.',
        next: 'Report any change, such as falling bricks or an open door, to Philly311.',
      },
    },

    history: {
      transfersTitle: 'Sales and transfers',
      transfersCaption: 'Every recorded sale and transfer of this property, newest first',
      date: 'Date',
      document: 'Document',
      documentAndPrice: 'Document and price',
      fromAndTo: 'From and to',
      price: 'Price',
      from: 'From',
      to: 'To',
      noDate: 'No date',
      noPrice: 'None recorded',
      share: (n: number) => `this property's share of one deed for ${n} properties`,
      more: (n: number) => `and ${plural(n, 'other', 'others')}`,
      noTransfers: 'No deeds on record.',
      notInCopy: (parts: string[]) =>
        `Our weekly copy does not include ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]} for this parcel, so this page cannot say whether there are any.`,
      partialParts: { transfers: 'deed records', assessments: 'assessments', li: 'L&I violation records' } as Record<string, string>,
      notInCopyOff: 'Live City data can show them.',
      notInCopyFailed: 'The City did not answer. Try again to see them.',
      recordsNote: 'City deed records are complete from 2000 on. Older sales may be missing.',
      datesNote:
        'Each date is the date on the deed and each price is rounded to the dollar, as the City\'s property page shows them; the City records a deed days or weeks later. When one deed covered several properties, the price is this property\'s share.',
      // The City's deed types in plain words. A type not listed here is shown in sentence case,
      // with any dash replaced by a comma.
      documents: {
        DEED: 'Deed',
        'DEED SHERIFF': 'Sheriff\'s deed',
        "SHERIFF'S DEED": 'Sheriff\'s deed',
        'DEED MISCELLANEOUS': 'Miscellaneous deed',
        'MISCELLANEOUS DEED': 'Miscellaneous deed',
        'DEED MISCELLANEOUS TAXABLE': 'Miscellaneous deed, taxable',
        'MISCELLANEOUS DEED TAXABLE': 'Miscellaneous deed, taxable',
        'DEED LAND BANK': 'Land Bank deed',
        'DEED OF CONDEMNATION': 'Deed of condemnation',
        'DEED - DECEASED': 'Deed from an estate',
        'DEED - ADVERSE POSSESSION': 'Deed by adverse possession',
        'DEED RTT - OTHER': 'Other deed',
        'CERTIFICATE OF STOCK TRANSFER': 'Certificate of stock transfer',
      } as Record<string, string>,
      assessmentsTitle: 'City assessments',
      assessmentsCaption: 'The City\'s assessment of market value, by year',
      year: 'Year',
      marketValue: 'Assessed market value',
      noValue: 'Not recorded',
      noAssessments: 'No assessments on record.',
      assessmentNote: 'An assessment is the City\'s estimate of market value for property taxes. It is not a sale price.',
      chartLabel: (first: number, last: number, low: string, high: string) =>
        `Chart of the City's assessment from ${first} to ${last}, between ${low} and ${high}. The same numbers are in the table below.`,
      liTitle: 'Permits, violations and demolitions',
      liCaption: 'L&I records for this property, newest first',
      liRecord: 'What L&I recorded',
      kinds: {
        violation: 'Violation',
        permit: 'Permit',
        demolition: 'Demolition',
        unsafe: 'Unsafe building notice',
        imminently_dangerous: 'Imminently dangerous building notice',
        clean_seal: 'Clean and seal',
      } as Record<string, string>,
      open: 'Open',
      showAll: (n: number) => `Show all ${formatNumber(n)} records`,
      showFewer: 'Show fewer',
      noLi: 'No L&I records for this property.',
      truncated: 'The City has more records than one lookup returns; these are the most recent.',
      liSummaryOpen: (n: number) => plural(n, 'open violation', 'open violations'),
      liSummaryLast: (date: string) => `Most recent violation: ${date}.`,
      liUnsafe: 'L&I lists this building as unsafe.',
      liUnsafeSince: (date: string) => `L&I lists this building as unsafe, since ${date}.`,
      liDangerous: 'L&I lists this building as imminently dangerous.',
      liDangerousSince: (date: string) => `L&I lists this building as imminently dangerous, since ${date}.`,
      liSince2016: (n: number) => `${plural(n, 'violation', 'violations')} recorded since 2016.`,
      liSealed: (date: string) => `Last cleaned and sealed by the City on ${date}.`,
      liDemolished: (date: string) => `Last demolition completed on ${date}.`,
      liNeither: 'Not listed as unsafe or imminently dangerous.',
      liLiveForTimeline: 'The full timeline of permits, violations and demolitions comes from the City when live City data is on.',
    },

    nearby: {
      intro: 'What is around this lot, so care can go where it helps most.',
      careNote: 'These counts show where care is needed most. They say nothing about the people who live here.',
      areaSnapshot: 'In the area around this lot, about two blocks across',
      within500: 'Within 500 feet of this lot',
      s12: (n: number) => `${plural(n, 'person', 'people')} shot in the last 12 months`,
      s36: (n: number) => `${plural(n, 'person', 'people')} shot in the last 3 years`,
      killed: (n: number) => `${plural(n, 'person', 'people')} killed in traffic crashes since 2019`,
      landcare: (n: number) => `${plural(n, 'lot', 'lots')} kept up by PHS LandCare`,
      gardens: (n: number) => `${plural(n, 'community garden', 'community gardens')}`,
      none: 'No nearby counts for this place yet.',
      showLayer: (label: string) => `Show ${label} on the map`,
    },

    sources: {
      intro: 'Where each part of this page comes from, and how fresh it is.',
      live: (time: string) => `live from the City at ${time}`,
      snapshot: (date: string) => `weekly snapshot of ${date}`,
      snapshotNoDate: 'weekly snapshot',
      newest: (date: string) => `newest record ${date}`,
      taxSnapshot: 'Clean & Green Philly\'s final snapshot, July 9, 2025',
      by: (publisher: string) => `from ${publisher}`,
      correction: 'Report a correction',
      correctionHelp: 'Opens a form on GitHub, filled in with this parcel. Sending it needs a free GitHub account.',
      ownerNote:
        'If you own this property and a City record about it is wrong, the City office that keeps the record can fix it at the source: the Office of Property Assessment for owner names, mailing addresses and assessments, the Department of Records for deeds, and Licenses and Inspections for violations and permits.',
    },

    ownerList: {
      title: 'This owner\'s parcels on our list',
      intro: (names: string) => `Parcels on our list whose owner is recorded as ${names}.`,
      others: 'Other parcels on our list whose owner is recorded under the same names as this one.',
      loading: 'Loading the list',
      missing: 'This list is not available right now.',
      open: (address: string) => `Open the lot page for ${address}`,
      kind: (kind: string, confidence: string | null) => (confidence ? `${kind}, ${confidence.toLowerCase()}` : kind),
    },

    print: {
      printed: (date: string) => `Printed from Placekeepers on ${date}.`,
      recent: 'Recent history',
      moreOnline: (n: number) => `${plural(n, 'more record', 'more records')} on the lot page online.`,
      lastAssessment: (year: number, value: string) => `City assessment for ${year}: ${value}.`,
      moreSources: (n: number) => `${plural(n, 'more source', 'more sources')} on the lot page online.`,
      taxCenter: (url: string) => `Today's balance: the City's Tax Center, ${url}`,
    },
  },
} as const;

/** Lists every interface string with its path, so tests can check the house style. */
export function collectStrings(value: unknown, path = 'strings', out: [string, string][] = []): [string, string][] {
  if (typeof value === 'string') out.push([path, value]);
  else if (typeof value === 'function') {
    // Call templates with sample arguments so their fixed text is checked too.
    const fn = value as (...args: unknown[]) => unknown;
    const samples = Array.from({ length: fn.length }, (_, i) => (i === 0 ? 3 : 'sample'));
    try {
      collectStrings(fn(...samples), `${path}()`, out);
    } catch {
      // Templates that need specific arguments are covered by their own tests.
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectStrings(v, `${path}.${k}`, out);
  }
  return out;
}
