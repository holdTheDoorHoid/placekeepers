// Then and now (M4.3): the City's aerial photos by year and its 1860 atlas, loaded straight from
// the City's servers. The registry form for a picture service, where each year's tiles come from,
// the slider and the style, and the privacy rule: with live City data off these layers cannot be
// turned on, not even by a link, and nothing about them is asked of the City.

import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry, readRegistryFiles } from '../plugins/registry.ts';
import LayerItem from '../src/components/layers/LayerItem.svelte';
import OldAerialPhotos from '../src/components/dossier/OldAerialPhotos.svelte';
import { describeStatus, parseManifest, statusRows } from '../src/data/manifest.ts';
import { STYLE_IDS } from '../src/map/styles/ids.ts';
import { styleFor } from '../src/map/styles/index.ts';
import { chosenService, isOutsideLayer, rasterOpacity, rasterTiles, withoutOutsideLayers } from '../src/map/raster.ts';
import type { Layer } from '../src/registry/types.ts';
import { validateRegistry } from '../src/registry/validate.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import { LIVE_CITY_DATA } from '../src/state/options.ts';
import { AppStore } from '../src/state/store.svelte.ts';
import { decodeState, encodeState } from '../src/state/url.ts';
import { strings } from '../src/strings.ts';

const reg = loadRegistry();
const ROOT = 'https://tiles.arcgis.com/tiles/fLeGjb7u4uXqeF9q/arcgis/rest/services';
const photos = reg.layers.find((l) => l.id === 'aerial_photos')!;
const atlas = reg.layers.find((l) => l.id === 'atlas_1860')!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function raw(): any {
  return structuredClone(readRegistryFiles());
}

