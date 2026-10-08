// People and places within walking distance (M3.3): hexagons about two blocks across (`cells` in
// tiles/walk.pmtiles, docs/CONTRACTS.md section 4), shaded by what lies within a short walk of
// each hexagon's middle, in a faint blue drawn under every other layer. A hexagon without the
// chosen measure stays clear. Setting:
//   measure  the people who live within a 5 minute walk (`p`), the kinds of everyday places
//            within a 10 minute walk (`d`, 0 to 7), or the street corners within a 5 minute walk
//            (`k`), each in five fixed classes so a shade means the same number everywhere

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { REACH_BINS, REACH_OPACITY } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

export const MEASURES = ['people', 'places', 'corners'] as const;
export type Measure = (typeof MEASURES)[number];

/** Each measure's property and where its second to fifth classes start. */
export const CLASSES: Record<Measure, { property: string; breaks: readonly [number, number, number, number] }> = {
  people: { property: 'p', breaks: [1000, 2500, 4000, 6000] },
  places: { property: 'd', breaks: [3, 5, 6, 7] },
  corners: { property: 'k', breaks: [10, 25, 50, 75] },
};

export function measureOf(ctx: LegendContext): Measure {
  const value = settingValue(ctx, 'measure');
  return (MEASURES as readonly unknown[]).includes(value) ? (value as Measure) : 'people';
}

export const walkingDistance: StyleModule = {
  zIndex: 8,
  settings: ['measure'],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    const { property, breaks } = CLASSES[measureOf(ctx)];
    const value: ExpressionSpecification = ['to-number', ['get', property], 0];
    const [c1, c2, c3, c4, c5] = REACH_BINS;
    return [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        filter: ['has', property],
        paint: {
          'fill-color': ['step', value, c1, breaks[0], c2, breaks[1], c3, breaks[2], c4, breaks[3], c5],
          // Fainter up close, so the lots and streets stay readable over it.
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, REACH_OPACITY, 16, REACH_OPACITY * 0.6],
          'fill-outline-color': 'rgba(255, 255, 255, 0.6)',
        },
      },
    ];
  },

  legend(ctx) {
    const w = strings.walk;
    const measure = measureOf(ctx);
    const labels = w.reachBins[measure]!;
    const entries: LegendEntry[] = [
      {
        kind: 'bins',
        title: w.reachTitle[measure]!,
        opacity: REACH_OPACITY,
        bins: REACH_BINS.map((color, i) => ({ color, label: labels[i]! })),
      },
    ];
    if (measure === 'places') entries.push({ kind: 'note', text: w.reachKinds });
    if (measure === 'corners') entries.push({ kind: 'note', text: w.reachCorners });
    entries.push({ kind: 'note', text: w.reachMeasured }, { kind: 'note', text: w.reachSource[measure]! });
    return entries;
  },
};
