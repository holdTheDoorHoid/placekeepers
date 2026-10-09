import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import {
  baseMapSources,
  dataKind,
  describeStatus,
  freshness,
  geojsonFallbackPath,
  isSampleData,
  loadBaseMapInfo,
  loadManifest,
  parseManifest,
  resolveDataBase,
  resolveLayerData,
  statusRows,
  statusSummary,
  type Manifest,
} from '../src/data/manifest.ts';

const reg = loadRegistry();
const FIXTURE_ROOT = new URL('../fixtures/data/', import.meta.url);
const fixtureJson = JSON.parse(readFileSync(new URL('manifest.json', FIXTURE_ROOT), 'utf8'));
const layer = (id: string) => reg.layers.find((l) => l.id === id)!;

function manifestWith(overrides: Record<string, unknown> = {}): Manifest {
  const parsed = parseManifest({
    schema: 1,
    build_id: '2026-10-05T10-00-00Z-1a2b3c4',
    generated_at: '2026-10-05T10:03:12Z',
    sources: Object.fromEntries(
      reg.sources.map((s) => [
        s.id,
        {
          status: 'ok',
          last_attempt: '2026-10-05T10:00:05Z',
          last_success: '2026-10-05T10:00:05Z',
          stale_since: null,
          rows: 100,
          newest_record: '2026-10-01',
          message: null,
        },
      ]),
    ),
    layers: { shootings_hex: { file: 'tiles/context.pmtiles', source_layer: 'h3', sources: ['shootings'] } },
    files: { 'tiles/context.pmtiles': { bytes: 1234567, sha256: 'abc' } },
    ...overrides,
  });
  if (!parsed.manifest) throw new Error(parsed.error ?? 'no manifest');
  return parsed.manifest;
}

describe('parsing manifest.json', () => {
  it('reads the example from CONTRACTS.md', () => {
    const { manifest, problems, error } = parseManifest({
      schema: 1,
      build_id: '2026-10-05T10-00-00Z-1a2b3c4',
      generated_at: '2026-10-05T10:03:12Z',
      sources: {
        shootings: {
          status: 'ok',
          last_attempt: '2026-10-05T10:00:05Z',
          last_success: '2026-10-05T10:00:05Z',
          stale_since: null,
          rows: 17973,
          newest_record: '2026-10-01',
          message: null,
        },
      },
      layers: { shootings_hex: { file: 'tiles/context.pmtiles', source_layer: 'h3', sources: ['shootings'] } },
      files: { 'tiles/context.pmtiles': { bytes: 1234567, sha256: '...' } },
    });
    expect(error).toBeNull();
    expect(problems).toEqual([]);
    expect(manifest?.sources.shootings?.rows).toBe(17973);
    expect(manifest?.layers.shootings_hex).toEqual({ file: 'tiles/context.pmtiles', source_layer: 'h3', sources: ['shootings'] });
  });

  it('reads the committed fixture without problems', () => {
    const { manifest, problems, error } = parseManifest(fixtureJson);
    expect(error).toBeNull();
    expect(problems).toEqual([]);
    expect(isSampleData(manifest)).toBe(true);
    expect(manifest?.notes.length).toBeGreaterThan(0);
  });

  it('reads the notes list, and tolerates it empty or missing', () => {
    expect(parseManifest({ schema: 1, build_id: 'b', notes: ['8 shooting victims have no usable location'] }).manifest?.notes).toEqual([
      '8 shooting victims have no usable location',
    ]);
    expect(parseManifest({ schema: 1, build_id: 'b', notes: [] }).manifest?.notes).toEqual([]);
    const missing = parseManifest({ schema: 1, build_id: 'b' });
    expect(missing.manifest?.notes).toEqual([]);
    expect(missing.problems).toEqual([]);
    const odd = parseManifest({ schema: 1, build_id: 'b', notes: ['ok', 7, ''] });
    expect(odd.manifest?.notes).toEqual(['ok']);
    expect(odd.problems.length).toBe(2);
    expect(parseManifest({ schema: 1, build_id: 'b', notes: 'one' }).problems).toEqual(['notes should be a list']);
  });

  it('refuses a schema it cannot read, or something that is not an object', () => {
    expect(parseManifest({ schema: 2 }).error).toMatch(/schema 2/);
    expect(parseManifest([]).error).toMatch(/not a JSON object/);
    expect(parseManifest(null).manifest).toBeNull();
  });

  it('notes problems but keeps going', () => {
    const { manifest, problems } = parseManifest({
      schema: 1,
      build_id: 'b',
      future_key: { anything: true },
      sources: {
        a: { status: 'exploded', rows: 'many' },
        b: 'nope',
        c: { status: 'stale', stale_since: '2026-09-27', rows: 5 },
      },
      layers: { x: { file: '/etc/passwd' }, y: { file: 'tiles/../../up.pmtiles' }, z: { file: 'tiles/lots.pmtiles' } },
      files: [],
    });
    expect(manifest?.sources.a?.status).toBe('unknown');
    expect(manifest?.sources.a?.rows).toBeNull();
    expect(manifest?.sources.b).toBeUndefined();
    expect(manifest?.sources.c?.status).toBe('stale');
    expect(Object.keys(manifest?.layers ?? {})).toEqual(['z']);
    expect(problems.length).toBeGreaterThanOrEqual(5);
  });

  it('loads over the network and reports failures in words, never throwing', async () => {
    const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
    expect((await loadManifest('https://example.test/data/', ok(fixtureJson))).manifest).not.toBeNull();
    const notFound = (async () => new Response('missing', { status: 404 })) as typeof fetch;
    expect((await loadManifest('https://example.test/data/', notFound)).error).toBe('manifest.json answered 404');
    const offline = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    expect((await loadManifest('https://example.test/data/', offline)).error).toMatch(/could not be downloaded/);
    const garbage = (async () => new Response('{not json', { status: 200 })) as typeof fetch;
    expect((await loadManifest('https://example.test/data/', garbage)).error).toMatch(/not valid JSON/);
  });

  it('asks for a fresh copy and builds the address from the data root', async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const spy = (async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify(fixtureJson));
    }) as unknown as typeof fetch;
    await loadManifest('https://example.test/placekeepers/data/', spy);
    expect(seen!.url).toBe('https://example.test/placekeepers/data/manifest.json');
    expect(seen!.init?.cache).toBe('no-cache');
  });
});

