import { createPropertyExpression, featureFilter, latest } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { styleFor } from '../src/map/styles/index.ts';
import { ROUTE_COLORS } from '../src/map/styles/transit_routes.ts';
import { TRANSIT_NONE, TRANSIT_RAMP } from '../src/map/styles/transit_stops.ts';
import type { Layer, SettingValue } from '../src/registry/types.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import { strings } from '../src/strings.ts';
import { clock, describeStop, stopKind, waitWords } from '../src/transit/describe.ts';

const reg = loadRegistry();
const layer = (id: string) => reg.layers.find((l) => l.id === id)!;
const stops = layer('transit_stops');
const routes = layer('transit_routes');

type Part = LayerSpecification & { filter: unknown; paint: Record<string, unknown> };

function part(l: Layer, state: AppState, name: string): Part {
  const parts = styleFor(l)!.layers({ layer: l, registry: reg, state, sourceId: 'tiles', sourceLayer: l.source_layer });
  return parts.find((p) => p.id.endsWith(`:${name}`)) as Part;
}

function withSetting(l: Layer, id: string, value: SettingValue): AppState {
  const state = defaultState(reg, 'analysis');
  state.settings[l.id] = { ...state.settings[l.id], [id]: value };
  return state;
}

function shown(l: Layer, state: AppState, name: string, properties: Record<string, unknown>, type = 1): boolean {
  return featureFilter(part(l, state, name).filter as never).filter({ zoom: 15 } as never, { type, properties } as never);
}

