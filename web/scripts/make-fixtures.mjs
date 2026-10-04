#!/usr/bin/env node
// Builds the tiny committed data root in web/fixtures/data/ used in development and tests.
//
// Everything here is SYNTHETIC: made up parcels, counts and lines near North Philadelphia,
// generated from a fixed seed so the output never changes unless this script does. The
// manifest's build_id starts with "fixture", which makes the site show a "sample data" note.
//
// Lots, context cells and care (LandCare lots and gardens, two layers in one file) are
// published as PMTiles (the path production uses); the High Injury Network and the three
// boundary layers as GeoJSON, named the way the pipeline names them when it cannot build tiles
// (<tile stem>.<layer>.geojson, see docs/CONTRACTS.md section 3), so development exercises both
// loaders. The GeoJSON inputs for
// the tiles live in fixtures/sources/, outside the data root, because the manifest's `files`
// must list exactly what the data root holds.
//
// Needs h3-js and tippecanoe. From web/:
//   npm install --no-save h3-js@4 && node scripts/make-fixtures.mjs

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { cellToBoundary, gridDisk, latLngToCell } from 'h3-js';

const FIXTURES = new URL('../fixtures/', import.meta.url);
const ROOT = new URL('data/', FIXTURES);
const path = (p) => new URL(p, FIXTURES).pathname;

// A small seeded random number generator (mulberry32), so the fixtures are reproducible.
let seed = 20261004;
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (lo, hi) => Math.round(lo + random() * (hi - lo));
const pick = (weighted) => {
  const total = weighted.reduce((a, [, w]) => a + w, 0);
  let r = random() * total;
  for (const [value, w] of weighted) if ((r -= w) <= 0) return value;
  return weighted.at(-1)[0];
};

const LAT0 = 39.985;
const LNG0 = -75.158;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const dLat = (m) => m / M_PER_DEG_LAT;
const dLng = (m) => m / M_PER_DEG_LNG;
const round6 = (n) => Math.round(n * 1e6) / 1e6;

// The vacancy model's reasons for a made up parcel (docs/CONTRACTS.md section 4): the bits of
// `rs`, the count `n` of the parcel's own records that agree (not the City's list), and the
// years that go with some bits. Chosen from the kind and confidence, so they fit the rules,
// without drawing random numbers, so every other fixture stays the same.
const REASON_BITS = [
  'city_land', 'city_building', 'assessor_vacant_land', 'no_building', 'demolished',
  'vacant_lot_record', 'landcare', 'sealed', 'unsafe', 'imminently_dangerous',
  'vacant_building_record', 'assessor_exterior', 'built_since', 'construction_starting',
  'side_yard', 'land_use_shows_use', 'recent_permit', 'building_stands',
];
function reasonsFor({ k, vc, lc }, index) {
  const odd = index % 2 === 1;
  let ids;
  const years = {};
  if (k === 1 && vc === 3) ids = ['city_land', 'assessor_vacant_land', 'no_building'];
  else if (k === 1 && vc === 2 && odd) ids = ['city_land', 'assessor_vacant_land', 'no_building', 'land_use_shows_use'];
  else if (k === 1 && vc === 2) ids = ['no_building', 'demolished', 'vacant_lot_record'];
  else if (k === 1 && odd && lc !== 1) ids = ['no_building', 'side_yard'];
  else if (k === 1) ids = ['assessor_vacant_land', 'built_since'];
  else if (vc === 3) ids = ['city_building', 'sealed'];
  else if (vc === 2 && odd) ids = ['unsafe'];
  else if (vc === 2) ids = ['city_building', 'sealed', 'recent_permit'];
  else ids = ['vacant_building_record'];
  if (lc === 1) ids.push('landcare');
  if (ids.includes('demolished')) years.dy = 2024;
  if (ids.includes('sealed')) years.sy = ids.includes('recent_permit') ? 2025 : 2024;
  if (ids.includes('built_since')) years.ny = 2023;
  const bits = ids.map((id) => REASON_BITS.indexOf(id));
  const own = bits.filter((bit) => bit >= 2 && bit < 12).length;
  return { rs: bits.reduce((sum, bit) => sum + 2 ** bit, 0), n: own, ...years };
}

