// Traffic stress for people on bikes (M3.3): DVRPC's Level of Traffic Stress on each street
// (`stress` in tiles/cycling.pmtiles, docs/CONTRACTS.md section 4), from level 1, calm enough for
// most people of all ages, to level 4, only for the most fearless riders: two blues for calm
// streets, an orange and a deep brown for stressful ones, on a thin white casing, a little wider
// as stress rises. Never an alarm red. Setting:
//   show  every street DVRPC rates, only stressful streets (levels 3 and 4) or only calm ones
//         (levels 1 and 2)
//
// Zoomed out (below zoom 12) the tiles carry only stressful streets and streets with a bike lane,
// a buffered or protected lane or a trail, which keeps the citywide view light (pipeline:
// publish/tiles.py); the legend says so.

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { SELECTED, STRESS_CASING, STRESS_COLORS } from './palette.ts';
import { highlightFilter, partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

export const SHOW_CHOICES = ['all', 'stressful', 'calm'] as const;
export type Show = (typeof SHOW_CHOICES)[number];

/** The levels each choice shows. */
export const LEVELS_SHOWN: Record<Show, readonly number[]> = { all: [1, 2, 3, 4], stressful: [3, 4], calm: [1, 2] };

const level: ExpressionSpecification = ['to-number', ['get', 'l'], 0];

export function showOf(ctx: LegendContext): Show {
  const value = settingValue(ctx, 'show');
  return (SHOW_CHOICES as readonly unknown[]).includes(value) ? (value as Show) : 'all';
}

export function stressFilter(ctx: LegendContext): FilterSpecification {
  return ['in', level, ['literal', [...LEVELS_SHOWN[showOf(ctx)]]]] as FilterSpecification;
}

/** Wider as stress rises, so the stressful streets read first. */
const width = (scale: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  ['*', scale, ['+', 0.6, ['*', 0.2, level]]],
  16,
  ['*', scale, ['+', 2, ['*', 0.6, level]]],
];

export const trafficStress: StyleModule = {
  zIndex: 27,
  settings: ['show'],
  clickable: ['line'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const filter = stressFilter(ctx);
    const layout = { 'line-join': 'round', 'line-cap': 'round' } as const;
    return [
      {
        id: partId(ctx.layer.id, 'casing'),
        type: 'line',
        ...sourceKeys(ctx),
        filter,
        layout,
        paint: { 'line-color': STRESS_CASING, 'line-width': width(1.8), 'line-opacity': 0.8 },
      },
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        filter,
        layout: { ...layout, 'line-sort-key': level },
        paint: {
          'line-color': ['match', level, 1, STRESS_COLORS[1]!, 2, STRESS_COLORS[2]!, 3, STRESS_COLORS[3]!, STRESS_COLORS[4]!],
          'line-width': width(1),
        },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: highlightFilter(ctx),
        layout,
        paint: { 'line-color': SELECTED, 'line-width': width(2.4), 'line-opacity': 0.5 },
      },
    ];
  },

  legend(ctx) {
    const w = strings.walk;
    const show = showOf(ctx);
    const entries: LegendEntry[] = LEVELS_SHOWN[show].map((n) => ({
      kind: 'line',
      label: w.stressLevels[n]!,
      color: STRESS_COLORS[n]!,
      casing: STRESS_CASING,
      width: 2 + n * 0.5,
    }));
    if (show !== 'all') entries.push({ kind: 'note', text: w.stressShown[show]! });
    entries.push({ kind: 'note', text: w.stressZoom }, { kind: 'note', text: w.stressSource });
    return entries;
  },
};
