// The 1937 redlining map (owner, 2026-10-09): Mapping Inequality's areas and grades under CC BY-NC
// 2.5. Off by default, credited with title, link and license notice, a visible non commercial note,
// a plain context card that links out for the 1937 descriptions, its own file named with its license
// in the manifest, and never in a download.

import { readFileSync } from 'node:fs';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRegistry, readRegistryFiles } from '../plugins/registry.ts';
import RedliningDetails from '../src/components/history/RedliningDetails.svelte';
import { parseManifest } from '../src/data/manifest.ts';
import { clearShardCache } from '../src/dossier/shard.ts';
import { STYLE_IDS } from '../src/map/styles/ids.ts';
import { styleFor } from '../src/map/styles/index.ts';
import { gatherExport, toCsv, toGeoJson, type ExportPlace } from '../src/places/export.ts';
import { validateRegistry } from '../src/registry/validate.ts';
import { defaultState } from '../src/state/defaults.ts';
import { decodeState } from '../src/state/url.ts';
import { strings } from '../src/strings.ts';

const reg = loadRegistry();
const layer = reg.layers.find((l) => l.id === 'redlining_1937')!;
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const FIXTURE = JSON.parse(read('../fixtures/data/tiles/redlining.holc.geojson'));
const MANIFEST = parseManifest(JSON.parse(read('../fixtures/data/manifest.json')));
const r = strings.redlining;

afterEach(() => clearShardCache());

describe('the registry', () => {
  it('holds the map under its own non commercial license, off by default, in the Then and now group', () => {
    const source = reg.sources.find((s) => s.id === 'mapping_inequality_1937')!;
    const license = reg.licenses.find((l) => l.id === source.license)!;
    expect(license.non_commercial).toBe(true);
    expect(license.url).toBe(r.licenseUrl);
    expect(layer.default).toEqual({ field: false, analysis: false });
    expect([layer.group, layer.file, layer.source_layer]).toEqual(['then_and_now', 'tiles/redlining.pmtiles', 'holc']);
    // The only source under such a license.
    expect(reg.sources.filter((s) => reg.licenses.find((l) => l.id === s.license)?.non_commercial).map((s) => s.id)).toEqual(['mapping_inequality_1937']);
  });

  it('keeps a layer under a non commercial license alone, sources and file', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const files: any = structuredClone(readRegistryFiles());
    const find = (id: string) => files.layers.find((l: { id: string }) => l.id === id);
    find('redlining_1937').sources.push('census_tracts_2020');
    find('hin_2025').file = 'tiles/redlining.pmtiles';
    const errors = validateRegistry(files, { styleIds: STYLE_IDS }).errors;
    expect(errors).toContain('layers.yaml entry "redlining_1937" draws a source under a non commercial license and can draw no other kind');
    expect(errors).toContain('layers.yaml entry "redlining_1937" is under a non commercial license, so no other layer may share its file (hin_2025)');
  });

  it('is published as its own file, named with its license in the manifest', () => {
    expect(MANIFEST.problems).toEqual([]);
    const files = MANIFEST.manifest!.files;
    expect(Object.keys(files).filter((name) => name.includes('redlining'))).toEqual(['tiles/redlining.holc.geojson']);
    const raw = JSON.parse(read('../fixtures/data/manifest.json'));
    expect(raw.files['tiles/redlining.holc.geojson'].license).toBe('cc_by_nc_2_5');
    expect(Object.entries(raw.files).filter(([, entry]) => (entry as { license?: string }).license).map(([name]) => name)).toEqual(['tiles/redlining.holc.geojson']);
  });
});

