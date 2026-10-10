// The dossier files (docs/CONTRACTS.md section 6): the reader takes the contract's own example and
// the committed fixture, keeps only the contract's fields, finds a parcel's shard through the
// manifest's dossiers block, and never fails on a bad file.

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSION_ROUTE, type PermissionCode } from '../src/config/permission.ts';
import { parseManifest } from '../src/data/manifest.ts';
import { clearOwnersTable, loadOwnerList, parseOwnersTable } from '../src/dossier/owners-table.ts';
import { isOpaAccount, normalizeAccount, shardPath, shardPrefix } from '../src/dossier/opa.ts';
import { clearShardCache, loadCommon, loadShard, parseCommon, parseShard, parseShardParcel, shardLocation } from '../src/dossier/shard.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const SHARD = read('../fixtures/data/dossiers/9900.json');
const COMMON = read('../fixtures/data/dossiers/common.json');
const OWNERS = read('../fixtures/data/tables/owners.json');
const MANIFEST = read('../fixtures/data/manifest.json');
const tiles = read('../fixtures/sources/parcels.geojson') as { features: { properties: Record<string, unknown> }[] };
const ETHICS = readFileSync(new URL('../../docs/ETHICS.md', import.meta.url), 'utf8');

/** The shard example in docs/CONTRACTS.md section 6. */
const CONTRACT_EXAMPLE = {
  schema: 1,
  generated_at: '2026-10-05T10:03:12Z',
  parcels: {
    '371000001': {
      address: '2931 N LAWRENCE ST',
      vacancy: { kind: 'lot', confidence: 'high', rs: 13, n: 2 },
      owner: {
        names: ['MORALES ROSA'],
        mailing: '41 ORCHARD RD, CHERRY HILL NJ 08002',
        type: 'individual',
        type_reason: "The owner name looks like a person's name.",
        flags: [
          {
            id: 'absentee',
            text: 'The owner gets mail somewhere else: Cherry Hill, NJ (out of state).',
            data: { scope: 'out_of_state', place: 'Cherry Hill, NJ' },
          },
          { id: 'years_since_sale', text: 'Last sold in 1987.', data: { year: 1987, date: '1987-06-12', price: 15000, source: 'opa_properties' } },
        ],
        notice: 'deed_fraud',
        help: ['tangled_title_help', 'fraud_guard'],
      },
      transfers: [{ date: '2016-08-09', type: "SHERIFF'S DEED", price: 12300, from: ['...'], to: ['...'] }],
      assessments: [
        [2027, 13800],
        [2026, 13800],
      ],
      li: { open_violations: 1, last_violation: '2025-08-01', unsafe: false, imminently_dangerous: false, violations: 2 },
      routes: ['ask_the_owner', 'conservatorship'],
      suggestions: ['clean_and_green'],
      nearby: { s12: 1, s36: 2, landcare_within_500ft: 4, gardens_within_500ft: 0 },
    },
  },
};

describe('OPA accounts', () => {
  it('accepts exactly nine digits and nothing else', () => {
    expect(isOpaAccount('123456789')).toBe(true);
    for (const bad of ['12345678', '1234567890', '12345678a', ' 123456789', '123456789 ', "123456789' OR 1=1", '', null, 123456789]) {
      expect(isOpaAccount(bad), String(bad)).toBe(false);
    }
  });

  it('pads City values that lost a leading zero, and refuses anything else', () => {
    expect(normalizeAccount('72106400')).toBe('072106400');
    expect(normalizeAccount(72106400)).toBe('072106400');
    expect(normalizeAccount(' 372106400 ')).toBe('372106400');
    expect(normalizeAccount('37210640A')).toBeNull();
    expect(normalizeAccount('1234567')).toBeNull();
    expect(normalizeAccount(null)).toBeNull();
  });

  it('names a shard by the first four digits', () => {
    expect(shardPrefix('990000005')).toBe('9900');
    expect(shardPath('371000001')).toBe('dossiers/3710.json');
    expect(() => shardPrefix('99')).toThrow();
  });
});

