// Shelters and benches at the bus and trolley stops OpenStreetMap knows (M2.2), by what riders
// find there (`c` of `stops` in tiles/amenities.pmtiles, docs/CONTRACTS.md section 4): 3 a shelter
// or roof, 2 a bench but no shelter mapped, 1 neither, 0 not yet surveyed. Known answers are filled circles; a stop not yet surveyed is a hollow gray
// ring, because unknown is not the same as missing. The legend's "not yet surveyed" entry links
// to the layer's guide (the StreetComplete survey page). Setting:
//   show  every stop, only stops someone has surveyed, or only stops not yet surveyed

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { SELECTED, STOP_COLORS, STOP_OUTLINES, STOP_UNKNOWN_FILL, STOP_UNKNOWN_RING } from './palette.ts';
import {
  highlightFilter,
  partId,
  settingValue,
  sourceKeys,
  type LegendContext,
  type LegendEntry,
  type StyleContext,
  type StyleModule,
} from './types.ts';

/** What the map shows, `c` in the tiles. */
export const COMFORT = { unknown: 0, neither: 1, bench: 2, shelter: 3 } as const;

const comfort: ExpressionSpecification = ['to-number', ['get', 'c'], 0];

/** show setting -> the `c` codes it shows (null: every stop). */
export const SHOW_CHOICES: Record<string, number[] | null> = {
  all: null,
  surveyed: [COMFORT.shelter, COMFORT.bench, COMFORT.neither],
  unsurveyed: [COMFORT.unknown],
};

export function shownCodes(ctx: LegendContext): number[] {
  const show = settingValue(ctx, 'show');
  const codes = typeof show === 'string' && show in SHOW_CHOICES ? SHOW_CHOICES[show] : null;
  return codes ?? [COMFORT.shelter, COMFORT.bench, COMFORT.neither, COMFORT.unknown];
}

export function stopFilter(ctx: LegendContext): FilterSpecification {
  return ['in', comfort, ['literal', shownCodes(ctx)]] as FilterSpecification;
}

const radius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 5, 17, 8];
const selectedRadius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 9, 17, 12];

export const stopAmenities: StyleModule = {
  zIndex: 45,
  settings: ['show'],
  clickable: ['dot', 'ring'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const filter = stopFilter(ctx);
    return [
      {
        // Not yet surveyed: a hollow ring, drawn first so known answers sit on top.
        id: partId(ctx.layer.id, 'ring'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: ['all', filter, ['==', comfort, COMFORT.unknown]] as FilterSpecification,
        paint: {
          'circle-color': STOP_UNKNOWN_FILL,
          'circle-opacity': 0.85,
          'circle-radius': radius,
          'circle-stroke-color': STOP_UNKNOWN_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 2],
        },
      },
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: ['all', filter, ['!=', comfort, COMFORT.unknown]] as FilterSpecification,
        // A shelter draws on top of a bench, a bench on top of neither.
        layout: { 'circle-sort-key': comfort },
        paint: {
          'circle-color': ['match', comfort, COMFORT.shelter, STOP_COLORS.shelter, COMFORT.bench, STOP_COLORS.bench, STOP_COLORS.neither],
          'circle-radius': radius,
          'circle-stroke-color': ['match', comfort, COMFORT.shelter, STOP_OUTLINES.shelter, COMFORT.bench, STOP_OUTLINES.bench, STOP_OUTLINES.neither],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 16, 1.5],
        },
      },
      {
        // The stop someone opened: a ring in the selection color.
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: ['all', filter, highlightFilter(ctx)] as FilterSpecification,
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': selectedRadius,
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend(ctx) {
    const l = strings.legend;
    const shown = new Set(shownCodes(ctx));
    const entries: LegendEntry[] = [];
    if (shown.has(COMFORT.shelter)) entries.push({ kind: 'circle', label: l.stopShelter, fill: STOP_COLORS.shelter, stroke: STOP_OUTLINES.shelter, radius: 5 });
    if (shown.has(COMFORT.bench)) entries.push({ kind: 'circle', label: l.stopBench, fill: STOP_COLORS.bench, stroke: STOP_OUTLINES.bench, radius: 5 });
    if (shown.has(COMFORT.neither)) entries.push({ kind: 'circle', label: l.stopNeither, fill: STOP_COLORS.neither, stroke: STOP_OUTLINES.neither, radius: 5 });
    if (shown.has(COMFORT.unknown)) {
      const guide = ctx.layer.guide;
      entries.push({
        kind: 'circle',
        label: l.stopUnknown,
        fill: STOP_UNKNOWN_FILL,
        stroke: STOP_UNKNOWN_RING,
        radius: 5,
        ...(guide ? { link: { page: guide, label: l.stopSurvey } } : {}),
      });
    }
    entries.push({ kind: 'note', text: l.stopsCoverage });
    return entries;
  },
};
