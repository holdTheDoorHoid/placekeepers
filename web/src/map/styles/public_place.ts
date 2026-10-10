// Public places from the City (M3.5): drinking fountains in parks, Free Library branches,
// recreation centers, and pools and spraygrounds (`park_water`, `libraries`, `recreation` and
// `pools` in tiles/places.pmtiles, docs/CONTRACTS.md section 4), drawn by this style: a dot
// larger than the amenities from OpenStreetMap, with a white ring. Pools, spraygrounds and
// sprinklers each have their own shade of blue; one not in service this year is a hollow gray
// ring. Setting (pools only):
//   show  only those in service this year (`st` 1), or all of them
//
// From M4.7 (issue #43) it also draws the City's warming and cooling sites (`cooling`) and the
// playgrounds (`playgrounds`). A site listed as open is a filled dot, one listed as closed (or
// with no status) a hollow ring of the same color. Settings (sites only):
//   kind  sites for heat or cold (any), for cooling (`c` 1) or for warming (`w` 1)
//   show  all of them, or only those listed as open (`st` 1)
// One place, one marker: while the sites are on, a library or recreation center that is also a
// site (`cc`) is left to the site's marker.

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { listedOn } from '../../amenities/describe.ts';
import { strings } from '../../strings.ts';
import { NOT_IN_SERVICE_RING, PLACE_COLORS, PLACE_RING, POOL_COLORS, POOL_RING, SELECTED } from './palette.ts';
import { highlightFilter, partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

const FALLBACK = '#5f6870';
const kind: ExpressionSpecification = ['to-number', ['get', 'k'], 1];
const inService: ExpressionSpecification = ['==', ['to-number', ['get', 'st'], -1], 1];

/** Pools layers are told apart by their kind property, the others by their layer id. */
export function isPools(ctx: LegendContext): boolean {
  return ctx.layer.source_layer === 'pools';
}

/** The City's warming and cooling sites (M4.7). */
export function isCooling(ctx: LegendContext): boolean {
  return ctx.layer.source_layer === 'cooling';
}

/** The registry layer that draws the warming and cooling sites. */
export const COOLING_LAYER = 'cooling_centers';

export function inServiceOnly(ctx: LegendContext): boolean {
  if (!isPools(ctx)) return false;
  const value = settingValue(ctx, 'show');
  return (typeof value === 'string' ? value : 'in_service') !== 'all';
}

/** Which sites to show: for heat or cold, cooling only or warming only. */
export function coolingKind(ctx: LegendContext): 'any' | 'cooling' | 'warming' {
  const value = settingValue(ctx, 'kind');
  return value === 'cooling' || value === 'warming' ? value : 'any';
}

/** True when only the sites listed as open are shown. */
export function openOnly(ctx: LegendContext): boolean {
  return isCooling(ctx) && settingValue(ctx, 'show') === 'open';
}

/**
 * True when this layer's places that are also a warming or cooling site are left to the site's
 * marker: a library or recreation center layer, while the sites are on.
 */
export function leftToSites(ctx: LegendContext): boolean {
  const source = ctx.layer.source_layer;
  return (source === 'libraries' || source === 'recreation') && ctx.state.layers.includes(COOLING_LAYER);
}

const radius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5.5, 17, 9];

