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
import { AMENITY_LAYERS, AMENITY_SOURCES, amenityFixtures } from './amenity-fixtures.mjs';
import { WATCH_BLOCK, WATCH_LAYER, WATCH_SOURCES, watchFixtures, watchFor } from './displacement-fixtures.mjs';
import { routeOsmStops, routeSheetFixtures } from './route-fixtures.mjs';
import { WALK_LAYERS, WALK_SOURCES, walkFixtures } from './walk-fixtures.mjs';
import { PARKING_LAYERS, PARKING_SOURCES, parkingFixtures } from './parking-fixtures.mjs';
import { HISTORIC_LAYERS, HISTORIC_SOURCES } from './historic-fixtures.mjs';

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

// Parcels the City's land agencies list as available (`la`, issue #36), as the hand written lot
// pages in data/dossiers/9900.json say: a City lot PHS LandCare keeps up, and a Land Bank lot
// eligible for a side yard (`ly`).
const LISTED = new Set([2, 9]);
const SIDE_YARD = new Set([9]);

// The heat and shade lens (M3.1, docs/CONTRACTS.md section 4), worked out without random draws so
// every other fixture stays the same: heat vulnerability rises to the east, City trees thin out
// to the north, people are spread evenly, and the eastern run of the first row lies in the 1
// percent annual chance floodplain (`fp`). The heat suggestions follow the pipeline's rule
// (pipeline/src/placekeepers/derive/heat.py): on a lot, plant shade trees where the canopy rank
// (or, without it, the City tree rank) is at least 50, and green to cool where heat
// vulnerability is.
function heatFor({ k, f_canopy }, index, col, row) {
  const heat = {
    f_heatvul: Math.min(99, 15 + col * 20 + (index % 3) * 2),
    f_strees: Math.min(97, 25 + row * 35 + (index % 4) * 6),
    f_people: 30 + (index % 6) * 12,
  };
  if (col === 4 && row === 0) heat.fp = 1;
  const extra = [];
  if (k === 1) {
    if ((f_canopy ?? heat.f_strees) >= 50) extra.push('plant_shade_trees');
    if (heat.f_heatvul >= 50) extra.push('cool_green_lot');
  }
  return { heat, extra };
}

// The placemaking lens (M3.4, docs/CONTRACTS.md section 4), worked out without random draws so
// every other fixture stays the same: walkability, everyday places and the City's park and art
// distances rise and fall from west to east, neighbors grow to the east and north, and the middle
// runs lie on a commercial corridor. `f_park` and `f_art` are multiples of 5, as the pipeline
// rounds them. The suggestions follow the pipeline's rule
// (pipeline/src/placekeepers/derive/placemaking.py): on a lot, a place to sit where at least half
// the places have fewer neighbors, a garden where a park is far, art where none of the two art
// lists is within a 5 minute walk (the western runs here) and neighbors are many, and a report to
// Philly311 for a few lots facing a block with an open request.
const REPORTS = { 7: ['report_dumping'], 22: ['report_dumping', 'report_dark_light'], 38: ['report_graffiti'] };
function placemakingFor({ k }, index, col, row) {
  const place = {
    f_walk: [15, 40, 65, 85, 95][col],
    f_neighbors: Math.min(100, 20 + col * 15 + row * 10 + (index % 4) * 5),
    f_dest: Math.min(100, 30 + col * 12 + (index % 3) * 5),
    f_park: [85, 45, 50, 30, 15][col] - row * 10,
    f_art: [90, 75, 40, 20, 5][col],
    f_corr: col === 2 ? 100 : 0,
  };
  const extra = [];
  if (k === 1) {
    if (place.f_neighbors >= 50) extra.push('seating_and_shade');
    if (place.f_park >= 50) extra.push('community_garden');
    if (col <= 1 && place.f_neighbors >= 50) extra.push('art_request');
    extra.push(...(REPORTS[index] ?? []));
  }
  return { place, extra };
}

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
      // As the pipeline does: every vacant lot gets clean and green (for a LandCare lot, through
      // Community LandCare), every vacant building gets sealed.
      sg: building ? 'seal_abandoned_building' : 'clean_and_green',
    };
    if (OWNER_OVERRIDES[n] !== undefined) properties.ot = OWNER_OVERRIDES[n];
    properties.rt = firstStepFor(properties, n);
    if (LISTED.has(n)) properties.la = 1;
    if (SIDE_YARD.has(n)) properties.ly = 1;
    Object.assign(properties, reasonsFor(properties, n));
    // Some parcels have no tree canopy rank yet, as happens while data arrives.
    if (random() > 0.2) properties.f_canopy = between(0, 100);
    const { heat, extra } = heatFor(properties, n, col, row);
    Object.assign(properties, heat);
    // The displacement watch area the lot lies in (M4.1, scripts/displacement-fixtures.mjs).
    const watch = watchFor(x0);
    if (watch) properties.dw = watch;
    if (extra.length) properties.sg = [properties.sg, ...extra].join(',');
    const placemaking = placemakingFor(properties, n, col, row);
    Object.assign(properties, placemaking.place);
    if (placemaking.extra.length) properties.sg = [properties.sg, ...placemaking.extra].join(',');
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

