// Heat vulnerability by census tract (M3.1), from the City's Heat Vulnerability Index: each tract
// shaded by the fifth of the city's tracts it falls in (`hv`, `he` or `hs` of `heat_tracts` in
// tiles/environment.pmtiles, docs/CONTRACTS.md section 4). A faint orange ramp drawn under every
// other layer, never an alarm red; tracts the index does not report stay clear. Settings:
//   measure   heat vulnerability (heat and the people at risk together), heat exposure (how hot
//             it gets) or heat sensitivity (how many people are at risk in the heat)
//   priority  outline the tracts the City rates very high in heat vulnerability (`vh`)

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { HEAT_BINS, HEAT_OPACITY, HEAT_PRIORITY_LINE } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

/** measure setting -> the tile property holding the tract's class, 1 to 5. */
export const MEASURES: Record<string, string> = { vulnerability: 'hv', exposure: 'he', sensitivity: 'hs' };

export function measureOf(ctx: LegendContext): string {
  const value = settingValue(ctx, 'measure');
  return typeof value === 'string' && value in MEASURES ? value : 'vulnerability';
}

function priorityOn(ctx: LegendContext): boolean {
  return settingValue(ctx, 'priority') !== false;
}

export const heatTracts: StyleModule = {
  zIndex: 5,
  settings: ['measure', 'priority'],
  clickable: [],

  layers(ctx: StyleContext): LayerSpecification[] {
    const property = MEASURES[measureOf(ctx)]!;
    const cls: ExpressionSpecification = ['to-number', ['get', property], 0];
    const [c1, c2, c3, c4, c5] = HEAT_BINS;
    const layers: LayerSpecification[] = [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        filter: ['>', cls, 0],
        paint: {
          'fill-color': ['step', cls, c1, 2, c2, 3, c3, 4, c4, 5, c5],
          // Fainter up close, so the lots and streets stay readable over it.
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, HEAT_OPACITY, 16, HEAT_OPACITY * 0.6],
          'fill-outline-color': 'rgba(255, 255, 255, 0.6)',
        },
      },
    ];
    if (priorityOn(ctx)) {
      layers.push({
        id: partId(ctx.layer.id, 'priority'),
        type: 'line',
        ...sourceKeys(ctx),
        filter: ['==', ['to-number', ['get', 'vh'], 0], 1],
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': HEAT_PRIORITY_LINE,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2.5],
          'line-opacity': 0.85,
        },
      });
    }
    return layers;
  },

  legend(ctx) {
    const h = strings.heat;
    const measure = measureOf(ctx);
    const labels = h.fifths[measure] ?? h.fifths.vulnerability!;
    const entries: LegendEntry[] = [
      {
        kind: 'bins',
        title: h.tractsTitle[measure] ?? h.tractsTitle.vulnerability!,
        opacity: HEAT_OPACITY,
        bins: HEAT_BINS.map((color, i) => ({ color, label: labels[i]! })),
      },
    ];
    if (priorityOn(ctx)) entries.push({ kind: 'line', label: h.priority, color: HEAT_PRIORITY_LINE, width: 2.5 });
    entries.push({ kind: 'note', text: h.tractsNone }, { kind: 'note', text: h.tractsSource });
    return entries;
  },
};
