// What a style module provides for one registry layer: the MapLibre layers that draw it,
// the legend that explains it, and which of its parts respond to clicks.

import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
import type { Layer, Registry } from '../../registry/types.ts';
import type { AppState } from '../../state/defaults.ts';

export interface StyleContext {
  layer: Layer;
  registry: Registry;
  state: AppState;
  sourceId: string;
  /** Layer name inside a tile file; null for GeoJSON. */
  sourceLayer: string | null;
  /** Ids of this layer's features that someone opened, to draw them as selected. */
  highlight?: readonly (string | number)[];
}

export type LegendContext = Omit<StyleContext, 'sourceId' | 'sourceLayer'>;

export type LegendEntry =
  | { kind: 'ramp'; title: string; stops: readonly string[]; low: string; high: string }
  | { kind: 'swatch'; label: string; fill: string; stroke: string; strokeWidth: number; dashed?: boolean; fillOpacity?: number }
  | { kind: 'line'; label: string; color: string; casing?: string; width: number }
  | { kind: 'bins'; title: string; bins: { color: string; label: string }[]; opacity: number }
  | { kind: 'circle'; label: string; fill: string; stroke: string; radius: number }
  | { kind: 'note'; text: string };

export interface StyleModule {
  /** Draw order: lower numbers are drawn first, underneath. */
  zIndex: number;
  /** Setting ids from the registry layer that this style puts into effect. */
  settings: string[];
  layers(ctx: StyleContext): LayerSpecification[];
  legend(ctx: LegendContext): LegendEntry[];
  /** Parts (see partId) that select a place when clicked. */
  clickable: string[];
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
