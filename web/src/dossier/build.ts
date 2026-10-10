// Builds everything a lot page shows from three places, and says which one each part came from:
//
//   1. the weekly snapshot: the parcel's entry in its dossier shard (only for parcels on our list);
//   2. the map: the parcel's tile properties (kind, confidence, owner type, suggestions, lens);
//   3. live City lookups, when "Fetch live City data" is on: the owner, the deeds, the assessments,
//      the L&I records and, for parcels the snapshot does not cover, counts of what is nearby.
//
// Live data replaces the snapshot part by part. A part whose lookup is still running, failed or
// is turned off shows the snapshot with a line saying so, or nothing with a line saying why.
// Everything here is a plain function of its inputs, so tests can check every state.

import { watchNote, watchSigns, type WatchNote } from '../displacement/watch.ts';
import { correctionUrl, propertyPageUrl, atlasUrl, googleMapsUrl, streetViewUrl, TAX_CENTER_URL } from '../config/links.ts';
import { PERMISSION_ROUTES } from '../config/permission.ts';
import type { Manifest } from '../data/manifest.ts';
import { explainScore, type ScoreExplanation } from '../map/lens.ts';
import { parcelLensOf, placeSuggestions, suggestionsForLens } from '../places/rank.ts';
import { placeReasons, reasonContext, type PlaceReasons } from '../places/reasons.ts';
import type { Lens, Partner, Registry, Route, Suggestion } from '../registry/types.ts';
import type { AppState } from '../state/defaults.ts';
import { formatDate, formatMoney, formatTime, sentenceCase, strings } from '../strings.ts';
import { today } from './dates.ts';
import { CITY_LIST_SOURCE, cityListDate, cityStatusText, listingText, type ListingText } from './listing.ts';
import {
  FLAG_IDS,
  FLAG_PART,
  completeFlag,
  deedFraudLinks,
  flagLinks,
  helpLinks,
  liFacts,
  liFlags,
  mergeLinks,
  ownerFlagAllowed,
  ownerFlags,
  personLike,
  showsDeedFraudNotice,
  sortFlags,
  transferFlags,
  type FlagId,
} from './flags.ts';
import type { FailReason } from './http.ts';
import { isPrivate, ownerTypeFromNames, sameOwners } from './owners.ts';
import { plain } from './plain.ts';
import { FULL_RECORDS_FROM, isSheriff } from './transfers.ts';
import {
  LIST_SOURCES,
  buildTimeline,
  byYear,
  groupLi,
  withOlder,
  type LiGroups,
  type StorySentence,
  type TimelineKind,
  type TimelineRow,
  type TimelineYear,
} from './timeline.ts';
import { buildRules, type RulesView } from './rules.ts';
import type {
  Appeal,
  Assessment,
  CityOwned,
  Confidence,
  DossierNotes,
  HistoryParcel,
  LiSummary,
  LiveLi,
  LiveProperty,
  Link,
  Nearby,
  OwnerFlag,
  OwnerListParcel,
  OwnerType,
  PartialPart,
  ShardParcel,
  Transfer,
  VacancyKind,
} from './types.ts';
import { OWNER_TYPE_CODES } from './types.ts';

// Inputs ------------------------------------------------------------------------------------------

/** One live lookup: not asked (live data off, or not needed), running, answered, or failed. */
export type Part<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: T; at: number }
  | { status: 'failed'; reason: FailReason };

export interface LiveNearby {
  s12: number | null;
  s36: number | null;
  killed: number | null;
}

export interface LiveParts {
  property: Part<LiveProperty>;
  transfers: Part<Transfer[]>;
  assessments: Part<Assessment[]>;
  li: Part<LiveLi>;
  nearby: Part<LiveNearby>;
  /** The parcel's appeals to the City's boards (M4.6). */
  appeals: Part<Appeal[]>;
}

export const IDLE_PARTS: LiveParts = {
  property: { status: 'idle' },
  transfers: { status: 'idle' },
  assessments: { status: 'idle' },
  li: { status: 'idle' },
  nearby: { status: 'idle' },
  appeals: { status: 'idle' },
};

export type ShardState =
  | { status: 'loading' }
  | { status: 'found'; parcel: ShardParcel; generatedAt: string | null; notes?: DossierNotes | null }
  /**
   * No published shard has this parcel: "unlisted" when shards are published but none holds it
   * (it is not on our list), "unpublished" when no shards are published at all.
   */
  | { status: 'absent'; reason?: 'unlisted' | 'unpublished' }
  /** The shard could not be downloaded. */
  | { status: 'failed' };

/**
 * The lot timeline's records from the weekly copy (issue #38), fetched only when the History part
 * opens: not asked yet, loading, found, or why not (this build has none for the parcel, has none
 * at all, or the file could not be downloaded).
 */
export type HistoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; parcel: HistoryParcel; generatedAt: string | null }
  | { status: 'unlisted' }
  | { status: 'unpublished' }
  | { status: 'failed' };

export interface DossierInput {
  opa: string;
  registry: Registry;
  state: AppState;
  manifest: Manifest | null;
  shard: ShardState;
  /** The parcel's tile properties, when the map has it (parcels on our list). */
  tile: Record<string, unknown> | null;
  live: LiveParts;
  liveOn: boolean;
  /** A point on the parcel, for links to street imagery, when known. */
  center: [number, number] | null;
  now: Date;
  /** The weekly copy's timeline records (idle until the History part opens). */
  history?: HistoryState;
  /** The kinds of record the reader switched off in the timeline. */
  hiddenKinds?: readonly TimelineKind[];
}

// Output ------------------------------------------------------------------------------------------

export type Tone = 'live' | 'snapshot' | 'pending' | 'warning' | 'quiet';

export interface Provenance {
  tone: Tone;
  text: string;
}

