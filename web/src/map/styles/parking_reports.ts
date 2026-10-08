// Parking problems reported with Laser Vision (issue #37): where people using Philly Bike
// Action's app reported vehicles blocking the way, counted per H3 cell about a block across
// (`parking` in tiles/parking.pmtiles, docs/CONTRACTS.md section 4). Each cell comes twice: its
// center, which draws a heat map zoomed out, weighted by the cell's count, and its hexagon, which
// takes over close in (from zoom 13 to 14) in the same blues, with fixed classes so a shade means
// the same number everywhere, and opens its counts on a tap. Never a single report: the pipeline
// publishes only cells, and kinds within them, with at least 5 reports. Setting:
//   kind  every report (`n`), or one kind: on a sidewalk (`sw`), in a bike lane (`bl`), on a
//         crosswalk (`cw`), on a corner (`co`) or blocking a curb ramp (`rp`)

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { MIN_REPORTS, PARKING_FIELDS, isParkingChoice, parkingWindowText, type ParkingChoice } from '../../streets/parking.ts';
import { PARKING_OPACITY, PARKING_RAMP, SELECTED, SELECTED_CASING } from './palette.ts';
import { highlightFilter, partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

/** Where the heat map gives way to the hexagons: it fades out as they fade in. */
const HEX_FROM = 13;
const HEAT_UNTIL = 14;

/**
 * How much one cell's count adds to the heat map, from the share of cells of the 2026-10-08 data
 * at that count: every report about the 90th percentile of cells, one kind a little lower.
 */
const WEIGHT_AT: Record<'all' | 'kind', readonly [number, number, number]> = {
  all: [MIN_REPORTS, 40, 130],
  kind: [MIN_REPORTS, 30, 100],
};

/** The hexagons' classes: where the second to fifth start (the first starts at 5). */
export const HEX_BREAKS: Record<'all' | 'kind', readonly [number, number, number, number]> = {
  all: [10, 25, 50, 100],
  kind: [10, 20, 40, 80],
};

export function parkingChoice(ctx: LegendContext): ParkingChoice {
  const value = settingValue(ctx, 'kind');
  return isParkingChoice(value) ? value : 'all';
}

const scale = (choice: ParkingChoice) => (choice === 'all' ? 'all' : 'kind');

function count(choice: ParkingChoice): ExpressionSpecification {
  return ['to-number', ['get', PARKING_FIELDS[choice]], 0];
}

const isPoint: ExpressionSpecification = ['==', ['geometry-type'], 'Point'];
const isPolygon: ExpressionSpecification = ['==', ['geometry-type'], 'Polygon'];

export const parkingReports: StyleModule = {
  zIndex: 14,
  settings: ['kind'],
  clickable: ['cells'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const choice = parkingChoice(ctx);
    const value = count(choice);
    const [low, mid, high] = WEIGHT_AT[scale(choice)];
    const [b1, b2, b3, b4] = HEX_BREAKS[scale(choice)];
    const [c1, c2, c3, c4, c5] = PARKING_RAMP;
    const shown: ExpressionSpecification = ['>=', value, MIN_REPORTS];
    return [
      {
        id: partId(ctx.layer.id, 'heat'),
        type: 'heatmap',
        ...sourceKeys(ctx),
        maxzoom: HEAT_UNTIL,
        filter: ['all', isPoint, shown] as FilterSpecification,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], value, low, 0.12, mid, 0.6, high, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 12, 1.2, 14, 1.6],
          'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 9, 5, 12, 16, 14, 48],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(208, 209, 230, 0)',
            0.12,
            c1,
            0.3,
            c2,
            0.5,
            c3,
            0.75,
            c4,
            1,
            c5,
          ],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0.8, HEAT_UNTIL, 0],
        },
      },
      {
        id: partId(ctx.layer.id, 'cells'),
        type: 'fill',
        ...sourceKeys(ctx),
        minzoom: HEX_FROM,
        filter: ['all', isPolygon, shown] as FilterSpecification,
        paint: {
          'fill-color': ['step', value, c1, b1, c2, b2, c3, b3, c4, b4, c5],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], HEX_FROM, 0, HEAT_UNTIL, PARKING_OPACITY, 17, PARKING_OPACITY * 0.7],
          'fill-outline-color': 'rgba(255, 255, 255, 0.8)',
        },
      },
      {
        id: partId(ctx.layer.id, 'selected-casing'),
        type: 'line',
        ...sourceKeys(ctx),
        minzoom: HEX_FROM,
        filter: ['all', isPolygon, highlightFilter(ctx)] as FilterSpecification,
        paint: { 'line-color': SELECTED_CASING, 'line-width': 5 },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'line',
        ...sourceKeys(ctx),
        minzoom: HEX_FROM,
        filter: ['all', isPolygon, highlightFilter(ctx)] as FilterSpecification,
        paint: { 'line-color': SELECTED, 'line-width': 2.5 },
      },
    ];
  },

  legend(ctx) {
    const t = strings.parking;
    const choice = parkingChoice(ctx);
    const breaks = HEX_BREAKS[scale(choice)];
    const lows = [MIN_REPORTS, ...breaks];
    const entries: LegendEntry[] = [
      {
        kind: 'ramp',
        title: t.heatTitle(t.kinds[choice]!, parkingWindowText(ctx.manifest)),
        stops: [...PARKING_RAMP],
        low: t.fewer,
        high: t.more,
      },
      {
        kind: 'bins',
        title: t.binsTitle,
        opacity: PARKING_OPACITY,
        bins: PARKING_RAMP.map((color, i) => ({ color, label: t.bins(lows[i]!, i < lows.length - 1 ? lows[i + 1]! - 1 : null) })),
      },
      { kind: 'note', text: t.threshold(MIN_REPORTS) },
      { kind: 'note', text: t.oneApp },
    ];
    return entries;
  },
};