describe('finding each layer\'s file', () => {
  const base = 'https://example.test/placekeepers/data/';

  it('picks the loader by file type', () => {
    expect(dataKind('tiles/lots.pmtiles')).toBe('pmtiles');
    expect(dataKind('geojson/hin.geojson')).toBe('geojson');
    expect(dataKind('tables/parcels.json')).toBe('geojson');
    expect(dataKind('tiles/lots.mbtiles')).toBeNull();
  });

  it('names the GeoJSON fallback the way the pipeline does', () => {
    expect(geojsonFallbackPath('tiles/lots.pmtiles', 'parcels')).toBe('tiles/lots.parcels.geojson');
    expect(geojsonFallbackPath('tiles/streets.pmtiles', 'memorials')).toBe('tiles/streets.memorials.geojson');
  });

  it('uses the tile file when files lists it', () => {
    const m = manifestWith({
      layers: { hin_2025: { file: 'tiles/streets.pmtiles', source_layer: 'hin' } },
      files: { 'tiles/streets.pmtiles': { bytes: 10 } },
    });
    expect(resolveLayerData(layer('hin_2025'), m, base)).toEqual({
      ok: true,
      data: { kind: 'pmtiles', path: 'tiles/streets.pmtiles', url: `${base}tiles/streets.pmtiles`, sourceLayer: 'hin' },
    });
  });

  it('uses the GeoJSON written beside a skipped tile file', () => {
    const m = manifestWith({
      layers: { vacant_parcels: { file: 'tiles/lots.pmtiles', source_layer: 'parcels' } },
      files: { 'tiles/lots.parcels.geojson': { bytes: 10 } },
    });
    expect(resolveLayerData(layer('vacant_parcels'), m, base)).toEqual({
      ok: true,
      data: { kind: 'geojson', path: 'tiles/lots.parcels.geojson', url: `${base}tiles/lots.parcels.geojson`, sourceLayer: null },
    });
  });

  it('follows the manifest entry over the registry, with the registry file as a last resort', () => {
    const moved = manifestWith({
      layers: { hin_2025: { file: 'tiles/streets2.pmtiles', source_layer: 'hin2' } },
      files: { 'tiles/streets2.pmtiles': { bytes: 10 } },
    });
    expect(resolveLayerData(layer('hin_2025'), moved, base)).toMatchObject({ ok: true, data: { path: 'tiles/streets2.pmtiles', sourceLayer: 'hin2' } });
    const notInLayers = manifestWith({ layers: {}, files: { 'tiles/streets.pmtiles': { bytes: 10 } } });
    expect(resolveLayerData(layer('hin_2025'), notInLayers, base)).toMatchObject({ ok: true, data: { path: 'tiles/streets.pmtiles', sourceLayer: 'hin' } });
  });

  it('treats a layer as unavailable unless files lists its file', () => {
    const listedButMissing = manifestWith({
      layers: { vacant_parcels: { file: 'tiles/lots.pmtiles', source_layer: 'parcels' } },
      files: { 'tiles/context.pmtiles': { bytes: 10 } },
    });
    expect(resolveLayerData(layer('vacant_parcels'), listedButMissing, base)).toEqual({
      ok: false,
      reason: 'not_published',
      path: 'tiles/lots.pmtiles',
    });
    expect(resolveLayerData(layer('vacant_parcels'), null, base)).toEqual({ ok: false, reason: 'no_manifest', path: 'tiles/lots.pmtiles' });
  });

  it('refuses file types it cannot draw', () => {
    const m = manifestWith({ layers: { hin_2025: { file: 'tiles/streets.mbtiles' } }, files: { 'tiles/streets.mbtiles': { bytes: 1 } } });
    expect(resolveLayerData(layer('hin_2025'), m, base)).toMatchObject({ ok: false, reason: 'unsupported' });
  });

  it('lists exactly the files in the fixture data root, the dossier shards by prefix', () => {
    const { manifest } = parseManifest(fixtureJson);
    const onDisk = readdirSync(FIXTURE_ROOT, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => relative(FIXTURE_ROOT.pathname, `${d.parentPath}/${d.name}`))
      .filter((p) => p !== 'manifest.json')
      .sort();
    const shard = /^dossiers\/(\d+)\.json$/;
    // The lot timeline's history shards, one beside each dossier shard (issue #38).
    const historyShard = /^dossiers\/history\/(\d+)\.json$/;
    // Route survey sheets are listed in tables/routes/index.json, not in files (CONTRACTS.md section 7).
    const routeSheet = /^tables\/routes\/(?!index\.json$)[^/]+\.json$/;
    expect(Object.keys(manifest!.files).sort()).toEqual(onDisk.filter((p) => !shard.test(p) && !historyShard.test(p) && !routeSheet.test(p)));
    const prefixes = onDisk.map((p) => shard.exec(p)?.[1]).filter((p): p is string => !!p);
    expect([...manifest!.dossiers!.prefixes].sort()).toEqual(prefixes);
    expect(onDisk.map((p) => historyShard.exec(p)?.[1]).filter((p): p is string => !!p)).toEqual(prefixes);
  });

  it('points every fixture layer at a file that exists, using both file types', () => {
    const { manifest } = parseManifest(fixtureJson);
    const kinds = new Set<string>();
    // The base map is made by the site, not published in the data root (CONTRACTS.md section 2).
    for (const l of reg.layers.filter((layer) => !layer.file.startsWith('basemap/'))) {
      const result = resolveLayerData(l, manifest, FIXTURE_ROOT.href);
      expect(result.ok, l.id).toBe(true);
      if (!result.ok) continue;
      kinds.add(result.data.kind);
      expect(existsSync(new URL(result.data.path, FIXTURE_ROOT)), result.data.path).toBe(true);
    }
    expect([...kinds].sort()).toEqual(['geojson', 'pmtiles']);
  });
});

