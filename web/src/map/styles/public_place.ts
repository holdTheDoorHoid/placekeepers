// Public places from the City (M3.5): drinking fountains in parks, Free Library branches,
// recreation centers, and pools and spraygrounds (`park_water`, `libraries`, `recreation` and
// `pools` in tiles/places.pmtiles, docs/CONTRACTS.md section 4), drawn by this style: a dot
// larger than the amenities from OpenStreetMap, with a white ring. Pools, spraygrounds and
// sprinklers each have their own shade of blue; one not in service this year is a hollow gray
// ring. Setting (pools only):
//   show  only those in service this year (`st` 1), or all of them

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { NOT_IN_SERVICE_RING, PLACE_COLORS, PLACE_RING, POOL_COLORS, SELECTED } from './palette.ts';
import { highlightFilter, partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

const FALLBACK = '#5f6870';
const kind: ExpressionSpecification = ['to-number', ['get', 'k'], 1];
const inService: ExpressionSpecification = ['==', ['to-number', ['get', 'st'], -1], 1];

/** Pools layers are told apart by their kind property, the others by their layer id. */
export function isPools(ctx: LegendContext): boolean {
  return ctx.layer.source_layer === 'pools';
}

export function inServiceOnly(ctx: LegendContext): boolean {
  if (!isPools(ctx)) return false;
  const value = settingValue(ctx, 'show');
  return (typeof value === 'string' ? value : 'in_service') !== 'all';
}

const radius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5.5, 17, 9];

export const publicPlace: StyleModule = {
  zIndex: 43,
  settings: ['show'],
  clickable: ['dot', 'ring'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const pools = isPools(ctx);
    const color: ExpressionSpecification | string = pools
      ? ['match', kind, 2, POOL_COLORS[2]!, 3, POOL_COLORS[3]!, POOL_COLORS[1]!]
      : (PLACE_COLORS[ctx.layer.id] ?? FALLBACK);
    const parts: LayerSpecification[] = [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        ...(pools ? { filter: inService as FilterSpecification } : {}),
        paint: {
          'circle-color': color,
          'circle-radius': radius,
          'circle-stroke-color': PLACE_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 2],
        },
      },
    ];
    // A pool or sprayground not in service this year (or not known): a hollow ring, hidden unless
    // "all" is chosen. Every place layer has this part, so a click can always ask for it; only
    // the pools ever draw it.
    const nothing: FilterSpecification = ['==', ['literal', 1], 0];
    parts.push({
      id: partId(ctx.layer.id, 'ring'),
      type: 'circle',
      ...sourceKeys(ctx),
      filter: pools && !inServiceOnly(ctx) ? (['!', inService] as FilterSpecification) : nothing,
      paint: {
        'circle-color': '#ffffff',
        'circle-opacity': 0.85,
        'circle-radius': radius,
        'circle-stroke-color': NOT_IN_SERVICE_RING,
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 2],
      },
    });
    parts.push({
      id: partId(ctx.layer.id, 'selected'),
      type: 'circle',
      ...sourceKeys(ctx),
      filter: highlightFilter(ctx) as FilterSpecification,
      paint: {
        'circle-color': 'rgba(0, 0, 0, 0)',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 7, 14, 9.5, 17, 13],
        'circle-stroke-color': SELECTED,
        'circle-stroke-width': 2.5,
      },
    });
    return parts;
  },

  legend(ctx) {
    const t = strings.places;
    if (!isPools(ctx)) {
      return [{ kind: 'circle', label: t.legend[ctx.layer.id] ?? ctx.layer.label, fill: PLACE_COLORS[ctx.layer.id] ?? FALLBACK, stroke: PLACE_RING, radius: 6 }];
    }
    const entries: LegendEntry[] = [1, 2, 3].map((k) => ({ kind: 'circle', label: t.poolLegend[k]!, fill: POOL_COLORS[k]!, stroke: PLACE_RING, radius: 6 }));
    if (!inServiceOnly(ctx)) entries.push({ kind: 'circle', label: t.notInService, fill: '#ffffff', stroke: NOT_IN_SERVICE_RING, radius: 6 });
    entries.push({ kind: 'note', text: t.poolsShown[inServiceOnly(ctx) ? 'in_service' : 'all']! });
    entries.push({ kind: 'note', text: t.seasonNote });
    return entries;
  },
};
