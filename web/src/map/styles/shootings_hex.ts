// Shooting victims counted per hexagon (about two blocks across). Context for where care
// helps most, never a danger map: a quiet purple ramp under the lots, no reds, and cells
// with no shootings left clear. Setting: window (last 12 months or last 3 years), which
// picks the count property and its class breaks.

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { COUNT_BINS, COUNT_OPACITY } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type StyleContext, type StyleModule } from './types.ts';

interface WindowSpec {
  property: string;
  /** Lower bound of each class after the first; the first class starts at 1. */
  breaks: [number, number, number, number];
}

/** Tile properties from docs/CONTRACTS.md: s12 and s36 are counts for 12 and 36 months. */
export const WINDOWS: Record<string, WindowSpec> = {
  m12: { property: 's12', breaks: [2, 3, 5, 8] },
  m36: { property: 's36', breaks: [3, 6, 11, 20] },
};

function windowSpec(ctx: LegendContext): WindowSpec {
  const value = settingValue(ctx, 'window');
  return (typeof value === 'string' && WINDOWS[value]) || WINDOWS.m12!;
}

function count(spec: WindowSpec): ExpressionSpecification {
  return ['to-number', ['get', spec.property], 0];
}

export const shootingsHex: StyleModule = {
  zIndex: 10,
  settings: ['window'],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    const spec = windowSpec(ctx);
    const [b1, b2, b3, b4] = spec.breaks;
    const [c0, c1, c2, c3, c4] = COUNT_BINS;
    return [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        filter: ['>', count(spec), 0],
        paint: {
          'fill-color': ['step', count(spec), c0, b1, c1, b2, c2, b3, c3, b4, c4],
          'fill-opacity': COUNT_OPACITY,
          'fill-outline-color': 'rgba(255, 255, 255, 0.7)',
        },
      },
    ];
  },

  legend(ctx) {
    const spec = windowSpec(ctx);
    const [b1, b2, b3, b4] = spec.breaks;
    const lows = [1, b1, b2, b3, b4];
    const setting = ctx.layer.settings.find((s) => s.id === 'window');
    const chosen = setting?.type === 'choice' ? setting.options.find((o) => o.value === settingValue(ctx, 'window')) : undefined;
    const label = chosen?.label ?? setting?.label ?? '';
    return [
      {
        kind: 'bins',
        title: strings.legend.hexIntro(label),
        opacity: COUNT_OPACITY,
        bins: COUNT_BINS.map((color, i) => ({
          color,
          label: strings.legend.countBin(lows[i]!, i < lows.length - 1 ? lows[i + 1]! - 1 : null),
        })),
      },
      { kind: 'note', text: strings.legend.hexNone },
    ];
  },
};