describe('the data root', () => {
  it('resolves the default against the site base, from any page', () => {
    expect(resolveDataBase(undefined, '/placekeepers/', 'https://x.github.io/placekeepers/')).toBe(
      'https://x.github.io/placekeepers/data/',
    );
    expect(resolveDataBase('./data/', '/placekeepers/', 'https://x.github.io/placekeepers/status/')).toBe(
      'https://x.github.io/placekeepers/data/',
    );
    expect(resolveDataBase('', '/', 'http://localhost:5173/')).toBe('http://localhost:5173/data/');
  });

  it('keeps an absolute data root and adds the final slash', () => {
    expect(resolveDataBase('https://data.example.org/pk', '/placekeepers/', 'https://x.github.io/placekeepers/')).toBe(
      'https://data.example.org/pk/',
    );
  });
});

describe('status in plain words', () => {
  it('lists every registry source, marking absent ones as not fetched', () => {
    const m = manifestWith({ sources: {} });
    const rows = statusRows(reg, m);
    expect(rows.map((r) => r.id)).toEqual(reg.sources.map((s) => s.id).filter((id) => id !== 'basemap_openstreetmap'));
    expect(rows.every((r) => r.status === 'missing')).toBe(true);
    expect(describeStatus(rows[0]!)).toEqual({ label: 'Not fetched yet', summary: 'This source has not been fetched yet.', details: [] });
  });

  it('does not repeat itself for a source listed as never fetched', () => {
    const m = manifestWith();
    m.sources.shootings = { status: 'missing', last_attempt: null, last_success: null, stale_since: null, rows: null, newest_record: null, message: null };
    expect(describeStatus(statusRows(reg, m).find((r) => r.id === 'shootings')!)).toEqual({
      label: 'Not fetched yet',
      summary: 'This source has not been fetched yet.',
      details: [],
    });
  });

  it('adds sources the manifest knows but the registry does not', () => {
    const m = manifestWith({ sources: { mystery: { status: 'ok' } } });
    expect(statusRows(reg, m).at(-1)).toMatchObject({ id: 'mystery', source: null, name: 'mystery', status: 'ok' });
  });

  it('describes a stale source with the date of its last good copy', () => {
    const m = manifestWith();
    m.sources.shootings = {
      status: 'stale',
      last_attempt: '2026-10-05T10:00:05Z',
      last_success: '2026-09-27T10:00:05Z',
      stale_since: '2026-09-27',
      rows: 17973,
      newest_record: '2026-09-25',
      message: 'Row count dropped by half',
    };
    const row = statusRows(reg, m).find((r) => r.id === 'shootings')!;
    expect(describeStatus(row)).toEqual({
      label: 'Out of date',
      summary: 'Using the last good copy, from September 27, 2026.',
      details: [
        'Last good download: September 27, 2026',
        'Last attempt: October 5, 2026',
        '17,973 records',
        'Newest record: September 25, 2026',
        'Note from the refresh: Row count dropped by half',
      ],
    });
  });

  it('describes failing and unknown sources', () => {
    const m = manifestWith();
    m.sources.shootings = { status: 'failing', last_attempt: null, last_success: null, stale_since: null, rows: null, newest_record: null, message: null };
    const failing = describeStatus(statusRows(reg, m).find((r) => r.id === 'shootings')!);
    expect(failing.label).toBe('Not working');
    expect(failing.details).toEqual(['No good download yet']);
    m.sources.shootings.status = 'unknown';
    expect(describeStatus(statusRows(reg, m).find((r) => r.id === 'shootings')!).label).toBe('Unknown');
  });

  it('sums up the sources', () => {
    const m = manifestWith();
    expect(statusSummary(statusRows(reg, m))).toBe('Every source is up to date.');
    m.sources.shootings!.status = 'stale';
    delete m.sources.opa_properties;
    delete m.sources.pwd_parcels;
    expect(statusSummary(statusRows(reg, m))).toBe('1 source is out of date, 2 sources have not been fetched yet.');
  });

  it('judges the base map by its own file, never by the pipeline, which does not fetch it', () => {
    expect([...baseMapSources(reg)]).toEqual(['basemap_openstreetmap']);
    const m = manifestWith();
    m.sources.basemap_openstreetmap = { status: 'missing', last_attempt: null, last_success: null, stale_since: null, rows: null, newest_record: null, message: 'Not collected yet' };
    // The header badge leaves it out: the map says so itself when the base map is missing.
    expect(freshness(reg, m).kind).toBe('ok');
    const made = statusRows(reg, m, { available: true, built: '2026-10-04' }).find((r) => r.id === 'basemap_openstreetmap')!;
    expect(made.status).toBe('ok');
    expect(describeStatus(made)).toEqual({
      label: 'Up to date',
      summary: 'The weekly refresh makes a new copy of the base map about once a month. This copy was made from OpenStreetMap on October 4, 2026.',
      details: [],
    });
    const missing = statusRows(reg, m, { available: false, built: null }).find((r) => r.id === 'basemap_openstreetmap')!;
    expect(describeStatus(missing).label).toBe('Not available');
    expect(statusSummary(statusRows(reg, m, { available: true, built: null }))).toBe('Every source is up to date.');
  });

  it('reads the base map build date beside the base map', async () => {
    const answer = (body: string, ok = true) => (async () => new Response(body, { status: ok ? 200 : 404 })) as typeof fetch;
    expect(await loadBaseMapInfo('https://x.test/data/', answer('20261004\n'))).toEqual({ available: true, built: '2026-10-04' });
    expect(await loadBaseMapInfo('https://x.test/data/', answer('soon'))).toEqual({ available: true, built: null });
    expect(await loadBaseMapInfo('https://x.test/data/', answer('', false))).toEqual({ available: false, built: null });
    const broken = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await loadBaseMapInfo('https://x.test/data/', broken)).toEqual({ available: false, built: null });
  });

  it('gives the header badge the data date, or a warning', () => {
    expect(freshness(reg, manifestWith())).toEqual({ kind: 'ok', text: 'Data from Oct 5, 2026' });
    const stale = manifestWith();
    stale.sources.shootings!.status = 'stale';
    expect(freshness(reg, stale).kind).toBe('stale');
    const failing = manifestWith();
    delete failing.sources.shootings;
    expect(freshness(reg, failing).kind).toBe('failing');
    expect(freshness(reg, null)).toEqual({ kind: 'unknown', text: 'Data status unknown' });
  });
});
