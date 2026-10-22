// A packet (M5.1, issue #45; docs/DESIGN.md "Organizing tools"): a cover page, the displacement card
// once when any lot needs it, a contacts page, and one page per lot, made from a saved list or the
// places the analysis view ranks. Built only from the weekly copy, so it is the same for everyone
// who makes it this week and asks no other server.
//
// Everything here is a plain function of the lots' lot page views (src/dossier/build.ts), so the
// rules of the lot page carry over: the flags exactly as docs/ETHICS.md allows them on each parcel,
// the legal routes first, the suggestions under the lens chosen, the brownfield soil note, and the
// displacement card shown once with a one line caution on each page it applies to.

import { displacementCaution, isGarden } from '../config/suggestions.ts';
import { PERMISSION_ROUTES } from '../config/permission.ts';
import type { DossierView } from '../dossier/build.ts';
import { signsText, protectionLinks, type ProtectionLink } from '../displacement/watch.ts';
import type { ShardParcel } from '../dossier/types.ts';
import { ownerLetterGate, type OwnerLetterGate } from '../letters/gate.ts';
import type { Registry } from '../registry/types.ts';
import { atLargeSource, rcoRows, seatRows, wardText, type ContactsState, type ContactsTable, type RcoContact, type SeatKind, type SeatRow } from '../represent/contacts.ts';
import { formatDate, strings } from '../strings.ts';

/** The most lots one packet holds: about 60 printed pages. */
export const MAX_PACKET = 50;
/** What each lot's page keeps, so it fits on one Letter page. */
export const PACKET_LIMITS = { reasons: 4, flags: 5, routes: 4, suggestions: 3, rules: 6 } as const;

export interface PacketLotInput {
  opa: string;
  view: DossierView;
  /** The lot's dossier record, or null when the weekly copy has none for it. */
  parcel: ShardParcel | null;
  center: [number, number] | null;
}

export interface PacketRoute {
  label: string;
  /** The first thing to do, from the route's steps. */
  first: string | null;
  /** A caution shown before the route wherever it appears (the conservatorship abuse warning). */
  warning: string | null;
}

export interface PacketAction {
  label: string;
  cost: string;
  evidence: string;
  /** The one line displacement caution, with a pointer to the card at the front when it is there. */
  caution: string | null;
  /** The owner's soil note beside a garden suggestion at or near a federal brownfield record. */
  soil: string | null;
  /** Garden and memorial suggestions say when to ask first. */
  blessing: string | null;
}

export interface PacketLot {
  n: number;
  opa: string;
  title: string;
  center: [number, number] | null;
  /** False when the weekly copy has no dossier for the lot: the page says so and links the lot page. */
  listed: boolean;
  kind: string;
  confidence: string | null;
  reasons: string[];
  ownerType: string;
  cityOwned: string | null;
  flags: { title: string; text: string }[];
  held: string | null;
  deedFraud: string | null;
  listing: { title: string; lines: string[] } | null;
  routes: PacketRoute[];
  actions: PacketAction[];
  noActions: string | null;
  hearing: string | null;
  rules: string[];
  represent: string[];
  couldNotCheck: string;
  ownerLetter: OwnerLetterGate;
  /** The lot's displacement watch area (its census tract), when it carries a caution. */
  watchTract: string | null;
}

export interface PacketWatchArea {
  tract: string;
  signs: string;
  lots: { n: number; title: string }[];
}

export interface PacketWatch {
  cautions: string[];
  areas: PacketWatchArea[];
  links: ProtectionLink[];
}

export interface PacketContactGroup<T> {
  key: string;
  item: T;
  /** The lot numbers it applies to. */
  lots: number[];
}

export interface PacketContacts {
  status: 'ready' | 'missing';
  rcos: PacketContactGroup<{ rco: RcoContact; source: string }>[];
  seats: Record<SeatKind, PacketContactGroup<SeatRow>[]>;
  councilAtLarge: ContactsTable['councilAtLarge'];
  atLargeSource: string | null;
  /** Each lot's ward and division, in lot order. */
  wards: { n: number; title: string; ward: string | null }[];
  /** Lots whose districts are not in the weekly copy. */
  unknown: number[];
}

