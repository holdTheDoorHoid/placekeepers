// Memorials: one small, quiet marker for each person killed, white with a muted violet gray
// ring and a faint glow. No red and nothing that looks like a crash. Names are never drawn on
// the map; they appear only when someone opens a marker, and only when the curated public
// memorial list has one (docs/ETHICS.md). Settings:
//   show_names  on: markers that have a public name get a fuller ring, and the name shows when
//               the marker is opened; off: every marker looks the same and no name shows
//   all_fatal   off: only people walking, cycling or riding a scooter; on: everyone killed

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { hasMode } from './crashes.ts';
import { MEMORIAL_FILL, MEMORIAL_GLOW, MEMORIAL_RING } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type StyleContext, type StyleModule } from './types.ts';

const modes: ExpressionSpecification = ['to-number', ['get', 'm'], 0];
/** People walking (1), cycling (2) or riding a scooter (8). */
export const VULNERABLE: ExpressionSpecification = ['any', hasMode(1, modes), hasMode(2, modes), hasMode(8, modes)];

export function showNames(ctx: LegendContext): boolean {
  return settingValue(ctx, 'show_names') !== false;
}

export function everyone(ctx: LegendContext): boolean {
  return settingValue(ctx, 'all_fatal') === true;
}

export function memorialFilter(ctx: LegendContext): FilterSpecification {
  return (everyone(ctx) ? ['all'] : VULNERABLE) as FilterSpecification;
}

const radius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 5, 17, 7.5];
const glowRadius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 9, 17, 13];

export const memorials: StyleModule = {
  zIndex: 50,
  settings: ['show_names', 'all_fatal'],
  clickable: ['marker'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const filter = memorialFilter(ctx);
    const ring: ExpressionSpecification | number = showNames(ctx) ? ['case', ['has', 'nm'], 2.6, 1.6] : 1.6;
    return [
      {
        id: partId(ctx.layer.id, 'glow'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter,
        paint: { 'circle-color': MEMORIAL_GLOW, 'circle-radius': glowRadius, 'circle-blur': 0.7, 'circle-opacity': 0.75 },
      },
      {
        id: partId(ctx.layer.id, 'marker'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter,
        paint: {
          'circle-color': MEMORIAL_FILL,
          'circle-radius': radius,
          'circle-stroke-color': MEMORIAL_RING,
          'circle-stroke-width': ring,
        },
      },
    ];
  },

  legend(ctx) {
    const l = strings.legend;
    return [
      { kind: 'circle', label: everyone(ctx) ? l.memorialEveryone : l.memorial, fill: MEMORIAL_FILL, stroke: MEMORIAL_RING, radius: 5 },
      { kind: 'note', text: showNames(ctx) ? l.memorialNames : l.memorialNamesHidden },
    ];
  },
};
