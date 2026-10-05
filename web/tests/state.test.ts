import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import {
  DEFAULT_MAP,
  autoView,
  clampWeight,
  defaultLayers,
  defaultState,
  layersAfterViewSwitch,
  matchingPreset,
  presetWeights,
  type AppState,
} from '../src/state/defaults.ts';
import { PREFS_KEY, readItem, removeItem, storageKey, writeItem, type KeyValueStore } from '../src/state/storage.ts';
import { decodeMap, decodeState, encodeMap, encodeState } from '../src/state/url.ts';

const reg = loadRegistry();
const violence = reg.lenses.find((l) => l.id === 'violence')!;

function customized(): AppState {
  const state = defaultState(reg, 'analysis');
  state.map = { lng: -75.15623, lat: 39.98712, zoom: 15.25, bearing: 0, pitch: 0 };
  state.layers = ['vacant_parcels', 'shootings_hex', 'basemap'];
  state.settings.vacant_parcels!.min_confidence = '3';
  state.settings.vacant_parcels!.kinds = 'lots';
  state.settings.shootings_hex!.window = 'm36';
  state.weights.violence!.poverty = 0;
  state.weights.violence!.canopy_gap = 5;
  state.suggestions.seal_abandoned_building = false;
  state.filters.owner_type = ['3', '4'];
  state.selected = '990000012';
  return state;
}

describe('defaults per view', () => {
  it('turns layers on according to each view in the registry', () => {
    // Drinking water and toilets help a neighbor on foot, so they are on in the field view (M3.5).
    expect(defaultLayers(reg, 'field')).toEqual(['vacant_parcels', 'hin_2025', 'memorials', 'basemap', 'drinking_water', 'toilets', 'park_water']);
    expect(defaultLayers(reg, 'analysis')).toEqual([
      'vacant_parcels',
      'hin_2025',
      'shootings_hex',
      'landcare_lots',
      'gardens',
      'segments',
      'memorials',
      'basemap',
    ]);
  });

  it('follows the registry for every layer, whatever it contains', () => {
    for (const view of ['field', 'analysis'] as const) {
      const on = new Set(defaultState(reg, view).layers);
      for (const layer of reg.layers) expect(on.has(layer.id)).toBe(layer.default[view]);
    }
  });

  it('takes setting defaults, weights and suggestions from the registry', () => {
    const state = defaultState(reg, 'field');
    expect(state.settings.vacant_parcels).toEqual({ min_confidence: '2', kinds: 'both', lens: 'violence' });
    expect(state.settings.shootings_hex).toEqual({ window: 'm12' });
    expect(state.settings.hin_2025).toEqual({});
    expect(state.weights.violence).toEqual({ untreated_vacancy: 3, shootings_nearby: 3, poverty: 2, canopy_gap: 1 });
    expect(state.suggestions).toEqual({
      clean_and_green: true,
      seal_abandoned_building: true,
      plant_shade_trees: true,
      cool_green_lot: true,
      memorial_or_ghost_bike: true,
      traffic_calming_petition: true,
      daylighting_check: true,
      asphalt_art_check: true,
      stop_survey: true,
      stop_shelter_request: true,
      stop_bench_request: true,
      stop_streetlight_report: true,
      stop_shade_trees: true,
    });
    expect(state.settings.memorials).toEqual({ show_names: true, all_fatal: false });
    expect(state.weights.street_safety).toEqual({ high_injury_network: 3, walking_cycling_harm: 3, recent_death: 2, school_nearby: 1 });
    expect(state.weights.transit_comfort).toEqual({
      riders: 3,
      no_shelter: 3,
      no_bench: 2,
      little_shade: 2,
      heat: 1,
      high_injury_network: 2,
      long_wait: 1,
    });
    expect(state.filters.owner_type).toHaveLength(9);
    expect(state.selected).toBeNull();
  });

  it('shares settings between views; only layer visibility differs', () => {
    const field = defaultState(reg, 'field');
    const analysis = defaultState(reg, 'analysis');
    expect(field.settings).toEqual(analysis.settings);
    expect(field.weights).toEqual(analysis.weights);
    expect(field.layers).not.toEqual(analysis.layers);
  });

  it('picks the view by screen width', () => {
    expect(autoView(375)).toBe('field');
    expect(autoView(767)).toBe('field');
    expect(autoView(768)).toBe('analysis');
    expect(autoView(1440)).toBe('analysis');
  });

  it('gives a phone turned sideways the field view, but not a short computer window', () => {
    expect(autoView(812, 375, true)).toBe('field');
    expect(autoView(932, 430, true)).toBe('field');
    expect(autoView(1024, 768, true)).toBe('analysis');
    expect(autoView(1280, 480, false)).toBe('analysis');
  });

  it('switches to the other view defaults only when the layers were untouched', () => {
    expect(layersAfterViewSwitch(reg, defaultLayers(reg, 'field'), 'field', 'analysis')).toEqual(
      defaultLayers(reg, 'analysis'),
    );
    const chosen = ['hin_2025'];
    expect(layersAfterViewSwitch(reg, chosen, 'field', 'analysis')).toEqual(chosen);
    expect(layersAfterViewSwitch(reg, chosen, 'field', 'field')).toEqual(chosen);
  });
});

