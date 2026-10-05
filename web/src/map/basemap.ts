// The base map underneath the data: streets, buildings, water and place names.
//
// Default ("protomaps"): a self hosted Protomaps extract of the Philadelphia area at
// <data root>/basemap/philly.pmtiles, with its fonts and icons beside it, all made by
// scripts/make-basemap.sh. No API keys and no third party tile service.
// Fallback ("openfreemap"): the hosted OpenFreeMap Positron style, chosen at build time
// with VITE_BASEMAP=openfreemap, for when the extract cannot be built.
// "none": a plain background.
//
// The base map is the registry layer `basemap` (src/map/styles/basemap.ts), which the map controller
// turns off or gives the gray look by restyling the base layers in place.

import type { StyleSpecification } from 'maplibre-gl';
import { strings } from '../strings.ts';
import { basemapTilesUrl, extractAvailable, type BasemapMode } from './basemap-mode.ts';
import { flavorLayers } from './styles/basemap.ts';
import { PLAIN_BACKGROUND } from './styles/palette.ts';

export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
export const BASEMAP_SOURCE = 'protomaps';

export function basemapFiles(dataBase: string) {
  const dir = `${dataBase}basemap/`;
  return {
    tiles: basemapTilesUrl(dataBase),
    glyphs: `${dir}fonts/{fontstack}/{range}.pbf`,
    sprite: `${dir}sprites/v4/light`,
  };
}

/** The font the base map draws street and place names with, and its first range (Latin letters). */
export const LABEL_FONT = { stack: 'Noto Sans Regular', range: '0-255' } as const;

/**
 * Asks for the label font while the map is still being built. The map asks for it only after its
 * first base map tile arrives, which on a slow connection leaves it waiting a second or more for
 * one small file; the browser keeps this copy and hands it to the map.
 */
export function warmLabelFont(dataBase: string, fetchImpl: typeof fetch = fetch): void {
  const url = basemapFiles(dataBase).glyphs.replace('{fontstack}', LABEL_FONT.stack).replace('{range}', LABEL_FONT.range);
  fetchImpl(url).catch(() => {});
}

export function plainStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'pk:background', type: 'background', paint: { 'background-color': PLAIN_BACKGROUND } }],
  };
}

export function protomapsStyle(dataBase: string): StyleSpecification {
  const files = basemapFiles(dataBase);
  return {
    version: 8,
    glyphs: files.glyphs,
    sprite: files.sprite,
    // The credit is in the map's own credits line (src/map/controller.ts), not on the source.
    sources: { [BASEMAP_SOURCE]: { type: 'vector', url: `pmtiles://${files.tiles}` } },
    // The light look holds every layer; the controller restyles them for the chosen look.
    layers: flavorLayers(BASEMAP_SOURCE, 'light'),
  };
}

/** True for a style built on the self hosted Protomaps extract. */
export function isProtomaps(style: StyleSpecification | string): style is StyleSpecification {
  return typeof style !== 'string' && BASEMAP_SOURCE in (style.sources ?? {});
}

export { extractAvailable };

export interface BasemapChoice {
  style: StyleSpecification | string;
  /** True when the base map was wanted but could not be found. */
  missing: boolean;
}

/**
 * The base map to start with. `available` is the answer of extractAvailable when the page already
 * asked (it asks while the map library downloads, which saves a round trip on slow connections).
 */
export async function chooseBasemap(
  mode: BasemapMode,
  dataBase: string,
  fetchImpl: typeof fetch = fetch,
  available?: Promise<boolean>,
): Promise<BasemapChoice> {
  if (mode === 'none') return { style: plainStyle(), missing: false };
  if (mode === 'openfreemap') return { style: OPENFREEMAP_STYLE, missing: false };
  if (await (available ?? extractAvailable(dataBase, fetchImpl))) return { style: protomapsStyle(dataBase), missing: false };
  return { style: plainStyle(), missing: true };
}

/** The credit for the base map in the map's credits line, or null when the style brings its own. */
export function basemapCredit(style: StyleSpecification | string): string | null {
  return isProtomaps(style) ? strings.credits.basemap : null;
}
