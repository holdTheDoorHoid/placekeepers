// What a lot page shows in every state of its data: the weekly snapshot alone, live City data
// arriving, live lookups that fail or time out, live data turned off, parcels not on our list, and
// an owner who changed since the snapshot. Each part must say where it came from.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { parseManifest } from '../src/data/manifest.ts';
import { IDLE_PARTS, buildDossier, cityTitle, documentLabel, type DossierInput, type LiveParts, type Part } from '../src/dossier/build.ts';
import { plain } from '../src/dossier/plain.ts';
import { parseCommon, parseShard } from '../src/dossier/shard.ts';
import type { Assessment, LiveLi, LiveProperty, Transfer } from '../src/dossier/types.ts';
import { defaultState } from '../src/state/defaults.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const registry = loadRegistry();
const manifest = parseManifest(read('../fixtures/data/manifest.json')).manifest!;
const shard = parseShard(read('../fixtures/data/dossiers/9900.json')).shard!;
const notes = parseCommon(read('../fixtures/data/dossiers/common.json'));
const tiles = (read('../fixtures/sources/parcels.geojson') as { features: { properties: Record<string, unknown> }[] }).features.map((f) => f.properties);
const ETHICS = readFileSync(new URL('../../docs/ETHICS.md', import.meta.url), 'utf8');
const NOW = new Date('2026-10-04T18:30:00Z');
const AT = Date.parse('2026-10-04T18:14:00Z');

function input(opa: string, overrides: Partial<DossierInput> = {}): DossierInput {
  const parcel = shard.parcels.get(opa);
  return {
    opa,
    registry,
    state: defaultState(registry, 'analysis'),
    manifest,
    shard: parcel ? { status: 'found', parcel, generatedAt: shard.generatedAt, notes } : { status: 'absent', reason: 'unlisted' },
    tile: tiles.find((t) => t.id === opa) ?? null,
    live: IDLE_PARTS,
    liveOn: true,
    center: [-75.1557, 39.9851],
    now: NOW,
    ...overrides,
  };
}

const ok = <T>(data: T): Part<T> => ({ status: 'ok', data, at: AT });
const failed = (reason: 'timeout' | 'network' | 'not_found' | 'http' = 'timeout'): Part<never> => ({ status: 'failed', reason });
const loading: Part<never> = { status: 'loading' };

function liveProperty(over: Partial<LiveProperty> = {}): LiveProperty {
  return {
    opa: '990000005',
    address: '1305 N EXAMPLE AVE',
    names: ['SAMPLE ROSE M EST OF'],
    mailing: '455 EXAMPLE AVE, CHERRY HILL NJ 08002',
    mailingStreet: '455 EXAMPLE AVE',
    mailingCityState: 'CHERRY HILL NJ',
    mailingZip: '08002',
    category: 'VACANT LAND',
    buildingDescription: 'VACANT LAND RESIDE < ACRE',
    saleDate: '1987-06-12',
    salePrice: 15000,
    marketValue: 12000,
    lng: -75.15572,
    lat: 39.98513,
    ...over,
  };
}

const liveTransfers: Transfer[] = [
  { date: '2026-09-02', type: 'DEED', price: 30000, from: ['SAMPLE ROSE M EST OF'], to: ['NEIGHBOR SAM'], fromMore: 0, toMore: 0, properties: 1 },
];
const liveAssessments: Assessment[] = [
  { year: 2027, marketValue: 13000 },
  { year: 2026, marketValue: 12500 },
];
const liveLi: LiveLi = {
  events: [
    { kind: 'violation', date: '2025-08-01', title: 'EXTERIOR AREA WEEDS', status: 'OPEN', detail: 'IN VIOLATION', open: true },
    { kind: 'permit', date: '2022-07-15', title: 'Minor Demolition', status: 'Completed', detail: 'Demolition Permit', open: false },
  ],
  truncated: false,
};

function allLive(property = liveProperty()): LiveParts {
  return { property: ok(property), transfers: ok(liveTransfers), assessments: ok(liveAssessments), li: ok(liveLi), nearby: { status: 'idle' } };
}

