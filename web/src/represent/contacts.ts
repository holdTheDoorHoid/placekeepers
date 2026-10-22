// Who represents a lot (M5.1, issue #45): reads tables/contacts.json (docs/CONTRACTS.md section 2)
// and a dossier's `represent` (section 6), and says in plain words who holds each seat, with
// their official office, the source and the day it was last checked.
//
// The table is written weekly by the pipeline (pipeline/src/placekeepers/publish/contacts.py);
// the reader is forgiving: anything it does not recognize is left out, never guessed.

import type { Link } from '../dossier/types.ts';
import { formatDate, strings } from '../strings.ts';

export const CONTACTS_PATH = 'tables/contacts.json';
export const CONTACTS_SCHEMA = 1;

export interface Office {
  address: string | null;
  phone: string | null;
}

export interface Seat {
  name: string;
  /** A leadership role the City lists, such as "Council President". */
  role: string | null;
  offices: Office[];
  website: string | null;
  /** The registry source id the seat comes from. */
  source: string;
  /** The day that source was last checked, YYYY-MM-DD. */
  checked: string | null;
}

export interface RcoContact {
  id: string;
  name: string;
  address: string | null;
  meeting: string | null;
  preferred: string | null;
  contact: { name: string | null; phone: string | null; email: string | null } | null;
  website: string | null;
  source: string;
  checked: string | null;
}

export type SeatKind = 'council' | 'house' | 'senate' | 'congress';
export const SEAT_KINDS: readonly SeatKind[] = ['council', 'house', 'senate', 'congress'];

export interface ContactsTable {
  generatedAt: string | null;
  seats: Record<SeatKind, Map<string, Seat>>;
  councilAtLarge: Seat[];
  rcos: Map<string, RcoContact>;
  /** Districts some lot lies in with no member listed, by kind. */
  vacant: Record<SeatKind, Set<string>>;
  /** Which kinds the table holds at all (a kind it lacks could not be checked this week). */
  has: Set<SeatKind | 'rcos'>;
}

/** A dossier's `represent`: the districts and organizations by number. */
export interface Represent {
  ward: string | null;
  /** Four digits, ward then division ("3412"). */
  division: string | null;
  council: string | null;
  house: string | null;
  senate: string | null;
  congress: string | null;
  rcos: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function text(v: unknown, max = 300): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}

function districtId(v: unknown): string | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return String(v);
  if (typeof v === 'string' && /^\d{1,4}$/.test(v.trim())) return String(Number(v.trim()));
  return null;
}

function safeUrl(v: unknown, allowHttp = false): string | null {
  const t = text(v, 500);
  return t && (allowHttp ? /^https?:\/\/[^\s"<>]+$/ : /^https:\/\/[^\s"<>]+$/).test(t) ? t : null;
}