describe('lens weights and presets', () => {
  it('clamps weights to whole numbers from 0 to 5', () => {
    expect(clampWeight(7)).toBe(5);
    expect(clampWeight(-2)).toBe(0);
    expect(clampWeight(2.6)).toBe(3);
    expect(clampWeight('4')).toBe(4);
    expect(clampWeight('lots')).toBe(0);
    expect(clampWeight(undefined)).toBe(0);
    expect(clampWeight(Number.NaN)).toBe(0);
  });

  it('applies presets and recognizes the one in use', () => {
    expect(presetWeights(violence, 'vacancy_only')).toEqual({
      untreated_vacancy: 1,
      shootings_nearby: 0,
      poverty: 0,
      canopy_gap: 0,
    });
    expect(presetWeights(violence, 'nope')).toBeNull();
    expect(matchingPreset(violence, defaultState(reg, 'field').weights.violence)).toBe('research');
    expect(matchingPreset(violence, presetWeights(violence, 'vacancy_only')!)).toBe('vacancy_only');
    expect(matchingPreset(violence, { untreated_vacancy: 2 })).toBeNull();
  });
});

describe('address bar state', () => {
  it('round trips the defaults for each view', () => {
    for (const view of ['field', 'analysis'] as const) {
      const state = defaultState(reg, view);
      const { state: back, found, hasView } = decodeState(reg, encodeState(reg, state), 'field');
      expect(found).toBe(true);
      expect(hasView).toBe(true);
      expect(back).toEqual(state);
    }
  });

  it('round trips a customized state exactly', () => {
    const state = customized();
    const text = encodeState(reg, state);
    expect(decodeState(reg, text, 'field').state).toEqual(state);
    expect(decodeState(reg, `#${text}`, 'field').state).toEqual(state);
  });

  it('stays compact: defaults add nothing beyond view, map and layers', () => {
    const text = encodeState(reg, defaultState(reg, 'field'));
    expect(text).toBe('v=f&m=10.6/40/-75.135&l=vacant_parcels,hin_2025,memorials,drinking_water,toilets,park_water');
  });

  it('writes only what differs from the registry defaults', () => {
    const text = encodeState(reg, customized());
    expect(text).toBe(
      'v=a&m=15.25/39.98712/-75.15623&l=vacant_parcels,shootings_hex' +
        '&s=vacant_parcels.min_confidence:3,vacant_parcels.kinds:lots,shootings_hex.window:m36' +
        '&w=violence.poverty:0,violence.canopy_gap:5&g=seal_abandoned_building:0&f=owner_type:3+4&p=990000012',
    );
  });

  it('keeps an empty layer list as "nothing shown", not as the defaults', () => {
    const state = defaultState(reg, 'analysis');
    state.layers = [];
    const back = decodeState(reg, encodeState(reg, state), 'field').state;
    expect(back.layers).toEqual([]);
  });

  it('keeps the base map on for links made before it had a switch, and off only when a link says so', () => {
    expect(decodeState(reg, 'v=a&l=vacant_parcels,hin_2025', 'field').state.layers).toEqual(['vacant_parcels', 'hin_2025', 'basemap']);
    expect(decodeState(reg, 'v=a&l=', 'field').state.layers).toEqual(['basemap']);
    const state = defaultState(reg, 'analysis');
    state.layers = ['vacant_parcels'];
    const text = encodeState(reg, state);
    expect(text).toContain('l=vacant_parcels,-basemap');
    expect(decodeState(reg, text, 'field').state.layers).toEqual(['vacant_parcels']);
    state.layers = ['vacant_parcels', 'basemap'];
    expect(encodeState(reg, state)).toMatch(/l=vacant_parcels($|&)/);
    state.settings.basemap!.look = 'muted';
    expect(encodeState(reg, state)).toContain('s=basemap.look:muted');
    expect(decodeState(reg, encodeState(reg, state), 'field').state).toEqual(state);
  });

  it('carries the LandCare and first step filters in the link', () => {
    const state = defaultState(reg, 'analysis');
    state.filters.first_step = ['2', '5'];
    state.filters.landcare = ['0'];
    const text = encodeState(reg, state);
    expect(text).toContain('f=landcare:0,first_step:2+5');
    expect(decodeState(reg, text, 'field').state.filters).toEqual(state.filters);
  });

  it('keeps an empty filter as "nothing selected"', () => {
    const state = defaultState(reg, 'analysis');
    state.filters.owner_type = [];
    const back = decodeState(reg, encodeState(reg, state), 'field').state;
    expect(back.filters.owner_type).toEqual([]);
  });

  it('uses the fallback view and defaults when the address has no state', () => {
    const { state, found, hasView } = decodeState(reg, '', 'field');
    expect(found).toBe(false);
    expect(hasView).toBe(false);
    expect(state).toEqual(defaultState(reg, 'field'));
  });

  it('fills missing parts from the defaults of the view in the link', () => {
    const { state } = decodeState(reg, 'v=a&m=14/39.95/-75.16', 'field');
    expect(state.view).toBe('analysis');
    expect(state.layers).toEqual(defaultLayers(reg, 'analysis'));
    expect(state.map).toEqual({ zoom: 14, lat: 39.95, lng: -75.16, bearing: 0, pitch: 0 });
  });

  it('ignores unknown ids, bad values and broken text without failing', () => {
    const text =
      'v=x&m=99/abc/1&l=vacant_parcels,ghost_layer,vacant_parcels&s=vacant_parcels.min_confidence:9,' +
      'ghost.x:1,vacant_parcels.kinds,%E0%A4%A:1&w=violence.poverty:42,violence.ghost:3,ghost.poverty:1,' +
      'violence.canopy_gap:&g=ghost:1,clean_and_green:maybe&f=owner_type:3+99,ghost:1&p=not a parcel!&zz=1';
    const { state } = decodeState(reg, text, 'field');
    const defaults = defaultState(reg, 'field');
    expect(state.view).toBe('field');
    expect(state.map).toEqual(DEFAULT_MAP);
    expect(state.layers).toEqual(['vacant_parcels', 'basemap']);
    expect(state.settings).toEqual(defaults.settings);
    expect(state.weights.violence).toEqual({ ...defaults.weights.violence, poverty: 5 });
    expect(state.suggestions).toEqual(defaults.suggestions);
    expect(state.filters.owner_type).toEqual(['3']);
    expect(state.selected).toBeNull();
  });

  it('encodes setting values that need escaping', () => {
    const files = structuredClone(reg);
    const layer = files.layers.find((l) => l.id === 'hin_2025')!;
    layer.settings = [
      { id: 'mode', label: 'Mode', type: 'choice', options: [{ value: 'a.b', label: 'A' }, { value: 'c', label: 'C' }], default: 'c' },
      { id: 'labels', label: 'Labels', type: 'toggle', default: true },
      { id: 'width', label: 'Width', type: 'range', min: 0.5, max: 4, step: 0.5, default: 1 },
    ];
    const state = defaultState(files, 'field');
    state.settings.hin_2025 = { mode: 'a.b', labels: false, width: 2.5 };
    const text = encodeState(files, state);
    expect(text).toContain('hin_2025.mode:a.b');
    expect(text).toContain('hin_2025.labels:0');
    expect(text).toContain('hin_2025.width:2.5');
    expect(decodeState(files, text, 'field').state).toEqual(state);
    // Range values outside the limits are pulled back inside.
    const clamped = decodeState(files, 'l=&s=hin_2025.width:40', 'field').state;
    expect(clamped.settings.hin_2025!.width).toBe(4);
  });

  it('rounds the map position to about a meter and keeps turns and tilts', () => {
    const text = encodeMap({ lng: -75.1652345, lat: 39.9526123, zoom: 13.456, bearing: 0, pitch: 0 });
    expect(text).toBe('13.46/39.95261/-75.16523');
    const turned = encodeMap({ lng: -75.1, lat: 39.9, zoom: 12, bearing: 30, pitch: 45 });
    expect(turned).toBe('12/39.9/-75.1/30/45');
    expect(decodeMap(turned)).toEqual({ lng: -75.1, lat: 39.9, zoom: 12, bearing: 30, pitch: 45 });
    expect(decodeMap('12/39.9/-75.1/190/0')?.bearing).toBe(-170);
    expect(decodeMap('12/39.9')).toBeNull();
    expect(decodeMap('12/39.9/-75.1/0/120')).toBeNull();
  });

  it('can leave out the view, map and selection for saved personal settings', () => {
    const text = encodeState(reg, customized(), { includeView: false, includeMap: false, includeSelection: false });
    expect(text.startsWith('l=')).toBe(true);
    expect(text).not.toContain('m=');
    expect(text).not.toContain('p=');
    const { state, hasView } = decodeState(reg, text, 'field');
    expect(hasView).toBe(false);
    expect(state.weights).toEqual(customized().weights);
  });
});

