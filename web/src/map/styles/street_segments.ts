// Street blocks colored by the street safety lens (the first registry lens that applies to
// segments). The score is computed in the style from the block's factor fields, so moving a
// lens slider recolors the streets without reloading data. Lines grow thicker and stronger as
// the score rises, so a block that only has a school nearby stays quiet. Setting: min_score
// hides blocks scoring below a threshold. When every weight is off, nothing is ranked, so no
// block is drawn.
//
// The tiles carry every block from zoom 14; zoomed further out they carry only blocks with
// recorded harm or on the High Injury Network (blocks near a school join at zoom 12), which
// keeps the citywide view light (pipeline: publish/tiles.py).

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import type { Lens } from '../../registry/types.ts';
import { strings } from '../../strings.ts';
import { lensColorExpression, lensScoreExpression } from '../lens.ts';
import { SELECTED, SELECTED_CASING, STREET_RAMP } from './palette.ts';
import {
  highlightFilter,
  partId,
  settingValue,
  sourceKeys,
  type LegendContext,
  type StyleContext,
  type StyleModule,
} from './types.ts';

/** The lens that colors street blocks: the first registry lens that applies to segments. */
export function streetLens(ctx: Pick<LegendContext, 'registry'>): Lens | null {
  return ctx.registry.lenses.find((l) => l.applies_to === 'segment') ?? null;
}

const DEFAULT_MIN_SCORE = 20;

export function minScore(ctx: LegendContext): number {
  const value = Number(settingValue(ctx, 'min_score') ?? DEFAULT_MIN_SCORE);
  return Number.isFinite(value) ? Math.max(1, value) : DEFAULT_MIN_SCORE;
}

/** A filter that matches nothing, for when every lens weight is off. */
export const NOTHING: FilterSpecification = ['==', ['literal', 1], 0];

function score(ctx: LegendContext): ExpressionSpecification | null {
  const lens = streetLens(ctx);
  return lens ? lensScoreExpression(lens, ctx.state.weights[lens.id]) : null;
}

export function segmentFilter(ctx: LegendContext): FilterSpecification {
  const value = score(ctx);
  return value ? (['>=', value, minScore(ctx)] as FilterSpecification) : NOTHING;
}

export const streetSegments: StyleModule = {
  zIndex: 35,
  settings: ['min_score'],
  clickable: ['line'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const lens = streetLens(ctx);
    const value = score(ctx) ?? 0;
    const color = lens ? lensColorExpression(lens, ctx.state.weights[lens.id], STREET_RAMP) : STREET_RAMP.allOff;
    const byScore = (low: number, high: number): ExpressionSpecification => ['interpolate', ['linear'], value, 0, low, 100, high];
    const selected = highlightFilter(ctx);
    const layout = { 'line-join': 'round', 'line-cap': 'round' } as const;
    return [
      {
        // The block someone opened: a casing in the selection color under its line.
        id: partId(ctx.layer.id, 'selected-casing'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: selected,
        layout,
        paint: { 'line-color': SELECTED_CASING, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 17, 15] },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: selected,
        layout,
        paint: { 'line-color': SELECTED, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 17, 11] },
      },
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: segmentFilter(ctx),
        layout,
        paint: {
          'line-color': color,
          // Quieter citywide, clearer up close: thinner and fainter lines when zoomed out.
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, byScore(0.6, 1.8), 14, byScore(1.4, 4), 17, byScore(2.5, 7)],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, byScore(0.3, 0.75), 14, byScore(0.45, 0.95)],
        },
      },
    ];
  },

  legend(ctx) {
    const l = strings.legend;
    if (!score(ctx)) return [{ kind: 'note', text: strings.lens.allOffFor('segment') }];
    return [
      { kind: 'ramp', title: l.segmentsFill, stops: STREET_RAMP.stops, low: strings.lens.legendLow, high: strings.lens.legendHigh },
      { kind: 'note', text: l.segmentsShown(minScore(ctx)) },
      { kind: 'note', text: l.segmentsZoom },
    ];
  },
};
