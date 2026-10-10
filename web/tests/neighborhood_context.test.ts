// Neighborhood context (M4.7, issue #43): warming and cooling sites as listed (never live, no
// credit line, one marker per place), playgrounds, the nearest playground on a lot page, and
// rent burden, rent, income and empty homes on a tapped watch area, each with its margin.

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { describePlace, listedOn, sitePlace } from '../src/amenities/describe.ts';
import LayerItem from '../src/components/layers/LayerItem.svelte';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import { parseManifest, type Manifest } from '../src/data/manifest.ts';
import { describeArea, describeContext, parseWatchSummary } from '../src/displacement/watch.ts';
import { STYLES, styleFor } from '../src/map/styles/index.ts';
import { PLACE_COLORS } from '../src/map/styles/palette.ts';
import type { StyleContext } from '../src/map/styles/types.ts';
import { defaultLayers, defaultState } from '../src/state/defaults.ts';
import { AppStore } from '../src/state/store.svelte.ts';
import { distanceWords, strings } from '../src/strings.ts';

const reg = loadRegistry();
const layer = (id: string) => reg.layers.find((l) => l.id === id)!;
const FIXTURES = new URL('../fixtures/data/', import.meta.url);
const fixture = (name: string) => JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf-8'));
const manifest = parseManifest(fixture('manifest.json')).manifest as Manifest;
const SITES = fixture('tiles/places.cooling.geojson').features.map((f: { properties: Record<string, unknown> }) => f.properties);
const AREAS = fixture('tiles/displacement.watch.geojson').features.map((f: { properties: Record<string, unknown> }) => f.properties);

function ctx(id: string, settings: Record<string, string> = {}, layers?: string[]): StyleContext {
  const state = defaultState(reg, 'analysis');
  state.settings[id] = { ...state.settings[id], ...settings };
  if (layers) state.layers = layers;
  return { layer: layer(id), registry: reg, state, sourceId: `src-${id}`, sourceLayer: layer(id).source_layer, manifest };
}

function filterOf(specs: LayerSpecification[], name: string): FilterSpecification | undefined {
  return (specs.find((s) => s.id.endsWith(`:${name}`)) as { filter?: FilterSpecification }).filter;
}

const OPEN: FilterSpecification = ['==', ['to-number', ['get', 'st'], -1], 1];
const NOTHING: FilterSpecification = ['==', ['literal', 1], 0];

