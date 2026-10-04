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

/** Whole dollars, for example "$1,500". */
export function formatMoney(n: number): string {
  return moneyFormat.format(Math.round(n));
}

/** A time of day in Philadelphia, for example "2:14 PM". */
export function formatTime(ms: number): string {
  return timeFormat.format(new Date(ms));
}

/** "a", "a and b", "a, b and c". */
export function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** CITY WORDS become "City words": for descriptions the City writes in capitals. */
export function sentenceCase(text: string): string {
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return lower ? lower[0]!.toUpperCase() + lower.slice(1) : lower;
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
    openLotPage: 'Open lot page',
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
    caption: 'Each factor\'s citywide rank, its weight, and the points it adds to the score',
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
        one: (sale: string) => `Sold at sheriff sale on ${sale}.`,
        many: (n: number, sales: string) => `Sold at sheriff sale ${n} times: ${sales}.`,
        sale: (date: string, price: string | null) => (price ? `${date} for ${price}` : date),
        careful:
          'At a sheriff sale the winning bid clears old debts on the property, so a lot neighbors have cared for can pass to an outside buyer. A past sale does not mean the property is for sale now.',
        next: 'If your block cares for this lot, read Grounded in Philly\'s guide to sheriff sales and ask the Garden Justice Legal Initiative for free legal help.',
      },
      years_since_sale: {
        lastSold: (year: number) => `Last sold in ${year}.`,
        notSoldSince: (year: number) => `Not sold for a price since at least ${year}.`,
        careful:
          'Sales for a token price and sheriff sales are left out here; the full history is below. Many homes pass down in families without a new sale, so a long time since a sale does not mean the owner has given the property up.',
        next: 'If a family has inherited the property without a new deed, the Tangled Title Fund and Philadelphia VIP can help them clear the title and keep it.',
      },
      many_parcels: {
        text: (n: number) => `This owner holds ${formatNumber(n)} vacant parcels in the city.`,
        careful:
          'We match owners by their exact name in City records, so one owner can appear under several spellings and two owners can share a name. Holding vacant land is not wrongdoing by itself.',
        next: 'Use the list to see this owner\'s other parcels, then ask permission the lawful way: write to the owner, and have the Garden Justice Legal Initiative review any agreement.',
      },
      fast_resales: {
        since: (n: number, year: number) => `Sold ${n} times since ${year}.`,
        inYear: (n: number, year: number) => `Sold ${n} times in ${year}.`,
        between: (n: number, first: number, last: number) => `Sold ${n} times from ${first} to ${last}.`,
        careful:
          'Quick resales can mean investors trading the property, and sometimes a forged deed. They can also be ordinary, such as an estate sale followed by a renovation sale.',
        next: 'Look at who sold and who bought in the history below. Owners and families can sign up for the City\'s free Fraud Guard alerts to learn when a document naming them is recorded.',
      },
      open_violations: {
        one: (when: string | null, what: string | null) =>
          `L&I lists 1 open violation${when ? `, from ${when}` : ''}${what ? ` for ${what}` : ''}.`,
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
      recorded: 'Recorded',
      document: 'Document',
      documentAndPrice: 'Document and price',
      fromAndTo: 'From and to',
      price: 'Price',
      from: 'From',
      to: 'To',
      noDate: 'No date',
      noPrice: 'None recorded',
      together: (n: number) => `for ${n} properties together`,
      more: (n: number) => `and ${plural(n, 'other', 'others')}`,
      noTransfers: 'No deeds on record.',
      recordsNote: 'City deed records are complete from 2000 on. Older sales may be missing.',
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
