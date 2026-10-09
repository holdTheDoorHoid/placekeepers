// The story of a lot in one timeline (issue #38): deeds, violations, permits, demolitions, clean
// and seal work, unsafe and imminently dangerous notices, and the dated vacancy records we hold,
// newest first, grouped by year, with one or two plain sentences on top built only from records.
//
// The L&I records come either from the weekly copy's history shard (dossiers/history/<prefix>.json,
// docs/CONTRACTS.md section 6) or, with live City data on, from the City (./carto.ts, liSql). The
// pipeline groups the weekly copy's records exactly as `groupLi` does here
// (pipeline/src/placekeepers/derive/timeline.py), and both test suites check the same cases
// (pipeline/tests/fixtures/timeline_parity.json), so a lot page shows the same timeline either way.
//
// Everything here is a plain function of its inputs.

import { formatDate, formatMoney, sentenceCase, strings } from '../strings.ts';
import { plain } from './plain.ts';
import { FULL_RECORDS_FROM, isSheriff } from './transfers.ts';
import type { LandCare, LiEvent, LiKind, Transfer } from './types.ts';
import { LI_KINDS } from './types.ts';

// The records -------------------------------------------------------------------------------------

/** One L&I record of the timeline, as the history shard and a live lookup give it after grouping. */
export interface LiRecord {
  date: string | null;
  title: string | null;
  status: string | null;
  detail: string | null;
  /** How many records read the same (L&I often writes one violation twice on a day). */
  count: number;
}

/** A parcel's L&I records by kind, in LI_KINDS order; kinds with no records are left out. */
export type LiGroups = Partial<Record<LiKind, LiRecord[]>>;

/** The vacancy lists a parcel can be dated on (pipeline/src/placekeepers/derive/timeline.py, LISTS). */
export const LIST_IDS = ['city_land', 'city_building', 'june_2024_land', 'june_2024_building'] as const;
export type ListId = (typeof LIST_IDS)[number];

export interface ListRecord {
  date: string;
  list: ListId;
}

/** The registry source each vacancy list comes from. */
export const LIST_SOURCES: Record<ListId, string> = {
  city_land: 'vacant_indicators_land',
  city_building: 'vacant_indicators_bldg',
  june_2024_land: 'cagp_vacant_land_2024',
  june_2024_building: 'cagp_vacant_buildings_2024',
};

/** Text as the pipeline keeps it: white space runs as one space, trimmed; null when empty. */
function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const t = value.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

/** Code point order, as the pipeline sorts (never the browser's locale). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The L&I records of one parcel grouped as the pipeline groups them: records that read the same
 * (kind, day, title, status and detail) are one with a count, a record with neither a date nor a
 * title is left out, and each kind is newest first (undated last), then by title, status and
 * detail.
 */
export function groupLi(events: Pick<LiEvent, 'kind' | 'date' | 'title' | 'status' | 'detail'>[]): LiGroups {
  const counts = new Map<string, { kind: LiKind; record: LiRecord }>();
  for (const event of events) {
    if (!(LI_KINDS as readonly string[]).includes(event.kind)) continue;
    const record: LiRecord = { date: event.date ?? null, title: clean(event.title), status: clean(event.status), detail: clean(event.detail), count: 1 };
    if (record.date === null && record.title === null) continue;
    const key = JSON.stringify([event.kind, record.date, record.title, record.status, record.detail]);
    const found = counts.get(key);
    if (found) found.record.count += 1;
    else counts.set(key, { kind: event.kind, record });
  }
  const out: LiGroups = {};
  for (const kind of LI_KINDS) {
    const records = [...counts.values()].filter((x) => x.kind === kind).map((x) => x.record);
    if (!records.length) continue;
    records.sort(
      (a, b) =>
        cmp(b.date ?? '', a.date ?? '') ||
        cmp(a.title ?? '', b.title ?? '') ||
        cmp(a.status ?? '', b.status ?? '') ||
        cmp(a.detail ?? '', b.detail ?? ''),
    );
    out[kind] = records;
  }
  return out;
}

