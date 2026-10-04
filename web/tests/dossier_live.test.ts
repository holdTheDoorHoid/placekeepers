// Opening a lot page with live City data, with a fake City and no network: each part arrives on
// its own, a slow City times out into the snapshot, opening another lot cancels the first, recent
// answers are reused, and turning live data off stops asking. Also the "Fetch live City data"
// option, which stays in this browser and never travels in a link.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { parseManifest, type Manifest } from '../src/data/manifest.ts';
import { DossierController } from '../src/dossier/controller.svelte.ts';
import { clearShardCache } from '../src/dossier/shard.ts';
import { defaultState } from '../src/state/defaults.ts';
import { LIVE_CITY_DATA, decodeOptions, defaultOptions, encodeOptions, readOptions, saveOptions } from '../src/state/options.ts';
import { encodeState } from '../src/state/url.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const SHARD = read('../fixtures/data/dossiers/9900.json');
const COMMON = read('../fixtures/data/dossiers/common.json');
const manifest = parseManifest(JSON.parse(read('../fixtures/data/manifest.json'))).manifest!;
const BASE = 'https://example.org/data/';

const PROPERTY_ROW = {
  parcel_number: '990000005',
  location: '1305 N EXAMPLE AVE',
  owner_1: 'SAMPLE ROSE M EST OF',
  owner_2: null,
  mailing_street: '455 EXAMPLE AVE',
  mailing_city_state: 'CHERRY HILL NJ',
  mailing_zip: '08002',
  category_code_description: 'VACANT LAND',
  sale_date: '1987-06-12T04:00:00Z',
  sale_price: 15000,
  market_value: 12000,
  lat: 39.98513,
  lng: -75.15572,
};

type Answer = { status?: number; body?: unknown; hang?: boolean };

/** A fake City and data root: answers by the table a query reads, and counts what it is asked. */
function fakeCity(answers: Partial<Record<string, Answer>> = {}) {
  const asked: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    let key = url;
    if (url.startsWith(BASE)) key = url.slice(BASE.length);
    else if (url.startsWith('https://phl.carto.com/')) {
      const sql = decodeURIComponent(url.slice(url.indexOf('q=') + 2));
      key = /FROM opa_properties_public/.test(sql)
        ? 'property'
        : /FROM rtt_summary/.test(sql)
          ? 'transfers'
          : /FROM assessments/.test(sql)
            ? 'assessments'
            : /FROM violations/.test(sql)
              ? 'li'
              : /FROM shootings/.test(sql)
                ? 'nearby'
                : /FROM pwd_parcels/.test(sql)
                  ? 'shape'
                  : 'other';
    }
    asked.push(key);
    const answer: Answer =
      answers[key] ??
      (key === 'dossiers/9900.json'
        ? { body: JSON.parse(SHARD) }
        : key === 'dossiers/common.json'
          ? { body: JSON.parse(COMMON) }
          : key === 'property'
            ? { body: { rows: [PROPERTY_ROW] } }
            : { body: { rows: [] } });
    if (answer.hang) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }
    return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status ?? 200 });
  }) as typeof fetch;
  return { fetchImpl, asked };
}

function controller(city: ReturnType<typeof fakeCity>, options: { liveOn?: () => boolean; manifest?: Manifest | null; timeoutMs?: number; now?: () => number } = {}) {
  clearShardCache();
  return new DossierController({
    dataBase: BASE,
    manifest: async () => (options.manifest === undefined ? manifest : options.manifest),
    liveOn: options.liveOn ?? (() => true),
    fetchImpl: city.fetchImpl,
    timeoutMs: options.timeoutMs ?? 200,
    now: options.now,
  });
}

const settle = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