// The first lawful step to get permission (`rt`, docs/CONTRACTS.md section 4), worked out from the
// owner type and LandCare as the pipeline's routes_for does: LandCare first, then the City or the
// Land Bank, the Redevelopment Authority, another public body, and a private owner. An unknown
// owner has no name on every other parcel (no clear route yet) and an untyped name on the rest.
// No random numbers are drawn, so every other fixture stays the same.
function firstStepFor({ ot, lc }, index) {
  if (lc === 1) return 1;
  if (ot === 3 || ot === 4) return 2;
  if (ot === 5) return 3;
  if (ot === 6 || ot === 8) return 4;
  if (ot === 0) return index % 2 === 1 ? 0 : 5;
  return 5;
}

// Two parcels get a public owner the random draw never gives (a housing authority and another
// public body), so every first step appears in the sample.
const OWNER_OVERRIDES = { 31: 6, 47: 8 };

// Parcels: ten runs of rowhouse sized lots (5 m wide, 25 m deep) on block faces.
const parcels = [];
const RUNS = [3, 6, 4, 7, 5, 4, 6, 5, 3, 7];
let n = 0;
RUNS.forEach((length, run) => {
  const col = run % 5;
  const row = Math.floor(run / 5);
  const west = col * 170 + between(0, 40);
  const south = row * 130 + between(0, 20);
  const xNorm = col / 4;
  const poverty = between(55, 95) - row * 10;
  for (let i = 0; i < length; i++) {
    n += 1;
    const x0 = west + i * 5;
    const ring = [
      [x0, south],
      [x0 + 5, south],
      [x0 + 5, south + 25],
      [x0, south + 25],
      [x0, south],
    ].map(([x, y]) => [round6(LNG0 + dLng(x)), round6(LAT0 + dLat(y))]);
    const building = random() < 0.3;
    const landcare = !building && random() < 0.2;
    const properties = {
      id: String(990000000 + n),
      k: building ? 2 : 1,
      vc: pick([[3, 4], [2, 4], [1, 2]]),
      ot: pick([[1, 35], [2, 15], [3, 15], [4, 15], [5, 5], [7, 5], [0, 10]]),
      lc: landcare ? 1 : 0,
      f_vacant: landcare ? between(20, 45) : between(55, 100),
      f_shoot: Math.min(100, Math.max(0, Math.round(25 + 60 * xNorm + between(-10, 10)))),
      f_poverty: Math.min(100, Math.max(0, poverty + between(-3, 3))),
      sg: building ? 'seal_abandoned_building' : landcare ? '' : 'clean_and_green',
    };
    if (OWNER_OVERRIDES[n] !== undefined) properties.ot = OWNER_OVERRIDES[n];
    properties.rt = firstStepFor(properties, n);
    Object.assign(properties, reasonsFor(properties, n));
    // Some parcels have no tree canopy rank yet, as happens while data arrives.
    if (random() > 0.2) properties.f_canopy = between(0, 100);
    parcels.push({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [ring] } });
  }
});

// Area cells: H3 resolution 9 around the parcels, with made up counts. Zero cells are kept
// on purpose so the map's "leave zero cells clear" rule is exercised.
const center = latLngToCell(LAT0 + dLat(80), LNG0 + dLng(400), 9);
const cells = gridDisk(center, 5).sort().map((h) => {
  const boundary = cellToBoundary(h, true).map(([lng, lat]) => [round6(lng), round6(lat)]);
  const ring = [...boundary, boundary[0]];
  const lng = boundary.reduce((a, p) => a + p[0], 0) / boundary.length;
  const east = Math.max(0, Math.min(1, (lng - LNG0) / dLng(900)));
  const s12 = random() < 0.35 ? 0 : Math.round(east * 7 * random() + random() * 2);
  const s36 = s12 + Math.round(s12 * 1.5 + random() * 3);
  return {
    type: 'Feature',
    properties: { h, s12, s36, f_poverty: between(40, 95) },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
});

// High Injury Network: three approximate street lines, named after real nearby streets.
function feet(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [x1, y1] = coords[i - 1];
    const [x2, y2] = coords[i];
    total += Math.hypot((x2 - x1) * M_PER_DEG_LNG, (y2 - y1) * M_PER_DEG_LAT);
  }
  return Math.round(total * 3.28084);
}
const lines = [
  ['N Broad St', [[-75.1603, 39.976], [-75.1594, 39.984], [-75.1585, 39.992], [-75.1577, 39.9995]]],
  ['W Lehigh Ave', [[-75.168, 39.9905], [-75.158, 39.9912], [-75.146, 39.992], [-75.136, 39.9927]]],
  ['Germantown Ave', [[-75.1395, 39.979], [-75.1455, 39.9845], [-75.152, 39.99], [-75.158, 39.9975]]],
].map(([name, coords], i) => ({
  type: 'Feature',
  properties: { id: `hin_fixture_${i + 1}`, name, len: feet(coords) },
  geometry: { type: 'LineString', coordinates: coords },
}));

