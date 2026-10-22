// "Did it work?" in the sample data root (M5.4, issue #48): tables/didit.json is the repository's
// own data/didit/results.json, the real study's results (they name no place), with the
// `projects_now` the weekly publish adds, counted from the sample projects of
// projects-fixtures.mjs. So the page's end to end tests show the real numbers, and
// web/tests/didit.test.ts fails when the study is run again and this sample is not remade.
// make-fixtures.mjs writes it; run this file alone to write only it and list it in the sample
// manifest (needs nothing installed):
//   node scripts/didit-fixtures.mjs

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { SAMPLE_PROJECTS } from './projects-fixtures.mjs';

export const DIDIT_FILES = ['tables/didit.json'];

/** The manifest entries of the study's two outcome histories: [rows, newest record]. */
export const DIDIT_SOURCES = {
  philly311_dumping_history: [243619, '2026-10-02'],
  li_complaints_history: [148209, '2026-10-03'],
};

const RESULTS = new URL('../../data/didit/results.json', import.meta.url);

/** The last month a project can have been finished and still be compared (publish/didit.py). */
export function readyBefore(dataThrough) {
  const [year, month] = dataThrough.split('-').map(Number);
  const lastHalf = (year - 2015) * 2 + (month > 6 ? 1 : 0);
  const half = lastHalf - 4;
  const y = 2015 + Math.floor(half / 2);
  return `${y}-${half % 2 === 0 ? '06' : '12'}`;
}

/** [file under the data root, its text]. */
export function diditFixtures() {
  const results = JSON.parse(readFileSync(RESULTS, 'utf-8'));
  const limit = readyBefore(results.data_through);
  results.projects_now = {
    as_of: '2026-10-04',
    shown: SAMPLE_PROJECTS.length,
    ready: SAMPLE_PROJECTS.filter((p) => p.finished <= limit).length,
    ready_before: limit,
  };
  return [['tables/didit.json', JSON.stringify(results) + '\n']];
}

// Run alone: write the file into fixtures/data/ and add it to its manifest.
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('../fixtures/data/', import.meta.url);
  for (const [name, text] of diditFixtures()) writeFileSync(new URL(name, root), text);
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
  for (const [id, [rows, newest]] of Object.entries(DIDIT_SOURCES)) manifest.sources[id] = ok(rows, newest);
  for (const name of DIDIT_FILES) {
    const bytes = readFileSync(new URL(name, root));
    manifest.files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${DIDIT_FILES.length} "Did it work?" sample file to ${root.pathname} and listed it in its manifest`);
}
