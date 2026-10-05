// Starting the base map without waiting on itself: the page asks whether the extract is there
// while the map library downloads, and asks for the label font before the map does.

import { describe, expect, it } from 'vitest';
import { basemapTilesUrl, extractAvailable } from '../src/map/basemap-mode.ts';
import { LABEL_FONT, basemapFiles, chooseBasemap, isProtomaps, warmLabelFont } from '../src/map/basemap.ts';

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