// Care already happening: every parcel marked lc = 1 is also a LandCare lot, and a few gardens
// sit near the parcels. Names are made up.
const landcareLots = parcels
  .filter((f) => f.properties.lc === 1)
  .map((f) => ({
    type: 'Feature',
    properties: { id: f.properties.id, p: pick([[1, 3], [2, 2], [3, 1]]), y: between(2008, 2025) },
    geometry: f.geometry,
  }));
const gardenPoints = [
  ['Sample Community Garden', 3, 'https://example.org/sample-garden'],
  ['Sample Farm', 1, null],
  ['Sample Trust Garden', 2, null],
  ['Sample Park Garden', 4, null],
].map(([nm, src, w], i) => ({
  type: 'Feature',
  properties: w ? { nm, src, w } : { nm, src },
  geometry: { type: 'Point', coordinates: [round6(LNG0 + dLng(120 + i * 190)), round6(LAT0 + dLat(between(60, 200)))] },
}));

// Boundaries: two council districts side by side, two overlapping community organizations and
// two neighborhoods, all made up, around the parcels.
const box = (west, south, east, north) => ({
  type: 'Polygon',
  coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]].map(([x, y]) => [round6(LNG0 + dLng(x)), round6(LAT0 + dLat(y))])],
});
const councilDistricts = [
  { type: 'Feature', properties: { d: 5, nm: 'District 5' }, geometry: box(-200, -150, 420, 420) },
  { type: 'Feature', properties: { d: 7, nm: 'District 7' }, geometry: box(420, -150, 1050, 420) },
];
const communityOrganizations = [
  { type: 'Feature', properties: { id: 9001, nm: 'Sample Civic Association', t: 'Other', w: 'https://example.org/civic' }, geometry: box(-100, -60, 600, 330) },
  { type: 'Feature', properties: { id: 9002, nm: 'Sample Ward Committee', t: 'Ward' }, geometry: box(300, -40, 950, 360) },
];
const neighborhoods = [
  { type: 'Feature', properties: { id: 'SAMPLE_WEST', nm: 'Sample West' }, geometry: box(-200, -150, 380, 420) },
  { type: 'Feature', properties: { id: 'SAMPLE_EAST', nm: 'Sample East' }, geometry: box(380, -150, 1050, 420) },
];

// Street blocks: a grid of made up blocks, each with the street safety lens factors and the
// counts behind them (docs/CONTRACTS.md, segments). Blocks along the first High Injury Network
// line are on the network. Factor fields follow the pipeline's rules: yes or no factors are 0
// or 100, and the count factor is the share of blocks with a lower count.
const GRID_X = [0, 160, 320, 480, 640, 800];
const GRID_Y = [-60, 60, 180];
const blocks = [];
for (const y of GRID_Y) {
  for (let i = 1; i < GRID_X.length; i++) blocks.push({ name: `SAMPLE ${blocks.length + 1} ST`, cls: 5, a: [GRID_X[i - 1], y], b: [GRID_X[i], y] });
}
for (const x of GRID_X) {
  for (let i = 1; i < GRID_Y.length; i++) blocks.push({ name: x === 160 ? 'N BROAD ST' : `SAMPLE ${blocks.length + 1} AVE`, cls: x === 160 ? 2 : 4, a: [x, GRID_Y[i - 1]], b: [x, GRID_Y[i]] });
}
const toLngLat = ([x, y]) => [round6(LNG0 + dLng(x)), round6(LAT0 + dLat(y))];
const ksiCounts = blocks.map(() => pick([[0, 60], [1, 20], [2, 12], [4, 8]]));
const ranked = [...ksiCounts].sort((a, b) => a - b);
const strictlyLower = (v) => ranked.findIndex((x) => x >= v);
const segments = blocks.map((block, i) => {
  const hin = block.name === 'N BROAD ST' ? 1 : 0;
  const k2 = random() < 0.12 ? 1 : 0;
  const sch = random() < 0.5 ? 1 : 0;
  const ksi = ksiCounts[i];
  return {
    type: 'Feature',
    properties: {
      id: 900001 + i,
      name: block.name,
      cls: block.cls,
      hin,
      f_hin: hin * 100,
      ksi,
      f_ksi_vru: Math.round((100 * strictlyLower(ksi)) / ksiCounts.length),
      k2,
      f_fatal2: k2 * 100,
      sch,
      f_school: sch * 100,
    },
    geometry: { type: 'LineString', coordinates: [toLngLat(block.a), toLngLat(block.b)] },
  };
});

