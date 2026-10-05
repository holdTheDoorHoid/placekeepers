// Heat, trees and the floodplain (M3.1): the three context layers' styles put each setting into
// effect, their legends follow the settings, a tapped tree reads plainly, and the two heat
// suggestions carry the displacement caution of docs/ETHICS.md wherever greening is listed.

import { readFileSync } from 'node:fs';
import { featureFilter } from '@maplibre/maplibre-gl-style-spec';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import PlaceCard from '../src/components/places/PlaceCard.svelte';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import { isGreening } from '../src/config/suggestions.ts';
import { styleFor } from '../src/map/styles/index.ts';
import type { LegendEntry } from '../src/map/styles/types.ts';
import { nearestPlaces } from '../src/places/rank.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { strings } from '../src/strings.ts';

const reg = loadRegistry();
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const CAUTION = 'Greening can raise nearby prices. Consider pairing it with protections.';

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

function parts(id: string, state: AppState) {
  const layer = layerOf(id);
  return styleFor(layer)!.layers({ layer, registry: reg, state, sourceId: 'tiles', sourceLayer: layer.source_layer });
}

function legend(id: string, state: AppState): LegendEntry[] {
  const layer = layerOf(id);
  return styleFor(layer)!.legend({ layer, registry: reg, state });
}

/** Whether a part's filter lets a feature with these properties through. */
function passes(part: unknown, properties: Record<string, unknown>, type = 1): boolean {
  const filter = (part as { filter?: unknown }).filter;
  if (filter === undefined) return true;
  return featureFilter(filter as never).filter({ zoom: 15 } as never, { type, properties } as never);
}

describe('the three layers of heat, trees and the floodplain', () => {
  it('belong to their own group, are off by default and credit their sources', () => {
    for (const id of ['heat_tracts', 'city_trees', 'floodplain']) {
      const layer = layerOf(id);
      expect(layer.group).toBe('heat');
      expect(layer.default).toEqual({ field: false, analysis: false });
    }
    expect(layerOf('heat_tracts').sources).toEqual(['heat_vulnerability']);
    expect(layerOf('city_trees').sources).toEqual(['street_trees']);
    expect(layerOf('floodplain').sources).toEqual(['fema_floodplain']);
  });
});

describe('heat vulnerability by tract', () => {
  const fill = (state: AppState) => parts('heat_tracts', state).find((p) => p.id.endsWith(':fill')) as { paint: Record<string, unknown>; filter: unknown };

  it('shades by the measure chosen in the settings', () => {
    const state = defaultState(reg, 'analysis');
    expect(JSON.stringify(fill(state).paint['fill-color'])).toContain('"hv"');
    state.settings.heat_tracts!.measure = 'exposure';
    expect(JSON.stringify(fill(state).paint['fill-color'])).toContain('"he"');
    state.settings.heat_tracts!.measure = 'sensitivity';
    expect(JSON.stringify(fill(state).paint['fill-color'])).toContain('"hs"');
    // A tract the index does not report stays clear.
    expect(passes(fill(state), { id: '1' }, 3)).toBe(false);
    expect(passes(fill(state), { id: '1', hs: 2 }, 3)).toBe(true);
  });

  it('outlines the tracts the City rates very high, until that setting is off', () => {
    const state = defaultState(reg, 'analysis');
    const outline = () => parts('heat_tracts', state).find((p) => p.id.endsWith(':priority'));
    expect(outline()).toBeDefined();
    expect(passes(outline()!, { vh: 1 }, 3)).toBe(true);
    expect(passes(outline()!, { hv: 5 }, 3)).toBe(false);
    expect(legend('heat_tracts', state).some((e) => e.kind === 'line')).toBe(true);
    state.settings.heat_tracts!.priority = false;
    expect(outline()).toBeUndefined();
    expect(legend('heat_tracts', state).some((e) => e.kind === 'line')).toBe(false);
  });

  it('names the fifths in the legend for the measure shown', () => {
    const state = defaultState(reg, 'analysis');
    state.settings.heat_tracts!.measure = 'exposure';
    const bins = legend('heat_tracts', state).find((e) => e.kind === 'bins');
    expect(bins && bins.kind === 'bins' && bins.bins.map((b) => b.label)).toEqual(strings.heat.fifths.exposure);
  });
});

