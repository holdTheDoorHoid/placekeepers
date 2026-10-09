// Picture layers loaded straight from another server (M4.3): the City's aerial photographs by year
// and its copy of the 1860 atlas. A raster layer in the registry (`geometry: raster`) draws one
// source whose endpoint is `arcgis_tiles` (docs/CONTRACTS.md section 1): the browser asks the
// City's ArcGIS server for the tiles of the chosen service, never Placekeepers, which keeps no copy.
//
// These are new requests to a server outside the site, so they follow "Fetch live City data"
// (registry/options.yaml): with it off the layers cannot be turned on, a link cannot turn them on,
// and the map never asks for a tile. Nothing here is requested until a layer is turned on.
//
// This module holds no MapLibre code, so the app state can use it without loading the map.

import type { Layer, Registry, Source, TileService } from '../registry/types.ts';
import type { AppState } from '../state/defaults.ts';

/** The setting that chooses among a source's services (the year), when it has more than one. */
export const YEAR_SETTING = 'year';
/** The deepest zoom the map asks for (src/map/controller.ts allows zoom 19). */
export const RASTER_MAX_ZOOM = 19;
/** The start of every picture source's id on the map. */
export const RASTER_SOURCE_PREFIX = 'pk-raster:';

/** True for a layer whose pictures the browser loads from another server. */
export function isOutsideLayer(layer: Layer): boolean {
  return layer.geometry === 'raster';
}

/** The ids of every such layer in the registry. */
export function outsideLayerIds(reg: Registry): Set<string> {
  return new Set(reg.layers.filter(isOutsideLayer).map((l) => l.id));
}

/** The layer ids without the ones loaded from another server: what may be drawn with live data off. */
export function withoutOutsideLayers(reg: Registry, ids: readonly string[]): string[] {
  const outside = outsideLayerIds(reg);
  return ids.filter((id) => !outside.has(id));
}

/** The sources a raster layer draws (its `arcgis_tiles` sources), in registry order. */
export function tileSources(layer: Layer, reg: Registry): Source[] {
  if (!isOutsideLayer(layer)) return [];
  return layer.sources
    .map((id) => reg.sources.find((s) => s.id === id))
    .filter((s): s is Source => s !== undefined && s.endpoint.kind === 'arcgis_tiles');
}

/** One picture service with the source it belongs to (whose publisher and terms it carries). */
export interface ChosenService {
  source: Source;
  service: TileService;
}

/**
 * The service a raster layer shows now: the one its year setting chooses, among all its sources'
 * services (the City's photos and the older ones it hosts for DVRPC and the USGS), else its only one.
 */
export function chosenService(layer: Layer, reg: Registry, state: AppState): ChosenService | null {
  const all = tileSources(layer, reg).flatMap((source) => (source.endpoint.services ?? []).map((service) => ({ source, service })));
  if (all.length <= 1) return all[0] ?? null;
  const setting = layer.settings.find((s) => s.id === YEAR_SETTING);
  const value = state.settings[layer.id]?.[YEAR_SETTING] ?? setting?.default;
  const key = (k: unknown) => all.find((c) => c.service.key === k);
  return key(value) ?? key(setting?.default) ?? all.at(-1) ?? null;
}

export interface RasterTiles {
  /** The map source's id: one per service, so changing the year swaps sources. */
  sourceId: string;
  /** The service's key, such as the year. */
  key: string;
  /** The tile address template, `{z}/{y}/{x}` as ArcGIS orders them (level, row, column). */
  tiles: string[];
  bounds: [number, number, number, number] | undefined;
}

/** Where a raster layer's tiles come from now, or null when the registry gives no service. */
export function rasterTiles(layer: Layer, reg: Registry, state: AppState): RasterTiles | null {
  const chosen = chosenService(layer, reg, state);
  if (!chosen || !chosen.source.endpoint.url) return null;
  const { source, service } = chosen;
  const path = service.service.split('/').map(encodeURIComponent).join('/');
  return {
    sourceId: `${RASTER_SOURCE_PREFIX}${source.id}:${service.key}`,
    key: service.key,
    tiles: [`${source.endpoint.url}/${path}/MapServer/tile/{z}/{y}/{x}`],
    bounds: source.endpoint.bounds,
  };
}

/** The layer's opacity setting as a fraction from 0.1 to 1 (1 when it has none). */
export function rasterOpacity(layer: Layer, state: AppState): number {
  const setting = layer.settings.find((s) => s.id === 'opacity');
  const value = Number(state.settings[layer.id]?.opacity ?? (setting?.type === 'range' ? setting.default : 100));
  return Number.isFinite(value) ? Math.min(1, Math.max(0.1, value / 100)) : 1;
}
