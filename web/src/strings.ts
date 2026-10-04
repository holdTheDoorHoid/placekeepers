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
    skipToList: 'Skip to the list of places',
    close: 'Close',
    notAffiliated: 'Not affiliated with the City of Philadelphia. Not legal advice.',
  },

  header: {
    settings: 'Settings',
    share: 'Copy link',
    shareDone: 'Link copied. Anyone who opens it sees this same map.',
    shareFailed: 'Could not copy the link. Copy the address from your browser instead.',
    dataStatus: 'Data status',
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
    memorialsSoon:
      'Memorials will appear here once they are prepared by hand from public memorial lists, with care for families.',
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
    noScore: 'No score: none of the lens factors has data for this place.',
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
    clearSelection: 'Close details',
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

  lens: {
    title: 'Lens',
    presets: 'Presets',
    presetActive: 'in use',
    weightLabel: (factor: string) => `Weight for ${factor}`,
    weightValue: (w: number) => (w === 0 ? 'Off' : `${w} of 5`),
    resetWeights: 'Reset weights',
    allOff: 'Every factor is off. Turn one on to color the lots.',
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
    hin: 'Street on the High Injury Network',
    hexIntro: (window: string) => `People shot, per hexagon, ${window.toLowerCase()}`,
    hexNone: 'Hexagons with no shootings are left clear.',
    countBin: (lo: number, hi: number | null) =>
      hi === null ? `${formatNumber(lo)} or more` : lo === hi ? formatNumber(lo) : `${formatNumber(lo)} to ${formatNumber(hi)}`,
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