describe('the weekly snapshot alone (live City data off)', () => {
  const view = buildDossier(input('990000005', { liveOn: false }));

  it('says so at the top and in each part, with the snapshot date, and offers to turn live data on', () => {
    expect(view.banner).toMatchObject({ tone: 'snapshot', text: 'Live City data is off. This page shows the weekly snapshot of October 4, 2026.', offerLive: true });
    expect(view.owner.provenance.text).toBe('Live City data is off, so this is the weekly snapshot of October 4, 2026.');
    expect(view.history.transfersProvenance.text).toBe('Live City data is off, so this is the weekly snapshot of October 4, 2026.');
    expect(view.history.li.liveForTimeline).toBe(true);
  });

  it('shows the summary from the vacancy model with its reasons in the model\'s own sentences', () => {
    expect(view.title).toBe('1305 N EXAMPLE AVE');
    expect(view.summary).toMatchObject({ listed: true, kindLabel: 'Vacant lot', confidence: 'Very likely vacant', signals: '2 independent City records agree that it is vacant.' });
    expect(view.summary.reasons!.agree.length).toBeGreaterThan(0);
    expect(view.summary.reasons!.agree[0]).toMatch(/^The City lists it as likely vacant land/);
    expect(view.summary.links.map((l) => l.url)).toEqual([
      'https://property.phila.gov/?p=990000005',
      'https://atlas.phila.gov/990000005',
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=39.985100,-75.155700',
      'https://www.google.com/maps/search/?api=1&query=39.985100,-75.155700',
    ]);
  });

  it('shows the owner as the City publishes it, with every flag in three parts', () => {
    expect(view.owner.names).toEqual(['SAMPLE ROSE M EST OF']);
    expect(view.owner.mailing).toBe('455 EXAMPLE AVE, CHERRY HILL NJ 08002');
    expect(view.owner.typeLabel).toBe('A person');
    expect(view.owner.flags.map((f) => f.id)).toEqual(['absentee', 'possible_estate', 'years_since_sale', 'open_violations']);
    for (const flag of view.owner.flags) {
      expect(flag.careful, flag.id).toBeTruthy();
      expect(flag.nextStep, flag.id).toBeTruthy();
    }
    const estate = view.owner.flags.find((f) => f.id === 'possible_estate')!;
    const quote = /"Possible estate" reads: \*"([^"]+)"\*/s.exec(ETHICS)![1]!.replace(/\s+/g, ' ');
    expect([estate.text, estate.careful, estate.nextStep].join(' ')).toBe(quote);
  });

  it('shows the deed fraud notice, help for families, and tax debt dated July 2025 with the Tax Center', () => {
    expect(view.owner.deedFraud!.text).toBe(notes!.notices.deed_fraud!.text);
    expect(view.owner.deedFraud!.links.map((l) => l.url)).toEqual(
      expect.arrayContaining([
        'https://www.phila.gov/2025-11-10-philadelphia-launches-new-tool-to-stop-deed-fraud/',
        'https://www.phila.gov/2022-09-06-own-property-in-philadelphia-get-free-deed-fraud-protection-with-fraud-guard/',
      ]),
    );
    expect(view.owner.help!.map((l) => l.url)).toEqual(expect.arrayContaining(['https://phillyvip.org/tangled-title-fund/']));
    expect(view.owner.tax.flag!.title).toBe('Tax debt as of July 2025');
    expect(view.owner.tax.flag!.links.map((l) => l.url)).toContain('https://tax-services.phila.gov/');
    expect(view.owner.tax.link.url).toBe('https://tax-services.phila.gov/');
  });

  it('leads each suggestion with the lawful route that fits this owner, and warns before conservatorship', () => {
    expect(view.actions.suggestions.map((s) => s.suggestion.id)).toEqual(['clean_and_green']);
    expect(view.actions.suggestions[0]!.routes.map((r) => r.route.id)).toEqual(['ask_the_owner']);
    const conservatorship = view.actions.otherRoutes.find((r) => r.route.id === 'conservatorship')!;
    expect(conservatorship.warning).toBe(/conservatorship route always carries this note: \*"([^"]+)"\*/s.exec(ETHICS)![1]!.replace(/\s+/g, ' '));
  });

  it('shows the nearby counts as area counts, and sources with their dates', () => {
    expect(view.nearby.groups).toEqual([
      { heading: 'In the area around this lot, about two blocks across', rows: ['2 people shot in the last 12 months', '7 people shot in the last 3 years'] },
      { heading: 'Within 500 feet of this lot', rows: ['3 lots kept up by PHS LandCare', '1 community garden'] },
    ]);
    const ids = view.sources.rows.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['opa_properties', 'assessment_history', 'li_violations', 'cagp_tax_2025', 'shootings']));
    expect(view.sources.rows.find((r) => r.id === 'cagp_tax_2025')!.when).toMatch(/July 9, 2025/);
    expect(view.sources.rows.find((r) => r.id === 'opa_properties')!.when).toMatch(/^weekly snapshot of October 4, 2026/);
    expect(view.sources.correctionUrl).toBe(
      'https://github.com/holdTheDoorHoid/placekeepers/issues/new?template=correction.yml&title=Correction%3A+1305+N+EXAMPLE+AVE&place=990000005%2C+1305+N+EXAMPLE+AVE',
    );
  });
});

