// A lot page must show the same timeline whether its L&I records come from the weekly copy or
// from the City live (issue #38). pipeline/tests/fixtures/timeline_parity.json holds records shaped
// as the City sends them and the pipeline's own grouping of them, written by
// pipeline/tests/timeline_cases.py and checked against the pipeline by
// pipeline/tests/test_timeline_parity.py; this file checks the web app reads the same tables the
// same way and groups the City's answer to exactly the same records.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LI_PARTS, liSql, readLi } from '../src/dossier/carto.ts';
import { parseHistoryShard } from '../src/dossier/history.ts';
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