// Crashes: made up points along the blocks, 2015 to 2024 (docs/CONTRACTS.md, crashes).
const crashes = [];
for (let i = 0; i < 160; i++) {
  const block = blocks[between(0, blocks.length - 1)];
  const t = random();
  const x = block.a[0] + (block.b[0] - block.a[0]) * t;
  const y = block.a[1] + (block.b[1] - block.a[1]) * t;
  const year = between(2015, 2024);
  crashes.push({
    type: 'Feature',
    properties: { id: 9000000000 + i, y: year, ya: 2024 - year, sev: pick([[0, 35], [1, 45], [2, 15], [3, 5]]), m: pick([[0, 60], [1, 20], [2, 8], [4, 8], [3, 4]]) },
    geometry: { type: 'Point', coordinates: toLngLat([x, y]) },
  });
}

// Memorials: a few made up markers with dates, modes and places, and no names: names come only
// from the hand curated public memorial list (docs/ETHICS.md), never from samples.
const MEMORIAL_SAMPLES = [
  ['2026-08-20', 1, 'memorial_or_ghost_bike,traffic_calming_petition'],
  ['2025-11-11', 2, 'memorial_or_ghost_bike,daylighting_check,asphalt_art_check'],
  ['2024-03-02', 8, 'memorial_or_ghost_bike,traffic_calming_petition,daylighting_check,asphalt_art_check'],
  ['2023-05-05', 1, 'memorial_or_ghost_bike'],
  ['2022-07-14', 4, 'memorial_or_ghost_bike'],
  ['2021-01-30', 0, 'memorial_or_ghost_bike,daylighting_check,asphalt_art_check'],
];
const memorials = MEMORIAL_SAMPLES.map(([d, m, sg], i) => {
  const block = blocks[(i * 7) % blocks.length];
  return {
    type: 'Feature',
    properties: { id: `fc${d.replaceAll('-', '')}_${(4096 + i).toString(16)}`, d, m, pl: `Sample St and Test Ave ${i + 1}`, sg },
    geometry: { type: 'Point', coordinates: toLngLat([(block.a[0] + block.b[0]) / 2, (block.a[1] + block.b[1]) / 2 + 4]) },
  };
});

