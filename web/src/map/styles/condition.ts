// Conditions reported to 311, counted by block (M3.5): illegal dumping, lights out and graffiti
// (`dumping`, `lights` and `graffiti` in tiles/conditions.pmtiles, docs/CONTRACTS.md section 4).
// Each block with a request in the last 90 days is one circle at the middle of the block, bigger
// with more requests (`n`): filled where a request is still open (`o` above 0), a hollow ring of
// the same color where every request is closed. Never a point at an address. Setting:
//   show  every block with a request in the last 90 days, or only those with one still open

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { CONDITION_COLORS, SELECTED } from './palette.ts';
import { highlightFilter, partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

const FALLBACK = '#5f6870';
const requests: ExpressionSpecification = ['to-number', ['get', 'n'], 1];
const stillOpen: ExpressionSpecification = ['>', ['to-number', ['get', 'o'], 0], 0];

export function conditionColor(ctx: LegendContext): string {
  return CONDITION_COLORS[ctx.layer.id] ?? FALLBACK;
}

export function openOnly(ctx: LegendContext): boolean {
  return settingValue(ctx, 'show') === 'open';
}

/** Bigger with more requests on the block: 1, 2 to 3, 4 or more. */
const size = (at10: number, at17: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  ['step', requests, at10, 2, at10 * 1.35, 4, at10 * 1.7],
  17,
  ['step', requests, at17, 2, at17 * 1.35, 4, at17 * 1.7],
];

export const condition: StyleModule = {
  zIndex: 38,
  settings: ['show'],
  clickable: ['open', 'closed'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const color = conditionColor(ctx);
    return [
      {
        id: partId(ctx.layer.id, 'closed'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: (openOnly(ctx) ? ['==', ['literal', 1], 0] : ['!', stillOpen]) as FilterSpecification,
        paint: {
          'circle-color': '#ffffff',
          'circle-opacity': 0.75,
          'circle-radius': size(2.5, 7),
          'circle-stroke-color': color,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 2],
        },
      },
      {
        id: partId(ctx.layer.id, 'open'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: stillOpen as FilterSpecification,
        layout: { 'circle-sort-key': requests },
        paint: {
          'circle-color': color,
          'circle-opacity': 0.9,
          'circle-radius': size(2.5, 7),
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 16, 1.5],
        },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: highlightFilter(ctx) as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': size(6, 12),
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend(ctx) {
    const t = strings.conditions;
    const what = t.legend[ctx.layer.id] ?? ctx.layer.label;
    const color = conditionColor(ctx);
    const entries: LegendEntry[] = [{ kind: 'circle', label: t.legendOpen(what), fill: color, stroke: '#ffffff', radius: 5 }];
    if (!openOnly(ctx)) entries.push({ kind: 'circle', label: t.legendClosed(what), fill: '#ffffff', stroke: color, radius: 5 });
    entries.push({ kind: 'note', text: t.legendSize });
    entries.push({ kind: 'note', text: openOnly(ctx) ? `${t.legendWindow} ${t.openOnly}` : t.legendWindow });
    return entries;
  },
};
