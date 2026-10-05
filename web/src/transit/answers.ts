// What OpenStreetMap says at SEPTA's stops, joined in the visitor's browser (decision D1 of
// docs/VERIFICATION_V0_2.md). SEPTA's stops are published with only the id of the OpenStreetMap
// stop at the same pole (`o` in tiles/transit.pmtiles, `osm` in the route survey sheets); what
// OpenStreetMap says there is published apart, in tables/stop_amenities.json under the Open
// Database License (docs/CONTRACTS.md section 8). Storing the two in one published record would
// make a derivative database the Open Database License asks to be shared under it, which SEPTA's
// license does not let us grant, so the join happens here and nowhere else.
//
// joinStop follows the pipeline's reference join (placekeepers.derive.transit_comfort.
// join_published), and tests/stop_join_parity.test.ts checks the two agree on
// pipeline/tests/fixtures/stop_join_parity.json. A shelter or bench no one has answered for yet
// counts halfway (NOT_SURVEYED), never as missing.

import type { ExpressionSpecification } from 'maplibre-gl';

/** The table's place under the data root. */
export const STOP_TABLE = 'tables/stop_amenities.json';
/** A shelter or bench no one has surveyed yet: halfway between having one (0) and not (100). */
export const NOT_SURVEYED = 50;
/** The property of a published stop the transit comfort lens scores (not stations, nor the trolley tunnel stations). */
export const IN_LENS = 'tc';
/** `om`: the stop numbers agree, or the two only stand at the same place. */
export const BY_NUMBER = 1;
export const BY_PLACE = 2;

/** Stop suggestions in the order a stop lists them (pipeline: transit_comfort.SUGGESTIONS). */
const STOP_SUGGESTIONS = ['stop_survey', 'stop_shelter_request', 'stop_bench_request', 'stop_streetlight_report', 'stop_shade_trees'] as const;

/** One OpenStreetMap stop of the table: what the map shows (`c`), its answers, the stop numbers it names. */
export interface OsmStopEntry {
  c: number;
  sh?: number;
  bn?: number;
  bi?: number;
  lt?: number;
  cv?: number;
  /** SEPTA stop numbers named in its `ref` or `gtfs:stop_id` */
  n?: string[];
}