export interface FlagView {
  id: string;
  title: string;
  text: string;
  careful: string | null;
  nextStep: string | null;
  links: Link[];
  /** For the many_parcels flag: an organization's list in tables/owners.json. */
  list?: string | null;
  /** For the many_parcels flag of an owner who may be a person: their other parcels, from this lot's record. */
  parcels?: OwnerListParcel[] | null;
  provenance: Provenance;
}

export interface RouteView {
  route: Route;
  lastChecked: string;
  confirm: boolean;
  /**
   * A caution shown before the steps: the route's own `warning` from the registry. The
   * conservatorship route always has one (the abuse warning of docs/ETHICS.md); if its registry
   * entry ever lacks it, the page adds the ETHICS.md wording itself.
   */
  warning: string | null;
}

/**
 * A lot the City's land agencies list as available (issue #36): the box at the top of "What you
 * can do", with the side yard route first where the lot may go to the neighbor next door.
 */
export interface ListingView extends ListingText {
  sideYard: RouteView | null;
  /**
   * The displacement caution (docs/ETHICS.md, "Displacement"; M4.1): where the displacement watch
   * marks the lot's area (`watch`, from the map's `dw` or the dossier's `displacement` block), the
   * one line caution pointing to the full card with the area's signs and the ways to protect
   * neighbors, shown once at the top of "What you can do"; the one line caution with its link
   * elsewhere (`watch` null). src/components/dossier/ListingBox.svelte shows it.
   */
  displacement: { caution: string; watch: WatchNote | null };
}

export interface SuggestionView {
  suggestion: Suggestion;
  /** The lawful route first: the routes that fit this parcel. */
  routes: RouteView[];
  partners: Partner[];
}

export interface TransferRow {
  date: string;
  document: string;
  price: string;
  from: string;
  to: string;
  sheriff: boolean;
  /** Before 2000: from records the City says may be incomplete. */
  early: boolean;
}

/**
 * The story of the lot in one timeline (issue #38, src/dossier/timeline.ts): one or two sentences
 * built only from records, then every record newest first by year, with the kinds the reader can
 * switch off.
 */
export interface TimelineView {
  /** waiting: the History part has not opened yet, and its records load when it does. */
  status: 'waiting' | 'loading' | 'ready';
  story: StorySentence[];
  /** The years and rows the reader sees: the kinds switched off are left out. */
  years: TimelineYear[];
  /** The newest records first, one per line, for print: the kinds switched off are left out. */
  newest: { date: string; kind: string; text: string }[];
  /** How many records the reader sees in all. */
  shown: number;
  kinds: { id: TimelineKind; label: string; count: number; shown: boolean }[];
  /** Records it cannot show, and why: never "none on record" for records never downloaded. */
  notes: { text: string; offerLive: boolean; retry: boolean }[];
  provenance: Provenance;
}

export interface AssessmentRow {
  year: number;
  value: string;
  marketValue: number | null;
}

export interface NearbyGroup {
  heading: string;
  rows: string[];
}

export interface SourceRow {
  id: string;
  name: string;
  publisher: string;
  homepage: string;
  when: string;
}

export interface DossierView {
  opa: string;
  title: string;
  /** Nothing to show yet: the first answers have not arrived. */
  loading: boolean;
  /** Nothing to show at all, and why. */
  empty: string | null;
  banner: Provenance & { retry: boolean; offerLive: boolean };
  summary: {
    address: string | null;
    listed: boolean;
    kindLabel: string;
    kindHelp: string | null;
    confidence: string | null;
    /** The vacancy model's fields behind the reasons (`rs`, `dy`, `sy`, `ny`), for src/places/reasons.ts. */
    reasonProperties: Record<string, unknown> | null;
    /** The reasons as sentences, or null when none are published. */
    reasons: PlaceReasons | null;
    /** How many independent records agree that it is vacant. */
    signals: string | null;
    cityCalls: string | null;
    /** The lot's frontage and depth as the assessor records them (M4.6), live or from the weekly copy. */
    lotSize: string | null;
    care: string[];
    lens: Lens | null;
    why: ScoreExplanation | null;
    /**
     * FEMA's floodplain on the lot (the tile's `fp`, M3.1): a reason for care shown beside the
     * score and never part of it, or null when the lot is not in it or the map has not said.
     */
    flood: string | null;
    links: Link[];
    provenance: Provenance;
  };
  actions: {
    listed: boolean;
    /** Listed as available by the City's land agencies (issue #36), or null. */
    listing: ListingView | null;
    suggestions: SuggestionView[];
    otherRoutes: RouteView[];
    /**
     * The displacement watch area the lot lies in (M4.1), from the map's `dw` or the dossier's
     * `displacement`: its greening suggestions then add the area's signs and the protections.
     */
    watch: WatchNote | null;
    /**
     * A federal brownfield record at or near the lot (M4.6), from the dossier's rules or the map's
     * `bf`: its garden suggestions carry the soil note.
     */
    brownfield: boolean;
  };
  /** Rules for this lot (M4.6, src/dossier/rules.ts), with where its appeals come from. */
  rules: RulesView & { provenance: Provenance; appealsProvenance: Provenance };
  owner: {
    names: string[];
    mailing: string | null;
    typeLabel: string;
    typeReason: string | null;
    /** What the City's list of public property says, in a sentence. */
    cityOwned: string | null;
    isPrivate: boolean;
    flags: FlagView[];
    /** Said when the flags about an owner who may be a person are held back on this parcel. */
    held: string | null;
    ownerChanged: boolean;
    deedFraud: { text: string; links: Link[] } | null;
    help: Link[] | null;
    tax: { flag: FlagView | null; text: string | null; link: Link };
    provenance: Provenance;
  };
  history: {
    transfers: TransferRow[] | null;
    transfersProvenance: Provenance;
    assessments: AssessmentRow[] | null;
    assessmentsProvenance: Provenance;
    li: { summary: string[] | null };
    timeline: TimelineView;
    /**
     * Said when records this dossier was not built from cannot be shown live (live data off, or
     * the City did not answer): they are not in the weekly copy, never "none on record".
     */
    notInCopy: { text: string; offerLive: boolean; retry: boolean } | null;
    liProvenance: Provenance;
  };
  nearby: {
    groups: NearbyGroup[];
    layers: { id: string; label: string }[];
    provenance: Provenance;
  };
  sources: {
    rows: SourceRow[];
    correctionUrl: string;
  };
}

