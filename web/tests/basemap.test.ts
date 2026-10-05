// Starting the base map without waiting on itself: the page asks whether the extract is there
// while the map library downloads, and asks for the label font before the map does.

import { featureFilter } from '@maplibre/maplibre-gl-style-spec';
import { layers as protomapsLayers, namedFlavor } from '@protomaps/basemaps';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { basemapTilesUrl, extractAvailable } from '../src/map/basemap-mode.ts';
import { LABEL_FONT, basemapFiles, chooseBasemap, isProtomaps, warmLabelFont } from '../src/map/basemap.ts';
import { HIDDEN_POI_KINDS, flavorLayers, restyleBase } from '../src/map/styles/basemap.ts';

function fakeFetch(answer: (url: string) => Response) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return answer(url);
  }) as typeof fetch;
  return { calls, impl };
}

describe('the base map extract', () => {
  it('is found by the first bytes of the file', async () => {
    const yes = fakeFetch(() => new Response('PMTiles\u0003'));
    expect(await extractAvailable('/data/', yes.impl)).toBe(true);
    expect(yes.calls).toEqual([basemapTilesUrl('/data/')]);
    const no = fakeFetch(() => new Response('nope', { status: 404 }));
    expect(await extractAvailable('/data/', no.impl)).toBe(false);
  });

  it('uses an answer the page already asked for, without asking again', async () => {
    const never = fakeFetch(() => {
      throw new Error('should not be asked');
    });
    const found = await chooseBasemap('protomaps', '/data/', never.impl, Promise.resolve(true));
    expect(isProtomaps(found.style)).toBe(true);
    expect(found.missing).toBe(false);
    const missing = await chooseBasemap('protomaps', '/data/', never.impl, Promise.resolve(false));
    expect(missing).toMatchObject({ missing: true });
    expect(never.calls).toEqual([]);
  });

  it('asks for the label font the base map style draws names with', () => {
    const asked = fakeFetch(() => new Response(''));
    warmLabelFont('/data/', asked.impl);
    const style = chooseBasemap('protomaps', '/data/', asked.impl, Promise.resolve(true));
    expect(asked.calls).toEqual([`/data/basemap/fonts/${LABEL_FONT.stack}/${LABEL_FONT.range}.pbf`]);
    expect(basemapFiles('/data/').glyphs).toBe('/data/basemap/fonts/{fontstack}/{range}.pbf');
    return style.then(({ style: s }) => {
      // The style's names use this font, so the map reuses the copy the page asked for.
      expect(JSON.stringify(s)).toContain(LABEL_FONT.stack);
    });
  });
});

describe('base map labels that could name a person on a memorial (docs/ETHICS.md)', () => {
  /** Whether a point of interest of this kind is drawn at this zoom, in each of the base map's looks. */
  function drawn(kind: string, zoom: number): boolean[] {
    return (['light', 'muted'] as const).flatMap((look) =>
      flavorLayers('protomaps', look)
        .filter((l) => l.type === 'symbol' && l['source-layer'] === 'pois')
        .map((l) => featureFilter((l as { filter: unknown }).filter as never).filter({ zoom } as never, { type: 1, properties: { kind, min_zoom: 0, name: 'Sample' } } as never)),
    );
  }

  it('never draws works of art, memorials, monuments, tombs, graves or wayside shrines, at any zoom', () => {
    // The kinds the Philadelphia extract held on 2026-10-05, and wayside crosses, which it may.
    expect([...HIDDEN_POI_KINDS].sort()).toEqual(['artwork', 'grave_yard', 'memorial', 'monument', 'tomb', 'wayside_cross', 'wayside_shrine']);
    expect(drawn('park', 18)).toEqual([true]);
    for (const kind of HIDDEN_POI_KINDS) {
      for (const zoom of [0, 10, 13, 15, 16, 17, 18, 19, 22]) expect(drawn(kind, zoom), `${kind} at zoom ${zoom}`).toEqual([false]);
    }
  });

  it('draws everything else as Protomaps does', () => {
    const plain = protomapsLayers('protomaps', namedFlavor('light'), { lang: 'en' }) as LayerSpecification[];
    const ours = flavorLayers('protomaps', 'light');
    expect(ours.map((l) => l.id)).toEqual(plain.map((l) => l.id));
    ours.forEach((layer, i) => {
      if (layer.id === 'pois') {
        expect((layer as { filter: unknown }).filter).toEqual(['all', (plain[i] as { filter: unknown }).filter, ['!', ['in', ['get', 'kind'], ['literal', [...HIDDEN_POI_KINDS]]]]]);
      } else expect(layer).toEqual(plain[i]);
    });
    // The gray look draws no points of interest at all, so it needs no change.
    expect(flavorLayers('protomaps', 'muted')).toEqual(protomapsLayers('protomaps', namedFlavor('grayscale'), { lang: 'en' }));
  });

  it('keeps them hidden when the look changes', () => {
    const restyled = restyleBase(flavorLayers('protomaps', 'light'), 'light', true, true).find((l) => l.id === 'pois') as { filter: unknown };
    expect(JSON.stringify(restyled.filter)).toContain('"artwork","memorial","monument"');
  });
});
