// Reads the dossier shards (docs/CONTRACTS.md section 6): dossiers/<first four digits>.json, one
// file per group of accounts, and dossiers/common.json, the wording every shard shares (each
// flag's careful note and next step, and the deed fraud notice). The pipeline writes them, so the
// reader is forgiving: a parcel or a section it cannot read is left out with a problem noted,
// never a crash. It keeps only the fields the contract names and copies them into new objects, so
// any other key in the file (a price estimate, a note about a person) can never reach the page.

import type { Manifest } from '../data/manifest.ts';
import { cityDate } from './dates.ts';
import { parseOwnerListParcel } from './owners-table.ts';
import { COMMON_PATH, isOpaAccount, shardPath, shardPaths } from './opa.ts';
import type {
  Assessment,
  CityOwned,
  Confidence,
  DossierNotes,
  FlagNote,
  NoticeNote,
  LandCare,
  LiSummary,
  Link,
  Nearby,
  Owner,
  OwnerFlag,
  OwnerListParcel,
  OwnerType,
  Shard,
  ShardParcel,
  Transfer,
  Vacancy,
  VacancyKind,
} from './types.ts';
import { OWNER_TYPES } from './types.ts';

export const SHARD_SCHEMA = 1;

export interface ShardParseResult {
  shard: Shard | null;
  problems: string[];
  /** Set when the file cannot be used at all. */
  error: string | null;
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

function texts(v: unknown): string[] {
  return Array.isArray(v) ? v.map(text).filter((t): t is string => t !== null) : [];
}

function ids(v: unknown): string[] {
  return [...new Set(texts(v).filter((t) => /^[a-z][a-z0-9_]*$/.test(t)))];
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}

function count(v: unknown): number | null {
  const n = int(v);
  return n !== null && n >= 0 ? n : null;
}

function bool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

const SAFE_URL = /^https:\/\/[^\s"'<>]+$/;

function links(v: unknown): Link[] {
  if (!Array.isArray(v)) return [];
  const out: Link[] = [];
  for (const item of v) {
    if (!isObj(item)) continue;
    const label = text(item.label);
    const url = typeof item.url === 'string' && SAFE_URL.test(item.url) ? item.url : null;
    if (label && url) out.push({ label, url });
  }
  return out;
}

function year(v: unknown): number | null {
  const n = int(v);
  return n !== null && n >= 1800 && n <= 2200 ? n : null;
}

/** The vacancy block, or null when the model leaves the parcel out (no block, or null). */
function vacancy(v: unknown): Vacancy | null {
  if (!isObj(v)) return null;
  const kind = v.kind === 'lot' || v.kind === 'building' ? (v.kind as VacancyKind) : null;
  const confidence = v.confidence === 'high' || v.confidence === 'medium' || v.confidence === 'low' ? (v.confidence as Confidence) : null;
  return { kind, confidence, rs: count(v.rs), n: count(v.n), dy: year(v.dy), sy: year(v.sy), ny: year(v.ny) };
}

const ID = /^[a-z][a-z0-9_]*$/;

function flag(v: unknown): OwnerFlag | null {
  if (!isObj(v)) return null;
  const id = text(v.id);
  const body = text(v.text);
  if (!id || !ID.test(id) || !body) return null;
  const data = isObj(v.data) ? v.data : {};
  const list = typeof data.list === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(data.list) ? data.list : null;
  // A person's other parcels travel with the flag itself (no citywide file lists people).
  const parcels = Array.isArray(data.parcels)
    ? data.parcels.map(parseOwnerListParcel).filter((p): p is OwnerListParcel => p !== null)
    : null;
  return { id, text: body, careful: text(v.careful), nextStep: text(v.next_step), links: links(v.links), list, parcels };
}

function cityOwned(v: unknown): CityOwned | null {
  if (!isObj(v)) return null;
  return { agency: text(v.agency), status: text(v.status), sideYardEligible: v.side_yard_eligible === true };
}

function owner(v: unknown): Owner | null {
  if (!isObj(v)) return null;
  const type = typeof v.type === 'string' && (OWNER_TYPES as readonly string[]).includes(v.type) ? (v.type as OwnerType) : 'unknown';
  const flags = Array.isArray(v.flags) ? v.flags.map(flag).filter((x): x is OwnerFlag => x !== null) : [];
  const notice = text(v.notice);
  return {
    names: texts(v.names),
    mailing: text(v.mailing),
    type,
    typeReason: text(v.type_reason),
    flags,
    cityOwned: cityOwned(v.city_owned),
    notice: notice && ID.test(notice) ? notice : null,
    help: ids(v.help),
  };
}

function transfer(v: unknown): Transfer | null {
  if (!isObj(v)) return null;
  const type = text(v.type);
  if (!type) return null;
  const price = typeof v.price === 'number' && Number.isFinite(v.price) && v.price >= 0 ? Math.round(v.price * 100) / 100 : null;
  return {
    date: cityDate(v.date),
    type,
    price,
    from: texts(v.from),
    to: texts(v.to),
    fromMore: count(v.from_more) ?? 0,
    toMore: count(v.to_more) ?? 0,
    properties: Math.max(1, count(v.properties) ?? 1),
  };
}

/** An assessment: a [year, market value] pair, as the contract writes it, or an object with those keys. */
function assessment(v: unknown): Assessment | null {
  const [rawYear, rawValue] = Array.isArray(v) ? v : isObj(v) ? [v.year, v.market_value] : [undefined, undefined];
  const year = typeof rawYear === 'number' ? rawYear : typeof rawYear === 'string' ? Number(rawYear) : NaN;
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  const value = typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue >= 0 ? Math.round(rawValue) : null;
  return { year, marketValue: value };
}

function li(v: unknown): LiSummary | null {
  if (!isObj(v)) return null;
  return {
    openViolations: count(v.open_violations),
    lastViolation: cityDate(v.last_violation),
    unsafe: bool(v.unsafe),
    imminentlyDangerous: bool(v.imminently_dangerous),
    violations: count(v.violations),
    unsafeSince: cityDate(v.unsafe_since),
    dangerousSince: cityDate(v.imminently_dangerous_since),
    sealed: cityDate(v.sealed),
    demolished: cityDate(v.demolished),
  };
}

function flagNote(v: unknown): FlagNote | null {
  if (!isObj(v)) return null;
  return { careful: text(v.careful), nextStep: text(v.next_step), routes: ids(v.routes), links: links(v.links) };
}

function noticeNote(v: unknown): NoticeNote | null {
  if (!isObj(v)) return null;
  const body = text(v.text);
  return body ? { text: body, routes: ids(v.routes), links: links(v.links) } : null;
}

/** The shared wording in a file's `flags` and `notices`, or null when it has none. */
export function parseNotes(json: unknown): DossierNotes | null {
  if (!isObj(json)) return null;
  const notes: DossierNotes = { flags: {}, notices: {} };
  for (const [id, raw] of Object.entries(isObj(json.flags) ? json.flags : {})) {
    const note = flagNote(raw);
    if (note && ID.test(id)) notes.flags[id] = note;
  }
  for (const [id, raw] of Object.entries(isObj(json.notices) ? json.notices : {})) {
    const note = noticeNote(raw);
    if (note && ID.test(id)) notes.notices[id] = note;
  }
  return Object.keys(notes.flags).length || Object.keys(notes.notices).length ? notes : null;
}

function nearby(v: unknown): Nearby | null {
  if (!isObj(v)) return null;
  const out: Nearby = {
    s12: count(v.s12),
    s36: count(v.s36),
    killed: null,
    landcare: count(v.landcare_within_500ft),
    gardens: count(v.gardens_within_500ft),
  };
  return Object.values(out).some((n) => n !== null) ? out : null;
}

function landcare(v: unknown): LandCare | null {
  if (!isObj(v)) return null;
  const year = int(v.year);
  return { program: text(v.program), year: year !== null && year >= 1950 && year <= 2200 ? year : null };
}

function list<T>(v: unknown, read: (item: unknown) => T | null, where: string, problems: string[]): T[] | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) {
    problems.push(`${where} should be a list`);
    return null;
  }
  const out: T[] = [];
  v.forEach((item, i) => {
    const parsed = read(item);
    if (parsed === null) problems.push(`${where}[${i}] could not be read`);
    else out.push(parsed);
  });
  return out;
}

