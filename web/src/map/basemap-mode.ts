// Which base map to draw, chosen at build time with VITE_BASEMAP. Kept apart from
// ./basemap.ts so pages that never draw a map do not download the base map style code.

export type BasemapMode = 'protomaps' | 'openfreemap' | 'none';

export function basemapMode(value: string | undefined): BasemapMode {
  return value === 'openfreemap' || value === 'none' ? value : 'protomaps';
}

/** Where the self hosted extract lives under the data root. */
export function basemapTilesUrl(dataBase: string): string {
  return `${dataBase}basemap/philly.pmtiles`;
}

/**
 * True when the extract exists and starts like a PMTiles file. It lives here, apart from the base
 * map style code, so the page can ask while the map library is still downloading.
 */
export async function extractAvailable(dataBase: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    // Not from the browser cache: a cached range of an older copy of the file would make the server
    // send the whole 45 MB file (see pmtiles-source.ts).
    const response = await fetchImpl(basemapTilesUrl(dataBase), { headers: { Range: 'bytes=0-6' }, cache: 'no-store' });
    if (!response.ok) return false;
    const head = new Uint8Array(await response.arrayBuffer()).slice(0, 7);
    return new TextDecoder().decode(head) === 'PMTiles';
  } catch {
    return false;
  }
}