describe('warming and cooling sites', () => {
  it('are a public place layer of their own, off by default, beside the pools', () => {
    expect(styleFor(layer('cooling_centers'))).toBe(STYLES.public_place);
    expect(layer('cooling_centers').group).toBe('public_places');
    for (const view of ['field', 'analysis'] as const) expect(defaultLayers(reg, view)).not.toContain('cooling_centers');
    expect(PLACE_COLORS.cooling_centers).toBeDefined();
    expect(new Set(Object.values(PLACE_COLORS)).size).toBe(Object.keys(PLACE_COLORS).length);
  });

  it('fill a site listed as open and ring one listed as closed, or show only the open ones', () => {
    const all = STYLES.public_place.layers(ctx('cooling_centers'));
    expect(filterOf(all, 'dot')).toEqual(OPEN);
    expect(filterOf(all, 'ring')).toEqual(['!', OPEN]);
    const open = STYLES.public_place.layers(ctx('cooling_centers', { show: 'open' }));
    expect(filterOf(open, 'ring')).toEqual(NOTHING);
  });

  it('show sites for heat or cold, or only for cooling or only for warming', () => {
    const cooling = STYLES.public_place.layers(ctx('cooling_centers', { kind: 'cooling' }));
    expect(filterOf(cooling, 'dot')).toEqual(['all', ['==', ['to-number', ['get', 'c'], -1], 1], OPEN]);
    const warming = STYLES.public_place.layers(ctx('cooling_centers', { kind: 'warming', show: 'open' }));
    expect(filterOf(warming, 'dot')).toEqual(['all', ['==', ['to-number', ['get', 'w'], -1], 1], OPEN]);
  });

  it('leave a library or recreation center that is also a site to the site, while the sites are on', () => {
    const alone = STYLES.public_place.layers(ctx('libraries', {}, ['libraries']));
    expect(filterOf(alone, 'dot')).toBeUndefined();
    const both = STYLES.public_place.layers(ctx('libraries', {}, ['libraries', 'cooling_centers']));
    expect(filterOf(both, 'dot')).toEqual(['!', ['has', 'cc']]);
    const rec = STYLES.public_place.layers(ctx('recreation_centers', {}, ['recreation_centers', 'cooling_centers']));
    expect(filterOf(rec, 'dot')).toEqual(['!', ['has', 'cc']]);
    // Pools are never sites: they keep their own markers.
    expect(filterOf(STYLES.public_place.layers(ctx('pools', {}, ['pools', 'cooling_centers'])), 'dot')).toEqual(OPEN);
  });

  it('carry no credit line, only the day the list was copied and that it is not live', () => {
    const legend = STYLES.public_place.legend(ctx('cooling_centers', {}, ['cooling_centers', 'libraries']));
    const text = JSON.stringify(legend);
    expect(text).not.toMatch(/Emergency Management|credit|©/i);
    expect(text).toContain('As the City listed them on October 4, 2026 (the list was last changed on October 2, 2026). Not live');
    expect(text).toContain(strings.places.cooling.oneMarker);
    expect(listedOn(null)).toEqual({ copied: null, changed: null });
    expect(strings.places.cooling.asListed(null, null)).toMatch(/^As the City listed them when this map last copied the list\. Not live/);
  });

  it('list their source in "About this layer" without a credit line', () => {
    const store = new AppStore(reg, { state: defaultState(reg, 'analysis'), viewPinned: true, from: 'link' }, { listStorage: null });
    const sites = render(LayerItem, { props: { store, layer: layer('cooling_centers'), idPrefix: 't' } }).body;
    const source = reg.sources.find((s) => s.id === 'warming_cooling_sites')!;
    expect(sites).toContain(source.name);
    expect(sites).toContain('No license stated by the publisher');
    expect(sites).not.toContain(source.attribution);
    const libraries = render(LayerItem, { props: { store, layer: layer('libraries'), idPrefix: 't' } }).body;
    expect(libraries).toContain(reg.sources.find((s) => s.id === 'library_locations')!.attribution);
  });

  it('describe a site in the City\'s words, as listed, with the place of ours it also is', () => {
    const view = describePlace('cooling_centers', SITES[0], manifest);
    expect(view.title).toBe('Sample');
    expect(view.kind).toBe('Free Library branch');
    expect(view.facts).toEqual([
      '1 Sample St.',
      'Listed as open',
      'Listed as a warming and a cooling site',
      'Hours as listed: 9a-7p',
      'What it offers, as listed: Book Drop Browse Shelves Computer Use Wi-fi',
      'Listed as accessible for people with disabilities',
      'Has a water station',
      'Also on the map as a Free Library branch: Sample Library.',
    ]);
    expect(view.source).toMatch(/^As the City listed them on October 4, 2026/);
    expect(view.link).toBeNull();
    expect(sitePlace(SITES[0])).toEqual({ layerId: 'libraries', id: 'lib1', name: 'Sample Library' });
    const closed = describePlace('cooling_centers', SITES[1], manifest);
    expect(closed.facts).toContain('Listed as closed');
    expect(closed.facts).toContain('Listed as a cooling site');
    expect(closed.facts).toContain('Room for 20 people, as listed');
    expect(sitePlace(SITES[1])).toBeNull();
    expect(describePlace('libraries', { id: 'lib1', nm: 'Sample Library', cc: 'cool1' }).facts).toContain(strings.places.cooling.alsoSite);
  });

  it('show the site and, while its layer is on, the library it also is in one details panel', () => {
    const library = { id: 'lib1', nm: 'Sample Library', ad: '1 Sample Street', zip: '19133', cc: 'cool1' };
    const store = {
      registry: reg,
      state: { ...defaultState(reg, 'analysis'), layers: ['cooling_centers', 'libraries'] },
      manifest,
      inspected: null,
      controller: { featuresWith: (layerId: string, key: string, value: string) => (layerId === 'libraries' && key === 'id' && value === 'lib1' ? [library] : []) },
    } as unknown as AppStore;
    const html = render(FeatureDetails, { props: { store, target: { layerId: 'cooling_centers', features: [SITES[0]], lngLat: [-75.16, 39.98] } } }).body;
    expect(html).toContain('Listed as open');
    expect(html).toContain(strings.places.source.libraries);
    expect(html).toContain('1 Sample Street, Philadelphia, PA 19133');
    // Said once, by the site's own details, not again under the library.
    expect(html).not.toContain(strings.places.cooling.alsoSite);
    expect(html).not.toMatch(/Emergency Management/);
  });
});

