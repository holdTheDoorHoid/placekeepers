// Owner flags (docs/ETHICS.md): the rules a live lookup uses (the same as the pipeline's), and the
// wording of every flag type, checked against ETHICS.md itself.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLAG_IDS,
  completeFlag,
  flagParts,
  liFlags,
  ownerFlags,
  resaleText,
  sheriffText,
  transferFlags,
} from '../src/dossier/flags.ts';
import { absentee, compareAddresses, ownerTypeFromNames, parseAddress, placeName, possibleEstate } from '../src/dossier/owners.ts';
import { fastResales, lastSale, sheriffSales } from '../src/dossier/transfers.ts';
import type { LiEvent, Transfer } from '../src/dossier/types.ts';
import { strings } from '../src/strings.ts';
import { findDashViolations } from '../src/style/no-dashes.ts';

const ETHICS = readFileSync(new URL('../../docs/ETHICS.md', import.meta.url), 'utf8');

/** A sentence that docs/ETHICS.md puts in italic quotes after the given words. */
function ethicsQuote(after: string): string {
  const start = ETHICS.indexOf(after);
  expect(start, after).toBeGreaterThan(-1);
  const match = /\*"([^"]+)"\*/s.exec(ETHICS.slice(start));
  return match![1]!.replace(/\s+/g, ' ');
}

function deed(date: string, price: number | null, type = 'DEED'): Transfer {
  return { date, type, price, from: ['A'], to: ['B'], fromMore: 0, toMore: 0, properties: 1 };
}

describe('the kind of owner, from the owner names', () => {
  it.each([
    [['SMITH JOHN'], 'individual'],
    [['SMITH JOHN', 'SMITH MARY'], 'individual'],
    [['JONES ROBERT JR', 'JONES LISA 2ND'], 'individual'],
    [['SAMPLE HOLDINGS LLC'], 'company'],
    [['SAMPLE L.L.C.'], 'company'],
    [['ACME INC'], 'company'],
    [['SAMPLE REALTY TRUST'], 'company'],
    [['MT ZION BAPTIST CHURCH'], 'nonprofit'],
    [['UNIVERSITY CITY HOMES LLC'], 'company'],
    [['CITY OF PHILA'], 'city'],
    [['PHILADELPHIA LAND BANK'], 'land_bank'],
    [['PHILADELPHIA REDEVELOPMEN'], 'redevelopment_authority'],
    [['REDEVELOPMENT AUTHORITY', 'OF PHILADELPHIA'], 'redevelopment_authority'],
    [['PHILADELPHIA HOUSING AUTH'], 'housing_authority'],
    [['PHILADELPHIA HOUSING'], 'other_public'],
    [['SEPTA'], 'other_public'],
    [[], 'unknown'],
    [['UNKNOWN'], 'unknown'],
    [['1234 SAMPLE'], 'unknown'],
    [['MADONNA'], 'unknown'],
  ])('%j is %s', (names, type) => {
    const found = ownerTypeFromNames(names as string[]);
    expect(found.type).toBe(type);
    expect(found.reason.length).toBeGreaterThan(10);
  });

  it('says why in plain words', () => {
    expect(ownerTypeFromNames(['SAMPLE HOLDINGS LLC']).reason).toBe('The owner name includes "LLC".');
    expect(ownerTypeFromNames(['SAMPLE TR']).reason).toBe('The owner name includes "TR, short for trustee".');
    expect(ownerTypeFromNames(['CITY OF PHILA']).reason).toBe('City records name the City of Philadelphia as the owner.');
  });
});

describe('possible estate', () => {
  it.each([
    [['SMITH JOHN EST OF'], true],
    [['SMITH JOHN ESTATE OF'], true],
    [['HEIRS OF SMITH ROSE'], true],
    [['SMITH JOHN', 'SMITH MARY EXECUTRIX'], true],
    [['SMITH JOHN DEC\'D'], true],
    [['SAMPLE REAL ESTATE LLC'], false],
    [['Z ESTATE GROUP LLC'], false],
    [['SMITH MARY LIFE ESTATE'], false],
    [['SMITH MARY LF TENANT'], false],
    [['THE TRUSTEES OF THE', 'ESTATE OF STEPHEN GIRARD'], false],
    [['CITY OF PHILA'], false],
    [['SMITH JOHN'], false],
  ])('%j: %s', (names, expected) => {
    expect(possibleEstate(names as string[])).toBe(expected);
  });
});

