import { featureFilter, validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { LABEL_FONT, LOOKS } from '../src/map/styles/boundary.ts';
import { GARDEN_COLOR } from '../src/map/styles/gardens.ts';
import { styleFor } from '../src/map/styles/index.ts';
import { LANDCARE_FILL, LANDCARE_LINE } from '../src/map/styles/landcare.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import { strings } from '../src/strings.ts';

const reg = loadRegistry();
const layerOf = (id: string) => reg.layers.find((l) => l.id === id)!;

function parts(id: string, state: AppState, glyphs: boolean): LayerSpecification[] {
  const layer = layerOf(id);
  return styleFor(layer)!.layers({ layer, registry: reg, state, sourceId: 'tiles', sourceLayer: layer.source_layer, glyphs });
}

/** Validates layers in a style that has label fonts, as the self hosted base map does. */
function validateWithFonts(layers: LayerSpecification[]): string[] {
  const style = {
    version: 8,
    glyphs: 'https://example.test/data/basemap/fonts/{fontstack}/{range}.pbf',
    sources: { tiles: { type: 'vector', url: 'pmtiles://https://example.test/data/tiles/boundaries.pmtiles' } },
    layers,
  };
  return validateStyleMin(style as never).map((e) => e.message);
}

function rgb(color: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];
}

describe('care and boundary styles', () => {
  it('cover the layers that name them', () => {
    expect(layerOf('landcare_lots').style).toBe('landcare');
    expect(layerOf('gardens').style).toBe('gardens');
    for (const id of ['council_districts', 'community_organizations', 'neighborhoods']) expect(layerOf(id).style).toBe('boundary');
  });

  it('use calm colors with no alarm reds', () => {
    const colors = [LANDCARE_LINE, LANDCARE_FILL, GARDEN_COLOR, ...Object.values(LOOKS).map((look) => look.color)];
    for (const color of colors) {
      const [r, g, b] = rgb(color);
      expect(r > 180 && g < 90 && b < 90, color).toBe(false);
    }
  });

  it('draw LandCare lots as a green outline over a faint wash, and gardens as a dot', () => {
    const state = defaultState(reg, 'analysis');
    const care = parts('landcare_lots', state, false);
    expect(care.map((l) => l.type)).toEqual(['fill', 'line']);
    expect((care[1] as { paint: Record<string, unknown> }).paint['line-color']).toBe(LANDCARE_LINE);
    const garden = parts('gardens', state, false);
    expect(garden.map((l) => l.type)).toEqual(['circle']);
    expect(validateWithFonts([...care, ...garden])).toEqual([]);
  });

  it('give each boundary layer its own line weight, with community organizations dashed', () => {
    const state = defaultState(reg, 'analysis');
    const line = (id: string) => parts(id, state, false).find((l) => l.id.endsWith(':line')) as { paint: Record<string, unknown> };
    expect(line('community_organizations').paint['line-dasharray']).toEqual([3, 2]);
    expect(line('neighborhoods').paint['line-dasharray']).toBeUndefined();
    expect(LOOKS.council_districts!.width[1]).toBeGreaterThan(LOOKS.neighborhoods!.width[1]);
  });

  it('name boundaries only when the setting is on and the base map has fonts', () => {
    const state = defaultState(reg, 'analysis');
    const named = (id: string, glyphs: boolean) => parts(id, state, glyphs).some((l) => l.type === 'symbol');
    // Defaults from the registry: names on for districts and neighborhoods, off for the
    // overlapping community organization areas.
    expect(named('council_districts', true)).toBe(true);
    expect(named('neighborhoods', true)).toBe(true);
    expect(named('community_organizations', true)).toBe(false);
    // Without fonts no text layer may be added, whatever the setting says.
    expect(named('council_districts', false)).toBe(false);
    state.settings.council_districts = { names: false };
    state.settings.community_organizations = { names: true };
    expect(named('council_districts', true)).toBe(false);
    expect(named('community_organizations', true)).toBe(true);
  });

  it('make valid label layers that read the name property in a base map font', () => {
    const state = defaultState(reg, 'analysis');
    for (const id of ['council_districts', 'neighborhoods']) {
      const all = parts(id, state, true);
      expect(validateWithFonts(all), id).toEqual([]);
      const label = all.find((l) => l.type === 'symbol') as { layout: Record<string, unknown>; minzoom: number };
      expect(label.layout['text-font']).toEqual(LABEL_FONT);
      expect(label.layout['text-field']).toEqual(['to-string', ['get', 'nm']]);
      expect(label.minzoom).toBe(LOOKS[layerOf(id).source_layer]!.labelMinZoom);
    }
  });

  it('draw every boundary feature, with no filter', () => {
    const state = defaultState(reg, 'analysis');
    const line = parts('neighborhoods', state, false)[0] as { filter?: unknown };
    expect(line.filter).toBeUndefined();
    const filter = featureFilter(undefined);
    expect(filter.filter({ zoom: 12 } as never, { type: 3, properties: { nm: 'Sample West' } } as never)).toBe(true);
  });

  it('explain themselves in the legend', () => {
    const state = defaultState(reg, 'analysis');
    const legend = (id: string) => styleFor(layerOf(id))!.legend({ layer: layerOf(id), registry: reg, state });
    expect(legend('landcare_lots')).toEqual([expect.objectContaining({ kind: 'swatch', label: strings.legend.landcare })]);
    expect(legend('gardens')).toEqual([expect.objectContaining({ kind: 'swatch', label: strings.legend.garden })]);
    expect(legend('council_districts')).toEqual([expect.objectContaining({ kind: 'line', label: layerOf('council_districts').label })]);
    expect(legend('community_organizations')).toEqual([expect.objectContaining({ kind: 'swatch', dashed: true })]);
  });
});
