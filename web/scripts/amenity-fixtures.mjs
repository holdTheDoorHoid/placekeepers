// The amenity, public place and 311 condition layers of the sample data root (M3.5): made up and
// fixed by hand along the sample streets of make-fixtures.mjs (no random draws, so every other
// fixture stays the same), with the short properties of docs/CONTRACTS.md section 4. Published as
// GeoJSON, as the pipeline does when it skips a tile file. The layers on by default in the field
// view (drinking water, toilets, park drinking fountains) stand south and north of the sample lots,
// so they never sit where the tests tap a lot, and the 311 blocks are blocks without a sample
// memorial, so a tap finds the block. make-fixtures.mjs writes them; run this file alone
// to write only them:
//   node scripts/amenity-fixtures.mjs

import { mkdirSync, writeFileSync } from 'node:fs';

/** [file under the data root, [[x, y] in meters from the sample origin, properties], ...]. */
const SAMPLES = [
  [
    'tiles/amenities.benches.geojson',
    [
      [[230, -20], { id: 'n9100001', br: 1 }],
      [[330, -20], { id: 'n9100002', br: 0, cv: 1 }],
      [[100, 192], { id: 'w9100003' }],
    ],
  ],
  ['tiles/amenities.picnic_tables.geojson', [[[600, -30], { id: 'n9100011', cv: 0 }]]],
  ['tiles/amenities.water.geojson', [[[250, -40], { id: 'n9100021', bt: 1, sn: 1 }]]],
  [
    'tiles/amenities.toilets.geojson',
    [
      [[420, -40], { id: 'n9100031', ac: 1, fee: 0, wc: 1, oh: 'Mo-Su 08:00-20:00', nm: 'Sample Park toilets' }],
      [[700, -40], { id: 'n9100032', ac: 2 }],
    ],
  ],
  ['tiles/amenities.bookcases.geojson', [[[520, 192], { id: 'n9100041', nm: 'Sample Little Free Library' }]]],
  [
    'tiles/places.park_water.geojson',
    [
      [[80, -45], { id: 'water1', nm: 'Sample Recreation Center', k: 1, in: 0 }],
      [[760, 196], { id: 'water2', nm: 'Sample Playground', pk: 'Sample Park', k: 2, in: 1 }],
    ],
  ],
  [
    'tiles/places.libraries.geojson',
    [
      [
        [300, 205],
        {
          id: 'lib1',
          nm: 'Sample Library',
          ad: '1 Sample Street',
          zip: '19133',
          ph: '215-555-0100',
          url: 'https://libwww.freelibrary.org/locations/sample-library',
        },
      ],
    ],
  ],
  [
    'tiles/places.recreation.geojson',
    [
      [[460, 205], { id: 'rec1', nm: 'Sample Recreation Center', k: 1, bd: 1, gym: 1 }],
      [[620, 205], { id: 'rec2', nm: 'Sample Older Adult Center', k: 2, bd: 1, gym: 0 }],
    ],
  ],
  [
    'tiles/places.pools.geojson',
    [
      [[380, 212], { id: 'pool1', nm: 'Sample Pool', k: 1, st: 1, in: 0, ada: 1, ad: '2 SAMPLE ST', op: '2026-06-24' }],
      [[540, 212], { id: 'spray1', nm: 'Sample Playground', k: 2, st: 1 }],
      [[700, 212], { id: 'spray2', nm: 'Sample Square', k: 3, st: 0 }],
    ],
  ],
  [
    'tiles/conditions.dumping.geojson',
    [
      [[400, -60], { id: 9001, name: 'SAMPLE 3 ST', n: 3, o: 1, d: '2026-10-01' }],
      [[240, 180], { id: 9002, name: 'SAMPLE 12 ST', n: 1, o: 0, d: '2026-08-15' }],
      [[720, 60], { id: 9003, name: 'SAMPLE 10 ST', n: 5, o: 2, d: '2026-09-28' }],
    ],
  ],
  ['tiles/conditions.lights.geojson', [[[160, 0], { id: 9011, name: 'N BROAD ST', n: 2, o: 2, d: '2026-09-30', a: 1 }]]],
  ['tiles/conditions.graffiti.geojson', [[[560, 180], { id: 9021, name: 'SAMPLE 14 ST', n: 1, o: 0, d: '2026-09-02' }]]],
];

/** The files as [path under the data root, GeoJSON text]. */
export function amenityFixtures(toLngLat) {
  return SAMPLES.map(([file, points]) => [
    file,
    JSON.stringify({
      type: 'FeatureCollection',
      features: points.map(([xy, properties]) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: toLngLat(xy) } })),
    }) + '\n',
  ]);
}

/** The new sources' statuses and the new layers, for the sample manifest. */
export const AMENITY_SOURCES = {
  library_locations: [54, null],
  ppr_program_sites: [168, null],
  ppr_swimming_pools: [72, null],
  ppr_spraygrounds: [114, null],
  ppr_hydration_stations: [147, null],
  philly311_conditions: [6496, '2026-10-02'],
};
export const AMENITY_LAYERS = {
  benches: { file: 'tiles/amenities.pmtiles', source_layer: 'benches', sources: ['osm_philadelphia'] },
  picnic_tables: { file: 'tiles/amenities.pmtiles', source_layer: 'picnic_tables', sources: ['osm_philadelphia'] },
  drinking_water: { file: 'tiles/amenities.pmtiles', source_layer: 'water', sources: ['osm_philadelphia'] },
  toilets: { file: 'tiles/amenities.pmtiles', source_layer: 'toilets', sources: ['osm_philadelphia'] },
  bookcases: { file: 'tiles/amenities.pmtiles', source_layer: 'bookcases', sources: ['osm_philadelphia'] },
  park_water: { file: 'tiles/places.pmtiles', source_layer: 'park_water', sources: ['ppr_hydration_stations'] },
  libraries: { file: 'tiles/places.pmtiles', source_layer: 'libraries', sources: ['library_locations'] },
  recreation_centers: { file: 'tiles/places.pmtiles', source_layer: 'recreation', sources: ['ppr_program_sites'] },
  pools: { file: 'tiles/places.pmtiles', source_layer: 'pools', sources: ['ppr_swimming_pools', 'ppr_spraygrounds'] },
  dumping: { file: 'tiles/conditions.pmtiles', source_layer: 'dumping', sources: ['philly311_conditions', 'street_centerlines'] },
  dark_lights: { file: 'tiles/conditions.pmtiles', source_layer: 'lights', sources: ['philly311_conditions', 'street_centerlines'] },
  graffiti: { file: 'tiles/conditions.pmtiles', source_layer: 'graffiti', sources: ['philly311_conditions', 'street_centerlines'] },
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
  for (const [name, text] of amenityFixtures(toLngLat)) writeFileSync(new URL(name, root), text);
  console.log(`Wrote ${SAMPLES.length} amenity, public place and condition sample files to ${root.pathname}tiles/`);
}
