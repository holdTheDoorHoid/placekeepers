// Live lookups, with no network: the City queries are built only from a nine digit account or a
// point inside Philadelphia, typed text never reaches SQL, and the answers are read safely.

import { describe, expect, it, vi } from 'vitest';
import { AIS_SEARCH_URL, aisSearchUrl, cleanSearchText, parseAisResponse, searchAddress } from '../src/dossier/ais.ts';
import {
  CARTO_SQL_URL,
  UnsafeQueryInput,
  accountLiteral,
  assessmentsSql,
  cartoUrl,
  fetchProperty,
  liSql,
  mailingText,
  nearbySql,
  parcelAtPointSql,
  parcelShapeSql,
  pointSql,
  propertySql,
  readAssessments,
  readLi,
  readParcelsAtPoint,
  readProperty,
  readTransfers,
  splitNames,
  transfersSql,
} from '../src/dossier/carto.ts';
import { fetchJson } from '../src/dossier/http.ts';

const ACCOUNT_BUILDERS = { propertySql, transfersSql, assessmentsSql, liSql, parcelShapeSql };

const NOT_NINE_DIGITS: unknown[] = [
  '12345678',
  '1234567890',
  '12345678a',
  ' 123456789',
  '123456789\n',
  "123456789' OR '1'='1",
  "'; DROP TABLE opa_properties_public; --",
  '１２３４５６７８９',
  '',
  null,
  undefined,
  123456789,
  ['123456789'],
];

describe('queries are built only from a nine digit account', () => {
  it.each(Object.entries(ACCOUNT_BUILDERS))('%s refuses anything that is not exactly nine digits', (_name, build) => {
    for (const bad of NOT_NINE_DIGITS) {
      expect(() => build(bad as string), String(bad)).toThrow(UnsafeQueryInput);
    }
  });

  it.each(Object.entries(ACCOUNT_BUILDERS))('%s puts the account in only as quoted digits', (_name, build) => {
    const sql = build('372106400');
    const literals = sql.match(/'[^']*'/g) ?? [];
    expect(literals).toContain("'372106400'");
    for (const literal of literals) expect(literal).toMatch(/^'(372106400|[A-Za-z_%' ]+|DEED|OPEN|RESOLVED)'$/);
  });

  it('asks only for the columns the lot page shows', () => {
    const all = Object.values(ACCOUNT_BUILDERS).map((build) => build('372106400')).join(' ');
    for (const column of ['casenumber', 'contractor', 'applicant', 'opa_owner', 'race', 'age', 'sex', 'SELECT *']) {
      expect(all.toLowerCase()).not.toContain(column.toLowerCase());
    }
    expect(propertySql('372106400')).toContain("FROM opa_properties_public WHERE parcel_number = '372106400'");
    expect(transfersSql('372106400')).toContain("FROM rtt_summary WHERE opa_account_num = '372106400'");
    // The date and price the City's property page shows, with the older fields to fall back on.
    for (const column of ['display_date', 'recording_date', 'adjusted_total_consideration', 'total_consideration']) {
      expect(transfersSql('372106400')).toContain(column);
    }
    expect(transfersSql('372106400')).toContain('ORDER BY COALESCE(display_date, recording_date) DESC');
    expect(assessmentsSql('372106400')).toContain("FROM assessments WHERE parcel_number = '372106400'");
    for (const table of ['violations', 'permits', 'demolitions', 'unsafe', 'imm_dang', 'clean_seal']) {
      expect(liSql('372106400')).toContain(`FROM ${table} WHERE opa_account_num = '372106400'`);
    }
  });

  it('accountLiteral is the one door into SQL for an account', () => {
    expect(accountLiteral('000000001')).toBe("'000000001'");
    expect(() => accountLiteral('0000000O1')).toThrow(UnsafeQueryInput);
  });
});

