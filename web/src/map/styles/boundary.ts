// Boundaries: City Council districts, Registered Community Organizations and neighborhoods.
// Thin neutral gray lines that sit quietly over the data, each layer with its own weight so
// they can be told apart when shown together:
//   council districts:        the heaviest solid line, named from zoom 10
//   neighborhoods:            a thin solid line, named from zoom 12.5
//   community organizations:  a thin dashed line (their areas overlap), named from zoom 14
// Setting: names (a toggle, "Show names"). Names need label fonts, so they are drawn only
// when the base map brought them (StyleContext.glyphs); the lines are always drawn.

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { partId, settingValue, sourceKeys, type LegendContext, type StyleContext, type StyleModule } from './types.ts';

interface Look {
  color: string;
  /** Line width at zoom 10 and at zoom 17. */
  width: [number, number];
  dash?: [number, number];
  labelMinZoom: number;
  /** Label size at labelMinZoom and at zoom 17. */
  labelSize: [number, number];
}

/** Looks keyed by the layer's source layer name (docs/CONTRACTS.md, boundaries.pmtiles). */
export const LOOKS: Record<string, Look> = {
  council_districts: { color: '#3f4a54', width: [1.2, 2.6], labelMinZoom: 10, labelSize: [12, 16] },
  neighborhoods: { color: '#5c6670', width: [0.6, 1.4], labelMinZoom: 12.5, labelSize: [11, 14] },
  rcos: { color: '#5c6670', width: [0.6, 1.2], dash: [3, 2], labelMinZoom: 14, labelSize: [10, 12] },
};
const FALLBACK = LOOKS.neighborhoods!;

/** One of the fonts the base map ships (scripts/make-basemap.sh). */
export const LABEL_FONT = ['Noto Sans Medium'];
export const LABEL_HALO = '#ffffff';

export function lookFor(ctx: LegendContext): Look {
  return LOOKS[ctx.layer.source_layer] ?? FALLBACK;
}

export function showNames(ctx: LegendContext): boolean {
  const value = settingValue(ctx, 'names');
  if (typeof value === 'boolean') return value;
  const setting = ctx.layer.settings.find((s) => s.id === 'names');
  return setting?.type === 'toggle' ? setting.default : false;
}

function byZoom(at10: number, at17: number): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 10, at10, 17, at17];
}

export const boundary: StyleModule = {
  zIndex: 45,
  settings: ['names'],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    const look = lookFor(ctx);
    const parts: LayerSpecification[] = [
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': look.color,
          'line-width': byZoom(...look.width),
          'line-opacity': 0.8,
          ...(look.dash ? { 'line-dasharray': look.dash } : {}),
        },
      },
    ];
    if (ctx.glyphs && showNames(ctx)) {
      parts.push({
        id: partId(ctx.layer.id, 'name'),
        type: 'symbol',
        ...sourceKeys(ctx),
        minzoom: look.labelMinZoom,
        layout: {
          'text-field': ['to-string', ['get', 'nm']],
          'text-font': LABEL_FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], look.labelMinZoom, look.labelSize[0], 17, look.labelSize[1]],
          'text-max-width': 8,
          'text-padding': 6,
        },
        paint: { 'text-color': look.color, 'text-halo-color': LABEL_HALO, 'text-halo-width': 1.5 },
      });
    }
    return parts;
  },

  legend(ctx) {
    const look = lookFor(ctx);
    if (look.dash) {
      return [{ kind: 'swatch', label: ctx.layer.label, fill: 'transparent', stroke: look.color, strokeWidth: 1.5, dashed: true }];
    }
    return [{ kind: 'line', label: ctx.layer.label, color: look.color, width: look.width[1] }];
  },
};
