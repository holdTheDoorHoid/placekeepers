// The transit comfort lens at SEPTA's stops (M2.3): what a stop's details and its card in "What
// you can do nearby" say, the lots and stops listed together nearest first, and using a lens
// showing its places on the map.

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import StopCard from '../src/components/transit/StopCard.svelte';
import TransitStopDetails from '../src/components/transit/TransitStopDetails.svelte';
import { FIELD_CHIPS } from '../src/config/chips.ts';
import { lensChanges, lensLayers, lensShown } from '../src/map/lens-layers.ts';
import { mergeNearby } from '../src/places/nearby.ts';
import type { NearbyPlace } from '../src/places/rank.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import { AppStore } from '../src/state/store.svelte.ts';
import { strings } from '../src/strings.ts';
import { describeComfort, nearestStops, stopLensOf, type NearbyStop } from '../src/transit/comfort.ts';

const reg = loadRegistry();
const lens = stopLensOf(reg)!;

/** The sample stops the web fixtures carry, as the pipeline writes them. */
const fixture = JSON.parse(readFileSync(new URL('../fixtures/data/tiles/transit.stops.geojson', import.meta.url), 'utf8')) as {
  features: { properties: Record<string, unknown>; geometry: { coordinates: [number, number] } }[];
};
const stop = (id: string) => fixture.features.find((f) => f.properties.id === id)!;
const props = (id: string) => stop(id).properties;

function state(view: 'field' | 'analysis' = 'analysis'): AppState {
  return defaultState(reg, view);
}

describe('the transit comfort lens in the registry', () => {
  it('ranks stops, with every factor from the pipeline and an honest badge', () => {
    expect(lens.id).toBe('transit_comfort');
    expect(lens.applies_to).toBe('stop');
    expect(lens.factors.map((f) => [f.field, f.evidence])).toEqual([
      ['f_riders', 'context'],
      ['f_noshelter', 'weak'],
      ['f_nobench', 'weak'],
      ['f_shade', 'mixed'],
      ['f_heat', 'context'],
      ['f_hin', 'context'],
      ['f_wait', 'weak'],
    ]);
    // Every stop suggestion exists, applies to stops and is on by default.
    const ids = ['stop_survey', 'stop_shelter_request', 'stop_bench_request', 'stop_streetlight_report', 'stop_shade_trees'];
    for (const id of ids) {
      const suggestion = reg.suggestions.find((s) => s.id === id);
      expect(suggestion?.applies_to, id).toBe('stop');
      expect(suggestion?.default_on, id).toBe(true);
      for (const route of suggestion!.routes) expect(reg.routes.some((r) => r.id === route), route).toBe(true);
    }
  });

  it('never routes a stop suggestion to the police', () => {
    for (const suggestion of reg.suggestions.filter((s) => s.applies_to === 'stop')) {
      const text = [suggestion.summary, ...suggestion.routes.flatMap((id) => reg.routes.find((r) => r.id === id)!.steps)].join(' ');
      expect(text, suggestion.id).not.toMatch(/police|enforcement|incident report/i);
    }
  });
});

