// Zoomed out, the lots tiles hold only a light sample of the parcels (docs/CONTRACTS.md section 4,
// issue #26). Counts, lists, the plot and downloads are built from what the map draws, so the views
// must never present that sample as everything (src/places/sample.ts).

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import AreaSummary from '../src/components/places/AreaSummary.svelte';
import ExportButtons from '../src/components/places/ExportButtons.svelte';
import { LOTS_DETAIL_ZOOM, isSample, isSampleFeature } from '../src/places/sample.ts';
import { rankPlaces } from '../src/places/rank.ts';
import { defaultState } from '../src/state/defaults.ts';
import { AppStore } from '../src/state/store.svelte.ts';
import { strings } from '../src/strings.ts';

// The download buttons read the site's address when they load, as they do in a browser. Vitest runs
// this before the imports above.
vi.hoisted(() => {
  const scope = globalThis as unknown as { window?: unknown };
  scope.window ??= { location: { href: 'https://example.org/placekeepers/' } };
});

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const reg = loadRegistry();
const full = { properties: { id: '990000005', k: 1, vc: 3 } };
const light = { properties: { id: '990000005', k: 1, vc: 3, lo: 1 } };

describe('telling the zoomed out sample from every parcel', () => {
  it('counts the view as a sample below zoom 13, or when any parcel in it is from the sample', () => {
    expect(LOTS_DETAIL_ZOOM).toBe(13);
    expect(isSample(12.99, [full])).toBe(true);
    expect(isSample(12, [])).toBe(true);
    expect(isSample(13, [full])).toBe(false);
    expect(isSample(16, [])).toBe(false);
    // Just after zooming in, the map can still show the sample while the detailed tiles load.
    expect(isSample(13.5, [full, light])).toBe(true);
    expect(isSampleFeature({ lo: 1 })).toBe(true);
    expect(isSampleFeature({ lo: '1' })).toBe(true);
    expect(isSampleFeature({ k: 1 })).toBe(false);
  });

  it('uses the same zoom as the contract and the pipeline that makes the tiles', () => {
    expect(read('../../docs/CONTRACTS.md')).toMatch(new RegExp(`from zoom ${LOTS_DETAIL_ZOOM} up it holds every parcel`));
    expect(read('../../pipeline/src/placekeepers/publish/tiles.py')).toMatch(new RegExp(`^LOTS_DETAIL_ZOOM = ${LOTS_DETAIL_ZOOM}$`, 'm'));
  });

  it('follows the map in the app state: zoom and the parcels drawn', () => {
    const store = new AppStore(reg, { state: defaultState(reg, 'analysis'), viewPinned: true }, { listStorage: null });
    store.state.map = { ...store.state.map, zoom: 15 };
    store.parcelsInView = [{ id: '990000005', properties: full.properties, center: [-75.15572, 39.98513] }];
    expect(store.parcelsSampled).toBe(false);
    store.state.map = { ...store.state.map, zoom: 12.4 };
    expect(store.parcelsSampled).toBe(true);
    store.state.map = { ...store.state.map, zoom: 14 };
    store.parcelsInView = [{ id: '990000005', properties: light.properties, center: [-75.15572, 39.98513] }];
    expect(store.parcelsSampled).toBe(true);
  });

  it('builds the sample data the same way: one point on each parcel, marked, without the lot page fields', () => {
    const shapes = JSON.parse(read('../fixtures/sources/parcels.geojson')).features as { properties: Record<string, unknown>; geometry: { coordinates: number[][][] } }[];
    const points = JSON.parse(read('../fixtures/sources/parcels.lowzoom.geojson')).features as { properties: Record<string, unknown>; geometry: { type: string; coordinates: [number, number] } }[];
    expect(points.map((p) => p.properties.id)).toEqual(shapes.map((s) => s.properties.id));
    points.forEach((point, i) => {
      const ring = shapes[i]!.geometry.coordinates[0]!;
      const xs = ring.map((c) => c[0]!);
      const ys = ring.map((c) => c[1]!);
      expect(point.geometry.type).toBe('Point');
      expect(point.geometry.coordinates[0]).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(point.geometry.coordinates[0]).toBeLessThanOrEqual(Math.max(...xs));
      expect(point.geometry.coordinates[1]).toBeGreaterThanOrEqual(Math.min(...ys));
      expect(point.geometry.coordinates[1]).toBeLessThanOrEqual(Math.max(...ys));
      expect(point.properties.lo).toBe(1);
      for (const key of ['rs', 'n', 'dy', 'sy', 'ny']) expect(point.properties).not.toHaveProperty(key);
      for (const key of ['k', 'vc', 'ot', 'lc', 'rt', 'sg']) expect(point.properties[key]).toEqual(shapes[i]!.properties[key]);
    });
  });
});

describe('the analysis view while zoomed out', () => {
  const places = rankPlaces(reg, defaultState(reg, 'analysis'), [{ id: '990000005', properties: { k: 1, vc: 3, f_vacant: 80 }, center: [-75.15572, 39.98513] }]);

  it('does not count a sample in the area summary', () => {
    const counted = render(AreaSummary, { props: { places } }).body;
    expect(counted).toContain(strings.analysis.areaLots(1));
    const zoomedOut = render(AreaSummary, { props: { places, sampled: true } }).body;
    expect(zoomedOut).toContain(strings.analysis.sampleArea);
    expect(zoomedOut).not.toContain(strings.analysis.areaLots(1));
  });

  it('turns downloads off with the reason in plain words', () => {
    const store = { registry: reg, state: defaultState(reg, 'analysis'), manifest: null } as unknown as AppStore;
    const props = { store, places: () => [], title: strings.export.inView, idPrefix: 'test' };
    const on = render(ExportButtons, { props }).body;
    expect(on).not.toMatch(/<button[^>]*disabled/);
    const off = render(ExportButtons, { props: { ...props, off: strings.export.sampleOff } }).body;
    expect(off.match(/<button[^>]*disabled/g)).toHaveLength(2);
    expect(off).toContain(strings.export.sampleOff);
    expect(off).not.toContain(strings.export.help(500));
  });
});
