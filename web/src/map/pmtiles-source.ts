// How the map reads PMTiles files: in small byte ranges, never from the browser cache.
//
// GitHub Pages gives every file a new ETag each time the site is published, even a file whose
// bytes did not change. A browser that kept ranges of last week's file then asks for "this range,
// if the file is unchanged" (If-Range) and gets the whole new file back instead of the range. The
// PMTiles reader rejects that answer, so the layer stays empty until the next reload: every
// returning visitor would meet an empty map once after each weekly refresh. A cached range saves
// little anyway, because once it is ten minutes old the browser downloads it again in full.

import type { StyleSpecification } from 'maplibre-gl';
import { FetchSource, PMTiles, type Protocol } from 'pmtiles';

const SCHEME = 'pmtiles://';

/** A PMTiles FetchSource that never reads or writes the browser cache. */
export class UncachedFetchSource extends FetchSource {
  constructor(url: string) {
    super(url);
    // FetchSource's own switch for skipping the browser cache, which it turns on only for Chrome
    // on Windows. tests/pmtiles-source.test.ts fails if a PMTiles upgrade renames it.
    this.chromeWindowsNoCache = true;
  }
}

/** Makes the protocol read the file at `url` (a full address) through an UncachedFetchSource. */
export function registerArchive(protocol: Protocol, url: string): void {
  if (!protocol.get(url)) protocol.add(new PMTiles(new UncachedFetchSource(url)));
}

/** The files a style reads through the pmtiles:// protocol, as full addresses. */
export function styleArchives(style: StyleSpecification | string): string[] {
  if (typeof style === 'string') return [];
  const urls: string[] = [];
  for (const source of Object.values(style.sources ?? {})) {
    if ('url' in source && typeof source.url === 'string' && source.url.startsWith(SCHEME)) {
      urls.push(source.url.slice(SCHEME.length));
    }
  }
  return urls;
}
