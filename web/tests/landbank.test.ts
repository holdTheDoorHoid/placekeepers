// The Land Bank in numbers (M4.4): reading tables/land_bank.json, the yearly series the charts
// draw, and the CSV downloads (terms first, counts only).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AGENCY_CHOICES,
  byAgencyYears,
  districtsCsv,
  listedCsv,
  loadTable,
  parseTable,
  percent,
  programsCsv,
  yearsCsv,
  yearsFromFirst,
  type LandBankTable,
} from '../src/landbank/data.ts';
import { collectStrings, strings } from '../src/strings.ts';

const FIXTURE = JSON.parse(readFileSync(new URL('../fixtures/data/tables/land_bank.json', import.meta.url), 'utf8'));
const NOTES = { terms: 'Placekeepers export: read the terms of use first: https://example.org/terms/', about: ['Counts only.'] };

function table(): LandBankTable {
  const parsed = parseTable(FIXTURE);
  if (!parsed) throw new Error('the fixture does not parse');
  return parsed;
}

describe('reading the table', () => {
  it('accepts the published shape and refuses anything else', () => {
    expect(parseTable(FIXTURE)).not.toBeNull();
    expect(parseTable({ ...FIXTURE, schema: 2 })).toBeNull();
    expect(parseTable({ ...FIXTURE, agencies: { all: FIXTURE.agencies.all } })).toBeNull();
    expect(parseTable(null)).toBeNull();
  });

  it('says missing for a 404 and failed for anything broken', async () => {
    const answer = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
    expect(await loadTable('/data/', answer(404, {}) as unknown as typeof fetch)).toBe('missing');
    expect(await loadTable('/data/', answer(500, {}) as unknown as typeof fetch)).toBe('failed');
    expect(await loadTable('/data/', answer(200, { schema: 9 }) as unknown as typeof fetch)).toBe('failed');
    const ok = await loadTable('/data/', answer(200, FIXTURE) as unknown as typeof fetch);
    expect(typeof ok).toBe('object');
  });

  it('holds counts only: no names, addresses or parcel numbers', () => {
    const text = JSON.stringify(FIXTURE);
    // No nine digit parcel number, no street address, no company or person name.
    expect(text).not.toMatch(/\b\d{9}\b/);
    expect(text).not.toMatch(/\b\d+ [NSEW]?\.? ?[A-Z][a-z]+ (St|Ave|Street|Avenue)\b/);
    expect(text).not.toMatch(/\bLLC\b|\bINC\b|\bLP\b/);
    const keys = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) keys.add(k), walk(x);
    };
    walk(FIXTURE);
    for (const k of keys) expect(k).not.toMatch(/name|grantee|grantor|owner|address|opa|parcel_number/i);
  });
});

describe('the yearly series', () => {
  it('starts at the first year with anything to show', () => {
    const t = table();
    expect(yearsFromFirst(t.agencies.all)[0]!.year).toBe(2014);
    // The Land Bank began conveying in 2017; it received land from 2016.
    expect(yearsFromFirst(t.agencies.PLB)[0]!.year).toBeLessThanOrEqual(2017);
    expect(yearsFromFirst(t.agencies.PLB).every((y) => y.year >= 2015)).toBe(true);
  });

  it('adds up: the agencies of each year make the year, and the years make the total', () => {
    const t = table();
    for (const row of byAgencyYears(t, 'all')) {
      const year = t.agencies.all.years.find((y) => y.year === row.year)!;
      expect(Object.values(row.values).reduce((a, b) => a + b, 0)).toBe(year.n);
    }
    for (const choice of AGENCY_CHOICES) {
      const stats = t.agencies[choice];
      expect(stats.years.reduce((a, y) => a + y.n, 0)).toBe(stats.total.n);
      expect(stats.districts.reduce((a, d) => a + d.n, 0)).toBe(stats.total.n);
      for (const y of stats.years) {
        expect(Object.values(y.buyers).reduce((a, b) => a + b, 0)).toBe(y.n);
        expect(y.programs.side_yard + y.programs.other).toBe(y.n);
        expect(y.price.priced + y.price.none).toBe(y.n);
      }
    }
  });

  it('shows one agency alone when one is chosen', () => {
    const rows = byAgencyYears(table(), 'PLB');
    expect(rows.every((r) => r.values.PRA === 0 && r.values.PHDC === 0 && r.values.PUB === 0)).toBe(true);
  });

  it('gives shares in whole percent, and none of nothing', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBeNull();
  });
});

describe('CSV downloads', () => {
  it('start with the terms of use, then say what they hold', () => {
    const t = table();
    for (const text of [yearsCsv(t, NOTES), districtsCsv(t, NOTES), programsCsv(t, NOTES), listedCsv(t, NOTES)]) {
      const lines = text.replace('﻿', '').split('\r\n');
      expect(lines[0]).toBe(`# ${NOTES.terms}`);
      expect(lines[1]).toBe('# Counts only.');
    }
  });

  it('hold one row per agency and year, marking the year that is not complete', () => {
    const t = table();
    const lines = yearsCsv(t, NOTES).trim().split('\r\n');
    const header = lines[2]!.split(',');
    expect(header).toContain('side_or_rear_yard_our_inference');
    expect(lines.length - 3).toBe(AGENCY_CHOICES.length * t.deeds.years.length);
    const partial = lines.filter((l) => l.startsWith(`all four agencies,${t.deeds.partial_year},`));
    expect(partial[0]!.endsWith(',no')).toBe(true);
  });

  it('name statuses in plain words when asked', () => {
    const text = listedCsv(table(), NOTES, (s) => (s === 'Owned - Available' ? 'listed as available' : 'other'));
    expect(text).toContain('status: listed as available');
  });
});

describe('the page text', () => {
  it('speaks for no one and argues nothing', () => {
    const text = collectStrings(strings.landBank)
      .map(([, s]) => s)
      .join(' ');
    expect(text).not.toMatch(/Steward Union|we demand|must|should|scandal|failure|only \d+/i);
  });
});
