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
import type { BasemapMode } from './basemap-mode.ts';
import { flavorLayers } from './styles/basemap.ts';
import { PLAIN_BACKGROUND } from './styles/palette.ts';

export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
export const BASEMAP_SOURCE = 'protomaps';

export function basemapFiles(dataBase: string) {
  const dir = `${dataBase}basemap/`;
  return {
    tiles: `${dir}philly.pmtiles`,
    glyphs: `${dir}fonts/{fontstack}/{range}.pbf`,
    sprite: `${dir}sprites/v4/light`,
  };
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

/** True when the extract exists and starts like a PMTiles file. */
export async function extractAvailable(dataBase: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    // Not from the browser cache: a cached range of an older copy of the file would make the server
    // send the whole 45 MB file (see pmtiles-source.ts).
    const response = await fetchImpl(basemapFiles(dataBase).tiles, { headers: { Range: 'bytes=0-6' }, cache: 'no-store' });
    if (!response.ok) return false;
    const head = new Uint8Array(await response.arrayBuffer()).slice(0, 7);
    return new TextDecoder().decode(head) === 'PMTiles';
  } catch {
    return false;
  }
}

export interface BasemapChoice {
  style: StyleSpecification | string;
  /** True when the base map was wanted but could not be found. */
  missing: boolean;
}

export async function chooseBasemap(mode: BasemapMode, dataBase: string, fetchImpl: typeof fetch = fetch): Promise<BasemapChoice> {
  if (mode === 'none') return { style: plainStyle(), missing: false };
  if (mode === 'openfreemap') return { style: OPENFREEMAP_STYLE, missing: false };
  if (await extractAvailable(dataBase, fetchImpl)) return { style: protomapsStyle(dataBase), missing: false };
  return { style: plainStyle(), missing: true };
}

/** The credit for the base map in the map's credits line, or null when the style brings its own. */
export function basemapCredit(style: StyleSpecification | string): string | null {
  return isProtomaps(style) ? strings.credits.basemap : null;
}