describe('live City data', () => {
  it('says it is checking while the City answers, and keeps showing the snapshot meanwhile', () => {
    const view = buildDossier(input('990000005', { live: { ...IDLE_PARTS, property: loading, transfers: loading, assessments: loading, li: loading } }));
    expect(view.banner.tone).toBe('pending');
    expect(view.owner.provenance.text).toBe('Checking the City for newer records.');
    expect(view.owner.names).toEqual(['SAMPLE ROSE M EST OF']);
    expect(view.loading).toBe(false);
  });

  it('replaces each part with live data, says so, and works the flags out again', () => {
    const view = buildDossier(input('990000005', { live: allLive() }));
    expect(view.banner).toMatchObject({ tone: 'live', retry: false });
    expect(view.owner.provenance).toEqual({ tone: 'live', text: 'Live from the City at 2:14 PM.' });
    expect(view.history.transfers!.map((t) => t.date)).toEqual(['Sep 2, 2026']);
    expect(view.history.assessments!.map((a) => a.year)).toEqual([2027, 2026]);
    expect(view.history.li.rows!.map((r) => r.kind)).toEqual(['Violation', 'Permit']);
    expect(view.summary.cityCalls).toBe('City property records call it: Vacant land.');
    // The deed of September 2026 is a sale: the years since the last sale flag says 2026 now.
    expect(view.owner.flags.find((f) => f.id === 'years_since_sale')!).toMatchObject({ text: 'Last sold in 2026.', provenance: { tone: 'live' } });
    // Tax debt is only in the snapshot, so it stays, dated.
    expect(view.owner.tax.flag!.provenance.tone).toBe('snapshot');
    expect(view.sources.rows.find((r) => r.id === 'real_estate_transfers')!.when).toBe('live from the City at 2:14 PM');
  });

  it('shows the snapshot with a plain reason when the City times out, and offers to try again', () => {
    const view = buildDossier(input('990000005', { live: { ...IDLE_PARTS, property: failed(), transfers: failed(), assessments: failed(), li: failed() } }));
    expect(view.banner).toMatchObject({ tone: 'warning', retry: true });
    expect(view.banner.text).toMatch(/did not answer/);
    expect(view.owner.provenance.text).toBe("The City's servers did not answer in time, so this is the weekly snapshot of October 4, 2026.");
    expect(view.owner.names).toEqual(['SAMPLE ROSE M EST OF']);
    expect(view.history.transfers).not.toBeNull();
  });

  it('says which parts are live when only some lookups work', () => {
    const view = buildDossier(input('990000005', { live: { ...allLive(), transfers: failed('network') } }));
    expect(view.banner).toMatchObject({ tone: 'warning', retry: true });
    expect(view.banner.text).toMatch(/Some City lookups did not work/);
    expect(view.owner.provenance.tone).toBe('live');
    expect(view.history.transfersProvenance.text).toBe("The City's servers could not be reached, so this is the weekly snapshot of October 4, 2026.");
  });

  it('leaves out notes about an earlier owner when the City names a new one', () => {
    const view = buildDossier(
      input('990000004', { live: { ...allLive(liveProperty({ opa: '990000004', address: '1301 N EXAMPLE AVE', names: ['NEIGHBOR SAM'], mailing: '1303 N EXAMPLE AVE, PHILADELPHIA PA 19122', mailingStreet: '1303 N EXAMPLE AVE', mailingCityState: 'PHILADELPHIA PA', mailingZip: '19122' })) } }),
    );
    expect(view.owner.ownerChanged).toBe(true);
    expect(view.owner.flags.map((f) => f.id)).not.toContain('many_parcels');
    expect(view.owner.typeLabel).toBe('A person');
    expect(view.owner.typeReason).toBe("The owner name looks like a person's name.");
    expect(view.owner.flags.map((f) => f.id)).not.toContain('absentee');
  });
});

