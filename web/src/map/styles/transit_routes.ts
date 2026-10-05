// SEPTA routes (docs/CONTRACTS.md section 4, `routes` in tiles/transit.pmtiles): the lines each
// route's trips follow, as quiet context under the stops. Colored by the kind of vehicle (`md`):
// buses slate, trolleys green, the subway and El deep blue and thicker, Regional Rail dark gray
// and dashed. Where routes share a street their lines lie on top of each other. Setting:
//   service  every route, or frequent routes only (every 15 minutes or better at midday on
//            weekdays where the route runs most often, `hm`)

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { hasMode } from './crashes.ts';
import { FREQUENT_MINUTES } from './transit_stops.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

export const ROUTE_COLORS = { bus: '#6b7f99', trolley: '#3a8f5c', metro: '#1d4f91', rail: '#4d4d4d' } as const;

const modes: ExpressionSpecification = ['to-number', ['get', 'md'], 0];
const RAIL: ExpressionSpecification = hasMode(8, modes);
const METRO: ExpressionSpecification = hasMode(4, modes);
const TROLLEY: ExpressionSpecification = hasMode(2, modes);

export function frequentOnly(ctx: LegendContext): boolean {
  return settingValue(ctx, 'service') === 'frequent';
}

export function routeFilter(ctx: LegendContext, rail: boolean): FilterSpecification {
  const conditions: ExpressionSpecification[] = [rail ? RAIL : ['!', RAIL]];
  if (frequentOnly(ctx)) conditions.push(['all', ['has', 'hm'], ['<=', ['to-number', ['get', 'hm'], 999], FREQUENT_MINUTES]]);
  return ['all', ...conditions] as FilterSpecification;
}

const color: ExpressionSpecification = ['case', METRO, ROUTE_COLORS.metro, TROLLEY, ROUTE_COLORS.trolley, ROUTE_COLORS.bus];
const width: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  ['case', METRO, 2, 0.8],
  14,
  ['case', METRO, 4, 1.8],
  17,
  ['case', METRO, 6, 3],
];

export const transitRoutes: StyleModule = {
  zIndex: 28,
  settings: ['service'],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    const layout = { 'line-join': 'round', 'line-cap': 'round' } as const;
    return [
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: routeFilter(ctx, false),
        layout,
        paint: { 'line-color': color, 'line-width': width, 'line-opacity': 0.8 },
      },
      {
        id: partId(ctx.layer.id, 'rail'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: routeFilter(ctx, true),
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': ROUTE_COLORS.rail,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 14, 2.5, 17, 4],
          'line-dasharray': [3, 2],
          'line-opacity': 0.8,
        },
      },
    ];
  },

  legend(ctx) {
    const t = strings.transit;
    const entries: LegendEntry[] = [
      { kind: 'line', label: t.routeBus, color: ROUTE_COLORS.bus, width: 2 },
      { kind: 'line', label: t.routeTrolley, color: ROUTE_COLORS.trolley, width: 2 },
      { kind: 'line', label: t.routeMetro, color: ROUTE_COLORS.metro, width: 4 },
      { kind: 'line', label: t.routeRail, color: ROUTE_COLORS.rail, width: 2 },
    ];
    entries.push({ kind: 'note', text: frequentOnly(ctx) ? t.frequentRoutes : t.allRoutes });
    return entries;
  },
};
