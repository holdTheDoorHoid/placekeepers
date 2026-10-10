// Streets and stops (M4.5) in the sample data root: the City's bus shelters, street poles, traffic
// calming devices and school crossing guard posts, made up and fixed by hand along the sample
// streets of make-fixtures.mjs (no random draws, so every other fixture stays the same), with the
// short properties of docs/CONTRACTS.md section 4. Published as GeoJSON, as the pipeline does when
// it skips a tile file. make-fixtures.mjs writes them and adds the counts per block to the sample
// street blocks, memorials and 311 street light blocks with the functions below.

/** [file under the data root, [[x, y] in meters from the sample origin, properties], ...]. */
const SAMPLES = [
  [
    'tiles/transit.shelters.geojson',
    [
      // At the sheltered sample stop sp1003, where OpenStreetMap agrees.
      [[484, 184], { id: 'pa-9001', nm: 'Sample 3 St & Sample 5 Ave', sid: '1003', st: 'sp1003', m: 1 }],
      // Two at sp1009, where OpenStreetMap says there is none: the two disagree.
      [[398, 64], { id: 'pa-9002', nm: 'Sample 2 St & Sample 5 Ave (far side)', sid: '1009-a', st: 'sp1009', m: 1, dg: 1 }],
      [[404, 64], { id: 'pa-9003', nm: 'Sample 2 St & Sample 5 Ave (far side)', sid: '1009-b', st: 'sp1009', m: 1 }],
      // One that matches no stop.
      [[720, -66], { id: 'pa-9004', nm: 'Sample 1 St & Sample 9 Ave, southwest corner', sid: 'NJT4' }],
    ],
  ],
  [
    'tiles/poles.poles.geojson',
    [
      [[100, 66], { k: 1, id: 7001, o: 1 }],
      [[200, 66], { k: 1, id: 7002, o: 1 }],
      [[250, 54], { k: 2, id: 7003, o: 1 }],
      [[300, 66], { k: 3, id: 7004, o: 1 }],
      [[350, 54], { k: 0, id: 7005, o: 2 }],
      [[420, 66], { k: 1, id: 7006, o: 1 }],
      [[166, 120], { k: 0, id: 7007, o: 1 }],
      [[166, 20], { k: 1, o: 3 }],
    ],
  ],
  [
    'tiles/streets.calming.geojson',
    [
      [[530, -58], { id: 1, d: '2023-08-01', p: 'SC-9001', s: 900004, name: 'SAMPLE 4 ST' }],
      [[590, -58], { id: 2, d: '2024-06-15', p: 'SC-9001', s: 900004, name: 'SAMPLE 4 ST' }],
    ],
  ],
  [
    'tiles/streets.guards.geojson',
    [
      [[320, -60], { id: 1, pl: 'Sample 3 & Sample 4', sn: 'Sample Elementary School' }],
      [[480, 180], { id: 2, pl: 'Sample 3 & Sample 5' }],
    ],
  ],
];

export function streetsStopsFixtures(toLngLat) {
  return SAMPLES.map(([file, points]) => [
    file,
    JSON.stringify({
      type: 'FeatureCollection',
      features: points.map(([xy, properties]) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: toLngLat(xy) } })),
    }) + '\n',
  ]);
}

/** The poles the City lists along each sample block (`pl`, `lp`, `le`), fixed from its id. */
export function blockPoles(id) {
  const poles = (id % 5) + 2;
  const lamps = Math.max(0, poles - (id % 3));
  return lamps ? { pl: poles, lp: lamps, le: lamps - (id % 2) } : { pl: poles };
}

/** Traffic calming on the sample blocks (`tc`, `ty`): two devices on SAMPLE 4 ST since 2023. */
export const BLOCK_CALMING = { 900004: { tc: 2, ty: 2023 } };

/** What the City lists on the block of each sample memorial with the traffic calming request. */
export const MEMORIAL_CALMING = { fc20260820_1000: { tc: 0 }, fc20240302_1002: { tc: 1, ty: 2024 } };

/** The poles the City lists along the sample 311 street light block. */
export const LIGHTS_POLES = { 9011: { pl: 4, lp: 3, le: 2 } };

/** The new sources' statuses and the new layers, for the sample manifest. */
export const STREETS_STOPS_SOURCES = {
  bus_shelters: [487, null],
  street_poles: [203096, null],
  traffic_calming: [1780, null],
  crossing_guards: [758, null],
};
export const STREETS_STOPS_LAYERS = {
  city_shelters: { file: 'tiles/transit.pmtiles', source_layer: 'shelters', sources: ['bus_shelters', 'septa_gtfs'] },
  street_poles: { file: 'tiles/poles.pmtiles', source_layer: 'poles', sources: ['street_poles'] },
  traffic_calming: { file: 'tiles/streets.pmtiles', source_layer: 'calming', sources: ['traffic_calming', 'street_centerlines'] },
  crossing_guards: { file: 'tiles/streets.pmtiles', source_layer: 'guards', sources: ['crossing_guards', 'schools'] },
};