const collection = (features) => JSON.stringify({ type: 'FeatureCollection', features }) + '\n';
// The lot dossier files in data/dossiers/ (a shard and common.json) and the owners table in
// data/tables/ are written by hand (docs/CONTRACTS.md section 6: every flag type, and parcels the
// vacancy model leaves out), so they are kept as they are.
const kept = (folder) => {
  const dir = new URL(`data/${folder}/`, FIXTURES);
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => [`${folder}/${name}`, readFileSync(new URL(name, dir))])
    : [];
};
const handWritten = [...kept('dossiers'), ...kept('tables')];
rmSync(ROOT, { recursive: true, force: true });
for (const [name, bytes] of handWritten) {
  mkdirSync(new URL(name.slice(0, name.lastIndexOf('/') + 1), ROOT), { recursive: true });
  writeFileSync(new URL(name, ROOT), bytes);
}
// Shards are named by digits and listed in the manifest's dossiers block, not in files.
const shardFiles = handWritten.filter(([name]) => /^dossiers\/\d+\.json$/.test(name));
mkdirSync(path('sources'), { recursive: true });
mkdirSync(path('data/tiles'), { recursive: true });
writeFileSync(path('sources/parcels.geojson'), collection(parcels));
writeFileSync(path('sources/h3.geojson'), collection(cells));
writeFileSync(path('data/tiles/streets.hin.geojson'), collection(lines));
writeFileSync(path('sources/landcare.geojson'), collection(landcareLots));
writeFileSync(path('sources/gardens.geojson'), collection(gardenPoints));
writeFileSync(path('data/tiles/boundaries.council_districts.geojson'), collection(councilDistricts));
writeFileSync(path('data/tiles/boundaries.rcos.geojson'), collection(communityOrganizations));
writeFileSync(path('data/tiles/boundaries.neighborhoods.geojson'), collection(neighborhoods));
writeFileSync(path('data/tiles/streets.segments.geojson'), collection(segments));
writeFileSync(path('data/tiles/streets.crashes.geojson'), collection(crashes));
writeFileSync(path('data/tiles/streets.memorials.geojson'), collection(memorials));

// Run from the fixtures folder with relative paths, because tippecanoe records its command
// line in the file's metadata and local folder names do not belong in committed files.
const tippecanoe = (out, layer, input, name, extra) =>
  execFileSync(
    'tippecanoe',
    ['-q', '-f', '-o', out, '-l', layer, '-n', name, '-N', 'Synthetic test data for Placekeepers', '--no-feature-limit', '--no-tile-size-limit', ...extra, input],
    { stdio: 'inherit', cwd: FIXTURES.pathname },
  );
tippecanoe('data/tiles/lots.pmtiles', 'parcels', 'sources/parcels.geojson', 'Sample parcels', ['-Z', '12', '-z', '16', '--no-tiny-polygon-reduction']);
tippecanoe('data/tiles/context.pmtiles', 'h3', 'sources/h3.geojson', 'Sample area cells', ['-Z', '9', '-z', '14', '--detect-shared-borders']);
execFileSync(
  'tippecanoe',
  ['-q', '-f', '-o', 'data/tiles/care.pmtiles', '-n', 'Sample care', '-N', 'Synthetic test data for Placekeepers', '--no-feature-limit', '--no-tile-size-limit', '-Z', '12', '-z', '16', '--no-tiny-polygon-reduction', '-L', 'landcare:sources/landcare.geojson', '-L', 'gardens:sources/gardens.geojson'],
  { stdio: 'inherit', cwd: FIXTURES.pathname },
);

const fileInfo = (p) => {
  const bytes = readFileSync(new URL(p, ROOT));
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
};

const ok = (rows, newest) => ({
  status: 'ok',
  last_attempt: '2026-10-04T10:00:05Z',
  last_success: '2026-10-04T10:00:05Z',
  stale_since: null,
  rows,
  newest_record: newest,
  message: null,
});

