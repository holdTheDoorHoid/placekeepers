// The lot page must say exactly what the pipeline says. When live City data is on, the browser
// works out the owner flags again from the City's records (src/dossier/flags.ts, owners.ts and
// transfers.ts). pipeline/tests/fixtures/wording_parity.json holds cases with the pipeline's own
// answers, written by pipeline/tests/wording_cases.py and checked against the pipeline by
// pipeline/tests/test_wording_parity.py; this file checks the web app gives the same answers.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLAG_IDS,
  absenteeText,
  flagParts,
  liFactFlags,
  ownerFlags,
  resaleText,
  sheriffText,
  sortFlags,
  transferFlags,
  violationsText,
} from '../src/dossier/flags.ts';
import { absentee, isPrivate, ownerTypeFromNames, possibleEstate, type AbsenteeScope } from '../src/dossier/owners.ts';
import type { Transfer } from '../src/dossier/types.ts';
import { strings } from '../src/strings.ts';

interface Fixture {
  as_of: string;
  notes: Record<string, { careful: string; next_step: string }>;
  possible_estate_text: string;
  deed_fraud_notice: string;
  absentee_text: { scope: AbsenteeScope; city: string | null; state: string | null; text: string }[];
  sheriff_text: { sales: [string, number | null][]; text: string }[];
  last_sale_text: { year: number; text: string }[];
  no_sale_text: { year: number; text: string }[];
  resale_text: { count: number; first: string; last: string; recent: boolean; text: string }[];
  violations_text: { count: number; last: string | null; title: string | null; text: string }[];
  unsafe_text: { since: string | null; text: string }[];
  dangerous_text: { since: string | null; text: string }[];
  owner_type: { names: string[]; type: string; reason: string }[];
  possible_estate: { names: string[]; estate: boolean }[];
  absentee: {
    location: string;
    mailing_street: string | null;
    mailing_city_state: string | null;
    mailing_zip: string | null;
    scope: AbsenteeScope | null;
    text: string | null;
  }[];
  parcels: {
    names: string[];
    location: string;
    mailing: [string | null, string | null, string | null];
    opa_sale: [string, number] | null;
    deeds: [string, string, number | null][];
    li: { open_violations?: number; last_open?: string; last_open_title?: string; unsafe_since?: string; imminently_dangerous_since?: string };
    type: string;
    flags: { id: string; text: string }[];
  }[];
}

const fixture = JSON.parse(readFileSync(new URL('../../pipeline/tests/fixtures/wording_parity.json', import.meta.url), 'utf8')) as Fixture;
const f = strings.dossier.flags;

const noLi = { openViolations: 0, lastOpen: null, lastOpenTitle: null, unsafeSince: null, dangerousSince: null };

describe('the web app says what the pipeline says', () => {
  it('has every flag\'s careful note and next step word for word', () => {
    expect(Object.keys(fixture.notes)).toEqual([...FLAG_IDS]);
    for (const [id, note] of Object.entries(fixture.notes)) {
      expect(flagParts(id), id).toEqual({ careful: note.careful, nextStep: note.next_step });
    }
    expect(f.possible_estate.text).toBe(fixture.possible_estate_text);
    expect(strings.dossier.owner.deedFraud).toBe(fixture.deed_fraud_notice);
  });

  it.each(fixture.absentee_text)('absentee text: $scope, $city, $state', (c) => {
    expect(absenteeText({ scope: c.scope, city: c.city, state: c.state })).toBe(c.text);
  });

  it.each(fixture.sheriff_text)('sheriff sales: $text', (c) => {
    expect(sheriffText(c.sales.map(([date, price]) => ({ date, price })))).toBe(c.text);
  });

  it('last sale and no sale', () => {
    for (const c of fixture.last_sale_text) expect(f.years_since_sale.lastSold(c.year)).toBe(c.text);
    for (const c of fixture.no_sale_text) expect(f.years_since_sale.notSoldSince(c.year)).toBe(c.text);
  });

  it.each(fixture.resale_text)('fast resales: $text', (c) => {
    expect(resaleText({ count: c.count, first: c.first, last: c.last, recent: c.recent })).toBe(c.text);
  });

  it.each(fixture.violations_text)('open violations: $text', (c) => {
    expect(violationsText({ ...noLi, openViolations: c.count, lastOpen: c.last, lastOpenTitle: c.title })).toBe(c.text);
  });

  it('unsafe and imminently dangerous', () => {
    for (const c of fixture.unsafe_text) {
      expect(liFactFlags({ ...noLi, unsafeSince: c.since ?? '' })[0]?.text).toBe(c.text);
    }
    for (const c of fixture.dangerous_text) {
      expect(liFactFlags({ ...noLi, dangerousSince: c.since ?? '' })[0]?.text).toBe(c.text);
    }
  });

  it.each(fixture.owner_type)('owner type of $names', (c) => {
    expect(ownerTypeFromNames(c.names)).toEqual({ type: c.type, reason: c.reason });
  });

  it.each(fixture.possible_estate)('possible estate of $names', (c) => {
    expect(possibleEstate(c.names)).toBe(c.estate);
  });

  it.each(fixture.absentee)('absentee: $location, mail to $mailing_street, $mailing_city_state', (c) => {
    const found = absentee(c.location, c.mailing_street, c.mailing_city_state, c.mailing_zip);
    expect(found?.scope ?? null).toBe(c.scope);
    expect(found ? absenteeText(found) : null).toBe(c.text);
  });

  it.each(fixture.parcels)('every flag of a whole parcel: $names', (c) => {
    const type = ownerTypeFromNames(c.names);
    expect(type.type).toBe(c.type);
    const privateOwner = isPrivate(type.type, c.names.length > 0);
    const [street, cityState, zip] = c.mailing;
    const history: Transfer[] = c.deeds.map(([date, kind, price]) => ({
      date,
      type: kind,
      price,
      from: ['A'],
      to: ['B'],
      fromMore: 0,
      toMore: 0,
      properties: 1,
    }));
    const flags = sortFlags([
      ...ownerFlags({ address: c.location, names: c.names, mailingStreet: street, mailingCityState: cityState, mailingZip: zip }, privateOwner),
      ...transferFlags(history, c.opa_sale ? { date: c.opa_sale[0], price: c.opa_sale[1] } : null, privateOwner, fixture.as_of),
      ...liFactFlags({
        openViolations: c.li.open_violations ?? 0,
        lastOpen: c.li.last_open ?? null,
        lastOpenTitle: c.li.last_open_title ?? null,
        unsafeSince: c.li.unsafe_since ?? null,
        dangerousSince: c.li.imminently_dangerous_since ?? null,
      }),
    ]);
    expect(flags.map((flag) => ({ id: flag.id, text: flag.text }))).toEqual(c.flags);
  });
});