function day(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function readSeat(v: unknown): Seat | null {
  if (!isObj(v)) return null;
  const name = text(v.name, 120);
  if (!name) return null;
  const offices: Office[] = [];
  for (const raw of Array.isArray(v.offices) ? v.offices.slice(0, 6) : []) {
    if (!isObj(raw)) continue;
    const office = { address: text(raw.address), phone: text(raw.phone, 60) };
    if (office.address || office.phone) offices.push(office);
  }
  return {
    name,
    role: text(v.role, 80),
    offices,
    website: safeUrl(v.website),
    source: text(v.source, 60) ?? '',
    checked: day(v.checked),
  };
}

function readRco(id: string, v: unknown): RcoContact | null {
  if (!isObj(v)) return null;
  const name = text(v.name, 200);
  if (!name) return null;
  const c = isObj(v.contact) ? v.contact : null;
  const email = c ? text(c.email, 200) : null;
  const contact = c ? { name: text(c.name, 120), phone: text(c.phone, 60), email: email && /^[^\s@]+@[^\s@]+$/.test(email) ? email : null } : null;
  return {
    id,
    name,
    address: text(v.address),
    meeting: text(v.meeting),
    preferred: text(v.preferred, 60),
    contact: contact && (contact.name || contact.phone || contact.email) ? contact : null,
    // As the City publishes it: some organizations' sites answer only on http.
    website: safeUrl(v.website, true),
    source: text(v.source, 60) ?? '',
    checked: day(v.checked),
  };
}

/** Reads tables/contacts.json; null when it cannot be used. */
export function parseContacts(json: unknown): ContactsTable | null {
  if (!isObj(json) || json.schema !== CONTACTS_SCHEMA) return null;
  const seats = { council: new Map(), house: new Map(), senate: new Map(), congress: new Map() } as Record<SeatKind, Map<string, Seat>>;
  const vacant = { council: new Set(), house: new Set(), senate: new Set(), congress: new Set() } as Record<SeatKind, Set<string>>;
  const has = new Set<SeatKind | 'rcos'>();
  for (const kind of SEAT_KINDS) {
    const raw = json[kind];
    if (!isObj(raw)) continue;
    has.add(kind);
    for (const [key, value] of Object.entries(raw)) {
      const id = districtId(key);
      const seat = readSeat(value);
      if (id && seat) seats[kind].set(id, seat);
    }
  }
  if (isObj(json.vacant)) {
    for (const kind of SEAT_KINDS) {
      const raw = json.vacant[kind];
      if (Array.isArray(raw)) for (const d of raw) if (districtId(d)) vacant[kind].add(districtId(d)!);
    }
  }
  const rcos = new Map<string, RcoContact>();
  if (isObj(json.rcos)) {
    has.add('rcos');
    for (const [key, value] of Object.entries(json.rcos)) {
      const id = districtId(key);
      const rco = id ? readRco(id, value) : null;
      if (rco) rcos.set(id!, rco);
    }
  }
  const councilAtLarge = (Array.isArray(json.council_at_large) ? json.council_at_large : []).map(readSeat).filter((s): s is Seat => !!s);
  const generatedAt = typeof json.generated_at === 'string' && !Number.isNaN(Date.parse(json.generated_at)) ? json.generated_at : null;
  return { generatedAt, seats, councilAtLarge, rcos, vacant, has };
}

/** Reads a dossier's `represent`; null when it has none. */
export function parseRepresent(v: unknown): Represent | null {
  if (!isObj(v)) return null;
  const division = typeof v.division === 'string' && /^\d{4}$/.test(v.division) ? v.division : null;
  const rcos = Array.isArray(v.rcos) ? [...new Set(v.rcos.map(districtId).filter((x): x is string => !!x))] : [];
  const out: Represent = {
    ward: districtId(v.ward),
    division,
    council: districtId(v.council),
    house: districtId(v.house),
    senate: districtId(v.senate),
    congress: districtId(v.congress),
    rcos,
  };
  return Object.values(out).some((x) => (Array.isArray(x) ? x.length > 0 : x !== null)) ? out : null;
}

// Loading -----------------------------------------------------------------------------------------

export type ContactsState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; table: ContactsTable } | { status: 'missing' } | { status: 'failed' };

const cache = new Map<string, Promise<ContactsState>>();

/**
 * Downloads tables/contacts.json once per page visit. "missing" when this build has none (the
 * manifest does not list it), "failed" when it could not be read.
 */