export interface Packet {
  title: string;
  date: string;
  count: number;
  /** Places on the list past MAX_PACKET, left out. */
  leftOut: number;
  /** The date of the weekly copy the packet is made from. */
  dataDate: string | null;
  lensLabel: string | null;
  contents: string[];
  watch: PacketWatch | null;
  contacts: PacketContacts;
  lots: PacketLot[];
  notLegalAdvice: string;
}

const p = () => strings.packet;

function routeOf(view: DossierView, registry: Registry, parcel: ShardParcel | null): PacketRoute[] {
  // The permission routes in the order to try them: the lot's own (its dossier), else the first
  // route of each suggestion. The side yard route already leads the listing box.
  const ids = parcel ? parcel.routes : view.actions.suggestions.flatMap((s) => s.routes.map((r) => r.route.id)).filter((id) => PERMISSION_ROUTES.has(id));
  const fromViews = new Map([...view.actions.suggestions.flatMap((s) => s.routes), ...view.actions.otherRoutes].map((r) => [r.route.id, r]));
  const out: PacketRoute[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id) || (view.actions.listing?.sideYard && id === view.actions.listing.sideYard.route.id)) continue;
    seen.add(id);
    const found = fromViews.get(id);
    const route = found?.route ?? registry.routes.find((r) => r.id === id);
    if (!route) continue;
    out.push({ label: route.label, first: route.steps[0] ?? null, warning: found?.warning ?? route.warning ?? null });
  }
  return out.slice(0, PACKET_LIMITS.routes);
}

function listingLines(view: DossierView, pointer: string | null): PacketLot['listing'] {
  const listing = view.actions.listing;
  if (!listing) return null;
  return {
    title: listing.title,
    lines: [
      listing.text,
      [listing.displacement.caution, listing.displacement.watch ? pointer : null].filter(Boolean).join(' '),
      listing.sideYard ? `${listing.sideYardLead} ${listing.sideYard.route.label}.` : null,
      `${listing.decline} ${listing.changes}`,
    ].filter((line): line is string => !!line),
  };
}

function rulesOf(view: DossierView): string[] {
  const r = view.rules;
  const lines: string[] = [];
  if (r.historic) lines.push(...r.historic.lines, r.historic.askFirst);
  if (r.zoning?.base) lines.push(r.zoning.base);
  if (r.zoning?.overlays.length) lines.push(`${r.zoning.overlaysIntro} ${r.zoning.overlays.map((o) => o.name).join('; ')}.`);
  if (r.brownfield) lines.push(r.brownfield.text);
  if (r.notOnList) lines.push(r.notOnList);
  return lines.slice(0, PACKET_LIMITS.rules);
}

function representLines(parcel: ShardParcel | null, table: ContactsTable | null): string[] {
  const represent = parcel?.represent ?? null;
  if (!represent || !table) return [p().representUnknown];
  const lines: string[] = [];
  const ward = wardText(represent);
  if (ward) lines.push(ward);
  for (const row of seatRows(represent, table)) {
    lines.push(row.seat ? `${row.office}, ${row.district}: ${row.seat.name}` : `${row.office}${row.district ? `, ${row.district}` : ''}: ${row.note}`);
  }
  const rcos = rcoRows(represent, table).rows.map((row) => row.rco.name);
  lines.push(rcos.length ? p().rcoLine(rcos.join('; ')) : strings.represent.noRco);
  return lines;
}

function couldNotCheck(view: DossierView, parcel: ShardParcel | null, dataDate: string | null): string {
  const parts: string[] = [];
  if (!parcel) parts.push(p().notChecked.noDossier);
  for (const part of parcel?.partial ?? []) parts.push(p().notChecked.partial[part] ?? part);
  for (const part of parcel?.missing ?? []) parts.push(p().notChecked.missing[part] ?? part);
  if (parcel && !parcel.represent) parts.push(p().notChecked.represent);
  void view;
  return p().notChecked.line(parts, dataDate);
}

