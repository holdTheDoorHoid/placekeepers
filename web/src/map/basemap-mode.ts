// Which base map to draw, chosen at build time with VITE_BASEMAP. Kept apart from
// ./basemap.ts so pages that never draw a map do not download the base map style code.

export type BasemapMode = 'protomaps' | 'openfreemap' | 'none';

export function basemapMode(value: string | undefined): BasemapMode {
  return value === 'openfreemap' || value === 'none' ? value : 'protomaps';
}
