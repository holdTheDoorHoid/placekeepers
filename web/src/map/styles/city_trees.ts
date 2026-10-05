// The trees Parks and Recreation keeps on its streets and in its parks (M3.1), from its tree
// inventory (`trees` in tiles/trees.pmtiles, docs/CONTRACTS.md section 4): forest green dots,
// bigger for a wider trunk (`d`, inches), shown only close in. A tapped tree shows its kind and
// size. Setting:
//   show  every tree, big shade trees only (a trunk 12 inches across or more), or small trees
//         only (a trunk under 4 inches across, often young ones that need watering)

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { SELECTED, TREE_FILL, TREE_RING } from './palette.ts';
import { highlightFilter, partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

/** The trees are in the tiles from this zoom on (a few blocks across). */
export const TREES_MIN_ZOOM = 14;
/** Trunks at least this wide, in inches, are big shade trees. */
export const BIG_TRUNK = 12;
/** Trunks narrower than this, in inches, are small trees, often young ones. */
export const SMALL_TRUNK = 4;

/** The trunk in inches, or -1 when the inventory does not give it (to-number alone reads a missing
 *  value as 0). */
const trunk: ExpressionSpecification = ['to-number', ['coalesce', ['get', 'd'], -1]];

export function treeFilter(ctx: LegendContext): FilterSpecification {
  const show = settingValue(ctx, 'show');
  if (show === 'big') return ['>=', trunk, BIG_TRUNK] as FilterSpecification;
  if (show === 'small') return ['all', ['>=', trunk, 0], ['<', trunk, SMALL_TRUNK]] as FilterSpecification;
  return ['all'] as FilterSpecification;
}

/** Dot radius by zoom and trunk: a sapling is a speck, an old plane tree a coin. */
const radius: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  14,
  ['interpolate', ['linear'], trunk, -1, 1.6, 2, 1.2, 12, 2, 36, 3.2],
  17,
  ['interpolate', ['linear'], trunk, -1, 4, 2, 3, 12, 5.5, 36, 9],
];

export const cityTrees: StyleModule = {
  zIndex: 26,
  settings: ['show'],
  clickable: ['dot'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const filter = treeFilter(ctx);
    return [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: TREES_MIN_ZOOM,
        filter,
        paint: {
          'circle-color': TREE_FILL,
          'circle-opacity': 0.85,
          'circle-radius': radius,
          'circle-stroke-color': TREE_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 0.4, 17, 1],
        },
      },
      {
        // The tree someone opened.
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: TREES_MIN_ZOOM,
        filter: ['all', filter, highlightFilter(ctx)] as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 5, 17, 11],
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend(ctx) {
    const h = strings.heat;
    const show = settingValue(ctx, 'show');
    const entries: LegendEntry[] = [];
    if (show !== 'small') entries.push({ kind: 'circle', label: h.treeBig, fill: TREE_FILL, stroke: TREE_RING, radius: 6 });
    if (show !== 'big') entries.push({ kind: 'circle', label: h.treeSmall, fill: TREE_FILL, stroke: TREE_RING, radius: 2.5 });
    entries.push({ kind: 'note', text: h.treesZoom }, { kind: 'note', text: h.treesYards });
    return entries;
  },
};
