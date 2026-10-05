// The street blocks and crashes drawn on the map, as lists: the way to reach them without the map,
// with a keyboard or a screen reader (issue #26; docs/VERIFICATION_INTERFACE.md, finding L1). A
// block says its street, its street safety priority under the lens blend and the main reason; a
// crash says what its details say, and the nearest block drawn, so entries can be told apart.
// Opening an entry shows the same details as tapping the map.

import type { Registry } from '../registry/types.ts';
import type { AppState } from '../state/defaults.ts';
import { distanceMeters } from '../places/rank.ts';
import { describeCrash, describeSegment, type CrashView } from './describe.ts';

type LngLat = [number, number];

/** A street block drawn in the current view: its registry layer, its tile properties and its line. */
export interface LineInView {
  layerId: string;
  properties: Record<string, unknown>;
  /** The block's line, in pieces when tile edges cut it. */
  paths: LngLat[][];
  /** A point halfway along the block, where the map shows it. */
  lngLat: LngLat;
}

/** A crash drawn in the current view. */
export interface CrashInView {
  layerId: string;
  properties: Record<string, unknown>;
  lngLat: LngLat;
}

export interface BlockEntry {
  key: string;
  layerId: string;
  properties: Record<string, unknown>;
  lngLat: LngLat;
  paths: LngLat[][];
  /** The street, as people read it ("N Broad St"). */
  name: string;
  /** Street safety priority from 0 to 100 under the lens blend, as the details show it, or null. */
  score: number | null;
  /** The factor that adds the most to the score. */
  reason: string | null;
}

export interface CrashEntry {
  key: string;
  layerId: string;
  properties: Record<string, unknown>;
  lngLat: LngLat;
  crash: CrashView;
  /** The nearest block drawn, by its street, or null when none is near. */
  near: string | null;
}

/** The lines of a LineString or MultiLineString, as lists of points. */
export function linePaths(geometry: { type: string; coordinates?: unknown }): LngLat[][] {
  if (geometry.type === 'LineString') return [geometry.coordinates as LngLat[]];
  if (geometry.type === 'MultiLineString') return geometry.coordinates as LngLat[][];
  return [];
}

/** The point halfway along the longest piece of a line. */
export function pointOnPaths(paths: LngLat[][]): LngLat {
  const lengths = paths.map((path) => path.slice(1).reduce((sum, p, i) => sum + distanceMeters(path[i]!, p), 0));
  const longest = paths[lengths.indexOf(Math.max(...lengths))] ?? [];
  if (longest.length === 0) return [0, 0];
  let left = Math.max(...lengths) / 2;
  for (let i = 1; i < longest.length; i++) {
    const a = longest[i - 1]!;
    const b = longest[i]!;
    const step = distanceMeters(a, b);
    if (step >= left && step > 0) {
      const t = left / step;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    left -= step;
  }
  return longest[0]!;
}

/** Meters from a point to the nearest point of a line, close enough for a city. */
export function distanceToPaths(point: LngLat, paths: LngLat[][]): number {
  const kx = 111_320 * Math.cos((point[1] * Math.PI) / 180);
  const ky = 110_574;
  let best = Infinity;
  for (const path of paths) {
    for (let i = 0; i < path.length; i++) {
      const a = path[i]!;
      const b = path[i + 1] ?? a;
      const ax = (a[0] - point[0]) * kx;
      const ay = (a[1] - point[1]) * ky;
      const bx = (b[0] - point[0]) * kx;
      const by = (b[1] - point[1]) * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

/** The blocks drawn in view, highest street safety priority first, then by street. */
export function blockEntries(reg: Registry, state: AppState, blocks: LineInView[]): BlockEntry[] {
  return blocks
    .map((block) => {
      const view = describeSegment(reg, state, block.properties);
      return {
        key: String(block.properties.id ?? JSON.stringify(block.properties)),
        layerId: block.layerId,
        properties: block.properties,
        lngLat: block.lngLat,
        paths: block.paths,
        name: view.name,
        score: view.score,
        reason: view.why?.main?.label ?? null,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

/** The same entries, nearest to a point first (by the nearest point of each block's line). */
export function nearestBlocks(entries: BlockEntry[], anchor: LngLat): (BlockEntry & { distance: number })[] {
  return entries
    .map((entry) => ({ ...entry, distance: distanceToPaths(anchor, entry.paths) }))
    .sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key));
}

/** A crash this far from every block drawn is named by no block. */
const NEAR_BLOCK_METERS = 40;

/** The crashes drawn in view, newest and most serious first, each with its nearest block drawn. */
export function crashEntries(crashes: CrashInView[], blocks: BlockEntry[]): CrashEntry[] {
  return crashes
    .map((crash) => {
      let near: string | null = null;
      let best = NEAR_BLOCK_METERS;
      for (const block of blocks) {
        const d = distanceToPaths(crash.lngLat, block.paths);
        if (d <= best && block.name) {
          best = d;
          near = block.name;
        }
      }
      return {
        key: String(crash.properties.id ?? JSON.stringify(crash.properties)),
        layerId: crash.layerId,
        properties: crash.properties,
        lngLat: crash.lngLat,
        crash: describeCrash(crash.properties),
        near,
      };
    })
    .sort(
      (a, b) =>
        Number(b.properties.y ?? 0) - Number(a.properties.y ?? 0) ||
        Number(b.properties.sev ?? 0) - Number(a.properties.sev ?? 0) ||
        a.key.localeCompare(b.key),
    );
}
