// SEPTA stops (docs/CONTRACTS.md section 4, `stops` in tiles/transit.pmtiles): one small circle
// per place people board, colored on a teal to deep blue scale (ColorBrewer GnBu), clear of the
// lots' greens, the High Injury Network's amber and the memorials' violet. Stations of the
// subway, the El and Regional Rail are a little larger, with a dark ring. Settings:
//   service   any service; frequent service (a bus or train every 15 minutes or better at
//             midday on weekdays); or long waits (less often than every 30 minutes, or none)
//   color     priority under the transit comfort lens (the first registry lens for stops; the
//             score is computed in the style from the stop's factor fields, so moving a lens
//             slider recolors the stops at once), how often a bus or train comes at midday
//             (`hm`, minutes), or how many people get on each weekday (`b`, SEPTA's count).
//             Stops without a score, a midday service or a count are hollow and gray.
//   stations  off: bus and trolley stops only (bits 1 and 2 of `md`); on: every stop and station
// Stops appear from zoom 12, a few neighborhoods across; the tiles carry them from there.

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import type { Lens } from '../../registry/types.ts';
import { strings } from '../../strings.ts';
import { lensColorExpression, lensScoreExpression, type ColorRamp } from '../lens.ts';
import { hasMode } from './crashes.ts';
import { SELECTED } from './palette.ts';
import {
  highlightFilter,
  partId,
  settingValue,
  sourceKeys,
  type LegendContext,
  type LegendEntry,
  type StyleContext,
  type StyleModule,
} from './types.ts';

/** Teal to deep blue, light to dark: long waits or few riders light, frequent or busy dark. */
export const TRANSIT_RAMP = ['#d5eecf', '#a8ddb5', '#6cc3c6', '#2b8cbe', '#08589e'] as const;
/** A stop with no midday service or no SEPTA count: hollow, with a gray ring. */
export const TRANSIT_NONE = '#ffffff';
export const TRANSIT_NONE_RING = '#8a9099';
export const TRANSIT_RING = '#ffffff';
export const STATION_RING = '#1d2b3a';
/**
 * Priority under the transit comfort lens, low to high, on the same scale: a stop with no score
 * (a station, or no data for any weighted factor) is hollow, and when every weight is off every
 * stop is one quiet blue gray.
 */
export const TRANSIT_PRIORITY_RAMP: ColorRamp = { stops: TRANSIT_RAMP, noData: TRANSIT_NONE, allOff: '#9fb3bd' };

/** Upper ends of the midday wait classes, in minutes (the last class is everything longer). */
export const WAIT_BINS = [10, 15, 30, 60] as const;
/** Lower ends of the weekday boardings classes. */
export const BOARDING_BINS = [10, 50, 200, 1000] as const;
/** Frequent service: a bus or train at least this often at midday, in minutes. */
export const FREQUENT_MINUTES = 15;
/** Long waits: less often than this at midday, in minutes, or no midday service at all. */
export const LONG_WAIT_MINUTES = 30;
export const MIN_ZOOM = 12;

const modes: ExpressionSpecification = ['to-number', ['get', 'md'], 0];
const wait: ExpressionSpecification = ['to-number', ['get', 'hm'], 0];
const boardings: ExpressionSpecification = ['to-number', ['get', 'b'], 0];
/** A stop that buses or trolleys use (as opposed to only the subway, the El or Regional Rail). */
export const SURFACE: ExpressionSpecification = ['any', hasMode(1, modes), hasMode(2, modes)];
const STATION: ExpressionSpecification = ['!', SURFACE];

export type ColorBy = 'lens' | 'wait' | 'boardings';

/** The lens that colors stops: the first registry lens that applies to stops. */
export function stopLens(ctx: Pick<LegendContext, 'registry'>): Lens | null {
  return ctx.registry.lenses.find((l) => l.applies_to === 'stop') ?? null;
}

export function colorBy(ctx: LegendContext): ColorBy {
  const value = settingValue(ctx, 'color');
  if (value === 'boardings' || value === 'wait') return value;
  return stopLens(ctx) ? 'lens' : 'wait';
}

/** The lens score of a stop as a style expression, or null when every weight is off. */
export function stopScore(ctx: LegendContext): ExpressionSpecification | null {
  const lens = stopLens(ctx);
  return lens ? lensScoreExpression(lens, ctx.state.weights[lens.id]) : null;
}

export function withStations(ctx: LegendContext): boolean {
  return settingValue(ctx, 'stations') === true;
}

export function stopFilter(ctx: LegendContext): FilterSpecification {
  const conditions: ExpressionSpecification[] = [];
  if (!withStations(ctx)) conditions.push(SURFACE);
  const service = settingValue(ctx, 'service');
  if (service === 'frequent') conditions.push(['all', ['has', 'hm'], ['<=', wait, FREQUENT_MINUTES]]);
  else if (service === 'long_wait') conditions.push(['any', ['!', ['has', 'hm']], ['>', wait, LONG_WAIT_MINUTES]]);
  return ['all', ...conditions] as FilterSpecification;
}

