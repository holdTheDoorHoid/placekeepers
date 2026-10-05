// How walkable each area is (M3.3): the EPA's National Walkability Index for each census block
// group (`block_groups` in tiles/walk.pmtiles, docs/CONTRACTS.md section 4), a faint teal ramp
// drawn under every other layer. Block groups without the measure stay clear. Settings:
//   measure  the index, or one of its parts: street corners (`rc`, `qc`), how close transit is
//            (`rt`, `qt`), or the mix of homes, jobs and shops (`rj` and `rh`, `qm`)
//   compare  within Philadelphia, by the fifth of the city's block groups each falls in (`qw`,
//            `qc`, `qt`, `qm`), or with the whole country: the EPA's own four classes of the
//            index (`nw`), and for a part its national rank from 1 to 20 in fifths (1 to 4 is the
//            bottom fifth, 17 to 20 the top)

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { WALK_BINS, WALK_NATION_BINS, WALK_OPACITY } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

export const MEASURES = ['index', 'corners', 'transit', 'mix'] as const;
export type Measure = (typeof MEASURES)[number];

/** measure setting -> the property holding its fifth of the city's block groups, 1 to 5. */
export const CITY_FIFTH: Record<Measure, string> = { index: 'qw', corners: 'qc', transit: 'qt', mix: 'qm' };

export function measureOf(ctx: LegendContext): Measure {
  const value = settingValue(ctx, 'measure');
  return (MEASURES as readonly unknown[]).includes(value) ? (value as Measure) : 'index';
}

export function nationwide(ctx: LegendContext): boolean {
  return settingValue(ctx, 'compare') === 'nation';
}

const num = (key: string): ExpressionSpecification => ['to-number', ['get', key], 0];

/** The national rank of a part, 1 to 20, in fifths: 1 to 4 is 1, 17 to 20 is 5. */
function nationalFifth(measure: Exclude<Measure, 'index'>): ExpressionSpecification {
  if (measure === 'mix') return ['ceil', ['/', ['+', num('rj'), num('rh')], 8]];
  return ['ceil', ['/', num(measure === 'corners' ? 'rc' : 'rt'), 4]];
}

/** The class each block group is shaded by, and the colors of the classes in order. */
export function shading(ctx: LegendContext): { value: ExpressionSpecification; colors: readonly string[] } {
  const measure = measureOf(ctx);
  if (!nationwide(ctx)) return { value: num(CITY_FIFTH[measure]), colors: WALK_BINS };
  if (measure === 'index') return { value: num('nw'), colors: WALK_NATION_BINS };
  return { value: nationalFifth(measure), colors: WALK_BINS };
}

export const walkability: StyleModule = {
  zIndex: 6,
  settings: ['measure', 'compare'],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    const { value, colors } = shading(ctx);
    const steps: (string | number)[] = [colors[0]!];
    colors.slice(1).forEach((color, i) => steps.push(i + 2, color));
    return [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        filter: ['>', value, 0],
        paint: {
          'fill-color': ['step', value, ...steps] as unknown as ExpressionSpecification,
          // Fainter up close, so the lots and streets stay readable over it.
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, WALK_OPACITY, 16, WALK_OPACITY * 0.6],
          'fill-outline-color': 'rgba(255, 255, 255, 0.6)',
        },
      },
    ];
  },

  legend(ctx) {
    const w = strings.walk;
    const measure = measureOf(ctx);
    const { colors } = shading(ctx);
    const labels = nationwide(ctx) ? (measure === 'index' ? w.walkClasses : w.walkNationFifths) : w.walkFifths[measure]!;
    const entries: LegendEntry[] = [
      {
        kind: 'bins',
        title: w.walkTitle[measure]!,
        opacity: WALK_OPACITY,
        bins: colors.map((color, i) => ({ color, label: labels[i]! })),
      },
      { kind: 'note', text: w.walkCompared[nationwide(ctx) ? 'nation' : 'city']! },
    ];
    if (nationwide(ctx) && measure === 'index') entries.push({ kind: 'note', text: w.walkNationNote });
    entries.push({ kind: 'note', text: w.walkParts }, { kind: 'note', text: w.walkSource });
    return entries;
  },
};
