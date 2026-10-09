// Rules for this lot (M4.6, issue #42): what the lot page, its print, the map's taps and downloads
// show about historic designation, zoning and its overlays, brownfields, and appeals and hearings.
//
// The owner's decisions of 2026-10-09 (docs/ETHICS.md, "Appeals and hearings"): every appeal is
// shown on the lot's own page as the City publishes it, with who filed it and the owner named; never
// on the map, in a list of places or in a download. Brownfield wording never says "clean" or
// "safe", and historic and zoning text never says a lot is or is not buildable.

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import Dossier from '../src/components/dossier/Dossier.svelte';
import DossierPrint from '../src/components/dossier/DossierPrint.svelte';
import RulesDetails from '../src/components/rules/RulesDetails.svelte';
import { parseManifest } from '../src/data/manifest.ts';
import { IDLE_PARTS, buildDossier, type DossierInput, type Part } from '../src/dossier/build.ts';
import { readAppeals } from '../src/dossier/appeals.ts';
import { printModel } from '../src/dossier/print.ts';
import { appealKind, clockWords, decisionWords, overlayMeaning } from '../src/dossier/rules.ts';
import { parseCommon, parseRules, parseShard } from '../src/dossier/shard.ts';
import type { Appeal } from '../src/dossier/types.ts';
import { exportRow, toCsv } from '../src/places/export.ts';
import { brownfieldCard, hearingCard, overlayCard, propertyCard } from '../src/rules/describe.ts';
import { defaultState } from '../src/state/defaults.ts';
import { collectStrings, strings } from '../src/strings.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const registry = loadRegistry();
const manifest = parseManifest(read('../fixtures/data/manifest.json')).manifest!;
const shard = parseShard(read('../fixtures/data/dossiers/9900.json')).shard!;
const notes = parseCommon(read('../fixtures/data/dossiers/common.json'));
const tiles = (read('../fixtures/sources/parcels.geojson') as { features: { properties: Record<string, unknown> }[] }).features.map((f) => f.properties);
const NOW = new Date('2026-10-04T18:30:00Z');
const AT = Date.parse('2026-10-04T18:14:00Z');
const ok = <T>(data: T): Part<T> => ({ status: 'ok', data, at: AT });

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
    liveOn: false,
    center: [-75.1557, 39.9851],
    now: NOW,
    ...overrides,
  };
}

