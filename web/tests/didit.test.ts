// "Did it work?" (M5.4, issue #48): the page's table and sentences. The sample table is the real
// study's results (scripts/didit-fixtures.mjs), so these tests check the numbers the page shows
// against data/didit/results.json itself, which pipeline/tests/test_didit.py reproduces from the
// committed per area totals.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  changeWords,
  detailLines,
  halfWords,
  loadTable,
  parseTable,
  rangeWords,
  tally,
  verdictSentence,
  type DiditTable,
  type Estimate,
  type Result,
} from '../src/didit/data.ts';
import { strings } from '../src/strings.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const sample = parseTable(read('../fixtures/data/tables/didit.json'))!;
const results = read('../../data/didit/results.json');

function result(kind: string, outcome: string): Result {
  return sample.kinds.find((k) => k.id === kind)!.results.find((r) => r.outcome === outcome)!;
}

const est = (over: Partial<Estimate> = {}): Estimate => ({
  places: 600,
  areas: 30,
  before: 4000,
  after: 3500,
  expected: 3600,
  percent: -2.8,
  low: -6.1,
  high: 0.4,
  per_place_year: -0.08,
  per_low: -0.2,
  per_high: 0.01,
  balance: 0.98,
  ...over,
});

const base = (over: Partial<Result> = {}): Result => ({
  outcome: 'shootings',
  verdict: 'no_clear_change',
  check: 'passed',
  around_verdict: 'no_clear_change',
  cohorts: ['2017-1', '2024-1'],
  eligible: 650,
  dropped: 50,
  controls: 1200,
  main: est(),
  around: est({ percent: 1.1, low: -2, high: 4 }),
  later: est({ places: 300, percent: -4, low: -9, high: 1 }),
  placebo: est({ places: 400, percent: 0.5, low: -4, high: 5 }),
  naive: -17.8,
  ...over,
});

describe('the sample table is the real study', () => {
  it('parses, and holds exactly the results of data/didit/results.json', () => {
    expect(sample).not.toBeNull();
    const { projects_now, ...rest } = sample as DiditTable & Record<string, unknown>;
    expect(rest).toEqual(results);
    expect(projects_now).toEqual({ as_of: '2026-10-04', shown: 4, ready: 0, ready_before: '2024-06' });
  });

  it('counts each verdict for the short answer, leaving out comparisons with no places', () => {
    const counts = tally(sample);
    const expected = { fewer: 0, more: 0, no_clear_change: 0, check_failed: 0, too_few: 0, total: 0 };
    for (const kind of results.kinds) {
      for (const r of kind.results) {
        if (r.main.places === 0) continue;
        expected[r.verdict as keyof typeof expected] += 1;
        expected.total += 1;
      }
    }
    expect(counts).toEqual(expected);
    expect(counts.total).toBe(9);
  });

  it('says what the study found for LandCare and shootings, with its numbers', () => {
    const r = result('landcare', 'shootings');
    expect(r.verdict).toBe('check_failed');
    expect(verdictSentence('landcare', r, sample.rules).join(' ')).toContain('already changing differently');
    const lines = detailLines(r).join(' ');
    expect(lines).toContain(`Compared: ${r.main.places} places that got care from the first half of 2017 to the first half of 2024`);
    expect(lines).toContain(`${r.main.before.toLocaleString('en-US')} in the two years before`);
    expect(lines).toContain('Check failed');
    expect(lines).toContain('A simple before and after would say 17.8% fewer');
  });

  it('rejects a table it cannot read', () => {
    expect(parseTable({ ...results, schema: 2 })).toBeNull();
    expect(parseTable({ ...results, kinds: [{ id: 'other', results: [] }] })).toBeNull();
    expect(parseTable(null)).toBeNull();
  });

  it('loads the table, or says it is missing', async () => {
    const ok = (async () => new Response(JSON.stringify(results))) as unknown as typeof fetch;
    const missing = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    expect(await loadTable('./data/', ok)).not.toBe('failed');
    expect(await loadTable('./data/', missing)).toBe('missing');
  });
});

describe('the sentences', () => {
  it('put a change and its interval in words', () => {
    expect(changeWords(-6.2)).toBe('6.2% fewer');
    expect(changeWords(3)).toBe('3.0% more');
    expect(changeWords(0)).toBe('no change');
    expect(rangeWords(est({ low: -6.2, high: 0.2 }))).toBe('6.2% fewer to 0.2% more');
    expect(halfWords('2019-2')).toBe('the second half of 2019');
  });

  it('give each verdict its plain sentence', () => {
    const rules = sample.rules;
    expect(verdictSentence('landcare', base(), rules)[0]).toBe(
      'No clear change. The comparison found 2.8% fewer (90 percent interval: 6.1% fewer to 0.4% more), and that range includes no change at all.',
    );
    const fewer = base({ verdict: 'fewer', main: est({ percent: -7.1, low: -11, high: -3 }) });
    expect(verdictSentence('landcare', fewer, rules)[0]).toContain('7.1% fewer shootings nearby than expected');
    const more = verdictSentence('demolition', base({ verdict: 'more', outcome: 'complaints', main: est({ percent: 6.2, low: 3.2, high: 8.5 }) }), rules);
    expect(more[0]).toContain('6.2% more complaints about vacant property nearby');
    expect(more).toContain('This does not show that care caused them.');
    expect(more).toContain(strings.didit.whyMore.demolition);
    expect(more).toContain(strings.didit.verdicts.moreReports);
    const few = verdictSentence('projects', base({ verdict: 'too_few', main: est({ places: 0 }) }), rules);
    expect(few[0]).toBe('Only 0 places could be compared. A comparison needs at least 100.');
  });

  it('warns that trouble may have moved when care looks good and the ring around looks worse', () => {
    const r = base({ verdict: 'fewer', around_verdict: 'more', main: est({ percent: -8, low: -12, high: -3 }), around: est({ percent: 5, low: 1, high: 9 }) });
    expect(detailLines(r)).toContain(strings.didit.checks.moved);
    expect(detailLines(base())).not.toContain(strings.didit.checks.moved);
  });

  it('never calls a place dangerous, never mentions police, and never judges one lot', () => {
    const all: string[] = [];
    for (const kind of sample.kinds) for (const r of kind.results) all.push(...verdictSentence(kind.id, r, sample.rules), ...detailLines(r));
    all.push(...Object.values(strings.didit).filter((v): v is string => typeof v === 'string'));
    all.push(...strings.didit.cannot, ...strings.didit.method, ...strings.didit.warnings, ...strings.didit.trials);
    const text = all.join(' ');
    expect(text).not.toMatch(/\b(dangerous|high crime|hot ?spots?|police|policing|arrest)\b/i);
    expect(text).not.toMatch(/[–—]| - /);
    expect(strings.didit.lotNote).toContain('One lot cannot show whether care worked');
    expect(strings.didit.cannot.join(' ')).toContain('still looks vacant later');
  });
});