/** One parcel of a shard, keeping only the contract's fields. */
export function parseShardParcel(raw: unknown, where = 'parcel', problems: string[] = []): ShardParcel | null {
  if (!isObj(raw)) {
    problems.push(`${where} should be an object`);
    return null;
  }
  return {
    address: text(raw.address),
    vacancy: vacancy(raw.vacancy),
    owner: owner(raw.owner),
    transfers: list(raw.transfers, transfer, `${where}.transfers`, problems),
    assessments: list(raw.assessments, assessment, `${where}.assessments`, problems)?.sort((a, b) => b.year - a.year) ?? null,
    li: li(raw.li),
    routes: ids(raw.routes),
    suggestions: ids(raw.suggestions),
    nearby: nearby(raw.nearby),
    landcare: landcare(raw.landcare),
    garden: raw.garden === true,
  };
}

export function parseShard(json: unknown): ShardParseResult {
  const problems: string[] = [];
  if (!isObj(json)) return { shard: null, problems, error: 'the shard is not a JSON object' };
  if (json.schema !== SHARD_SCHEMA) {
    return { shard: null, problems, error: `the shard has schema ${String(json.schema)}, this site reads schema ${SHARD_SCHEMA}` };
  }
  if (!isObj(json.parcels)) return { shard: null, problems, error: 'the shard has no parcels object' };
  const parcels = new Map<string, ShardParcel>();
  for (const [opa, raw] of Object.entries(json.parcels)) {
    if (!isOpaAccount(opa)) {
      problems.push(`"${opa}" is not a nine digit account`);
      continue;
    }
    const parcel = parseShardParcel(raw, `parcels.${opa}`, problems);
    if (parcel) parcels.set(opa, parcel);
  }
  const generatedAt = typeof json.generated_at === 'string' && !Number.isNaN(Date.parse(json.generated_at)) ? json.generated_at : null;
  return { shard: { generatedAt, parcels, notes: parseNotes(json) }, problems, error: null };
}