describe('absentee owners: where the mail goes', () => {
  it('reads street addresses the way the pipeline does', () => {
    expect(parseAddress('1304-08 E PASSYUNK AVE')).toEqual({ low: 1304, high: 1308, street: ['PASSYUNK'] });
    expect(parseAddress('3132 N 08TH ST')).toEqual({ low: 3132, high: 3132, street: ['8TH'] });
    expect(parseAddress('12 FIRST AVE UNIT 4')).toEqual({ low: 12, high: 12, street: ['1ST'] });
    expect(parseAddress('PO BOX 12')).toBeNull();
    expect(compareAddresses('3134 N 8TH ST', '3132 N 08TH ST')).toBe('same_block');
    expect(compareAddresses('3134 N 8TH ST', '3134 N EIGHTH ST')).toBe('same');
    expect(compareAddresses('3134 N 8TH ST', '455 MARKET ST')).toBe('different');
    expect(compareAddresses('3134 N 8TH ST', 'PO BOX 5183')).toBe('po_box');
  });

  it('flags mail that goes out of state, outside the city, to a box, or across town, but not next door', () => {
    expect(absentee('1305 N EXAMPLE AVE', '455 EXAMPLE AVE', 'CHERRY HILL NJ', '08002')).toEqual({ scope: 'out_of_state', city: 'CHERRY HILL', state: 'NJ' });
    expect(absentee('1305 N EXAMPLE AVE', '9 OAK LN', 'BLUE BELL PA', '19422')).toEqual({ scope: 'outside_city', city: 'BLUE BELL', state: 'PA' });
    expect(absentee('1305 N EXAMPLE AVE', 'PO BOX 5183', 'PHILADELPHIA PA', '19141')).toMatchObject({ scope: 'po_box_in_city' });
    expect(absentee('1305 N EXAMPLE AVE', '22 S BROAD ST', 'PHILADELPHIA PA', '19107')).toMatchObject({ scope: 'elsewhere_in_city' });
    // Every 191xx ZIP code is Philadelphia, whatever neighborhood the city line names.
    expect(absentee('1305 N EXAMPLE AVE', '22 S BROAD ST', 'ROXBOROUGH', '19128')).toMatchObject({ scope: 'elsewhere_in_city' });
    expect(absentee('3134 N 8TH ST', '3132 N 08TH ST', 'PHILADELPHIA PA', '19133')).toBeNull();
    expect(absentee('3134 N 8TH ST', '3134 N 8TH ST', 'PHILADELPHIA PA', '19133')).toBeNull();
    expect(absentee('3134 N 8TH ST', null, null, null)).toBeNull();
    expect(placeName('KING OF PRUSSIA')).toBe('King of Prussia');
  });
});

describe('the deed history', () => {
  const asOf = '2026-10-04';

  it('finds the last sale for a price, leaving out sheriff deeds and token prices', () => {
    const history = [deed('2024-05-01', 1), deed('2019-03-14', 1600, 'DEED SHERIFF'), deed('2010-06-01', 40000)];
    expect(lastSale(history, null, null, asOf)).toEqual({ year: 2010, known: true });
    expect(lastSale([], '1987-06-12', 15000, asOf)).toEqual({ year: 1987, known: true });
    expect(lastSale([], '1987-06-12', 1, asOf)).toEqual({ year: 1987, known: false });
    expect(lastSale([deed('2015-01-01', 10)], null, null, asOf)).toEqual({ year: 2000, known: false });
    // The assessor's sale is the same transfer as a deed within 60 days: it is judged by the deed.
    expect(lastSale([deed('2019-03-14', 1600, 'DEED SHERIFF')], '2019-03-20', 1600, asOf)).toEqual({ year: 2000, known: false });
  });

  it('finds fast resales: two or more sales within 24 months of each other', () => {
    const history = [deed('2025-06-10', 95000), deed('2024-11-02', 41000), deed('2024-11-02', 41000), deed('2024-03-15', 18000), deed('2004-05-17', 1500)];
    const found = fastResales(history, asOf)!;
    expect(found).toEqual({ count: 3, first: '2024-03-15', last: '2025-06-10', recent: true });
    expect(resaleText(found)).toBe('Sold 3 times since 2024.');
    expect(resaleText({ count: 2, first: '2011-01-05', last: '2011-08-01', recent: false })).toBe('Sold 2 times in 2011.');
    expect(resaleText({ count: 2, first: '2010-12-05', last: '2011-08-01', recent: false })).toBe('Sold 2 times from 2010 to 2011.');
    expect(fastResales([deed('2020-01-01', 5000), deed('2023-01-01', 5000)], asOf)).toBeNull();
  });

  it('lists sheriff sales oldest first with their dates and prices', () => {
    const sales = sheriffSales([deed('2019-03-14', 1600, 'DEED SHERIFF'), deed('2003-05-05', 800, "SHERIFF'S DEED"), deed('2010-01-01', 5000)], asOf);
    expect(sheriffText(sales.slice(1))).toBe('Sold at sheriff sale on March 14, 2019 for $1,600.');
    expect(sheriffText(sales)).toBe('Sold at sheriff sale 2 times: May 5, 2003 for $800 and March 14, 2019 for $1,600.');
  });
});