describe('what a stop says under the lens', () => {
  it('gives a busy stop with nothing to sit under or on its score, answers, facts and suggestions', () => {
    const view = describeComfort(reg, state(), props('sp1002'));
    // (3*60 + 3*100 + 2*100 + 2*83 + 1*33 + 2*100 + 1*20) / 14 = 78.5
    expect(view.why?.score).toBeCloseTo(1099 / 14, 5);
    expect(view.score).toBe(79);
    expect(view.summary).toBe(strings.stopAmenities.comfort[1]);
    expect(view.answers.map((a) => `${a.label}: ${a.value}`)).toEqual(['Shelter: No', 'Bench: No', 'Lit at night: No']);
    expect(view.anyUnknown).toBe(false);
    expect(view.halfway).toBe(false);
    expect(view.unsurveyed).toEqual([]);
    expect(view.main?.id).toBe('no_shelter');
    expect(view.facts).toEqual([strings.transit.canopy(2), strings.transit.onHin]);
    expect(view.matched).toBe(strings.transit.matchedByNumber);
    expect(view.osmUrl).toBe('https://www.openstreetmap.org/node/9100002');
    expect(view.suggestions.map((s) => s.suggestion.id)).toEqual([
      'stop_shelter_request',
      'stop_bench_request',
      'stop_streetlight_report',
      'stop_shade_trees',
    ]);
    const shelter = view.suggestions[0]!;
    expect(shelter.firstStep?.route.id).toBe('bus_shelter_request');
    // No public request form exists: the route says so, names OTIS and is marked to confirm.
    expect(shelter.routes[0]!.route.steps.join(' ')).toMatch(/otis@phila\.gov.*no public request form/);
    expect(shelter.routes[0]!.confirm).toBe(true);
    expect(shelter.routes[0]!.lastChecked).toMatch(/2026/);
    const light = view.suggestions[2]!;
    expect(light.routes.map((r) => r.route.id)).toEqual(['report_to_311', 'otis_contact']);
    const trees = view.suggestions[3]!;
    expect(trees.partners.map((p) => p.id)).toEqual(['treephilly']);
  });

  it('says "not yet surveyed", never "no", and counts those answers halfway', () => {
    const view = describeComfort(reg, state(), props('sp1105'));
    expect(view.inOsm).toBe(true);
    expect(view.summary).toBe(strings.stopAmenities.comfort[0]);
    expect(view.answers.every((a) => !a.known && a.value === strings.stopAmenities.unknown)).toBe(true);
    expect(view.halfway).toBe(true);
    expect(view.why?.factors.find((f) => f.id === 'no_shelter')?.value).toBe(50);
    // The halfway answers add to the score but are never called the main reason.
    expect(view.unsurveyed).toEqual(['no_shelter', 'no_bench']);
    expect(view.why?.main?.id).toBe('no_shelter');
    expect(view.main?.id).toBe('little_shade');
    expect(view.suggestions.map((s) => s.suggestion.id)).toEqual(['stop_survey']);
    expect(view.suggestions[0]!.firstStep?.step).toMatch(/StreetComplete/);
    expect(view.matched).toBe(strings.transit.matchedByPlace);

    // A shelter answer without a bench answer: the shelter is known, the bench is not.
    const half = describeComfort(reg, state(), props('sp1008'));
    expect(half.answers.slice(0, 2).map((a) => a.value)).toEqual([strings.stopAmenities.no, strings.stopAmenities.unknown]);
    expect(half.halfway).toBe(true);
    expect(half.suggestions.map((s) => s.suggestion.id)).toEqual(['stop_survey', 'stop_shelter_request']);
  });

  it('says when OpenStreetMap does not have the stop at all', () => {
    const view = describeComfort(reg, state(), props('sp1004'));
    expect(view.inOsm).toBe(false);
    expect(view.summary).toBe(strings.transit.notInOsm);
    expect(view.osmUrl).toBeNull();
    expect(view.matched).toBeNull();
    // No SEPTA count: riders are left out of the average, not counted as zero.
    expect(view.why?.missing).toEqual(['riders']);
  });

  it('follows the sliders and the suggestion switches', () => {
    const s = state();
    s.weights.transit_comfort = { ...s.weights.transit_comfort, no_shelter: 0, no_bench: 0 };
    expect(describeComfort(reg, s, props('sp1105')).halfway).toBe(false);
    s.weights.transit_comfort = Object.fromEntries(lens.factors.map((f) => [f.id, 0]));
    const off = describeComfort(reg, s, props('sp1002'));
    expect(off.score).toBeNull();
    expect(off.why?.allOff).toBe(true);
    const quiet = state();
    quiet.suggestions.stop_shelter_request = false;
    expect(describeComfort(reg, quiet, props('sp1001')).suggestions).toEqual([]);
  });

  it('renders the details with the score, the answers, the suggestions and the breakdown', () => {
    const store = new AppStore(reg, { state: state(), viewPinned: true }, { listStorage: null });
    const { body } = render(TransitStopDetails, { props: { store, features: [props('sp1002')], guide: 'streetcomplete' } });
    expect(body).toContain('Priority 79 of 100 for transit comfort.');
    expect(body).toContain(strings.transit.findTitle);
    expect(body).toContain('Shelter: No');
    expect(body).toContain(strings.transit.canDo);
    expect(body).toContain('Ask the City for a shelter at this stop');
    expect(body).toContain(strings.transit.routeDetails);
    expect(body).toContain(strings.why.title);
    expect(body).toContain('streetcomplete/');
    expect(body).toContain('https://www.openstreetmap.org/node/9100002');
    // Service and riders are still there.
    expect(body).toContain(strings.transit.howOften);
    expect(body).toContain("SEPTA's count");

    // A station has no lens, no answers and no suggestions.
    const station = render(TransitStopDetails, { props: { store, features: [props('sp1006')] } }).body;
    expect(station).not.toContain(strings.transit.findTitle);
    expect(station).not.toContain(strings.why.title);
    expect(station).not.toContain(strings.transit.osmSource);

    const unsurveyed = render(TransitStopDetails, { props: { store, features: [props('sp1105')] } }).body;
    expect(unsurveyed).toContain(strings.stopAmenities.unknownNote);
    expect(unsurveyed).toContain(strings.transit.halfway);
    expect(unsurveyed).not.toMatch(/(Shelter|Bench|Lit at night): No</);
    expect(unsurveyed).toContain('Main reason: Little shade nearby.');
    expect(unsurveyed).toContain('<span class="note svelte');
  });
});