/** A grouped record as the history shard writes it: [day, title, status, detail, count], the count only above 1, trailing empty values left off. */
export function encodeRecord(record: LiRecord): (string | number | null)[] {
  const row: (string | number | null)[] = [record.date, record.title, record.status, record.detail, record.count > 1 ? record.count : null];
  while (row.length && row[row.length - 1] === null) row.pop();
  return row;
}

export function encodeGroups(groups: LiGroups): Record<string, (string | number | null)[][]> {
  return Object.fromEntries(Object.entries(groups).map(([kind, records]) => [kind, records!.map(encodeRecord)]));
}

/** The oldest day among the records, for joining a live answer cut short to the weekly copy. */
export function oldestDay(groups: LiGroups): string | null {
  let oldest: string | null = null;
  for (const records of Object.values(groups)) {
    for (const r of records ?? []) if (r.date && (oldest === null || r.date < oldest)) oldest = r.date;
  }
  return oldest;
}

/**
 * A live answer the City cut short (it returns the newest records only, across every kind),
 * completed with the weekly copy: the live records after the oldest live day, and the copy's
 * records from that day back (the City may have cut that day's records part way), and its
 * undated ones (the City lists those last).
 */
export function withOlder(live: LiGroups, copy: LiGroups | null): LiGroups {
  const cut = oldestDay(live);
  if (!copy || cut === null) return live;
  const merged: LiGroups = {};
  for (const kind of LI_KINDS) {
    const records = [...(live[kind] ?? []).filter((r) => r.date !== null && r.date > cut), ...(copy[kind] ?? []).filter((r) => r.date === null || r.date <= cut)];
    if (records.length) merged[kind] = records;
  }
  return merged;
}

// The view ----------------------------------------------------------------------------------------

/** The kinds a reader can switch on and off: the two L&I notices go together, as do the vacancy records. */
export const TIMELINE_KINDS = ['deed', 'violation', 'permit', 'demolition', 'clean_seal', 'notice', 'vacancy'] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export function isTimelineKind(value: unknown): value is TimelineKind {
  return typeof value === 'string' && (TIMELINE_KINDS as readonly string[]).includes(value);
}

const KIND_OF: Record<LiKind, TimelineKind> = {
  violation: 'violation',
  permit: 'permit',
  demolition: 'demolition',
  unsafe: 'notice',
  imminently_dangerous: 'notice',
  clean_seal: 'clean_seal',
};

/** One line of an event: what happened, its status, and whether it is still open. */
export interface TimelineItem {
  text: string;
  status: string | null;
  open: boolean;
  /** A deed from before 2000, from records the City says may be incomplete. */
  early: boolean;
}

/** One row of the timeline: a day (or a year), one kind of record, and what happened that day. */
export interface TimelineRow {
  kind: TimelineKind;
  /** The day as YYYY-MM-DD, or null for a record dated by its year only (or not at all). */
  day: string | null;
  /** The day as shown, such as "Jun 14", or "" for a year only record. */
  dateLabel: string;
  label: string;
  items: TimelineItem[];
  /** The City dated it in the future: most likely an error in its record. */
  future: boolean;
}

export interface TimelineYear {
  /** "2025", or the words for records with no date. */
  year: string;
  rows: TimelineRow[];
}

export interface StorySentence {
  text: string;
  /** Where the sentence comes from, in plain words. */
  source: string;
}

export interface TimelineInput {
  transfers: Transfer[] | null;
  li: LiGroups | null;
  lists: ListRecord[];
  landcare: LandCare | null;
  /** Today in Philadelphia, YYYY-MM-DD. */
  today: string;
}

export interface Timeline {
  story: StorySentence[];
  /** Every row, newest first, before the reader's choices hide any kinds. */
  rows: TimelineRow[];
  /** The kinds that have records, with how many rows each has, in TIMELINE_KINDS order. */
  kinds: { id: TimelineKind; label: string; count: number }[];
}

const t = () => strings.dossier.history.timeline;

function day(value: string | null): string {
  return value ? (formatDate(value, 'short')?.replace(/, \d{4}$/, '') ?? value) : '';
}

function namesText(names: string[], more: number): string {
  const shown = names.slice(0, 2).map((n) => plain(n));
  const rest = names.length - shown.length + more;
  return rest > 0 ? `${shown.join('; ')} ${strings.dossier.history.more(rest)}` : shown.join('; ');
}

