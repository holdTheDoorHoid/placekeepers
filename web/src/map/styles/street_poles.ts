// The street poles the Streets Department lists (M4.5, `poles` in tiles/poles.pmtiles,
// docs/CONTRACTS.md section 4): small dots, close in only, colored by the lamp the City lists on
// each (`k`): an LED lamp, the older high pressure sodium lamp, a lamp of a kind it does not name,
// or no lamp listed (a hollow ring). What is installed, never whether a lamp works or how bright
// it is. A tapped pole gives its number for a report to Philly311. Setting:
//   show  every pole, poles with a lamp the City lists, or lamps it does not list as LED

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { POLE_COLORS, POLE_NONE_RING, POLE_RING, SELECTED } from './palette.ts';
import { highlightFilter, partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

/** The poles are in the tiles at this zoom only (a few blocks across); the map stretches it. */
export const POLES_MIN_ZOOM = 15;
/** The kind of lamp (`k`): none listed, LED, high pressure sodium, a kind the City does not name. */
export const NO_LAMP = 0;
export const LAMP_LED = 1;
export const LAMP_OTHER = 2;
export const LAMP_UNKNOWN = 3;

const kind: ExpressionSpecification = ['to-number', ['get', 'k'], 0];

export function poleFilter(ctx: LegendContext): FilterSpecification {
  const show = settingValue(ctx, 'show');
  if (show === 'lamps') return ['>', kind, NO_LAMP] as FilterSpecification;
  if (show === 'not_led') return ['in', kind, ['literal', [LAMP_OTHER, LAMP_UNKNOWN]]] as FilterSpecification;
  return ['all'] as FilterSpecification;
}

const fill: ExpressionSpecification = [
  'match',
  kind,
  LAMP_LED,
  POLE_COLORS.led,
  LAMP_OTHER,
  POLE_COLORS.other,
  LAMP_UNKNOWN,
  POLE_COLORS.unknown,
  'rgba(255, 255, 255, 0.6)',
];

export const streetPoles: StyleModule = {
  zIndex: 27,
  settings: ['show'],
  clickable: ['dot'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const filter = poleFilter(ctx);
    return [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: POLES_MIN_ZOOM,
        filter,
        paint: {
          'circle-color': fill,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 2.2, 17, 4.5, 19, 7],
          'circle-stroke-color': ['case', ['==', kind, NO_LAMP], POLE_NONE_RING, POLE_RING],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 15, 0.6, 17, 1.2],
        },
      },
      {
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        minzoom: POLES_MIN_ZOOM,
        filter: ['all', filter, highlightFilter(ctx)] as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 6, 17, 10],
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend(ctx) {
    const t = strings.streetsStops;
    const show = settingValue(ctx, 'show');
    const entries: LegendEntry[] = [];
    if (show !== 'not_led') entries.push({ kind: 'circle', label: t.poleLed, fill: POLE_COLORS.led, stroke: POLE_RING, radius: 4 });
    entries.push({ kind: 'circle', label: t.poleOther, fill: POLE_COLORS.other, stroke: POLE_RING, radius: 4 });
    entries.push({ kind: 'circle', label: t.poleUnknown, fill: POLE_COLORS.unknown, stroke: POLE_RING, radius: 4 });
    if (show !== 'lamps' && show !== 'not_led') entries.push({ kind: 'circle', label: t.poleNone, fill: '#ffffff', stroke: POLE_NONE_RING, radius: 4 });
    entries.push({ kind: 'note', text: t.polesNote }, { kind: 'note', text: t.polesZoom });
    return entries;
  },
};