/** The fill color of a stop under the chosen coloring. */
export function stopColor(by: ColorBy, ctx: LegendContext): ExpressionSpecification | string {
  if (by === 'lens') {
    const lens = stopLens(ctx);
    return lens ? lensColorExpression(lens, ctx.state.weights[lens.id], TRANSIT_PRIORITY_RAMP) : TRANSIT_PRIORITY_RAMP.allOff;
  }
  const [c0, c1, c2, c3, c4] = TRANSIT_RAMP;
  if (by === 'boardings') {
    const [b1, b2, b3, b4] = BOARDING_BINS;
    return ['case', ['!', ['has', 'b']], TRANSIT_NONE, ['step', boardings, c0, b1, c1, b2, c2, b3, c3, b4, c4]];
  }
  const [w1, w2, w3, w4] = WAIT_BINS;
  // Shorter waits are darker: every 10 minutes or better is the darkest class.
  return [
    'case',
    ['!', ['has', 'hm']],
    TRANSIT_NONE,
    ['<=', wait, w1],
    c4,
    ['<=', wait, w2],
    c3,
    ['<=', wait, w3],
    c2,
    ['<=', wait, w4],
    c1,
    c0,
  ];
}

function hollow(by: ColorBy, ctx: LegendContext): ExpressionSpecification | boolean {
  if (by === 'lens') {
    const score = stopScore(ctx);
    return score ? ['<', score, 0] : false;
  }
  return by === 'boardings' ? ['!', ['has', 'b']] : ['!', ['has', 'hm']];
}

/** Which stops draw on top: the higher priority, the busier, or the more frequent. */
function sortKey(by: ColorBy, ctx: LegendContext): ExpressionSpecification | number {
  if (by === 'lens') return stopScore(ctx) ?? 0;
  return by === 'boardings' ? boardings : ['-', 0, ['to-number', ['get', 'hm'], 999]];
}

/** Stations are a little larger than stops. One zoom curve, with the size for each kind inside. */
const radius: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  12,
  ['case', STATION, 3.5, 2.2],
  13,
  ['case', STATION, 4.5, 3],
  15,
  ['case', STATION, 7, 5],
  17,
  ['case', STATION, 10, 7.5],
];

export const transitStops: StyleModule = {
  zIndex: 42,
  settings: ['service', 'color', 'stations'],
  clickable: ['circle'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const by = colorBy(ctx);
    const filter = stopFilter(ctx);
    return [
      {
        id: partId(ctx.layer.id, 'circle'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: MIN_ZOOM,
        filter,
        // Higher priority (or busier, or more frequent) stops draw on top.
        layout: { 'circle-sort-key': sortKey(by, ctx) },
        paint: {
          'circle-color': stopColor(by, ctx),
          'circle-radius': radius,
          'circle-stroke-color': ['case', STATION, STATION_RING, hollow(by, ctx), TRANSIT_NONE_RING, TRANSIT_RING],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 1, 17, 1.6],
        },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: MIN_ZOOM,
        filter: ['all', filter, highlightFilter(ctx)] as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 15, 9, 17, 12],
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend(ctx) {
    const t = strings.transit;
    const by = colorBy(ctx);
    if (by === 'lens') return lensLegend(ctx);
    const labels = by === 'boardings' ? t.boardingBins : t.waitBins;
    // Darkest first: the most frequent service, or the most people.
    const colors = [...TRANSIT_RAMP].reverse();
    const entries: LegendEntry[] = [
      { kind: 'bins', title: by === 'boardings' ? t.boardingsTitle : t.waitTitle, bins: labels.map((label, i) => ({ color: colors[i]!, label })), opacity: 1 },
      { kind: 'circle', label: by === 'boardings' ? t.noCount : t.noMidday, fill: TRANSIT_NONE, stroke: TRANSIT_NONE_RING, radius: 4 },
    ];
    // Stations have a dark ring; SEPTA counts no platforms, so colored by riders they are hollow.
    const stationFill = by === 'boardings' ? TRANSIT_NONE : TRANSIT_RAMP[2];
    if (withStations(ctx)) entries.push({ kind: 'circle', label: t.station, fill: stationFill, stroke: STATION_RING, radius: 6 });
    if (by === 'boardings') entries.push({ kind: 'note', text: t.boardingsNote });
    entries.push({ kind: 'note', text: t.zoomNote });
    return entries;
  },
};

/** The legend under the transit comfort lens: the priority scale, and what hollow means. */
function lensLegend(ctx: LegendContext): LegendEntry[] {
  const t = strings.transit;
  const entries: LegendEntry[] = [];
  if (stopScore(ctx)) {
    entries.push({ kind: 'ramp', title: t.lensTitle, stops: TRANSIT_RAMP, low: strings.lens.legendLow, high: strings.lens.legendHigh });
    entries.push({ kind: 'note', text: t.lensUnsurveyed });
  } else {
    entries.push({ kind: 'note', text: strings.lens.allOffFor('stop') });
  }
  if (withStations(ctx)) {
    entries.push({ kind: 'circle', label: t.station, fill: TRANSIT_NONE, stroke: STATION_RING, radius: 6 });
    entries.push({ kind: 'note', text: t.lensStations });
  }
  entries.push({ kind: 'note', text: t.zoomNote });
  return entries;
}