// Helpers -----------------------------------------------------------------------------------------

const p = strings.dossier.provenance;

function snapshotDateText(date: string | null): string | null {
  return date ? formatDate(date) : null;
}

/** Where one part comes from, given its live lookup and whether the snapshot has it. */
export function provenanceOf<T>(part: Part<T>, hasSnapshot: boolean, snapshotDate: string | null, liveOn: boolean, fromMap = false): Provenance {
  const date = snapshotDateText(snapshotDate);
  const snapshot = (): Provenance =>
    fromMap ? { tone: 'snapshot', text: p.map } : { tone: 'snapshot', text: date ? p.snapshot(date) : p.snapshotNoDate };
  switch (part.status) {
    case 'ok':
      return { tone: 'live', text: p.live(formatTime(part.at)) };
    case 'loading':
      return { tone: 'pending', text: hasSnapshot ? p.checking : p.asking };
    case 'failed': {
      const reason = strings.failure[part.reason] ?? strings.failure.network!;
      if (hasSnapshot) return { tone: 'warning', text: fromMap ? `${p.failedNothing(reason)} ${p.map}` : p.failedSnapshot(reason, date ?? strings.dossier.sources.snapshotNoDate) };
      return { tone: 'warning', text: p.failedNothing(reason) };
    }
    case 'idle':
      if (!liveOn) {
        if (hasSnapshot) return fromMap ? { tone: 'snapshot', text: p.map } : { tone: 'snapshot', text: date ? p.offSnapshot(date) : p.snapshotNoDate };
        return { tone: 'quiet', text: p.offNothing };
      }
      return hasSnapshot ? snapshot() : { tone: 'quiet', text: p.none };
  }
}

function pick<T>(part: Part<T>, snapshot: T | null): T | null {
  return part.status === 'ok' ? part.data : snapshot;
}

const CONFIDENCE_BY_CODE: Record<number, Confidence> = { 3: 'high', 2: 'medium', 1: 'low' };
const KIND_BY_CODE: Record<number, VacancyKind> = { 1: 'lot', 2: 'building' };
const OWNER_TYPE_BY_CODE = Object.fromEntries(Object.entries(OWNER_TYPE_CODES).map(([type, code]) => [code, type])) as Record<
  number,
  OwnerType
>;

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function documentLabel(type: string): string {
  const upper = type.toUpperCase().replace(/\s+/g, ' ').trim();
  const known = strings.dossier.history.documents[upper];
  // Some City document types have a spaced hyphen ("DEED - ADVERSE POSSESSION"); a comma reads better.
  return known ?? sentenceCase(upper.replace(/\s+-\s+/g, ', '));
}

function namesText(names: string[], more: number): string {
  const list = names.map((name) => plain(name)).join('; ');
  return more > 0 ? `${list} ${strings.dossier.history.more(more)}` : list;
}

export function transferRow(t: Transfer): TransferRow {
  const h = strings.dossier.history;
  let price = t.price === null ? h.noPrice : formatMoney(t.price);
  if (t.price !== null && t.properties > 1) price = `${price}, ${h.share(t.properties)}`;
  return {
    date: t.date ? (formatDate(t.date, 'short') ?? t.date) : h.noDate,
    document: documentLabel(t.type),
    price,
    from: namesText(t.from, t.fromMore),
    to: namesText(t.to, t.toMore),
    sheriff: isSheriff(t),
    early: t.date !== null && t.date < FULL_RECORDS_FROM,
  };
}

function liSummaryLines(li: LiSummary): string[] {
  const h = strings.dossier.history;
  const day = (d: string | null | undefined) => (d ? (formatDate(d) ?? d) : null);
  const lines: string[] = [];
  if (li.openViolations !== null) lines.push(`${h.liSummaryOpen(li.openViolations)}.`.replace(/^./, (c) => c.toUpperCase()));
  if (li.violations != null) lines.push(h.liSince2016(li.violations));
  if (li.lastViolation) lines.push(h.liSummaryLast(day(li.lastViolation)!));
  if (li.unsafe) lines.push(day(li.unsafeSince) ? h.liUnsafeSince(day(li.unsafeSince)!) : h.liUnsafe);
  if (li.imminentlyDangerous) lines.push(day(li.dangerousSince) ? h.liDangerousSince(day(li.dangerousSince)!) : h.liDangerous);
  if (li.unsafe === false && li.imminentlyDangerous === false) lines.push(h.liNeither);
  if (li.sealed) lines.push(h.liSealed(day(li.sealed)!));
  if (li.demolished) lines.push(h.liDemolished(day(li.demolished)!));
  return lines;
}

/** "The City's list of public property names ... as the owner.", or null when the list names no agency we know. */
function cityListOwnerSentence(owned: CityOwned): string | null {
  const o = strings.dossier.owner;
  const agency = owned.agency ? (o.agencies[owned.agency.toUpperCase()] ?? null) : null;
  return agency ? o.cityListNames(agency) : null;
}

/** What the City's list of public property says about the parcel, in a sentence. */
export function cityOwnedText(owned: CityOwned | null): string | null {
  if (!owned) return null;
  const o = strings.dossier.owner;
  const parts = [cityListOwnerSentence(owned) ?? o.cityList];
  // The status in plain words, with what it means for neighbors (issue #36).
  if (owned.status) parts.push(cityStatusText(owned.status));
  if (owned.sideYardEligible) parts.push(o.sideYard);
  return parts.join(' ');
}

/**
 * The owner type's reason, less the sentence the City's list's own line says right after it:
 * for a parcel on the list, the reason is often "The City's list of public property names ... as
 * the owner.", the first sentence of that line too (finding F9 of docs/VERIFICATION_V0_3.md).
 * Anything the reason adds, such as other City records naming a different owner, stays.
 */
