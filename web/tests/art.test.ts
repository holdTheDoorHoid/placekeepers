// Public art (M3.2): the layer's place in the registry, each setting's effect on the map, the
// legend, what a tapped work says with a link to each source, and memorial artworks shown
// without any name (docs/ETHICS.md), even if a file carried one.

import { readFileSync } from 'node:fs';
import { featureFilter } from '@maplibre/maplibre-gl-style-spec';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { describeArt, siteName } from '../src/art/describe.ts';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import { MURAL_ARTS_ARTWORKS_URL, osmEditUrl } from '../src/config/links.ts';
import { styleFor } from '../src/map/styles/index.ts';
import { ART_KIND } from '../src/map/styles/public_art.ts';
import { ART_COLORS } from '../src/map/styles/palette.ts';
import type { LegendEntry } from '../src/map/styles/types.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { strings } from '../src/strings.ts';

const reg = loadRegistry();
const layer = reg.layers.find((l) => l.id === 'public_art')!;
const a = strings.art;
const CITY_LIST = 'https://opendataphilly.org/datasets/percent-for-art-locations/';
const HERE: [number, number] = [-75.1636, 39.9524];

function textOf(markup: string): string {
  return markup
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function dot(state: AppState) {
  return styleFor(layer)!
    .layers({ layer, registry: reg, state, sourceId: 'tiles', sourceLayer: 'art' })
    .find((p) => p.id.endsWith(':dot'))!;
}

function shown(state: AppState, properties: Record<string, unknown>): boolean {
  const filter = (dot(state) as { filter: unknown }).filter;
  return featureFilter(filter as never).filter({ zoom: 15 } as never, { type: 1, properties } as never);
}

function legend(state: AppState): LegendEntry[] {
  return styleFor(layer)!.legend({ layer, registry: reg, state });
}

function details(features: Record<string, unknown>[]): string {
  const store = { registry: reg, state: defaultState(reg, 'field') } as unknown as AppStore;
  const target = { layerId: 'public_art', features, lngLat: HERE };
  return textOf(render(FeatureDetails, { props: { store, target, heading: strings.streets.detailsTitle('public_art') } }).body);
}

describe('the public art layer', () => {
  it('sits in its own group, is off by default in both views and credits its three sources', () => {
    expect(layer.group).toBe('placemaking');
    expect(reg.groups.find((g) => g.id === 'placemaking')?.label).toBe('Art and placemaking');
    expect(layer.default).toEqual({ field: false, analysis: false });
    expect(layer.sources).toEqual(['percent_for_art', 'osm_philadelphia', 'wikidata_art']);
    expect(layer.evidence).toBe('not_violence');
    const wikidata = reg.sources.find((s) => s.id === 'wikidata_art')!;
    expect(wikidata.endpoint).toEqual({ kind: 'sparql', url: 'https://query.wikidata.org/sparql' });
    expect(reg.sources.find((s) => s.id === 'osm_philadelphia')!.endpoint.tags).toContain('tourism=artwork');
  });

  it('shows or hides each kind of work with its own switch', () => {
    const state = defaultState(reg, 'analysis');
    const works = { mural: { k: 1 }, sculpture: { k: 2 }, mosaic: { k: 3 }, other: { k: 0 }, unknown: {} };
    expect(Object.values(works).map((p) => shown(state, p))).toEqual([true, true, true, true, true]);
    for (const [setting, hidden] of [['murals', 'mural'], ['sculptures', 'sculpture'], ['mosaics', 'mosaic'], ['other', 'other']] as const) {
      const one = defaultState(reg, 'analysis');
      one.settings.public_art![setting] = false;
      for (const [kind, properties] of Object.entries(works)) {
        const expected = kind !== hidden && !(hidden === 'other' && kind === 'unknown');
        expect(shown(one, properties), `${setting} off, ${kind}`).toBe(expected);
      }
      expect(legend(one).filter((e) => e.kind === 'circle')).toHaveLength(3);
    }
  });

  it('hides works inside buildings when that switch is off, and says so', () => {
    const state = defaultState(reg, 'field');
    expect(shown(state, { k: 0, in: 1 })).toBe(true);
    state.settings.public_art!.inside = false;
    expect(shown(state, { k: 0, in: 1 })).toBe(false);
    expect(shown(state, { k: 0 })).toBe(true);
    expect(legend(state).some((e) => e.kind === 'note' && e.text === a.insideHidden)).toBe(true);
  });

  it('shows nothing when every kind is off, and the legend says why', () => {
    const state = defaultState(reg, 'field');
    for (const setting of ['murals', 'sculptures', 'mosaics', 'other']) state.settings.public_art![setting] = false;
    expect(shown(state, { k: 1 })).toBe(false);
    expect(legend(state).some((e) => e.kind === 'note' && e.text === a.allOff)).toBe(true);
  });

  it('colors each kind as its legend does, and says memorials carry no names', () => {
    const state = defaultState(reg, 'field');
    const circles = legend(state).filter((e): e is Extract<LegendEntry, { kind: 'circle' }> => e.kind === 'circle');
    expect(circles.map((c) => c.label)).toEqual([a.legend.mural, a.legend.sculpture, a.legend.mosaic, a.legend.other]);
    expect(circles.map((c) => c.fill)).toEqual([ART_COLORS.mural, ART_COLORS.sculpture, ART_COLORS.mosaic, ART_COLORS.other]);
    expect(legend(state).some((e) => e.kind === 'note' && e.text === a.memorialNote)).toBe(true);
    const paint = (dot(state) as { paint: Record<string, unknown> }).paint;
    expect(JSON.stringify(paint['circle-color'])).toContain(ART_COLORS.mosaic);
    expect(ART_KIND).toEqual({ other: 0, mural: 1, sculpture: 2, mosaic: 3 });
  });
});

describe('what a tapped work says', () => {
  const statue = {
    id: 'pa224',
    k: 2,
    src: 7,
    ty: 6,
    nm: 'Clothespin',
    ar: 'Claes Oldenburg',
    y: 1976,
    md: 'Metal, weathering steel',
    lc: 'Centre Square',
    pa: 224,
    doc: 'https://dpd-art-is-essential-docs.s3.amazonaws.com/224.pdf',
    osm: 'n666320453',
    wd: 'Q5135560',
    wp: 'https://en.wikipedia.org/wiki/Clothespin_(Oldenburg)',
    w: 'https://www.associationforpublicart.org/artwork/clothespin/',
  };

  it('gives the title, kind, artist, year, material and place, and a link to each source', () => {
    const view = describeArt(statue, HERE, CITY_LIST);
    expect(view.memorial).toBe(false);
    expect(view.heading).toBe('Clothespin');
    expect(view.kind).toBe('A statue');
    expect(view.facts).toEqual(['By Claes Oldenburg.', 'Made in 1976.', 'Made of: Metal, weathering steel.', 'Where: Centre Square.']);
    expect(view.links).toEqual([
      { label: a.cityRecord, url: statue.doc },
      { label: a.openOsm, url: 'https://www.openstreetmap.org/node/666320453' },
      { label: a.openWikidata, url: 'https://www.wikidata.org/wiki/Q5135560' },
      { label: a.openWikipedia, url: statue.wp },
      { label: a.website("the Association for Public Art's site"), url: statue.w },
    ]);
    expect(view.muralArts).toBeNull();
    expect(view.fixUrl).toBe('https://www.openstreetmap.org/edit?node=666320453');
  });

  it("names an untitled mural by its kind, links Mural Arts' own list, and says it is inside when it is", () => {
    const view = describeArt({ id: 'pa9', k: 1, ty: 1, pa: 9, in: 1 }, HERE, CITY_LIST);
    expect(view.heading).toBe('A mural');
    expect(view.kind).toBeNull();
    expect(view.facts).toEqual([a.untitled, a.inside]);
    expect(view.links).toEqual([{ label: a.cityList, url: CITY_LIST }]);
    expect(view.muralArts).toBe(MURAL_ARTS_ARTWORKS_URL);
    expect(view.fixUrl).toBe(osmEditUrl(null, HERE[0], HERE[1]));
    expect(view.fixUrl).toBe('https://www.openstreetmap.org/edit#map=19/39.952400/-75.163600');
  });

  it('names websites in words where it knows them, and by their address otherwise', () => {
    expect(siteName('https://www.associationforpublicart.org/artwork/x/')).toBe("the Association for Public Art's site");
    expect(siteName('https://muralarts.org/artworks/x/')).toBe("Mural Arts Philadelphia's site");
    expect(siteName('https://www.jodypinto.com/x')).toBe('jodypinto.com');
  });

  it('lists every work tapped at one spot', () => {
    const text = details([statue, { id: 'n2', k: 1, ty: 1, osm: 'n2' }]);
    expect(text).toContain(a.worksHere(2));
    expect(text).toContain('Clothespin');
    expect(text).toContain('A mural');
    expect(text).toContain(a.muralArts);
    expect(text).toContain(a.credit);
  });
});

describe('memorial artworks (docs/ETHICS.md)', () => {
  // As the pipeline publishes one: whether it is a memorial, its kind and its sources by number.
  const memorial = { id: 'Q129570976', k: 2, src: 6, mem: 1, osm: 'w1387913462', wd: 'Q129570976' };
  // A file that carried words it must never carry: none of them may be shown.
  const leaky = {
    ...memorial,
    nm: 'Jordan Sample Memorial',
    ar: 'Avery Quill',
    y: 2015,
    md: 'Bronze',
    lc: 'Sample Rec Center',
    ty: 6,
    in: 1,
    wp: 'https://en.wikipedia.org/wiki/Jordan_Sample',
    w: 'https://example.org/jordan-sample',
  };

  it('show only that they are memorial artworks, with their sources', () => {
    for (const properties of [memorial, leaky]) {
      const view = describeArt(properties, HERE, CITY_LIST);
      expect(view.memorial).toBe(true);
      expect(view.heading).toBe(a.memorialTitle);
      expect(view.kind).toBeNull();
      expect(view.facts).toEqual([]);
      expect(view.muralArts).toBeNull();
      expect(view.links).toEqual([
        { label: a.openOsm, url: 'https://www.openstreetmap.org/way/1387913462' },
        { label: a.openWikidata, url: 'https://www.wikidata.org/wiki/Q129570976' },
      ]);
    }
  });

  it('never show a name, an artist, a year or a place, even one a file carried', () => {
    const text = details([leaky]);
    expect(text).toContain(a.memorialTitle);
    expect(text).toContain(a.memorialText);
    for (const word of ['Jordan', 'Sample', 'Quill', '2015', 'Bronze', 'Rec Center', 'example.org', 'Wikipedia']) {
      expect(text, word).not.toContain(word);
    }
  });

  it('carry nothing but their kind and sources in the sample data', () => {
    const fixture = JSON.parse(readFileSync(new URL('../fixtures/data/tiles/art.art.geojson', import.meta.url), 'utf8'));
    const memorials = fixture.features.filter((f: { properties: Record<string, unknown> }) => f.properties.mem === 1);
    expect(memorials.length).toBeGreaterThan(0);
    for (const feature of memorials) {
      expect(Object.keys(feature.properties).every((key) => ['id', 'k', 'src', 'mem', 'pa', 'doc', 'osm', 'wd'].includes(key))).toBe(true);
    }
  });
});
