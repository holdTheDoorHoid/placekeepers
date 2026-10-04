// The High Injury Network: streets where most traffic deaths and serious injuries happen.
// Drawn as an amber line on a white casing so it stands out from the base map's roads
// without the alarm of red.

import type { LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { HIN_CASING, HIN_COLOR } from './palette.ts';
import { partId, sourceKeys, type StyleContext, type StyleModule } from './types.ts';

export const hin: StyleModule = {
  zIndex: 30,
  settings: [],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    const layout = { 'line-join': 'round', 'line-cap': 'round' } as const;
    return [
      {
        id: partId(ctx.layer.id, 'casing'),
        type: 'line',
        ...sourceKeys(ctx),
        layout,
        paint: {
          'line-color': HIN_CASING,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 6, 17, 11],
          'line-opacity': 0.9,
        },
      },
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        layout,
        paint: {
          'line-color': HIN_COLOR,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 3.5, 17, 7],
        },
      },
    ];
  },

  legend() {
    return [{ kind: 'line', label: strings.legend.hin, color: HIN_COLOR, casing: HIN_CASING, width: 4 }];
  },
};