describe('finding a parcel\'s shard', () => {
  const manifest = parseManifest(MANIFEST).manifest!;

  it('reads the manifest\'s dossiers block, and tolerates manifests without one', () => {
    expect(manifest.dossiers).toEqual({
      prefix_digits: 4,
      prefixes: new Set(['9900']),
      files: 1,
      bytes: expect.any(Number),
      history: { files: 1, bytes: expect.any(Number), parts: ['li'] },
    });
    const older = structuredClone(MANIFEST);
    delete older.dossiers;
    expect(parseManifest(older).manifest!.dossiers).toBeNull();
    const odd = structuredClone(MANIFEST);
    odd.dossiers = { prefix_digits: 4, prefixes: ['9900', '12', 'abcd'] };
    const parsed = parseManifest(odd);
    expect(parsed.manifest!.dossiers!.prefixes).toEqual(new Set(['9900']));
    expect(parsed.problems.some((p) => p.includes('"12"'))).toBe(true);
    expect(parseManifest({ ...structuredClone(MANIFEST), dossiers: null }).manifest!.dossiers).toBeNull();
  });

  it('asks only for a shard the manifest says exists', () => {
    expect(shardLocation('990000005', manifest)).toEqual({ path: 'dossiers/9900.json' });
    expect(shardLocation('371000001', manifest)).toEqual({ path: null, reason: 'unlisted' });
    expect(shardLocation('371000001', { ...manifest, dossiers: null })).toEqual({ path: null, reason: 'unpublished' });
    expect(shardLocation('371000001', null)).toEqual({ path: 'dossiers/3710.json' });
    // Manifests from before the dossiers block listed each shard in files.
    const listed = { ...manifest, dossiers: null, files: { 'dossiers/990.json': { bytes: 1, sha256: null } } };
    expect(shardLocation('990000005', listed)).toEqual({ path: 'dossiers/990.json' });
    expect(shardLocation('371000001', listed)).toEqual({ path: null, reason: 'unlisted' });
  });

  it('keeps the shared wording and the owners table in files, and the shards out of it', () => {
    expect(Object.keys(MANIFEST.files)).toEqual(expect.arrayContaining(['dossiers/common.json', 'tables/owners.json']));
    expect(Object.keys(MANIFEST.files).filter((p) => /^dossiers\/\d+\.json$/.test(p))).toEqual([]);
    expect(MANIFEST.dossiers.bytes).toBe(readFileSync(new URL('../fixtures/data/dossiers/9900.json', import.meta.url)).length);
  });
});

