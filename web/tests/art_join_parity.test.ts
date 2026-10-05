// The browser joins a work of public art from its records, one per source (src/art/join.ts;
// decision D1 of docs/VERIFICATION_V0_2.md, applied to public art by M3.2), and must show exactly
// what the pipeline's reference join gives: the cases in
// pipeline/tests/fixtures/art_join_parity.json (written by pipeline/tests/art_join_cases.py and
// checked against the pipeline by pipeline/tests/test_art_join_parity.py).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { joinArt, recordsOfWork } from '../src/art/join.ts';

const fixture = JSON.parse(readFileSync(new URL('../../pipeline/tests/fixtures/art_join_parity.json', import.meta.url), 'utf8')) as {
  cases: { name: string; records: Record<string, unknown>[]; joined: Record<string, unknown> }[];
};

describe('the public art join', () => {
  it('has cases to check', () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(8);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))('gives what the pipeline gives: %s', (_name, c) => {
    expect(joinArt(c.records)).toEqual(c.joined);
    // In any order, and starting from the drawn record and finding the others by the work's id.
    expect(joinArt([...c.records].reverse())).toEqual(c.joined);
    const drawn = c.records.find((r) => r.pr === 1)!;
    expect(joinArt(recordsOfWork(drawn, (g) => c.records.filter((r) => r.g === g)))).toEqual(c.joined);
  });

  it('never joins a record of another work', () => {
    const drawn = { id: 'n1', g: 'n1', k: 1, src: 2, s: 2, pr: 1, nm: 'Mine' };
    const other = { id: 'pa2', g: 'pa2', k: 1, src: 1, s: 1, pa: 2, nm: 'Theirs' };
    expect(recordsOfWork(drawn, () => [drawn, other])).toEqual([drawn]);
  });
});
