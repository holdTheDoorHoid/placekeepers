// Projects neighbors finished (M5.3, issue #47): one badge per project the owner approved, or
// entered by hand (`projects` in tiles/projects.pmtiles, docs/CONTRACTS.md section 4): a white
// circle with a deep green ring and a gold center. A tapped project shows what was done, when, by
// which group if it chose to show one, what it took, and a link to the report on GitHub
// (src/components/projects/ProjectDetails.svelte). No settings.

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { PROJECT_CENTER, PROJECT_FILL, PROJECT_RING, SELECTED } from './palette.ts';
import { highlightFilter, partId, sourceKeys, type StyleContext, type StyleModule } from './types.ts';

const radius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 6, 17, 9];
const centerRadius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 1.25, 14, 2.5, 17, 4];
const selectedRadius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 7, 14, 10, 17, 13];

export const projects: StyleModule = {
  zIndex: 41,
  settings: [],
  clickable: ['badge'],

  layers(ctx: StyleContext): LayerSpecification[] {
    return [
      {
        id: partId(ctx.layer.id, 'badge'),
        type: 'circle',
        ...sourceKeys(ctx),
        paint: {
          'circle-color': PROJECT_FILL,
          'circle-radius': radius,
          'circle-stroke-color': PROJECT_RING,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 17, 3],
        },
      },
      {
        id: partId(ctx.layer.id, 'center'),
        type: 'circle',
        ...sourceKeys(ctx),
        paint: { 'circle-color': PROJECT_CENTER, 'circle-radius': centerRadius },
      },
      {
        // The project someone opened: a ring in the selection color.
        id: partId(ctx.layer.id, 'selected'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter: highlightFilter(ctx),
        paint: {
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-radius': selectedRadius,
          'circle-stroke-color': SELECTED,
          'circle-stroke-width': 2.5,
        },
      },
    ];
  },

  legend() {
    const p = strings.projects;
    return [
      { kind: 'circle', label: p.legend, fill: PROJECT_CENTER, stroke: PROJECT_RING, radius: 5 },
      { kind: 'note', text: p.legendNote },
      { kind: 'note', text: p.privacy },
    ];
  },
};