describe('a parcel that is not on our list', () => {
  const nonListed = (live: LiveParts, liveOn = true) =>
    buildDossier(input('371163500', { tile: null, shard: { status: 'absent', reason: 'unlisted' }, live, liveOn, center: null }));

  it('is built live, and says plainly that no details are published for it', () => {
    const property = liveProperty({ opa: '371163500', address: '2216 N 10TH ST', names: ['TAURUS LAND INVESTMENTS LLC'], mailing: 'PO BOX 5183, PHILADELPHIA PA 19141', mailingStreet: 'PO BOX 5183', mailingCityState: 'PHILADELPHIA PA', mailingZip: '19141' });
    const view = nonListed({ ...allLive(property), nearby: ok({ s12: 1, s36: 2, killed: 0 }) });
    expect(view.title).toBe('2216 N 10TH ST');
    expect(view.summary.kindLabel).toBe('Not on our list of vacant lots and buildings');
    expect(view.summary.kindHelp).toMatch(/We have not published details for this parcel/);
    expect(view.actions.suggestions).toEqual([]);
    expect(view.actions.listed).toBe(false);
    expect(view.owner.typeLabel).toBe('A company');
    expect(view.owner.flags.map((f) => f.id)).toContain('absentee');
    expect(view.owner.deedFraud).toBeNull();
    expect(view.owner.tax.text).toBe("The City no longer publishes each property's tax balance as open data.");
    expect(view.nearby.groups).toEqual([
      { heading: 'Within 500 feet of this lot', rows: ['1 person shot in the last 12 months', '2 people shot in the last 3 years', '0 people killed in traffic crashes since 2019'] },
    ]);
    // Street imagery links use the point the City's record gives.
    expect(view.summary.links.some((l) => l.url.includes('39.985130,-75.155720'))).toBe(true);
  });

  it('says why there is nothing to show when live data is off, the City does not answer, or has no such parcel', () => {
    expect(nonListed(IDLE_PARTS, false).empty).toMatch(/live City data is turned off/);
    expect(nonListed({ ...IDLE_PARTS, property: failed('timeout') }).empty).toBe("The City's servers did not answer in time, so this part cannot be shown right now.");
    expect(nonListed({ ...IDLE_PARTS, property: failed('not_found') }).empty).toBe('We could not find this parcel in City records or in our weekly snapshot.');
    expect(nonListed({ ...IDLE_PARTS, property: loading }).empty).toBeNull();
  });

  it('says no details are published yet when no dossiers are published at all', () => {
    const view = buildDossier(input('371163500', { tile: null, shard: { status: 'absent', reason: 'unpublished' }, live: allLive(liveProperty({ opa: '371163500' })) }));
    expect(view.summary.kindLabel).toBe('No details published yet');
  });
});

