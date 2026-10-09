// The bus shelters on the City's own list (M4.5, `shelters` in tiles/transit.pmtiles,
// docs/CONTRACTS.md section 4): a deep blue ring around the SEPTA stop each serves, so the stop's
// own color shows inside it. A tapped shelter says where it is, which stop it serves, and that
// the stop counts as sheltered in the transit comfort lens. Appears from zoom 12, like the stops.

import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { CITY_SHELTER_RING, SELECTED } from './palette.ts';
import { highlightFilter, partId, sourceKeys, type StyleContext, type StyleModule } from './types.ts';

export const SHELTERS_MIN_ZOOM = 12;

/** A ring a little wider than a stop's dot at every zoom (transit_stops.ts). */
const radius = ['interpolate', ['linear'], ['zoom'], 12, 4.5, 13, 5.5, 15, 8, 17, 11] as const;

export const cityShelters: StyleModule = {
  // Just above the stops (42), so the ring circles them.
  zIndex: 43,
  settings: [],
  clickable: ['ring'],

  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'ring'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: SHELTERS_MIN_ZOOM,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': radius as never,
          'circle-stroke-color': CITY_SHELTER_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 1.4, 15, 2.2, 17, 3],
        },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: SHELTERS_MIN_ZOOM,
        filter: highlightFilter(ctx) as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 7, 15, 11, 17, 14],
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend() {
    const t = strings.streetsStops;
    return [
      { kind: 'circle', label: t.shelterLegend, fill: '#ffffff', stroke: CITY_SHELTER_RING, radius: 6 },
      { kind: 'note', text: t.shelterLegendLens },
      { kind: 'note', text: t.shelterLegendDate },
      { kind: 'note', text: strings.transit.zoomNote },
    ];
  },
};
