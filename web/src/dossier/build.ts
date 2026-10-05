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

import { correctionUrl, propertyPageUrl, atlasUrl, googleMapsUrl, streetViewUrl, TAX_CENTER_URL } from '../config/links.ts';
import type { Manifest } from '../data/manifest.ts';
import { explainScore, type ScoreExplanation } from '../map/lens.ts';
import { parcelLensOf, placeSuggestions } from '../places/rank.ts';
import { placeReasons, reasonContext, type PlaceReasons } from '../places/reasons.ts';
import type { Lens, Partner, Registry, Route, Suggestion } from '../registry/types.ts';
import type { AppState } from '../state/defaults.ts';
import { formatDate, formatMoney, formatTime, sentenceCase, strings } from '../strings.ts';
import { today } from './dates.ts';
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
import { isSheriff } from './transfers.ts';
import type {
  Assessment,
  CityOwned,
  Confidence,
  DossierNotes,
  LiEvent,
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
}

export const IDLE_PARTS: LiveParts = {
  property: { status: 'idle' },
  transfers: { status: 'idle' },
  assessments: { status: 'idle' },
  li: { status: 'idle' },
  nearby: { status: 'idle' },
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
}

export interface AssessmentRow {
  year: number;
  value: string;
  marketValue: number | null;
}

export interface LiRow {
  date: string;
  kind: string;
  what: string;
  status: string | null;
  open: boolean;
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
    care: string[];
    lens: Lens | null;
    why: ScoreExplanation | null;
    links: Link[];
    provenance: Provenance;
  };
  actions: {
    listed: boolean;
    suggestions: SuggestionView[];
    otherRoutes: RouteView[];
  };
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
    li: { rows: LiRow[] | null; summary: string[] | null; truncated: boolean; liveForTimeline: boolean };
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
  };
}

/** Abbreviations L&I writes in its titles, kept in capitals ("ID STRUCTURE" is imminently dangerous). */
const LI_ABBREVIATIONS = new Set(['ID', 'L&I', 'HVAC']);

/** An L&I title in sentence case, with its abbreviations still in capitals. */
export function cityTitle(text: string): string {
  return sentenceCase(text)
    .split(' ')
    .map((word) => (LI_ABBREVIATIONS.has(word.toUpperCase()) ? word.toUpperCase() : word))
    .join(' ');
}

export function liRow(e: LiEvent): LiRow {
  const h = strings.dossier.history;
  const title = e.title ? cityTitle(e.title) : '';
  const detail = e.kind === 'permit' && e.detail && e.detail.toLowerCase() !== (e.title ?? '').toLowerCase() ? cityTitle(e.detail) : '';
  return {
    date: e.date ? (formatDate(e.date, 'short') ?? e.date) : h.noDate,
    kind: h.kinds[e.kind] ?? sentenceCase(e.kind),
    what: plain([title, detail].filter(Boolean).join(': ')),
    status: e.status ? plain(sentenceCase(e.status)) : null,
    open: e.open,
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

/** What the City's list of public property says about the parcel, in a sentence. */
export function cityOwnedText(owned: CityOwned | null): string | null {
  if (!owned) return null;
  const o = strings.dossier.owner;
  const agency = owned.agency ? (o.agencies[owned.agency.toUpperCase()] ?? null) : null;
  const parts = [agency ? o.cityListNames(agency) : o.cityList];
  if (owned.status) parts.push(o.cityListStatus(plain(sentenceCase(owned.status))));
  if (owned.sideYardEligible) parts.push(o.sideYard);
  return parts.join(' ');
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
  const lens = tile ? parcelLensOf(registry) : null;
  const why = lens && tile ? explainScore(lens, state.weights[lens.id], tile) : null;
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
  const suggestions = placeSuggestions(registry, state, { sg: Array.isArray(suggestionIds) ? suggestionIds.join(',') : suggestionIds }).filter(
    (sg) => sg.applies_to === 'parcel',
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
    routes.forEach((r) => used.add(r.id));
    return {
      suggestion,
      routes: routes.map(routeView),
      partners: suggestion.partners.map((id) => registry.partners.find((pt) => pt.id === id)).filter((pt): pt is Partner => !!pt),
    };
  });
  const otherRoutes = parcelRoutes.filter((r) => !used.has(r.id)).map(routeView);

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
  const liRows = liveLi ? liveLi.events.map(liRow) : null;
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
    if (within.length) groups.push({ heading: n.within500, rows: within });
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
  const layerIds = ['shootings_hex', 'memorials', 'landcare_lots', 'gardens'];
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
  if (taxFlag) addSource('cagp_tax_2025', src.taxSnapshot);
  if (shardNearby) {
    if (shardNearby.s12 !== null || shardNearby.s36 !== null) addSource('shootings', snapshotWhen);
    if (shardNearby.landcare !== null) addSource('phs_landcare', snapshotWhen);
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
      care,
      lens,
      why,
      links,
      provenance: parcel ? snapshotProvenance : tile ? { tone: 'snapshot', text: p.map } : provenanceOf(live.property, false, null, liveOn),
    },
    actions: { listed, suggestions: suggestionViews, otherRoutes },
    owner: {
      names,
      mailing: plain(property ? property.mailing : (shardOwner?.mailing ?? null)),
      typeLabel,
      typeReason,
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
      li: { rows: liRows, summary: liSummary, truncated: liveLi?.truncated ?? false, liveForTimeline: !liveLi },
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