/** A document type in plain words (the deed table's own labels). */
export function documentWords(type: string): string {
  const upper = type.toUpperCase().replace(/\s+/g, ' ').trim();
  return strings.dossier.history.documents[upper] ?? sentenceCase(upper.replace(/\s+-\s+/g, ', '));
}

function deedItem(d: Transfer): TimelineItem {
  const h = strings.dossier.history;
  const parts = [documentWords(d.type)];
  parts.push(d.price === null ? t().noPrice : d.properties > 1 ? `${formatMoney(d.price)}, ${h.share(d.properties)}` : formatMoney(d.price));
  if (d.to.length) parts.push(t().to(namesText(d.to, d.toMore)));
  return { text: parts.join(', '), status: null, open: false, early: d.date !== null && d.date < FULL_RECORDS_FROM };
}

/** Abbreviations L&I writes in its titles, kept in capitals ("ID STRUCTURE" is imminently dangerous). */
const ABBREVIATIONS = new Set(['ID', 'L&I', 'HVAC', 'CLIP', 'CO', 'LO']);

/** An L&I title in sentence case, abbreviations kept, dashes as commas. */
export function cityWords(text: string): string {
  return plain(
    sentenceCase(text)
      .split(' ')
      .map((word) => (ABBREVIATIONS.has(word.toUpperCase()) ? word.toUpperCase() : word))
      .join(' '),
  );
}

/** Words for the codes L&I's older permit system wrote as the kind of work; others show the permit type alone. */
const PERMIT_CODES: Record<string, string> = {
  NEWCON: 'new construction',
  ADD: 'addition',
  MAJOR: 'major alterations',
  MINOR: 'minor alterations',
  FULL: 'complete demolition',
  FULLC: 'complete demolition',
  COMDEM: 'complete demolition',
  INTERI: 'interior demolition',
  LOTLIN: 'lot line change',
  SIGNAC: 'sign',
  FOUND: 'foundation',
  CO: 'certificate of occupancy',
  TCO: 'temporary certificate of occupancy',
  AMEND: 'amendment',
};

/** The kind of work a permit is for, in plain words, or null when the record does not say plainly. */
export function permitWork(title: string | null): string | null {
  if (!title) return null;
  const code = title.toUpperCase().trim();
  if (PERMIT_CODES[code]) return PERMIT_CODES[code]!;
  // The newer system writes words ("New Construction", "Addition and/or Alteration").
  if (/[a-z]/.test(title) || / /.test(title.trim())) {
    const words = cityWords(title);
    return words.charAt(0).toLowerCase() + words.slice(1);
  }
  return null;
}

/** A permit in plain words: its type, then the kind of work, such as "Residential building permit for new construction". */
export function permitText(r: LiRecord): string {
  const type = r.detail ? cityWords(r.detail) : t().permit;
  const work = permitWork(r.title);
  return work && !type.toLowerCase().includes(work) ? t().permitFor(type, work) : type;
}

/** Whether a permit is for new construction (the newer system's words, or the older system's codes). */
export function isNewConstruction(r: LiRecord): boolean {
  const text = `${r.title ?? ''} ${r.detail ?? ''}`.toUpperCase();
  return /NEW CONSTRUCTION|NEWCON/.test(text) && !/CANCEL|ABANDON|DENIED|WITHDRAW|REVOKED/i.test(r.status ?? '');
}

const DEMOLITION_WORK: Record<string, 'city' | 'complete' | 'small' | 'large' | 'tank'> = {
  CASE: 'city',
  'CITY DEMOLITION': 'city',
  FULL: 'complete',
  FULLC: 'complete',
  COMDEM: 'complete',
  'MINOR DEMOLITION': 'small',
  'MAJOR DEMOLITION': 'large',
  TANKRI: 'tank',
};

function demolitionWork(r: LiRecord): 'city' | 'complete' | 'small' | 'large' | 'tank' | null {
  return DEMOLITION_WORK[(r.title ?? '').toUpperCase()] ?? null;
}

