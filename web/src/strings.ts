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

function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export const strings = {
  app: {
    name: 'Placekeepers',
    tagline: 'A free map for Philadelphia neighbors who care for their blocks.',
    mapLabel: 'Map of Philadelphia. The list of places below the map shows the same places as text.',
    loadingMap: 'Loading the map',
    sampleData: 'Sample data for testing. These are not real places.',
    earlyPreview:
      'Early preview: the map shows real City data, but lot pages, scores and legal steps are still being built.',
    followAlong: 'Follow along',
    repoUrl: 'https://github.com/holdTheDoorHoid/placekeepers',
    skipToList: 'Skip to the list of places',
    close: 'Close',
    notAffiliated: 'Not affiliated with the City of Philadelphia. Not legal advice.',
    licenses: 'Code: GPL-3.0. Data: each source has its own license. Writing: Creative Commons BY-SA 4.0.',
  },

  header: {
    settings: 'Settings',
    share: 'Copy link',
    shareDone: 'Link copied. Anyone who opens it sees this same map.',
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
    searchLabel: 'Search for an address or intersection',
    searchPlaceholder: 'Address or intersection',
    searchButton: 'Search',
    searchSoon: 'Address search is coming soon. For now, move the map or use Near me.',
    nearMe: 'Near me',
    nearMeBusy: 'Finding you',
    nearMeDenied: 'Location is turned off for this site. You can still move the map by hand.',
    nearMeUnavailable: 'Your device could not find your location. You can still move the map by hand.',
    nearMeUnsupported: 'This browser cannot share your location. You can still move the map by hand.',
    nearMeOutside: 'You seem to be outside Philadelphia. This map covers Philadelphia only.',
    nearMePrivacy: 'Your location stays on your device. Placekeepers never sends it anywhere.',
    youAreHere: 'You are here',
    chipsLabel: 'Main layers',
    moreLayers: 'More layers',
    layersTitle: 'Layers',
  },

  chips: {
    lots: 'Lots',
    streets: 'Streets',
    memorials: 'Memorials',
    comingSoon: 'coming soon',
  },

  sheet: {
    title: 'What you can do nearby',
    show: 'Show places nearby',
    hide: 'Hide places nearby',
    countLabel: (n: number) => plural(n, 'place', 'places'),
    zoomIn: 'Move or zoom the map to a neighborhood to see places nearby.',
    noLotsLayer: 'Turn on the Lots layer to see places nearby.',
    nothingHere: 'No vacant lots or buildings match your settings in this part of the map.',
    allOff: 'Every lens factor is turned off, so places are not ranked. Turn a factor back on in Settings.',
    noScores: 'Priority scores are not published yet, so these places are listed by parcel number.',
    showOnMap: 'Show on map',
    preview: 'Preview. The full list with addresses and legal steps arrives in a later update.',
  },

  place: {
    kindLot: 'Vacant lot',
    kindBuilding: 'Vacant building',
    kindUnknown: 'Vacant parcel',
    parcel: (id: string) => `Parcel ${id}`,
    priority: (score: number, lens: string) => `Priority ${score} of 100 for ${lens.toLowerCase()}`,
    mainReason: (label: string) => `Main reason: ${label}.`,
    noScore: 'No priority score yet for this place.',
    bestSuggestion: 'What you could do',
    firstStep: 'First legal step',
    cost: (cost: string) => `Cost: ${cost}`,
    noSuggestion: 'No suggestion yet for this place.',
    confidence: { 1: 'We are not very sure it is vacant', 2: 'Probably vacant', 3: 'Very likely vacant' } as Record<
      number,
      string
    >,
    confidenceTitle: 'How sure we are',
    ownerTitle: 'Owner type',
    landcare: 'Already maintained by PHS LandCare',
    suggestionsTitle: 'Suggestions',
    dossierSoon: 'The full lot page, with owner, sale history and sources, arrives in a later update.',
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
    intro: 'The score is a weighted average of these factors. Each factor is a citywide rank from 0 to 100.',
    factor: 'Factor',
    value: 'Rank',
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
        : 'Every factor is off. Turn one on to color the lots.',
    explainToggle: 'Why this factor',
    legendLow: 'Lower priority',
    legendHigh: 'Higher priority',
    legendNoData: 'No score',
  },

  filters: {
    title: 'Filters',
    ownerType: 'Owner type',
    all: 'All',
    none: 'None',
    noneSelected: 'No owner types are selected, so no lots are shown.',
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
  },

  settings: {
    title: 'Settings',
    intro: 'Everything on the map is a setting. Your choices are saved in this browser and in the link.',
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
    tableTitle: 'Ranked list',
    tableShow: 'Show ranked list',
    tableHide: 'Hide ranked list',
    tableCaption: 'Places in view, ranked by the current lens blend',
    rank: 'Rank',
    place: 'Place',
    kind: 'Kind',
    sure: 'How sure',
    score: 'Score',
    reason: 'Main reason',
    tablePlaceholder: 'Exports to CSV and GeoJSON and a printable report arrive in a later update.',
    tableEmpty: 'Nothing to rank in view.',
    noScores: 'Priority scores are not published yet, so this list is in parcel number order.',
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
    parcelsSure: 'Outline: how sure we are that it is vacant',
    sureHigh: 'Very likely vacant',
    sureMedium: 'Probably vacant',
    sureLow: 'Not very sure',
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
    memorialNamesHidden: 'Names are hidden.',
  },

  streets: {
    popupLabel: 'About this place on the map',
    detailsTitle: (style: string) =>
      style === 'memorials' ? 'Memorial' : style === 'crashes' ? 'Crash' : style === 'street_segments' ? 'Street block' : 'Details',
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
    removal: 'Request removal',
    removalNote: 'Anyone can ask us to remove a name or a marker. We do it without asking why.',
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

  basemap: {
    attribution:
      '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL)',
    missing: 'The base map is not available, so streets and place names are hidden. The data layers still work.',
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