export interface StopTable {
  /** The date of OpenStreetMap's data. */
  asOf: string | null;
  credit: string | null;
  license: string | null;
  stops: Map<string, OsmStopEntry>;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const yesNo = (value: unknown): number | undefined => (value === 0 || value === 1 ? value : undefined);

/** The table, or null when the file is not one. Entries that cannot be read are skipped. */
export function parseStopTable(json: unknown): StopTable | null {
  if (!isObject(json) || !isObject(json.stops)) return null;
  const stops = new Map<string, OsmStopEntry>();
  for (const [id, raw] of Object.entries(json.stops)) {
    if (!/^[nw]\d+$/.test(id) || !isObject(raw)) continue;
    const c = raw.c;
    if (c !== 0 && c !== 1 && c !== 2 && c !== 3) continue;
    const entry: OsmStopEntry = { c };
    for (const key of ['sh', 'bn', 'bi', 'lt', 'cv'] as const) {
      const value = yesNo(raw[key]);
      if (value !== undefined) entry[key] = value;
    }
    if (Array.isArray(raw.n)) {
      const numbers = raw.n.filter((n): n is string => typeof n === 'string' && n !== '');
      if (numbers.length) entry.n = numbers;
    }
    stops.set(id, entry);
  }
  const asOf = isObject(json.as_of) ? text(json.as_of.osm) : null;
  return { asOf, credit: text(json.credit), license: text(json.license), stops };
}

/** 100 when a survey found it missing, 0 when it is there (or the whole stop is under a roof), halfway when unknown. */
export function yesNoNeed(answer: number | undefined | null, covered?: number | null): number {
  if (covered === 1 || answer === 1) return 0;
  if (answer === 0) return 100;
  return NOT_SURVEYED;
}

function int(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

/** The OpenStreetMap stop linked to a published SEPTA stop, if the table has it. */
export function linkedEntry(properties: Record<string, unknown>, table: StopTable | null): OsmStopEntry | null {
  const id = text(properties.o);
  return id && table ? (table.stops.get(id) ?? null) : null;
}

/**
 * A published SEPTA stop with what OpenStreetMap says there joined in: what riders find (`a`, `sh`,
 * `bn`, `li`, `cv`), whether the stop numbers agree (`om`), the halfway answers (`f_noshelter`,
 * `f_nobench`) and the suggestions they decide, in the order a stop lists them (`sg`). A stop the
 * lens does not score (a station, a trolley tunnel station) comes back as it is. With no table (not
 * loaded, or not published), every stop is treated as not yet surveyed.
 */
export function joinStop(properties: Record<string, unknown>, table: StopTable | null): Record<string, unknown> {
  if (int(properties[IN_LENS]) !== 1) return properties;
  const joined: Record<string, unknown> = { ...properties };
  const entry = linkedEntry(properties, table);
  if (entry) {
    joined.a = entry.c;
    const own = new Set([String(properties.sid ?? ''), ...String(properties.fid ?? '').split(',')].filter(Boolean));
    joined.om = (entry.n ?? []).some((n) => own.has(n)) ? BY_NUMBER : BY_PLACE;
    if (entry.sh !== undefined) joined.sh = entry.sh;
    if (entry.bn !== undefined) joined.bn = entry.bn;
    if (entry.lt !== undefined) joined.li = entry.lt;
    if (entry.cv !== undefined) joined.cv = entry.cv;
  }
  const shelter = int(joined.sh);
  const bench = int(joined.bn);
  const lit = int(joined.li);
  const covered = int(joined.cv);
  joined.f_noshelter = yesNoNeed(shelter, covered);
  joined.f_nobench = yesNoNeed(bench);

  const found = new Set<string>(String(properties.sg ?? '').split(',').filter(Boolean));
  const shelterKnown = shelter !== undefined || covered === 1;
  if (!shelterKnown || bench === undefined) found.add('stop_survey');
  if (shelter === 0 && covered !== 1) found.add('stop_shelter_request');
  if (bench === 0) found.add('stop_bench_request');
  if (lit === 0) found.add('stop_streetlight_report');
  const known = new Set<string>(STOP_SUGGESTIONS);
  const ordered = [...STOP_SUGGESTIONS.filter((s) => found.has(s)), ...[...found].filter((s) => !known.has(s)).sort()];
  delete joined.sg;
  if (ordered.length) joined.sg = ordered.join(',');
  return joined;
}

/**
 * For the map style: the OpenStreetMap ids grouped by the value they give each answer the lens
 * reads. Stops not listed (no OpenStreetMap stop, or no answer) count halfway.
 */
export interface StopAnswerIndex {
  f_noshelter: { need: string[]; met: string[] };
  f_nobench: { need: string[]; met: string[] };
}

export function stopAnswerIndex(table: StopTable | null): StopAnswerIndex {
  const index: StopAnswerIndex = { f_noshelter: { need: [], met: [] }, f_nobench: { need: [], met: [] } };
  for (const [id, entry] of table?.stops ?? []) {
    const shelter = yesNoNeed(entry.sh, entry.cv);
    const bench = yesNoNeed(entry.bn);
    if (shelter === 100) index.f_noshelter.need.push(id);
    else if (shelter === 0) index.f_noshelter.met.push(id);
    if (bench === 100) index.f_nobench.need.push(id);
    else if (bench === 0) index.f_nobench.met.push(id);
  }
  return index;
}

/**
 * The value of one OpenStreetMap answer factor for a stop on the map: 100 or 0 by the stop's
 * linked OpenStreetMap id (`o`), else halfway.
 */
export function answerExpression(groups: { need: string[]; met: string[] } | undefined): ExpressionSpecification | number {
  const branches: (string[] | number)[] = [];
  if (groups?.need.length) branches.push([...groups.need], 100);
  if (groups?.met.length) branches.push([...groups.met], 0);
  if (branches.length === 0) return NOT_SURVEYED;
  return ['match', ['to-string', ['get', 'o']], ...branches, NOT_SURVEYED] as unknown as ExpressionSpecification;
}

const tables = new Map<string, Promise<StopTable | null>>();

/**
 * Downloads and reads the table once per page visit; null when it is not published or cannot be
 * read (a failed download is tried again next time).
 */
export function loadStopTable(dataBase: string, fetchImpl: typeof fetch = fetch): Promise<StopTable | null> {
  const key = `${dataBase}${STOP_TABLE}`;
  let pending = tables.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetchImpl(key);
        return response.ok ? parseStopTable(await response.json()) : null;
      } catch {
        return null;
      }
    })();
    tables.set(key, pending);
    pending.then((table) => {
      if (!table) tables.delete(key);
    });
  }
  return pending;
}
