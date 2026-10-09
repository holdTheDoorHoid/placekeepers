// Streets and stops (M4.5, issue #41): the City's bus shelters, street poles, traffic calming and
// school crossing guard posts. Each layer has a toggle and is off by default, its style puts its
// settings into effect, a tapped one reads plainly, the street blocks, memorials and 311 street
// light blocks say what the City lists there, and a City shelter counts as a shelter in the transit
// comfort lens, with the stop's page saying plainly where the City and OpenStreetMap disagree.

import { createPropertyExpression, featureFilter, latest } from '@maplibre/maplibre-gl-style-spec';
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import ConditionDetails from '../src/components/amenities/ConditionDetails.svelte';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import TransitStopDetails from '../src/components/transit/TransitStopDetails.svelte';
import { styleFor } from '../src/map/styles/index.ts';
import { TRANSIT_RAMP } from '../src/map/styles/transit_stops.ts';
import type { LegendEntry } from '../src/map/styles/types.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { blockCalming, blockPolesLine, describeCalming, describeGuard, describePole, describeShelter, memorialCalmingLine, stopLampsLine } from '../src/streets/streets-stops.ts';
import { strings } from '../src/strings.ts';
import { joinStop, parseStopTable, stopAnswerIndex } from '../src/transit/answers.ts';
import { describeComfort } from '../src/transit/comfort.ts';

const reg = loadRegistry();
const t = strings.streetsStops;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const TABLE = parseStopTable(read('../fixtures/data/tables/stop_amenities.json'))!;
const stops = read('../fixtures/data/tiles/transit.stops.geojson') as { features: { properties: Record<string, unknown> }[] };
const stop = (id: string) => stops.features.find((f) => f.properties.id === id)!.properties;
const NEW_LAYERS = ['city_shelters', 'street_poles', 'traffic_calming', 'crossing_guards'];

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

function passes(part: unknown, properties: Record<string, unknown>): boolean {
  const filter = (part as { filter?: unknown }).filter;
  if (filter === undefined) return true;
  return featureFilter(filter as never).filter({ zoom: 15 } as never, { type: 1, properties } as never);
}

function details(layerId: string, features: Record<string, unknown>[]): string {
  const store = { registry: reg, state: defaultState(reg, 'analysis') } as unknown as AppStore;
  const target = { layerId, features, lngLat: [-75.15, 39.98] as [number, number] };
  return textOf(render(FeatureDetails, { props: { store, target } }).body);
}

describe('the four new layers', () => {
  it('each have a toggle, are off by default in both views and credit the City', () => {
    for (const id of NEW_LAYERS) {
      const layer = layerOf(id);
      expect(layer.default).toEqual({ field: false, analysis: false });
      expect(styleFor(layer)).not.toBeNull();
      const source = reg.sources.find((s) => s.id === layer.sources[0])!;
      expect(source.license).toBe('city_terms');
      expect(source.attribution).toMatch(/City of Philadelphia/);
    }
    expect(layerOf('city_shelters').group).toBe('transit');
    for (const id of ['street_poles', 'traffic_calming', 'crossing_guards']) expect(layerOf(id).group).toBe('streets');
  });

  it('never call a street lit or bright, and never call crossing guards enforcement', () => {
    const words = JSON.stringify(t).toLowerCase() + NEW_LAYERS.map((id) => layerOf(id).description.toLowerCase()).join(' ');
    for (const banned of ['brightness', 'bright', ' is lit', 'well lit', 'enforce', 'police', 'ticket']) expect(words).not.toContain(banned);
    expect(words).not.toMatch(/[–—]| - /);
  });
});

