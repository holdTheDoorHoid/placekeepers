import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { rankPlaces, summarizeArea, type PlaceInput } from '../src/places/rank.ts';
import { defaultLayers, defaultState } from '../src/state/defaults.ts';
import { initialState, savedText } from '../src/state/init.ts';
import { encodeState } from '../src/state/url.ts';

const reg = loadRegistry();
const fixture = JSON.parse(readFileSync(new URL('../fixtures/data/geojson/parcels.geojson', import.meta.url), 'utf8'));
const places: PlaceInput[] = fixture.features.map((f: { properties: Record<string, unknown> }) => ({
  id: String(f.properties.id),
  properties: f.properties,
  center: [-75.15, 39.98],
}));

describe('ranking places for the cards and the list', () => {
  it('sorts by lens score, highest first, and limits the list', () => {
    const ranked = rankPlaces(reg, defaultState(reg, 'field'), places, 5);
    expect(ranked).toHaveLength(5);
    const scores = ranked.map((p) => p.why!.score!);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(ranked[0]!.score).toBe(Math.round(scores[0]!));
  });

  it('gives each place its first switched on suggestion and that route\'s first step', () => {
    const state = defaultState(reg, 'field');
    const building = rankPlaces(reg, state, places).find((p) => p.kind === 2)!;
    expect(building.suggestions.map((s) => s.id)).toEqual(['seal_abandoned_building']);
    expect(building.firstStep?.route.id).toBe('report_to_311');
    expect(building.firstStep?.step).toMatch(/^Report the open building/);

    state.suggestions.seal_abandoned_building = false;
    const hidden = rankPlaces(reg, state, places).find((p) => p.id === building.id)!;
    expect(hidden.suggestions).toEqual([]);
    expect(hidden.firstStep).toBeNull();
  });

  it('ignores suggestion ids the registry does not know', () => {
    const odd: PlaceInput = { id: '1', center: [0, 0], properties: { sg: 'ghost, clean_and_green', f_vacant: 50 } };
    expect(rankPlaces(reg, defaultState(reg, 'field'), [odd])[0]!.suggestions.map((s) => s.id)).toEqual(['clean_and_green']);
  });

  it('does not rank when every weight is off, and lists by parcel number', () => {
    const state = defaultState(reg, 'field');
    state.weights.violence = { untreated_vacancy: 0, shootings_nearby: 0, poverty: 0, canopy_gap: 0 };
    const ranked = rankPlaces(reg, state, places);
    expect(ranked.every((p) => p.score === null && p.why?.allOff)).toBe(true);
    expect(ranked.map((p) => p.id)).toEqual([...ranked.map((p) => p.id)].sort());
  });

  it('sums up an area', () => {
    const ranked = rankPlaces(reg, defaultState(reg, 'field'), places);
    const area = summarizeArea(ranked);
    expect(area.lots + area.buildings).toBe(50);
    expect(area.high).toBeGreaterThan(0);
    expect(area.landcare).toBeGreaterThan(0);
  });
});

describe('where the state comes from at startup', () => {
  it('prefers a link, then saved settings, then defaults for the screen', () => {
    const linked = defaultState(reg, 'analysis');
    linked.layers = ['hin_2025'];
    const hash = `#${encodeState(reg, linked)}`;
    const saved = 'l=vacant_parcels&w=violence.poverty:0';

    expect(initialState(reg, { hash, width: 375, saved })).toMatchObject({ from: 'link', viewPinned: true });
    expect(initialState(reg, { hash, width: 375, saved }).state.layers).toEqual(['hin_2025']);

    const fromSaved = initialState(reg, { hash: '', width: 375, saved });
    expect(fromSaved).toMatchObject({ from: 'saved', viewPinned: false });
    expect(fromSaved.state.view).toBe('field');
    expect(fromSaved.state.weights.violence!.poverty).toBe(0);

    const fresh = initialState(reg, { hash: '#', width: 1280, saved: null });
    expect(fresh).toMatchObject({ from: 'defaults', viewPinned: false });
    expect(fresh.state).toEqual(defaultState(reg, 'analysis'));
  });

  it('ignores saved text it cannot use', () => {
    expect(initialState(reg, { hash: '', width: 375, saved: 'garbage' }).from).toBe('defaults');
  });

  it('saves nothing while everything is at its default', () => {
    expect(savedText(reg, defaultState(reg, 'field'), false)).toBeNull();
  });

  it('saves only changes, never the map position or selection', () => {
    const state = defaultState(reg, 'field');
    state.selected = '990000001';
    state.map = { lng: -75.1, lat: 39.9, zoom: 16, bearing: 0, pitch: 0 };
    state.weights.violence!.canopy_gap = 0;
    expect(savedText(reg, state, false)).toBe('w=violence.canopy_gap:0');
    expect(savedText(reg, state, true)).toBe('v=f&w=violence.canopy_gap:0');
  });

  it('keeps unchanged layers following each view\'s defaults on the next visit', () => {
    const state = defaultState(reg, 'analysis');
    state.weights.violence!.canopy_gap = 0;
    const text = savedText(reg, state, false)!;
    expect(text).not.toContain('l=');
    expect(initialState(reg, { hash: '', width: 375, saved: text }).state.layers).toEqual(defaultLayers(reg, 'field'));
    state.layers = ['hin_2025'];
    expect(savedText(reg, state, false)).toContain('l=hin_2025');
  });
});