describe('playgrounds', () => {
  it('are a placemaking layer, off by default, with ages and the year installed', () => {
    expect(styleFor(layer('playgrounds'))).toBe(STYLES.public_place);
    expect(layer('playgrounds').group).toBe('placemaking');
    const view = describePlace('playgrounds', { id: 'pg1', nm: 'Sample Playground', ag: 1, yr: 2018 });
    expect(view).toMatchObject({ title: 'Sample Playground', kind: 'Playground', facts: ['For ages 2 to 5', 'Installed in 2018'] });
    expect(view.source).toBe(strings.places.source.parks);
    expect(STYLES.public_place.legend(ctx('playgrounds'))[0]).toMatchObject({ label: 'A playground', fill: PLACE_COLORS.playgrounds });
  });

  it('give a lot page the nearest one in plain words', () => {
    expect(distanceWords(224)).toBe('220 meters');
    expect(distanceWords(1260)).toBe('1.3 kilometers');
    const n = strings.dossier.nearby;
    expect(n.playground('Sample Playground', 260)).toBe('Sample Playground, about 260 meters away in a straight line, within a 5 minute walk.');
    expect(n.playground('Far Playground', 650)).toContain('within a 10 minute walk');
    expect(n.playground('Very Far Playground', 1500)).toBe('Very Far Playground, about 1.5 kilometers away in a straight line.');
  });
});

describe('the neighborhood context of a watch area', () => {
  const summary = parseWatchSummary(fixture('manifest.json').displacement)!;

  it('reads the city and the survey from the manifest', () => {
    expect(summary.city).toMatchObject({ rb: 30, gr: 1397, hi: 61953, vp: 9 });
    expect(summary.context).toEqual({ survey_years: [2020, 2024], min_renters: 100, min_homes: 100 });
    expect(parseWatchSummary({ city: {} })!.context).toBeNull();
  });

  it('gives every number with its margin and the city\'s own', () => {
    const rows = describeContext(AREAS[0], summary);
    // Rent burden is a sign since 2026-10-09 (owner), listed with the signs, not here.
    expect(rows.map((r) => r.id)).toEqual(['rent', 'income', 'vacant']);
    expect(rows[0]!.text).toBe('$1,180 a month, with the utilities the renter pays (give or take $95), against $1,397 across the city.');
    expect(rows[1]!.text).toBe('$41,250 a year (give or take $6,900), against $61,953 across the city.');
    expect(rows[2]!.text).toBe('290 of the 2,120 homes here, 14% (give or take 4 points), against 9% across the city.');
    expect(rows[2]!.parts).toEqual([
      'For rent: 60 (give or take 35)',
      'For sale: 15 (give or take 14)',
      'Rented or sold, not yet moved into: 20 (give or take 18)',
      'For seasonal or occasional use: 0 (give or take 17)',
      "Held off the market for other reasons, such as repairs, a family's legal trouble or abandonment: 195 (give or take 70)",
    ]);
  });

  it('says when a number has too little behind it, and shows nothing for a build without it', () => {
    const rows = describeContext(AREAS[1], summary);
    expect(rows[0]!.text).toBe(strings.displacement.rentNone);
    const bare = { id: '42101900300', w: 28 };
    expect(describeContext(bare, { ...summary, context: null })).toEqual([]);
    expect(describeArea(AREAS[0], summary).context).toHaveLength(3);
  });

  it('never frames a number as a reason to buy or invest', () => {
    const words = JSON.stringify([describeContext(AREAS[0], summary), strings.displacement.contextIntro([2020, 2024]), strings.displacement.contextNoisy]);
    expect(words).not.toMatch(/invest|bargain|cheap|afford|opportunit|deal|buy/i);
  });

  it('shows on the tapped area\'s card, with the note that small areas are rough', () => {
    const store = { registry: reg, state: defaultState(reg, 'analysis'), manifest, inspected: null } as unknown as AppStore;
    const html = render(FeatureDetails, { props: { store, target: { layerId: 'displacement_watch', features: [AREAS[0]], lngLat: [-75.16, 39.98] } } }).body;
    expect(html).toContain(strings.displacement.contextTitle);
    expect(html).toContain('data-context="rent"');
    expect(html).toContain('data-sign="rent_burden"');
    expect(html).toContain('so in a small area they are rough');
  });
});
