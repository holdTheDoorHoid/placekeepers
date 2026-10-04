// Reads a dossier shard, dossiers/<first three digits>.json (docs/CONTRACTS.md, the dossier
// shards). The pipeline writes it, so the reader is forgiving: a parcel or a section it cannot
// read is left out with a problem noted, never a crash. It keeps only the fields the contract
// names and copies them into new objects, so any other key in the file (a price estimate, a note
// about a person) can never reach the page.

import { cityDate } from './dates.ts';
import { isOpaAccount, shardPath } from './opa.ts';
import type {
  Assessment,
  Confidence,
  LandCare,
  LiSummary,
  Link,
  Nearby,
  Owner,
  OwnerFlag,
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

function vacancy(v: unknown): Vacancy | null {
  if (!isObj(v)) return null;
  const kind = v.kind === 'lot' || v.kind === 'building' ? (v.kind as VacancyKind) : null;
  const confidence = v.confidence === 'high' || v.confidence === 'medium' || v.confidence === 'low' ? (v.confidence as Confidence) : null;
  return { kind, confidence, reasons: texts(v.reasons) };
}

function flag(v: unknown): OwnerFlag | null {
  if (!isObj(v)) return null;
  const id = text(v.id);
  const body = text(v.text);
  if (!id || !/^[a-z][a-z0-9_]*$/.test(id) || !body) return null;
  return { id, text: body, careful: text(v.careful), nextStep: text(v.next_step), links: links(v.links) };
}

function owner(v: unknown): Owner | null {
  if (!isObj(v)) return null;
  const type = typeof v.type === 'string' && (OWNER_TYPES as readonly string[]).includes(v.type) ? (v.type as OwnerType) : 'unknown';
  const flags = Array.isArray(v.flags) ? v.flags.map(flag).filter((x): x is OwnerFlag => x !== null) : [];
  return { names: texts(v.names), mailing: text(v.mailing), type, typeReason: text(v.type_reason), flags };
}

function transfer(v: unknown): Transfer | null {
  if (!isObj(v)) return null;
  const type = text(v.type);
  if (!type) return null;
  const price = typeof v.price === 'number' && Number.isFinite(v.price) && v.price >= 0 ? Math.round(v.price) : null;
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

function assessment(v: unknown): Assessment | null {
  if (!isObj(v)) return null;
  const year = typeof v.year === 'number' ? v.year : typeof v.year === 'string' ? Number(v.year) : NaN;
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  const value = typeof v.market_value === 'number' && Number.isFinite(v.market_value) ? Math.round(v.market_value) : null;
  return { year, marketValue: value };
}

function li(v: unknown): LiSummary | null {
  if (!isObj(v)) return null;
  return {
    openViolations: count(v.open_violations),
    lastViolation: cityDate(v.last_violation),
    unsafe: bool(v.unsafe),
    imminentlyDangerous: bool(v.imminently_dangerous),
  };
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
  return { shard: { generatedAt, parcels }, problems, error: null };
}

// Loading -----------------------------------------------------------------------------------------

export type ShardLoad = { ok: true; shard: Shard } | { ok: false; reason: 'not_published' | 'failed' };

const cache = new Map<string, Promise<ShardLoad>>();

/**
 * Downloads and reads the shard that holds an account, once per page visit. A shard the
 * manifest does not list is not asked for at all (most parcels in the city have none).
 */
export function loadShard(
  dataBase: string,
  opa: string,
  files: Record<string, unknown> | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ShardLoad> {
  const path = shardPath(opa);
  if (files && !(path in files)) return Promise.resolve({ ok: false, reason: 'not_published' });
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
}
