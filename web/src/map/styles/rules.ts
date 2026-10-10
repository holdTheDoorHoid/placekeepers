// The rules and records of each lot (M4.6, issue #42), in tiles/rules.pmtiles (docs/CONTRACTS.md
// section 4). Five styles, all quiet, drawn under the lots except the two kinds of points:
//
//   historic_districts   the Historical Commission's districts: a sepia outline, a faint fill
//   historic_properties  the Register's parcels, from zoom 13: a stronger sepia fill
//   zoning_overlays      overlays and the Zoning Code's special rules: an olive dashed outline and
//                        an almost clear fill, since many overlap and a few cover most of the city.
//                        Setting `show`: every one, or the overlay districts only (`t` 1)
//   hearings             hearings still to come: a violet dot with a white ring for the Zoning
//                        Board of Adjustment (`b` 1), a pale violet ring for the other boards.
//                        Setting `boards`: every board, or the Zoning Board only. Never a name
//   brownfields          the EPA's brownfield sites: a rust dot with a white ring
//
// Like the displacement watch, the large shapes answer taps only below zoom 16: from there a tap
// asks the City which parcel lies under it, and the lot page shows its rules.

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { BROWNFIELD_COLORS, HEARING_COLORS, HISTORIC_COLORS, OVERLAY_COLORS } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

/** From this zoom a tap picks the parcel under it, so large shapes stop answering taps. */
export const RULES_TAP_MAX_ZOOM = 16;

const m = () => strings.rulesMap;

export const historicDistricts: StyleModule = {
  zIndex: 11,
  settings: [],
  clickable: ['fill'],
  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        maxzoom: RULES_TAP_MAX_ZOOM,
        paint: { 'fill-color': HISTORIC_COLORS.district, 'fill-opacity': HISTORIC_COLORS.districtOpacity },
      },
      {
        id: partId(ctx.layer.id, 'shade'),
        type: 'fill',
        ...sourceKeys(ctx),
        minzoom: RULES_TAP_MAX_ZOOM,
        paint: { 'fill-color': HISTORIC_COLORS.district, 'fill-opacity': HISTORIC_COLORS.districtOpacity * 0.6 },
      },
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        layout: { 'line-join': 'round' },
        paint: { 'line-color': HISTORIC_COLORS.districtLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2, 17, 3] },
      },
    ];
  },
  legend(): LegendEntry[] {
    return [
      { kind: 'swatch', label: m().legend.district, fill: HISTORIC_COLORS.district, fillOpacity: HISTORIC_COLORS.districtOpacity, stroke: HISTORIC_COLORS.districtLine, strokeWidth: 2 },
      { kind: 'note', text: m().notes.historic },
    ];
  },
};

export const historicProperties: StyleModule = {
  zIndex: 13,
  settings: [],
  clickable: ['fill'],
  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        maxzoom: RULES_TAP_MAX_ZOOM,
        paint: { 'fill-color': HISTORIC_COLORS.property, 'fill-opacity': HISTORIC_COLORS.propertyOpacity },
      },
      {
        id: partId(ctx.layer.id, 'shade'),
        type: 'fill',
        ...sourceKeys(ctx),
        minzoom: RULES_TAP_MAX_ZOOM,
        paint: { 'fill-color': HISTORIC_COLORS.property, 'fill-opacity': HISTORIC_COLORS.propertyOpacity },
      },
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        paint: { 'line-color': HISTORIC_COLORS.propertyLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 17, 1.5] },
      },
    ];
  },
  legend(): LegendEntry[] {
    return [
      { kind: 'swatch', label: m().legend.property, fill: HISTORIC_COLORS.property, fillOpacity: HISTORIC_COLORS.propertyOpacity, stroke: HISTORIC_COLORS.propertyLine, strokeWidth: 1 },
      { kind: 'note', text: m().notes.historic },
    ];
  },
};

export function overlayDistrictsOnly(ctx: LegendContext): boolean {
  return settingValue(ctx, 'show') === 'districts';
}