export function loadContacts(dataBase: string, files: Record<string, unknown> | null, fetchImpl: typeof fetch = fetch): Promise<ContactsState> {
  if (files && !(CONTACTS_PATH in files)) return Promise.resolve({ status: 'missing' });
  const key = `${dataBase}${CONTACTS_PATH}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async (): Promise<ContactsState> => {
      try {
        const response = await fetchImpl(key);
        if (response.status === 404) return { status: 'missing' };
        if (!response.ok) return { status: 'failed' };
        const table = parseContacts(await response.json());
        return table ? { status: 'ready', table } : { status: 'failed' };
      } catch {
        return { status: 'failed' };
      }
    })();
    cache.set(key, pending);
    pending.then((state) => {
      if (state.status === 'failed') cache.delete(key);
    });
  }
  return pending;
}

/** Forgets the downloaded table (for tests). */
export function clearContactsCache(): void {
  cache.clear();
}

// What the lot page shows -------------------------------------------------------------------------

const r = strings.represent;

/** "Ward 34, division 12". */
export function wardText(represent: Represent | null): string | null {
  if (!represent?.division) return represent?.ward ? r.wardOnly(represent.ward) : null;
  return r.ward(String(Number(represent.division.slice(0, 2))), String(Number(represent.division.slice(2))));
}

/** "City of Philadelphia, checked October 21, 2026". */
export function sourceLine(source: string, checked: string | null): string {
  const who = r.sourceNames[source] ?? source;
  return checked ? r.checked(who, formatDate(checked) ?? checked) : who;
}

export interface SeatRow {
  kind: SeatKind;
  /** "City Council", "Pennsylvania House", ... */
  office: string;
  /** "District 7", or null when the lot's district could not be worked out. */
  district: string | null;
  seat: Seat | null;
  /** Said instead of a person: no member listed, or the district or table could not be checked. */
  note: string | null;
  /** Where the seat comes from and when it was last checked. */
  source: string | null;
}

export interface RcoRow {
  rco: RcoContact;
  source: string;
}

export interface RepresentView {
  /** "ready" with rows; otherwise why there are none: still loading, not on our list, or not in this build. */
  status: 'ready' | 'loading' | 'unlisted' | 'missing';
  ward: string | null;
  rows: SeatRow[];
  rcos: RcoRow[];
  /** Organizations the lot lies in that the table does not list (a stale copy): their count. */
  rcosUnknown: number;
  /** Said when the lot lies in no community organization's area, or they could not be checked. */
  rcoNote: string | null;
  councilAtLarge: Seat[];
  links: Link[];
}

export function seatRows(represent: Represent | null, table: ContactsTable): SeatRow[] {
  return SEAT_KINDS.map((kind) => {
    const district = represent?.[kind] ?? null;
    const office = r.offices[kind] ?? kind;
    if (!district) return { kind, office, district: null, seat: null, note: r.notWorkedOut, source: null };
    if (!table.has.has(kind)) return { kind, office, district: r.district(district), seat: null, note: r.notInBuild, source: null };
    const seat = table.seats[kind].get(district) ?? null;
    if (!seat) return { kind, office, district: r.district(district), seat: null, note: r.vacant, source: null };
    return { kind, office, district: r.district(district), seat, note: null, source: sourceLine(seat.source, seat.checked) };
  });
}

export function rcoRows(represent: Represent | null, table: ContactsTable): { rows: RcoRow[]; unknown: number } {
  const ids = represent?.rcos ?? [];
  const rows = ids.map((id) => table.rcos.get(id)).filter((x): x is RcoContact => !!x);
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { rows: rows.map((rco) => ({ rco, source: sourceLine(rco.source, rco.checked) })), unknown: ids.length - rows.length };
}

/**
 * The lot page's "Who represents you": the ward and division, each seat with its member, office
 * and source, and the community organizations covering the lot. `listed` is false for a parcel
 * with no dossier, whose districts are worked out weekly only for the lots on our list.
 */
export function representView(represent: Represent | null, contacts: ContactsState, opts: { listed: boolean; atlas: Link }): RepresentView {
  const base = { ward: wardText(represent), rows: [] as SeatRow[], rcos: [] as RcoRow[], rcosUnknown: 0, rcoNote: null, councilAtLarge: [] as Seat[], links: [opts.atlas] };
  if (!opts.listed) return { ...base, status: 'unlisted' };
  if (contacts.status === 'idle' || contacts.status === 'loading') return { ...base, status: 'loading' };
  if (contacts.status !== 'ready' || !represent) return { ...base, status: 'missing' };
  const table = contacts.table;
  const rcos = rcoRows(represent, table);
  const rcoNote = !table.has.has('rcos') ? r.rcosNotInBuild : represent.rcos.length === 0 ? r.noRco : null;
  return {
    ...base,
    status: 'ready',
    rows: seatRows(represent, table),
    rcos: rcos.rows,
    rcosUnknown: rcos.unknown,
    rcoNote,
    councilAtLarge: table.councilAtLarge,
  };
}