describe('details', () => {
  it('shows the City\'s deed types in plain words, never with a dash', () => {
    expect(documentLabel('DEED')).toBe('Deed');
    expect(documentLabel('DEED - DECEASED ')).toBe('Deed from an estate');
    expect(documentLabel("SHERIFF'S DEED")).toBe("Sheriff's deed");
    expect(documentLabel('DEED RTT - OTHER')).toBe('Other deed');
    expect(documentLabel('NEW KIND - OF DEED')).toBe('New kind, of deed');
  });

  it('shows City text without dashes as punctuation, keeping hyphens inside words', () => {
    expect(plain('L&I lists 1 open violation for dumping - private lot.')).toBe('L&I lists 1 open violation for dumping, private lot.');
    expect(plain('SMITH-JONES MARY')).toBe('SMITH-JONES MARY');
    expect(plain('1304-08 E PASSYUNK AVE')).toBe('1304-08 E PASSYUNK AVE');
    expect(plain('A \u2014 B \u2013 C')).toBe('A, B, C');
    const parcel = structuredClone(shard.parcels.get('990000001')!);
    parcel.owner!.flags = [{ id: 'open_violations', text: 'L&I lists 1 open violation, from May 1, 2020 for dumping - private lot.', careful: null, nextStep: null, links: [], list: null }];
    const view = buildDossier(input('990000001', { liveOn: false, shard: { status: 'found', parcel, generatedAt: null, notes } }));
    expect(view.owner.flags[0]!.text).toBe('L&I lists 1 open violation, from May 1, 2020 for dumping, private lot.');
  });

  it('writes L&I titles in sentence case, keeping their abbreviations', () => {
    expect(cityTitle('ID STRUCTURE')).toBe('ID structure');
    expect(cityTitle('EXTERIOR AREA WEEDS')).toBe('Exterior area weeds');
  });

  it('marks sheriff deeds and deeds that covered several properties', () => {
    const view = buildDossier(input('990000004', { liveOn: false }));
    expect(view.history.transfers![0]).toMatchObject({ price: "$30,000, this property's share of one deed for 2 properties", sheriff: false });
    const sheriff = buildDossier(input('990000001', { liveOn: false })).history.transfers!.find((t) => t.sheriff)!;
    expect(sheriff).toMatchObject({ document: "Sheriff's deed", price: '$1,600' });
  });

  it('shows the City list of public property and the side yard program for a Land Bank lot', () => {
    const view = buildDossier(input('990000009', { liveOn: false }));
    expect(view.owner.cityOwned).toBe(
      "The City's list of public property names the Philadelphia Land Bank as the owner. Its status there: Available. The City marks it eligible for the side yard program, for the owner of the house next door.",
    );
    expect(view.actions.suggestions[0]!.routes.map((r) => r.route.id)).toEqual(['land_bank_garden_agreement']);
    expect(view.actions.otherRoutes.map((r) => r.route.id)).toEqual(['land_bank_side_yard']);
    expect(view.owner.deedFraud).toBeNull();
    expect(view.owner.help).toBeNull();
  });

  it('hides a suggestion that is switched off in Settings', () => {
    const state = defaultState(registry, 'analysis');
    state.suggestions.clean_and_green = false;
    expect(buildDossier(input('990000005', { state, liveOn: false })).actions.suggestions).toEqual([]);
  });

  it('shows L&I dates from the snapshot when the timeline is not live', () => {
    const view = buildDossier(input('990000001', { liveOn: false }));
    expect(view.history.li.summary).toEqual([
      '2 open violations.',
      '9 violations recorded since 2016.',
      'Most recent violation: August 1, 2025.',
      'L&I lists this building as unsafe, since May 2, 2023.',
      'Last cleaned and sealed by the City on February 14, 2024.',
    ]);
  });

  it('notes LandCare and a garden, and the owner\'s list for many parcels', () => {
    expect(buildDossier(input('990000002', { liveOn: false })).summary.care).toEqual(['Already maintained by PHS LandCare since 2016.']);
    expect(buildDossier(input('990000033', { liveOn: false })).summary.care).toContain('People already garden here. Ask them before you plan anything.');
    const many = buildDossier(input('990000004', { liveOn: false })).owner.flags.find((f) => f.id === 'many_parcels')!;
    expect(many).toMatchObject({ text: 'This owner holds 7 vacant parcels in the city.', list: '3f2a9c1b7d04' });
  });

  it('puts nothing in the page that ETHICS.md rules out', () => {
    for (const opa of shard.parcels.keys()) {
      for (const liveOn of [false, true]) {
        const text = JSON.stringify(buildDossier(input(opa, { liveOn, live: liveOn ? allLive(liveProperty({ opa })) : IDLE_PARTS })));
        const found = [...text.matchAll(/.{0,60}(acquisition|easiest|ease of|owner deceased|no heirs|\bbuy\b|call the police|police enforcement|dangerous neighborhood|hot spot|high crime).{0,30}/gi)].map((m) => m[0]);
        expect(found, opa).toEqual([]);
      }
    }
  });
});