describe('the street poles', () => {
  const dot = (state: AppState) => parts('street_poles', state).find((p) => p.id.endsWith(':dot'))!;
  const led = { k: 1 };
  const sodium = { k: 2 };
  const unknown = { k: 3 };
  const none = { k: 0 };

  it('appear only close in', () => {
    expect((dot(defaultState(reg, 'field')) as { minzoom?: number }).minzoom).toBe(15);
  });

  it('show every pole, poles with a lamp, or lamps not listed as LED, as chosen', () => {
    const state = defaultState(reg, 'analysis');
    const shown = () => [led, sodium, unknown, none].map((p) => passes(dot(state), p));
    expect(shown()).toEqual([true, true, true, true]);
    state.settings.street_poles!.show = 'lamps';
    expect(shown()).toEqual([true, true, true, false]);
    expect(legend('street_poles', state).filter((e) => e.kind === 'circle')).toHaveLength(3);
    state.settings.street_poles!.show = 'not_led';
    expect(shown()).toEqual([false, true, true, false]);
    expect(legend('street_poles', state).filter((e) => e.kind === 'circle')).toHaveLength(2);
  });

  it('give a tapped pole its number for Philly311, its lamp and its owner', () => {
    expect(describePole({ k: 1, id: 7001, o: 1 })).toEqual({
      title: 'Street pole 7001',
      lines: [t.poleKind[1], t.poleOwner[1], t.poleReport('7001')],
      source: t.poleSource,
    });
    expect(describePole({ k: 0, o: 2 }).lines).toEqual([t.poleKind[0], t.poleOwner[2], t.poleReportNoNumber]);
    const text = details('street_poles', [{ k: 2, id: 7003, o: 1 }, { k: 0, id: 7005, o: 2 }]);
    expect(text).toContain('Street pole 7003');
    expect(text).toContain('older high pressure sodium lamp');
    expect(text).toContain(t.polesHere(2));
  });
});

describe('the City shelters, traffic calming and crossing guards', () => {
  it('say where a shelter is, which stop it serves and how it was matched', () => {
    const view = describeShelter({ id: 'pa-9002', nm: 'Sample 2 St & Sample 5 Ave (far side)', sid: '1009-a', st: 'sp1009', m: 1, dg: 1 });
    expect(view.title).toBe('Sample 2 St & Sample 5 Ave (far side)');
    expect(view.lines).toEqual([
      t.shelterAt('1009'),
      t.shelterByNumber,
      t.shelterLens,
      t.shelterListed('1009-a'),
      t.shelterDigital,
      t.shelterPartner,
    ]);
    expect(describeShelter({ id: 'pa-9004', sid: 'NJT4' }).lines).toEqual([t.shelterNoStop, t.shelterListed('NJT4'), t.shelterPartner]);
    expect(describeShelter({ st: 'sp21001', m: 2 }).lines.slice(0, 2)).toEqual([t.shelterAt('21001'), t.shelterByPlace]);
  });

  it('date each traffic calming device and name its street', () => {
    const calming = describeCalming({ id: 1, d: '2023-08-01', p: 'SC-9001', s: 900004, name: 'SAMPLE 4 ST' });
    expect(calming.title).toBe('On Sample 4 St');
    expect(calming.lines).toEqual([t.calmingWhat, 'It went in on August 1, 2023.']);
  });

  it('describe a crossing guard post as a safety service near a school', () => {
    const guard = describeGuard({ id: 1, pl: 'Sample 3 & Sample 4', sn: 'Sample Elementary School' });
    expect(guard.title).toBe('Sample 3 & Sample 4');
    expect(guard.lines).toEqual([t.guardHere, t.guardSchool('Sample Elementary School'), t.guardWhat]);
    const text = details('crossing_guards', [{ id: 2, pl: 'Sample 3 & Sample 5' }]);
    expect(text).toContain('Sample 3 & Sample 5');
    expect(text).toContain(t.guardHere);
    expect(text).toContain(t.guardSource);
  });

  it('draw the shelters as a ring around the stop, and the others from zoom 12', () => {
    const state = defaultState(reg, 'analysis');
    const ring = parts('city_shelters', state).find((p) => p.id.endsWith(':ring')) as { paint: Record<string, unknown>; minzoom: number };
    expect(ring.paint['circle-color']).toBe('rgba(0, 0, 0, 0)');
    expect(ring.minzoom).toBe(12);
    for (const id of ['traffic_calming', 'crossing_guards']) {
      expect((parts(id, state).find((p) => p.id.endsWith(':dot')) as { minzoom: number }).minzoom).toBe(12);
    }
    expect(legend('city_shelters', state).map((e) => (e.kind === 'note' ? e.text : ''))).toContain(t.shelterLegendDate);
  });
});

