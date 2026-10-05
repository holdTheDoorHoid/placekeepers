// Walking, cycling and people (M3.3): the three layers' styles put each setting into effect,
// their legends follow the settings and say how things were measured, and a tapped street reads
// plainly.

import { Color, createPropertyExpression, featureFilter } from '@maplibre/maplibre-gl-style-spec';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import { styleFor } from '../src/map/styles/index.ts';
import { REACH_BINS, STRESS_COLORS, WALK_BINS, WALK_NATION_BINS } from '../src/map/styles/palette.ts';
import type { LegendEntry } from '../src/map/styles/types.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { strings } from '../src/strings.ts';
import { describeStress } from '../src/walk/describe.ts';

const reg = loadRegistry();
const w = strings.walk;

function textOf(markup: string): string {
  return markup
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function layerOf(id: string) {
  const layer = reg.layers.find((l) => l.id === id);
  if (!layer) throw new Error(`no layer ${id}`);
  return layer;
}

type Part = { id: string; filter?: unknown; paint: Record<string, unknown>; layout?: Record<string, unknown> };

function parts(id: string, state: AppState): Part[] {
  const layer = layerOf(id);
  return styleFor(layer)!.layers({ layer, registry: reg, state, sourceId: 'tiles', sourceLayer: layer.source_layer }) as unknown as Part[];
}

function part(id: string, state: AppState, name: string): Part {
  const found = parts(id, state).find((p) => p.id === `pk:${id}:${name}`);
  if (!found) throw new Error(`no part ${name} of ${id}`);
  return found;
}

function legend(id: string, state: AppState): LegendEntry[] {
  const layer = layerOf(id);
  return styleFor(layer)!.legend({ layer, registry: reg, state });
}

function bins(entries: LegendEntry[]) {
  const found = entries.find((e) => e.kind === 'bins');
  if (!found || found.kind !== 'bins') throw new Error('no bins in the legend');
  return found;
}

function notes(entries: LegendEntry[]): string[] {
  return entries.flatMap((e) => (e.kind === 'note' ? [e.text] : []));
}

/** Whether a part's filter lets a feature with these properties through. */
function passes(p: Part, properties: Record<string, unknown>, type = 3): boolean {
  if (p.filter === undefined) return true;
  return featureFilter(p.filter as never).filter({ zoom: 15 } as never, { type, properties } as never);
}

/** The color a part's paint property gives a feature. */
function colorOf(p: Part, key: string, properties: Record<string, unknown>): string {
  const spec = { type: 'color', 'property-type': 'data-driven', expression: { interpolated: true, parameters: ['zoom', 'feature'] } };
  const compiled = createPropertyExpression(p.paint[key] as never, spec as never);
  if (compiled.result !== 'success') throw new Error(`cannot compile ${key}`);
  return String(compiled.value.evaluate({ zoom: 15 } as never, { type: 3, properties } as never));
}

const same = (hex: string) => String(Color.parse(hex));

describe('the three walking layers', () => {
  it('belong to their own group, are off by default and credit their sources', () => {
    for (const id of ['walkability', 'walking_distance', 'traffic_stress']) {
      const layer = layerOf(id);
      expect(layer.group).toBe('walking');
      expect(layer.default).toEqual({ field: false, analysis: false });
    }
    expect(layerOf('walkability').sources).toEqual(['epa_walkability', 'census_tracts_2020', 'land_use']);
    expect(layerOf('walking_distance').sources).toContain('census_blocks_2020');
    expect(layerOf('walking_distance').sources).toContain('snap_retailers');
    expect(layerOf('traffic_stress').sources).toEqual(['dvrpc_lts']);
    expect(reg.groups.find((g) => g.id === 'walking')?.label).toBe('Walking, cycling and people');
  });

  it('credit DVRPC under its own data license, and the EPA and the Census Bureau as public domain', () => {
    const license = (sourceId: string) => reg.sources.find((s) => s.id === sourceId)?.license;
    expect(license('dvrpc_lts')).toBe('dvrpc_data_license');
    expect(license('epa_walkability')).toBe('public_domain');
    expect(license('census_blocks_2020')).toBe('public_domain');
    expect(license('snap_retailers')).toBe('public_domain');
    expect(reg.licenses.find((l) => l.id === 'dvrpc_data_license')?.url).toBe('https://catalog.dvrpc.org/dvrpc_data_license.html');
  });
});

describe('walkability by block group', () => {
  const fill = (state: AppState) => part('walkability', state, 'fill');

  it('compares within the city by fifths, for the index or one of its parts', () => {
    const state = defaultState(reg, 'analysis');
    const area = { qw: 5, qc: 1, qt: 3, qm: 2, nw: 3, rc: 4, rt: 20, rj: 1, rh: 2 };
    expect(colorOf(fill(state), 'fill-color', area)).toBe(same(WALK_BINS[4]));
    state.settings.walkability!.measure = 'corners';
    expect(colorOf(fill(state), 'fill-color', area)).toBe(same(WALK_BINS[0]));
    state.settings.walkability!.measure = 'transit';
    expect(colorOf(fill(state), 'fill-color', area)).toBe(same(WALK_BINS[2]));
    state.settings.walkability!.measure = 'mix';
    expect(colorOf(fill(state), 'fill-color', area)).toBe(same(WALK_BINS[1]));
    // An area without the measure stays clear.
    expect(passes(fill(state), { qw: 3 })).toBe(false);
    expect(passes(fill(state), { qm: 4 })).toBe(true);
  });

  it('compares with the whole country by the EPA classes of the index, and national fifths of a part', () => {
    const state = defaultState(reg, 'analysis');
    state.settings.walkability!.compare = 'nation';
    const area = { qw: 1, nw: 3, rc: 17, rt: 4, rj: 9, rh: 10 };
    expect(colorOf(fill(state), 'fill-color', area)).toBe(same(WALK_NATION_BINS[2]));
    state.settings.walkability!.measure = 'corners';
    expect(colorOf(fill(state), 'fill-color', area)).toBe(same(WALK_BINS[4])); // rank 17 to 20: top fifth
    state.settings.walkability!.measure = 'transit';
    expect(colorOf(fill(state), 'fill-color', area)).toBe(same(WALK_BINS[0])); // rank 1 to 4: bottom fifth
    state.settings.walkability!.measure = 'mix';
    expect(colorOf(fill(state), 'fill-color', area)).toBe(same(WALK_BINS[2])); // ranks 9 and 10: middle
  });

  it('names its classes and says how it compares in the legend', () => {
    const state = defaultState(reg, 'analysis');
    let entries = legend('walkability', state);
    expect(bins(entries).title).toBe(w.walkTitle.index);
    expect(bins(entries).bins.map((b) => b.label)).toEqual(w.walkFifths.index);
    expect(notes(entries)).toContain(w.walkCompared.city);
    expect(notes(entries)).not.toContain(w.walkNationNote);
    state.settings.walkability!.compare = 'nation';
    entries = legend('walkability', state);
    expect(bins(entries).bins.map((b) => b.label)).toEqual(w.walkClasses);
    expect(bins(entries).bins.map((b) => b.color)).toEqual([...WALK_NATION_BINS]);
    expect(notes(entries)).toContain(w.walkNationNote);
    state.settings.walkability!.measure = 'transit';
    entries = legend('walkability', state);
    expect(bins(entries).title).toBe(w.walkTitle.transit);
    expect(bins(entries).bins.map((b) => b.label)).toEqual(w.walkNationFifths);
    expect(notes(entries)).toContain(w.walkSource);
  });
});

describe('people and places within walking distance', () => {
  const fill = (state: AppState) => part('walking_distance', state, 'fill');

  it('shades hexagons by people, kinds of places or corners, in fixed classes', () => {
    const state = defaultState(reg, 'analysis');
    const cell = { p: 4500, d: 3, k: 80 };
    expect(colorOf(fill(state), 'fill-color', cell)).toBe(same(REACH_BINS[3]));
    expect(colorOf(fill(state), 'fill-color', { p: 999, d: 7, k: 0 })).toBe(same(REACH_BINS[0]));
    expect(colorOf(fill(state), 'fill-color', { p: 6000, d: 7, k: 0 })).toBe(same(REACH_BINS[4]));
    state.settings.walking_distance!.measure = 'places';
    expect(colorOf(fill(state), 'fill-color', cell)).toBe(same(REACH_BINS[1]));
    expect(colorOf(fill(state), 'fill-color', { d: 7 })).toBe(same(REACH_BINS[4]));
    state.settings.walking_distance!.measure = 'corners';
    expect(colorOf(fill(state), 'fill-color', cell)).toBe(same(REACH_BINS[4]));
    // A hexagon without the measure stays clear.
    expect(passes(fill(state), { p: 100 })).toBe(false);
  });

  it('lists the seven kinds and how distances were measured in the legend', () => {
    const state = defaultState(reg, 'analysis');
    let entries = legend('walking_distance', state);
    expect(bins(entries).title).toBe(w.reachTitle.people);
    expect(bins(entries).bins.map((b) => b.label)).toEqual(w.reachBins.people);
    expect(notes(entries)).toEqual([w.reachMeasured, w.reachSource.people]);
    state.settings.walking_distance!.measure = 'places';
    entries = legend('walking_distance', state);
    expect(bins(entries).bins.map((b) => b.label)).toEqual(w.reachBins.places);
    expect(notes(entries)[0]).toBe(w.reachKinds);
    expect(w.reachKinds).toContain('grocery store or market that takes SNAP');
    state.settings.walking_distance!.measure = 'corners';
    expect(notes(legend('walking_distance', state))[0]).toBe(w.reachCorners);
  });
});

describe('traffic stress for people on bikes', () => {
  const line = (state: AppState) => part('traffic_stress', state, 'line');

  it('colors each level, never in an alarm red, and shows every level, the stressful or the calm ones', () => {
    const state = defaultState(reg, 'analysis');
    for (const level of [1, 2, 3, 4]) {
      expect(passes(line(state), { l: level }, 2)).toBe(true);
      expect(colorOf(line(state), 'line-color', { l: level })).toBe(same(STRESS_COLORS[level]!));
    }
    // No alarm red: no color is mostly red with little green and blue.
    const alarm = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return r! > 0xb0 && g! < 0x50 && b! < 0x50;
    };
    expect(Object.values(STRESS_COLORS).some(alarm)).toBe(false);
    state.settings.traffic_stress!.show = 'stressful';
    expect([1, 2, 3, 4].map((l) => passes(line(state), { l }, 2))).toEqual([false, false, true, true]);
    expect(legend('traffic_stress', state).filter((e) => e.kind === 'line')).toHaveLength(2);
    expect(notes(legend('traffic_stress', state))).toContain(w.stressShown.stressful);
    state.settings.traffic_stress!.show = 'calm';
    expect([1, 2, 3, 4].map((l) => passes(line(state), { l }, 2))).toEqual([true, true, false, false]);
  });

  it('says that zoomed out it shows only stressful streets and bike lanes', () => {
    const entries = legend('traffic_stress', defaultState(reg, 'analysis'));
    expect(entries.filter((e) => e.kind === 'line').map((e) => (e.kind === 'line' ? e.label : ''))).toEqual([1, 2, 3, 4].map((n) => w.stressLevels[n]));
    expect(notes(entries)).toEqual([w.stressZoom, w.stressSource]);
  });

  it('reads a tapped street plainly', () => {
    expect(describeStress({ l: 3, l2: 2, bf: 3, sp: 30, ln: 2 })).toEqual({
      level: 3,
      title: 'Level 3 of 4',
      meaning: w.stressMeaning[3],
      facts: ['Riding the other way is calmer: level 2.', 'A bike lane.', w.stressSpeed(30), '2 lanes in all.'],
    });
    expect(describeStress({ l: 1 })?.facts).toEqual(['No bike lane.']);
    expect(describeStress({ l: 1, l2: 1, bf: 6 })?.facts).toEqual(['A trail or path away from traffic.']);
    expect(describeStress({ l: 5 })).toBeNull();
    expect(describeStress({})).toBeNull();
  });

  it('opens in the details panel with its level, what it means and where the rating comes from', () => {
    const store = { registry: reg, state: defaultState(reg, 'field') } as unknown as AppStore;
    const target = { layerId: 'traffic_stress', features: [{ id: 1, l: 4, sp: 35, ln: 4 }, { id: 2, l: 1, bf: 5 }], lngLat: [-75.15, 39.98] as [number, number] };
    const heading = strings.streets.detailsTitle('traffic_stress');
    expect(heading).toBe('Traffic stress for bikes');
    const text = textOf(render(FeatureDetails, { props: { store, target, heading } }).body);
    expect(text).toContain('Level 4 of 4');
    expect(text).toContain(w.stressMeaning[4]);
    expect(text).toContain('A protected bike lane.');
    expect(text).toContain(w.streetsHere(2));
    expect(text).toContain(w.stressDetailsSource);
  });

  it('highlights the street someone tapped', () => {
    const layer = layerOf('traffic_stress');
    const specs = styleFor(layer)!.layers({ layer, registry: reg, state: defaultState(reg, 'analysis'), sourceId: 'tiles', sourceLayer: 'stress', highlight: [9101] });
    const selected = specs.find((s) => s.id === 'pk:traffic_stress:selected') as unknown as Part;
    expect(passes(selected, { id: 9101, l: 3 }, 2)).toBe(true);
    expect(passes(selected, { id: 9102, l: 3 }, 2)).toBe(false);
  });
});