describe('reading a shard', () => {
  it('reads the contract example field by field', () => {
    const { shard, error, problems } = parseShard(CONTRACT_EXAMPLE);
    expect(error).toBeNull();
    expect(problems).toEqual([]);
    const parcel = shard!.parcels.get('371000001')!;
    expect(shard!.generatedAt).toBe('2026-10-05T10:03:12Z');
    expect(shard!.notes).toBeNull();
    expect(parcel.address).toBe('2931 N LAWRENCE ST');
    expect(parcel.vacancy).toEqual({ kind: 'lot', confidence: 'high', rs: 13, n: 2, dy: null, sy: null, ny: null });
    expect(parcel.owner).toEqual({
      names: ['MORALES ROSA'],
      mailing: '41 ORCHARD RD, CHERRY HILL NJ 08002',
      type: 'individual',
      typeReason: "The owner name looks like a person's name.",
      flags: [
        { id: 'absentee', text: 'The owner gets mail somewhere else: Cherry Hill, NJ (out of state).', careful: null, nextStep: null, links: [], list: null, parcels: null },
        { id: 'years_since_sale', text: 'Last sold in 1987.', careful: null, nextStep: null, links: [], list: null, parcels: null },
      ],
      cityOwned: null,
      notice: 'deed_fraud',
      help: ['tangled_title_help', 'fraud_guard'],
    });
    expect(parcel.transfers).toEqual([
      { date: '2016-08-09', type: "SHERIFF'S DEED", price: 12300, from: ['...'], to: ['...'], fromMore: 0, toMore: 0, properties: 1 },
    ]);
    expect(parcel.assessments).toEqual([
      { year: 2027, marketValue: 13800 },
      { year: 2026, marketValue: 13800 },
    ]);
    expect(parcel.li).toEqual({
      openViolations: 1,
      lastViolation: '2025-08-01',
      unsafe: false,
      imminentlyDangerous: false,
      violations: 2,
      unsafeSince: null,
      dangerousSince: null,
      sealed: null,
      demolished: null,
    });
    expect(parcel.routes).toEqual(['ask_the_owner', 'conservatorship']);
    expect(parcel.suggestions).toEqual(['clean_and_green']);
    expect(parcel.nearby).toEqual({ s12: 1, s36: 2, killed: null, landcare: 4, gardens: 0, hearings: null, playground: null });
  });

  it('reads the committed fixture without a single problem', () => {
    const { shard, error, problems } = parseShard(SHARD);
    expect(error).toBeNull();
    expect(problems).toEqual([]);
    expect(shard!.parcels.size).toBe(Object.keys(SHARD.parcels).length);
    for (const opa of shard!.parcels.keys()) expect(shardPrefix(opa)).toBe('9900');
  });

  it('keeps the fixture in step with the map: kind, confidence and reasons match each parcel\'s tile', () => {
    const { shard } = parseShard(SHARD);
    for (const [opa, parcel] of shard!.parcels) {
      const tile = tiles.features.find((f) => f.properties.id === opa)?.properties;
      if (!tile) {
        // Parcels the vacancy model leaves out are in the shard but not on the map.
        expect(parcel.vacancy).toBeNull();
        continue;
      }
      expect(parcel.vacancy?.kind).toBe(tile.k === 1 ? 'lot' : 'building');
      expect(parcel.vacancy?.confidence).toBe({ 3: 'high', 2: 'medium', 1: 'low' }[tile.vc as number]);
      expect(parcel.vacancy?.rs).toBe(tile.rs);
      expect(parcel.vacancy?.n).toBe(tile.n);
      for (const key of ['dy', 'sy', 'ny'] as const) expect(parcel.vacancy?.[key] ?? undefined).toBe(tile[key]);
      // The map's first step to get permission is the dossier's first route, as in the pipeline,
      // passing over the side yard route, which is for the household next door only (issue #36).
      const first = parcel.routes.find((id) => id !== 'land_bank_side_yard') ?? parcel.routes[0] ?? null;
      expect(PERMISSION_ROUTE[tile.rt as PermissionCode], opa).toBe(first);
      // The map marks the lots the City's land agencies list as available, as the dossier does.
      expect(tile.la === 1, opa).toBe(parcel.owner?.cityOwned?.available === true);
      // And those of them that may go to the neighbor next door as a side yard.
      expect(tile.ly === 1, opa).toBe(parcel.owner?.cityOwned?.available === true && parcel.owner?.cityOwned?.sideYardEligible === true);
    }
  });

  it('covers every flag type, both ways of leaving the vacancy block out, and a parcel with no point', () => {
    const ids = new Set(Object.values(SHARD.parcels).flatMap((p: any) => (p.owner?.flags ?? []).map((f: any) => f.id)));
    for (const id of ['absentee', 'possible_estate', 'tax_debt_2025', 'sheriff_sales', 'years_since_sale', 'many_parcels', 'fast_resales', 'open_violations', 'unsafe']) {
      expect(ids.has(id), id).toBe(true);
    }
    expect('vacancy' in SHARD.parcels['990000098']).toBe(false);
    expect(SHARD.parcels['990000099'].vacancy).toBeNull();
    expect(SHARD.parcels['990000013'].nearby).toEqual({});
    expect(parseShard(SHARD).shard!.parcels.get('990000013')!.nearby).toBeNull();
  });

  it('copies only the contract\'s fields, so nothing else in the file can reach the page', () => {
    const raw = structuredClone(CONTRACT_EXAMPLE.parcels['371000001']) as any;
    raw.acquisition_price = 2500;
    raw.ease_of_acquisition = 'easy';
    raw.owner.phone = '215 555 0100';
    raw.owner.deceased = true;
    raw.transfers[0].estimated_value = 99999;
    raw.vacancy.reasons = ['an old style sentence'];
    const parcel = parseShardParcel(raw)!;
    const text = JSON.stringify(parcel);
    for (const word of ['acquisition', 'ease', 'phone', '215 555', 'deceased', 'estimated', '99999', 'old style']) {
      expect(text).not.toContain(word);
    }
  });

  it('refuses a file it cannot use, and skips what it cannot read', () => {
    expect(parseShard(null).error).toMatch(/not a JSON object/);
    expect(parseShard({ schema: 2, parcels: {} }).error).toMatch(/schema 2/);
    expect(parseShard({ schema: 1 }).error).toMatch(/no parcels/);
    const odd = parseShard({
      schema: 1,
      generated_at: 'not a date',
      parcels: {
        '12345': {},
        '123456789': {
          address: 7,
          owner: { names: 'ONE NAME', type: 'mystery', flags: [{ id: 'Bad Id', text: 'x' }, { id: 'ok' }], notice: 'Not An Id', help: 'fraud_guard' },
          transfers: 'none',
          assessments: [{ year: 'soon' }, ['2026', 5], [1700, 9]],
        },
      },
    });
    expect(odd.error).toBeNull();
    expect(odd.shard!.generatedAt).toBeNull();
    expect([...odd.shard!.parcels.keys()]).toEqual(['123456789']);
    const parcel = odd.shard!.parcels.get('123456789')!;
    expect(parcel.address).toBeNull();
    expect(parcel.owner).toEqual({ names: [], mailing: null, type: 'unknown', typeReason: null, flags: [], cityOwned: null, notice: null, help: [] });
    expect(parcel.transfers).toBeNull();
    expect(parcel.assessments).toEqual([{ year: 2026, marketValue: 5 }]);
    expect(odd.problems.length).toBeGreaterThan(0);
  });

  it('reads the optional parts: the City list, more names, LandCare, a garden, the owner list id', () => {
    const parcel = parseShardParcel({
      owner: {
        names: ['A'],
        type: 'land_bank',
        city_owned: { agency: 'PLB', status: 'Owned - Available', side_yard_eligible: true, available: true },
        flags: [{ id: 'many_parcels', text: 'This owner holds 7 vacant parcels in the city.', data: { count: 7, list: '3f2a9c1b7d04' } }],
      },
      transfers: [{ date: '2020-01-02', type: 'DEED', price: null, from: ['A'], to: ['B'], from_more: 3, properties: 4 }],
      landcare: { program: 'community_landcare', year: 2019 },
      garden: true,
    })!;
    expect(parcel.owner!.cityOwned).toEqual({ agency: 'PLB', status: 'Owned - Available', sideYardEligible: true, available: true });
    // Only a true value counts as listed (issue #36).
    const unlisted = parseShardParcel({ owner: { names: [], type: 'city', city_owned: { agency: 'PUB', status: 'Owned - On Hold', available: 'yes' } } })!;
    expect(unlisted.owner!.cityOwned).toEqual({ agency: 'PUB', status: 'Owned - On Hold', sideYardEligible: false, available: false });
    expect(parcel.owner!.flags[0]!.list).toBe('3f2a9c1b7d04');
    expect(parcel.transfers![0]).toMatchObject({ price: null, fromMore: 3, toMore: 0, properties: 4 });
    expect(parcel.landcare).toEqual({ program: 'community_landcare', year: 2019 });
    expect(parcel.garden).toBe(true);
  });

  it('reads the lens values a lot\'s map tile carries, and nothing else there', () => {
    const parcel = parseShardParcel({ lens: { f_vacant: 100, f_shoot: 57.4, f_walk: 12, fp: 2, f_bad: 140, f_neg: -1, fx: 3, fp2: 1, sg: 'x', 'f_Upper': 4 } })!;
    expect(parcel.lens).toEqual({ f_vacant: 100, f_shoot: 57, f_walk: 12, fp: 2 });
    expect(parseShardParcel({ lens: { fp: 3, f_bad: 'high' } })!.lens).toBeNull();
    expect(parseShardParcel({})!.lens).toBeNull();
  });

  it('reads the parts a dossier was not built from, and nothing else there', () => {
    expect(parseShardParcel({ partial: ['transfers', 'li', 'tax', 'transfers'] })!.partial).toEqual(['transfers', 'li']);
    expect(parseShardParcel({})!.partial).toEqual([]);
    expect(parseShardParcel({ partial: ['assessments'], transfers: null, assessments: null })!).toMatchObject({ transfers: null, assessments: null });
  });

  it('reads a person\'s other parcels from the flag itself, never from the owners table', () => {
    const parcel = parseShardParcel({
      owner: {
        names: ['PARKER JAMES'],
        type: 'individual',
        flags: [
          {
            id: 'many_parcels',
            text: 'This owner holds 5 vacant parcels in the city.',
            data: {
              count: 5,
              parcels: [
                { id: '372000002', address: '2904 N 5TH ST', kind: 'lot', confidence: 'medium' },
                { id: '37200000x', address: 'not an account' },
                { id: '372000003', address: '2906 N 5TH ST', kind: 'shed', confidence: 'sure' },
              ],
            },
          },
        ],
      },
    })!;
    const flag = parcel.owner!.flags[0]!;
    expect(flag.list).toBeNull();
    expect(flag.parcels).toEqual([
      { id: '372000002', address: '2904 N 5TH ST', kind: 'lot', confidence: 'medium' },
      { id: '372000003', address: '2906 N 5TH ST', kind: null, confidence: null },
    ]);
  });
});

