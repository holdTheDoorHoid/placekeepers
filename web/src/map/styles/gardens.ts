// Community gardens and farms people already tend: never vacant, never a target. A small dark
// teal dot with a white ring, drawn above the lots, distinct from the green parcels, the amber
// High Injury Network and the purple context cells (ColorBrewer BrBG). No settings.

import type { LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { partId, sourceKeys, type StyleContext, type StyleModule } from './types.ts';

export const GARDEN_COLOR = '#01665e';
export const GARDEN_RING = '#ffffff';

export const gardens: StyleModule = {
  zIndex: 40,
  settings: [],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        paint: {
          'circle-color': GARDEN_COLOR,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 4.5, 17, 7],
          'circle-stroke-color': GARDEN_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 17, 2],
        },
      },
    ];
  },

  legend() {
    return [{ kind: 'swatch', label: strings.legend.garden, fill: GARDEN_COLOR, stroke: GARDEN_RING, strokeWidth: 1.5 }];
  },
};
