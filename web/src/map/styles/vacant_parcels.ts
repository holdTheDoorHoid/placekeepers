// Vacant lots and buildings. The fill shows priority under the current lens blend; the
// outline and fill strength show how sure we are that the parcel is vacant:
//   very likely: solid thick outline, strong fill
//   probably:    solid thin outline, medium fill
//   not sure:    dashed outline, faint fill
// A parcel with no mapped shape is a point at the assessor's location (issue #22), drawn as a
// circle with the same color and the same strength for how sure we are. Zoomed out (below zoom 13)
// the tiles carry a light sample of the parcels as points (issue #26), drawn the same way with a
// hairline edge, so the lens colors show where lots cluster.
// Settings: min_confidence (hide parcels below a confidence) and kinds (lots, buildings or
// both). The owner type filter from the analysis view applies here too.

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { FILTERS } from '../../config/filters.ts';
import { strings } from '../../strings.ts';
import { lensColorExpression } from '../lens.ts';
import { PARCEL_OUTLINE, PRIORITY_RAMP, SELECTED, SELECTED_CASING } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type StyleContext, type StyleModule } from './types.ts';

const vc: ExpressionSpecification = ['to-number', ['get', 'vc'], 0];
const kind: ExpressionSpecification = ['to-number', ['get', 'k'], 0];
const isPoint: ExpressionSpecification = ['==', ['geometry-type'], 'Point'];

/** The lens that colors parcels: the first registry lens that applies to parcels. */
export function parcelLens(ctx: LegendContext) {
  return ctx.registry.lenses.find((l) => l.applies_to === 'parcel') ?? null;
}

export function parcelFilter(ctx: LegendContext): ExpressionSpecification {
  const conditions: ExpressionSpecification[] = [];
  const min = Number(settingValue(ctx, 'min_confidence') ?? 1);
  if (Number.isFinite(min) && min > 1) conditions.push(['>=', vc, min]);
  const kinds = settingValue(ctx, 'kinds');
  if (kinds === 'lots') conditions.push(['==', kind, 1]);
  else if (kinds === 'buildings') conditions.push(['==', kind, 2]);
  for (const filter of FILTERS.filter((f) => f.style === 'vacant_parcels')) {
    const chosen = ctx.state.filters[filter.id];
    if (!chosen || chosen.length >= filter.options.length) continue;
    conditions.push(['in', ['to-string', ['get', filter.property]], ['literal', chosen]]);
  }
  return ['all', ...conditions] as ExpressionSpecification;
}

function fillColor(ctx: LegendContext): ExpressionSpecification | string {
  const lens = parcelLens(ctx);
  return lens ? lensColorExpression(lens, ctx.state.weights[lens.id], PRIORITY_RAMP) : PRIORITY_RAMP.allOff;
}

const outlineWidth: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  13,
  ['match', vc, 3, 0.6, 0.3],
  17,
  ['match', vc, 3, 2.2, 1.2],
];

/** Circles for parcels with no shape, and for every parcel zoomed out: small far out, about a
 *  lot wide up close. */
const pointRadius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 4, 17, 7];
/** Below zoom 13 the circles are the light sample: a hairline edge, so the fill color reads. */
const pointEdge: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 12, 0.3, 13, ['match', vc, 3, 1.6, 2, 1, 0.75]];
/** The ring around a selected point, a little wider than the point. */
const selectedRadius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 7, 17, 10];

export const vacantParcels: StyleModule = {
  zIndex: 20,
  settings: ['min_confidence', 'kinds'],
  clickable: ['fill', 'point'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const id = ctx.layer.id;
    const filter = parcelFilter(ctx);
    const selected = ctx.state.selected ?? '';
    const isSelected: FilterSpecification = ['==', ['to-string', ['get', 'id']], selected];
    return [
      {
        id: partId(id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        filter,
        paint: {
          'fill-color': fillColor(ctx),
          'fill-opacity': ['match', vc, 3, 0.9, 2, 0.72, 0.45],
        },
      },
      {
        id: partId(id, 'outline'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: ['all', filter, ['>=', vc, 2]],
        paint: { 'line-color': PARCEL_OUTLINE, 'line-width': outlineWidth },
      },
      {
        id: partId(id, 'outline-unsure'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: ['all', filter, ['<', vc, 2]],
        paint: { 'line-color': PARCEL_OUTLINE, 'line-width': outlineWidth, 'line-dasharray': [2, 1.5] },
      },
      {
        id: partId(id, 'point'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: ['all', filter, isPoint],
        paint: {
          'circle-color': fillColor(ctx),
          'circle-opacity': ['match', vc, 3, 0.9, 2, 0.72, 0.45],
          'circle-radius': pointRadius,
          'circle-stroke-color': PARCEL_OUTLINE,
          'circle-stroke-width': pointEdge,
          'circle-stroke-opacity': ['match', vc, 3, 1, 2, 1, 0.6],
        },
      },
      {
        id: partId(id, 'selected-casing'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: isSelected,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': SELECTED_CASING, 'line-width': 7 },
      },
      {
        id: partId(id, 'selected'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: isSelected,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': SELECTED, 'line-width': 3.5 },
      },
      {
        id: partId(id, 'selected-point'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: ['all', isSelected, isPoint],
        paint: {
          'circle-radius': selectedRadius,
          'circle-opacity': 0,
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 3.5,
        },
      },
    ];
  },

  legend(ctx) {
    const lens = parcelLens(ctx);
    const l = strings.legend;
    const entries: ReturnType<StyleModule['legend']> = [];
    if (lens && typeof fillColor(ctx) !== 'string') {
      entries.push({ kind: 'ramp', title: l.parcelsFill, stops: PRIORITY_RAMP.stops, low: strings.lens.legendLow, high: strings.lens.legendHigh });
      entries.push({ kind: 'swatch', label: strings.lens.legendNoData, fill: PRIORITY_RAMP.noData, stroke: PARCEL_OUTLINE, strokeWidth: 1 });
    } else {
      entries.push({ kind: 'note', text: strings.lens.allOff });
    }
    const swatch = PRIORITY_RAMP.stops[2]!;
    entries.push(
      { kind: 'note', text: l.parcelsSure },
      { kind: 'swatch', label: l.sureHigh, fill: swatch, fillOpacity: 0.9, stroke: PARCEL_OUTLINE, strokeWidth: 2.2 },
      { kind: 'swatch', label: l.sureMedium, fill: swatch, fillOpacity: 0.72, stroke: PARCEL_OUTLINE, strokeWidth: 1.2 },
      { kind: 'swatch', label: l.sureLow, fill: swatch, fillOpacity: 0.45, stroke: PARCEL_OUTLINE, strokeWidth: 1.2, dashed: true },
      { kind: 'circle', label: l.parcelPoint, fill: swatch, stroke: PARCEL_OUTLINE, radius: 4 },
      { kind: 'swatch', label: l.selected, fill: 'transparent', stroke: SELECTED, strokeWidth: 3 },
    );
    return entries;
  },
};
