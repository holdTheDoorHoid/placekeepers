// The displacement watch (M4.1): census tracts with signs that prices are rising (`watch` in
// tiles/displacement.pmtiles, docs/CONTRACTS.md section 4). A caution drawn under the lots: a pale
// slate gray fill and a dashed outline, never a ranking, so every area looks the same however many signs it
// has. Tapping an area opens its signs (src/components/displacement/WatchDetails.svelte).
//
// The fill answers taps only below zoom 16: from there a tap on the map asks the City which parcel
// lies under it (PICK_MIN_ZOOM in src/state/store.svelte.ts), and an area covering many blocks must
// not catch those taps. Close in, the outline still opens the area. Setting:
//   shade   shade the areas (on), or draw their outlines only

import type { LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { WATCH_FILL, WATCH_FILL_OPACITY, WATCH_LINE } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

/** From this zoom a tap picks the parcel under it, so the fill stops answering taps. */
export const WATCH_TAP_MAX_ZOOM = 16;

export function shadeOn(ctx: LegendContext): boolean {
  return settingValue(ctx, 'shade') !== false;
}

export const displacementWatch: StyleModule = {
  zIndex: 8,
  settings: ['shade'],
  clickable: ['fill', 'line'],

  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        maxzoom: WATCH_TAP_MAX_ZOOM,
        paint: {
          'fill-color': WATCH_FILL,
          // With shading off the fill is invisible but still answers taps farther out.
          'fill-opacity': shadeOn(ctx) ? WATCH_FILL_OPACITY : 0,
        },
      },
      // Close in the shade stays, quieter, and no longer answers taps.
      ...(shadeOn(ctx)
        ? [
            {
              id: partId(ctx.layer.id, 'shade'),
              type: 'fill',
              ...sourceKeys(ctx),
              minzoom: WATCH_TAP_MAX_ZOOM,
              paint: { 'fill-color': WATCH_FILL, 'fill-opacity': WATCH_FILL_OPACITY * 0.6 },
            } satisfies LayerSpecification,
          ]
        : []),
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': WATCH_LINE,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 14, 2.2, 17, 3],
          'line-dasharray': [3, 2],
          'line-opacity': 0.9,
        },
      },
    ];
  },

  legend(ctx): LegendEntry[] {
    const d = strings.displacement;
    return [
      {
        kind: 'swatch',
        label: d.legendArea,
        fill: WATCH_FILL,
        stroke: WATCH_LINE,
        strokeWidth: 2,
        dashed: true,
        fillOpacity: shadeOn(ctx) ? WATCH_FILL_OPACITY : 0,
      },
      { kind: 'note', text: d.legendTap },
      { kind: 'note', text: d.legendNote },
    ];
  },
};
