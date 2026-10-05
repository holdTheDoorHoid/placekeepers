// SEPTA's stops are published without what OpenStreetMap says there (decision D1 of
// docs/VERIFICATION_V0_2.md); the browser joins it from tables/stop_amenities.json. This file checks
// that the join gives exactly what the pipeline's reference join gives, on the cases of
// pipeline/tests/fixtures/stop_join_parity.json (written by pipeline/tests/stop_join_cases.py and
// checked against the pipeline by pipeline/tests/test_stop_join_parity.py), and that the published
// sample files keep the two apart.

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOT_SURVEYED, joinStop, parseStopTable, type OsmStopEntry, type StopTable } from '../src/transit/answers.ts';

interface Case {
  name: string;
  tile: Record<string, unknown>;
  osm: OsmStopEntry | null;
  joined: Record<string, unknown>;
}

const fixture = JSON.parse(readFileSync(new URL('../../pipeline/tests/fixtures/stop_join_parity.json', import.meta.url), 'utf8')) as {
  not_surveyed: number;
  cases: Case[];
};

/** A table holding the case's OpenStreetMap stop under the id the stop links to. */
function tableFor(c: Case): StopTable {
  const stops = new Map<string, OsmStopEntry>();
  if (c.osm && typeof c.tile.o === 'string') stops.set(c.tile.o, c.osm);
  return { asOf: null, credit: null, license: null, stops };
}

describe('the stop join, as the pipeline says it', () => {
  it('counts an unknown answer halfway, as the pipeline does', () => {
    expect(NOT_SURVEYED).toBe(fixture.not_surveyed);
  });

  for (const c of fixture.cases) {
    it(c.name, () => {
      expect(joinStop(c.tile, tableFor(c))).toEqual(c.joined);
    });
  }

  it('treats every stop as not yet surveyed while the table is missing', () => {
    const linked = fixture.cases.find((c) => c.tile.o === 'n1')!;
    const joined = joinStop(linked.tile, null);
    expect([joined.f_noshelter, joined.f_nobench, joined.sg]).toEqual([NOT_SURVEYED, NOT_SURVEYED, 'stop_survey']);
    expect('a' in joined || 'om' in joined).toBe(false);
  });
});

// The published files ---------------------------------------------------------------------------

const DATA = new URL('../fixtures/data/', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, DATA), 'utf8'));

/**
 * What OpenStreetMap says at a stop, or follows only from it: never on SEPTA's records. (On a SEPTA
 * stop `lt` is the last departure; on a route sheet it would be OpenStreetMap's light, so the sheets
 * are checked for it too.)
 */
const OSM_ANSWERS = ['a', 'om', 'c', 'sh', 'bn', 'bi', 'li', 'cv', 'tp', 'db', 'nb', 'f_noshelter', 'f_nobench'];
const OSM_SUGGESTIONS = ['stop_survey', 'stop_shelter_request', 'stop_bench_request', 'stop_streetlight_report'];

describe('SEPTA records and OpenStreetMap answers stay in separate files (decision D1)', () => {
  it('publishes SEPTA stops with the link to OpenStreetMap, never what it says there', () => {
    const stops = json('tiles/transit.stops.geojson').features as { properties: Record<string, unknown> }[];
    expect(stops.some((f) => typeof f.properties.o === 'string')).toBe(true);
    for (const { properties } of stops) {
      expect(OSM_ANSWERS.filter((key) => key in properties), String(properties.id)).toEqual([]);
      const suggested = String(properties.sg ?? '').split(',').filter(Boolean);
      expect(suggested.filter((s) => OSM_SUGGESTIONS.includes(s)), String(properties.id)).toEqual([]);
    }
  });

  it('publishes the route sheets with the link only, credited to SEPTA', () => {
    const index = json('tables/routes/index.json');
    expect(index.credit).toMatch(/SEPTA/);
    expect(index.license).toMatch(/^SEPTA open data license agreement/);
    for (const route of index.routes) expect('s' in route).toBe(false);
    const files = readdirSync(new URL('tables/routes/', DATA)).filter((name) => name !== 'index.json');
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const sheet = json(`tables/routes/${name}`);
      expect(sheet.credit).toMatch(/SEPTA/);
      for (const direction of sheet.directions) {
        for (const stop of direction.stops) expect(Object.keys(stop).filter((key) => key === 'lt' || OSM_ANSWERS.includes(key))).toEqual([]);
      }
    }
  });

  it('publishes what OpenStreetMap says in its own file, under its own license, for every link', () => {
    const raw = json('tables/stop_amenities.json');
    expect(raw.credit).toBe('© OpenStreetMap contributors');
    expect(raw.license).toMatch(/^Open Database License/);
    const table = parseStopTable(raw)!;
    const links = [
      ...(json('tiles/transit.stops.geojson').features as { properties: Record<string, unknown> }[]).map((f) => f.properties.o),
      ...readdirSync(new URL('tables/routes/', DATA))
        .filter((name) => name !== 'index.json')
        .flatMap((name) => json(`tables/routes/${name}`).directions.flatMap((d: { stops: { osm?: string }[] }) => d.stops.map((s) => s.osm))),
    ].filter((o): o is string => typeof o === 'string');
    for (const o of links) expect(table.stops.has(o), o).toBe(true);
  });
});