describe('the style', () => {
  const state = defaultState(reg, 'analysis');
  const draw = (s = state, glyphs = true) => styleFor(layer)!.layers({ layer, registry: reg, state: s, sourceId: 'json', sourceLayer: null, glyphs });

  it('draws valid layers, with each area\'s letter on it', () => {
    const specs = draw();
    expect(specs.map((s) => s.id)).toEqual(['pk:redlining_1937:fill', 'pk:redlining_1937:shade', 'pk:redlining_1937:line', 'pk:redlining_1937:label']);
    const style = {
      version: 8,
      glyphs: 'https://example.test/data/basemap/fonts/{fontstack}/{range}.pbf',
      sources: { json: { type: 'geojson', data: FIXTURE } },
      layers: specs,
    };
    expect(validateStyleMin(style as never).map((e) => e.message)).toEqual([]);
    // Shading off keeps the outlines and letters, and a fill that still answers taps.
    const off = decodeState(reg, 'l=redlining_1937&s=redlining_1937.shade:0', 'analysis').state;
    const plain = draw(off);
    expect(plain.map((s) => s.id)).toEqual(['pk:redlining_1937:fill', 'pk:redlining_1937:line', 'pk:redlining_1937:label']);
    expect((plain[0] as { paint: Record<string, unknown> }).paint['fill-opacity']).toBe(0);
  });

  it('has a plain legend: the four grades, the context, the credit with its link, and the non commercial note', () => {
    const legend = styleFor(layer)!.legend({ layer, registry: reg, state });
    const labels = legend.map((e) => ('label' in e ? e.label : 'text' in e ? e.text : ''));
    expect(labels.slice(0, 5)).toEqual([r.grades.A, r.grades.B, r.grades.C, r.grades.D, r.ungraded]);
    expect(labels).toEqual(expect.arrayContaining([r.context, r.notToday, r.credit, r.nonCommercial]));
    const links = legend.flatMap((e) => (e.kind === 'note' && e.link ? [e.link.href] : []));
    expect(links).toEqual([r.homepage, r.licenseUrl]);
  });
});

describe('the card for a tapped area', () => {
  it('gives the grade, the context and a link out to the 1937 description, never its text', () => {
    const { body } = render(RedliningDetails, { props: { features: [{ l: 'D1', g: 'D' }] } });
    expect(body).toContain(r.area('D1', 'D'));
    expect(body).toContain('href="https://dsl.richmond.edu/panorama/redlining/map/PA/Philadelphia/area_descriptions/D1"');
    expect(body).toContain(r.notToday);
    expect(body).toContain('practice is called redlining');
    expect(body).toContain(r.licenseLabel);
    expect(body).toContain('Non commercial use only');
    const ungraded = render(RedliningDetails, { props: { features: [{ l: 'Industrial and Commercial' }] } }).body;
    expect(ungraded).toContain(r.areaUngraded('Industrial and Commercial'));
    expect(ungraded).not.toContain('area_descriptions/');
  });
});

describe('downloads never carry its data', () => {
  it('leaves the redlining areas out of every CSV and GeoJSON download, with the layer on', async () => {
    const tiles = JSON.parse(read('../fixtures/sources/parcels.geojson')).features as { properties: Record<string, unknown> }[];
    const DATA = 'https://example.org/placekeepers/data/';
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const path = String(url).replace(DATA, '');
      try {
        return new Response(read(`../fixtures/data/${path}`), { status: 200 });
      } catch {
        return new Response('', { status: 404 });
      }
    }) as unknown as typeof fetch;
    const places: ExportPlace[] = tiles.slice(0, 8).map((t) => ({ id: String(t.properties.id), center: [-75.155, 39.985], properties: t.properties }));
    const state = decodeState(reg, 'v=a&l=vacant_parcels,redlining_1937', 'analysis').state;
    const result = await gatherExport({
      places,
      registry: reg,
      state,
      manifest: MANIFEST.manifest,
      dataBase: DATA,
      siteUrl: 'https://example.org/placekeepers/',
      title: 'Places in view',
      now: new Date('2026-10-04T16:00:00Z'),
      fetchImpl,
    });
    expect(result.rows.length).toBe(8);
    for (const text of [toCsv(result), toGeoJson(result)]) {
      for (const mark of ['redlining', 'holc', 'HOLC', 'Mapping Inequality', 'graded', 'Industrial and Commercial']) expect(text).not.toContain(mark);
    }
    // Nothing a download asks for is the redlining file.
    const asked = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]));
    expect(asked.some((url) => url.includes('redlining'))).toBe(false);
  });
});
