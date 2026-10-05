// Public art (M3.2): one dot per work from the City's Percent for Art list, OpenStreetMap and
// Wikidata (`art` in tiles/art.pmtiles, docs/CONTRACTS.md section 4), colored by its kind (`k`):
// murals and wall paintings, sculptures and statues, mosaics, and other kinds. A tapped work shows
// its kind, title, artist, year and its sources; a memorial artwork shows none of those words
// (docs/ETHICS.md). Settings, each a switch that shows or hides dots:
//   murals, sculptures, mosaics, other  the kinds of work
//   inside                              works the City lists as inside a building

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { strings } from '../../strings.ts';
import { ART_COLORS, ART_RINGS, SELECTED } from './palette.ts';
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

/** The kind of a work, `k` in the tiles. Codes never change meaning. */
export const ART_KIND = { other: 0, mural: 1, sculpture: 2, mosaic: 3 } as const;
export type ArtKind = keyof typeof ART_KIND;

/** Each kind's setting in the registry, in the order the legend lists them. */
export const KIND_SETTINGS: readonly { kind: ArtKind; setting: string }[] = [
  { kind: 'mural', setting: 'murals' },
  { kind: 'sculpture', setting: 'sculptures' },
  { kind: 'mosaic', setting: 'mosaics' },
  { kind: 'other', setting: 'other' },
];

const kind: ExpressionSpecification = ['to-number', ['coalesce', ['get', 'k'], ART_KIND.other]];
const inside: ExpressionSpecification = ['to-number', ['coalesce', ['get', 'in'], 0]];

/** A switch is on unless the setting says false (a missing setting is its default, on). */
function on(ctx: LegendContext, setting: string): boolean {
  return settingValue(ctx, setting) !== false;
}

/** The kinds the settings show, in legend order. */
export function shownKinds(ctx: LegendContext): ArtKind[] {
  return KIND_SETTINGS.filter((k) => on(ctx, k.setting)).map((k) => k.kind);
}

export function artFilter(ctx: LegendContext): FilterSpecification {
  const kinds = shownKinds(ctx).map((k) => ART_KIND[k]);
  const parts: unknown[] = ['all', ['in', kind, ['literal', kinds]]];
  if (!on(ctx, 'inside')) parts.push(['!=', inside, 1]);
  return parts as FilterSpecification;
}

function byKind(colors: Record<ArtKind, string>): ExpressionSpecification {
  return ['match', kind, ART_KIND.mural, colors.mural, ART_KIND.sculpture, colors.sculpture, ART_KIND.mosaic, colors.mosaic, colors.other];
}

const radius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 4.5, 17, 7];
const selectedRadius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 8.5, 17, 11];

export const publicArt: StyleModule = {
  zIndex: 38,
  settings: ['murals', 'sculptures', 'mosaics', 'other', 'inside'],
  clickable: ['dot'],

  layers(ctx: StyleContext): LayerSpecification[] {
    const filter = artFilter(ctx);
    return [
      {
        id: partId(ctx.layer.id, 'dot'),
        type: 'circle',
        ...sourceKeys(ctx),
        filter,
        paint: {
          'circle-color': byKind(ART_COLORS),
          'circle-radius': radius,
          'circle-stroke-color': byKind(ART_RINGS),
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 16, 1.5],
        },
      },
      {
        // The work someone opened: a ring in the selection color.
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
    const a = strings.art;
    const kinds = shownKinds(ctx);
    const entries: LegendEntry[] = kinds.map((k) => ({ kind: 'circle', label: a.legend[k], fill: ART_COLORS[k], stroke: ART_RINGS[k], radius: 5 }));
    if (kinds.length === 0) entries.push({ kind: 'note', text: a.allOff });
    if (!on(ctx, 'inside')) entries.push({ kind: 'note', text: a.insideHidden });
    entries.push({ kind: 'note', text: a.memorialNote }, { kind: 'note', text: a.coverage });
    return entries;
  },
};
