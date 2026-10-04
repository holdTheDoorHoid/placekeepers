// Opens a lot page: finds the parcel in its weekly shard and, when "Fetch live City data" is on,
// asks the City for each live part at the same time, each with its own time limit. Opening
// another parcel cancels the requests still running for the last one. Live answers are kept for
// a few minutes, so going back to a lot does not ask the City again.
//
// Svelte tracks the fields marked $state, so the page updates as each answer arrives.

import type { Geometry } from 'geojson';
import {
  fetchAssessments,
  fetchLi,
  fetchNearby,
  fetchParcelShape,
  fetchProperty,
  fetchTransfers,
  type LiveResult,
} from './carto.ts';
import { IDLE_PARTS, type LiveParts, type Part, type ShardState } from './build.ts';
import { LIVE_TIMEOUT_MS } from './http.ts';
import { isOpaAccount } from './opa.ts';
import { loadShard } from './shard.ts';

/** How long a live answer is reused before the City is asked again. */
export const LIVE_CACHE_MS = 5 * 60 * 1000;

export interface OpenHints {
  /** The parcel's tile properties, when it was opened from the map's lots layer. */
  tile?: Record<string, unknown> | null;
  /** A point on the parcel. */
  center?: [number, number] | null;
  /** The parcel's shape, when a lookup already found it. */
  shape?: Geometry | null;
}

export interface DossierDeps {
  dataBase: string;
  /** The manifest's file list once it has loaded (null when it could not load). */
  files: () => Promise<Record<string, unknown> | null>;
  liveOn: () => boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

type PartKey = keyof LiveParts;

export class DossierController {
  opa = $state<string | null>(null);
  shard = $state.raw<ShardState>({ status: 'loading' });
  live = $state.raw<LiveParts>(IDLE_PARTS);
  tile = $state.raw<Record<string, unknown> | null>(null);
  center = $state.raw<[number, number] | null>(null);
  shape = $state.raw<Geometry | null>(null);

  private readonly deps: DossierDeps;
  private run = 0;
  private abort: AbortController | null = null;
  private readonly cache = new Map<string, { at: number; part: Part<unknown> }>();

  constructor(deps: DossierDeps) {
    this.deps = deps;
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  /** Opens a parcel's lot page, or updates what is known about the one already open. */
  open(opa: string, hints: OpenHints = {}): void {
    if (!isOpaAccount(opa)) {
      this.close();
      return;
    }
    const same = opa === this.opa;
    if (hints.tile !== undefined) this.tile = hints.tile;
    else if (!same) this.tile = null;
    if (hints.center) this.center = hints.center;
    else if (!same) this.center = null;
    if (hints.shape !== undefined && hints.shape !== null) this.shape = hints.shape;
    else if (!same) this.shape = null;
    if (same) return;
    this.opa = opa;
    this.start(false);
  }

  close(): void {
    this.abort?.abort();
    this.abort = null;
    this.run++;
    this.opa = null;
    this.shard = { status: 'loading' };
    this.live = IDLE_PARTS;
    this.tile = null;
    this.center = null;
    this.shape = null;
  }

  /** Asks the City again for every part that failed. */
  retry(): void {
    if (this.opa) this.start(true);
  }

  /** Follows the "Fetch live City data" option: asks the City when it is turned on, and stops when it is turned off. */
  liveChanged(): void {
    if (!this.opa) return;
    if (this.deps.liveOn()) this.start(true);
    else {
      this.abort?.abort();
      this.live = IDLE_PARTS;
    }
  }

  private setPart<K extends PartKey>(key: K, part: LiveParts[K]): void {
    this.live = { ...this.live, [key]: part };
  }

  private cached(key: string): Part<unknown> | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (this.now() - hit.at > LIVE_CACHE_MS) {
      this.cache.delete(key);
      return null;
    }
    return hit.part;
  }

  private start(again: boolean): void {
    const opa = this.opa!;
    this.abort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    const run = ++this.run;
    const current = () => run === this.run && opa === this.opa;
    const options = { fetchImpl: this.deps.fetchImpl, timeoutMs: this.deps.timeoutMs ?? LIVE_TIMEOUT_MS, signal: abort.signal };

    if (!again) {
      this.shard = { status: 'loading' };
      this.live = IDLE_PARTS;
    }
    const shardDone = (async () => {
      if (again && this.shard.status !== 'loading' && this.shard.status !== 'failed') return;
      const files = await this.deps.files();
      const result = await loadShard(this.deps.dataBase, opa, files, this.deps.fetchImpl);
      if (!current()) return;
      if (result.ok) {
        const parcel = result.shard.parcels.get(opa);
        this.shard = parcel ? { status: 'found', parcel, generatedAt: result.shard.generatedAt } : { status: 'absent' };
      } else {
        this.shard = result.reason === 'not_published' ? { status: 'absent' } : { status: 'failed' };
      }
    })();

    if (!this.deps.liveOn()) {
      this.live = IDLE_PARTS;
      return;
    }

    const ask = <K extends PartKey>(key: K, fetcher: () => Promise<LiveResult<unknown>>, after?: (part: Part<unknown>) => void): void => {
      const existing = this.live[key];
      if (again && existing.status === 'ok') return;
      const cacheKey = `${key}:${opa}`;
      const hit = again ? null : this.cached(cacheKey);
      if (hit) {
        this.setPart(key, hit as LiveParts[K]);
        after?.(hit);
        return;
      }
      this.setPart(key, { status: 'loading' } as LiveParts[K]);
      fetcher().then((result) => {
        if (!current()) return;
        if (!result.ok && result.reason === 'aborted') return;
        const part: Part<unknown> = result.ok ? { status: 'ok', data: result.data, at: this.now() } : { status: 'failed', reason: result.reason };
        if (part.status === 'ok') this.cache.set(cacheKey, { at: this.now(), part });
        this.setPart(key, part as LiveParts[K]);
        after?.(part);
      });
    };

    let resolvePoint: (point: [number, number] | null) => void = () => {};
    const point = new Promise<[number, number] | null>((resolve) => (resolvePoint = resolve));
    if (this.center) resolvePoint(this.center);

    ask('property', () => fetchProperty(opa, options), (part) => {
      if (part.status === 'ok') {
        const data = part.data as { lng: number | null; lat: number | null };
        if (!this.center && data.lng !== null && data.lat !== null && current()) this.center = [data.lng, data.lat];
      }
      resolvePoint(this.center);
    });
    ask('transfers', () => fetchTransfers(opa, options));
    ask('assessments', () => fetchAssessments(opa, options));
    ask('li', () => fetchLi(opa, options));

    // Nearby counts: only for parcels the snapshot does not cover, once a point is known.
    void Promise.all([shardDone, point]).then(([, at]) => {
      if (!current()) return;
      if (this.shard.status === 'found' && this.shard.parcel.nearby) return;
      if (!at) return;
      ask('nearby', () => fetchNearby(at[0], at[1], options));
    });

    // The parcel's outline for the map, when it did not come from the lots layer.
    void shardDone.then(() => {
      if (!current() || this.shape || this.tile) return;
      fetchParcelShape(opa, options).then((result) => {
        if (current() && result.ok && result.data.shape) this.shape = result.data.shape;
      });
    });
  }
}