// SEPTA stops and routes (docs/CONTRACTS.md, `stops` and `routes` in tiles/transit.pmtiles), made
// up and fixed by hand (no random draws, so every fixture above stays the same). They cover a
// frequent stop, a stop with service through the night, a bus and trolley stop, a stop with no
// SEPTA count, a renumbered stop whose count came from its old id, a stop with no midday service,
// the two platforms of a subway station at one spot, and a Regional Rail station.
//
// Bus and trolley stops also carry the transit comfort lens (M2.3) as the pipeline publishes it
// (ranks among these six stops): the mark of a stop the lens scores (`tc`), SEPTA's and the City's
// factors, canopy (`cp`), the High Injury Network (`hin`), the suggestion they decide (`sg`), and
// the OpenStreetMap stop at the same pole (`o`). What OpenStreetMap says there is in
// tables/stop_amenities.json (LINKED_OSM_STOPS below), joined in the browser (decision D1): a busy
// stop with neither shelter nor bench, a stop with a bench only, a sheltered stop with nothing to
// suggest, a stop OpenStreetMap has but no one has surveyed, one it does not have, and one with a
// shelter answer but no bench answer. Stops on the route survey sheets (route-fixtures.mjs) link
// to the same OpenStreetMap stop there.
const STOP_SAMPLES = [
  [[170, 60], { id: 'sp1001', sid: '1001', nm: 'Sample 2 St & N Broad St (far side)', md: 1, r: '16,B1 OWL', tw: 75, ts: 65, tu: 58, bh: 6, hp: 17, hm: 22, hs: 22, hu: 30, ft: 24, lt: 1507, ev: 8, nt: 3, wc: 1, b: 132, bp: 'Spring 2026',
    o: 'n9100001', tc: 1, f_riders: 40, f_shade: 33, f_heat: 33, f_hin: 100, f_wait: 40, cp: 24, hin: 1 }],
  [[150, 60], { id: 'sp1002', sid: '1002', nm: 'N Broad St & Sample 2 St', md: 1, r: '4,16', tw: 140, ts: 90, tu: 70, bh: 10, hp: 6, hm: 9, hs: 12, hu: 15, ft: 305, lt: 1528, ev: 16, nt: 1, wc: 1, b: 848, bp: 'Spring 2026',
    o: 'n9100002', tc: 1, f_riders: 60, f_shade: 83, f_heat: 33, f_hin: 100, f_wait: 20, cp: 2, hin: 1,
    sg: 'stop_shade_trees' }],
  [[480, 180], { id: 'sp1003', sid: '1003', nm: 'Sample 3 St & Sample 5 Ave', md: 3, r: 'T1,47', tw: 180, ts: 120, tu: 100, bh: 12, hp: 5, hm: 7, hs: 9, hu: 10, ft: 300, lt: 1450, ev: 20, wc: 1, b: 1240, bp: 'Spring 2026',
    o: 'w9100003', tc: 1, f_riders: 80, f_shade: 17, f_heat: 0, f_hin: 0, f_wait: 0, cp: 31 }],
  [[640, -60], { id: 'sp1004', sid: '1004', nm: 'Sample 1 St & Sample 8 Ave', md: 1, r: '60', tw: 22, ts: 12, tu: 0, bh: 2, hp: 40, hm: 60, hs: 120, ft: 380, lt: 1180, ev: 0, wc: 1,
    o: 'n9100004', tc: 1, f_shade: 67, f_heat: 83, f_hin: 0, f_wait: 60, cp: 6 }],
  [[560, 60], { id: 'sp1105', sid: '1005', nm: 'Sample 2 St & Sample 6 Ave (midblock, near side)', md: 1, r: '60', tw: 22, ts: 12, tu: 0, bh: 2, hp: 40, hm: 60, hs: 120, ft: 385, lt: 1185, ev: 0, wc: 2, fid: '1105', b: 4, bp: 'Spring 2026', bx: '1105',
    tc: 1, f_riders: 20, f_shade: 50, f_heat: 67, f_hin: 0, f_wait: 60, cp: 12 }],
  [[320, 180], { id: 'sp1008', sid: '1008', nm: 'Sample 3 St & Sample 2 St', md: 1, r: '441', tw: 1, ts: 0, tu: 0, bh: 1, ft: 388, lt: 388, ev: 0, wc: 1, b: 0, bp: 'Spring 2026',
    o: 'n9100008', tc: 1, f_riders: 0, f_shade: 0, f_heat: 0, f_hin: 0, cp: 40 }],
  [[160, -20], { id: 'sp1006', sid: '1006', nm: 'Sample', md: 4, r: 'B1,B2,B3', tw: 283, ts: 153, tu: 113, bh: 27, hp: 2, hm: 5, hs: 7, hu: 7, ft: 307, lt: 1455, ev: 23, wc: 2 }],
  [[161, -20], { id: 'sp1007', sid: '1007', nm: 'Sample', md: 4, r: 'B1,B2,B3', tw: 284, ts: 152, tu: 104, bh: 26, hp: 2, hm: 4, hs: 7, hu: 10, ft: 315, lt: 1485, ev: 28, wc: 2 }],
  [[800, 180], { id: 'sr90009', sid: '90009', nm: 'Sample Regional Rail Station', md: 8, r: 'CHW', tw: 42, ts: 18, tu: 18, bh: 3, hp: 40, hm: 60, hs: 120, hu: 120, ft: 330, lt: 1430, ev: 6, wc: 1 }],
];
const transitStops = STOP_SAMPLES.map(([xy, properties]) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: toLngLat(xy) } }));
const ROUTE_SAMPLES = [
  [[[150, -60], [150, 180]], { id: '16', r: '16', nm: 'Broad-Erie to Cheltenham-Ogontz', md: 1, tw: 150, hp: 8, hm: 11 }],
  [[[0, 60], [800, 60]], { id: '60', r: '60', nm: 'Sample route across town', md: 1, tw: 44, hp: 20, hm: 30 }],
  [[[0, 180], [800, 180]], { id: 'T1', r: 'T1', nm: '13th St to 63rd-Malvern/Overbrook', md: 2, tw: 228, hp: 8, hm: 10 }],
  [[[160, -60], [160, 180]], { id: 'B1', r: 'B1', nm: 'Broad Street Line Local', md: 4, tw: 280, hp: 7, hm: 7 }],
  [[[0, -60], [800, 180]], { id: 'CHW', r: 'CHW', nm: 'Chestnut Hill West Line', md: 8, tw: 42, hp: 40, hm: 60 }],
];
const transitRoutes = ROUTE_SAMPLES.map(([coords, properties]) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: coords.map(toLngLat) } }));