describe('opening a lot page', () => {
  it('finds the parcel in its shard and asks the City for each live part', async () => {
    const city = fakeCity();
    const dossier = controller(city);
    dossier.open('990000005');
    await settle();
    expect(dossier.shard.status).toBe('found');
    expect(dossier.live.property.status).toBe('ok');
    for (const part of ['transfers', 'assessments', 'li'] as const) expect(dossier.live[part].status, part).toBe('ok');
    // The snapshot has nearby counts for this parcel, so the City is not asked for them.
    expect(dossier.live.nearby.status).toBe('idle');
    expect(city.asked).toEqual(expect.arrayContaining(['dossiers/9900.json', 'dossiers/common.json', 'property', 'transfers', 'assessments', 'li']));
    expect(city.asked).not.toContain('nearby');
  });

  it('asks nothing of the City when live data is off', async () => {
    const city = fakeCity();
    const dossier = controller(city, { liveOn: () => false });
    dossier.open('990000005');
    await settle();
    expect(dossier.shard.status).toBe('found');
    expect(Object.values(dossier.live).every((p) => p.status === 'idle')).toBe(true);
    expect(city.asked.filter((k) => !k.startsWith('dossiers/'))).toEqual([]);
  });

  it('gives up on a slow City after the time limit, so the page falls back to the snapshot', async () => {
    const city = fakeCity({ property: { hang: true }, transfers: { hang: true } });
    const dossier = controller(city, { timeoutMs: 30 });
    dossier.open('990000005');
    await settle(120);
    expect(dossier.live.property).toEqual({ status: 'failed', reason: 'timeout' });
    expect(dossier.live.transfers).toEqual({ status: 'failed', reason: 'timeout' });
    expect(dossier.live.assessments.status).toBe('ok');
    expect(dossier.shard.status).toBe('found');
  });

  it('says why a lookup failed: an error, unreadable data, or no such record', async () => {
    const city = fakeCity({ transfers: { status: 500 }, assessments: { body: '<html>' }, property: { body: { rows: [] } } });
    const dossier = controller(city);
    dossier.open('990000005');
    await settle();
    expect(dossier.live.transfers).toEqual({ status: 'failed', reason: 'http' });
    expect(dossier.live.assessments).toEqual({ status: 'failed', reason: 'bad_data' });
    expect(dossier.live.property).toEqual({ status: 'failed', reason: 'not_found' });
  });

  it('tries again when asked, only for the parts that failed', async () => {
    const answers: Partial<Record<string, Answer>> = { transfers: { status: 503 } };
    const city = fakeCity(answers);
    const dossier = controller(city);
    dossier.open('990000005');
    await settle();
    expect(dossier.live.transfers.status).toBe('failed');
    delete answers.transfers;
    const before = city.asked.length;
    dossier.retry();
    await settle();
    expect(dossier.live.transfers.status).toBe('ok');
    expect(city.asked.slice(before)).toEqual(['transfers']);
  });

  it('cancels the first lot\'s lookups when another lot opens', async () => {
    const city = fakeCity({ property: { hang: true } });
    const dossier = controller(city, { timeoutMs: 5000 });
    dossier.open('990000005');
    await settle();
    expect(dossier.live.property.status).toBe('loading');
    dossier.open('990000001');
    await settle();
    expect(dossier.opa).toBe('990000001');
    // The second lot's property lookup also hangs, but nothing from the first one lands on it.
    expect(dossier.live.property.status).toBe('loading');
    expect(dossier.shard.status === 'found' && dossier.shard.parcel.address).toBe('1201 N SAMPLE ST');
    dossier.close();
    expect(dossier.opa).toBeNull();
  });

  it('reuses answers from the last few minutes when a lot opens again', async () => {
    let clock = 1_000_000;
    const city = fakeCity();
    const dossier = controller(city, { now: () => clock });
    dossier.open('990000005');
    await settle();
    dossier.open('990000001');
    await settle();
    const before = city.asked.filter((k) => k === 'property').length;
    dossier.open('990000005');
    await settle();
    expect(city.asked.filter((k) => k === 'property').length).toBe(before);
    clock += 10 * 60 * 1000;
    dossier.open('990000001');
    await settle();
    expect(city.asked.filter((k) => k === 'property').length).toBe(before + 1);
  });

  it('builds a page for a parcel that is not on our list from live data, with nearby counts', async () => {
    const city = fakeCity({ property: { body: { rows: [{ ...PROPERTY_ROW, parcel_number: '371163500', location: '2216 N 10TH ST' }] } }, nearby: { body: { rows: [{ s12: 1, s36: 2, killed: 0 }] } } });
    const dossier = controller(city);
    dossier.open('371163500');
    await settle(40);
    expect(dossier.shard).toEqual({ status: 'absent', reason: 'unlisted' });
    expect(city.asked).not.toContain('dossiers/3711.json');
    expect(dossier.live.property.status).toBe('ok');
    expect(dossier.live.nearby).toMatchObject({ status: 'ok', data: { s12: 1, s36: 2, killed: 0 } });
    expect(dossier.center).toEqual([-75.15572, 39.98513]);
    // Its outline for the map comes from the City's parcel map.
    expect(city.asked).toContain('shape');
  });

  it('stops asking when live data is turned off, and asks again when it is turned back on', async () => {
    let on = true;
    const city = fakeCity({ property: { hang: true } });
    const dossier = controller(city, { liveOn: () => on, timeoutMs: 5000 });
    dossier.open('990000005');
    await settle();
    on = false;
    dossier.liveChanged();
    expect(Object.values(dossier.live).every((p) => p.status === 'idle')).toBe(true);
    on = true;
    dossier.liveChanged();
    expect(dossier.live.property.status).toBe('loading');
    dossier.close();
  });

  it('refuses anything that is not a nine digit account', () => {
    const dossier = controller(fakeCity());
    dossier.open("990000005' OR 1=1");
    expect(dossier.opa).toBeNull();
  });
});

describe('the "Fetch live City data" option', () => {
  const registry = loadRegistry();

  it('is on by default, described with its privacy note', () => {
    const option = registry.options.find((o) => o.id === LIVE_CITY_DATA)!;
    expect(option).toMatchObject({ type: 'toggle', default: true, label: 'Fetch live City data' });
    expect(option.description).toMatch(/straight from your device to the City/);
    expect(defaultOptions(registry)).toEqual({ [LIVE_CITY_DATA]: true });
  });

  it('is saved in this browser only when changed, and read back safely', () => {
    const memory = new Map<string, string>();
    const store = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) };
    expect(encodeOptions(registry, { [LIVE_CITY_DATA]: true })).toBeNull();
    saveOptions(registry, { [LIVE_CITY_DATA]: false }, store);
    expect(memory.get('placekeepers:v1:options')).toBe('{"live_city_data":false}');
    expect(readOptions(registry, store)).toEqual({ [LIVE_CITY_DATA]: false });
    saveOptions(registry, { [LIVE_CITY_DATA]: true }, store);
    expect(memory.has('placekeepers:v1:options')).toBe(false);
    expect(decodeOptions(registry, 'not json')).toEqual({ [LIVE_CITY_DATA]: true });
    expect(decodeOptions(registry, '{"live_city_data":"no","unknown":1}')).toEqual({ [LIVE_CITY_DATA]: true });
  });

  it('never travels in a shared link, so a link cannot turn it back on', () => {
    const state = defaultState(registry, 'analysis');
    state.selected = '990000005';
    const link = encodeState(registry, state);
    expect(link).not.toMatch(/live|option|o=/);
  });
});