export function reasonBesideCityList(reason: string | null, owned: CityOwned | null): string | null {
  if (!reason || !owned) return reason;
  const sentence = cityListOwnerSentence(owned);
  if (!sentence || !reason.startsWith(sentence)) return reason;
  return reason.slice(sentence.length).trim() || null;
}

export function routeView(route: Route): RouteView {
  const own = route.warning?.trim() || null;
  return {
    route,
    lastChecked: formatDate(route.last_checked) ?? route.last_checked,
    confirm: route.status === 'confirm',
    warning: own ?? (route.id.includes('conservatorship') ? strings.dossier.actions.conservatorshipWarning : null),
  };
}

// The builder -------------------------------------------------------------------------------------

export function buildDossier(input: DossierInput): DossierView {
  const { opa, registry, state, manifest, shard, tile, live, liveOn, center, now } = input;
  const history: HistoryState = input.history ?? { status: 'idle' };
  const s = strings.dossier;
  const parcel = shard.status === 'found' ? shard.parcel : null;
  const snapshotDate = shard.status === 'found' ? shard.generatedAt : null;
  const asOf = today(now);
  const property = live.property.status === 'ok' ? live.property.data : null;
  const listed = parcel !== null || (tile !== null && int(tile.k) !== null);

  // Summary ---------------------------------------------------------------------------------------
  const kind: VacancyKind | null = parcel?.vacancy?.kind ?? KIND_BY_CODE[int(tile?.k) ?? -1] ?? null;
  const confidence: Confidence | null = parcel?.vacancy?.confidence ?? CONFIDENCE_BY_CODE[int(tile?.vc) ?? -1] ?? null;
  const address = plain(property?.address ?? parcel?.address ?? null);
  const care: string[] = [];
  if (parcel?.landcare) care.push(parcel.landcare.year ? s.summary.landcareSince(parcel.landcare.year) : s.summary.landcare);
  else if (int(tile?.lc) === 1) care.push(s.summary.landcare);
  if (parcel?.garden) care.push(s.summary.garden);
  // The lens values: the map tile's when the lot was opened from the map, else the dossier's copy
  // of the same values (a link, a search or a saved list), the tile's winning where both have
  // one, so the breakdown and the flood note show however the page was opened (issue #31).
  const lensValues: Record<string, unknown> | null = tile || parcel?.lens ? { ...(parcel?.lens ?? {}), ...(tile ?? {}) } : null;
  const lens = lensValues ? parcelLensOf(registry, state) : null;
  const why = lens && lensValues ? explainScore(lens, state.weights[lens.id], lensValues) : null;
  const point = center ?? (property?.lng != null && property.lat != null ? ([property.lng, property.lat] as [number, number]) : null);
  const links: Link[] = [
    { label: s.summary.propertyPage, url: propertyPageUrl(opa) },
    { label: s.summary.atlas, url: atlasUrl(opa) },
  ];
  if (point) {
    links.push({ label: s.summary.streetView, url: streetViewUrl(point[0], point[1]) });
    links.push({ label: s.summary.googleMaps, url: googleMapsUrl(point[0], point[1]) });
  }
  const vacancy = parcel?.vacancy ?? null;
  const reasonProperties: Record<string, unknown> | null = vacancy
    ? { rs: vacancy.rs, dy: vacancy.dy, sy: vacancy.sy, ny: vacancy.ny }
    : tile && tile.rs !== undefined
      ? { rs: tile.rs, dy: tile.dy, sy: tile.sy, ny: tile.ny }
      : null;
  const reasons = reasonProperties ? placeReasons(reasonProperties, reasonContext(manifest)) : null;
  const signalCount = vacancy?.n ?? int(tile?.n);

  // What you can do ------------------------------------------------------------------------------
  const suggestionIds = parcel ? parcel.suggestions : typeof tile?.sg === 'string' ? tile.sg : '';
  const suggestions = suggestionsForLens(
    placeSuggestions(registry, state, { sg: Array.isArray(suggestionIds) ? suggestionIds.join(',') : suggestionIds }).filter(
      (sg) => sg.applies_to === 'parcel',
    ),
    parcelLensOf(registry, state),
  );
  // A homestead exemption in the City's live record rules out conservatorship, as the pipeline
  // does for the snapshot (docs/ETHICS.md): the City's records say someone lives there, or did.
  const homestead = property?.homestead === true;
  const parcelRoutes = (parcel?.routes ?? [])
    .filter((id) => !(homestead && id.includes('conservatorship')))
    .map((id) => registry.routes.find((r) => r.id === id))
    .filter((r): r is Route => !!r);
  const used = new Set<string>();
  const suggestionViews: SuggestionView[] = suggestions.map((suggestion) => {
    let routes = parcelRoutes.filter((r) => suggestion.routes.includes(r.id));
    if (routes.length === 0) {
      const first = registry.routes.find((r) => r.id === suggestion.routes[0]);
      routes = first ? [first] : [];
    }
    // After the permission to use the land, the suggestion's own ways to do it (M3.1: the City's
    // free street trees and TreePhilly's giveaway trees for planting shade trees).
    const doIt = suggestion.routes
      .filter((id) => !PERMISSION_ROUTES.has(id) && !routes.some((r) => r.id === id))
      .map((id) => registry.routes.find((r) => r.id === id))
      .filter((r): r is Route => !!r);
    routes = [...routes, ...doIt];
    routes.forEach((r) => used.add(r.id));
    return {
      suggestion,
      routes: routes.map(routeView),
      partners: suggestion.partners.map((id) => registry.partners.find((pt) => pt.id === id)).filter((pt): pt is Partner => !!pt),
    };
  });

  // Who owns it -----------------------------------------------------------------------------------
  const shardOwner = parcel?.owner ?? null;
  const ownerChanged = !!(property && shardOwner && shardOwner.names.length && !sameOwners(shardOwner.names, property.names));
  let ownerType: OwnerType;
  let typeReason: string | null;
  if (property && shardOwner && !ownerChanged) {
    ownerType = shardOwner.type;
    typeReason = shardOwner.typeReason;
  } else if (property) {
    const found = ownerTypeFromNames(property.names);
    ownerType = found.type;
    typeReason = found.reason;
  } else if (shardOwner) {
    ownerType = shardOwner.type;
    typeReason = shardOwner.typeReason;
  } else {
    ownerType = OWNER_TYPE_BY_CODE[int(tile?.ot) ?? 0] ?? 'unknown';
    typeReason = null;
  }
  // Listed as available by the City's land agencies (issue #36): from the dossier, or from the
  // map's `la` while the dossier is not at hand, and not when the City now names another owner.
  // The side yard route leads it where the lot may go to the neighbor next door, and is then not
  // repeated among the other routes.
  const owned = shardOwner?.cityOwned ?? null;
  const available = owned ? owned.available : !parcel && int(tile?.la) === 1;
  // The displacement watch area the lot lies in (M4.1), for the listing box and the greening cards.
  const watch = watchNote(registry, watchSigns(tile, parcel?.displacement?.signs));
  let listing: ListingView | null = null;
  if (available && !ownerChanged) {
    const sideYardRoute = owned?.sideYardEligible ? (parcelRoutes.find((r) => r.id === 'land_bank_side_yard') ?? null) : null;
    if (sideYardRoute) used.add(sideYardRoute.id);
    const words = listingText(owned?.status ?? null, cityListDate(manifest), sideYardRoute !== null);
    listing = {
      ...words,
      sideYard: sideYardRoute ? routeView(sideYardRoute) : null,
      displacement: { caution: strings.displacement.caution, watch },
    };
  }
  const otherRoutes = parcelRoutes.filter((r) => !used.has(r.id)).map(routeView);

  const rawNames = property ? property.names : (shardOwner?.names ?? []);
  const names = rawNames.map((name) => plain(name));
  const privateOwner = isPrivate(ownerType, names.length > 0 || (!property && !shardOwner && ownerType !== 'unknown'));
  // The flags about an owner who may be a person wait for a vacancy call, and possible estate is
  // never shown with a homestead exemption: the pipeline's rule, so the snapshot and live data
  // agree (docs/ETHICS.md, docs/VERIFICATION.md D5 and D6).
  // A parcel in the snapshot is judged by its own vacancy call, the one the pipeline used; one
  // known only from the map, by its tile.
  const callConfidence = parcel ? (parcel.vacancy?.confidence ?? null) : confidence;
  const calledVacant = callConfidence === 'high' || callConfidence === 'medium';
  const flagRule = { personLike: personLike(ownerType, rawNames), calledVacant, homestead };
  const ownerHeld = flagRule.personLike && !calledVacant;
  const snapshotProvenance: Provenance = {
    tone: 'snapshot',
    text: snapshotDateText(snapshotDate) ? p.snapshot(snapshotDateText(snapshotDate)!) : p.snapshotNoDate,
  };
  const liveProvenance = (part: Part<unknown>): Provenance =>
    part.status === 'ok' ? { tone: 'live', text: p.live(formatTime(part.at)) } : snapshotProvenance;

  const liveFlags: Partial<Record<'owner' | 'transfers' | 'li', OwnerFlag[]>> = {};
  if (property) liveFlags.owner = ownerFlags(property, privateOwner);
  if (live.transfers.status === 'ok') {
    liveFlags.transfers = transferFlags(live.transfers.data, property ? { date: property.saleDate, price: property.salePrice } : null, privateOwner, asOf);
  }
  if (live.li.status === 'ok') liveFlags.li = liFlags(live.li.data.events);

  const notes = shard.status === 'found' ? (shard.notes ?? null) : null;
  const routeLinks = (ids: string[]): Link[] =>
    ids
      .map((id) => registry.routes.find((r) => r.id === id))
      .filter((r): r is Route => !!r && r.links.length > 0)
      .map((r) => ({ label: r.label, url: r.links[0]!.url }));
  const complete = (flag: OwnerFlag): OwnerFlag => {
    const note = notes?.flags[flag.id] ?? null;
    const whole = completeFlag(flag, note, routeLinks(note?.routes ?? []));
    // A flag's text can quote a City record, such as a violation title.
    return { ...whole, text: plain(whole.text) };
  };
  const shardFlags = (shardOwner?.flags ?? []).map(complete);
  const flagViews: FlagView[] = [];
  const title = (id: string) => s.owner.flagTitles[id] ?? s.owner.otherFlag;
  for (const id of FLAG_IDS) {
    const part = FLAG_PART[id as FlagId];
    const fromLive = part !== 'snapshot' ? liveFlags[part] : undefined;
    if (fromLive) {
      const livePart = part === 'owner' ? live.property : part === 'transfers' ? live.transfers : live.li;
      for (const flag of fromLive.filter((x) => x.id === id)) {
        flagViews.push({ ...complete(flag), title: title(id), provenance: liveProvenance(livePart) });
      }
      continue;
    }
    // Flags about the owner (not the property) are left out when the owner has changed.
    if (ownerChanged && (part === 'owner' || id === 'many_parcels' || id === 'years_since_sale')) continue;
    for (const flag of shardFlags.filter((x) => x.id === id)) flagViews.push({ ...flag, title: title(id), provenance: snapshotProvenance });
  }
  if (!ownerChanged) {
    for (const flag of shardFlags.filter((x) => !(FLAG_IDS as readonly string[]).includes(x.id))) {
      flagViews.push({ ...flag, title: title(flag.id), provenance: snapshotProvenance });
    }
  }
  const sortedFlags = sortFlags(flagViews.filter((flag) => ownerFlagAllowed(flag.id, flagRule)));
  const taxFlag = sortedFlags.find((x) => x.id === 'tax_debt_2025') ?? null;
  const listedFlags = sortedFlags.filter((x) => x.id !== 'tax_debt_2025');
  const showDeedFraud = showsDeedFraudNotice(ownerType, rawNames);
  const deedNote = notes?.notices.deed_fraud ?? null;
  const helpRoutes = !ownerChanged && shardOwner?.help.length ? routeLinks(shardOwner.help) : [];
  const ownerPart = live.property;
  const ownerProvenance = provenanceOf(ownerPart, shardOwner !== null, snapshotDate, liveOn, !shardOwner && tile !== null);

  // History ---------------------------------------------------------------------------------------
  // Parts the dossier was not built from show live data or say they are not in the weekly copy.
  const partial = parcel?.partial ?? [];
  const livePartOf = (part: PartialPart): Part<unknown> => (part === 'transfers' ? live.transfers : part === 'assessments' ? live.assessments : live.li);
  const unseen = partial.filter((part) => livePartOf(part).status !== 'ok');
  const missing = partial.filter((part) => {
    const status = livePartOf(part).status;
    return status === 'failed' || (status === 'idle' && !liveOn);
  });
  const transfers = unseen.includes('transfers') ? null : pick(live.transfers, parcel?.transfers ?? null);
  const assessments = unseen.includes('assessments') ? null : pick(live.assessments, parcel?.assessments ?? null);
  const liveLi = live.li.status === 'ok' ? live.li.data : null;
  const shardLi = parcel?.li ?? null;
  let liSummary: string[] | null = null;
  if (!liveLi && shardLi) liSummary = liSummaryLines(shardLi);
  if (liveLi) {
    const facts = liFacts(liveLi.events);
    liSummary = liSummaryLines({
      openViolations: facts.openViolations,
      lastViolation: liveLi.events.find((e) => e.kind === 'violation')?.date ?? null,
      unsafe: facts.unsafeSince !== null,
      imminentlyDangerous: facts.dangerousSince !== null,
    });
  }

  // The timeline: deeds as shown above, L&I records live or from the weekly copy, and the copy's
  // vacancy records, so it reads the same with live data on or off (live adds newer records).
  const copy = history.status === 'found' ? history.parcel : null;
  const copyDate = history.status === 'found' ? (history.generatedAt ?? snapshotDate) : snapshotDate;
  let timelineLi: LiGroups | null = copy?.li ?? null;
  if (liveLi) timelineLi = liveLi.truncated ? withOlder(groupLi(liveLi.events), copy?.li ?? null) : groupLi(liveLi.events);
  const tl = s.history.timeline;
  const settled = history.status !== 'idle' && history.status !== 'loading';
  // Appeals (M4.6): the City's answer when live, else the weekly copy's; null when not known.
  const appeals: Appeal[] | null = live.appeals.status === 'ok' ? live.appeals.data : parcel && !parcel.missing.includes('appeals') ? (parcel.appeals ?? []) : null;
  const built = buildTimeline({ transfers, li: timelineLi, appeals, lists: copy?.lists ?? [], landcare: parcel?.landcare ?? null, today: asOf });
  const hidden = new Set(input.hiddenKinds ?? []);
  const visible: TimelineRow[] = built.rows.filter((row) => !hidden.has(row.kind));
  const timelineNotes: TimelineView['notes'] = [];
  if (settled && timelineLi === null && live.li.status !== 'loading') {
    if (history.status === 'failed' && live.li.status !== 'ok') timelineNotes.push({ text: tl.failed, offerLive: !liveOn, retry: true });
    else timelineNotes.push({ text: tl.liMissing, offerLive: !liveOn, retry: liveOn && live.li.status === 'failed' });
  }
  const timeline: TimelineView = {
    // Waiting until the History part asks for the weekly copy's records, even when the City has
    // answered: the copy also holds the vacancy records.
    status: history.status === 'idle' ? 'waiting' : history.status === 'loading' ? 'loading' : 'ready',
    story: built.story,
    years: byYear(visible),
    newest: visible
      .filter((row) => row.day !== null)
      .flatMap((row) => row.items.map((item) => ({ date: row.day!.length === 4 ? row.day! : (formatDate(row.day, 'short') ?? row.day!), kind: row.label, text: item.text })))
      .slice(0, 10),
    shown: visible.reduce((sum, row) => sum + row.items.length, 0),
    kinds: built.kinds.map((k) => ({ ...k, shown: !hidden.has(k.id) })),
    notes: timelineNotes,
    provenance: provenanceOf(live.li, copy?.li != null, copyDate, liveOn),
  };

  // Nearby -----------------------------------------------------------------------------------------
  const n = s.nearby;
  const groups: NearbyGroup[] = [];
  const shardNearby: Nearby | null = parcel?.nearby ?? null;
  let nearbyProvenance: Provenance;
  if (shardNearby) {
    const area: string[] = [];
    if (shardNearby.s12 !== null) area.push(n.s12(shardNearby.s12));
    if (shardNearby.s36 !== null) area.push(n.s36(shardNearby.s36));
    if (area.length) groups.push({ heading: n.areaSnapshot, rows: area });
    const within: string[] = [];
    if (shardNearby.landcare !== null) within.push(n.landcare(shardNearby.landcare));
    if (shardNearby.gardens !== null) within.push(n.gardens(shardNearby.gardens));
    if (shardNearby.hearings != null && shardNearby.hearings > 0) within.push(n.hearings(shardNearby.hearings));
    if (within.length) groups.push({ heading: n.within500, rows: within });
    if (shardNearby.playground) {
      groups.push({ heading: n.playgroundHeading, rows: [n.playground(shardNearby.playground.name, shardNearby.playground.meters)] });
    }
    nearbyProvenance = snapshotProvenance;
  } else {
    const liveNearby = live.nearby.status === 'ok' ? live.nearby.data : null;
    if (liveNearby) {
      const rows: string[] = [];
      if (liveNearby.s12 !== null) rows.push(n.s12(liveNearby.s12));
      if (liveNearby.s36 !== null) rows.push(n.s36(liveNearby.s36));
      if (liveNearby.killed !== null) rows.push(n.killed(liveNearby.killed));
      if (rows.length) groups.push({ heading: n.within500, rows });
    }
    nearbyProvenance = provenanceOf(live.nearby, false, null, liveOn);
  }
  const layerIds = [
    'shootings_hex',
    'memorials',
    'landcare_lots',
    'gardens',
    ...(shardNearby?.hearings ? ['hearings'] : []),
    ...(shardNearby?.playground ? ['playgrounds'] : []),
  ];
  const layers = layerIds
    .map((id) => registry.layers.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => !!l && !state.layers.includes(l.id))
    .map((l) => ({ id: l.id, label: l.label.toLowerCase() }));

  // Sources ---------------------------------------------------------------------------------------
  const sourceRows: SourceRow[] = [];
  const addSource = (id: string, when: string) => {
    const source = registry.sources.find((x) => x.id === id);
    if (!source || sourceRows.some((r) => r.id === id)) return;
    const newest = manifest?.sources[id]?.newest_record;
    const newestText = newest && when.startsWith(strings.dossier.sources.snapshot('').slice(0, 6)) ? formatDate(newest) : null;
    sourceRows.push({
      id,
      name: source.name,
      publisher: source.publisher,
      homepage: source.homepage,
      when: newestText ? `${when}, ${strings.dossier.sources.newest(newestText)}` : when,
    });
  };
  const src = s.sources;
  const snapshotWhen = snapshotDateText(snapshotDate) ? src.snapshot(snapshotDateText(snapshotDate)!) : src.snapshotNoDate;
  const whenFor = (part: Part<unknown>, inSnapshot: boolean): string | null =>
    part.status === 'ok' ? src.live(formatTime(part.at)) : inSnapshot ? snapshotWhen : null;
  const ownerWhen = whenFor(live.property, !!shardOwner || !!parcel?.address);
  if (ownerWhen) addSource('opa_properties', ownerWhen);
  if (vacancy) {
    addSource('vacant_indicators_land', snapshotWhen);
    addSource('vacant_indicators_bldg', snapshotWhen);
  }
  const transfersWhen = whenFor(live.transfers, parcel?.transfers != null);
  if (transfersWhen) addSource('real_estate_transfers', transfersWhen);
  const assessmentsWhen = whenFor(live.assessments, parcel?.assessments != null);
  if (assessmentsWhen) addSource('assessment_history', assessmentsWhen);
  const liWhen = whenFor(live.li, shardLi !== null);
  if (liWhen) {
    addSource('li_violations', liWhen);
    if (live.li.status === 'ok') ['li_permits', 'li_demolitions', 'li_clean_and_seal'].forEach((id) => addSource(id, liWhen));
    addSource('li_unsafe', liWhen);
    addSource('li_imminently_dangerous', liWhen);
  }
  // The timeline's own records from the weekly copy (issue #38).
  const copyWhen = snapshotDateText(copyDate) ? src.snapshot(snapshotDateText(copyDate)!) : src.snapshotNoDate;
  if (copy?.li && live.li.status !== 'ok') addSource('li_history', copyWhen);
  for (const record of copy?.lists ?? []) addSource(LIST_SOURCES[record.list], copyWhen);
  // The City's list of public property, dated by the day it was fetched (its records carry no
  // date of their own; issue #36).
  if ((shardOwner?.cityOwned && !ownerChanged) || listing) {
    const listDate = cityListDate(manifest);
    addSource(CITY_LIST_SOURCE, listDate ? src.snapshot(listDate) : parcel ? snapshotWhen : p.map);
  }
  if (taxFlag) addSource('cagp_tax_2025', src.taxSnapshot);
  // Rules for this lot (M4.6).
  const lotRules = parcel?.rules ?? null;
  if (lotRules?.districts.length || lotRules?.register) {
    addSource('historic_districts', snapshotWhen);
    addSource('historic_sites', snapshotWhen);
  }
  if (lotRules?.zoning) addSource('zoning_base_districts', snapshotWhen);
  if (lotRules?.overlays.length) addSource('zoning_overlays', snapshotWhen);
  if (lotRules?.brownfields.length) addSource('epa_brownfields', snapshotWhen);
  const appealsWhen = whenFor(live.appeals, !!parcel && !parcel.missing.includes('appeals'));
  if (appealsWhen && appeals?.length) addSource('appeals', appealsWhen);
  if (shardNearby) {
    if (shardNearby.s12 !== null || shardNearby.s36 !== null) addSource('shootings', snapshotWhen);
    if (shardNearby.landcare !== null) addSource('phs_landcare', snapshotWhen);
    if (shardNearby.playground) addSource('ppr_playgrounds', snapshotWhen);
    if (shardNearby.gardens !== null) {
      addSource('gardens_phs_ngt', snapshotWhen);
      addSource('gardens_registered', snapshotWhen);
    }
  } else if (live.nearby.status === 'ok') {
    const when = src.live(formatTime(live.nearby.at));
    addSource('shootings', when);
    addSource('fatal_crashes', when);
  }
  if (care.length && (parcel?.landcare || int(tile?.lc) === 1)) addSource('phs_landcare', parcel ? snapshotWhen : p.map);

  // The page as a whole ----------------------------------------------------------------------------
  const asked = (Object.values(live) as Part<unknown>[]).filter((x) => x.status !== 'idle');
  const failed = asked.filter((x) => x.status === 'failed');
  const loadingParts = asked.filter((x) => x.status === 'loading');
  let banner: DossierView['banner'];
  if (!liveOn) {
    const date = snapshotDateText(snapshotDate);
    banner = { tone: 'snapshot', text: date ? s.banner.off(date) : s.banner.offNoDate, retry: false, offerLive: true };
  } else if (loadingParts.length) banner = { tone: 'pending', text: s.banner.loading, retry: false, offerLive: false };
  else if (failed.length && failed.length === asked.length) banner = { tone: 'warning', text: s.banner.failed, retry: true, offerLive: false };
  else if (failed.length) banner = { tone: 'warning', text: s.banner.partial, retry: true, offerLive: false };
  else if (asked.length) banner = { tone: 'live', text: s.banner.live, retry: false, offerLive: false };
  else banner = { ...snapshotProvenance, retry: false, offerLive: false };

  const nothingYet = shard.status === 'loading' && !tile && !property;
  let empty: string | null = null;
  if (!nothingYet && !parcel && !tile && !property && live.property.status !== 'loading') {
    if (!liveOn) empty = s.noData;
    else if (live.property.status === 'failed' && live.property.reason === 'not_found') empty = s.notFound;
    else if (live.property.status === 'failed') empty = s.provenance.failedNothing(strings.failure[live.property.reason] ?? strings.failure.network!);
  }

  const typeLabel = s.ownerType.labels[ownerType] ?? s.ownerType.labels.unknown!;
  return {
    opa,
    title: address ?? s.parcel(opa),
    loading: nothingYet,
    empty,
    banner,
    summary: {
      address,
      listed,
      kindLabel: kind
        ? (s.summary.kind[kind] ?? s.summary.notListed)
        : listed
          ? strings.place.kindUnknown
          : shard.status === 'absent' && shard.reason === 'unpublished'
            ? s.summary.noDetails
            : s.summary.notListed,
      kindHelp: listed
        ? null
        : [s.summary.noPublishedDetails, shard.status === 'absent' && shard.reason === 'unpublished' ? '' : s.summary.notListedHelp]
            .filter(Boolean)
            .join(' '),
      confidence: confidence ? (s.summary.confidence[confidence] ?? null) : null,
      reasonProperties,
      reasons,
      signals: signalCount !== null && signalCount > 0 ? s.summary.signals(signalCount) : null,
      cityCalls: property?.category ? s.summary.cityCalls(plain(sentenceCase(property.category))) : null,
      lotSize:
        property?.frontage && property.depth
          ? s.summary.lotSize(property.frontage, property.depth)
          : parcel?.lotSize
            ? s.summary.lotSize(parcel.lotSize.frontage, parcel.lotSize.depth)
            : null,
      care,
      lens,
      why,
      flood: s.summary.flood[int(lensValues?.fp) ?? 0] ?? null,
      links,
      provenance: parcel ? snapshotProvenance : tile ? { tone: 'snapshot', text: p.map } : provenanceOf(live.property, false, null, liveOn),
    },
    actions: { listed, listing, suggestions: suggestionViews, otherRoutes, watch, brownfield: (lotRules?.brownfields.length ?? 0) > 0 || int(tile?.bf) === 1 },
    rules: {
      ...buildRules({
        opa,
        address,
        rules: lotRules,
        listed: parcel !== null,
        missing: parcel?.missing ?? [],
        overlays: notes?.overlays ?? {},
        appeals,
        appealsUnknown:
          appeals === null && live.appeals.status !== 'loading'
            ? { offerLive: !liveOn, retry: liveOn && live.appeals.status === 'failed' }
            : null,
        today: asOf,
      }),
      provenance: parcel ? snapshotProvenance : { tone: 'quiet', text: '' },
      appealsProvenance: provenanceOf(live.appeals, !!parcel && !parcel.missing.includes('appeals'), snapshotDate, liveOn),
    },
    owner: {
      names,
      mailing: plain(property ? property.mailing : (shardOwner?.mailing ?? null)),
      typeLabel,
      // The City's list's own line, shown below the owner type, names the owner already.
      typeReason: ownerChanged ? typeReason : reasonBesideCityList(typeReason, shardOwner?.cityOwned ?? null),
      cityOwned: ownerChanged ? null : cityOwnedText(shardOwner?.cityOwned ?? null),
      isPrivate: privateOwner,
      flags: listedFlags,
      held: ownerHeld ? s.owner.heldBack : null,
      ownerChanged,
      deedFraud: showDeedFraud
        ? { text: deedNote?.text ?? s.owner.deedFraud, links: mergeLinks(deedNote?.links ?? [], routeLinks(deedNote?.routes ?? []), deedFraudLinks()) }
        : null,
      help: privateOwner && sortedFlags.length > 0 ? mergeLinks(helpRoutes, helpLinks()) : null,
      tax: {
        flag: taxFlag ? { ...taxFlag, links: mergeLinks(taxFlag.links, flagLinks('tax_debt_2025')) } : null,
        text: taxFlag ? null : ownerHeld ? s.owner.taxHeld : parcel ? s.owner.taxNoDebt : s.owner.taxUnknown,
        link: { label: s.owner.taxCenter, url: TAX_CENTER_URL },
      },
      provenance: ownerProvenance,
    },
    history: {
      transfers: transfers ? transfers.map(transferRow) : null,
      transfersProvenance: provenanceOf(live.transfers, parcel?.transfers != null && !unseen.includes('transfers'), snapshotDate, liveOn),
      assessments: assessments
        ? [...assessments]
            .sort((a, b) => b.year - a.year)
            .map((a) => ({ year: a.year, marketValue: a.marketValue, value: a.marketValue === null ? s.history.noValue : formatMoney(a.marketValue) }))
        : null,
      assessmentsProvenance: provenanceOf(live.assessments, parcel?.assessments != null && !unseen.includes('assessments'), snapshotDate, liveOn),
      li: { summary: liSummary },
      timeline,
      liProvenance: provenanceOf(live.li, shardLi !== null, snapshotDate, liveOn),
      notInCopy: missing.length
        ? {
            text: s.history.notInCopy(missing.map((part) => s.history.partialParts[part]!)),
            offerLive: !liveOn,
            retry: liveOn && missing.some((part) => livePartOf(part).status === 'failed'),
          }
        : null,
    },
    nearby: { groups, layers, provenance: nearbyProvenance },
    sources: { rows: sourceRows, correctionUrl: correctionUrl(opa, address) },
  };
}