// Shelters and benches at stops, from OpenStreetMap (M2.2): a few made up stops along the sample
// streets, one for each thing the map can show (a shelter, a roof, a bench only, neither, not yet
// surveyed), with the short properties of docs/CONTRACTS.md section 4 (`stops` in
// tiles/amenities.pmtiles). No random numbers, so every other fixture stays the same. Published as
// GeoJSON, as the pipeline does when it skips a tile file.
const AMENITY_STOP_SAMPLES = [
  [168, -20, { id: 'n9000001', c: 3, md: 1, sh: 1, bn: 1, bi: 1, lt: 1, tp: 0, nm: 'Broad St & Sample 1 St', ref: '90001' }],
  [152, 100, { id: 'n9000002', c: 3, md: 1, sh: 1, nb: 1, nm: 'Broad St & Sample 6 St' }],
  [160, 188, { id: 'n9000003', c: 3, md: 3, cv: 1, nm: 'Sample transit center' }],
  [320, 52, { id: 'n9000004', c: 2, md: 1, sh: 0, bn: 1, ref: '90004' }],
  [480, 52, { id: 'n9000005', c: 1, md: 1, sh: 0, bn: 0, bi: 0, lt: 1, tp: 0, nm: 'Sample 9 St & Sample 20 Ave' }],
  [640, -52, { id: 'n9000006', c: 0, md: 2, nm: 'Sample 3 St & Sample 24 Ave' }],
  [800, 172, { id: 'w9000007', c: 0, md: 2, sh: 0 }],
];
const amenityStops = AMENITY_STOP_SAMPLES.map(([x, y, properties]) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: toLngLat([x, y]) } }));

