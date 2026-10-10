// Traffic calming the City lists (M4.5, `calming` in tiles/streets.pmtiles, docs/CONTRACTS.md
// section 4): a charcoal dot with a yellow ring for each speed cushion, hump or table, like the
// paint on one. A tapped device says the street and the day it went in. From zoom 12.

import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { CALMING_FILL, CALMING_RING, SELECTED } from './palette.ts';
import { highlightFilter, partId, sourceKeys, type StyleContext, type StyleModule } from './types.ts';

export const CALMING_MIN_ZOOM = 12;

export const trafficCalming: StyleModule = {
  zIndex: 47,
  settings: [],
  clickable: ['dot'],

  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: CALMING_MIN_ZOOM,
        paint: {
          'circle-color': CALMING_FILL,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2, 15, 4, 17, 6],
          'circle-stroke-color': CALMING_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 1.6, 17, 2.2],
        },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: CALMING_MIN_ZOOM,
        filter: highlightFilter(ctx) as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 15, 9, 17, 12],
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend() {
    const t = strings.streetsStops;
    return [
      { kind: 'circle', label: t.calmingLegend, fill: CALMING_FILL, stroke: CALMING_RING, radius: 5 },
      { kind: 'note', text: t.calmingLegendNote },
      { kind: 'note', text: t.zoomStreets },
    ];
  },
};
