// The route survey sheets (M2.4): reads tables/routes/index.json and tables/routes/<route>.json
// (docs/CONTRACTS.md section 7), joins what OpenStreetMap says at each stop from
// tables/stop_amenities.json (section 8) by the stop's OpenStreetMap id, splits a direction's stops
// among volunteers, estimates how long a walk takes, and keeps the boxes someone ticks on this
// device. The route files hold SEPTA's stops and only the link to OpenStreetMap's: the two are
// joined here, in the browser, never stored together (decision D1 of docs/VERIFICATION_V0_2.md).
// Kept apart from the components so it can be tested without a browser.

import { strings } from '../strings.ts';
import type { StopTable } from '../transit/answers.ts';

export const MODE_BUS = 1;
export const MODE_TROLLEY = 2;

/** What OpenStreetMap shows at a stop, `c` in the files, as on the shelters and benches layer. */
export type StopStatus = 'shelter' | 'bench' | 'neither' | 'unsurveyed' | 'missing';
const STATUS_BY_CODE: Record<number, StopStatus> = { 3: 'shelter', 2: 'bench', 1: 'neither', 0: 'unsurveyed' };

export interface IndexDirection {
  d: number;
  dir?: string;
  to?: string;
  /** stops on the sheet */
  n: number;
}

export interface IndexRoute {
  id: string;
  r: string;
  nm: string;
  md: number;
  file: string;
  dirs: IndexDirection[];
}

export interface AsOf {
  schedules: string | null;
  osm: string | null;
}

export interface RouteIndex {
  generated_at: string | null;
  as_of: AsOf;
  routes: IndexRoute[];
}

export interface SheetStop {
  /** the Placekeepers stop key, such as sp722 */
  k: string;
  /** SEPTA's stop number */
  sid: string;
  nm: string;
  lat: number;
  lng: number;
  /** what OpenStreetMap shows, joined from the stop table (joinSheet); absent when no OpenStreetMap stop matches */
  c?: number;
  /** the matching OpenStreetMap element, such as n8878395954: the link the route file carries */
  osm?: string;
  sh?: number;
  bn?: number;
  bi?: number;
  lt?: number;
}

export interface SheetDirection {
  d: number;
  dir?: string;
  to?: string;
  /** meters from the first stop to the last, in straight lines from stop to stop */
  m: number;
  /** stops of this direction outside Philadelphia, left off the sheet */
  out: number;
  stops: SheetStop[];
}