// What OpenStreetMap says at each stop, keyed by its id (tables/stop_amenities.json, docs/CONTRACTS.md
// section 8): the stops of the shelters and benches samples above, the OpenStreetMap stops SEPTA's
// sample stops link to (`o`), and those the route sheets link to (`osm`). The only file besides the
// shelters and benches tiles that holds OpenStreetMap's answers; the browser joins it (decision D1).
const LINKED_OSM_STOPS = {
  n9100001: { c: 2, sh: 0, bn: 1, lt: 1 },
  n9100002: { c: 1, sh: 0, bn: 0, lt: 0, n: ['1002'] },
  w9100003: { c: 3, sh: 1, bn: 1, lt: 1, n: ['1003'] },
  n9100004: { c: 0 },
  n9100008: { c: 0, sh: 0, n: ['1008'] },
};
const tableEntry = (properties) => {
  const entry = { c: properties.c };
  for (const key of ['sh', 'bn', 'bi', 'lt', 'cv']) if (properties[key] !== undefined) entry[key] = properties[key];
  const numbers = [properties.ref, properties.gs].filter(Boolean).flatMap((v) => String(v).split(/[;,]/).map((n) => n.trim()).filter(Boolean));
  if (numbers.length) entry.n = [...new Set(numbers)];
  return entry;
};
const osmStops = {};
const addOsmStop = (id, entry) => {
  if (osmStops[id] && JSON.stringify(osmStops[id]) !== JSON.stringify(entry)) {
    throw new Error(`Two sample answers for OpenStreetMap stop ${id}: ${JSON.stringify(osmStops[id])} and ${JSON.stringify(entry)}`);
  }
  osmStops[id] = entry;
};
for (const [, , properties] of AMENITY_STOP_SAMPLES) addOsmStop(properties.id, tableEntry(properties));
for (const [id, entry] of Object.entries(LINKED_OSM_STOPS)) addOsmStop(id, entry);
for (const [id, answers] of Object.entries(routeOsmStops())) {
  // The route sheets' samples name the answers too; they must agree with the ones above.
  if (osmStops[id]) {
    for (const [key, value] of Object.entries(answers)) {
      if (osmStops[id][key] !== value) throw new Error(`Route sheet sample ${id} says ${key}=${value}, the table says ${osmStops[id][key]}`);
    }
  } else addOsmStop(id, tableEntry(answers));
}
for (const transit of STOP_SAMPLES) {
  const o = transit[1].o;
  if (o && !osmStops[o]) throw new Error(`Sample stop ${transit[1].id} links to ${o}, which the table does not have`);
}
const stopTable = {
  schema: 1,
  generated_at: '2026-10-04T10:03:12Z',
  as_of: { osm: '2026-10-03' },
  credit: '© OpenStreetMap contributors',
  license: 'Open Database License 1.0, https://opendatacommons.org/licenses/odbl/1-0/',
  stops: Object.fromEntries(Object.entries(osmStops).sort(([a], [b]) => a.localeCompare(b))),
};

