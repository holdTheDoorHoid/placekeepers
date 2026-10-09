// What a style module provides for one registry layer: the MapLibre layers that draw it,
// the legend that explains it, and which of its parts respond to clicks.

import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
import type { Layer, Registry } from '../../registry/types.ts';
import type { AppState } from '../../state/defaults.ts';
import type { StopAnswerIndex } from '../../transit/answers.ts';
import type { Manifest } from '../../data/manifest.ts';

export interface StyleContext {
  layer: Layer;
  registry: Registry;
  state: AppState;
  sourceId: string;
  /** Layer name inside a tile file; null for GeoJSON. */
  sourceLayer: string | null;
  /** True when the map has label fonts (a base map with glyphs). Text labels need them. */
  glyphs?: boolean;
  /** Ids of this layer's features that someone opened, to draw them as selected. */
  highlight?: readonly (string | number)[];
  /**
   * What OpenStreetMap says at SEPTA's stops, by the linked OpenStreetMap id, joined in the
   * browser (decision D1, src/transit/answers.ts). Missing until the table has loaded: every stop
   * then counts its shelter and bench halfway.
   */
  stopAnswers?: StopAnswerIndex | null;
  /**
   * The build's manifest, when a legend needs a source's dates (the parking reports' window,
   * issue #37). Missing or null until it loads.
   */
  manifest?: Manifest | null;
}

export type LegendContext = Omit<StyleContext, 'sourceId' | 'sourceLayer'>;

/**
 * A link a legend entry offers: to one of the site's content pages, named by its slug (M2.2), or to
 * another site by its full address (`href`, added for the 1937 redlining map's credit).
 */
export interface LegendLink {
  page?: string;
  href?: string;
  label: string;
}

export type LegendEntry =
  | { kind: 'ramp'; title: string; stops: readonly string[]; low: string; high: string }
  | { kind: 'swatch'; label: string; fill: string; stroke: string; strokeWidth: number; dashed?: boolean; fillOpacity?: number }
  | { kind: 'line'; label: string; color: string; casing?: string; width: number }
  | { kind: 'bins'; title: string; bins: { color: string; label: string }[]; opacity: number }
  | { kind: 'circle'; label: string; fill: string; stroke: string; radius: number; link?: LegendLink }
  | { kind: 'note'; text: string; link?: LegendLink };

export interface StyleModule {
  /** Draw order: lower numbers are drawn first, underneath. */
  zIndex: number;
  /** Setting ids from the registry layer that this style puts into effect. */
  settings: string[];
  layers(ctx: StyleContext): LayerSpecification[];
  legend(ctx: LegendContext): LegendEntry[];
  /** Parts (see partId) that select a place when clicked. */
  clickable: string[];
  /**
   * True for the base map: it adds no layers of its own (layers() gives none) but restyles the
   * base map's layers, which come with the map's starting style (src/map/basemap.ts).
   */
  base?: boolean;
}

/** MapLibre layer id for one part of a registry layer. */
export function partId(layerId: string, part: string): string {
  return `pk:${layerId}:${part}`;
}

/** Source keys shared by every part: the source, and the layer inside it for tiles. */
export function sourceKeys(ctx: StyleContext): { source: string; 'source-layer'?: string } {
  return ctx.sourceLayer ? { source: ctx.sourceId, 'source-layer': ctx.sourceLayer } : { source: ctx.sourceId };
}

/** A filter for the features someone opened (`highlight`), or one that matches nothing. */
export function highlightFilter(ctx: StyleContext): FilterSpecification {
  const ids = ctx.highlight ?? [];
  if (ids.length === 0) return ['==', ['literal', 1], 0];
  return ['in', ['get', 'id'], ['literal', [...ids]]];
}

export function settingValue(ctx: LegendContext, id: string): unknown {
  return ctx.state.settings[ctx.layer.id]?.[id];
}
