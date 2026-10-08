// The street blocks and crashes drawn on the map, as lists (src/streets/blocks.ts, issue #26).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { explainScore, wholeScore } from '../src/map/lens.ts';
import { defaultState } from '../src/state/defaults.ts';
import {
  blockEntries,
  crashEntries,
  distanceToPaths,
  linePaths,
  nearestBlocks,
  pointOnPaths,
  type CrashInView,
  type LineInView,
} from '../src/streets/blocks.ts';

const reg = loadRegistry();
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
const SEGMENTS = (read('../fixtures/data/tiles/streets.segments.geojson').features as Feature[]).map(
  (f): LineInView => ({ layerId: 'segments', properties: f.properties, paths: linePaths(f.geometry), lngLat: pointOnPaths(linePaths(f.geometry)) }),
);
const CRASHES = (read('../fixtures/data/tiles/streets.crashes.geojson').features as Feature[]).map(
  (f): CrashInView => ({ layerId: 'crashes', properties: f.properties, lngLat: f.geometry.coordinates as [number, number] }),
);

describe('lines', () => {
  it('reads the pieces of a line', () => {
    expect(linePaths({ type: 'LineString', coordinates: [[0, 0], [1, 1]] })).toEqual([[[0, 0], [1, 1]]]);
    expect(linePaths({ type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] })).toHaveLength(2);
    expect(linePaths({ type: 'Point', coordinates: [0, 0] })).toEqual([]);
  });

  it('finds the point halfway along the longest piece', () => {
    const [lng, lat] = pointOnPaths([[[-75.16, 39.98], [-75.15, 39.98], [-75.14, 39.98]], [[-75.1, 39.9], [-75.1, 39.9001]]]);
    expect(lng).toBeCloseTo(-75.15, 6);
    expect(lat).toBeCloseTo(39.98, 6);
  });

  it('measures from a point to the nearest point of a line', () => {
    const line = [[[-75.16, 39.98], [-75.15, 39.98]]] as [number, number][][];
    // 0.0001 degrees of latitude is about 11 meters.
    expect(distanceToPaths([-75.155, 39.9801], line)).toBeCloseTo(11.06, 1);
    expect(distanceToPaths([-75.155, 39.98], line)).toBeCloseTo(0, 6);
    // Past the end of the line, the end is the nearest point.
    expect(distanceToPaths([-75.149, 39.98], line)).toBeGreaterThan(80);
  });
});

describe('street blocks in view', () => {
  const state = defaultState(reg, 'analysis');
  const entries = blockEntries(reg, state, SEGMENTS);

  it('lists every block once, highest street safety priority first, with the main reason', () => {
    expect(entries).toHaveLength(SEGMENTS.length);
    const scores = entries.map((e) => e.score ?? -1);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const lens = reg.lenses.find((l) => l.applies_to === 'segment')!;
    for (const entry of entries) {
      const why = explainScore(lens, state.weights[lens.id], entry.properties);
      // The same whole number and main reason as the block's details.
      expect(entry.score).toBe(wholeScore(why.score));
      expect(entry.reason).toBe(why.main?.label ?? null);
    }
    expect(entries[0]!.name).toMatch(/^Sample \d+ St$/);
  });

  it('lists the nearest blocks first, by the nearest point of each line', () => {
    const near = nearestBlocks(entries, [-75.155, 39.98447]);
    expect(near[0]!.distance).toBeLessThan(5);
    const distances = near.map((e) => e.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('follows the lens weights, as the map does', () => {
    const weights = { ...state.weights };
    weights.street_safety = { high_injury_network: 0, walking_cycling_harm: 0, recent_death: 0, school_nearby: 5 };
    const schools = blockEntries(reg, { ...state, weights }, SEGMENTS);
    for (const entry of schools) if (entry.score) expect(entry.reason).toBe('School within 400 meters');
  });
});

describe('crashes in view', () => {
  const blocks = blockEntries(reg, defaultState(reg, 'analysis'), SEGMENTS);
  const entries = crashEntries(CRASHES, blocks);

  it('lists every crash, newest and most serious first, in the words of its details', () => {
    expect(entries).toHaveLength(CRASHES.length);
    const years = entries.map((e) => Number(e.properties.y));
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(entries[0]!.crash.year).toBe(String(years[0]));
    expect(entries[0]!.crash.severity).toMatch(/^Someone was|^No one was/);
  });

  it('names the nearest block drawn, and none when no block is near', () => {
    expect(entries.some((e) => e.near !== null)).toBe(true);
    for (const entry of entries.filter((e) => e.near !== null)) {
      const nearest = Math.min(...blocks.map((b) => distanceToPaths(entry.lngLat, b.paths)));
      expect(nearest).toBeLessThanOrEqual(40);
    }
    expect(crashEntries(CRASHES.slice(0, 3), [])).toEqual(expect.arrayContaining([expect.objectContaining({ near: null })]));
  });
});
