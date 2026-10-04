import type { StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UncachedFetchSource, registerArchive, styleArchives } from '../src/map/pmtiles-source.ts';

const URL_A = 'https://example.org/data/tiles/lots.pmtiles';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UncachedFetchSource', () => {
  it('asks for a byte range and skips the browser cache', async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array(16), { status: 206, headers: { 'Content-Length': '16' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const source = new UncachedFetchSource(URL_A);
    const range = await source.getBytes(100, 16);
    expect(range.data.byteLength).toBe(16);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_A);
    expect(init.cache).toBe('no-store');
    expect(new Headers(init.headers).get('range')).toBe('bytes=100-115');
  });
});

describe('registerArchive', () => {
  it('registers each file once, with an uncached source', () => {
    const protocol = new Protocol({ metadata: false });
    registerArchive(protocol, URL_A);
    const first = protocol.get(URL_A);
    registerArchive(protocol, URL_A);
    expect(protocol.get(URL_A)).toBe(first);
    expect(first?.source).toBeInstanceOf(UncachedFetchSource);
    expect(first?.source.getKey()).toBe(URL_A);
  });
});

describe('styleArchives', () => {
  it('lists the files a style reads through pmtiles://', () => {
    const style = {
      version: 8,
      sources: {
        base: { type: 'vector', url: 'pmtiles://https://example.org/data/basemap/philly.pmtiles' },
        other: { type: 'vector', url: 'https://example.org/tiles.json' },
        inline: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [],
    } as StyleSpecification;
    expect(styleArchives(style)).toEqual(['https://example.org/data/basemap/philly.pmtiles']);
  });

  it('has nothing to list for a style given by address', () => {
    expect(styleArchives('https://tiles.openfreemap.org/styles/positron')).toEqual([]);
  });
});