describe('street blocks, memorials and 311 street lights say what the City lists', () => {
  it('count the poles along a block and the share of LED lamps', () => {
    expect(blockPolesLine({ pl: 6, lp: 5, le: 5 })).toBe('The City lists 6 poles along this block, 5 with a lamp, all of them LED.');
    expect(blockPolesLine({ pl: 3, lp: 2, le: 1 })).toBe('The City lists 3 poles along this block, 2 with a lamp, 1 of them LED.');
    expect(blockPolesLine({ pl: 2 })).toBe('The City lists 2 poles along this block, with no lamp listed on them.');
    expect(blockPolesLine({ pl: 0 })).toBe(t.blockNoPoles);
    expect(blockPolesLine({})).toBeNull();
  });

  it('say since when a block has traffic calming, or that none is recorded yet', () => {
    expect(blockCalming({ tc: 2, ty: 2023 })?.line).toBe('Traffic calming here since 2023: the City lists 2 speed cushions, humps or tables on this block.');
    expect(blockCalming({ tc: 0, sg: 'traffic_calming_petition' })).toEqual({ line: t.blockNoCalming, arterial: null });
    // An arterial on the High Injury Network: the City's speed cushions do not serve it.
    expect(blockCalming({ tc: 0 })).toEqual({ line: t.blockNoCalming, arterial: t.blockArterial });
    expect(blockCalming({})).toBeNull();
  });

  it('show the block details with the request for traffic calming beside "none recorded yet"', () => {
    const block = { id: 9, name: 'SAMPLE 2 ST', cls: 5, hin: 1, f_hin: 100, ksi: 2, f_ksi_vru: 90, pl: 4, lp: 3, le: 3, tc: 0, sg: 'traffic_calming_petition' };
    const text = details('segments', [block]);
    expect(text).toContain(t.blockNoCalming);
    expect(text).toContain('Ask for traffic calming on this residential street');
    expect(text).toContain('The City lists 4 poles along this block, 3 with a lamp, all of them LED.');
    const arterial = details('segments', [{ ...block, cls: 2, name: 'N BROAD ST', sg: undefined }]);
    expect(arterial).toContain(t.blockArterial);
    expect(arterial).not.toContain('Ask for traffic calming on this residential street');
  });

  it('put what the block has beside a memorial’s traffic calming request', () => {
    expect(memorialCalmingLine({ tc: 0 })).toBe(t.memorialNoCalming);
    expect(memorialCalmingLine({ tc: 1, ty: 2024 })).toBe('Traffic calming on this block since 2024: the City lists 1 device.');
    expect(memorialCalmingLine({})).toBeNull();
    const memorials = read('../fixtures/data/tiles/streets.memorials.geojson') as { features: { properties: Record<string, unknown> }[] };
    const first = memorials.features[0]!.properties;
    expect(details('memorials', [first])).toContain(t.memorialNoCalming);
  });

  it('count the poles beside a street light reported out', () => {
    const route = reg.routes.find((r) => r.id === 'report_to_311');
    const body = textOf(render(ConditionDetails, { props: { layerId: 'dark_lights', properties: { id: 9011, name: 'N BROAD ST', n: 2, o: 2, d: '2026-09-30', pl: 4, lp: 3, le: 2 }, route } }).body);
    expect(body).toContain('Along this block the City lists 3 poles with a lamp, 2 of them LED.');
    const dumping = textOf(render(ConditionDetails, { props: { layerId: 'dumping', properties: { id: 1, n: 1, o: 0, pl: 4, lp: 3, le: 2 }, route } }).body);
    expect(dumping).not.toContain('poles');
  });
});