export const publicPlace: StyleModule = {
  zIndex: 43,
  settings: ['show', 'kind'],
  clickable: ['dot', 'ring'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const pools = isPools(ctx);
    const cooling = isCooling(ctx);
    const color: ExpressionSpecification | string = pools
      ? ['match', kind, 2, POOL_COLORS[2]!, 3, POOL_COLORS[3]!, POOL_COLORS[1]!]
      : (PLACE_COLORS[ctx.layer.id] ?? FALLBACK);
    // What every part of this layer shows: the sites of the chosen kind, and no library or
    // recreation center the sites' layer already marks.
    const shown: ExpressionSpecification[] = [];
    if (cooling && coolingKind(ctx) !== 'any') shown.push(['==', ['to-number', ['get', coolingKind(ctx) === 'cooling' ? 'c' : 'w'], -1], 1]);
    if (leftToSites(ctx)) shown.push(['!', ['has', 'cc']]);
    const within = (filter: ExpressionSpecification | null): FilterSpecification | undefined => {
      const all = filter ? [...shown, filter] : shown;
      if (all.length === 0) return undefined;
      return (all.length === 1 ? all[0] : ['all', ...all]) as FilterSpecification;
    };
    const dotFilter = within(pools || cooling ? inService : null);
    const parts: LayerSpecification[] = [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        ...(dotFilter ? { filter: dotFilter } : {}),
        paint: {
          'circle-color': color,
          'circle-radius': radius,
          'circle-stroke-color': pools ? POOL_RING : PLACE_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 2],
        },
      },
    ];
    // A pool or sprayground not in service this year (or not known): a hollow ring, hidden unless
    // "all" is chosen; a warming or cooling site listed as closed (or with no status): a hollow
    // ring of its color, unless only the open ones are shown. Every place layer has this part, so
    // a click can always ask for it.
    const nothing: FilterSpecification = ['==', ['literal', 1], 0];
    const ringShown = (pools && !inServiceOnly(ctx)) || (cooling && !openOnly(ctx));
    parts.push({
      id: partId(ctx.layer.id, 'ring'),
      type: 'circle',
      ...sourceKeys(ctx),
      filter: ringShown ? within(['!', inService])! : nothing,
      paint: {
        'circle-color': '#ffffff',
        'circle-opacity': 0.85,
        'circle-radius': radius,
        'circle-stroke-color': cooling ? (PLACE_COLORS[ctx.layer.id] ?? FALLBACK) : NOT_IN_SERVICE_RING,
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, cooling ? 1.5 : 1, 16, cooling ? 2.5 : 2],
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
    if (isCooling(ctx)) {
      // No credit line: the City states no license for this list, and the owner decided to show
      // it without one (2026-10-09). The date it was copied, and that it is not live, instead.
      const fill = PLACE_COLORS[ctx.layer.id] ?? FALLBACK;
      const entries: LegendEntry[] = [{ kind: 'circle', label: t.cooling.legendOpen, fill, stroke: PLACE_RING, radius: 6 }];
      if (!openOnly(ctx)) entries.push({ kind: 'circle', label: t.cooling.legendClosed, fill: '#ffffff', stroke: fill, radius: 6 });
      entries.push({ kind: 'note', text: t.cooling.kindShown[coolingKind(ctx)]! });
      const listed = listedOn(ctx.manifest ?? null);
      entries.push({ kind: 'note', text: t.cooling.asListed(listed.copied, listed.changed) });
      if (ctx.state.layers.includes('libraries') || ctx.state.layers.includes('recreation_centers')) entries.push({ kind: 'note', text: t.cooling.oneMarker });
      return entries;
    }
    if (!isPools(ctx)) {
      return [{ kind: 'circle', label: t.legend[ctx.layer.id] ?? ctx.layer.label, fill: PLACE_COLORS[ctx.layer.id] ?? FALLBACK, stroke: PLACE_RING, radius: 6 }];
    }
    const entries: LegendEntry[] = [1, 2, 3].map((k) => ({ kind: 'circle', label: t.poolLegend[k]!, fill: POOL_COLORS[k]!, stroke: POOL_RING, radius: 6 }));
    if (!inServiceOnly(ctx)) entries.push({ kind: 'circle', label: t.notInService, fill: '#ffffff', stroke: NOT_IN_SERVICE_RING, radius: 6 });
    entries.push({ kind: 'note', text: t.poolsShown[inServiceOnly(ctx) ? 'in_service' : 'all']! });
    entries.push({ kind: 'note', text: t.seasonNote });
    return entries;
  },
};
