// Downloads of places (src/places/export.ts) and reading list files back (src/places/import.ts):
// docs/ETHICS.md "Bulk export" says exports carry the owner flags and start with a line pointing to
// the terms of use; a download holds at most EXPORT_LIMIT places.

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { parseManifest } from '../src/data/manifest.ts';
import { clearShardCache } from '../src/dossier/shard.ts';
import {
  CSV_COLUMNS,
  EXPORT_LIMIT,
  csvCell,
  exportFileName,
  gatherExport,
  toCsv,
  toGeoJson,
  type ExportInput,
  type ExportPlace,
} from '../src/places/export.ts';
import { parseCsv, parseListFile } from '../src/places/import.ts';
import { defaultState } from '../src/state/defaults.ts';
import { collectStrings, strings } from '../src/strings.ts';

const reg = loadRegistry();
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const MANIFEST = parseManifest(JSON.parse(read('../fixtures/data/manifest.json'))).manifest!;
const tiles = JSON.parse(read('../fixtures/sources/parcels.geojson')).features as { properties: Record<string, unknown> }[];
const tileOf = (id: string) => tiles.find((t) => t.properties.id === id)!.properties;
const SITE = 'https://example.org/placekeepers/';
const DATA = 'https://example.org/placekeepers/data/';

/** Serves the committed sample data root, as the site would. */
function serveFixtures() {
  return vi.fn(async (url: string | URL | Request) => {
    const path = String(url).replace(DATA, '');
    try {
      return new Response(read(`../fixtures/data/${path}`), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch {
      return new Response('', { status: 404 });
    }
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

function input(places: ExportPlace[], fetchImpl = serveFixtures()): ExportInput {
  return {
    places,
    registry: reg,
    state: defaultState(reg, 'analysis'),
    manifest: MANIFEST,
    dataBase: DATA,
    siteUrl: SITE,
    title: 'Places in view',
    now: new Date('2026-10-04T16:00:00Z'),
    fetchImpl,
  };
}

const LOT: ExportPlace = { id: '990000005', center: [-75.15572, 39.98513], properties: tileOf('990000005') };

afterEach(() => clearShardCache());

describe('gathering an export', () => {
  it('fills each place from its tile and its lot dossier, flags in full', async () => {
    const result = await gatherExport(input([LOT]));
    const row = result.rows[0]!;
    expect(row).toMatchObject({
      opa_account: '990000005',
      address: '1305 N EXAMPLE AVE',
      kind: 'Vacant lot',
      how_sure: 'Very likely vacant',
      owner_type: 'Individual',
      in_landcare: 'no',
      suggestion: 'Clean and green this lot',
      first_step_to_get_permission: 'A private owner: ask the owner',
      first_lawful_step: 'Ask the owner for permission. Find the owner\'s mailing address on the lot page.',
      lot_page: `${SITE}#p=990000005`,
      longitude: -75.15572,
      latitude: 39.98513,
    });
    expect(row.lens_score).toBeGreaterThan(0);
    expect(row.owner_names).not.toBe('');
    expect(row.mailing_address).not.toBe('');
    const estate = row.owner_flags.find((f) => f.id === 'possible_estate')!;
    // The flag reads as docs/ETHICS.md words it, with all three parts.
    expect(estate).toEqual({
      id: 'possible_estate',
      title: 'Possible estate',
      text: strings.dossier.flags.possible_estate.text,
      careful: strings.dossier.flags.possible_estate.careful,
      next_step: strings.dossier.flags.possible_estate.next,
    });
    expect(row.owner_flags.every((f) => f.careful && f.next_step)).toBe(true);
    expect(result.withoutDetails).toBe(0);
    expect(result.notes[0]).toBe(`Placekeepers export: for community care and lawful action only. Read the terms of use first: ${SITE}terms/`);
  });

  it('works from the dossier alone for a place with no map data, such as one from a list file', async () => {
    const result = await gatherExport(input([{ id: '990000009', center: null, properties: null }]));
    expect(result.rows[0]).toMatchObject({
      kind: 'Vacant lot',
      how_sure: 'Probably vacant',
      first_step_to_get_permission: 'The City or the Land Bank owns it: a garden agreement or license',
      lens_score: null,
      longitude: null,
    });
  });

  it('downloads each shard file once and leaves out what it cannot fill', async () => {
    const fetchImpl = serveFixtures();
    const result = await gatherExport(input([LOT, { id: '990000001', center: null, properties: tileOf('990000001') }, { id: '123456789', center: null, properties: null }], fetchImpl));
    expect(result.rows.map((r) => r.opa_account)).toEqual(['990000005', '990000001', '123456789']);
    expect(result.withoutDetails).toBe(1);
    expect(result.rows[2]!.owner_names).toBe('');
    const shardCalls = fetchImpl.mock.calls.filter(([url]) => String(url).includes('dossiers/9900.json'));
    expect(shardCalls).toHaveLength(1);
  });

  it('holds at most the export limit, and says how many were left out', async () => {
    const many = Array.from({ length: EXPORT_LIMIT + 3 }, (_, i) => ({ ...LOT, id: String(990000000 + i).padStart(9, '0') }));
    const result = await gatherExport(input(many));
    expect(result.rows).toHaveLength(EXPORT_LIMIT);
    expect(result.leftOut).toBe(3);
  });
});

describe('the files', () => {
  it('starts the CSV with the terms of use, keeps the notes on one line each, then the header', async () => {
    const csv = toCsv(await gatherExport(input([LOT])));
    expect(csv.startsWith('\uFEFF# Placekeepers export: for community care and lawful action only.')).toBe(true);
    const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
    const notes = rows.filter((r) => r[0]!.startsWith('#'));
    expect(notes.length).toBeGreaterThanOrEqual(3);
    for (const note of notes) expect(note).toHaveLength(1);
    const header = rows[notes.length]!;
    expect(header).toEqual([...CSV_COLUMNS]);
    const row = rows[notes.length + 1]!;
    expect(row[header.indexOf('owner_flags')]).toContain('Possible estate: The owner of record may have died.');
  });

  it('never lets a spreadsheet run a value as a formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1 555')).toBe("'+1 555");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('-75.1', false)).toBe('-75.1');
    expect(csvCell(-75.1, false)).toBe('-75.1');
    expect(csvCell('MORALES, ROSA')).toBe('"MORALES, ROSA"');
    expect(csvCell(null)).toBe('');
  });

  it('starts the GeoJSON with the terms of use, and keeps each flag\'s careful note and next step', async () => {
    const text = toGeoJson(await gatherExport(input([LOT])));
    expect(text.split('\n')[0]).toBe(`{"terms_of_use": "Placekeepers export: for community care and lawful action only. Read the terms of use first: ${SITE}terms/",`);
    const json = JSON.parse(text);
    expect(json.type).toBe('FeatureCollection');
    expect(json.name).toBe('Places in view');
    expect(json.features[0].geometry).toEqual({ type: 'Point', coordinates: [-75.15572, 39.98513] });
    expect(json.features[0].properties.owner_flags[0]).toHaveProperty('careful');
    expect(json.features[0].properties).not.toHaveProperty('longitude');
  });

  it('names files plainly', () => {
    const now = new Date('2026-10-04T16:00:00Z');
    expect(exportFileName('Places in view', now, 'csv')).toBe('placekeepers-places-in-view-2026-10-04.csv');
    expect(exportFileName('Block walk: 5th & Diamond!', now, 'geojson')).toBe('placekeepers-block-walk-5th-diamond-2026-10-04.geojson');
    expect(exportFileName('', now, 'csv')).toBe('placekeepers-places-2026-10-04.csv');
  });

  it('never uses words for buying or for how easy a lot is to get', () => {
    const texts = collectStrings({ permission: strings.permission, export: strings.export, plot: strings.plot, lists: strings.lists, filters: strings.filters });
    const offenders = texts.filter(([, text]) => /\b(easiest|easy|acquire|acquisition|buy|take)\b/i.test(text));
    expect(offenders).toEqual([]);
  });
});

describe('reading a list file back', () => {
  it('reads its own CSV and GeoJSON downloads', async () => {
    const result = await gatherExport({ ...input([LOT, { id: '990000009', center: [-75.155485, 39.98513], properties: null }]), title: 'Block walk' });
    const fromCsv = parseListFile(toCsv(result), 'placekeepers-block-walk-2026-10-04.csv', 'List');
    const fromGeo = parseListFile(toGeoJson(result), 'whatever.geojson', 'List');
    for (const parsed of [fromCsv, fromGeo]) {
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.list.places.map((p) => p.id)).toEqual(['990000005', '990000009']);
      expect(parsed.list.places[0]).toMatchObject({ address: '1305 N EXAMPLE AVE', center: [-75.15572, 39.98513] });
    }
    expect(fromGeo.ok && fromGeo.list.name).toBe('Block walk');
    expect(fromCsv.ok && fromCsv.list.name).toBe('placekeepers-block-walk-2026-10-04');
  });

  it('reads parcel numbers from any text, padding the zero a spreadsheet dropped', () => {
    const csv = 'opa_account,address\n72106400,1 A ST\n990000005,2 B ST\n';
    const parsed = parseListFile(csv, 'mine.csv', 'List');
    expect(parsed.ok && parsed.list.places.map((p) => p.id)).toEqual(['072106400', '990000005']);
    const text = parseListFile('Lots to visit: 990000005, 990000009 and 990000005 again. Not 12345678901.', 'notes.txt', 'List');
    expect(text.ok && text.list.places.map((p) => p.id)).toEqual(['990000005', '990000009']);
    expect(text.ok && text.list.name).toBe('notes');
  });

  it('refuses a file with no parcel numbers, or one too large to be a list', () => {
    expect(parseListFile('hello', 'a.txt', 'List')).toEqual({ ok: false, reason: 'empty' });
    expect(parseListFile('{"type": "FeatureCollection", "features": []}', 'a.geojson', 'List')).toEqual({ ok: false, reason: 'empty' });
    expect(parseListFile('9'.repeat(5_000_001), 'a.txt', 'List')).toEqual({ ok: false, reason: 'too_big' });
  });

  it('keeps a list to its limit and counts what it left out', () => {
    const ids = Array.from({ length: 503 }, (_, i) => String(990000000 + i)).join('\n');
    const parsed = parseListFile(ids, 'many.txt', 'List');
    expect(parsed.ok && parsed.list.places).toHaveLength(500);
    expect(parsed.ok && parsed.list.leftOut).toBe(3);
  });

  it('splits CSV cells the way spreadsheets write them', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,,3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '', '3'],
    ]);
  });
});