// Heat, trees and the floodplain (M3.1), made up and without random draws. Four census tracts of
// the City's Heat Vulnerability Index around the parcels, each with its class from 1 to 5 for
// heat vulnerability, exposure and sensitivity, one rated very high (`vh`) and one the index does
// not report; City trees along the sample streets, of several kinds and sizes; and the 1 percent
// annual chance floodplain with a floodway beside the 0.2 percent annual chance area, in the east.
// Published as GeoJSON, as the pipeline does when it skips a tile file.
const heatTracts = [
  [{ id: '42101900100', hv: 2, he: 1, hs: 3 }, box(-200, -150, 300, 420)],
  [{ id: '42101900200', hv: 4, he: 4, hs: 3 }, box(300, -150, 650, 420)],
  [{ id: '42101900300', hv: 5, he: 5, hs: 5, vh: 1 }, box(650, -150, 1050, 420)],
  [{ id: '42101900400' }, box(-200, 420, 1050, 600)],
].map(([properties, geometry]) => ({ type: 'Feature', properties, geometry }));
const TREE_KINDS = ['Red Maple', 'London Planetree', 'Callery Pear', null, 'Pin Oak', 'Japanese Zelkova'];
const TREE_TRUNKS = [2, 3, 8, 14, 22, null, 31];
const cityTrees = [];
for (const [y, west, east, step] of [[56, 0, 800, 40], [-64, 0, 480, 60], [184, 320, 800, 80]]) {
  for (let x = west; x <= east; x += step) {
    const i = cityTrees.length;
    const properties = {};
    if (TREE_KINDS[i % TREE_KINDS.length]) properties.sp = TREE_KINDS[i % TREE_KINDS.length];
    if (TREE_TRUNKS[i % TREE_TRUNKS.length] !== null) properties.d = TREE_TRUNKS[i % TREE_TRUNKS.length];
    cityTrees.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: toLngLat([x, y]) } });
  }
}
const floodAreas = [
  [{ z: 1 }, box(640, -80, 820, 60)],
  [{ z: 1, fw: 1 }, box(820, -80, 850, 60)],
  [{ z: 2 }, box(640, 60, 850, 140)],
].map(([properties, geometry]) => ({ type: 'Feature', properties, geometry }));