/** Reads dossiers/common.json; null when it cannot be used. */
export function parseCommon(json: unknown): DossierNotes | null {
  if (!isObj(json) || json.schema !== SHARD_SCHEMA) return null;
  return parseNotes(json);
}

// Loading -----------------------------------------------------------------------------------------

export type ShardLoad = { ok: true; shard: Shard } | { ok: false; reason: 'not_published' | 'failed' };

/**
 * Where a parcel's shard is, by the manifest: its path, or why there is none to ask for:
 * "unlisted" when the shards are published but none holds this parcel (it is not on our list),
 * "unpublished" when no shards are published at all.
 */
export type ShardLocation = { path: string } | { path: null; reason: 'unlisted' | 'unpublished' };

const SHARD_FILE = /^dossiers\/\d+\.json$/;

export function shardLocation(opa: string, manifest: Pick<Manifest, 'files' | 'dossiers'> | null): ShardLocation {
  if (!manifest) return { path: shardPath(opa) };
  if (manifest.dossiers) {
    const prefix = opa.slice(0, manifest.dossiers.prefix_digits);
    return manifest.dossiers.prefixes.has(prefix) ? { path: `dossiers/${prefix}.json` } : { path: null, reason: 'unlisted' };
  }
  // Older manifests listed each shard in `files`.
  const listed = shardPaths(opa).find((path) => path in manifest.files);
  if (listed) return { path: listed };
  return Object.keys(manifest.files).some((path) => SHARD_FILE.test(path)) ? { path: null, reason: 'unlisted' } : { path: null, reason: 'unpublished' };
}

const cache = new Map<string, Promise<ShardLoad>>();
const commonCache = new Map<string, Promise<DossierNotes | null>>();

/**
 * Downloads and reads the shared wording once per page visit, when the manifest lists it (or
 * when there is no manifest to ask). Null when it is not published or cannot be read; the page
 * then uses its own copy of the same wording.
 */
export function loadCommon(dataBase: string, files: Record<string, unknown> | null, fetchImpl: typeof fetch = fetch): Promise<DossierNotes | null> {
  if (files && !(COMMON_PATH in files)) return Promise.resolve(null);
  const key = `${dataBase}${COMMON_PATH}`;
  let pending = commonCache.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetchImpl(key);
        return response.ok ? parseCommon(await response.json()) : null;
      } catch {
        return null;
      }
    })();
    commonCache.set(key, pending);
    pending.then((notes) => {
      if (!notes) commonCache.delete(key);
    });
  }
  return pending;
}

/** Downloads and reads one shard (a path from shardLocation), once per page visit. */
export function loadShard(dataBase: string, path: string, fetchImpl: typeof fetch = fetch): Promise<ShardLoad> {
  const key = `${dataBase}${path}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async (): Promise<ShardLoad> => {
      try {
        const response = await fetchImpl(key);
        if (response.status === 404) return { ok: false, reason: 'not_published' };
        if (!response.ok) return { ok: false, reason: 'failed' };
        const parsed = parseShard(await response.json());
        if (parsed.problems.length) console.warn(`Placekeepers ${path}:`, parsed.problems.slice(0, 10));
        return parsed.shard ? { ok: true, shard: parsed.shard } : { ok: false, reason: 'failed' };
      } catch {
        return { ok: false, reason: 'failed' };
      }
    })();
    cache.set(key, pending);
    // A failed download may work next time.
    pending.then((result) => {
      if (!result.ok && result.reason === 'failed') cache.delete(key);
    });
  }
  return pending;
}

/** Forgets downloaded shards (for tests). */
export function clearShardCache(): void {
  cache.clear();
  commonCache.clear();
}
