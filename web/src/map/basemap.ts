// The base map underneath the data: streets, buildings, water and place names.
//
// Default ("protomaps"): a self hosted Protomaps extract of the Philadelphia area at
// <data root>/basemap/philly.pmtiles, with its fonts and icons beside it, all made by
// scripts/make-basemap.sh. No API keys and no third party tile service.
// Fallback ("openfreemap"): the hosted OpenFreeMap Positron style, chosen at build time
// with VITE_BASEMAP=openfreemap, for when the extract cannot be built.
// "none": a plain background.

import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import { strings } from '../strings.ts';
import type { BasemapMode } from './basemap-mode.ts';
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
    sources: {
      [BASEMAP_SOURCE]: { type: 'vector', url: `pmtiles://${files.tiles}`, attribution: strings.basemap.attribution },
    },
    layers: layers(BASEMAP_SOURCE, namedFlavor('light'), { lang: 'en' }) as StyleSpecification['layers'],
  };
}

/** True when the extract exists and starts like a PMTiles file. */
export async function extractAvailable(dataBase: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(basemapFiles(dataBase).tiles, { headers: { Range: 'bytes=0-6' } });
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
