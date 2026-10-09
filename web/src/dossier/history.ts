// Reads the history shards of the lot timeline (issue #38): dossiers/history/<prefix>.json, one
// beside each dossier shard, fetched only when a lot page's History part opens (or it is printed),
// so opening a lot stays fast on a phone. Like the dossier shards, the reader is forgiving and keeps
// only the fields the contract names (docs/CONTRACTS.md section 6).

import type { Manifest } from '../data/manifest.ts';
import { isDay } from './dates.ts';
import { isOpaAccount } from './opa.ts';
import { LIST_IDS, type LiGroups, type LiRecord, type ListId, type ListRecord } from './timeline.ts';
import type { HistoryParcel, HistoryShard } from './types.ts';
import { LI_KINDS } from './types.ts';

export const HISTORY_SCHEMA = 1;
export const HISTORY_DIR = 'dossiers/history';

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

/** One record as the shard writes it: [day, title, status, detail, count], trailing values left off. */
function record(v: unknown): LiRecord | null {
  if (!Array.isArray(v)) return null;
  const [day, title, status, detail, count] = v as unknown[];
  const date = isDay(day) ? day : null;
  const out: LiRecord = {
    date,
    title: text(title),
    status: text(status),
    detail: text(detail),
    count: typeof count === 'number' && Number.isInteger(count) && count > 1 ? count : 1,
  };
  return out.date === null && out.title === null ? null : out;
}

function groups(v: unknown): LiGroups {
  const out: LiGroups = {};
  if (!isObj(v)) return out;
  for (const kind of LI_KINDS) {
    const raw = v[kind];
    if (!Array.isArray(raw)) continue;
    const records = raw.map(record).filter((r): r is LiRecord => r !== null);
    if (records.length) out[kind] = records;
  }
  return out;
}

function lists(v: unknown): ListRecord[] {
  if (!Array.isArray(v)) return [];
  const out: ListRecord[] = [];
  for (const item of v) {
    if (!Array.isArray(item)) continue;
    const [date, list] = item as unknown[];
    if (isDay(date) && typeof list === 'string' && (LIST_IDS as readonly string[]).includes(list)) out.push({ date, list: list as ListId });
  }
  return out;
}

export interface HistoryParseResult {
  shard: HistoryShard | null;
  error: string | null;
}

export function parseHistoryShard(json: unknown): HistoryParseResult {
  if (!isObj(json)) return { shard: null, error: 'the history shard is not a JSON object' };
  if (json.schema !== HISTORY_SCHEMA) return { shard: null, error: `the history shard has schema ${String(json.schema)}, this site reads schema ${HISTORY_SCHEMA}` };
  if (!isObj(json.parcels)) return { shard: null, error: 'the history shard has no parcels object' };
  const parts = Array.isArray(json.parts) ? json.parts.filter((p): p is string => typeof p === 'string') : [];
  const parcels = new Map<string, HistoryParcel>();
  for (const [opa, raw] of Object.entries(json.parcels)) {
    if (!isOpaAccount(opa) || !isObj(raw)) continue;
    const partial = Array.isArray(raw.partial) && raw.partial.includes('li');
    parcels.set(opa, { li: partial || !parts.includes('li') ? null : groups(raw.li), lists: lists(raw.lists) });
  }
  const generatedAt = typeof json.generated_at === 'string' && !Number.isNaN(Date.parse(json.generated_at)) ? json.generated_at : null;
  return { shard: { generatedAt, parts, parcels }, error: null };
}

/** A parcel's history: its entry, or for a parcel the shard does not name, no records at all (none of its L&I records, when the build holds them). */
export function historyOf(shard: HistoryShard, opa: string): HistoryParcel {
  return shard.parcels.get(opa) ?? { li: shard.parts.includes('li') ? {} : null, lists: [] };
}

/** Where a parcel's history shard is, by the manifest, or null when this build has none for it. */
export function historyPath(opa: string, manifest: Pick<Manifest, 'dossiers'> | null): string | null {
  const block = manifest?.dossiers;
  if (!block || !block.history) return null;
  const prefix = opa.slice(0, block.prefix_digits);
  return block.prefixes.has(prefix) ? `${HISTORY_DIR}/${prefix}.json` : null;
}

export type HistoryLoad = { ok: true; shard: HistoryShard } | { ok: false; reason: 'not_published' | 'failed' };

const cache = new Map<string, Promise<HistoryLoad>>();

/** Downloads and reads one history shard, once per page visit. */
export function loadHistoryShard(dataBase: string, path: string, fetchImpl: typeof fetch = fetch): Promise<HistoryLoad> {
  const key = `${dataBase}${path}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async (): Promise<HistoryLoad> => {
      try {
        const response = await fetchImpl(key);
        if (response.status === 404) return { ok: false, reason: 'not_published' };
        if (!response.ok) return { ok: false, reason: 'failed' };
        const parsed = parseHistoryShard(await response.json());
        if (parsed.error) console.warn(`Placekeepers ${path}: ${parsed.error}`);
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

/** Forgets downloaded history shards (for tests). */
export function clearHistoryCache(): void {
  cache.clear();
}
