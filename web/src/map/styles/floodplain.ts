// The floodplain (M3.1): FEMA's flood areas as the City publishes them (`floodplain` in
// tiles/environment.pmtiles, docs/CONTRACTS.md section 4). `z` 1 is the 1 percent annual chance
// floodplain, drawn in a stronger blue with a solid edge, and its floodway (`fw`) darker; `z` 2 is
// the 0.2 percent annual chance area, lighter with a dashed edge. A reason for care and a place
// for greening that soaks up rain, never a score. Setting:
//   zones  both areas, or the 1 percent annual chance floodplain only

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { FLOOD_COLORS, FLOOD_LINES, FLOOD_OPACITY } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

const zone: ExpressionSpecification = ['to-number', ['get', 'z'], 0];
const floodway: ExpressionSpecification = ['==', ['to-number', ['get', 'fw'], 0], 1];

function highOnly(ctx: LegendContext): boolean {
  return settingValue(ctx, 'zones') === 'high';
}

export function floodFilter(ctx: LegendContext): FilterSpecification {
  return (highOnly(ctx) ? ['==', zone, 1] : ['in', zone, ['literal', [1, 2]]]) as FilterSpecification;
}

export const floodplain: StyleModule = {
  zIndex: 12,
  settings: ['zones'],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    const filter = floodFilter(ctx);
    return [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        filter,
        paint: {
          'fill-color': ['case', floodway, FLOOD_COLORS.floodway, ['==', zone, 1], FLOOD_COLORS.high, FLOOD_COLORS.moderate],
          'fill-opacity': ['case', floodway, FLOOD_OPACITY.floodway, ['==', zone, 1], FLOOD_OPACITY.high, FLOOD_OPACITY.moderate],
        },
      },
      {
        id: partId(ctx.layer.id, 'edge'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: ['all', filter, ['==', zone, 1]] as FilterSpecification,
        paint: { 'line-color': FLOOD_LINES.high, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 1.5] },
      },
      {
        id: partId(ctx.layer.id, 'edge-moderate'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: ['all', filter, ['==', zone, 2]] as FilterSpecification,
        paint: {
          'line-color': FLOOD_LINES.moderate,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 1.2],
          'line-dasharray': [3, 2],
        },
      },
    ];
  },

  legend(ctx) {
    const h = strings.heat;
    const entries: LegendEntry[] = [
      { kind: 'swatch', label: h.floodHigh, fill: FLOOD_COLORS.high, fillOpacity: FLOOD_OPACITY.high, stroke: FLOOD_LINES.high, strokeWidth: 1.5 },
      { kind: 'swatch', label: h.floodway, fill: FLOOD_COLORS.floodway, fillOpacity: FLOOD_OPACITY.floodway, stroke: FLOOD_LINES.high, strokeWidth: 1.5 },
    ];
    if (!highOnly(ctx)) {
      entries.push({ kind: 'swatch', label: h.floodModerate, fill: FLOOD_COLORS.moderate, fillOpacity: FLOOD_OPACITY.moderate, stroke: FLOOD_LINES.moderate, strokeWidth: 1.2, dashed: true });
    }
    entries.push({ kind: 'note', text: h.floodCare });
    return entries;
  },
};
