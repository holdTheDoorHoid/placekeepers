// Amenities and conditions (M3.5): what a tapped amenity, public place or 311 block says, how the
// three styles draw them, and the defaults per view.

import { render } from 'svelte/server';
import type { FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { describeAmenity, describeCondition, describePlace } from '../src/amenities/describe.ts';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import { STYLES, styleFor } from '../src/map/styles/index.ts';
import { AMENITY_COLORS, CONDITION_COLORS, PLACE_COLORS } from '../src/map/styles/palette.ts';
import type { StyleContext } from '../src/map/styles/types.ts';
import { defaultLayers, defaultState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { strings } from '../src/strings.ts';

const reg = loadRegistry();
const layer = (id: string) => reg.layers.find((l) => l.id === id)!;
const OSM = ['benches', 'picnic_tables', 'drinking_water', 'toilets', 'bookcases'];
const PLACES = ['park_water', 'libraries', 'recreation_centers', 'pools'];
const CONDITIONS = ['dumping', 'dark_lights', 'graffiti'];

function ctx(id: string, settings: Record<string, string> = {}): StyleContext {
  const state = defaultState(reg, 'analysis');
  state.settings[id] = { ...state.settings[id], ...settings };
  return { layer: layer(id), registry: reg, state, sourceId: `src-${id}`, sourceLayer: layer(id).source_layer };
}

function part(specs: LayerSpecification[], name: string): LayerSpecification {
  return specs.find((s) => s.id.endsWith(`:${name}`))!;
}

describe('an amenity from OpenStreetMap', () => {
  const t = strings.amenities;

  it('lists what the map says and leaves unknown unsaid, never "no"', () => {
    const view = describeAmenity('toilets', { id: 'n6', ac: 2, fee: 0, wc: 2, ct: 1, oh: 'Mo-Fr 08:00-17:00', nm: 'Station toilets' });
    expect(view.title).toBe('Public toilet');
    expect(view.name).toBe('Station toilets');
    expect(view.facts).toEqual(['For customers only', 'Free', 'Has a changing table', 'Limited wheelchair access', 'Opening hours as mapped: Mo-Fr 08:00-17:00']);
    expect(view.osmUrl).toBe('https://www.openstreetmap.org/node/6');
    expect(describeAmenity('benches', { id: 'w3' }).facts).toEqual([]);
    expect(describeAmenity('benches', { id: 'n1', br: 0, cv: 1 }).facts).toEqual(['No backrest', 'Under a roof']);
    expect(describeAmenity('drinking_water', { id: 'n5', bt: 1, sn: 1, in: 1 }).facts).toEqual([t.facts.bt![0], t.facts.sn![0], t.facts.in![0]]);
  });
});

describe('a public place from the City', () => {
  const t = strings.places;

  it('gives a library its address, phone and only its Free Library page', () => {
    const view = describePlace('libraries', { id: 'lib1', nm: 'Andorra Library', ad: '705 East Cathedral Road', zip: '19128', ph: '215-685-2552', url: 'https://libwww.freelibrary.org/locations/andorra-library' });
    expect(view.title).toBe('Andorra Library');
    expect(view.facts).toEqual(['705 East Cathedral Road, Philadelphia, PA 19128', 'Phone: 215-685-2552']);
    expect(view.link).toEqual({ href: 'https://libwww.freelibrary.org/locations/andorra-library', label: t.libraryPage });
    expect(describePlace('libraries', { nm: 'X', url: 'https://example.com/x' }).link).toBeNull();
  });

  it('says whether a pool is in service, and when it opened only if it is', () => {
    const open = describePlace('pools', { id: 'pool1', nm: 'Fox Chase Pool', k: 1, st: 1, in: 0, ada: 1, ad: '7901 RIDGEWAY ST', op: '2026-06-24' });
    expect(open.kind).toBe('Pool');
    expect(open.facts).toEqual(['7901 Ridgeway St', t.status[1], 'Outdoors', t.opened('June 24, 2026'), t.accessible[1]]);
    const closed = describePlace('pools', { id: 'spray2', nm: 'Sample Square', k: 3, st: 0, op: '2026-06-24' });
    expect(closed.kind).toBe('Sprinkler');
    expect(closed.facts).toEqual([t.status[0]]);
    expect(describePlace('pools', { nm: 'Unsure', k: 2 }).facts).toEqual([t.statusUnknown]);
  });

  it('names a recreation center, its gym and a park fountain inside a building', () => {
    expect(describePlace('recreation_centers', { nm: 'Lawncrest Recreation Center', k: 1, bd: 1, gym: 1 }).facts).toEqual([t.gym]);
    expect(describePlace('recreation_centers', { nm: 'Sample', k: 2 }).kind).toBe('Older adult center');
    const water = describePlace('park_water', { nm: 'Lawncrest Recreation Center', k: 2, in: 1, pk: 'Lawncrest Park' });
    expect(water.kind).toBe('Bottle filling station');
    expect(water.facts).toEqual([t.inPark('Lawncrest Park'), t.waterIndoor]);
    expect(water.source).toBe(t.source.parks);
  });
});

describe('a block with conditions reported to 311', () => {
  const t = strings.conditions;

  it('counts requests and open ones, by block, with nothing about who reported', () => {
    const view = describeCondition('dark_lights', { id: 9011, name: 'N BROAD ST', n: 2, o: 2, d: '2026-09-30', a: 1 });
    expect(view.title).toBe(t.titles.dark_lights);
    expect(view.place).toBe('On this block of N Broad St.');
    expect(view.summary).toBe('2 requests to Philly311 in the last 90 days, 2 still open.');
    expect(view.facts).toEqual(['The newest was made on September 30, 2026.', '1 of them about an alley light.']);
    expect(describeCondition('dumping', { n: 1, o: 0 }).summary).toBe('1 request to Philly311 in the last 90 days, none still open.');
  });
});

describe('the amenity, place and condition styles', () => {
  it('draw every new layer, each in its own color', () => {
    for (const id of OSM) expect(styleFor(layer(id))).toBe(STYLES.amenity);
    for (const id of PLACES) expect(styleFor(layer(id))).toBe(STYLES.public_place);
    for (const id of CONDITIONS) expect(styleFor(layer(id))).toBe(STYLES.condition);
    expect(new Set(OSM.map((id) => AMENITY_COLORS[id])).size).toBe(OSM.length);
    expect(Object.keys(CONDITION_COLORS).sort()).toEqual([...CONDITIONS].sort());
    expect(PLACE_COLORS.park_water).toBe(AMENITY_COLORS.drinking_water);
  });

  it('say that only mapped amenities appear and link the guide on adding more', () => {
    const legend = STYLES.amenity.legend(ctx('toilets'));
    expect(legend[0]).toMatchObject({ kind: 'circle', label: strings.amenities.legend.toilets, fill: AMENITY_COLORS.toilets });
    expect(legend[1]).toEqual({ kind: 'note', text: strings.amenities.mappedNote, link: { page: 'streetcomplete', label: strings.amenities.addMissing } });
  });

  it('show pools in service, or all of them with the rest as hollow rings', () => {
    const shown = STYLES.public_place.layers(ctx('pools'));
    expect(part(shown, 'ring')).toMatchObject({ filter: ['==', ['literal', 1], 0] });
    const all = STYLES.public_place.layers(ctx('pools', { show: 'all' }));
    expect((part(all, 'ring') as { filter: FilterSpecification }).filter).toEqual(['!', ['==', ['to-number', ['get', 'st'], -1], 1]]);
    expect(STYLES.public_place.legend(ctx('pools', { show: 'all' })).some((e) => e.kind === 'circle' && e.label === strings.places.notInService)).toBe(true);
    // Every place layer can be clicked on both parts, and only pools ever draw the ring.
    expect(part(STYLES.public_place.layers(ctx('libraries')), 'ring')).toMatchObject({ filter: ['==', ['literal', 1], 0] });
  });

  it('fill blocks with an open request, ring the closed ones, or show only the open ones', () => {
    const every = STYLES.condition.layers(ctx('dumping'));
    expect((part(every, 'closed') as { filter: FilterSpecification }).filter).toEqual(['!', ['>', ['to-number', ['get', 'o'], 0], 0]]);
    const open = STYLES.condition.layers(ctx('dumping', { show: 'open' }));
    expect(part(open, 'closed')).toMatchObject({ filter: ['==', ['literal', 1], 0] });
    expect(STYLES.condition.legend(ctx('dumping', { show: 'open' })).filter((e) => e.kind === 'circle')).toHaveLength(1);
  });
});

describe('defaults', () => {
  it('turn on drinking water and toilets for a neighbor on foot, and nothing new in the analysis view', () => {
    const field = defaultLayers(reg, 'field');
    for (const id of ['drinking_water', 'toilets', 'park_water']) expect(field).toContain(id);
    for (const id of ['benches', 'picnic_tables', 'bookcases', 'libraries', 'recreation_centers', 'pools', ...CONDITIONS]) expect(field).not.toContain(id);
    const analysis = defaultLayers(reg, 'analysis');
    for (const id of [...OSM, ...PLACES, ...CONDITIONS]) expect(analysis).not.toContain(id);
  });
});

describe('the details panel', () => {
  const store = { registry: reg, state: defaultState(reg, 'field'), inspected: null } as unknown as AppStore;
  const details = (layerId: string, properties: Record<string, unknown>) =>
    render(FeatureDetails, { props: { store, target: { layerId, features: [properties], lngLat: [-75.16, 39.98] } } }).body;

  it('shows an amenity with its OpenStreetMap link and the guide', () => {
    const html = details('toilets', { id: 'n9100031', ac: 1, fee: 0, nm: 'Sample Park toilets' });
    expect(html).toContain('Sample Park toilets');
    expect(html).toContain('Open to anyone');
    expect(html).toContain('href="https://www.openstreetmap.org/node/9100031"');
    expect(html).toContain(`href="${import.meta.env.BASE_URL}streetcomplete/"`);
    expect(html).toContain(strings.amenities.source);
  });

  it('shows a 311 block with the way to report it, never the police', () => {
    const html = details('dumping', { id: 9001, name: 'SAMPLE 1 ST', n: 3, o: 1, d: '2026-10-01' });
    expect(html).toContain('3 requests to Philly311 in the last 90 days, 1 still open.');
    expect(html).toContain(strings.conditions.byBlock);
    expect(html).toContain(strings.conditions.report);
    expect(html).toContain('phila.gov');
    expect(html.toLowerCase()).not.toContain('police');
  });

  it('shows a public place with its source', () => {
    const html = details('libraries', { id: 'lib1', nm: 'Sample Library', ad: '1 Sample Street', zip: '19133' });
    expect(html).toContain('Sample Library');
    expect(html).toContain(strings.places.source.libraries);
  });
});