describe('flags from live City records', () => {
  const property = { address: '1305 N EXAMPLE AVE', names: ['SAMPLE ROSE M EST OF'], mailingStreet: '455 EXAMPLE AVE', mailingCityState: 'CHERRY HILL NJ', mailingZip: '08002' };

  it('gives private owners the absentee and possible estate flags, and public owners neither', () => {
    expect(ownerFlags(property, true).map((f) => [f.id, f.text])).toEqual([
      ['absentee', 'The owner gets mail somewhere else: Cherry Hill, NJ (out of state).'],
      ['possible_estate', 'The owner of record may have died.'],
    ]);
    expect(ownerFlags({ ...property, names: ['CITY OF PHILA'] }, false)).toEqual([]);
  });

  it('works out sheriff sales, years since the last sale and fast resales from the deeds', () => {
    const history = [deed('2025-06-10', 95000), deed('2024-11-02', 41000), deed('2024-03-15', 18000), deed('2019-03-14', 1600, 'DEED SHERIFF')];
    expect(transferFlags(history, null, true, '2026-10-04').map((f) => [f.id, f.text])).toEqual([
      ['sheriff_sales', 'Sold at sheriff sale on March 14, 2019 for $1,600.'],
      ['years_since_sale', 'Last sold in 2025.'],
      ['fast_resales', 'Sold 3 times since 2024.'],
    ]);
    expect(transferFlags([], { date: '1987-06-12', price: 15000 }, true, '2026-10-04').map((f) => f.text)).toEqual(['Last sold in 1987.']);
    expect(transferFlags([], null, false, '2026-10-04')).toEqual([]);
  });

  it('works out open violations, unsafe and imminently dangerous from the L&I timeline', () => {
    const e = (kind: LiEvent['kind'], date: string, open: boolean, title: string | null = null): LiEvent => ({ kind, date, title, status: open ? 'OPEN' : 'COMPLIED', detail: null, open });
    const one = liFlags([e('violation', '2025-08-01', true, 'EXTERIOR AREA WEEDS'), e('violation', '2020-01-01', false)]);
    expect(one.map((f) => f.text)).toEqual(['L&I lists 1 open violation, from August 1, 2025 for exterior area weeds.']);
    const many = liFlags([
      e('violation', '2025-08-01', true, 'VACANT STRUCTURE AND LAND'),
      e('violation', '2024-02-01', true, 'ROOF'),
      e('unsafe', '2023-05-02', true, 'UNSAFE STRUCTURE'),
      e('imminently_dangerous', '2022-01-01', false, 'ID STRUCTURE'),
    ]);
    expect(many.map((f) => f.text)).toEqual([
      'L&I lists 2 open violations. The most recent, from August 1, 2025, is for vacant structure and land.',
      'L&I lists this building as unsafe, since May 2, 2023.',
    ]);
  });
});