// Public art (M3.2), made up and without random draws, as the pipeline publishes it (`art` in
// tiles/art.pmtiles, docs/CONTRACTS.md section 4): one record per source, each with only what its
// own source says, sharing the work's id (`g`), and the record that draws the work's dot marked
// `pr` (decision D1: OpenStreetMap's data never shares a record with another source's). A statue
// the City, OpenStreetMap and Wikidata all list (three records, a few steps apart); a mural and an
// untitled mural from OpenStreetMap; a mosaic from Wikidata; an installation inside a City building;
// and a memorial artwork in OpenStreetMap and Wikidata, whose records carry no title, artist or
// year (docs/ETHICS.md). Published as GeoJSON, as the pipeline does when it skips a tile file.
const ART_SAMPLES = [
  [[110, 100], { id: 'n9200001', g: 'pa9001', k: 2, src: 7, s: 2, pr: 1, nm: 'Sample Figure', ar: 'Avery Example', ty: 6,
    w: 'https://www.associationforpublicart.org/artwork/sample-figure/' }],
  [[114, 104], { id: 'pa9001', g: 'pa9001', k: 2, src: 7, s: 1, pa: 9001, doc: 'https://example.org/percent-for-art/9001.pdf',
    nm: 'Sample Figure', ar: 'Avery Example', y: 1976, ty: 5, md: 'Bronze' }],
  [[106, 97], { id: 'Q9200001', g: 'pa9001', k: 2, src: 7, s: 4, nm: 'Sample Figure', ar: 'Avery Example', y: 1976, ty: 6,
    wp: 'https://en.wikipedia.org/wiki/Sample_Figure' }],
  [[270, 100], { id: 'n9200002', g: 'n9200002', k: 1, src: 2, s: 2, pr: 1, nm: 'Sample Street Mural', ar: 'Jordan Painter', y: 2019, ty: 1 }],
  [[430, 100], { id: 'n9200003', g: 'n9200003', k: 1, src: 2, s: 2, pr: 1, ty: 1 }],
  [[600, 100], { id: 'Q9200004', g: 'Q9200004', k: 3, src: 4, s: 4, pr: 1, nm: 'Sample Mosaic Wall', y: 2005, ty: 4 }],
  [[720, 100], { id: 'pa9005', g: 'pa9005', k: 0, src: 1, s: 1, pr: 1, in: 1, pa: 9005, nm: 'Sample Light Work', ar: 'Casey Maker', y: 2015,
    ty: 9, lc: 'Sample Library (interior)' }],
  [[270, -20], { id: 'n9200006', g: 'Q9200006', k: 2, src: 6, s: 2, pr: 1, mem: 1 }],
  [[274, -16], { id: 'Q9200006', g: 'Q9200006', k: 2, src: 6, s: 4, mem: 1 }],
];
const artWorks = ART_SAMPLES.map(([xy, properties]) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: toLngLat(xy) } }));

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
const handWritten = [...kept('dossiers'), ...kept('dossiers/history'), ...kept('tables')];
rmSync(ROOT, { recursive: true, force: true });
for (const [name, bytes] of handWritten) {
  mkdirSync(new URL(name.slice(0, name.lastIndexOf('/') + 1), ROOT), { recursive: true });
  writeFileSync(new URL(name, ROOT), bytes);
}
// Shards are named by digits and listed in the manifest's dossiers block, not in files.
const shardFiles = handWritten.filter(([name]) => /^dossiers\/\d+\.json$/.test(name));
// So are the lot timeline's history shards, one beside each dossier shard (issue #38).
const historyFiles = handWritten.filter(([name]) => /^dossiers\/history\/\d+\.json$/.test(name));
mkdirSync(path('sources'), { recursive: true });
mkdirSync(path('data/tiles'), { recursive: true });
writeFileSync(path('sources/parcels.geojson'), collection(parcels));
// The light zoomed out form of the lots, as the pipeline builds it (docs/CONTRACTS.md section 4,
// pipeline/src/placekeepers/publish/tiles.py): one point on each parcel, without the properties
// only the lot page uses, marked `lo`. Below zoom 13 the tiles hold a sample of these points.
const LOW_ZOOM_LEFT_OUT = new Set(['rs', 'n', 'dy', 'sy', 'ny']);
const lowZoomParcels = parcels.map((f) => {
  const ring = f.geometry.coordinates[0].slice(0, -1);
  const middle = [round6(ring.reduce((a, p) => a + p[0], 0) / ring.length), round6(ring.reduce((a, p) => a + p[1], 0) / ring.length)];
  const properties = Object.fromEntries(Object.entries(f.properties).filter(([key]) => !LOW_ZOOM_LEFT_OUT.has(key)));
  return { type: 'Feature', properties: { ...properties, lo: 1 }, geometry: { type: 'Point', coordinates: middle } };
});
writeFileSync(path('sources/parcels.lowzoom.geojson'), collection(lowZoomParcels));
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
writeFileSync(path('data/tiles/transit.stops.geojson'), collection(transitStops));
writeFileSync(path('data/tiles/transit.routes.geojson'), collection(transitRoutes));
writeFileSync(path('data/tiles/amenities.stops.geojson'), collection(amenityStops));
writeFileSync(path('data/tiles/environment.heat_tracts.geojson'), collection(heatTracts));
writeFileSync(path('data/tiles/environment.floodplain.geojson'), collection(floodAreas));
writeFileSync(path('data/tiles/trees.trees.geojson'), collection(cityTrees));
// Amenities from OpenStreetMap, public places from the City and conditions reported to 311 (M3.5,
// scripts/amenity-fixtures.mjs).
for (const [name, text] of amenityFixtures(toLngLat)) writeFileSync(path(`data/${name}`), text);
writeFileSync(path('data/tiles/art.art.geojson'), collection(artWorks));
// Walkability by block group, people and places within walking distance, and traffic stress for
// people on bikes (M3.3, scripts/walk-fixtures.mjs).
for (const [name, text] of walkFixtures(toLngLat)) writeFileSync(path(`data/${name}`), text);
// Parking problems reported with Laser Vision, counted per block sized cell (issue #37,
// scripts/parking-fixtures.mjs).
for (const [name, text] of parkingFixtures(toLngLat)) writeFileSync(path(`data/${name}`), text);
// The displacement watch (M4.1, scripts/displacement-fixtures.mjs).
const [watchFile, watchText] = watchFixtures(box);
writeFileSync(path(`data/${watchFile}`), watchText);
// The route survey sheets (scripts/route-fixtures.mjs): the index is listed in files, each route's
// sheet is not (docs/CONTRACTS.md section 7).
mkdirSync(path('data/tables/routes'), { recursive: true });
for (const [name, text] of routeSheetFixtures(toLngLat)) writeFileSync(path(`data/${name}`), text);
writeFileSync(path('data/tables/stop_amenities.json'), JSON.stringify(stopTable) + '\n');

