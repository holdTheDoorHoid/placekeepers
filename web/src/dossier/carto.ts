// Live lookups from the City's Carto SQL API (https://phl.carto.com/api/v2/sql), which answers
// browsers without a key. Every query is built here from two kinds of input only:
//
//   * an OPA account, checked to be exactly nine digits (accountLiteral), and
//   * a point, checked to be two finite numbers inside Philadelphia (pointSql).
//
// Anything else is refused with an error before a query exists. Text a person types never goes
// into SQL: address search goes to the City's address service instead (./ais.ts), and only the
// nine digit account it returns comes back here.
//
// Each query asks only for the columns the dossier shows, so case numbers, contractor and
// applicant names, and the race, age or sex of anyone never reach the browser.

import type { Geometry } from 'geojson';
import { PHILLY_BOUNDS } from '../state/defaults.ts';
import { cityDate } from './dates.ts';
import { fetchJson, type FailReason, type FetchOptions } from './http.ts';
import { isOpaAccount, normalizeAccount } from './opa.ts';
import type { Assessment, LiEvent, LiKind, LiveLi, LiveProperty, ParcelAtPoint, ParcelShape, Transfer } from './types.ts';
import { LI_KINDS } from './types.ts';

export const CARTO_SQL_URL = 'https://phl.carto.com/api/v2/sql';

/** 500 feet, in meters: the radius of the live nearby counts, the same as the snapshot's. */
export const NEARBY_METERS = 152.4;

/** At most this many transfers, assessments and L&I records per lookup. */
export const MAX_TRANSFERS = 200;
export const MAX_ASSESSMENTS = 100;
export const MAX_LI_EVENTS = 400;

/** Thrown when something that is not a nine digit account or a point in the city reaches a query. */
export class UnsafeQueryInput extends Error {
  override name = 'UnsafeQueryInput';
}

/** The account as a SQL text literal, after checking that it is exactly nine digits. */
export function accountLiteral(opa: unknown): string {
  if (!isOpaAccount(opa)) throw new UnsafeQueryInput('An OPA account must be exactly nine digits.');
  return `'${opa}'`;
}

/** A point in SQL, after checking that it is two finite numbers inside Philadelphia. */
export function pointSql(lng: unknown, lat: unknown): string {
  if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new UnsafeQueryInput('A point must be two finite numbers.');
  }
  const [[west, south], [east, north]] = PHILLY_BOUNDS;
  if (lng < west || lng > east || lat < south || lat > north) {
    throw new UnsafeQueryInput('The point is outside Philadelphia.');
  }
  // toFixed on a finite number writes only digits, a minus sign and a decimal point.
  return `ST_SetSRID(ST_MakePoint(${lng.toFixed(6)}, ${lat.toFixed(6)}), 4326)`;
}

/** The property record: owner, mailing address, the City's description and the point. */
export function propertySql(opa: string): string {
  return (
    'SELECT parcel_number, location, owner_1, owner_2, mailing_care_of, mailing_address_1, mailing_address_2, ' +
    'mailing_street, mailing_city_state, mailing_zip, category_code_description, building_code_description, ' +
    'sale_date, sale_price, market_value, ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng ' +
    `FROM opa_properties_public WHERE parcel_number = ${accountLiteral(opa)} LIMIT 1`
  );
}

/**
 * Every deed (and certificate of stock transfer), newest first. The date and price are the ones
 * the City's property page shows: the document's date and the adjusted total.
 */
export function transfersSql(opa: string): string {
  return (
    'SELECT document_id, document_type, display_date, grantors, grantees, total_consideration, ' +
    'adjusted_total_consideration, property_count FROM rtt_summary ' +
    `WHERE opa_account_num = ${accountLiteral(opa)} ` +
    "AND (document_type LIKE '%DEED%' OR document_type = 'CERTIFICATE OF STOCK TRANSFER') " +
    `ORDER BY display_date DESC, document_id DESC LIMIT ${MAX_TRANSFERS}`
  );
}

/** The City's assessment of market value, by year. */
export function assessmentsSql(opa: string): string {
  return `SELECT year, market_value FROM assessments WHERE parcel_number = ${accountLiteral(opa)} ORDER BY year DESC LIMIT ${MAX_ASSESSMENTS}`;
}

/**
 * The L&I timeline in one query: violations, permits, demolitions, unsafe and imminently
 * dangerous notices, and clean and seal work, newest first, in the same five columns.
 */