describe('queries at a point take only two numbers inside Philadelphia', () => {
  it('writes the point with digits only', () => {
    expect(pointSql(-75.1438045, 39.9995728)).toBe('ST_SetSRID(ST_MakePoint(-75.143805, 39.999573), 4326)');
    expect(parcelAtPointSql(-75.1438, 39.9996)).toContain('FROM pwd_parcels WHERE ST_Intersects(the_geom, ST_SetSRID(ST_MakePoint(-75.143800, 39.999600), 4326))');
    const nearby = nearbySql(-75.1438, 39.9996);
    expect(nearby).toContain('FROM shootings');
    expect(nearby).toContain('FROM fatal_crashes');
    expect(nearby).toContain('152.4');
    // Counts only: nothing about the people shot or killed is read.
    expect(nearby).not.toMatch(/race|sex|age|dc_key|location|offender/);
  });

  it('refuses text, infinities and places outside the city', () => {
    const bad: [unknown, unknown][] = [
      ['-75.1', '39.9'],
      [Number.NaN, 39.9],
      [Number.POSITIVE_INFINITY, 39.9],
      [-75.1, null],
      [-74.0, 40.7], // New York
      [-75.6, 39.9], // west of the city
      [-75.1, 40.5],
    ];
    for (const [lng, lat] of bad) {
      expect(() => pointSql(lng, lat), `${String(lng)}, ${String(lat)}`).toThrow(UnsafeQueryInput);
      expect(() => nearbySql(lng as number, lat as number)).toThrow(UnsafeQueryInput);
    }
  });

  it('puts the whole query in the address, encoded', () => {
    const url = cartoUrl(propertySql('372106400'));
    expect(url.startsWith(`${CARTO_SQL_URL}?q=`)).toBe(true);
    expect(decodeURIComponent(url.slice(url.indexOf('=') + 1))).toBe(propertySql('372106400'));
    expect(url).not.toContain(' ');
  });
});