describe('the shared wording (dossiers/common.json)', () => {
  const notes = parseCommon(COMMON)!;

  it('has the careful note and next step of every flag, and the deed fraud notice', () => {
    for (const id of ['absentee', 'possible_estate', 'tax_debt_2025', 'sheriff_sales', 'years_since_sale', 'many_parcels', 'fast_resales', 'open_violations', 'unsafe', 'imminently_dangerous']) {
      expect(notes.flags[id]?.careful, id).toBeTruthy();
      expect(notes.flags[id]?.nextStep, id).toBeTruthy();
    }
    expect(notes.notices.deed_fraud?.text).toMatch(/Fraud Guard/);
    expect(notes.flags.tax_debt_2025!.links.map((l) => l.url)).toContain('https://tax-services.phila.gov/');
  });

  it('puts the possible estate flag together exactly as docs/ETHICS.md words it', () => {
    const quoted = /"Possible estate" reads: \*"([^"]+)"\*/s.exec(ETHICS)![1]!.replace(/\s+/g, ' ');
    const flag = SHARD.parcels['990000005'].owner.flags.find((f: { id: string }) => f.id === 'possible_estate');
    expect([flag.text, notes.flags.possible_estate!.careful, notes.flags.possible_estate!.nextStep].join(' ')).toBe(quoted);
  });

  it('refuses a file with the wrong schema', () => {
    expect(parseCommon({ ...COMMON, schema: 2 })).toBeNull();
    expect(parseCommon('nope')).toBeNull();
  });
});

