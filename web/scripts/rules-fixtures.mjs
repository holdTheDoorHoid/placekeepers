// The rules and records layers of the sample data root (M4.6, issue #42): a made up historic
// district and one property on the Register around the first sample run of lots, three zoning
// overlays (one covering everything, as /NIS covers most of the city), two hearings still to come
// and one EPA brownfield site, fixed by hand (no random draws, so every other fixture stays the
// same), with the short properties of docs/CONTRACTS.md section 4 (tiles/rules.pmtiles).
// Published as GeoJSON, as the pipeline does when it skips a tile file. A hearing never carries a
// name. The hand written dossier shard (data/dossiers/9900.json) and data/dossiers/common.json
// carry the same rules for the sample lot pages, with the same overlay keys.
//
// The hearings are set far in the future on purpose, so the sample lot page keeps a hearing "still
// to come" whatever day the tests run.
//
// make-fixtures.mjs writes them; run this file alone to write only them:
//   node scripts/rules-fixtures.mjs

import { mkdirSync, writeFileSync } from 'node:fs';

const collection = (features) => JSON.stringify({ type: 'FeatureCollection', features }) + '\n';

/** The overlay keys, as the pipeline makes them (`o` and 8 hexadecimal digits of a hash). */
export const OVERLAY_KEYS = { nco: 'oe0618f38', nis: 'o878f2af2', flood: 'of938179f' };

const CODE = 'https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/';

export const RULES_FILES = [
  'tiles/rules.historic_districts.geojson',
  'tiles/rules.historic_sites.geojson',
  'tiles/rules.overlays.geojson',
  'tiles/rules.hearings.geojson',
  'tiles/rules.brownfields.geojson',
];

/** [file under the data root, its text] for each layer, placed with `toLngLat` and `box` (meters from the sample origin). */
export function rulesFixtures(toLngLat, box) {
  const point = (xy) => ({ type: 'Point', coordinates: toLngLat(xy) });
  const feature = (properties, geometry) => ({ type: 'Feature', properties, geometry });
  return [
    [RULES_FILES[0], collection([feature({ id: 'sample_square_historic_district', nm: 'Sample Square Historic District', dd: '1999-03-10' }, box(0, -20, 120, 80))])],
    [RULES_FILES[1], collection([feature({ ad: '1201 N SAMPLE ST', dn: 'Sample Square Historic District', dd: '1999-03-10' }, box(31, 17, 36, 42))])],
    [
      RULES_FILES[2],
      collection([
        feature(
          { id: OVERLAY_KEYS.nis, nm: '/NIS Narcotics Injection Sites Overlay District', sy: '/NIS', t: 1, cs: '14-540', cl: `${CODE}0-0-0-305352` },
          box(-150, -150, 1050, 450),
        ),
        feature(
          { id: OVERLAY_KEYS.nco, nm: '/NCO Neighborhood Conservation Overlay District - Sample Area', sy: '/NCO', t: 1, cs: '14-504(5)', cl: `${CODE}0-0-0-290619` },
          box(-20, -30, 420, 200),
        ),
        feature(
          { id: OVERLAY_KEYS.flood, nm: 'Open Space and Natural Resources - Flood Protection - Within the Special Flood Hazard Area', t: 2, cs: '14-704(4)(c)(.2)', cl: `${CODE}0-0-0-293399` },
          box(660, -30, 900, 60),
        ),
      ]),
    ],
    [
      RULES_FILES[3],
      collection([
        feature(
          { id: '990000005', d: '2030-11-06', tm: '09:30', b: 1, ty: 'ZBA Permit Denial - Variance', ad: '1305 N EXAMPLE AVE', rco: 'Sample Neighbors Association' },
          point([194, 14]),
        ),
        feature({ d: '2030-10-23', tm: '12:30', b: 2, ty: 'LIRB Violation Appeal', ad: '1400 N SAMPLE ST' }, point([520, 100])),
      ]),
    ],
    [RULES_FILES[4], collection([feature({ id: '110000000001', nm: 'FORMER SAMPLE WORKS', ad: '1200 N SAMPLE ST' }, point([40, 60]))])],
  ];
}

/** Rows and newest record of each source, for the manifest. */
export const RULES_SOURCES = {
  historic_districts: [45, null],
  historic_sites: [14980, null],
  zoning_overlays: [196, null],
  zoning_base_districts: [27706, null],
  appeals: [44739, '2026-10-06'],
  epa_brownfields: [351, null],
};

export const RULES_LAYERS = {
  historic_districts: { file: 'tiles/rules.pmtiles', source_layer: 'historic_districts', sources: ['historic_districts'] },
  historic_properties: { file: 'tiles/rules.pmtiles', source_layer: 'historic_sites', sources: ['historic_sites'] },
  zoning_overlays: { file: 'tiles/rules.pmtiles', source_layer: 'overlays', sources: ['zoning_overlays'] },
  hearings: { file: 'tiles/rules.pmtiles', source_layer: 'hearings', sources: ['appeals'] },
  brownfields: { file: 'tiles/rules.pmtiles', source_layer: 'brownfields', sources: ['epa_brownfields'] },
};

// Run alone: write the files into fixtures/data/ with the same placement as make-fixtures.mjs.
if (import.meta.url === `file://${process.argv[1]}`) {
  const LAT0 = 39.985;
  const LNG0 = -75.158;
  const M_PER_DEG_LAT = 111_320;
  const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
  const round6 = (n) => Math.round(n * 1e6) / 1e6;
  const toLngLat = ([x, y]) => [round6(LNG0 + x / M_PER_DEG_LNG), round6(LAT0 + y / M_PER_DEG_LAT)];
  const box = (west, south, east, north) => ({
    type: 'Polygon',
    coordinates: [[toLngLat([west, south]), toLngLat([east, south]), toLngLat([east, north]), toLngLat([west, north]), toLngLat([west, south])]],
  });
  const root = new URL('../fixtures/data/', import.meta.url);
  mkdirSync(new URL('tiles/', root), { recursive: true });
  for (const [name, text] of rulesFixtures(toLngLat, box)) writeFileSync(new URL(name, root), text);
  console.log(`Wrote ${RULES_FILES.length} rules sample files to ${root.pathname}tiles/`);
}