describe('the City trees', () => {
  const dot = (state: AppState) => parts('city_trees', state).find((p) => p.id.endsWith(':dot'))!;

  it('appear only close in', () => {
    expect((dot(defaultState(reg, 'field')) as { minzoom?: number }).minzoom).toBe(14);
  });

  it('show every tree, big shade trees, or small trees, as chosen', () => {
    const state = defaultState(reg, 'field');
    const big = { d: 20 };
    const small = { d: 2 };
    const unknown = {};
    expect([big, small, unknown].map((p) => passes(dot(state), p))).toEqual([true, true, true]);
    state.settings.city_trees!.show = 'big';
    expect([big, small, unknown].map((p) => passes(dot(state), p))).toEqual([true, false, false]);
    expect(legend('city_trees', state).filter((e) => e.kind === 'circle')).toHaveLength(1);
    state.settings.city_trees!.show = 'small';
    expect([big, small, unknown].map((p) => passes(dot(state), p))).toEqual([false, true, false]);
  });

  it('say what a tapped tree is, how big, and that a young one needs water', () => {
    const store = { registry: reg, state: defaultState(reg, 'field') } as unknown as AppStore;
    const target = { layerId: 'city_trees', features: [{ sp: 'Red Maple', d: 2 }, { d: 18 }], lngLat: [-75.15, 39.98] as [number, number] };
    const text = textOf(render(FeatureDetails, { props: { store, target, heading: strings.streets.detailsTitle('city_trees') } }).body);
    expect(text).toContain('Tree');
    expect(text).toContain('Red Maple');
    expect(text).toContain(strings.heat.treeTrunk(2));
    expect(text).toContain(strings.heat.treeUnnamed);
    expect(text).toContain(strings.heat.treeYoung);
    expect(text).toContain(strings.heat.treesHere(2));
  });
});

describe('the floodplain', () => {
  it('shows both areas, or the 1 percent annual chance floodplain only', () => {
    const state = defaultState(reg, 'analysis');
    const fill = () => parts('floodplain', state).find((p) => p.id.endsWith(':fill'))!;
    expect(passes(fill(), { z: 1 }, 3)).toBe(true);
    expect(passes(fill(), { z: 2 }, 3)).toBe(true);
    expect(legend('floodplain', state).filter((e) => e.kind === 'swatch')).toHaveLength(3);
    state.settings.floodplain!.zones = 'high';
    expect(passes(fill(), { z: 1, fw: 1 }, 3)).toBe(true);
    expect(passes(fill(), { z: 2 }, 3)).toBe(false);
    expect(legend('floodplain', state).filter((e) => e.kind === 'swatch')).toHaveLength(2);
  });
});

describe('the heat suggestions', () => {
  it('are greening, so they carry the caution of docs/ETHICS.md', () => {
    expect(isGreening('plant_shade_trees')).toBe(true);
    expect(isGreening('cool_green_lot')).toBe(true);
    for (const id of ['plant_shade_trees', 'cool_green_lot']) {
      const suggestion = reg.suggestions.find((s) => s.id === id)!;
      expect(suggestion.applies_to).toBe('parcel');
      expect(suggestion.routes[0]).toBe('land_bank_garden_agreement');
    }
  });

  it('show the caution on a nearby card that leads with one of them', () => {
    const PARCELS = read('../fixtures/sources/parcels.geojson').features as { properties: Record<string, unknown> }[];
    const state = defaultState(reg, 'field');
    state.suggestions.clean_and_green = false;
    const places = PARCELS.map((f) => ({ id: String(f.properties.id), properties: f.properties, center: [-75.155, 39.985] as [number, number] }));
    const nearby = nearestPlaces(reg, state, places, [-75.155, 39.985]);
    const heat = nearby.find((p) => p.suggestions[0]?.id === 'plant_shade_trees' || p.suggestions[0]?.id === 'cool_green_lot');
    expect(heat).toBeDefined();
    const store = {
      registry: reg,
      state,
      addresses: { get: () => null },
      lists: { active: null, has: () => false },
      inspected: null,
    } as unknown as AppStore;
    const card = textOf(render(PlaceCard, { props: { store, place: heat!, lensLabel: 'Heat and shade', fromYou: false } }).body);
    expect(card).toContain(CAUTION);
  });
});