function color(state: AppState, properties: Record<string, unknown>): string {
  const parsed = createPropertyExpression(part(stops, state, 'circle').paint['circle-color'], latest.paint_circle['circle-color'] as never);
  if (parsed.result !== 'success') throw new Error(JSON.stringify(parsed.value));
  const value = parsed.value.evaluate({ zoom: 15 } as never, { type: 'Point', properties } as never) as { r: number; g: number; b: number };
  const hex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${hex(value.r)}${hex(value.g)}${hex(value.b)}`;
}

const BUS = { md: 1, hm: 9, b: 848 };
const QUIET_BUS = { md: 1, hm: 60 };
const NO_MIDDAY = { md: 1 };
const SUBWAY = { md: 4, hm: 5 };
const RAIL = { md: 8, hm: 60 };

describe('the stops layer', () => {
  it('is off by default in both views until the transit comfort lens arrives', () => {
    expect(stops.default).toEqual({ field: false, analysis: false });
    expect(routes.default).toEqual({ field: false, analysis: false });
    expect(stops.group).toBe('transit');
  });

  it('shows bus and trolley stops, and stations only when asked', () => {
    const state = defaultState(reg, 'analysis');
    expect(shown(stops, state, 'circle', BUS)).toBe(true);
    expect(shown(stops, state, 'circle', { md: 3, hm: 7 })).toBe(true);
    expect(shown(stops, state, 'circle', SUBWAY)).toBe(false);
    expect(shown(stops, state, 'circle', RAIL)).toBe(false);
    const all = withSetting(stops, 'stations', true);
    expect(shown(stops, all, 'circle', SUBWAY)).toBe(true);
    expect(shown(stops, all, 'circle', RAIL)).toBe(true);
  });

  it('filters frequent service and long waits by the midday wait', () => {
    const frequent = withSetting(stops, 'service', 'frequent');
    expect(shown(stops, frequent, 'circle', BUS)).toBe(true);
    expect(shown(stops, frequent, 'circle', { md: 1, hm: 15 })).toBe(true);
    expect(shown(stops, frequent, 'circle', { md: 1, hm: 16 })).toBe(false);
    expect(shown(stops, frequent, 'circle', NO_MIDDAY)).toBe(false);
    const long = withSetting(stops, 'service', 'long_wait');
    expect(shown(stops, long, 'circle', QUIET_BUS)).toBe(true);
    expect(shown(stops, long, 'circle', NO_MIDDAY)).toBe(true);
    expect(shown(stops, long, 'circle', { md: 1, hm: 30 })).toBe(false);
    expect(shown(stops, long, 'circle', BUS)).toBe(false);
  });

  it('colors by the midday wait, darkest for the most frequent, hollow without midday service', () => {
    const state = defaultState(reg, 'analysis');
    expect(color(state, { md: 1, hm: 5 })).toBe(TRANSIT_RAMP[4]);
    expect(color(state, { md: 1, hm: 15 })).toBe(TRANSIT_RAMP[3]);
    expect(color(state, { md: 1, hm: 25 })).toBe(TRANSIT_RAMP[2]);
    expect(color(state, { md: 1, hm: 60 })).toBe(TRANSIT_RAMP[1]);
    expect(color(state, { md: 1, hm: 120 })).toBe(TRANSIT_RAMP[0]);
    expect(color(state, NO_MIDDAY)).toBe(TRANSIT_NONE);
  });

  it('colors by boardings, hollow where SEPTA has no count (never a guess)', () => {
    const state = withSetting(stops, 'color', 'boardings');
    expect(color(state, { md: 1, b: 0 })).toBe(TRANSIT_RAMP[0]);
    expect(color(state, { md: 1, b: 49 })).toBe(TRANSIT_RAMP[1]);
    expect(color(state, { md: 1, b: 848 })).toBe(TRANSIT_RAMP[3]);
    expect(color(state, { md: 1, b: 4760 })).toBe(TRANSIT_RAMP[4]);
    expect(color(state, { md: 1, hm: 5 })).toBe(TRANSIT_NONE);
  });

  it('explains each coloring in its legend, darkest first', () => {
    const legend = (state: AppState) => styleFor(stops)!.legend({ layer: stops, registry: reg, state });
    const wait = legend(defaultState(reg, 'analysis'));
    const bins = wait.find((e) => e.kind === 'bins');
    expect(bins?.kind === 'bins' && bins.bins.map((b) => b.label)).toEqual(strings.transit.waitBins);
    expect(bins?.kind === 'bins' && bins.bins[0]!.color).toBe(TRANSIT_RAMP[4]);
    const counts = legend(withSetting(stops, 'color', 'boardings'));
    expect(counts).toContainEqual({ kind: 'note', text: strings.transit.boardingsNote });
    expect(legend(withSetting(stops, 'stations', true)).some((e) => e.kind === 'circle' && e.label === strings.transit.station)).toBe(true);
  });

  it('opens the details panel when tapped', () => {
    expect(styleFor(stops)!.clickable).toEqual(['circle']);
    expect(strings.streets.detailsTitle('transit_stops')).toBe('Stop');
  });
});

describe('the routes layer', () => {
  it('draws Regional Rail apart, dashed, and the other routes by vehicle', () => {
    const state = defaultState(reg, 'analysis');
    expect(shown(routes, state, 'line', { md: 1 }, 2)).toBe(true);
    expect(shown(routes, state, 'line', { md: 8 }, 2)).toBe(false);
    expect(shown(routes, state, 'rail', { md: 8 }, 2)).toBe(true);
    expect(part(routes, state, 'rail').paint['line-dasharray']).toEqual([3, 2]);
    expect(JSON.stringify(part(routes, state, 'line').paint['line-color'])).toContain(ROUTE_COLORS.metro);
  });

  it('can show frequent routes only', () => {
    const frequent = withSetting(routes, 'service', 'frequent');
    expect(shown(routes, frequent, 'line', { md: 1, hm: 11 }, 2)).toBe(true);
    expect(shown(routes, frequent, 'line', { md: 1, hm: 30 }, 2)).toBe(false);
    expect(shown(routes, frequent, 'line', { md: 1 }, 2)).toBe(false);
    expect(shown(routes, frequent, 'rail', { md: 8, hm: 60 }, 2)).toBe(false);
  });
});

describe('what a stop says', () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/data/tiles/transit.stops.geojson', import.meta.url), 'utf8')) as {
    features: { properties: Record<string, unknown> }[];
  };
  const stop = (id: string) => fixture.features.find((f) => f.properties.id === id)!.properties;

  it('reads SEPTA service day times, which run past midnight', () => {
    expect(clock(410)).toBe('6:50 AM');
    expect(clock(720)).toBe('12:00 PM');
    expect(clock(24)).toBe('12:24 AM');
    expect(clock(1530)).toBe('1:30 AM');
  });

  it('says how often in minutes, or how few when an average would mislead', () => {
    expect(waitWords('bus', 9, 240)).toBe('a bus about every 9 minutes');
    expect(waitWords('busTrolley', 1, 120)).toBe('a bus or trolley about every minute');
    expect(waitWords('bus', 240, 240)).toBe('only one bus');
    expect(waitWords('metro', 120, 240)).toBe('only 2 trains');
    expect(stopKind(3)).toBe('busTrolley');
    expect(stopKind(8)).toBe('rail');
  });

  it('describes a frequent stop with its routes, waits, times and riders', () => {
    const view = describeStop(stop('sp1002'));
    expect(view.title).toBe('N Broad St & Sample 2 St');
    expect(view.kind).toBe('Bus stop');
    expect(view.routes).toBe('Routes: 4, 16.');
    expect(view.often).toContain('Weekday mornings from 7 to 9: a bus about every 6 minutes.');
    expect(view.often).toContain('Weekdays from 10 to 2: a bus about every 9 minutes.');
    expect(view.often).toContain('140 departures on a typical weekday, 90 on Saturdays and 70 on Sundays.');
    // One late bus at 1:28 at night is a last departure, not service all night.
    expect(view.often).toContain('On weekdays the first departs at 5:05 AM and the last at 1:28 AM after midnight.');
    expect(view.often).toContain('After 8 at night on weekdays: 16 departures.');
    expect(view.often).not.toContain(strings.transit.allNight);
    expect(view.riders).toEqual(["About 848 people get on here on an average weekday (SEPTA's count, Spring 2026)."]);
    expect(view.details).toEqual(['SEPTA stop number 1002.', 'SEPTA lists this stop as reachable in a wheelchair.']);
  });

  it('says when buses run all night (a departure in every hour from 1 to 4) instead of first and last times', () => {
    const view = describeStop(stop('sp1001'));
    expect(view.often).toContain(strings.transit.allNight);
    expect(view.often.some((line) => line.startsWith('On weekdays the first'))).toBe(false);
  });

  it('never invents a count, and says where a carried over count came from', () => {
    expect(describeStop(stop('sp1004')).riders).toEqual([strings.transit.noBoardings]);
    const renumbered = describeStop(stop('sp1105'));
    expect(renumbered.riders).toEqual([
      "About 4 people get on here on an average weekday (SEPTA's count, Spring 2026).",
      'Counted at SEPTA stop 1105, which this stop replaced.',
    ]);
    expect(renumbered.details).toContain('Before that it was SEPTA stop 1105.');
    expect(renumbered.details).toContain('SEPTA lists this stop as not reachable in a wheelchair.');
    expect(describeStop(stop('sp1008')).riders[0]).toBe("Almost no one gets on here on an average weekday (SEPTA's count, Spring 2026).");
  });

  it('names stations and says SEPTA counts no platforms', () => {
    const subway = describeStop(stop('sp1006'));
    expect(subway.title).toBe('Sample station');
    expect(subway.kind).toBe('Subway or El station');
    expect(subway.riders).toEqual([strings.transit.noStationCounts]);
    expect(subway.often).toContain('Weekdays from 10 to 2: a train about every 5 minutes.');
    expect(describeStop(stop('sr90009')).title).toBe('Sample Regional Rail Station');
    expect(describeStop(stop('sr90009')).riders).toEqual([strings.transit.noRailCounts]);
  });

  it('says plainly when a stop has no midday or no weekday service', () => {
    const quiet = describeStop(stop('sp1008'));
    expect(quiet.often).toContain('Weekdays from 10 to 2: none.');
    expect(describeStop({ md: 1, ts: 4, tu: 0, hs: 120 }).often).toContain(strings.transit.noWeekday);
  });
});
