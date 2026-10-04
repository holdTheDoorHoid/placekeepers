import { createPropertyExpression, featureFilter, validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { STYLE_IDS } from '../src/map/styles/ids.ts';
import { STYLES, styleFor } from '../src/map/styles/index.ts';
import { restyleBase } from '../src/map/styles/basemap.ts';
import { COUNT_BINS, HIN_COLOR, PLAIN_BACKGROUND, PRIORITY_RAMP } from '../src/map/styles/palette.ts';
import { WINDOWS } from '../src/map/styles/shootings_hex.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import { collectStrings, strings } from '../src/strings.ts';

const reg = loadRegistry();

function states(): AppState[] {
  const plain = defaultState(reg, 'analysis');
  const busy = defaultState(reg, 'analysis');
  busy.settings.vacant_parcels = { min_confidence: '3', kinds: 'buildings' };
  busy.settings.shootings_hex = { window: 'm36' };
  busy.weights.violence = { untreated_vacancy: 0, shootings_nearby: 5, poverty: 0, canopy_gap: 0 };
  busy.filters.owner_type = ['3', '4'];
  busy.selected = '990000012';
  busy.settings.crashes = { years: 'all', severity: '0', mode: 'walk_cycle' };
  busy.settings.memorials = { show_names: false, all_fatal: true };
  busy.settings.segments = { min_score: '60' };
  busy.weights.street_safety = { high_injury_network: 0, walking_cycling_harm: 5, recent_death: 1, school_nearby: 0 };
  const off = defaultState(reg, 'field');
  off.weights.violence = { untreated_vacancy: 0, shootings_nearby: 0, poverty: 0, canopy_gap: 0 };
  off.weights.street_safety = { high_injury_network: 0, walking_cycling_harm: 0, recent_death: 0, school_nearby: 0 };
  off.filters.owner_type = [];
  return [plain, busy, off];
}

function validate(layers: unknown[]): string[] {
  const style = {
    version: 8,
    // The base map's labels and icons need fonts and a sprite, as the real base map has.
    glyphs: 'https://example.test/data/basemap/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://example.test/data/basemap/sprites/v4/light',
    sources: {
      tiles: { type: 'vector', url: 'pmtiles://https://example.test/data/tiles/lots.pmtiles' },
      json: { type: 'geojson', data: 'https://example.test/data/geojson/hin.geojson' },
    },
    layers,
  };
  return validateStyleMin(style as never).map((e) => e.message);
}

describe('map styles', () => {
  it('implement every style id the registry may name', () => {
    expect(Object.keys(STYLES).sort()).toEqual([...STYLE_IDS].sort());
  });

  it('give every registry layer a style', () => {
    for (const layer of reg.layers) expect(styleFor(layer), layer.id).not.toBeNull();
  });

  it('put every registry setting of a layer into effect', () => {
    for (const layer of reg.layers) {
      const style = styleFor(layer)!;
      for (const setting of layer.settings) expect(style.settings, `${layer.id}.${setting.id}`).toContain(setting.id);
    }
  });

  it('produce valid MapLibre layers for tiles and for GeoJSON, in every state', () => {
    for (const state of states()) {
      for (const layer of reg.layers) {
        const style = styleFor(layer)!;
        const tiles = style.layers({ layer, registry: reg, state, sourceId: 'tiles', sourceLayer: layer.source_layer });
        if (style.base) {
          // The base map restyles its own layers, named as in its file, and is only ever tiles.
          expect(validate(tiles), `${layer.id} as tiles`).toEqual([]);
          continue;
        }
        const json = style.layers({ layer, registry: reg, state, sourceId: 'json', sourceLayer: null });
        expect(validate(tiles), `${layer.id} as tiles`).toEqual([]);
        expect(validate(json), `${layer.id} as GeoJSON`).toEqual([]);
        expect(json.every((l) => !('source-layer' in l)), 'GeoJSON layers have no source-layer').toBe(true);
        expect(tiles.every((l) => l.id.startsWith(`pk:${layer.id}:`))).toBe(true);
      }
    }
  });

  it('give every layer a legend', () => {
    for (const state of states()) {
      for (const layer of reg.layers) {
        expect(styleFor(layer)!.legend({ layer, registry: reg, state }).length, layer.id).toBeGreaterThan(0);
      }
    }
  });
});

describe('vacant parcels style', () => {
  const layer = reg.layers.find((l) => l.style === 'vacant_parcels')!;
  const parts = (state: AppState) =>
    styleFor(layer)!.layers({ layer, registry: reg, state, sourceId: 'tiles', sourceLayer: 'parcels' });

  function shown(state: AppState, properties: Record<string, unknown>): boolean {
    const fill = parts(state).find((l) => l.id.endsWith(':fill'))!;
    const filter = featureFilter((fill as { filter: unknown }).filter as never);
    return filter.filter({ zoom: 15 } as never, { type: 3, properties } as never);
  }

  it('hides parcels below the chosen confidence and of the other kind', () => {
    const state = defaultState(reg, 'field');
    expect(shown(state, { vc: 2, k: 1, ot: 1 })).toBe(true);
    expect(shown(state, { vc: 1, k: 1, ot: 1 })).toBe(false);
    state.settings.vacant_parcels!.min_confidence = '1';
    expect(shown(state, { vc: 1, k: 1, ot: 1 })).toBe(true);
    state.settings.vacant_parcels!.kinds = 'buildings';
    expect(shown(state, { vc: 3, k: 1, ot: 1 })).toBe(false);
    expect(shown(state, { vc: 3, k: 2, ot: 1 })).toBe(true);
  });

  it('applies the owner type filter, and shows nothing when no type is chosen', () => {
    const state = defaultState(reg, 'analysis');
    state.filters.owner_type = ['3', '4'];
    expect(shown(state, { vc: 3, k: 1, ot: 4 })).toBe(true);
    expect(shown(state, { vc: 3, k: 1, ot: 1 })).toBe(false);
    state.filters.owner_type = [];
    expect(shown(state, { vc: 3, k: 1, ot: 4 })).toBe(false);
  });

  it('applies the LandCare and first step filters by their tile properties', () => {
    const state = defaultState(reg, 'analysis');
    state.filters.landcare = ['0'];
    expect(shown(state, { vc: 3, k: 1, ot: 1, lc: 0, rt: 5 })).toBe(true);
    expect(shown(state, { vc: 3, k: 1, ot: 1, lc: 1, rt: 1 })).toBe(false);
    state.filters.landcare = ['0', '1'];
    state.filters.first_step = ['2', '3'];
    expect(shown(state, { vc: 3, k: 1, ot: 4, lc: 0, rt: 2 })).toBe(true);
    expect(shown(state, { vc: 3, k: 1, ot: 1, lc: 0, rt: 5 })).toBe(false);
    // Tiles from before rt existed are hidden only while the filter narrows.
    expect(shown(state, { vc: 3, k: 1, ot: 1, lc: 0 })).toBe(false);
    state.filters.first_step = ['0', '1', '2', '3', '4', '5'];
    expect(shown(state, { vc: 3, k: 1, ot: 1, lc: 0 })).toBe(true);
  });

  it('recolors with the lens weights alone (a paint change, not a data change)', () => {
    const a = defaultState(reg, 'analysis');
    const b = defaultState(reg, 'analysis');
    b.weights.violence!.poverty = 5;
    const fa = parts(a).find((l) => l.id.endsWith(':fill')) as { paint: Record<string, unknown>; filter: unknown };
    const fb = parts(b).find((l) => l.id.endsWith(':fill')) as { paint: Record<string, unknown>; filter: unknown };
    expect(fa.filter).toEqual(fb.filter);
    expect(fa.paint['fill-color']).not.toEqual(fb.paint['fill-color']);
    const color = createPropertyExpression(fb.paint['fill-color'], { type: 'color', 'property-type': 'data-driven', expression: { interpolated: true, parameters: ['zoom', 'feature'] } } as never);
    expect(color.result).toBe('success');
  });

  it('uses one flat color when every weight is off', () => {
    const state = states()[2]!;
    const fill = parts(state).find((l) => l.id.endsWith(':fill')) as { paint: Record<string, unknown> };
    expect(fill.paint['fill-color']).toBe(PRIORITY_RAMP.allOff);
  });
});

describe('shootings style', () => {
  const layer = reg.layers.find((l) => l.style === 'shootings_hex')!;

  it('has a count property for every time window option in the registry', () => {
    const setting = layer.settings.find((s) => s.id === 'window');
    expect(setting?.type).toBe('choice');
    if (setting?.type === 'choice') for (const option of setting.options) expect(WINDOWS[option.value], option.value).toBeDefined();
  });

  it('uses no reds and labels its classes in plain numbers', () => {
    for (const color of [...COUNT_BINS, HIN_COLOR, ...PRIORITY_RAMP.stops]) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const alarmRed = r > 180 && g < 90 && b < 90;
      expect(alarmRed, color).toBe(false);
    }
    const state = defaultState(reg, 'analysis');
    const legend = styleFor(layer)!.legend({ layer, registry: reg, state });
    const bins = legend.find((e) => e.kind === 'bins');
    expect(bins && bins.kind === 'bins' && bins.bins.map((b) => b.label)).toEqual(['1', '2', '3 to 4', '5 to 7', '8 or more']);
  });
});

