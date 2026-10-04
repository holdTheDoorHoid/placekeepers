// Crashes from PennDOT's records, one circle each, colored by the worst injury: pale yellow when
// no one was hurt, to deep brown when someone was killed. No reds. Settings, all filters:
//   years     the most recent year of records, the most recent five years, or every year
//   severity  how badly people were hurt, at least
//   mode      who was involved (people walking, cycling, on motorcycles)
// The tiles carry deaths and serious injuries at every zoom and every other crash from zoom 12
// (pipeline: publish/tiles.py), so the legend says to zoom in when lesser crashes are chosen.

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { CRASH_COLORS, CRASH_STROKE, SELECTED } from './palette.ts';
import {
  highlightFilter,
  partId,
  settingValue,
  sourceKeys,
  type LegendContext,
  type StyleContext,
  type StyleModule,
} from './types.ts';

const sev: ExpressionSpecification = ['to-number', ['get', 'sev'], 0];
const modes: ExpressionSpecification = ['to-number', ['get', 'm'], 0];
const yearsAgo: ExpressionSpecification = ['to-number', ['get', 'ya'], 99];

/** True when a mode bit (1 walking, 2 cycling, 4 motorcycle, 8 scooter) is set in `m`. */
export function hasMode(bit: number, value: ExpressionSpecification = modes): ExpressionSpecification {
  return ['==', ['%', ['floor', ['/', value, bit]], 2], 1];
}

/** years setting -> the most years before the newest year of records to show (null: all). */
export const YEAR_WINDOWS: Record<string, number | null> = { latest: 0, recent: 4, all: null };
/** mode setting -> the mode bits, any of which must be set. */
export const MODE_CHOICES: Record<string, number[]> = { all: [], walk_cycle: [1, 2], walk: [1], cycle: [2], motorcycle: [4] };
/** The lowest severity the tiles carry at every zoom. */
export const ALL_ZOOMS_SEVERITY = 2;

export function minSeverity(ctx: LegendContext): number {
  const value = Number(settingValue(ctx, 'severity') ?? 2);
  return Number.isFinite(value) ? Math.min(3, Math.max(0, Math.round(value))) : 2;
}

export function crashFilter(ctx: LegendContext): FilterSpecification {
  const conditions: ExpressionSpecification[] = [];
  const years = settingValue(ctx, 'years');
  const window = typeof years === 'string' && years in YEAR_WINDOWS ? YEAR_WINDOWS[years]! : YEAR_WINDOWS.recent!;
  if (window !== null) conditions.push(['<=', yearsAgo, window]);
  const min = minSeverity(ctx);
  if (min > 0) conditions.push(['>=', sev, min]);
  const mode = settingValue(ctx, 'mode');
  const bits = (typeof mode === 'string' && MODE_CHOICES[mode]) || [];
  if (bits.length === 1) conditions.push(hasMode(bits[0]!));
  else if (bits.length > 1) conditions.push(['any', ...bits.map((bit) => hasMode(bit))]);
  return ['all', ...conditions] as FilterSpecification;
}

export const crashes: StyleModule = {
  zIndex: 40,
  settings: ['years', 'severity', 'mode'],
  clickable: ['circle'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const [c0, c1, c2, c3] = CRASH_COLORS;
    return [
      {
        id: partId(ctx.layer.id, 'circle'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: crashFilter(ctx),
        // The worst crashes draw on top.
        layout: { 'circle-sort-key': sev },
        paint: {
          'circle-color': ['match', sev, 3, c3, 2, c2, 1, c1, c0],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['match', sev, 3, 3.5, 2, 2.8, 2], 16, ['match', sev, 3, 8, 2, 6.5, 1, 5, 4]],
          'circle-stroke-color': CRASH_STROKE,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 1.2],
          'circle-opacity': 0.92,
        },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: ['all', crashFilter(ctx), highlightFilter(ctx)] as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 16, 11],
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend(ctx) {
    const l = strings.legend;
    const min = minSeverity(ctx);
    const entries: ReturnType<StyleModule['legend']> = [];
    for (const level of [3, 2, 1, 0]) {
      if (level < min) continue;
      entries.push({ kind: 'circle', label: l.crashSeverity[level]!, fill: CRASH_COLORS[level]!, stroke: '#7a6a55', radius: 3 + level });
    }
    if (min < ALL_ZOOMS_SEVERITY) entries.push({ kind: 'note', text: l.crashesZoom });
    entries.push({ kind: 'note', text: l.crashesSource });
    return entries;
  },
};