describe('the wording of every flag type follows docs/ETHICS.md', () => {
  const titles = strings.dossier.owner.flagTitles;

  it.each(FLAG_IDS)('%s has a title, what to be careful of, and a protective next step', (id) => {
    expect(titles[id], id).toBeTruthy();
    const parts = flagParts(id)!;
    expect(parts.careful.length).toBeGreaterThan(30);
    expect(parts.nextStep.length).toBeGreaterThan(30);
    for (const text of [titles[id]!, parts.careful, parts.nextStep]) {
      expect(findDashViolations(text)).toEqual([]);
      expect(text).not.toMatch(/owner deceased|no heirs|police|dangerous neighborhood|hot spot|easy to (take|acquire|buy)|acquisition/i);
    }
  });

  it('reads the possible estate flag word for word', () => {
    const f = strings.dossier.flags.possible_estate;
    expect([f.text, f.careful, f.next].join(' ')).toBe(ethicsQuote('"Possible estate" reads:'));
    expect(titles.possible_estate).toBe('Possible estate');
  });

  it('never lets a snapshot reword the possible estate flag', () => {
    const flag = completeFlag({ id: 'possible_estate', text: 'Owner deceased, no heirs.', careful: 'x', nextStep: 'y', links: [] });
    expect([flag.text, flag.careful, flag.nextStep].join(' ')).toBe(ethicsQuote('"Possible estate" reads:'));
    expect(flag.links.map((l) => l.url)).toEqual(expect.arrayContaining(['https://phillyvip.org/tangled-title-fund/']));
  });

  it('keeps the conservatorship warning word for word', () => {
    expect(strings.dossier.actions.conservatorshipWarning).toBe(ethicsQuote('The conservatorship route always carries this note:'));
  });

  it('uses the phrases ETHICS.md gives for absentee owners, last sales, many parcels and fast resales', () => {
    const f = strings.dossier.flags;
    expect(f.absentee.outOfState('Cherry Hill, NJ').startsWith('The owner gets mail somewhere else')).toBe(true);
    expect(f.years_since_sale.lastSold(1987)).toBe('Last sold in 1987.');
    expect(f.many_parcels.text(41)).toBe('This owner holds 41 vacant parcels in the city.');
    expect(f.fast_resales.since(3, 2024)).toBe('Sold 3 times since 2024.');
  });

  it('dates tax debt to July 2025 and points to the Tax Center', () => {
    expect(titles.tax_debt_2025).toMatch(/July 2025/);
    const flag = completeFlag({ id: 'tax_debt_2025', text: 'As of July 2025, City records showed $3,214 in unpaid real estate taxes.', careful: null, nextStep: null, links: [] });
    expect(flag.careful).toMatch(/July 9, 2025/);
    expect(flag.links.map((l) => l.url)).toContain('https://tax-services.phila.gov/');
  });

  it('gives a deed fraud notice that names Fraud Guard and the November 2025 check', () => {
    const notice = strings.dossier.owner.deedFraud;
    expect(notice).toMatch(/Fraud Guard/);
    expect(notice).toMatch(/November 2025/);
    expect(notice).toMatch(/blocks deeds/);
  });

  it('fills in a snapshot flag from the shared wording first, then the page\'s own', () => {
    const shared = completeFlag(
      { id: 'absentee', text: 'The owner gets mail somewhere else: a post office box in Philadelphia.', careful: null, nextStep: null, links: [] },
      { careful: 'Shared careful.', nextStep: 'Shared next step.', routes: [], links: [{ label: 'Shared', url: 'https://example.org/shared' }] },
      [{ label: 'Ask the owner', url: 'https://example.org/route' }],
    );
    expect(shared).toMatchObject({ careful: 'Shared careful.', nextStep: 'Shared next step.' });
    expect(shared.links.map((l) => l.url)).toEqual(['https://example.org/shared', 'https://example.org/route', expect.stringContaining('pubintlaw')]);
    const own = completeFlag({ id: 'unsafe', text: 'L&I lists this building as unsafe.', careful: null, nextStep: null, links: [] });
    expect(own.careful).toBe(strings.dossier.flags.unsafe.careful);
    const unknown = completeFlag({ id: 'something_new', text: 'A new kind of note.', careful: null, nextStep: null, links: [] });
    expect(unknown).toMatchObject({ text: 'A new kind of note.', careful: null, nextStep: null });
  });
});
