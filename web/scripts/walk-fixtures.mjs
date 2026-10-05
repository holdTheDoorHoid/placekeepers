// The walking, cycling and people layers of the sample data root (M3.3): made up and fixed by
// hand around the sample streets of make-fixtures.mjs (no random draws, so every other fixture
// stays the same), with the short properties of docs/CONTRACTS.md section 4. Published as GeoJSON,
// as the pipeline does when it skips a tile file:
//   * walk.block_groups: four block groups across the sample area, from least to most walkable;
//   * walk.cells: the hexagons (H3 resolution 9) around the sample lots;
//   * cycling.stress: the sample streets, one of each level of traffic stress, and a trail.
// make-fixtures.mjs writes them; run this file alone to write only them (needs h3-js):
//   npm install --no-save h3-js@4 && node scripts/walk-fixtures.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { cellToBoundary, gridDisk, latLngToCell } from 'h3-js';

const collection = (features) => JSON.stringify({ type: 'FeatureCollection', features }) + '\n';

/** Block groups: [west, south, east, north] in meters from the sample origin, and properties. */
const BLOCK_GROUPS = [
  [[-200, -150, 150, 420], { id: '421019001001', w: 8.3, nw: 2, rc: 6, rt: 9, rj: 4, rh: 7, qw: 1, qc: 1, qt: 2, qm: 1 }],
  [[150, -150, 450, 420], { id: '421019001002', w: 13.2, nw: 3, rc: 15, rt: 18, rj: 8, rh: 10, qw: 2, qc: 3, qt: 3, qm: 2 }],
  [[450, -150, 750, 420], { id: '421019002001', w: 15.8, nw: 4, rc: 18, rt: 19, rj: 12, rh: 13, qw: 4, qc: 4, qt: 4, qm: 4 }],
  [[750, -150, 1050, 420], { id: '421019002002', w: 18.7, nw: 4, rc: 20, rt: 20, rj: 17, rh: 16, qw: 5, qc: 5, qt: 5, qm: 5 }],
];

/** Traffic stress on the sample streets: [[x, y], ...] in meters, and properties. */
const STREETS = [
  [[[0, -60], [800, -60]], { id: 9101, l: 3, l2: 2, bf: 3, sp: 30, ln: 2 }],
  [[[0, 60], [800, 60]], { id: 9102, l: 1, sp: 25, ln: 2 }],
  [[[0, 180], [800, 180]], { id: 9103, l: 2, sp: 25, ln: 2 }],
  [[[160, -60], [160, 180]], { id: 9104, l: 4, sp: 35, ln: 4 }],
  [[[640, -60], [640, 180]], { id: 9105, l: 1, bf: 6, ln: 2 }],
];

/** What lies within a short walk of each sample hexagon's middle, from its ring around the
 * middle of the sample: the inner hexagons have the most people, places and corners. */
function cellProperties(cell, ring, index) {
  const people = [5200, 3100, 900][ring];
  const kinds = [7, 6, 3][ring];
  const bits = [127, 126, 98][ring];
  const corners = [62, 40, 12][ring];
  const rank = [90, 60, 20][ring];
  return {
    h: cell,
    p: people + index * 37,
    d: kinds,
    dk: bits,
    k: corners + (index % 4),
    f_walk: rank,
    f_neighbors: Math.min(100, rank + (index % 5)),
    f_dest: rank,
    f_corners: rank,
  };
}

export const WALK_FILES = ['tiles/walk.block_groups.geojson', 'tiles/walk.cells.geojson', 'tiles/cycling.stress.geojson'];

/** [file under the data root, its text], for each walking file, placed with `toLngLat`. */
export function walkFixtures(toLngLat) {
  const box = ([west, south, east, north]) => ({
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]].map(toLngLat)],
  });
  const groups = BLOCK_GROUPS.map(([bounds, properties]) => ({ type: 'Feature', properties, geometry: box(bounds) }));
  const [lng, lat] = toLngLat([400, 60]);
  const middle = latLngToCell(lat, lng, 9);
  const rings = [[middle], gridDisk(middle, 1).filter((c) => c !== middle), gridDisk(middle, 2).filter((c) => !gridDisk(middle, 1).includes(c))];
  const cells = rings.flatMap((cellsOfRing, ring) =>
    [...cellsOfRing].sort().map((cell, index) => {
      const outline = cellToBoundary(cell).map(([cellLat, cellLng]) => [Math.round(cellLng * 1e7) / 1e7, Math.round(cellLat * 1e7) / 1e7]);
      return { type: 'Feature', properties: cellProperties(cell, ring, index), geometry: { type: 'Polygon', coordinates: [[...outline, outline[0]]] } };
    }),
  );
  const streets = STREETS.map(([line, properties]) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: line.map(toLngLat) } }));
  return [
    ['tiles/walk.block_groups.geojson', collection(groups)],
    ['tiles/walk.cells.geojson', collection(cells)],
    ['tiles/cycling.stress.geojson', collection(streets)],
  ];
}

/** The manifest entries of the walking sources: [rows, newest record]. */
export const WALK_SOURCES = {
  epa_walkability: [1336, null],
  census_blocks_2020: [17554, null],
  dvrpc_lts: [60867, null],
  snap_retailers: [1460, '2026-09-17'],
};
export const WALK_LAYERS = {
  walkability: { file: 'tiles/walk.pmtiles', source_layer: 'block_groups', sources: ['epa_walkability'] },
  walking_distance: {
    file: 'tiles/walk.pmtiles',
    source_layer: 'cells',
    sources: [
      'census_blocks_2020',
      'street_centerlines',
      'library_locations',
      'ppr_program_sites',
      'ppr_swimming_pools',
      'ppr_spraygrounds',
      'ppr_hydration_stations',
      'schools',
      'snap_retailers',
      'septa_gtfs',
      'census_tracts_2020',
      'land_use',
    ],
  },
  traffic_stress: { file: 'tiles/cycling.pmtiles', source_layer: 'stress', sources: ['dvrpc_lts'] },
};

// Run alone: write the files into fixtures/data/ with the same placement as make-fixtures.mjs.
if (import.meta.url === `file://${process.argv[1]}`) {
  const LAT0 = 39.985;
  const LNG0 = -75.158;
  const M_PER_DEG_LAT = 111_320;
  const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
  const round6 = (n) => Math.round(n * 1e6) / 1e6;
  const toLngLat = ([x, y]) => [round6(LNG0 + x / M_PER_DEG_LNG), round6(LAT0 + y / M_PER_DEG_LAT)];
  const root = new URL('../fixtures/data/', import.meta.url);
  mkdirSync(new URL('tiles/', root), { recursive: true });
  for (const [name, text] of walkFixtures(toLngLat)) writeFileSync(new URL(name, root), text);
  console.log(`Wrote ${WALK_FILES.length} walking sample files to ${root.pathname}tiles/`);
}