function errorsFor(files: ReturnType<typeof raw>): string[] {
  return validateRegistry(files, { styleIds: STYLE_IDS }).errors;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function find(list: any[], id: string): any {
  return list.find((x: { id: string }) => x.id === id);
}

function withYear(year: string): AppState {
  const state = defaultState(reg, 'analysis');
  state.settings.aerial_photos = { ...state.settings.aerial_photos, year };
  return state;
}

function store(live: boolean, hash = ''): AppStore {
  const decoded = decodeState(reg, hash, 'analysis');
  return new AppStore(reg, { state: decoded.state, viewPinned: true, from: 'link' }, { listStorage: null, options: { [LIVE_CITY_DATA]: live } });
}

describe('the registry form for pictures from another server', () => {
  it('holds the City\'s aerial photos of every year it serves, and its 1860 atlas', () => {
    const source = reg.sources.find((s) => s.id === 'city_aerial_photos')!;
    expect(source.endpoint.kind).toBe('arcgis_tiles');
    const years = source.endpoint.services!.map((s) => s.key);
    expect(years).toEqual(['1996', '2000', '2004', '2005', '2008', '2009', '2010', '2011', '2012', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2022', '2023', '2024', '2025']);
    expect(isOutsideLayer(photos) && isOutsideLayer(atlas)).toBe(true);
    // The validator gives a raster layer empty text for the file it does not have.
    expect([photos.file, photos.source_layer]).toEqual(['', '']);
    // Off by default in both views.
    for (const layer of [photos, atlas]) expect(layer.default).toEqual({ field: false, analysis: false });
    const year = photos.settings.find((s) => s.id === 'year')!;
    expect(year.type === 'choice' && year.control).toBe('slider');
  });

  it('refuses a raster layer with a file, and a map layer drawing a picture service', () => {
    const files = raw();
    Object.assign(find(files.layers, 'aerial_photos'), { file: 'tiles/x.pmtiles', source_layer: 'x' });
    find(files.layers, 'shootings_hex').sources.push('city_atlas_1860');
    delete find(files.layers, 'hin_2025').file;
    const errors = errorsFor(files);
    expect(errors).toContain('layers.yaml entry "aerial_photos" is a raster layer and cannot have "file" or "source_layer"');
    expect(errors).toContain('layers.yaml entry "shootings_hex" names the tile service "city_atlas_1860", which only a raster layer can draw');
    expect(errors).toContain('layers.yaml entry "hin_2025" needs "file" and "source_layer"');
  });

  it('needs the year options to be the services in order, and a slider only on a choice', () => {
    const files = raw();
    find(files.layers, 'aerial_photos').settings[0].options.reverse();
    find(files.layers, 'atlas_1860').settings[0].control = 'slider';
    const errors = errorsFor(files);
    expect(errors).toContain('layers.yaml entry "aerial_photos": the "year" options should be the source\'s service keys in the same order');
    expect(errors).toContain('layers.yaml entry "atlas_1860".settings[0] is a range and cannot have "control"');
  });

  it('checks a picture service\'s address, bounds and services', () => {
    const files = raw();
    const endpoint = find(files.sources, 'city_atlas_1860').endpoint;
    endpoint.url = 'http://example.org/arcgis';
    endpoint.bounds = [-75.1, 39.9, -75.2, 40.0];
    endpoint.services.push({ ...endpoint.services[0] });
    find(files.sources, 'shootings').endpoint.bounds = [0, 0, 1, 1];
    const errors = errorsFor(files);
    expect(errors).toContain('sources.yaml entry "city_atlas_1860".endpoint.url should be an https link ending in /rest/services');
    expect(errors).toContain('sources.yaml entry "city_atlas_1860".endpoint.bounds should be west, south, east, north in degrees, west below east and south below north');
    expect(errors).toContain('sources.yaml entry "city_atlas_1860".endpoint.services repeat a key');
    expect(errors).toContain('sources.yaml entry "shootings".endpoint of kind carto cannot have "bounds" or "services"');
    delete endpoint.services;
    expect(errorsFor(files)).toContain('sources.yaml entry "city_atlas_1860".endpoint of kind arcgis_tiles needs "services"');
  });
});

describe('where each year\'s pictures come from', () => {
  it('asks the City\'s own server for the chosen year, newest by default', () => {
    expect(rasterTiles(photos, reg, defaultState(reg, 'field'))).toEqual({
      sourceId: 'pk-raster:city_aerial_photos:2025',
      key: '2025',
      tiles: [`${ROOT}/CityImagery_2025_3in/MapServer/tile/{z}/{y}/{x}`],
      bounds: [-75.29, 39.86, -74.95, 40.14],
    });
    expect(rasterTiles(photos, reg, withYear('1996'))?.tiles).toEqual([`${ROOT}/CityImagery_1996_6in/MapServer/tile/{z}/{y}/{x}`]);
    expect(chosenService(photos, reg, withYear('2011'))?.service).toBe('CityImagery_2011_6in_LEAFOFF');
    // A year the City does not serve falls back to the default.
    expect(chosenService(photos, reg, withYear('2013'))?.key).toBe('2025');
  });

  it('asks for the atlas only where it has pictures', () => {
    const tiles = rasterTiles(atlas, reg, defaultState(reg, 'field'))!;
    expect(tiles.tiles).toEqual([`${ROOT}/HistoricHexamerLocherAtlas_1860/MapServer/tile/{z}/{y}/{x}`]);
    expect(tiles.bounds).toEqual([-75.1904, 39.9266, -75.1245, 39.9771]);
  });

  it('turns the strength setting into an opacity', () => {
    const state = defaultState(reg, 'field');
    expect(rasterOpacity(photos, state)).toBe(1);
    expect(rasterOpacity(atlas, state)).toBe(0.8);
    state.settings.aerial_photos!.opacity = 30;
    expect(rasterOpacity(photos, state)).toBeCloseTo(0.3);
  });
});

describe('the style', () => {
  const draw = (layer: Layer, state: AppState) => styleFor(layer)!.layers({ layer, registry: reg, state, sourceId: 'unused', sourceLayer: null });

  it('draws one valid raster layer from the chosen year\'s source', () => {
    for (const [layer, state] of [
      [photos, withYear('2004')],
      [atlas, defaultState(reg, 'analysis')],
    ] as const) {
      const specs = draw(layer, state);
      const tiles = rasterTiles(layer, reg, state)!;
      expect(specs).toHaveLength(1);
      const spec = specs[0] as { source: string; type: string };
      expect([spec.type, spec.source]).toEqual(['raster', tiles.sourceId]);
      const style = { version: 8, sources: { [tiles.sourceId]: { type: 'raster', tiles: tiles.tiles, tileSize: 256, bounds: tiles.bounds } }, layers: specs };
      expect(validateStyleMin(style as never).map((e) => e.message)).toEqual([]);
    }
  });

  it('says which year it shows and credits the makers', () => {
    const legend = (layer: Layer, state: AppState) => styleFor(layer)!.legend({ layer, registry: reg, state }).map((e) => (e.kind === 'note' ? e.text : ''));
    expect(legend(photos, withYear('1996'))).toEqual([strings.historic.photoYear('1996'), strings.historic.blackAndWhite, strings.historic.under, strings.historic.photoCredit]);
    expect(legend(photos, withYear('2020'))).not.toContain(strings.historic.blackAndWhite);
    expect(legend(atlas, defaultState(reg, 'field'))).toEqual([strings.historic.atlasCoverage, strings.historic.atlasCredit]);
  });
});

describe('privacy: these layers follow "Fetch live City data"', () => {
  it('cannot be turned on by a link while live data is off', () => {
    const hash = 'v=a&m=17/39.99192/-75.14204&l=vacant_parcels,aerial_photos,atlas_1860&s=aerial_photos.year:1996';
    const off = store(false, hash);
    expect(off.state.layers).toEqual(['vacant_parcels', 'basemap']);
    expect(encodeState(reg, off.state)).not.toContain('aerial_photos,');
    // With live data on, the same link shows the 1996 photos.
    const on = store(true, hash);
    expect(on.state.layers).toEqual(expect.arrayContaining(['aerial_photos', 'atlas_1860']));
    expect(chosenService(photos, reg, on.state)?.key).toBe('1996');
  });

  it('cannot be switched on while live data is off, and goes off when live data does', () => {
    const off = store(false);
    off.setLayerVisible('aerial_photos', true);
    off.setLayersVisible(['atlas_1860', 'hin_2025'], true);
    expect(off.state.layers).toContain('hin_2025');
    expect(off.state.layers).not.toContain('aerial_photos');
    expect(off.state.layers).not.toContain('atlas_1860');
    expect(off.layerBlocked('aerial_photos')).toBe(true);
    expect(off.layerBlocked('hin_2025')).toBe(false);

    const on = store(true);
    on.setLayerVisible('aerial_photos', true);
    expect(on.state.layers).toContain('aerial_photos');
    on.setOption(LIVE_CITY_DATA, false);
    expect(on.state.layers).not.toContain('aerial_photos');
    // A link pasted into the open tab is held to the same rule.
    on.replace(decodeState(reg, 'v=a&l=atlas_1860', 'analysis').state, true);
    expect(on.state.layers).toEqual(['basemap']);
    expect(withoutOutsideLayers(reg, ['hin_2025', 'aerial_photos'])).toEqual(['hin_2025']);
  });

  it('shows the switch turned off, with the reason and a way to turn live data on', () => {
    const { body } = render(LayerItem, { props: { store: store(false), layer: photos, idPrefix: 't' } });
    expect(body).toMatch(/<input[^>]*id="t-layer-aerial_photos"[^>]*disabled/);
    expect(body).toContain('aria-describedby="t-layer-aerial_photos-why"');
    expect(body).toContain(strings.historic.liveOff);
    expect(body).toContain(strings.options.turnOn);
    const live = render(LayerItem, { props: { store: store(true), layer: photos, idPrefix: 't' } }).body;
    expect(live).not.toMatch(/<input[^>]*id="t-layer-aerial_photos"[^>]*disabled/);
  });

  it('shows the year as a slider through the years the City has, read out by year', () => {
    const on = store(true, 'v=a&l=aerial_photos&s=aerial_photos.year:2004');
    const { body } = render(LayerItem, { props: { store: on, layer: photos, idPrefix: 't' } });
    expect(body).toMatch(/type="range"[^>]*min="0"[^>]*max="19"/);
    expect(body).toContain('aria-valuetext="2004"');
    expect(body).toContain(strings.historic.sliderRange('1996', '2025'));
  });
});

describe('the lot page: "See this lot in old aerial photos"', () => {
  it('opens the map at the lot with the 1996 photos', () => {
    const calls: unknown[] = [];
    const { body } = render(OldAerialPhotos, {
      props: { liveOn: true, onShowLayer: (id: string, settings?: unknown) => calls.push([id, settings]), onShowOnMap: () => calls.push('map') },
    });
    expect(body).toContain(strings.historic.lotButton);
    expect(body).toContain(strings.historic.lotHelp);
    expect(body).not.toContain('disabled');
  });

  it('is turned off with the reason while live data is off', () => {
    const { body } = render(OldAerialPhotos, { props: { liveOn: false, onShowLayer: () => {}, onTurnOnLive: () => {} } });
    expect(body).toMatch(/<button[^>]*disabled[^>]*>See this lot in old aerial photos/);
    expect(body).toContain(strings.historic.lotLiveOff);
    expect(body).toContain(strings.options.turnOn);
  });
});

describe('the Data status page', () => {
  const manifest = (status: string, extra: Record<string, unknown> = {}) =>
    parseManifest({
      schema: 1,
      build_id: 'b',
      sources: {
        city_aerial_photos: {
          status,
          last_attempt: '2026-10-12T10:00:00Z',
          last_success: '2026-10-05T10:00:00Z',
          stale_since: status === 'stale' ? '2026-10-05' : null,
          rows: 20,
          newest_record: null,
          message: status === 'stale' ? 'Not every picture service answered: 2023 (CityImagery_2023): It did not answer' : null,
          ...extra,
        },
      },
      layers: { aerial_photos: { file: null, source_layer: null, sources: ['city_aerial_photos'] } },
      files: {},
    });

  it('reads a layer with no file without a problem', () => {
    const parsed = manifest('ok');
    expect(parsed.problems).toEqual([]);
    expect(parsed.manifest?.layers.aerial_photos).toBeUndefined();
  });

  it('says whether every picture service answered, not which copy is in use', () => {
    const row = (status: string) => statusRows(reg, manifest(status).manifest).find((r) => r.id === 'city_aerial_photos')!;
    const ok = describeStatus(row('ok'));
    expect(ok.summary).toBe(strings.historic.statusOk);
    expect(ok.details).toContain(strings.historic.services(20));
    const stale = describeStatus(row('stale'));
    expect(stale.label).toBe(strings.status.statusLabel.stale);
    expect(stale.summary).toBe(strings.historic.statusStale('October 5, 2026'));
    expect(stale.details.join(' ')).toContain('2023 (CityImagery_2023)');
    expect(stale.summary).not.toContain('copy');
  });
});
