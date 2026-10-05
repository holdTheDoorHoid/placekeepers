// The route survey sheets of the sample data root (M2.4): tables/routes/index.json and one file
// per route (docs/CONTRACTS.md section 7), made up and fixed by hand, along the sample streets of
// make-fixtures.mjs. They cover every thing a stop can show (a shelter, a bench only, neither, not
// yet surveyed, not found in OpenStreetMap), a direction with stops outside the city, and a
// trolley route. make-fixtures.mjs writes them; run this file alone to write only them:
//   node scripts/route-fixtures.mjs

import { mkdirSync, writeFileSync } from 'node:fs';

const GENERATED_AT = '2026-10-04T10:03:12Z';
const AS_OF = { schedules: 'v202609270', osm: '2026-10-03' };

// A stop: [key, SEPTA number, name, [x, y] in meters from the sample origin, what OpenStreetMap has].
const ROUTES = [
  {
    id: 'T1',
    r: 'T1',
    nm: '13th St to 63rd-Malvern/Overbrook',
    md: 2,
    directions: [
      {
        d: 0,
        dir: 'Eastbound',
        to: '13th-Market',
        out: 0,
        stops: [
          ['sp1401', '1401', 'Sample 3 St & Sample 8 Ave', [640, 180], { c: 0, osm: 'n9000006' }],
          ['sp1003', '1003', 'Sample 3 St & Sample 5 Ave', [480, 180], {}],
          ['sp1402', '1402', '13th St', [0, 180], {}],
        ],
      },
      {
        d: 1,
        dir: 'Westbound',
        to: '63rd-Malvern',
        out: 0,
        stops: [
          ['sp1403', '1403', '13th St', [0, 176], {}],
          ['sp1404', '1404', 'Sample 3 St & Sample 5 Ave (far side)', [490, 176], { c: 0, osm: 'w9000007' }],
        ],
      },
    ],
  },
  {
    id: '16',
    r: '16',
    nm: 'Broad-Erie to Cheltenham-Ogontz',
    md: 1,
    directions: [
      {
        d: 0,
        dir: 'Northbound',
        to: 'Cheltenham-Ogontz',
        out: 2,
        stops: [
          ['sp1002', '1002', 'N Broad St & Sample 2 St', [150, 60], { c: 3, osm: 'n9000002', sh: 1 }],
          ['sp1301', '1301', 'N Broad St & Sample 4 St', [150, 180], {}],
        ],
      },
      {
        d: 1,
        dir: 'Southbound',
        to: 'Broad-Erie',
        out: 2,
        stops: [
          ['sp1302', '1302', 'N Broad St & Sample 4 St (far side)', [142, 180], { c: 0, osm: 'n9000008' }],
          ['sp1001', '1001', 'Sample 2 St & N Broad St (far side)', [170, 60], {}],
          ['sp1303', '1303', 'N Broad St & Sample 1 St', [142, -60], { c: 1, osm: 'n9000009', sh: 0, bn: 0 }],
        ],
      },
    ],
  },
  {
    id: '60',
    r: '60',
    nm: 'Sample route across town',
    md: 1,
    directions: [
      {
        d: 0,
        dir: 'Eastbound',
        to: 'Sample Loop',
        out: 0,
        stops: [
          ['sp1201', '1201', 'Sample 2 St & Sample 1 Ave', [100, 60], { c: 3, osm: 'n9000001', sh: 1, bn: 1, bi: 1, lt: 1 }],
          ['sp1202', '1202', 'Sample 2 St & Sample 4 Ave', [320, 60], { c: 2, osm: 'n9000004', sh: 0, bn: 1 }],
          ['sp1203', '1203', 'Sample 2 St & Sample 9 Ave', [480, 60], { c: 1, osm: 'n9000005', sh: 0, bn: 0, bi: 0, lt: 1 }],
          ['sp1105', '1005', 'Sample 2 St & Sample 6 Ave (midblock, near side)', [560, 60], {}],
          ['sp1204', '1204', 'Sample 2 St & Sample 11 Ave', [700, 60], { c: 0, osm: 'n9000010' }],
          ['sp1205', '1205', 'Sample Loop', [800, 60], {}],
        ],
      },
      {
        d: 1,
        dir: 'Westbound',
        to: 'Sample 1 Ave',
        out: 1,
        stops: [
          ['sp1206', '1206', 'Sample Loop (far side)', [800, 44], {}],
          ['sp1207', '1207', 'Sample 2 St & Sample 9 Ave (far side)', [470, 44], { c: 0, osm: 'n9000011' }],
          ['sp1208', '1208', 'Sample 2 St & Sample 1 Ave (far side)', [90, 44], {}],
        ],
      },
    ],
  },
];

/** The sheets as [path under the data root, JSON text], the index last. */
export function routeSheetFixtures(toLngLat) {
  const files = [];
  const index = [];
  for (const route of ROUTES) {
    const counts = {};
    const directions = route.directions.map(({ stops, ...direction }) => {
      const placed = stops.map(([k, sid, nm, xy, osm]) => {
        const [lng, lat] = toLngLat(xy);
        const stop = { k, sid, nm, lat, lng, ...osm };
        const kind = 'c' in osm ? String(osm.c) : 'none';
        counts[kind] = (counts[kind] ?? 0) + 1;
        return stop;
      });
      let m = 0;
      for (let i = 1; i < stops.length; i++) m += Math.hypot(stops[i][3][0] - stops[i - 1][3][0], stops[i][3][1] - stops[i - 1][3][1]);
      return { d: direction.d, dir: direction.dir, to: direction.to, m: Math.round(m), out: direction.out, stops: placed };
    });
    const file = `tables/routes/${route.id}.json`;
    const sheet = { schema: 1, generated_at: GENERATED_AT, as_of: AS_OF, id: route.id, r: route.r, nm: route.nm, md: route.md, directions };
    files.push([file, JSON.stringify(sheet) + '\n']);
    index.push({
      id: route.id,
      r: route.r,
      nm: route.nm,
      md: route.md,
      file,
      dirs: directions.map((d) => ({ d: d.d, dir: d.dir, to: d.to, n: d.stops.length })),
      s: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    });
  }
  files.push(['tables/routes/index.json', JSON.stringify({ schema: 1, generated_at: GENERATED_AT, as_of: AS_OF, routes: index }) + '\n']);
  return files;
}

// Run alone: write the sheets into fixtures/data/ with the same placement as make-fixtures.mjs.
if (import.meta.url === `file://${process.argv[1]}`) {
  const LAT0 = 39.985;
  const LNG0 = -75.158;
  const M_PER_DEG_LAT = 111_320;
  const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
  const round6 = (n) => Math.round(n * 1e6) / 1e6;
  const toLngLat = ([x, y]) => [round6(LNG0 + x / M_PER_DEG_LNG), round6(LAT0 + y / M_PER_DEG_LAT)];
  const root = new URL('../fixtures/data/', import.meta.url);
  mkdirSync(new URL('tables/routes/', root), { recursive: true });
  for (const [name, text] of routeSheetFixtures(toLngLat)) writeFileSync(new URL(name, root), text);
  console.log(`Wrote ${ROUTES.length} route survey sheets and their index to ${root.pathname}tables/routes/`);
}