describe('interface text', () => {
  it('never uses a dash as punctuation', () => {
    const offenders = collectStrings(strings).filter(([, text]) => /[‒–—―]|\s-\s|\s--?\s/.test(text));
    expect(offenders).toEqual([]);
  });
});

describe('base map style', () => {
  const layer = reg.layers.find((l) => l.style === 'basemap')!;
  const draw = (state: AppState) => styleFor(layer)!.layers({ layer, registry: reg, state, sourceId: 'protomaps', sourceLayer: null });
  const visibility = (spec: { layout?: Record<string, unknown> }) => spec.layout?.visibility;

  it('is a registry layer with a switch and a look, on in both views', () => {
    expect(layer.group).toBe('basemap');
    expect(layer.default).toEqual({ field: true, analysis: true });
    expect(layer.settings.map((s) => s.id)).toEqual(['look']);
  });

  it('turns gray for the muted look, hiding what the gray look does not draw', () => {
    const light = draw(defaultState(reg, 'analysis'));
    const state = defaultState(reg, 'analysis');
    state.settings.basemap!.look = 'muted';
    const muted = draw(state);
    expect(muted.map((l) => l.id)).toEqual(light.map((l) => l.id));
    const roads = (specs: typeof light) => specs.find((l) => l.id === 'roads_major') as { paint: unknown };
    expect(roads(muted).paint).not.toEqual(roads(light).paint);
    expect(visibility(muted.find((l) => l.id === 'pois')!)).toBe('none');
    expect(light.every((l) => visibility(l) === 'visible')).toBe(true);
  });

  it('leaves only a plain background when turned off', () => {
    const state = defaultState(reg, 'analysis');
    state.layers = state.layers.filter((id) => id !== 'basemap');
    const off = draw(state);
    expect(off.filter((l) => visibility(l) === 'visible').map((l) => l.id)).toEqual(['background']);
    expect((off.find((l) => l.id === 'background') as { paint: Record<string, unknown> }).paint['background-color']).toBe(PLAIN_BACKGROUND);
  });

  it('can only show or hide a base map that is not the Protomaps extract', () => {
    const plain = [{ id: 'pk:background', type: 'background', paint: { 'background-color': '#eee' } }, { id: 'water', type: 'fill', source: 'x', 'source-layer': 'water', paint: { 'fill-color': '#00f' } }] as never[];
    expect(restyleBase(plain, 'muted', true, false).map((l) => (l as { paint: unknown }).paint)).toEqual([{ 'background-color': '#eee' }, { 'fill-color': '#00f' }]);
    expect(restyleBase(plain, 'light', false, false).map((l) => visibility(l))).toEqual(['visible', 'none']);
  });
});