describe('stops in "What you can do nearby"', () => {
  const inputs = fixture.features.map((f) => ({ layerId: 'transit_stops', properties: f.properties, lngLat: f.geometry.coordinates }));
  const anchor = stop('sp1002').geometry.coordinates;

  it('lists stops with a suggestion switched on, nearest first, and leaves out the rest', () => {
    const near = nearestStops(reg, state('field'), inputs, anchor);
    const ids = near.map((s) => s.id);
    expect(ids[0]).toBe('sp1002');
    // A sheltered stop with nothing to suggest, and stations, are left out.
    expect(ids).not.toContain('sp1003');
    expect(ids).not.toContain('sp1006');
    expect(ids).not.toContain('sr90009');
    expect(ids.sort()).toEqual(['sp1001', 'sp1002', 'sp1004', 'sp1008', 'sp1105']);
    const distances = near.map((s) => s.distance);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(nearestStops(reg, state('field'), inputs, anchor, 2)).toHaveLength(2);
    const first = near[0]!;
    expect(first.kind).toBe('bus');
    expect(first.title).toBe('N Broad St & Sample 2 St');
    expect(first.score).toBe(79);
    expect(first.suggestions[0]!.suggestion.id).toBe('stop_shelter_request');
  });

  it('mixes lots and stops by distance', () => {
    const near = nearestStops(reg, state('field'), inputs, anchor);
    const lot = (id: string, distance: number) => ({ id, distance }) as NearbyPlace;
    const second = near[1]!;
    const merged = mergeNearby([lot('a', second.distance / 2), lot('b', 1e6)], near);
    expect(merged.map((m) => m.key).slice(0, 3)).toEqual(['stop:sp1002', 'place:a', `stop:${second.id}`]);
    expect(merged.at(-1)!.key).toBe('place:b');
    // At the same distance, the order is fixed.
    expect(mergeNearby([lot('a', 0)], near.slice(0, 1)).map((m) => m.key)).toEqual(['place:a', 'stop:sp1002']);
    expect(mergeNearby([lot('a', 5)], near, 3)).toHaveLength(3);
  });

  it('renders a stop card with its priority, its first suggestion and the first step', () => {
    const store = new AppStore(reg, { state: state('field'), viewPinned: true }, { listStorage: null });
    const card: NearbyStop = nearestStops(reg, state('field'), inputs, anchor)[0]!;
    const { body } = render(StopCard, { props: { store, stop: card, lensLabel: lens.label, fromYou: false } });
    expect(body).toContain('data-stop="sp1002"');
    expect(body).toContain('Bus stop');
    expect(body).toContain('feet from the middle of the map');
    expect(body).toContain('Priority 79 of 100 for transit comfort.');
    expect(body).toContain('What you could do:</strong> Ask the City for a shelter at this stop.');
    expect(body).toContain('First step:');
    expect(body).toContain(strings.sheet.showOnMap);
  });

  it('has a Bus stops chip that shows the stops layer', () => {
    expect(FIELD_CHIPS.find((c) => c.id === 'stops')).toEqual({ id: 'stops', label: 'Bus stops', layers: ['transit_stops'] });
  });
});

describe('using a lens shows its places', () => {
  it('turns on the stops colored by the lens when the transit comfort lens is used', () => {
    expect(lensLayers(reg, lens).map((l) => l.id)).toEqual(['transit_stops']);
    const s = state('field');
    expect(lensShown(reg, s, lens)).toBe(false);
    expect(lensChanges(reg, s, lens).turnOn.map((l) => l.id)).toEqual(['transit_stops']);

    const store = new AppStore(reg, { state: s, viewPinned: true }, { listStorage: null });
    store.applyPreset('transit_comfort', 'heat_and_shade');
    expect(store.state.layers).toContain('transit_stops');
    expect(lensShown(reg, store.state, lens)).toBe(true);

    // Colored by waits instead: moving a slider brings the lens coloring back.
    store.setSetting('transit_stops', 'color', 'wait');
    expect(lensChanges(reg, store.state, lens).recolor.map((r) => [r.layer.id, r.setting])).toEqual([['transit_stops', 'color']]);
    store.setWeight('transit_comfort', 'riders', 4);
    expect(store.state.settings.transit_stops?.color).toBe('lens');
  });

  it('leaves the map alone when the lens already shows, and works for every lens', () => {
    const s = state('analysis');
    const parcels = reg.lenses.find((l) => l.applies_to === 'parcel')!;
    expect(lensShown(reg, s, parcels)).toBe(true);
    const store = new AppStore(reg, { state: s, viewPinned: true }, { listStorage: null });
    const before = [...store.state.layers];
    store.setWeight(parcels.id, parcels.factors[0]!.id, 1);
    expect(store.state.layers).toEqual(before);
    // The street blocks are off in the field view; using the street safety lens turns them on.
    const streets = reg.lenses.find((l) => l.applies_to === 'segment')!;
    expect(lensChanges(reg, state('field'), streets).turnOn.map((l) => l.id)).toEqual(['segments']);
  });

  it('says what it turned on', () => {
    expect(strings.lens.shown('Bus and trolley stops', 'Transit comfort')).toBe('Now showing "Bus and trolley stops", colored by the transit comfort lens.');
  });
});