/** By the City: its record says so (`city_demo` YES). */
function byCity(r: LiRecord): boolean {
  return (r.detail ?? '').toUpperCase() === 'YES';
}

function demolitionText(r: LiRecord): string {
  const work = demolitionWork(r);
  const what = work ? t().demolitionWork[work]! : r.title ? cityWords(r.title) : t().demolition;
  return `${what}, ${byCity(r) ? t().byCity : t().privatePermit}`;
}

/** A completed demolition of a building (not a tank), with the day it was done. */
function isBuildingDemolished(r: LiRecord, today: string): boolean {
  return (r.status ?? '').toUpperCase() === 'COMPLETED' && demolitionWork(r) !== 'tank' && r.date !== null && r.date <= today;
}

/** Clean and seal work orders the City completed (the pipeline's rule for the dossier's `sealed`). */
const SEALED = new Set(['APPROVED', 'CLOSED', 'CONDITIONAL APPROVAL']);

function cleanSealText(r: LiRecord): string {
  return /CLIP/i.test(r.title ?? '') ? t().cleanSealClip : t().cleanSeal;
}

function liItem(kind: LiKind, r: LiRecord): TimelineItem {
  const status = r.status ? cityWords(r.status) : null;
  const open = (kind === 'violation' || kind === 'unsafe' || kind === 'imminently_dangerous') && (r.status ?? '').toUpperCase() === 'OPEN';
  let text: string;
  switch (kind) {
    case 'permit':
      text = permitText(r);
      break;
    case 'demolition':
      text = demolitionText(r);
      break;
    case 'clean_seal':
      text = cleanSealText(r);
      break;
    case 'unsafe':
      text = r.title ? cityWords(r.title) : t().kinds.unsafe!;
      break;
    case 'imminently_dangerous':
      text = r.title ? cityWords(r.title) : t().kinds.imminently_dangerous!;
      break;
    default:
      text = r.title ? cityWords(r.title) : t().violation;
  }
  if (r.count > 1) text = `${text} ${t().times(r.count)}`;
  return { text, status: open ? null : status, open, early: false };
}

function liLabel(kind: LiKind): string {
  return t().kinds[kind] ?? sentenceCase(kind);
}

/** Builds the timeline from whatever records are known; a part that is null is simply not in it. */
export function buildTimeline(input: TimelineInput): Timeline {
  const rows: TimelineRow[] = [];
  const add = (kind: TimelineKind, label: string, date: string | null, item: TimelineItem, merge = false) => {
    const last = merge ? rows.find((r) => r.kind === kind && r.day === date && r.label === label) : undefined;
    if (last) last.items.push(item);
    else rows.push({ kind, day: date, dateLabel: day(date), label, items: [item], future: date !== null && date > input.today });
  };
  for (const deed of input.transfers ?? []) add('deed', t().kinds.deed!, deed.date, deedItem(deed));
  for (const kind of LI_KINDS) {
    for (const r of input.li?.[kind] ?? []) add(KIND_OF[kind], liLabel(kind), r.date, liItem(kind, r), kind === 'violation');
  }
  for (const record of input.lists) add('vacancy', t().kinds.vacancy!, record.date, { text: t().lists[record.list]!, status: null, open: false, early: false });
  const yearOnly: TimelineRow[] = [];
  if (input.landcare?.year) {
    yearOnly.push({
      kind: 'vacancy',
      day: `${input.landcare.year}`,
      dateLabel: '',
      label: t().kinds.vacancy!,
      items: [{ text: t().landcare(input.landcare.program), status: null, open: false, early: false }],
      future: false,
    });
  }
  // Newest first; a year only record sorts as the end of its year; undated records last.
  const key = (r: TimelineRow) => (r.day === null ? '' : r.day.length === 4 ? `${r.day}-99-99` : r.day);
  const all = [...rows, ...yearOnly].sort((a, b) => cmp(key(b), key(a)) || TIMELINE_KINDS.indexOf(a.kind) - TIMELINE_KINDS.indexOf(b.kind));
  const counts = new Map<TimelineKind, number>();
  for (const row of all) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
  return {
    story: storyOf(input),
    rows: all,
    kinds: TIMELINE_KINDS.filter((k) => counts.has(k)).map((id) => ({ id, label: t().toggles[id]!, count: counts.get(id)! })),
  };
}

