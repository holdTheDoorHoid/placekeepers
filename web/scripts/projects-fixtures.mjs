// Projects neighbors finished in the sample data root (M5.3, issue #47): made up projects on the
// sample parcels of make-fixtures.mjs (fixed by hand, no random draws, so every other fixture stays
// the same), in the shapes of docs/CONTRACTS.md: the table tables/projects.json and the layer
// `projects`, published as GeoJSON as the pipeline does when it skips a tile file:
//   * two projects on the sample lot 990000005 (a garden reported on GitHub and approved, and a
//     cleanup entered by hand with its public source),
//   * trees on 990000002, reported by a group that chose no name,
//   * a bench the City installed at a stop, on no parcel.
// make-fixtures.mjs writes them; run this file alone to write only them and add them to the
// sample manifest (needs nothing installed):
//   node scripts/projects-fixtures.mjs

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const REPORT = (n) => `https://github.com/holdTheDoorHoid/placekeepers/issues/${n}`;
const KIND_CODES = { other: 0, cleanup: 1, garden: 2, seating: 3, art: 4, trees: 5, city_install: 6, fix_311: 7 };

/** Newest first, as the pipeline writes them. */
export const SAMPLE_PROJECTS = [
  {
    id: 'r14',
    issue: 14,
    kind: 'city_install',
    finished: '2026-09',
    approved: '2026-09-30',
    parcel: null,
    address: 'Bus stop at Sample St and Example Ave',
    lng: -75.15655,
    lat: 39.98535,
    group: 'Sample Stop Riders',
    note: 'We wrote to OTIS with the stop number and how many people get on there. A bench came eight months later.',
    link: REPORT(14),
  },
  {
    id: 'r13',
    issue: 13,
    kind: 'trees',
    finished: '2026-05',
    approved: '2026-06-03',
    parcel: '990000002',
    address: '1203 N SAMPLE ST',
    lng: -75.157554,
    lat: 39.985243,
    group: null,
    note: null,
    link: REPORT(13),
  },
  {
    id: 'r12',
    issue: 12,
    kind: 'garden',
    finished: '2026-05',
    approved: '2026-06-02',
    parcel: '990000005',
    address: '1305 N EXAMPLE AVE',
    lng: -75.155725,
    lat: 39.985108,
    group: 'Example Avenue Growers',
    note: 'Twelve neighbors, four Saturdays and about $300 for soil and seeds. The Land Bank signed a garden agreement first.',
    link: REPORT(12),
  },
  {
    id: 'h2025_0001',
    issue: null,
    kind: 'cleanup',
    finished: '2025-09',
    approved: null,
    parcel: '990000005',
    address: '1305 N EXAMPLE AVE',
    lng: -75.155725,
    lat: 39.985108,
    group: 'Example Block Club',
    note: 'A Saturday cleanup with tools from the Streets Department.',
    link: 'https://example.org/sample-block-club-cleanup',
  },
];

export const PROJECTS_FILES = ['tiles/projects.projects.geojson', 'tables/projects.json'];

/** The manifest entries of the sources: [rows, newest record]. */
export const PROJECTS_SOURCES = { project_reports: [3, null], project_corrections: [1, null] };
export const PROJECTS_LAYERS = {
  projects: { file: 'tiles/projects.pmtiles', source_layer: 'projects', sources: ['project_reports', 'project_corrections'] },
};
export const PROJECTS_NOTES = ['Projects neighbors finished: 4 on the map', 'Projects tiles were skipped for this sample too, so that layer is published as GeoJSON.'];

/** [file under the data root, its text]. */
export function projectsFixtures() {
  const features = SAMPLE_PROJECTS.map((p) => {
    const properties = { id: p.id, k: KIND_CODES[p.kind], f: p.finished };
    for (const [key, value] of [
      ['p', p.parcel],
      ['a', p.address],
      ['g', p.group],
      ['n', p.note],
      ['l', p.link],
    ]) {
      if (value) properties[key] = value;
    }
    return { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } };
  });
  const table = { schema: 1, generated_at: '2026-10-04T10:03:12Z', as_of: '2026-10-04', projects: SAMPLE_PROJECTS };
  return [
    ['tiles/projects.projects.geojson', JSON.stringify({ type: 'FeatureCollection', features }) + '\n'],
    ['tables/projects.json', JSON.stringify(table, null, 2) + '\n'],
  ];
}

// Run alone: write the files into fixtures/data/ and add them to its manifest, in the places
// make-fixtures.mjs puts them.
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('../fixtures/data/', import.meta.url);
  for (const [name, text] of projectsFixtures()) writeFileSync(new URL(name, root), text);
  const manifestUrl = new URL('manifest.json', root);
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf-8'));
  const ok = (rows, newest) => ({
    status: 'ok',
    last_attempt: '2026-10-04T10:00:05Z',
    last_success: '2026-10-04T10:00:05Z',
    stale_since: null,
    rows,
    newest_record: newest,
    message: null,
  });
  for (const [id, [rows, newest]] of Object.entries(PROJECTS_SOURCES)) manifest.sources[id] = ok(rows, newest);
  Object.assign(manifest.layers, PROJECTS_LAYERS);
  for (const name of PROJECTS_FILES) {
    const bytes = readFileSync(new URL(name, root));
    manifest.files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  manifest.notes = [...manifest.notes.filter((n) => !PROJECTS_NOTES.includes(n)), ...PROJECTS_NOTES];
  writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${PROJECTS_FILES.length} project sample files to ${root.pathname} and listed them in its manifest`);
}
