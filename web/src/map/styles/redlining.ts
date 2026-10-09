// The 1937 redlining map (owner, 2026-10-09): the Home Owners' Loan Corporation's areas and grades
// of Philadelphia as Mapping Inequality traced them (`holc` in tiles/redlining.pmtiles, its own
// file under CC BY-NC 2.5, docs/CONTRACTS.md section 4). Each area is drawn in the 1937 map's own
// color for its grade, muted, with its label (such as "C12") on it, so the grade never rests on
// color alone. Tapping an area opens a short card with its grade, what redlining was and a link to
// its 1937 description at Mapping Inequality (src/components/history/RedliningDetails.svelte).
//
// As with the displacement watch, the fill answers taps only below zoom 16, where a tap starts to
// ask the City which parcel is there; close in, the outline still opens the area. Setting:
//   shade   shade the areas (on), or draw their outlines and labels only

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { LABEL_FONT, LABEL_HALO } from './boundary.ts';
import { HOLC_COLORS, HOLC_FILL_OPACITY, HOLC_UNGRADED } from './palette.ts';
import { partId, settingValue, sourceKeys, type LegendContext, type LegendEntry, type StyleContext, type StyleModule } from './types.ts';

/** From this zoom a tap picks the parcel under it, so the fill stops answering taps. */
export const HOLC_TAP_MAX_ZOOM = 16;
/** The 1937 grades, best to worst, in the map's own letters. */
export const HOLC_GRADES = ['A', 'B', 'C', 'D'] as const;

function shadeOn(ctx: LegendContext): boolean {
  return settingValue(ctx, 'shade') !== false;
}

const gradeColor: ExpressionSpecification = [
  'match',
  ['get', 'g'],
  ...HOLC_GRADES.flatMap((g) => [g, HOLC_COLORS[g]!]),
  HOLC_UNGRADED,
] as unknown as ExpressionSpecification;

export const redlining: StyleModule = {
  zIndex: 9,
  settings: ['shade'],
  clickable: ['fill', 'line'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const shade = shadeOn(ctx);
    const parts: LayerSpecification[] = [
      {
        id: partId(ctx.layer.id, 'fill'),
        type: 'fill',
        ...sourceKeys(ctx),
        maxzoom: HOLC_TAP_MAX_ZOOM,
        // With shading off the fill is invisible but still answers taps farther out.
        paint: { 'fill-color': gradeColor, 'fill-opacity': shade ? HOLC_FILL_OPACITY : 0 },
      },
      ...(shade
        ? [
            {
              id: partId(ctx.layer.id, 'shade'),
              type: 'fill',
              ...sourceKeys(ctx),
              minzoom: HOLC_TAP_MAX_ZOOM,
              paint: { 'fill-color': gradeColor, 'fill-opacity': HOLC_FILL_OPACITY * 0.6 },
            } satisfies LayerSpecification,
          ]
        : []),
      {
        id: partId(ctx.layer.id, 'line'),
        type: 'line',
        ...sourceKeys(ctx),
        layout: { 'line-join': 'round' },
        paint: { 'line-color': gradeColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2, 17, 3], 'line-opacity': 0.9 },
      },
    ];
    if (ctx.glyphs) {
      parts.push({
        id: partId(ctx.layer.id, 'label'),
        type: 'symbol',
        ...sourceKeys(ctx),
        minzoom: 12,
        filter: ['has', 'g'],
        layout: {
          'text-field': ['to-string', ['get', 'l']],
          'text-font': LABEL_FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 16, 15],
          'text-padding': 4,
        },
        paint: { 'text-color': '#2b2b2b', 'text-halo-color': LABEL_HALO, 'text-halo-width': 1.5 },
      });
    }
    return parts;
  },

  legend(ctx): LegendEntry[] {
    const r = strings.redlining;
    const opacity = shadeOn(ctx) ? HOLC_FILL_OPACITY : 0;
    return [
      ...HOLC_GRADES.map(
        (g): LegendEntry => ({ kind: 'swatch', label: r.grades[g]!, fill: HOLC_COLORS[g]!, fillOpacity: opacity, stroke: HOLC_COLORS[g]!, strokeWidth: 2 }),
      ),
      { kind: 'swatch', label: r.ungraded, fill: HOLC_UNGRADED, fillOpacity: opacity, stroke: HOLC_UNGRADED, strokeWidth: 2 },
      { kind: 'note', text: r.context },
      { kind: 'note', text: r.notToday },
      { kind: 'note', text: r.legendTap },
      { kind: 'note', text: r.credit, link: { href: r.homepage, label: r.homepageLabel } },
      { kind: 'note', text: r.nonCommercial, link: { href: r.licenseUrl, label: r.licenseLabel } },
    ];
  },
};