/** The rows grouped by year, newest first, records without a date last. */
export function byYear(rows: TimelineRow[]): TimelineYear[] {
  const years: TimelineYear[] = [];
  for (const row of rows) {
    const year = row.day ? row.day.slice(0, 4).replace(/^0+(?=\d)/, '') : t().noDate;
    const last = years[years.length - 1];
    if (last && last.year === year) last.rows.push(row);
    else years.push({ year, rows: [row] });
  }
  return years;
}

// The story ---------------------------------------------------------------------------------------

const yearOf = (d: string) => d.slice(0, 4);

/**
 * One or two plain sentences about the lot, built only from its records, each with where it
 * comes from. Never a guess: a demolition says a building stood here only because L&I recorded
 * that building's demolition as completed.
 */
export function storyOf(input: TimelineInput): StorySentence[] {
  const s = t().story;
  const out: StorySentence[] = [];
  const li = input.li ?? {};
  const past = (r: { date: string | null }) => r.date !== null && r.date <= input.today;

  // A building demolished: the newest completed demolition, and new construction since.
  const demolished = (li.demolition ?? []).filter((r) => isBuildingDemolished(r, input.today));
  const lastDemolition = demolished[0] ?? null;
  if (lastDemolition) {
    out.push({ text: byCity(lastDemolition) ? s.cityDemolished(yearOf(lastDemolition.date!)) : s.privateDemolished(yearOf(lastDemolition.date!)), source: s.sources.demolitions });
    const built = (li.permit ?? []).filter((r) => past(r) && r.date! > lastDemolition.date! && isNewConstruction(r));
    const firstBuilt = built[built.length - 1];
    if (firstBuilt) out.push({ text: s.newConstruction(yearOf(firstBuilt.date!)), source: s.sources.permits });
  }
  // A notice still open.
  const dangerous = (li.imminently_dangerous ?? []).filter((r) => past(r) && (r.status ?? '').toUpperCase() === 'OPEN');
  const unsafe = (li.unsafe ?? []).filter((r) => past(r) && (r.status ?? '').toUpperCase() === 'OPEN');
  if (out.length < 2 && dangerous.length) out.push({ text: s.dangerous(formatDate(dangerous[dangerous.length - 1]!.date!)!), source: s.sources.notices });
  else if (out.length < 2 && unsafe.length) out.push({ text: s.unsafe(formatDate(unsafe[unsafe.length - 1]!.date!)!), source: s.sources.notices });
  // Cleaned and sealed, when no demolition followed.
  const sealed = (li.clean_seal ?? []).filter((r) => past(r) && SEALED.has((r.status ?? '').toUpperCase()));
  if (out.length < 2 && sealed.length && !(lastDemolition && lastDemolition.date! >= sealed[0]!.date!)) {
    out.push({ text: s.sealed(yearOf(sealed[0]!.date!), sealed.length), source: s.sources.cleanSeal });
  }
  // A sheriff sale.
  const sheriff = (input.transfers ?? []).filter((d) => d.date !== null && d.date <= input.today && isSheriff(d));
  if (out.length < 2 && sheriff.length) out.push({ text: s.sheriff(yearOf(sheriff[0]!.date!)), source: s.sources.deeds });
  // The vacancy lists: today's City list first, then June 2024.
  const onList = (id: ListId) => input.lists.find((r) => r.list === id) ?? null;
  const cityList = onList('city_land') ?? onList('city_building');
  const june = onList('june_2024_land') ?? onList('june_2024_building');
  if (out.length < 2 && cityList) {
    out.push({ text: s.cityList(cityList.list === 'city_land', formatDate(cityList.date)!, june !== null), source: s.sources.lists(june !== null) });
  } else if (out.length < 2 && june) {
    out.push({ text: s.juneList(june.list === 'june_2024_land'), source: s.sources.june(june.list === 'june_2024_land') });
  }
  // Cared for by PHS LandCare.
  if (out.length < 2 && input.landcare?.year) out.push({ text: s.landcare(input.landcare.year, input.landcare.program), source: s.sources.landcare });
  return out.slice(0, 2);
}