describe('the owners table (tables/owners.json)', () => {
  it('reads each owner\'s parcels, and the account only lists of older files', () => {
    const table = parseOwnersTable(OWNERS)!;
    const list = table.get('3f2a9c1b7d04')!;
    expect(list.names).toEqual(['EXAMPLE HOLDINGS LLC']);
    expect(list.parcels.length).toBeGreaterThanOrEqual(5);
    expect(list.parcels[0]).toEqual({ id: '990000004', address: '1301 N EXAMPLE AVE', kind: 'building', confidence: 'medium' });
    const older = parseOwnersTable({ schema: 1, owners: { abc: { names: ['X LLC'], parcels: ['372000001', 'bad'] } } })!;
    expect(older.get('abc')!.parcels).toEqual([{ id: '372000001', address: null, kind: null, confidence: null }]);
    expect(parseOwnersTable({ schema: 2, owners: {} })).toBeNull();
  });

  it('loads a list once, only when the manifest lists the table', async () => {
    clearOwnersTable();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(OWNERS), { status: 200 }));
    expect(await loadOwnerList('https://example.org/data/', '3f2a9c1b7d04', {}, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    const files = { 'tables/owners.json': {} };
    expect((await loadOwnerList('https://example.org/data/', '3f2a9c1b7d04', files, fetchImpl))!.parcels.length).toBe(7);
    expect(await loadOwnerList('https://example.org/data/', 'no_such_list', files, fetchImpl)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('downloading', () => {
  const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('downloads a shard once and reuses it', async () => {
    clearShardCache();
    const fetchImpl = vi.fn(async () => response(SHARD));
    const a = await loadShard('https://example.org/data/', 'dossiers/9900.json', fetchImpl);
    const b = await loadShard('https://example.org/data/', 'dossiers/9900.json', fetchImpl);
    expect(a.ok && b.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://example.org/data/dossiers/9900.json');
  });

  it('says so when a shard cannot be read, and tries again next time', async () => {
    clearShardCache();
    const failing = vi.fn(async () => response({ nope: true }, 500));
    expect(await loadShard('https://example.org/data/', 'dossiers/9900.json', failing)).toEqual({ ok: false, reason: 'failed' });
    await new Promise((r) => setTimeout(r, 0));
    const working = vi.fn(async () => response(SHARD));
    expect((await loadShard('https://example.org/data/', 'dossiers/9900.json', working)).ok).toBe(true);
    clearShardCache();
    const missing = vi.fn(async () => response({}, 404));
    expect(await loadShard('https://example.org/data/', 'dossiers/9900.json', missing)).toEqual({ ok: false, reason: 'not_published' });
  });

  it('downloads the shared wording once, only when the manifest lists it', async () => {
    clearShardCache();
    const fetchImpl = vi.fn(async () => response(COMMON));
    expect(await loadCommon('https://example.org/data/', {}, fetchImpl)).toBeNull();
    const files = { 'dossiers/common.json': {} };
    expect(await loadCommon('https://example.org/data/', files, fetchImpl)).not.toBeNull();
    expect(await loadCommon('https://example.org/data/', files, fetchImpl)).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