function textOf(markup: string): string {
  return markup
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const r = strings.dossier.rules;
const OWNER_SENTENCE = 'A federal brownfield assessment or cleanup was recorded at or near this address. Test the soil before growing food.';

describe('reading the rules from the weekly copy', () => {
  it('keeps the contract fields of a lot\'s rules, its appeals and the overlays', () => {
    const building = shard.parcels.get('990000001')!;
    expect(building.rules!.districts).toEqual([{ name: 'Sample Square Historic District', date: '1999-03-10' }]);
    expect(building.rules!.register).toMatchObject({ individual: false, district: 'Sample Square Historic District' });
    expect(building.rules!.overlays).toEqual(['o878f2af2', 'oe0618f38']);
    expect(building.rules!.brownfields).toEqual([{ id: '110000000001', name: 'FORMER SAMPLE WORKS', address: '1200 N SAMPLE ST', meters: 35 }]);
    expect(building.appeals).toHaveLength(1);
    expect(notes!.overlays!['oe0618f38']).toMatchObject({ symbol: '/NCO', type: 1, section: '14-504(5)' });
  });

  it('never keeps a key the contract does not name, such as an appeal number or its grounds', () => {
    const parcel = parseShard({
      schema: 1,
      parcels: {
        '990000005': {
          address: 'X',
          appeals: [{ board: 'zoning', id: 'ZP-2026-000001', grounds: 'secret words', appellant: 'A PERSON', hearing: '2030-01-01', hearing_time: '25:00' }],
          rules: { overlays: ['not a key', 'o12345678'], zoning: { code: 'RSA-5', pending_url: 'javascript:alert(1)' } },
        },
      },
    }).shard!.parcels.get('990000005')!;
    expect(JSON.stringify(parcel.appeals)).not.toMatch(/ZP-2026|secret/);
    expect(parcel.appeals![0]!.hearingTime).toBeNull();
    expect(parcel.rules!.overlays).toEqual(['o12345678']);
    expect(parcel.rules!.zoning!.pendingUrl).toBeNull();
    expect(parseRules({})).toBeNull();
  });

  it('says appeals are not known when the weekly copy was built without them, never that there are none', () => {
    const parcel = parseShard({ schema: 1, parcels: { '990000005': { address: 'X', partial: ['appeals', 'historic'] } } }).shard!.parcels.get('990000005')!;
    expect(parcel.appeals).toBeNull();
    expect(parcel.missing).toEqual(['historic', 'appeals']);
    const view = buildDossier(input('990000005', { shard: { status: 'found', parcel, generatedAt: shard.generatedAt, notes } }));
    expect(view.rules.appeals.missing).toMatchObject({ text: r.appealsMissing, offerLive: true });
    expect(view.rules.appeals.empty).toBeNull();
    expect(view.rules.missing).toEqual([r.missing.historic]);
    expect(view.rules.historic).toBeNull();
  });
});

describe('the lot page', () => {
  it('puts a hearing still to come at the top, with how to take part', () => {
    const view = buildDossier(input('990000005'));
    expect(view.rules.hearing!.text).toBe('A zoning hearing about this lot is set for November 6, 2030, at 9:30 AM.');
    expect(view.rules.hearing!.takePart.url).toBe('https://www.phila.gov/services/zoning-planning-development/participate-in-a-zoning-board-of-adjustment-hearing/');
    const html = render(Dossier, { props: { view, manifest } }).body;
    // Above the page's contents and every section.
    expect(html.indexOf('data-testid="hearing-notice"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="hearing-notice"')).toBeLessThan(html.indexOf('class="contents'));
    expect(textOf(html)).toContain(view.rules.hearing!.text);
  });

  it('shows every appeal as the City publishes it, with who filed it, the owner named and the community organization', () => {
    const view = buildDossier(input('990000005'));
    const [appeal] = view.rules.appeals.items;
    expect(appeal).toMatchObject({
      board: 'Zoning Board of Adjustment',
      kind: 'Permit denial, variance',
      upcoming: true,
      filedBy: 'QUINN SAMPLE; SAMPLE HOLDINGS LLC',
      ownerNamed: 'SAMPLE HOLDINGS LLC',
      rco: 'The City notified this registered community organization: Sample Neighbors Association.',
    });
    expect(appeal!.dates).toEqual(['Filed August 3, 2026', 'Hearing set for November 6, 2030, at 9:30 AM']);
    // The grounds are a link to the City, never copied.
    expect(view.rules.appeals.grounds).toEqual({ label: r.grounds, url: 'https://li.phila.gov/property-history/search?address=1305%20N%20EXAMPLE%20AVE' });
    const text = textOf(render(Dossier, { props: { view, manifest } }).body);
    expect(text).toContain('QUINN SAMPLE; SAMPLE HOLDINGS LLC');
    expect(text).toContain(r.namesNote);
  });

  it('leads with the lawful step on a historic property: ask the Historical Commission first', () => {
    const view = buildDossier(input('990000001'));
    expect(view.rules.historic!.lines).toEqual([
      'This lot is in the Sample Square Historic District, designated on March 10, 1999.',
      'This property is on the Philadelphia Register of Historic Places as part of the Sample Square Historic District.',
    ]);
    expect(view.rules.historic!.askFirst).toMatch(/^Changes here may need the Historical Commission's review; ask them first\. For a mural or a garden/);
    expect(view.rules.historic!.contact).toContain('215 686 7660');
    expect(view.rules.historic!.links.map((l) => l.url)).toContain('https://www.phila.gov/departments/philadelphia-historical-commission/');
  });

  it('names the base zoning and each overlay in plain words, with its Zoning Code section', () => {
    const view = buildDossier(input('990000001'));
    expect(view.rules.zoning!.base).toBe('Base zoning: RM-1, a residential district.');
    expect(view.rules.zoning!.overlays.map((o) => o.name)).toEqual([
      '/NCO Neighborhood Conservation Overlay District, Sample Area',
      '/NIS Narcotics Injection Sites Overlay District',
    ]);
    expect(view.rules.zoning!.overlays[0]!.meaning).toBe(r.overlayMeaning['/NCO']);
    expect(view.rules.zoning!.overlays[0]!.link!.label).toBe('Read the rule: Zoning Code section 14-504(5)');
    expect(view.rules.zoning!.note).toMatch(/check with the City's zoning office/);
  });

  it('gives the brownfield sentence word for word, and the soil note on a garden suggestion', () => {
    const view = buildDossier(input('990000002'));
    expect(view.rules.brownfield!.text).toBe(OWNER_SENTENCE);
    expect(view.rules.brownfield!.sites[0]!.text).toBe('FORMER SAMPLE WORKS, about 120 feet from this lot');
    expect(view.actions.brownfield).toBe(true);
    const html = render(Dossier, { props: { view, manifest } }).body;
    const garden = html.slice(html.indexOf('Start a community garden'));
    expect(textOf(garden)).toContain(OWNER_SENTENCE);
    // A lot with no brownfield record gets no soil note.
    expect(buildDossier(input('990000005')).actions.brownfield).toBe(false);
  });

  it('puts appeals in the timeline, with their own switch, and no names there', () => {
    const view = buildDossier(input('990000005', { history: { status: 'found', parcel: { li: {}, lists: [] }, generatedAt: shard.generatedAt } }));
    const kind = view.history.timeline.kinds.find((k) => k.id === 'appeal');
    expect(kind).toMatchObject({ label: 'Appeals', count: 1 });
    const row = view.history.timeline.years.flatMap((y) => y.rows).find((x) => x.kind === 'appeal')!;
    expect(row.day).toBe('2026-08-03');
    expect(row.items[0]!.text).toBe('Zoning Board of Adjustment: Permit denial, variance, hearing November 6, 2030');
    expect(JSON.stringify(view.history.timeline)).not.toContain('QUINN');
    const hidden = buildDossier(input('990000005', { hiddenKinds: ['appeal'], history: { status: 'found', parcel: { li: {}, lists: [] }, generatedAt: shard.generatedAt } }));
    expect(hidden.history.timeline.years.flatMap((y) => y.rows).some((x) => x.kind === 'appeal')).toBe(false);
  });

  it('uses the City\'s live answer when it comes, and says where the appeals come from', () => {
    const live: Appeal[] = readAppeals([
      { appealnumber: '1', applicationtype: 'L&I Review Board Codes', appealtype: 'LIRB Violation Appeal', appealstatus: 'In Process', createddate: '2026-09-01T14:00:00Z', scheduleddate: '2030-10-23T16:30:00Z', primaryappellant: 'LIVE PERSON' },
    ]);
    const view = buildDossier(input('990000005', { liveOn: true, live: { ...IDLE_PARTS, appeals: ok(live) } }));
    expect(view.rules.appeals.items.map((a) => a.board)).toEqual(['L&I Review Board']);
    expect(view.rules.hearing!.text).toBe('An L&I Review Board hearing about this lot is set for October 23, 2030, at 12:30 PM.');
    expect(view.rules.appealsProvenance.tone).toBe('live');
    expect(view.sources.rows.map((s) => s.id)).toContain('appeals');
  });

  it('for a parcel off our list, says where its rules can be found, and lists its appeals when live', () => {
    const view = buildDossier(input('880000001', { tile: null, liveOn: true, live: { ...IDLE_PARTS, appeals: ok([]) } }));
    expect(view.rules.notOnList).toBe(r.notOnList);
    expect(view.rules.zoning).toBeNull();
    expect(view.rules.links.map((l) => l.url)).toEqual(['https://atlas.phila.gov/880000001/zoning', expect.stringContaining('find-a-historic-property')]);
    expect(view.rules.appeals.empty).toBe(r.noAppeals);
    const off = buildDossier(input('880000001', { tile: null, liveOn: false }));
    expect(off.rules.appeals.missing).toMatchObject({ offerLive: true });
  });

  it('prints the hearing, the historic note and the overlays, and no name from an appeal', () => {
    const model = printModel(buildDossier(input('990000005')), NOW);
    expect(model.rules[0]).toBe('A zoning hearing about this lot is set for November 6, 2030, at 9:30 AM.');
    expect(model.rules.join(' ')).toContain('/NCO Neighborhood Conservation Overlay District, Sample Area');
    const sheet = textOf(render(DossierPrint, { props: { view: buildDossier(input('990000005')), now: NOW } }).body);
    expect(sheet).not.toContain('QUINN');
    const building = printModel(buildDossier(input('990000001')), NOW);
    expect(building.rules).toContain(r.askFirst);
  });
});

describe('words', () => {
  it('turns the City\'s codes into plain words', () => {
    expect(clockWords('15:30')).toBe('3:30 PM');
    expect(clockWords('09:05')).toBe('9:05 AM');
    expect(clockWords('12:00')).toBe('12:00 PM');
    expect(clockWords(null)).toBeNull();
    expect(appealKind({ type: 'LIRB-C Other L&I', application: null, board: 'li_review' })).toBe('Other L&I');
    expect(appealKind({ type: null, application: 'Tax Review Board', board: 'other' })).toBe('Tax review board');
    expect(appealKind({ type: null, application: 'RB_ZBA', board: 'zoning' })).toBeNull();
    expect(decisionWords('GRANTED/PROV')).toBe('Granted with provisos');
    expect(decisionWords('City Affirmed')).toBe("The City's decision stands");
    expect(overlayMeaning({ name: '/VDO Fifth District Overlay District', symbol: '/VDO', type: 1 })).toBe(r.overlayMeaning.council);
    expect(overlayMeaning({ name: 'Open Space and Natural Resources - Flood Protection - Within the Floodway', symbol: null, type: 2 })).toBe(r.overlayMeaning.flood);
    expect(overlayMeaning({ name: 'Wissahickon Watershed Impervious Coverage Restriction 35%', symbol: null, type: 3 })).toBe(r.overlayMeaning.coverage);
    expect(overlayMeaning({ name: 'Something New', symbol: null, type: 2 })).toBe(r.overlayMeaning.supplemental);
  });

  it('never calls a brownfield clean or safe, and never says a lot is or is not buildable', () => {
    const rules = collectStrings({ rules: strings.dossier.rules, map: strings.rulesMap });
    for (const [path, text] of rules) {
      expect(text, path).not.toMatch(/buildable|can be built|cannot be built|can't be built|allowed to build/i);
      if (/brownfield|soil|epa/i.test(path)) expect(text, path).not.toMatch(/\bclean(ed)?\b|\bsafe\b/i);
    }
    const layer = registry.layers.find((l) => l.id === 'brownfields')!;
    expect(layer.description).not.toMatch(/\bclean(ed)?\b|\bsafe\b/i);
    expect(r.brownfield).toBe(OWNER_SENTENCE);
  });
});

describe('the map\'s taps', () => {
  it('shows a hearing with no name, how to take part and a way to open the lot', () => {
    const card = hearingCard({ id: '990000005', d: '2030-11-06', tm: '09:30', b: 1, ty: 'ZBA Permit Denial - Variance', ad: '1305 N EXAMPLE AVE', rco: 'Sample Neighbors Association' });
    expect(card).toMatchObject({ title: 'Zoning Board of Adjustment hearing', opa: '990000005' });
    expect(card.lines).toEqual([
      'November 6, 2030, at 9:30 AM',
      'Permit denial, variance',
      'About 1305 N EXAMPLE AVE.',
      'Registered community organization notified: Sample Neighbors Association.',
      strings.rulesMap.namesNote,
    ]);
    // Even a file that carried a name would not show it.
    const html = render(RulesDetails, { props: { style: 'hearings', features: [{ b: 2, d: '2030-10-23', appellant: 'A PERSON', owner: 'A PERSON' }] } }).body;
    expect(html).not.toContain('A PERSON');
  });

  it('describes overlays, historic properties and brownfield sites', () => {
    expect(overlayCard({ nm: '/NCO Neighborhood Conservation Overlay District - Sample Area', sy: '/NCO', t: 1, cs: '14-504(5)', cl: 'https://codelibrary.amlegal.com/x' })).toMatchObject({
      title: '/NCO Neighborhood Conservation Overlay District, Sample Area',
      links: [{ label: 'Read the rule: Zoning Code section 14-504(5)', url: 'https://codelibrary.amlegal.com/x' }],
    });
    expect(propertyCard({ ad: '1201 N SAMPLE ST', d: '1958-06-24' }).lines).toContain('Listed on its own on June 24, 1958.');
    const site = brownfieldCard({ id: '110000000001', nm: 'FORMER SAMPLE WORKS', ad: '1200 N SAMPLE ST' });
    expect(site.lines).toContain(OWNER_SENTENCE);
    expect(site.links[0]!.url).toContain('p_registry_id=110000000001');
  });
});

describe('downloads (docs/ETHICS.md, "Appeals and hearings")', () => {
  it('never carry who filed an appeal or the owner an appeal names', () => {
    const parcel = shard.parcels.get('990000005')!;
    const row = exportRow({ registry, state: defaultState(registry, 'analysis'), siteUrl: 'https://example.org/' }, { id: '990000005', center: [-75.1557, 39.9851], properties: tiles.find((t) => t.id === '990000005') ?? null }, parcel, notes);
    const csv = toCsv({ rows: [row], leftOut: 0, withoutDetails: 0, title: 'test', notes: ['test'], generated: '2026-10-09' });
    expect(csv).not.toContain('QUINN SAMPLE');
    expect(JSON.stringify(row)).not.toMatch(/QUINN|hearing|appeal/i);
  });
});

describe('the lot\'s size (M4.6)', () => {
  it('says the frontage and depth the assessor records, live, as a measure only', () => {
    const live = {
      opa: '990000005', address: '1305 N EXAMPLE AVE', names: ['SAMPLE HOLDINGS LLC'], mailing: null, mailingStreet: null, mailingCityState: null, mailingZip: null,
      category: 'VACANT LAND', buildingDescription: null, saleDate: null, salePrice: null, marketValue: null, homestead: false, frontage: 16, depth: 80.5, lng: -75.15572, lat: 39.98513,
    };
    const view = buildDossier(input('990000005', { liveOn: true, live: { ...IDLE_PARTS, property: ok(live) } }));
    expect(view.summary.lotSize).toBe("The City's assessor records it as about 16 feet wide on the street and 81 feet deep.");
    expect(buildDossier(input('990000005')).summary.lotSize).toBeNull();
    const parsed = parseShard({ schema: 1, parcels: { '990000005': { lot_size: { frontage: 20, depth: 100 } } } }).shard!.parcels.get('990000005')!;
    expect(parsed.lotSize).toEqual({ frontage: 20, depth: 100 });
  });
});

describe('historic district names', () => {
  it('match across the two City layers, and the Register\'s capitals read as words', () => {
    const view = (rules: object) =>
      buildDossier(
        input('990000005', {
          shard: { status: 'found', parcel: { ...shard.parcels.get('990000005')!, rules: parseRules(rules) }, generatedAt: shard.generatedAt, notes },
        }),
      ).rules.historic!.lines;
    expect(view({ historic: { districts: [{ name: 'Ridge Avenue Roxborough' }], register: { district: 'Ridge Ave Roxborough', district_date: '2018-10-12' } } })).toEqual([
      'This lot is in the Ridge Avenue Roxborough historic district, designated on October 12, 2018.',
      'This property is on the Philadelphia Register of Historic Places as part of the Ridge Avenue Roxborough historic district.',
    ]);
    expect(view({ historic: { districts: [{ name: 'Germantown Urban Village', date: '2024-02-09' }], register: { district: 'GERMANTOWN URBAN VILLAGE' } } })[1]).toBe(
      'This property is on the Philadelphia Register of Historic Places as part of the Germantown Urban Village historic district.',
    );
    expect(view({ historic: { register: { district: 'SPRING GARDEN' } } })).toEqual([
      'This property is on the Philadelphia Register of Historic Places as part of the Spring Garden historic district.',
    ]);
  });
});
