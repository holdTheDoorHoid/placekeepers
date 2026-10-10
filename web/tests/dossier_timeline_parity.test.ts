// A lot page must show the same timeline whether its L&I records come from the weekly copy or
// from the City live (issue #38). pipeline/tests/fixtures/timeline_parity.json holds records shaped
// as the City sends them and the pipeline's own grouping of them, written by
// pipeline/tests/timeline_cases.py and checked against the pipeline by
// pipeline/tests/test_timeline_parity.py; this file checks the web app reads the same tables the
// same way and groups the City's answer to exactly the same records.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPEAL_COLUMNS, encodeAppeal, isUpcoming, localMoment, readAppeals } from '../src/dossier/appeals.ts';
import { LI_PARTS, appealsSql, liSql, readLi } from '../src/dossier/carto.ts';
import { parseHistoryShard } from '../src/dossier/history.ts';
import { parseAppeal } from '../src/dossier/shard.ts';
import { encodeGroups, groupLi } from '../src/dossier/timeline.ts';

interface Fixture {
  parts: { kind: string; table: string; date: string; title: string; status: string; detail: string }[];
  cases: { name: string; rows: [string, string | null, string | null, string | null, string | null][]; li: Record<string, unknown[][]> }[];
}

const fixture = JSON.parse(readFileSync(new URL('../../pipeline/tests/fixtures/timeline_parity.json', import.meta.url), 'utf8')) as Fixture;

describe('the timeline parity fixture', () => {
  it('reads the same six tables, with the same expressions, as the pipeline', () => {
    expect(LI_PARTS.map((part) => ({ ...part }))).toEqual(fixture.parts);
    const sql = liSql('372106400');
    for (const part of fixture.parts) expect(sql).toContain(`${part.date} AS date, ${part.title} AS title, ${part.status} AS status, ${part.detail} AS detail FROM ${part.table} `);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))('groups the City\'s answer as the pipeline does: %s', (_name, c) => {
    const rows = c.rows.map(([kind, date, title, status, detail]) => ({ kind, date, title, status, detail }));
    expect(encodeGroups(groupLi(readLi(rows).events))).toEqual(c.li);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))('reads the weekly copy back to the same records: %s', (_name, c) => {
    const shard = parseHistoryShard({ schema: 1, generated_at: '2026-10-09T00:00:00Z', parts: ['li'], parcels: { '372106400': { li: c.li } } }).shard!;
    expect(encodeGroups(shard.parcels.get('372106400')!.li!)).toEqual(c.li);
  });

  it('covers the cases that matter', () => {
    const names = fixture.cases.map((c) => c.name).join(' ');
    expect(names).toMatch(/evening/);
    expect(names).toMatch(/repeated/);
    expect(fixture.cases.some((c) => Object.keys(c.li).length === 6)).toBe(true);
  });
});

// Appeals (M4.6, issue #42): the same parity file holds the City's appeals rows and the appeals a
// lot page lists from them, as the pipeline wrote them for the weekly copy.
interface AppealFixture {
  appeal_columns: string[];
  appeal_today: string;
  appeal_cases: { name: string; rows: Record<string, string | null>[]; appeals: Record<string, string>[]; upcoming: number[] }[];
}

const appealFixture = fixture as unknown as AppealFixture;

describe('the appeals in the parity fixture', () => {
  it('reads the same columns of the same table as the pipeline, never the grounds', () => {
    expect([...APPEAL_COLUMNS]).toEqual(appealFixture.appeal_columns);
    const sql = appealsSql('372106400');
    expect(sql).toContain(`SELECT ${appealFixture.appeal_columns.join(', ')} FROM appeals WHERE opa_account_num = '372106400'`);
    expect(sql).not.toMatch(/appealgrounds|proviso|relatedpermit|relatedcasefile/);
  });

  it.each(appealFixture.appeal_cases.map((c) => [c.name, c] as const))('lists the City\'s answer as the pipeline does: %s', (_name, c) => {
    const appeals = readAppeals(c.rows);
    expect(appeals.map(encodeAppeal)).toEqual(c.appeals);
    expect(appeals.flatMap((a, i) => (isUpcoming(a, appealFixture.appeal_today) ? [i] : []))).toEqual(c.upcoming);
  });

  it.each(appealFixture.appeal_cases.map((c) => [c.name, c] as const))('reads the weekly copy back to the same appeals: %s', (_name, c) => {
    const parsed = c.appeals.map((a) => parseAppeal(a)!);
    expect(parsed.map(encodeAppeal)).toEqual(c.appeals);
  });

  it('turns times into days and times in Philadelphia, as the pipeline does', () => {
    expect(localMoment('2027-02-24 20:30:00+00')).toEqual(localMoment('2027-02-24T20:30:00Z'));
    expect(localMoment('2027-02-24T20:30:00Z')).toEqual(['2027-02-24', '15:30']);
    expect(localMoment('2026-07-01T13:30:00-04:00')).toEqual(['2026-07-01', '13:30']);
    expect(localMoment('2026-07-01')).toEqual(['2026-07-01', null]);
    expect(localMoment('2026-11-04T05:00:00Z')).toEqual(['2026-11-04', null]);
    expect(localMoment('2026-02-30T10:00:00Z')).toEqual([null, null]);
    expect(localMoment('not a date')).toEqual([null, null]);
  });
});
