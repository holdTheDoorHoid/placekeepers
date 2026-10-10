// School crossing guard posts (M4.5, `guards` in tiles/streets.pmtiles, docs/CONTRACTS.md section
// 4): a deep pink dot at each corner where the City posts a crossing guard near a school. A
// safety service for children walking to school, never enforcement (docs/ETHICS.md). From zoom 12.

import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { GUARD_FILL, GUARD_RING, SELECTED } from './palette.ts';
import { highlightFilter, partId, sourceKeys, type StyleContext, type StyleModule } from './types.ts';

export const GUARDS_MIN_ZOOM = 12;

export const crossingGuards: StyleModule = {
  zIndex: 48,
  settings: [],
  clickable: ['dot'],

  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: GUARDS_MIN_ZOOM,
        paint: {
          'circle-color': GUARD_FILL,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 15, 5.5, 17, 8],
          'circle-stroke-color': GUARD_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 1.5, 17, 2],
        },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: GUARDS_MIN_ZOOM,
        filter: highlightFilter(ctx) as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 7, 15, 10, 17, 13],
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend() {
    const t = strings.streetsStops;
    return [
      { kind: 'circle', label: t.guardLegend, fill: GUARD_FILL, stroke: GUARD_RING, radius: 5 },
      { kind: 'note', text: t.guardLegendNote },
      { kind: 'note', text: t.zoomStreets },
    ];
  },
};