export function liSql(opa: string): string {
  const a = accountLiteral(opa);
  const resolved = "CASE WHEN violationresolutiondate IS NULL THEN 'OPEN' ELSE 'RESOLVED' END";
  return (
    'SELECT kind, date, title, status, detail FROM (' +
    `SELECT 'violation' AS kind, violationdate AS date, violationcodetitle AS title, violationstatus AS status, casestatus AS detail FROM violations WHERE opa_account_num = ${a} ` +
    `UNION ALL SELECT 'permit', permitissuedate, typeofwork, status, permitdescription FROM permits WHERE opa_account_num = ${a} ` +
    `UNION ALL SELECT 'demolition', COALESCE(completed_date, start_date), typeofwork, status, city_demo FROM demolitions WHERE opa_account_num = ${a} ` +
    `UNION ALL SELECT 'unsafe', violationdate, violationcodetitle, ${resolved}, NULL FROM unsafe WHERE opa_account_num = ${a} ` +
    `UNION ALL SELECT 'imminently_dangerous', violationdate, violationcodetitle, ${resolved}, NULL FROM imm_dang WHERE opa_account_num = ${a} ` +
    `UNION ALL SELECT 'clean_seal', COALESCE(workordercompleteddate, casecreateddate), workordertype, workorderstatus, NULL FROM clean_seal WHERE opa_account_num = ${a}` +
    `) AS events ORDER BY date DESC NULLS LAST LIMIT ${MAX_LI_EVENTS}`
  );
}

/**
 * Counts within 500 feet of a point: people shot in the last 12 months and 3 years, and people
 * killed in traffic crashes since 2019 (the Police records start then). Counts only: no other
 * column of either table is read.
 */
export function nearbySql(lng: number, lat: number): string {
  const here = `${pointSql(lng, lat)}::geography`;
  const near = `ST_DWithin(the_geom::geography, ${here}, ${NEARBY_METERS})`;
  return (
    `SELECT (SELECT count(*) FROM shootings WHERE ${near} AND date_::date >= current_date - 365) AS s12, ` +
    `(SELECT count(*) FROM shootings WHERE ${near} AND date_::date >= current_date - 1095) AS s36, ` +
    `(SELECT count(*) FROM fatal_crashes WHERE ${near}) AS killed`
  );
}

/** The parcel under a point on the Water Department's parcel map, with its shape. */
export function parcelAtPointSql(lng: number, lat: number): string {
  return `SELECT brt_id, address, ST_AsGeoJSON(the_geom, 6) AS shape FROM pwd_parcels WHERE ST_Intersects(the_geom, ${pointSql(lng, lat)}) LIMIT 3`;
}

/** A parcel's shape, by account. */
export function parcelShapeSql(opa: string): string {
  return `SELECT brt_id, address, ST_AsGeoJSON(the_geom, 6) AS shape FROM pwd_parcels WHERE brt_id = ${accountLiteral(opa)} LIMIT 1`;
}

export function cartoUrl(sql: string): string {
  return `${CARTO_SQL_URL}?q=${encodeURIComponent(sql)}`;
}

// Reading the answers --------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** The rows of a Carto answer, or null when it is not one. */
export function cartoRows(data: unknown): Row[] | null {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { rows?: unknown }).rows)) return null;
  return ((data as { rows: unknown[] }).rows).filter((r): r is Row => !!r && typeof r === 'object' && !Array.isArray(r));
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function wholeDollars(value: unknown): number | null {
  const n = num(value);
  return n === null ? null : Math.round(n);
}