/** One lot's page. `watchOnce` is true when the packet prints the displacement card at the front. */
export function packetLot(input: PacketLotInput, n: number, registry: Registry, table: ContactsTable | null, dataDate: string | null, watchOnce: boolean): PacketLot {
  const { view, parcel } = input;
  const pointer = watchOnce && view.actions.watch ? p().seeFront : null;
  const reasons = view.summary.reasons?.agree ?? [];
  const flags = view.owner.flags.slice(0, PACKET_LIMITS.flags).map((f) => ({
    title: f.title,
    // The possible estate flag is never shortened: its protective parts are the point of it.
    text: f.id === 'possible_estate' ? [f.text, f.careful, f.nextStep].filter(Boolean).join(' ') : f.text,
  }));
  if (view.owner.tax.flag) flags.push({ title: view.owner.tax.flag.title, text: view.owner.tax.flag.text });
  const actions = view.actions.suggestions.slice(0, PACKET_LIMITS.suggestions).map((item) => {
    const caution = displacementCaution(item.suggestion.id);
    return {
      label: item.suggestion.label,
      cost: item.suggestion.cost,
      evidence: strings.evidence[item.suggestion.evidence]?.label ?? '',
      caution: caution ? [caution, pointer].filter(Boolean).join(' ') : null,
      soil: view.actions.brownfield && isGarden(item.suggestion.id) ? strings.dossier.rules.brownfield : null,
      blessing: item.suggestion.id === 'community_garden' ? p().gardenAsk : null,
    };
  });
  const listed = parcel !== null;
  return {
    n,
    opa: input.opa,
    title: view.title,
    center: input.center,
    listed,
    kind: view.summary.kindLabel,
    confidence: view.summary.confidence,
    reasons: reasons.slice(0, PACKET_LIMITS.reasons),
    ownerType: view.owner.typeLabel,
    cityOwned: view.owner.cityOwned,
    flags,
    held: view.owner.held,
    deedFraud: view.owner.deedFraud?.text ?? null,
    listing: listingLines(view, pointer),
    routes: routeOf(view, registry, parcel),
    actions,
    noActions: actions.length === 0 ? strings.dossier.actions.none : null,
    hearing: view.rules.hearing?.text ?? null,
    rules: rulesOf(view),
    represent: representLines(parcel, table),
    couldNotCheck: couldNotCheck(view, parcel, dataDate),
    ownerLetter: ownerLetterGate(parcel),
    watchTract: parcel?.displacement?.tract ?? null,
  };
}

/** True when a lot's page carries a displacement caution inside a watch area (a greening or placemaking suggestion shown, or the box of a listed lot). */
function needsWatchCard(view: DossierView): boolean {
  if (!view.actions.watch) return false;
  if (view.actions.listing) return true;
  return view.actions.suggestions.slice(0, PACKET_LIMITS.suggestions).some((s) => displacementCaution(s.suggestion.id) !== null);
}

function group<T>(entries: { key: string; item: T; n: number }[]): PacketContactGroup<T>[] {
  const out = new Map<string, PacketContactGroup<T>>();
  for (const entry of entries) {
    const found = out.get(entry.key);
    if (found) {
      if (!found.lots.includes(entry.n)) found.lots.push(entry.n);
    } else out.set(entry.key, { key: entry.key, item: entry.item, lots: [entry.n] });
  }
  return [...out.values()];
}

