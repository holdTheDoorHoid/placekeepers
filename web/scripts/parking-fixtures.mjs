// The parking reports layer of the sample data root (issue #37): made up counts of Laser Vision
// reports, fixed by hand around the sample streets of make-fixtures.mjs (no random draws, so every
// other fixture stays the same), with the short properties of docs/CONTRACTS.md section 4. Each
// H3 resolution 10 cell (about a block across) comes twice, as the pipeline writes it: its center
// (counts only) and its hexagon (counts and the cell id `id`). Published as GeoJSON, as the
// pipeline does when it skips a tile file:
//   * parking.parking: a busy corner, a busy bike lane, quieter cells around them, and a cell
//     where every kind has fewer than 5 reports of its own.
// make-fixtures.mjs writes it; run this file alone to write only it (needs h3-js):
//   npm install --no-save h3-js@4 && node scripts/parking-fixtures.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { cellToBoundary, cellToLatLng, gridDisk, latLngToCell } from 'h3-js';

const collection = (features) => JSON.stringify({ type: 'FeatureCollection', features }) + '\n';
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const round7 = (n) => Math.round(n * 1e7) / 1e7;

/** Counts for the middle cell and its six neighbors, in a fixed order (sorted cell ids). */
const COUNTS = [
  { n: 142, sw: 61, bl: 38, cw: 22, co: 14, rp: 7 },
  { n: 48, sw: 20, bl: 19, cw: 6 },
  { n: 31, bl: 27 },
  { n: 17, sw: 9, co: 6 },
  { n: 9, cw: 5 },
  // Every kind below 5 here: the panel says "fewer than 5" for each.
  { n: 7 },
  { n: 5, rp: 5 },
];

export const PARKING_FILES = ['tiles/parking.parking.geojson'];

/** [file under the data root, its text], placed with `toLngLat`. */
export function parkingFixtures(toLngLat) {
  const [lng, lat] = toLngLat([300, 60]);
  const middle = latLngToCell(lat, lng, 10);
  const cells = [middle, ...gridDisk(middle, 1).filter((c) => c !== middle).sort()];
  const features = cells.flatMap((cell, i) => {
    const counts = COUNTS[i];
    const [cellLat, cellLng] = cellToLatLng(cell);
    const outline = cellToBoundary(cell).map(([y, x]) => [round7(x), round7(y)]);
    return [
      { type: 'Feature', properties: { ...counts }, geometry: { type: 'Point', coordinates: [round6(cellLng), round6(cellLat)] } },
      { type: 'Feature', properties: { id: cell, ...counts }, geometry: { type: 'Polygon', coordinates: [[...outline, outline[0]]] } },
    ];
  });
  return [['tiles/parking.parking.geojson', collection(features)]];
}

/** The manifest entry of the source: [rows, newest record]. */
export const PARKING_SOURCES = { pba_laser: [26060, '2026-10-03'] };
export const PARKING_LAYERS = {
  parking_reports: { file: 'tiles/parking.pmtiles', source_layer: 'parking', sources: ['pba_laser'] },
};

// Run alone: write the file into fixtures/data/ with the same placement as make-fixtures.mjs.
if (import.meta.url === `file://${process.argv[1]}`) {
  const LAT0 = 39.985;
  const LNG0 = -75.158;
  const M_PER_DEG_LAT = 111_320;
  const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
  const toLngLat = ([x, y]) => [round6(LNG0 + x / M_PER_DEG_LNG), round6(LAT0 + y / M_PER_DEG_LAT)];
  const root = new URL('../fixtures/data/', import.meta.url);
  mkdirSync(new URL('tiles/', root), { recursive: true });
  for (const [name, text] of parkingFixtures(toLngLat)) writeFileSync(new URL(name, root), text);
  console.log(`Wrote ${PARKING_FILES.length} parking sample file to ${root.pathname}tiles/`);
}
