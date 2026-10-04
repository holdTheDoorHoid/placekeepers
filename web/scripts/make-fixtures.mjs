#!/usr/bin/env node
// Builds the tiny committed data root in web/fixtures/data/ used in development and tests.
//
// Everything here is SYNTHETIC: made up parcels, counts and lines near North Philadelphia,
// generated from a fixed seed so the output never changes unless this script does. The
// manifest's build_id starts with "fixture", which makes the site show a "sample data" note.
//
// Two layers are published as PMTiles (the path production uses) and one as GeoJSON (the
// fallback the pipeline uses when it cannot build tiles), so development exercises both.
//
// Needs h3-js and tippecanoe. From web/:
//   npm install --no-save h3-js@4 && node scripts/make-fixtures.mjs

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cellToBoundary, gridDisk, latLngToCell } from 'h3-js';

const ROOT = new URL('../fixtures/data/', import.meta.url);
const path = (p) => new URL(p, ROOT).pathname;

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

const collection = (features) => JSON.stringify({ type: 'FeatureCollection', features }) + '\n';
mkdirSync(path('geojson'), { recursive: true });
mkdirSync(path('tiles'), { recursive: true });
writeFileSync(path('geojson/parcels.geojson'), collection(parcels));
writeFileSync(path('geojson/h3.geojson'), collection(cells));
writeFileSync(path('geojson/hin.geojson'), collection(lines));

// Run from inside the data root with relative paths, because tippecanoe records its command
// line in the file's metadata and local folder names do not belong in committed files.
const tippecanoe = (out, layer, input, name, extra) =>
  execFileSync(
    'tippecanoe',
    ['-q', '-f', '-o', out, '-l', layer, '-n', name, '-N', 'Synthetic test data for Placekeepers', '--no-feature-limit', '--no-tile-size-limit', ...extra, input],
    { stdio: 'inherit', cwd: ROOT.pathname },
  );
tippecanoe('tiles/lots.pmtiles', 'parcels', 'geojson/parcels.geojson', 'Sample parcels', ['-Z', '12', '-z', '16', '--no-tiny-polygon-reduction']);
tippecanoe('tiles/context.pmtiles', 'h3', 'geojson/h3.geojson', 'Sample area cells', ['-Z', '9', '-z', '14', '--detect-shared-borders']);

const fileInfo = (p) => {
  const bytes = readFileSync(path(p));
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
    // pwd_parcels is left out on purpose: the status page shows it as "not fetched yet".
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
  },
  layers: {
    vacant_parcels: {
      file: 'tiles/lots.pmtiles',
      source_layer: 'parcels',
      sources: ['vacant_indicators_land', 'vacant_indicators_bldg', 'opa_properties', 'pwd_parcels'],
    },
    hin_2025: { file: 'geojson/hin.geojson', source_layer: 'hin', sources: ['high_injury_network'] },
    shootings_hex: { file: 'tiles/context.pmtiles', source_layer: 'h3', sources: ['shootings'] },
  },
  files: Object.fromEntries(
    ['tiles/lots.pmtiles', 'tiles/context.pmtiles', 'geojson/hin.geojson', 'geojson/parcels.geojson', 'geojson/h3.geojson'].map(
      (p) => [p, fileInfo(p)],
    ),
  ),
};
writeFileSync(path('manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${parcels.length} parcels, ${cells.length} cells and ${lines.length} lines to ${ROOT.pathname}`);