describe('browser storage', () => {
  function memoryStore(): KeyValueStore & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  }

  const broken: KeyValueStore = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('quota');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };

  it('namespaces every key for the shared github.io origin', () => {
    expect(storageKey(PREFS_KEY)).toBe('placekeepers:v1:prefs');
    const store = memoryStore();
    expect(writeItem(PREFS_KEY, 'l=hin_2025', store)).toBe(true);
    expect([...store.data.keys()]).toEqual(['placekeepers:v1:prefs']);
    expect(readItem(PREFS_KEY, store)).toBe('l=hin_2025');
    expect(removeItem(PREFS_KEY, store)).toBe(true);
    expect(readItem(PREFS_KEY, store)).toBeNull();
  });

  it('treats blocked or full storage as empty instead of failing', () => {
    expect(readItem(PREFS_KEY, broken)).toBeNull();
    expect(writeItem(PREFS_KEY, 'x', broken)).toBe(false);
    expect(removeItem(PREFS_KEY, broken)).toBe(false);
    expect(readItem(PREFS_KEY, null)).toBeNull();
    expect(writeItem(PREFS_KEY, 'x', null)).toBe(false);
  });

  it('works when no storage exists at all (as in this test runner)', () => {
    expect(readItem(PREFS_KEY)).toBeNull();
    expect(writeItem(PREFS_KEY, 'x')).toBe(false);
  });
});
