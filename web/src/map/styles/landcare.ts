// Lots PHS LandCare already cleans, greens and mows: the care the Philadelphia trials tested.
// A deep green outline over a faint green wash, so a lot reads as "already cared for" while the
// vacant parcel colors underneath stay visible. Deep green (ColorBrewer PRGn) differs from the
// yellow green priority ramp by its darker hue and its outline only weight, and reads in
// grayscale. No settings.

import type { LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { partId, sourceKeys, type StyleContext, type StyleModule } from './types.ts';

export const LANDCARE_LINE = '#1b7837';
export const LANDCARE_FILL = '#a6dba0';
export const LANDCARE_FILL_OPACITY = 0.2;

export const landcare: StyleModule = {
  zIndex: 25,
  settings: [],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        paint: { 'fill-color': LANDCARE_FILL, 'fill-opacity': LANDCARE_FILL_OPACITY },
      },
      {
        id: partId(ctx.layer.id, 'outline'),
        type: 'line',
        ...sourceKeys(ctx),
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': LANDCARE_LINE,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 15, 1.4, 17, 2.4],
        },
      },
    ];
  },

  legend() {
    return [
      {
        kind: 'swatch',
        label: strings.legend.landcare,
        fill: LANDCARE_FILL,
        fillOpacity: LANDCARE_FILL_OPACITY,
        stroke: LANDCARE_LINE,
        strokeWidth: 2,
      },
    ];
  },
};