// Run from the fixtures folder with relative paths, because tippecanoe records its command
// line in the file's metadata and local folder names do not belong in committed files.
const tippecanoe = (out, layer, input, name, extra) =>
  execFileSync(
    'tippecanoe',
    ['-q', '-f', '-o', out, '-l', layer, '-n', name, '-N', 'Synthetic test data for Placekeepers', '--no-feature-limit', '--no-tile-size-limit', ...extra, input],
    { stdio: 'inherit', cwd: FIXTURES.pathname },
  );
// Lots: the shapes from zoom 13, the light points below it, thinned at tippecanoe's usual rate (about
// 40 percent kept at zoom 12, 16 at 11 and 6 at 10), with the pipeline's feature filter.
execFileSync(
  'tippecanoe',
  [
    '-q', '-f', '-o', 'data/tiles/lots.pmtiles', '-n', 'Sample parcels', '-N', 'Synthetic test data for Placekeepers',
    '--no-feature-limit', '--no-tile-size-limit', '-Z', '10', '-z', '16', '--base-zoom=13', '--no-tiny-polygon-reduction',
    '--feature-filter', JSON.stringify({ parcels: ['any', ['all', ['<', '$zoom', 13], ['has', 'lo']], ['all', ['>=', '$zoom', 13], ['!has', 'lo']]] }),
    '-L', 'parcels:sources/parcels.geojson', '-L', 'parcels:sources/parcels.lowzoom.geojson',
  ],
  { stdio: 'inherit', cwd: FIXTURES.pathname },
);
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
    // The owner type, and the lots listed as available (issue #36): the records carry no dates.
    city_owned_property: ok(7740, null),
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
    osm_philadelphia: ok(3338, '2026-10-03'),
    // Heat, trees and the floodplain (M3.1); heat_vulnerability is listed with M2.3's sources below
    street_trees: ok(151726, '2025-11-20'),
    fema_floodplain: ok(883, null),
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
    septa_gtfs: ok(13827, '2026-09-25'),
    septa_ridership_bus: ok(18201, '2026-08-20'),
    septa_ridership_trolley: ok(719, '2026-08-20'),
    tree_canopy_2018: ok(17204, null),
    census_tracts_2020: ok(408, null),
    land_use: ok(560515, null),
    heat_vulnerability: ok(384, null),
    ...Object.fromEntries(Object.entries(AMENITY_SOURCES).map(([id, [rows, newest]]) => [id, ok(rows, newest)])),
    // Public art (M3.2); OpenStreetMap's artworks come with osm_philadelphia
    percent_for_art: ok(239, '2025-08-19'),
    wikidata_art: ok(72, null),
    // The placemaking lens's commercial corridors (M3.4)
    commercial_corridors: ok(279, null),
    ...Object.fromEntries(Object.entries(WALK_SOURCES).map(([id, [rows, newest]]) => [id, ok(rows, newest)])),
    ...Object.fromEntries(Object.entries(PARKING_SOURCES).map(([id, [rows, newest]]) => [id, ok(rows, newest)])),
    // The displacement watch (M4.1)
    ...Object.fromEntries(Object.entries(WATCH_SOURCES).map(([id, [rows, newest]]) => [id, ok(rows, newest)])),
    // Then and now (M4.3): the weekly check that the City's picture services answer
    ...Object.fromEntries(Object.entries(HISTORIC_SOURCES).map(([id, [rows, newest]]) => [id, ok(rows, newest)])),
  },
  layers: {
    vacant_parcels: {
      file: 'tiles/lots.pmtiles',
      source_layer: 'parcels',
      sources: ['vacant_indicators_land', 'vacant_indicators_bldg', 'opa_properties', 'pwd_parcels', 'city_owned_property'],
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
    stop_amenities: { file: 'tiles/amenities.pmtiles', source_layer: 'stops', sources: ['osm_philadelphia'] },
    heat_tracts: { file: 'tiles/environment.pmtiles', source_layer: 'heat_tracts', sources: ['heat_vulnerability'] },
    city_trees: { file: 'tiles/trees.pmtiles', source_layer: 'trees', sources: ['street_trees'] },
    floodplain: { file: 'tiles/environment.pmtiles', source_layer: 'floodplain', sources: ['fema_floodplain'] },
    basemap: { file: 'basemap/philly.pmtiles', source_layer: 'earth', sources: ['basemap_openstreetmap'] },
    transit_stops: {
      file: 'tiles/transit.pmtiles',
      source_layer: 'stops',
      sources: [
        'septa_gtfs',
        'septa_ridership_bus',
        'septa_ridership_trolley',
        'osm_philadelphia',
        'tree_canopy_2018',
        'census_tracts_2020',
        'land_use',
        'heat_vulnerability',
        'high_injury_network',
      ],
    },
    transit_routes: { file: 'tiles/transit.pmtiles', source_layer: 'routes', sources: ['septa_gtfs'] },
    ...AMENITY_LAYERS,
    public_art: { file: 'tiles/art.pmtiles', source_layer: 'art', sources: ['percent_for_art', 'osm_philadelphia', 'wikidata_art'] },
    ...WALK_LAYERS,
    ...PARKING_LAYERS,
    ...WATCH_LAYER,
    ...HISTORIC_LAYERS,
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
      'tiles/transit.routes.geojson',
      'tiles/transit.stops.geojson',
      'tiles/amenities.stops.geojson',
      'tiles/environment.heat_tracts.geojson',
      'tiles/environment.floodplain.geojson',
      'tiles/trees.trees.geojson',
      ...amenityFixtures(toLngLat).map(([name]) => name),
      'tiles/art.art.geojson',
      ...walkFixtures(toLngLat).map(([name]) => name),
      ...parkingFixtures(toLngLat).map(([name]) => name),
      watchFile,
      'tables/routes/index.json',
      'tables/stop_amenities.json',
      ...handWritten
        .map(([name]) => name)
        .filter((name) => ![...shardFiles, ...historyFiles].some(([shard]) => shard === name)),
    ].map((p) => [p, fileInfo(p)]),
  ),
  dossiers: shardFiles.length
    ? {
        prefix_digits: 4,
        prefixes: shardFiles.map(([name]) => name.slice('dossiers/'.length, -'.json'.length)),
        files: shardFiles.length,
        bytes: shardFiles.reduce((sum, [, bytes]) => sum + bytes.length, 0),
        history: historyFiles.length
          ? { files: historyFiles.length, bytes: historyFiles.reduce((sum, [, bytes]) => sum + bytes.length, 0), parts: ['li'] }
          : null,
      }
    : null,
  displacement: WATCH_BLOCK,
  notes: [
    'This is synthetic sample data for testing the map.',
    'Street, boundary, transit, amenity, heat, tree and floodplain tiles were skipped for this sample, so those layers are published as GeoJSON.',
    'Public art tiles were skipped for this sample too, so its layer is published as GeoJSON.',
    'Walking tiles were skipped for this sample too, so those layers are published as GeoJSON.',
    'Parking report tiles were skipped for this sample too, so that layer is published as GeoJSON.',
    'Displacement watch tiles were skipped for this sample too, so its layer is published as GeoJSON.',
  ],
};
writeFileSync(new URL('manifest.json', ROOT), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `Wrote ${parcels.length} parcels, ${cells.length} cells, ${lines.length} lines, ${landcareLots.length} LandCare lots, ` +
    `${gardenPoints.length} gardens, ${councilDistricts.length + communityOrganizations.length + neighborhoods.length} boundaries, ` +
    `${segments.length} blocks, ${crashes.length} crashes, ${memorials.length} memorials, ${transitStops.length} stops, ` +
    `${transitRoutes.length} routes and ${amenityStops.length} stops with shelter and bench answers to ${ROOT.pathname}`,
);