/** Grantors or grantees: the City separates names with semicolons. */
export function splitNames(value: unknown): string[] {
  const t = typeof value === 'string' ? value : '';
  return t
    .split(';')
    .map((name) => name.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** The mailing address as the City publishes it: its lines in order, joined with commas, skipping empty and repeated lines. */
export function mailingText(parts: (string | null | undefined)[]): string | null {
  const lines: string[] = [];
  for (const part of parts) {
    const t = (part ?? '').replace(/\s+/g, ' ').trim();
    if (t && !lines.includes(t)) lines.push(t);
  }
  return lines.length ? lines.join(', ') : null;
}

export function readProperty(opa: string, rows: Row[]): LiveProperty | null {
  const row = rows.find((r) => normalizeAccount(r.parcel_number) === opa) ?? null;
  if (!row) return null;
  const cityState = text(row.mailing_city_state);
  const zip = text(row.mailing_zip);
  const lastLine = [cityState, zip].filter(Boolean).join(' ') || null;
  const lng = num(row.lng);
  const lat = num(row.lat);
  return {
    opa,
    address: text(row.location),
    names: [row.owner_1, row.owner_2].map(text).filter((n): n is string => n !== null),
    mailing: mailingText([text(row.mailing_care_of), text(row.mailing_address_1), text(row.mailing_address_2), text(row.mailing_street), lastLine]),
    mailingStreet: text(row.mailing_street),
    mailingCityState: cityState,
    mailingZip: zip,
    category: text(row.category_code_description),
    buildingDescription: text(row.building_code_description),
    saleDate: cityDate(row.sale_date),
    salePrice: wholeDollars(row.sale_price),
    marketValue: wholeDollars(row.market_value),
    lng: lng !== null && lat !== null ? lng : null,
    lat: lng !== null && lat !== null ? lat : null,
  };
}

/** Deeds newest first, each document once. */
export function readTransfers(rows: Row[]): Transfer[] {
  const seen = new Set<string>();
  const out: (Transfer & { id: number })[] = [];
  for (const row of rows) {
    const type = text(row.document_type);
    if (!type) continue;
    const id = num(row.document_id);
    const date = cityDate(row.display_date);
    const adjusted = wholeDollars(row.adjusted_total_consideration);
    const price = adjusted ?? wholeDollars(row.total_consideration);
    const key = id !== null ? String(id) : `${date}|${type}|${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const count = num(row.property_count);
    out.push({
      id: id ?? 0,
      date,
      type,
      price,
      from: splitNames(row.grantors),
      to: splitNames(row.grantees),
      fromMore: 0,
      toMore: 0,
      properties: count !== null && count > 1 ? Math.round(count) : 1,
    });
  }
  out.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.id - a.id);
  return out.map(({ id: _id, ...transfer }) => transfer);
}

export function readAssessments(rows: Row[]): Assessment[] {
  const byYear = new Map<number, number | null>();
  for (const row of rows) {
    const year = num(row.year);
    if (year === null || !Number.isInteger(year) || year < 1900 || year > 2200) continue;
    const value = wholeDollars(row.market_value);
    const before = byYear.get(year);
    byYear.set(year, before === undefined || before === null ? value : value === null ? before : Math.max(before, value));
  }
  return [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, marketValue]) => ({ year, marketValue }));
}

function isLiKind(value: unknown): value is LiKind {
  return typeof value === 'string' && (LI_KINDS as readonly string[]).includes(value);
}

export function readLi(rows: Row[]): LiveLi {
  const events: LiEvent[] = [];
  for (const row of rows) {
    if (!isLiKind(row.kind)) continue;
    const status = text(row.status);
    const upper = (status ?? '').toUpperCase();
    const open =
      row.kind === 'violation'
        ? upper === 'OPEN'
        : row.kind === 'unsafe' || row.kind === 'imminently_dangerous'
          ? upper === 'OPEN'
          : false;
    events.push({ kind: row.kind, date: cityDate(row.date), title: text(row.title), status, detail: text(row.detail), open });
  }
  events.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return { events, truncated: rows.length >= MAX_LI_EVENTS };
}

export function readNearby(rows: Row[]): { s12: number | null; s36: number | null; killed: number | null } | null {
  const row = rows[0];
  if (!row) return null;
  const count = (v: unknown) => {
    const n = num(v);
    return n !== null && n >= 0 ? Math.round(n) : null;
  };
  return { s12: count(row.s12), s36: count(row.s36), killed: count(row.killed) };
}

function readShape(value: unknown): Geometry | null {
  if (typeof value !== 'string') return null;
  try {
    const shape = JSON.parse(value) as { type?: unknown; coordinates?: unknown };
    if ((shape.type === 'Polygon' || shape.type === 'MultiPolygon') && Array.isArray(shape.coordinates)) return shape as Geometry;
  } catch {
    // An unreadable shape only means the parcel is not outlined on the map.
  }
  return null;
}

export function readParcelsAtPoint(rows: Row[]): ParcelAtPoint[] {
  const out: ParcelAtPoint[] = [];
  for (const row of rows) {
    const opa = normalizeAccount(row.brt_id);
    if (!opa || out.some((p) => p.opa === opa)) continue;
    out.push({ opa, address: text(row.address), shape: readShape(row.shape) });
  }
  return out;
}

export function readParcelShape(rows: Row[]): ParcelShape | null {
  const row = rows[0];
  return row ? { address: text(row.address), shape: readShape(row.shape) } : null;
}

// Asking the City ---------------------------------------------------------------------------------

export type LiveResult<T> = { ok: true; data: T } | { ok: false; reason: FailReason };

async function query<T>(sql: string, read: (rows: Row[]) => T | null, options: FetchOptions): Promise<LiveResult<T>> {
  const result = await fetchJson(cartoUrl(sql), options);
  if (!result.ok) return { ok: false, reason: result.reason };
  const rows = cartoRows(result.data);
  if (!rows) return { ok: false, reason: 'bad_data' };
  const data = read(rows);
  return data === null ? { ok: false, reason: 'not_found' } : { ok: true, data };
}

export function fetchProperty(opa: string, options: FetchOptions = {}): Promise<LiveResult<LiveProperty>> {
  return query(propertySql(opa), (rows) => readProperty(opa, rows), options);
}

export function fetchTransfers(opa: string, options: FetchOptions = {}): Promise<LiveResult<Transfer[]>> {
  return query(transfersSql(opa), readTransfers, options);
}

export function fetchAssessments(opa: string, options: FetchOptions = {}): Promise<LiveResult<Assessment[]>> {
  return query(assessmentsSql(opa), readAssessments, options);
}

export function fetchLi(opa: string, options: FetchOptions = {}): Promise<LiveResult<LiveLi>> {
  return query(liSql(opa), readLi, options);
}

export function fetchNearby(lng: number, lat: number, options: FetchOptions = {}) {
  return query(nearbySql(lng, lat), readNearby, options);
}

export function fetchParcelsAt(lng: number, lat: number, options: FetchOptions = {}): Promise<LiveResult<ParcelAtPoint[]>> {
  return query(parcelAtPointSql(lng, lat), readParcelsAtPoint, options);
}

export function fetchParcelShape(opa: string, options: FetchOptions = {}): Promise<LiveResult<ParcelShape>> {
  return query(parcelShapeSql(opa), readParcelShape, options);
}