const overlayKind: ExpressionSpecification = ['to-number', ['get', 't'], 0];

export function overlayFilter(ctx: LegendContext): FilterSpecification {
  return (overlayDistrictsOnly(ctx) ? ['==', overlayKind, 1] : ['>=', overlayKind, 0]) as FilterSpecification;
}

export const zoningOverlays: StyleModule = {
  zIndex: 9,
  settings: ['show'],
  clickable: ['fill'],
  layers(ctx: StyleContext): LayerSpecification[] {
    const filter = overlayFilter(ctx);
    return [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        maxzoom: RULES_TAP_MAX_ZOOM,
        filter,
        paint: { 'fill-color': OVERLAY_COLORS.fill, 'fill-opacity': OVERLAY_COLORS.fillOpacity },
      },
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        filter,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['==', overlayKind, 1], OVERLAY_COLORS.line, OVERLAY_COLORS.supplemental],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 1.6, 17, 2.4],
          'line-dasharray': [3, 2],
        },
      },
    ];
  },
  legend(ctx): LegendEntry[] {
    const entries: LegendEntry[] = [
      { kind: 'swatch', label: m().legend.overlay, fill: OVERLAY_COLORS.fill, fillOpacity: OVERLAY_COLORS.fillOpacity, stroke: OVERLAY_COLORS.line, strokeWidth: 1.6, dashed: true },
    ];
    if (!overlayDistrictsOnly(ctx)) {
      entries.push({ kind: 'swatch', label: m().legend.supplemental, fill: OVERLAY_COLORS.fill, fillOpacity: OVERLAY_COLORS.fillOpacity, stroke: OVERLAY_COLORS.supplemental, strokeWidth: 1.6, dashed: true });
    }
    entries.push({ kind: 'note', text: m().notes.overlays });
    return entries;
  },
};

export function zoningHearingsOnly(ctx: LegendContext): boolean {
  return settingValue(ctx, 'boards') === 'zoning';
}

const board: ExpressionSpecification = ['to-number', ['get', 'b'], 0];
const dotRadius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 6, 17, 9];

export const hearings: StyleModule = {
  zIndex: 39,
  settings: ['boards'],
  clickable: ['dot'],
  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        ...(zoningHearingsOnly(ctx) ? { filter: ['==', board, 1] as FilterSpecification } : {}),
        paint: {
          'circle-color': ['case', ['==', board, 1], HEARING_COLORS.zoning, HEARING_COLORS.other],
          'circle-radius': dotRadius,
          'circle-stroke-color': ['case', ['==', board, 1], HEARING_COLORS.zoningRing, HEARING_COLORS.otherRing],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 2],
        },
      },
    ];
  },
  legend(ctx): LegendEntry[] {
    const entries: LegendEntry[] = [{ kind: 'circle', label: m().legend.hearingZoning, fill: HEARING_COLORS.zoning, stroke: HEARING_COLORS.zoningRing, radius: 6 }];
    if (!zoningHearingsOnly(ctx)) entries.push({ kind: 'circle', label: m().legend.hearingOther, fill: HEARING_COLORS.other, stroke: HEARING_COLORS.otherRing, radius: 6 });
    entries.push({ kind: 'note', text: m().notes.hearings });
    return entries;
  },
};

export const brownfields: StyleModule = {
  zIndex: 37,
  settings: [],
  clickable: ['dot'],
  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        paint: {
          'circle-color': BROWNFIELD_COLORS.fill,
          'circle-radius': dotRadius,
          'circle-stroke-color': BROWNFIELD_COLORS.ring,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 2],
        },
      },
    ];
  },
  legend(): LegendEntry[] {
    return [
      { kind: 'circle', label: m().legend.brownfield, fill: BROWNFIELD_COLORS.fill, stroke: BROWNFIELD_COLORS.ring, radius: 6 },
      { kind: 'note', text: m().notes.brownfields },
    ];
  },
};
