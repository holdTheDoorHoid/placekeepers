// Amenities from OpenStreetMap (M3.5): benches, picnic tables, drinking water, public toilets and
// little free libraries, one registry layer each (`benches`, `picnic_tables`, `water`, `toilets`
// and `bookcases` in tiles/amenities.pmtiles, docs/CONTRACTS.md section 4), all drawn by this style:
// a small dot in the kind's color with a white ring. The legend says that only what people have
// mapped appears, and links the layer's guide on adding what is missing. No settings.

import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { AMENITY_COLORS, AMENITY_RING, SELECTED } from './palette.ts';
import { highlightFilter, partId, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

const FALLBACK = '#5f6870';

export function amenityColor(ctx: LegendContext): string {
  return AMENITY_COLORS[ctx.layer.id] ?? FALLBACK;
}

export const amenity: StyleModule = {
  zIndex: 44,
  settings: [],
  clickable: ['dot'],

  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        paint: {
          'circle-color': amenityColor(ctx),
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4, 17, 7],
          'circle-stroke-color': AMENITY_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 16, 1.5],
        },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: highlightFilter(ctx) as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 8, 17, 11],
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend(ctx) {
    const t = strings.amenities;
    const guide = ctx.layer.guide;
    const entries: LegendEntry[] = [
      { kind: 'circle', label: t.legend[ctx.layer.id] ?? ctx.layer.label, fill: amenityColor(ctx), stroke: AMENITY_RING, radius: 5 },
      { kind: 'note', text: t.mappedNote, ...(guide ? { link: { page: guide, label: t.addMissing } } : {}) },
    ];
    return entries;
  },
};