export interface RouteSheet {
  generated_at: string | null;
  as_of: AsOf;
  id: string;
  r: string;
  nm: string;
  md: number;
  directions: SheetDirection[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

function asOf(value: unknown): AsOf {
  const block = isObject(value) ? value : {};
  return { schedules: text(block.schedules) ?? null, osm: text(block.osm) ?? null };
}

/** The index, or null when the file is not one. Routes missing an id or a file are skipped. */
export function parseIndex(json: unknown): RouteIndex | null {
  if (!isObject(json) || !Array.isArray(json.routes)) return null;
  const routes: IndexRoute[] = [];
  for (const raw of json.routes) {
    if (!isObject(raw)) continue;
    const id = text(raw.id);
    const file = text(raw.file);
    if (!id || !file || !file.startsWith('tables/routes/')) continue;
    const dirs = (Array.isArray(raw.dirs) ? raw.dirs : []).filter(isObject).flatMap((d): IndexDirection[] => {
      const n = num(d.n);
      const which = num(d.d);
      return which === undefined || n === undefined ? [] : [{ d: which, dir: text(d.dir), to: text(d.to), n }];
    });
    routes.push({ id, r: text(raw.r) ?? id, nm: text(raw.nm) ?? '', md: num(raw.md) ?? MODE_BUS, file, dirs });
  }
  return { generated_at: text(json.generated_at) ?? null, as_of: asOf(json.as_of), routes };
}

function parseStop(raw: unknown): SheetStop | null {
  if (!isObject(raw)) return null;
  const k = text(raw.k);
  const sid = text(raw.sid);
  const lat = num(raw.lat);
  const lng = num(raw.lng);
  if (!k || !sid || lat === undefined || lng === undefined) return null;
  const stop: SheetStop = { k, sid, nm: text(raw.nm) ?? sid, lat, lng };
  const osm = text(raw.osm);
  if (osm && /^[nw]\d+$/.test(osm)) stop.osm = osm;
  return stop;
}

/**
 * The sheet with what OpenStreetMap says at each stop joined in from the stop table, by the
 * stop's OpenStreetMap id. A stop the table does not list is not found in OpenStreetMap. Without
 * the table (it could not be loaded), a linked stop shows as not yet surveyed, and the page says so.
 */
export function joinSheet(sheet: RouteSheet, table: StopTable | null): RouteSheet {
  const join = (stop: SheetStop): SheetStop => {
    if (!stop.osm) return stop;
    if (!table) return { ...stop, c: 0 };
    const entry = table.stops.get(stop.osm);
    if (!entry) return stop;
    const joined: SheetStop = { ...stop, c: entry.c };
    for (const key of ['sh', 'bn', 'bi', 'lt'] as const) if (entry[key] !== undefined) joined[key] = entry[key];
    return joined;
  };
  return { ...sheet, directions: sheet.directions.map((d) => ({ ...d, stops: d.stops.map(join) })) };
}

/** A route's file, or null when it is not one. Unreadable stops are skipped. */
export function parseSheet(json: unknown): RouteSheet | null {
  if (!isObject(json) || !Array.isArray(json.directions)) return null;
  const id = text(json.id);
  if (!id) return null;
  const directions = json.directions.filter(isObject).flatMap((raw): SheetDirection[] => {
    const d = num(raw.d);
    if (d === undefined || !Array.isArray(raw.stops)) return [];
    const stops = raw.stops.map(parseStop).filter((s): s is SheetStop => s !== null);
    return stops.length ? [{ d, dir: text(raw.dir), to: text(raw.to), m: num(raw.m) ?? metersAlong(stops), out: num(raw.out) ?? 0, stops }] : [];
  });
  return { generated_at: text(json.generated_at) ?? null, as_of: asOf(json.as_of), id, r: text(json.r) ?? id, nm: text(json.nm) ?? '', md: num(json.md) ?? MODE_BUS, directions };
}

export function isTrolley(md: number): boolean {
  return (md & MODE_TROLLEY) !== 0 && (md & MODE_BUS) === 0;
}

/** "47: Whitman Plaza to 5th-Godfrey", for the route menu. */
export function routeLabel(route: Pick<IndexRoute, 'r' | 'nm'>): string {
  return route.nm ? `${route.r}: ${route.nm}` : route.r;
}

/** "Southbound to Whitman Plaza", or what SEPTA gives of it. */
export function directionLabel(direction: { d: number; dir?: string; to?: string }): string {
  const t = strings.survey;
  if (direction.dir && direction.to) return t.directionTo(direction.dir, direction.to);
  if (direction.to) return t.towards(direction.to);
  return direction.dir ?? t.directionNumber(direction.d + 1);
}

export function statusOf(stop: SheetStop): StopStatus {
  return stop.c === undefined ? 'missing' : (STATUS_BY_CODE[stop.c] ?? 'unsurveyed');
}

export function statusCounts(stops: SheetStop[]): Record<StopStatus, number> {
  const counts: Record<StopStatus, number> = { shelter: 0, bench: 0, neither: 0, unsurveyed: 0, missing: 0 };
  for (const stop of stops) counts[statusOf(stop)] += 1;
  return counts;
}

const EARTH_METERS = 6_371_000;

/** Meters between two points, along the ground. */
export function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Straight lines from each stop to the next, added up. */
export function metersAlong(stops: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < stops.length; i++) total += meters(stops[i - 1]!, stops[i]!);
  return total;
}

export interface Part {
  /** 1 for the first part */
  number: number;
  /** the stops' places in the whole direction, counting from 1 */
  first: number;
  last: number;
  stops: SheetStop[];
  meters: number;
}

/** The stops in `parts` runs that follow each other, as equal as whole stops allow. */
export function splitParts(stops: SheetStop[], parts: number): Part[] {
  const count = Math.max(1, Math.min(Math.floor(parts) || 1, stops.length || 1));
  const result: Part[] = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const size = Math.floor(stops.length / count) + (i < stops.length % count ? 1 : 0);
    const slice = stops.slice(start, start + size);
    result.push({ number: i + 1, first: start + 1, last: start + slice.length, stops: slice, meters: metersAlong(slice) });
    start += size;
  }
  return result;
}

/** Our walking speed: about 3 miles an hour. */
export const WALK_METERS_PER_MINUTE = 80;
/** Our time at each stop to look and fill in the boxes. */
export const MINUTES_PER_STOP = 1;

/** Our estimate of a walk, in minutes, rounded to 5: walking from stop to stop, plus a minute at
 * each stop. Not a measurement; getting to the first stop and home is not included. */
export function estimateMinutes(meters: number, stops: number): number {
  const minutes = meters / WALK_METERS_PER_MINUTE + stops * MINUTES_PER_STOP;
  return Math.max(5, Math.round(minutes / 5) * 5);
}

/** "about 45 minutes", "about 1 hour 15 minutes", "about 5 hours". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (rest || !hours) parts.push(`${rest} minutes`);
  return `about ${parts.join(' ')}`;
}

/** "0.4 miles", "10.3 miles". */
export function formatMiles(m: number): string {
  const miles = m / 1609.344;
  return miles < 0.1 ? 'less than 0.1 miles' : `${miles.toFixed(1)} miles`;
}

const OSM = 'https://www.openstreetmap.org';

function element(osm: string | undefined): { type: 'node' | 'way'; id: string } | null {
  const match = osm ? /^([nw])(\d+)$/.exec(osm) : null;
  return match ? { type: match[1] === 'n' ? 'node' : 'way', id: match[2]! } : null;
}

/** The stop on OpenStreetMap's map: the matching element, or the spot where SEPTA puts the stop. */
export function osmViewUrl(stop: SheetStop): string {
  const found = element(stop.osm);
  if (found) return `${OSM}/${found.type}/${found.id}`;
  return `${OSM}/?mlat=${stop.lat}&mlon=${stop.lng}#map=19/${stop.lat}/${stop.lng}`;
}

