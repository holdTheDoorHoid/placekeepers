// The displacement watch of the sample data root (M4.1): two made up watch areas over the eastern
// sample lots, fixed by hand (no random draws, so every other fixture stays the same), with the
// properties of docs/CONTRACTS.md section 4 (`watch` in tiles/displacement.pmtiles), and the
// manifest's `displacement` block (section 3). Published as GeoJSON, as the pipeline does when it
// skips a tile file. The lots inside an area carry its signs as `dw` (make-fixtures.mjs), and the
// hand written dossier shard carries the same as `displacement`.
//
// Signs, as bits: 1 sale prices, 2 company buyers, 4 assessed values, 8 renters, 16 the Market
// Value Analysis.

/** [west, east] in meters from the sample origin, the area's tile properties. */
export const WATCH_AREAS = [
  [
    [300, 650],
    { id: '42101900200', w: 7, nm: 'Sample Heights', n0: 212, n1: 158, p0: 61000, p1: 112000, pc: 84, cb: 46, ah: 1450, ac: 131, oc: 1830, rp: 52, mb: 3, mr: 0 },
  ],
  [
    [650, 1050],
    { id: '42101900300', w: 28, nm: 'Sample Park', n0: 31, n1: 24, ah: 640, ac: 112, oc: 950, rp: 71, mb: 2, mr: 1 },
  ],
];

/** The signs of the watch area at x meters east of the origin, or null outside every area. */
export function watchFor(x) {
  const found = WATCH_AREAS.find(([[west, east]]) => x >= west && x < east);
  return found ? found[1].w : null;
}

/** The watch areas as one GeoJSON file, [path under the data root, text]. */
export function watchFixtures(box) {
  const features = WATCH_AREAS.map(([[west, east], properties]) => ({ type: 'Feature', properties, geometry: box(west, -150, east, 420) }));
  return ['tiles/displacement.watch.geojson', JSON.stringify({ type: 'FeatureCollection', features }) + '\n'];
}

/** Rows and newest record of each source the watch reads, for the manifest. */
export const WATCH_SOURCES = {
  real_estate_sales: [272801, '2026-09-02'],
  assessment_values: [1159065, null],
  acs_tenure: [408, null],
  market_value_analysis: [1338, null],
};

export const WATCH_LAYER = {
  displacement_watch: {
    file: 'tiles/displacement.pmtiles',
    source_layer: 'watch',
    sources: ['real_estate_sales', 'assessment_values', 'acs_tenure', 'market_value_analysis', 'opa_properties', 'census_tracts_2020'],
  },
};

/** The manifest's `displacement` block, as the pipeline writes it (numbers made up). */
export const WATCH_BLOCK = {
  as_of: '2026-10-04',
  periods: { earlier_from: '2018-09-03', earlier_to: '2021-09-02', recent_from: '2023-09-03', recent_to: '2026-09-02' },
  assessment_years: [2022, 2027],
  survey_years: [2020, 2024],
  mva: 'Market Value Analysis 2026',
  city: { p0: 180000, p1: 230000, pc: 28, cb: 27, ac: 69, rp: 48 },
  thresholds: {
    price_points: 25,
    company_points: 15,
    assessment_points: 30,
    renter_pct: 60,
    min_sales: 50,
    min_assessed: 50,
    min_occupied: 100,
    min_signs: 2,
    recent_years: 3,
    gap_years: 5,
  },
  areas: { tracts: 408, watch: 2 },
};