describe('a City shelter in the transit comfort lens', () => {
  it('counts as a shelter on the map, whatever OpenStreetMap says', () => {
    const layer = layerOf('transit_stops');
    const state = defaultState(reg, 'analysis');
    const answers = stopAnswerIndex(parseStopTable({ stops: { n1: { c: 1, sh: 0, bn: 0 } } }));
    const circle = styleFor(layer)!.layers({ layer, registry: reg, state, sourceId: 'tiles', sourceLayer: 'stops', stopAnswers: answers }).find((p) => p.id.endsWith(':circle')) as { paint: Record<string, unknown> };
    const parsed = createPropertyExpression(circle.paint['circle-color'], latest.paint_circle['circle-color'] as never);
    if (parsed.result !== 'success') throw new Error('bad expression');
    const colorOf = (properties: Record<string, unknown>) => {
      const c = parsed.value.evaluate({ zoom: 15 } as never, { type: 'Point', properties } as never) as { r: number; g: number; b: number };
      const hex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
      return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
    };
    // Every other factor at its most: with no shelter the stop is darkest; a City shelter lowers it.
    const factors = { md: 1, tc: 1, o: 'n1', f_riders: 100, f_shade: 100, f_heat: 100, f_hin: 100, f_wait: 100 };
    expect(colorOf(factors)).toBe(TRANSIT_RAMP[4]);
    expect(colorOf({ ...factors, cs: 1 })).not.toBe(TRANSIT_RAMP[4]);
  });

  it('says plainly where the City and OpenStreetMap disagree, and asks for a survey instead of a shelter', () => {
    const joined = joinStop(stop('sp1009'), TABLE);
    expect(joined.f_noshelter).toBe(0);
    expect(joined.sg).toBe('stop_survey,stop_bench_request');
    const view = describeComfort(reg, defaultState(reg, 'analysis'), stop('sp1009'), TABLE);
    expect(view.cityShelter).toBe(t.cityShelter(2));
    expect(view.disagree).toBe(t.disagree);
    expect(view.unsurveyed).toEqual([]);
    expect(view.lamps).toBe('The City lists 2 poles with a lamp within 30 meters of this stop, all LED.');
    const s = { registry: reg, state: defaultState(reg, 'analysis'), stopTable: TABLE, stopTableStatus: 'ok' } as unknown as AppStore;
    const body = textOf(render(TransitStopDetails, { props: { store: s, features: [stop('sp1009')] } }).body);
    expect(body).toContain(t.disagree);
    expect(body).toContain('Shelter: No');
    expect(body).not.toContain('Ask the City for a shelter at this stop');
  });

  it('agrees quietly where both have a shelter, and says when the City lists none', () => {
    const agree = describeComfort(reg, defaultState(reg, 'analysis'), stop('sp1003'), TABLE);
    expect(agree.cityShelter).toBe(t.cityShelter(1));
    expect(agree.disagree).toBeNull();
    // A City shelter OpenStreetMap has no answer about: the answer says both.
    const unsurveyed = describeComfort(reg, defaultState(reg, 'analysis'), { md: 1, tc: 1, sid: '7', cs: 1 }, TABLE);
    expect(unsurveyed.answers.find((a) => a.key === 'sh')?.value).toBe(t.answerCityShelter);
    expect(unsurveyed.answers.find((a) => a.key === 'bn')?.value).toBe(strings.stopAmenities.unknown);
    const none = describeComfort(reg, defaultState(reg, 'analysis'), stop('sp1002'), TABLE);
    expect(none.cityShelter).toBe(t.noCityShelter);
    expect(none.lamps).toBeNull();
    expect(stopLampsLine({ lp: 0 })).toBe(t.stopLamps(0, 0));
  });
});