/** OpenStreetMap's own editor with the stop selected, or at the spot when no stop matches. */
export function osmEditUrl(stop: SheetStop): string {
  const found = element(stop.osm);
  if (found) return `${OSM}/edit?${found.type}=${found.id}`;
  return `${OSM}/edit#map=19/${stop.lat}/${stop.lng}`;
}

// What someone ticks on the sheet, kept on this device only -------------------------------------

export type YesNo = 'y' | 'n';
export const QUESTIONS = ['sh', 'bn', 'bi', 'lt'] as const;
export type Question = (typeof QUESTIONS)[number];

export interface StopAnswers {
  sh?: YesNo;
  bn?: YesNo;
  bi?: YesNo;
  lt?: YesNo;
  /** needs repair */
  rp?: boolean;
  /** notes */
  nt?: string;
}

export type Answers = Record<string, StopAnswers>;

/** Where the ticks of one route and direction are kept: under the site's own prefix (docs/DESIGN.md section 5.2). */
export function answersKey(routeId: string, direction: number): string {
  return `placekeepers:v1:survey:${routeId}:${direction}`;
}

/** The prefix the first survey pages kept ticks under, before v0.2 (finding F3 of docs/VERIFICATION_V0_2.md). */
const LEGACY_PREFIX = 'pk-survey:';

/**
 * Moves ticks kept under the old prefix to the site's own, once: each old key is copied over
 * (unless ticks were already kept under the new one) and then removed.
 */
export function moveLegacyAnswers(storage: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'> | null): void {
  try {
    if (!storage) return;
    const old: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) old.push(key);
    }
    for (const key of old) {
      const value = storage.getItem(key);
      const [route, direction] = key.slice(LEGACY_PREFIX.length).split(':');
      const moved = route && direction !== undefined && /^\d+$/.test(direction) ? answersKey(route, Number(direction)) : null;
      if (moved && value !== null && storage.getItem(moved) === null) storage.setItem(moved, value);
      storage.removeItem(key);
    }
  } catch {
    // Storage that refuses is left as it is: the ticks there still show nowhere else.
  }
}

/** The answers kept for one route and direction; nothing when storage is unavailable or broken. */
export function loadAnswers(storage: Pick<Storage, 'getItem'> | null, key: string): Answers {
  try {
    const raw = storage?.getItem(key);
    const json: unknown = raw ? JSON.parse(raw) : null;
    if (!isObject(json)) return {};
    const answers: Answers = {};
    for (const [stop, value] of Object.entries(json)) {
      if (!isObject(value)) continue;
      const kept: StopAnswers = {};
      for (const q of QUESTIONS) if (value[q] === 'y' || value[q] === 'n') kept[q] = value[q];
      if (value.rp === true) kept.rp = true;
      if (typeof value.nt === 'string' && value.nt) kept.nt = value.nt.slice(0, 500);
      if (Object.keys(kept).length) answers[stop] = kept;
    }
    return answers;
  } catch {
    return {};
  }
}

/** Keeps the answers; says false when the browser would not keep them. */
export function saveAnswers(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, key: string, answers: Answers): boolean {
  try {
    if (!storage) return false;
    const kept = Object.fromEntries(Object.entries(answers).filter(([, value]) => Object.keys(value).length));
    if (Object.keys(kept).length) storage.setItem(key, JSON.stringify(kept));
    else storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Ticking Yes when Yes is ticked clears it; ticking No replaces Yes. */
export function toggle(current: StopAnswers | undefined, question: Question, value: YesNo): StopAnswers {
  const next: StopAnswers = { ...current };
  if (next[question] === value) delete next[question];
  else next[question] = value;
  return next;
}

export function answeredCount(answers: Answers, stops: SheetStop[]): number {
  return stops.filter((stop) => {
    const a = answers[stop.k];
    return a && (QUESTIONS.some((q) => a[q]) || a.rp || a.nt);
  }).length;
}

// The address bar: ?route=47&d=0&parts=3, so a sheet can be shared ------------------------------

export const MAX_PARTS = 8;

export interface Choice {
  route: string | null;
  d: number | null;
  parts: number;
}

export function readChoice(search: string): Choice {
  const params = new URLSearchParams(search);
  const route = params.get('route');
  const d = Number(params.get('d'));
  const parts = Number(params.get('parts'));
  return {
    route: route && /^[A-Za-z0-9_-]{1,40}$/.test(route) ? route : null,
    d: params.has('d') && Number.isInteger(d) && d >= 0 ? d : null,
    parts: Number.isInteger(parts) && parts >= 1 && parts <= MAX_PARTS ? parts : 1,
  };
}

export function writeChoice(choice: Choice): string {
  const params = new URLSearchParams();
  if (choice.route) params.set('route', choice.route);
  if (choice.route && choice.d !== null) params.set('d', String(choice.d));
  if (choice.route && choice.parts > 1) params.set('parts', String(choice.parts));
  const query = params.toString();
  return query ? `?${query}` : '';
}