const manifest = {
  schema: 1,
  build_id: 'fixture-2026-10-04',
  generated_at: '2026-10-04T10:03:12Z',
  sources: {
    opa_properties: ok(583412, '2026-10-02'),
    pwd_parcels: {
      status: 'missing',
      last_attempt: null,
      last_success: null,
      stale_since: null,
      rows: null,
      newest_record: null,
      message: null,
    },
    vacant_indicators_land: {
      status: 'failing',
      last_attempt: '2026-10-04T10:00:09Z',
      last_success: null,
      stale_since: null,
      rows: null,
      newest_record: null,
      message: 'The City server did not answer. There is no earlier copy yet.',
    },
    vacant_indicators_bldg: {
      status: 'stale',
      last_attempt: '2026-10-04T10:00:11Z',
      last_success: '2026-09-27T10:00:07Z',
      stale_since: '2026-09-27',
      rows: 9519,
      newest_record: '2026-09-27',
      message: 'This week the row count fell by more than 20 percent, so last week\'s copy is in use.',
    },
    shootings: ok(17973, '2026-10-01'),
    high_injury_network: ok(162, null),
    phs_landcare: ok(12459, null),
    gardens_phs_ngt: ok(216, null),
    gardens_registered: ok(23, null),
    council_districts: ok(10, null),
    community_organizations: ok(240, null),
    neighborhoods: ok(159, null),
    crashes_2020_2024: ok(36303, '2024-12-01'),
    crashes_2016_2020: ok(45308, null),
    crashes_2007_2017: ok(11453, null),
    fatal_crashes: ok(935, '2026-08-22'),
    schools: ok(490, null),
    street_centerlines: ok(41252, null),
    memorial_names: ok(0, null),
    // The pipeline lists the base map's source but never fetches it: the site makes the base map.
    basemap_openstreetmap: {
      status: 'missing',
      last_attempt: null,
      last_success: null,
      stale_since: null,
      rows: null,
      newest_record: null,
      message: 'Not collected yet',
    },
  },
  layers: {
    vacant_parcels: {
      file: 'tiles/lots.pmtiles',
      source_layer: 'parcels',
      sources: ['vacant_indicators_land', 'vacant_indicators_bldg', 'opa_properties', 'pwd_parcels'],
    },
    hin_2025: { file: 'tiles/streets.pmtiles', source_layer: 'hin', sources: ['high_injury_network'] },
    shootings_hex: { file: 'tiles/context.pmtiles', source_layer: 'h3', sources: ['shootings'] },
    landcare_lots: { file: 'tiles/care.pmtiles', source_layer: 'landcare', sources: ['phs_landcare'] },
    gardens: { file: 'tiles/care.pmtiles', source_layer: 'gardens', sources: ['gardens_phs_ngt', 'gardens_registered'] },
    council_districts: { file: 'tiles/boundaries.pmtiles', source_layer: 'council_districts', sources: ['council_districts'] },
    community_organizations: { file: 'tiles/boundaries.pmtiles', source_layer: 'rcos', sources: ['community_organizations'] },
    neighborhoods: { file: 'tiles/boundaries.pmtiles', source_layer: 'neighborhoods', sources: ['neighborhoods'] },
    segments: {
      file: 'tiles/streets.pmtiles',
      source_layer: 'segments',
      sources: ['street_centerlines', 'high_injury_network', 'crashes_2020_2024', 'fatal_crashes', 'schools'],
    },
    crashes: {
      file: 'tiles/streets.pmtiles',
      source_layer: 'crashes',
      sources: ['crashes_2020_2024', 'crashes_2016_2020', 'crashes_2007_2017'],
    },
    memorials: { file: 'tiles/streets.pmtiles', source_layer: 'memorials', sources: ['fatal_crashes', 'memorial_names'] },
    basemap: { file: 'basemap/philly.pmtiles', source_layer: 'earth', sources: ['basemap_openstreetmap'] },
  },
  files: Object.fromEntries(
    [
      'tiles/boundaries.council_districts.geojson',
      'tiles/boundaries.neighborhoods.geojson',
      'tiles/boundaries.rcos.geojson',
      'tiles/care.pmtiles',
      'tiles/context.pmtiles',
      'tiles/lots.pmtiles',
      'tiles/streets.crashes.geojson',
      'tiles/streets.hin.geojson',
      'tiles/streets.memorials.geojson',
      'tiles/streets.segments.geojson',
      ...handWritten.map(([name]) => name).filter((name) => !shardFiles.some(([shard]) => shard === name)),
    ].map((p) => [p, fileInfo(p)]),
  ),
  dossiers: shardFiles.length
    ? {
        prefix_digits: 4,
        prefixes: shardFiles.map(([name]) => name.slice('dossiers/'.length, -'.json'.length)),
        files: shardFiles.length,
        bytes: shardFiles.reduce((sum, [, bytes]) => sum + bytes.length, 0),
      }
    : null,
  notes: [
    'This is synthetic sample data for testing the map.',
    'Street and boundary tiles were skipped for this sample, so those layers are published as GeoJSON.',
  ],
};
writeFileSync(new URL('manifest.json', ROOT), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `Wrote ${parcels.length} parcels, ${cells.length} cells, ${lines.length} lines, ${landcareLots.length} LandCare lots, ` +
    `${gardenPoints.length} gardens, ${councilDistricts.length + communityOrganizations.length + neighborhoods.length} boundaries, ` +
    `${segments.length} blocks, ${crashes.length} crashes and ${memorials.length} memorials to ${ROOT.pathname}`,
);