/** The contacts page: each organization and seat once, with the lots it covers. */
export function packetContacts(lots: PacketLotInput[], contacts: ContactsState): PacketContacts {
  const table = contacts.status === 'ready' ? contacts.table : null;
  const seats = { council: [], house: [], senate: [], congress: [] } as Record<SeatKind, PacketContactGroup<SeatRow>[]>;
  const wards = lots.map((lot, i) => ({ n: i + 1, title: lot.view.title, ward: wardText(lot.parcel?.represent ?? null) }));
  if (!table) return { status: 'missing', rcos: [], seats, councilAtLarge: [], atLargeSource: null, wards, unknown: lots.map((_, i) => i + 1) };
  const rcoEntries: { key: string; item: { rco: RcoContact; source: string }; n: number }[] = [];
  const seatEntries: Record<SeatKind, { key: string; item: SeatRow; n: number }[]> = { council: [], house: [], senate: [], congress: [] };
  const unknown: number[] = [];
  lots.forEach((lot, i) => {
    const n = i + 1;
    const represent = lot.parcel?.represent ?? null;
    if (!represent) {
      unknown.push(n);
      return;
    }
    for (const row of seatRows(represent, table)) if (row.district) seatEntries[row.kind].push({ key: row.district, item: row, n });
    for (const row of rcoRows(represent, table).rows) rcoEntries.push({ key: row.rco.id, item: row, n });
  });
  for (const kind of Object.keys(seats) as SeatKind[]) {
    seats[kind] = group(seatEntries[kind]).sort((a, b) => Number(a.key.replace(/\D/g, '')) - Number(b.key.replace(/\D/g, '')));
  }
  const rcos = group(rcoEntries).sort((a, b) => a.item.rco.name.localeCompare(b.item.rco.name));
  return { status: 'ready', rcos, seats, councilAtLarge: table.councilAtLarge, atLargeSource: atLargeSource(table), wards, unknown };
}

export interface PacketInput {
  title: string;
  lots: PacketLotInput[];
  /** Places on the list past MAX_PACKET. */
  leftOut: number;
  registry: Registry;
  contacts: ContactsState;
  dataDate: string | null;
  lensLabel: string | null;
  now: Date;
}

/** The whole packet. */
export function buildPacket(input: PacketInput): Packet {
  const table = input.contacts.status === 'ready' ? input.contacts.table : null;
  const watched = input.lots.map((lot, i) => ({ lot, n: i + 1 })).filter(({ lot }) => needsWatchCard(lot.view));
  const watchOnce = watched.length > 0;
  const lots = input.lots.map((lot, i) => packetLot(lot, i + 1, input.registry, table, input.dataDate, watchOnce && needsWatchCard(lot.view)));
  let watch: PacketWatch | null = null;
  if (watchOnce) {
    const areas = new Map<string, PacketWatchArea>();
    const cautions: string[] = [];
    for (const { lot, n } of watched) {
      const signs = lot.view.actions.watch!.signs;
      const tract = lot.parcel?.displacement?.tract ?? `signs-${signs}`;
      const area = areas.get(tract) ?? { tract: lot.parcel?.displacement?.tract ?? '', signs: signsText(signs), lots: [] };
      area.lots.push({ n, title: lot.view.title });
      areas.set(tract, area);
      if (lot.view.actions.listing && !cautions.includes(strings.displacement.caution)) cautions.push(strings.displacement.caution);
      for (const s of lot.view.actions.suggestions.slice(0, PACKET_LIMITS.suggestions)) {
        const caution = displacementCaution(s.suggestion.id);
        if (caution && !cautions.includes(caution)) cautions.push(caution);
      }
    }
    watch = { cautions, areas: [...areas.values()], links: protectionLinks(input.registry) };
  }
  const contents = [
    ...(watch ? [strings.displacement.watchTitle] : []),
    p().contents.contacts,
    ...lots.map((lot) => `${lot.n}. ${lot.title}`),
  ];
  return {
    title: input.title,
    date: formatDate(input.now.toISOString()) ?? '',
    count: lots.length,
    leftOut: input.leftOut,
    dataDate: input.dataDate ? formatDate(input.dataDate) : null,
    lensLabel: input.lensLabel,
    contents,
    watch,
    contacts: packetContacts(input.lots, input.contacts),
    lots,
    notLegalAdvice: strings.app.notAffiliated,
  };
}