describe('address search never reaches SQL', () => {
  it('cleans and encodes the typed text into the address service only', () => {
    expect(cleanSearchText('  1234   Market St \n')).toBe('1234 Market St');
    expect(cleanSearchText(' x ')).toBeNull();
    expect(cleanSearchText('a'.repeat(500))!.length).toBe(100);
    const url = aisSearchUrl("1234 Market St'; DROP TABLE x; --/../?q=1#top");
    expect(url.startsWith(AIS_SEARCH_URL)).toBe(true);
    expect(url).not.toContain(CARTO_SQL_URL);
    expect(url.slice(AIS_SEARCH_URL.length)).not.toMatch(/[\s/?#]/);
    expect(() => aisSearchUrl('  ')).toThrow();
  });

  it('sends typed text to the address service and never to the City database', async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      seen.push(String(url));
      return new Response(JSON.stringify({ features: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    await searchAddress('1234 Market St', { fetchImpl });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.startsWith(AIS_SEARCH_URL)).toBe(true);
    expect(seen.some((u) => u.startsWith(CARTO_SQL_URL))).toBe(false);
  });

  it('reads addresses and intersections inside the city, with nine digit accounts only', () => {
    const results = parseAisResponse({
      features: [
        {
          ais_feature_type: 'address',
          properties: { street_address: '1234 MARKET ST', opa_account_num: '883309050' },
          geometry: { coordinates: [-75.16097, 39.95166] },
        },
        { ais_feature_type: 'address', properties: { street_address: '2400 N 20TH ST', opa_account_num: '' }, geometry: { coordinates: [-75.165, 39.9908] } },
        { ais_feature_type: 'address', properties: { street_address: 'BAD ACCOUNT', opa_account_num: 'x1' }, geometry: { coordinates: [-75.1, 39.95] } },
        { ais_feature_type: 'intersection', street_address: 'N BROAD ST & W GIRARD AVE', geometry: { coordinates: [-75.1594, 39.9714] } },
        { ais_feature_type: 'address', properties: { street_address: 'FAR AWAY' }, geometry: { coordinates: [-73.9, 40.7] } },
        { ais_feature_type: 'address', properties: { street_address: 'NO POINT' }, geometry: {} },
        'garbage',
      ],
    });
    expect(results).toEqual([
      { kind: 'address', label: '1234 MARKET ST', opa: '883309050', lng: -75.16097, lat: 39.95166 },
      { kind: 'address', label: '2400 N 20TH ST', opa: null, lng: -75.165, lat: 39.9908 },
      { kind: 'address', label: 'BAD ACCOUNT', opa: null, lng: -75.1, lat: 39.95 },
      { kind: 'intersection', label: 'N BROAD ST & W GIRARD AVE', opa: null, lng: -75.1594, lat: 39.9714 },
    ]);
    expect(parseAisResponse(null)).toEqual([]);
    expect(parseAisResponse({ features: 'x' })).toEqual([]);
  });

  it('says why a search did not work', async () => {
    const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    expect(await searchAddress('zzzz nowhere', { fetchImpl: answer(404, { status: 404 }) })).toEqual({ ok: false, reason: 'not_found' });
    expect(await searchAddress('1234 Market St', { fetchImpl: answer(503, {}) })).toEqual({ ok: false, reason: 'http' });
    expect(await searchAddress('1234 Market St', { fetchImpl: answer(200, { features: [] }) })).toEqual({ ok: false, reason: 'not_found' });
    expect(await searchAddress(' ')).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('asking the City, with a time limit', () => {
  it('gives up after the time limit and says it timed out', async () => {
    const never = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;
    const started = Date.now();
    expect(await fetchJson('https://example.org/slow', { fetchImpl: never, timeoutMs: 30 })).toEqual({ ok: false, reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('tells a network failure, an error answer, unreadable data and a cancel apart', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await fetchJson('https://example.org/', { fetchImpl: offline })).toEqual({ ok: false, reason: 'network' });
    const error = vi.fn(async () => new Response('{"error":["bad"]}', { status: 400 })) as unknown as typeof fetch;
    expect(await fetchJson('https://example.org/', { fetchImpl: error })).toEqual({ ok: false, reason: 'http', status: 400 });
    const garbled = vi.fn(async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch;
    expect(await fetchJson('https://example.org/', { fetchImpl: garbled })).toEqual({ ok: false, reason: 'bad_data' });
    const cancelled = new AbortController();
    cancelled.abort();
    expect(await fetchJson('https://example.org/', { fetchImpl: offline, signal: cancelled.signal })).toEqual({ ok: false, reason: 'aborted' });
  });

  it('sends no cookies and no referrer to the City', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"rows":[]}', { status: 200 })) as unknown as typeof fetch;
    await fetchProperty('372106400', { fetchImpl });
    const init = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1];
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
  });

  it('says "not found" when the City has no record of the account', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"rows":[]}', { status: 200 })) as unknown as typeof fetch;
    expect(await fetchProperty('372106400', { fetchImpl })).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('reading the City\'s answers', () => {
  it('reads a property record, with the mailing address as the City publishes it', () => {
    const property = readProperty('372106400', [
      {
        parcel_number: '372106400',
        location: '3134 N 8TH ST',
        owner_1: 'JEREZ JUNIOR A CELESTE',
        owner_2: null,
        mailing_care_of: null,
        mailing_address_1: null,
        mailing_address_2: null,
        mailing_street: '3132 N 08TH ST',
        mailing_city_state: 'PHILADELPHIA PA',
        mailing_zip: '19133',
        category_code_description: 'VACANT LAND',
        building_code_description: 'VACANT LAND RESIDE < ACRE',
        sale_date: '2025-11-24T05:00:00Z',
        sale_price: 18540,
        market_value: 13000,
        homestead_exemption: 100000,
        lat: 39.9995727885081,
        lng: -75.1438045080555,
      },
    ]);
    expect(property).toMatchObject({
      opa: '372106400',
      address: '3134 N 8TH ST',
      names: ['JEREZ JUNIOR A CELESTE'],
      mailing: '3132 N 08TH ST, PHILADELPHIA PA 19133',
      category: 'VACANT LAND',
      saleDate: '2025-11-24',
      salePrice: 18540,
      marketValue: 13000,
      homestead: true,
    });
    expect(readProperty('372106400', [{ parcel_number: '372106400', homestead_exemption: 0 }])!.homestead).toBe(false);
    expect(readProperty('372106400', [{ parcel_number: '372106400' }])!.homestead).toBe(false);
    expect(readProperty('372106400', [{ parcel_number: '999999999' }])).toBeNull();
  });

  it('joins mailing lines without repeats or blanks', () => {
    expect(mailingText(['C/O SAMPLE LAW', null, '  ', '12 MAIN ST', '12 MAIN ST', 'CAMDEN NJ 08102'])).toBe('C/O SAMPLE LAW, 12 MAIN ST, CAMDEN NJ 08102');
    expect(mailingText([null, ''])).toBeNull();
  });

  it('reads deeds newest first, once each, with the date on the deed and the adjusted total', () => {
    const transfers = readTransfers([
      { document_id: 2, document_type: 'DEED', display_date: '2022-12-26T10:00:00Z', recording_date: '2023-01-04T15:00:00Z', grantors: 'KWAJIN VAN', grantees: 'FAN HENMEI', adjusted_total_consideration: 8000, total_consideration: 8000, property_count: 1 },
      { document_id: 3, document_type: 'DEED', display_date: '2023-12-29T02:46:39Z', recording_date: '2024-01-03T18:23:31Z', grantors: 'FAN HENMEI', grantees: 'JEREZ JUNIOR A CELESTE', adjusted_total_consideration: 17500.25, total_consideration: 70001, property_count: 4 },
      { document_id: 3, document_type: 'DEED', display_date: '2023-12-29T02:46:39Z', grantors: 'FAN HENMEI', grantees: 'JEREZ JUNIOR A CELESTE' },
      { document_id: 1, document_type: 'DEED SHERIFF', recording_date: '2017-01-21T05:00:00Z', grantors: 'OWENS BRUCE S; OWENS CARLETTA MILLS', grantees: 'VAN QIANJIANG KWAJIN', total_consideration: 1600, property_count: 2 },
    ]);
    // 02:46 UTC on December 29 is the evening of December 28 in Philadelphia, as the City's page shows it.
    expect(transfers.map((t) => t.date)).toEqual(['2023-12-28', '2022-12-26', '2017-01-21']);
    // The adjusted total is this property's share, to the cent; without one, the total is used.
    expect(transfers[0]).toMatchObject({ price: 17500.25, from: ['FAN HENMEI'], to: ['JEREZ JUNIOR A CELESTE'], properties: 4 });
    expect(transfers[2]).toMatchObject({ type: 'DEED SHERIFF', price: 1600, from: ['OWENS BRUCE S', 'OWENS CARLETTA MILLS'], properties: 2 });
    expect(splitNames(' A ;B;; C ')).toEqual(['A', 'B', 'C']);
  });

  it('reads assessments by year, newest first, whatever type the year has', () => {
    expect(readAssessments([{ year: '2025', market_value: 14000 }, { year: 2027, market_value: '13000' }, { year: 'x' }, { year: '2026', market_value: null }])).toEqual([
      { year: 2027, marketValue: 13000 },
      { year: 2026, marketValue: null },
      { year: 2025, marketValue: 14000 },
    ]);
  });

  it('reads the L&I timeline and knows what is still open', () => {
    const li = readLi([
      { kind: 'violation', date: '2022-05-10T04:00:00Z', title: 'EXTERIOR WALLS', status: 'COMPLIED', detail: 'CLOSED' },
      { kind: 'violation', date: '2025-08-01T04:00:00Z', title: 'VACANT STRUCTURE AND LAND', status: 'OPEN', detail: 'IN VIOLATION' },
      { kind: 'unsafe', date: '2023-05-02T14:00:00Z', title: 'UNSAFE STRUCTURE', status: 'OPEN', detail: null },
      { kind: 'permit', date: '2022-07-15T04:00:00Z', title: 'Minor Demolition', status: 'Completed', detail: 'Demolition Permit' },
      { kind: 'nonsense', date: '2020-01-01', title: 'x', status: 'OPEN' },
    ]);
    expect(li.events.map((e) => [e.kind, e.date, e.open])).toEqual([
      ['violation', '2025-08-01', true],
      ['unsafe', '2023-05-02', true],
      ['permit', '2022-07-15', false],
      ['violation', '2022-05-10', false],
    ]);
    expect(li.truncated).toBe(false);
  });

  it('reads the parcel under a point, with its outline', () => {
    const shape = '{"type":"MultiPolygon","coordinates":[[[[-75.1437,39.9995],[-75.1439,39.9995],[-75.1439,39.9996],[-75.1437,39.9995]]]]}';
    expect(readParcelsAtPoint([{ brt_id: '372106400', address: '3134 N 8TH ST', shape }, { brt_id: 'bad', shape }, { brt_id: '372106400', shape }])).toEqual([
      { opa: '372106400', address: '3134 N 8TH ST', shape: JSON.parse(shape) },
    ]);
    expect(readParcelsAtPoint([{ brt_id: '72106400', shape: 'not json' }])).toEqual([{ opa: '072106400', address: null, shape: null }]);
  });
});
