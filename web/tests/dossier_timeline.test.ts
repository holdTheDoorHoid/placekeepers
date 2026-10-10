// The story of a lot in one timeline (issue #38): the sentences on top come only from records and
// say where each comes from; every kind can be switched off; the page reads the same with live
// data on or off (live only adds newer records); records never downloaded are said to be missing;
// deeds before 2000 are labeled; the print shows the 10 newest records; and the weekly copy's
// records load only when the History part asks for them.

import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import Dossier from '../src/components/dossier/Dossier.svelte';
import DossierPrint from '../src/components/dossier/DossierPrint.svelte';
import { parseManifest } from '../src/data/manifest.ts';
import { IDLE_PARTS, buildDossier, type DossierInput, type HistoryState, type Part } from '../src/dossier/build.ts';
import { readLi } from '../src/dossier/carto.ts';
import { DossierController, TIMELINE_HIDDEN_KEY } from '../src/dossier/controller.svelte.ts';
import { clearHistoryCache, historyOf, historyPath, parseHistoryShard } from '../src/dossier/history.ts';
import { PRINT_LIMITS, printModel } from '../src/dossier/print.ts';
import { clearShardCache, parseCommon, parseShard } from '../src/dossier/shard.ts';
import { buildTimeline, byYear, groupLi, permitText, storyOf, withOlder, type LiGroups } from '../src/dossier/timeline.ts';
import type { LiveLi, Transfer } from '../src/dossier/types.ts';
import { defaultState } from '../src/state/defaults.ts';
import { storageKey } from '../src/state/storage.ts';
import { strings } from '../src/strings.ts';
import { findDashViolations } from '../src/style/no-dashes.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const json = (path: string) => JSON.parse(read(path));
const registry = loadRegistry();
const manifest = parseManifest(json('../fixtures/data/manifest.json')).manifest!;
const SHARD = json('../fixtures/data/dossiers/9900.json');
const HISTORY = json('../fixtures/data/dossiers/history/9900.json');
const shard = parseShard(SHARD).shard!;
const history = parseHistoryShard(HISTORY).shard!;
const notes = parseCommon(json('../fixtures/data/dossiers/common.json'));
const NOW = new Date('2026-10-04T18:30:00Z');
const AT = Date.parse('2026-10-04T18:14:00Z');
const tl = strings.dossier.history.timeline;

const found = (opa: string): HistoryState => ({ status: 'found', parcel: historyOf(history, opa), generatedAt: history.generatedAt });
const ok = <T>(data: T): Part<T> => ({ status: 'ok', data, at: AT });

function input(opa: string, over: Partial<DossierInput> = {}): DossierInput {
  const parcel = shard.parcels.get(opa)!;
  return {
    opa,
    registry,
    state: defaultState(registry, 'analysis'),
    manifest,
    shard: { status: 'found', parcel, generatedAt: shard.generatedAt, notes },
    tile: null,
    live: IDLE_PARTS,
    liveOn: false,
    center: [-75.1557, 39.9851],
    now: NOW,
    history: found(opa),
    ...over,
  };
}

/** The weekly copy's records turned back into the rows the City sends live (one per record). */
function cityRows(groups: LiGroups): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const [kind, records] of Object.entries(groups)) {
    for (const r of records ?? []) {
      for (let i = 0; i < r.count; i++) rows.push({ kind, date: r.date ? `${r.date}T16:00:00Z` : null, title: r.title, status: r.status, detail: r.detail });
    }
  }
  return rows;
}

const liveFrom = (groups: LiGroups, extra: Record<string, unknown>[] = []): LiveLi => readLi([...extra, ...cityRows(groups)]);
const flat = (view: ReturnType<typeof buildDossier>) => view.history.timeline.years.flatMap((y) => y.rows.map((r) => [y.year, r.dateLabel, r.label, r.items.map((i) => i.text).join(' | ')]));

describe('the story of the lot', () => {
  it('says a building stood here until the City demolished it, from L&I\'s demolition records', () => {
    const view = buildDossier(input('990000002'));
    expect(view.history.timeline.story).toEqual([
      { text: 'A building stood here until 2011, when the City demolished it.', source: "L&I's demolition records" },
      { text: 'It was sold at a sheriff sale in 2006.', source: "the City's deed records" },
    ]);
  });

  it('says when it was demolished under a private permit, and a permit for new construction from that year on', () => {
    expect(buildDossier(input('990000004')).history.timeline.story.map((s) => s.text)).toEqual([
      'A building stood here until 2019, when it was demolished under a private permit.',
      'L&I issued a permit for new construction here in 2021.',
    ]);
  });

  it('names a notice still open, then the City\'s clean and seal work', () => {
    expect(buildDossier(input('990000001')).history.timeline.story.map((s) => s.text)).toEqual([
      'L&I has listed the building as unsafe since May 2, 2023.',
      'The City last sent its clean and seal crews here in 2024; it has done so 2 times.',
    ]);
    expect(buildDossier(input('990000029')).history.timeline.story[0]!.text).toBe('L&I has listed the building as imminently dangerous since December 3, 2025.');
  });

  it('falls back to the vacancy lists, and says nothing it cannot back with a record', () => {
    expect(buildDossier(input('990000005')).history.timeline.story).toEqual([
      {
        text: "The City's list of vacant land of October 4, 2026 includes it, as a list of June 2024 did.",
        source: "the City's vacant property list, and L&I's list of June 2024 kept by Clean & Green Philly",
      },
    ]);
    expect(buildDossier(input('990000009')).history.timeline.story.map((s) => s.text)).toEqual([
      'It was sold at a sheriff sale in 2003.',
      "L&I's list of vacant land of June 2024 included it.",
    ]);
    expect(buildDossier(input('990000098')).history.timeline.story).toEqual([]);
  });

  it('counts a permit for new construction from the year of the demolition, not before', () => {
    const li: LiGroups = {
      demolition: [{ date: '2016-10-07', title: 'FULL', status: 'COMPLETED', detail: 'NO', count: 1 }],
      permit: [
        { date: '2016-09-06', title: 'ENTIRE', status: 'COMPLETED', detail: 'NEW CONSTRUCTION PERMIT', count: 1 },
        { date: '2015-03-01', title: 'NEWCON', status: 'COMPLETED', detail: 'ZONING/USE PERMIT', count: 1 },
      ],
    };
    expect(storyOf({ transfers: [], li, lists: [], landcare: null, today: '2026-10-04' }).map((s) => s.text)).toEqual([
      'A building stood here until 2016, when it was demolished under a private permit.',
      'L&I issued a permit for new construction here in 2016.',
    ]);
  });

  it('never says the City sealed a building after the same page says it was demolished', () => {
    // 4465 Frankford Ave (232487100), v0.4 review: the City demolished the building in 2014 and
    // its Community Life Improvement Program cleaned the empty lot in 2019, a "CLIP C&S" record.
    const li: LiGroups = {
      demolition: [{ date: '2014-10-15', title: 'CASE', status: 'COMPLETED', detail: 'YES', count: 1 }],
      clean_seal: [{ date: '2019-05-31', title: 'CLIP C&S', status: 'APPROVED', detail: null, count: 1 }],
    };
    const lists = [{ list: 'city_land' as const, date: '2026-10-04' }];
    expect(storyOf({ transfers: [], li, lists, landcare: null, today: '2026-10-09' }).map((s) => s.text)).toEqual([
      'A building stood here until 2014, when the City demolished it.',
      "The City's list of vacant land of October 4, 2026 includes it.",
    ]);
    // A seal before the demolition says nothing about today either.
    const before: LiGroups = { ...li, clean_seal: [{ date: '2012-05-31', title: 'C&S', status: 'APPROVED', detail: null, count: 1 }] };
    expect(storyOf({ transfers: [], li: before, lists: [], landcare: null, today: '2026-10-09' }).map((s) => s.text)).toEqual([
      'A building stood here until 2014, when the City demolished it.',
    ]);
  });

  it('never says a building was sealed where the records show none: the crews also clean empty lots', () => {
    // 5419 Lena St (122138300), v0.4 review: vacant land with two "CLIP C&S" records and no
    // building in any record.
    const li: LiGroups = {
      clean_seal: [
        { date: '2016-11-16', title: 'CLIP C&S', status: 'Approved', detail: null, count: 1 },
        { date: '2011-12-27', title: 'CLIP C&S', status: 'Approved', detail: null, count: 1 },
      ],
    };
    const story = storyOf({ transfers: [], li, lists: [], landcare: null, today: '2026-10-09' }).map((s) => s.text);
    expect(story).toEqual(['The City last sent its clean and seal crews here in 2016; it has done so 2 times.']);
    expect(story.join(' ')).not.toMatch(/building/);
  });

  it('never tells a story from a record dated in the future, or a demolition not completed', () => {
    const li: LiGroups = {
      demolition: [
        { date: '2088-08-17', title: 'FULL', status: 'COMPLETED', detail: 'NO', count: 1 },
        { date: '2020-01-01', title: 'CITY DEMOLITION', status: 'CANCELLED', detail: 'YES', count: 1 },
        { date: '2019-01-01', title: 'TANKRI', status: 'COMPLETED', detail: 'NO', count: 1 },
      ],
    };
    expect(storyOf({ transfers: [], li, lists: [], landcare: null, today: '2026-10-04' })).toEqual([]);
    const timeline = buildTimeline({ transfers: [], li, lists: [], landcare: null, today: '2026-10-04' });
    expect(timeline.rows[0]).toMatchObject({ day: '2088-08-17', future: true });
  });
});

describe('the timeline', () => {
  it('lists every kind of record newest first, grouped by year, with LandCare dated by its year', () => {
    const view = buildDossier(input('990000002'));
    expect(flat(view)).toEqual([
      ['2026', 'Oct 4', 'Vacancy record', "On the City's list of vacant land"],
      ['2024', 'Jun 24', 'Vacancy record', "On L&I's list of vacant land of June 2024, as kept by Clean & Green Philly"],
      ['2016', '', 'Vacancy record', 'PHS LandCare began caring for this lot'],
      ['2015', 'Jul 1', 'Violation', 'High weeds-cut'],
      ['2011', 'Jun 14', 'Demolition', 'City demolition, by the City'],
      ['2009', 'Apr 20', 'Clean and seal', 'Cleaned and sealed by the City'],
      ['2006', 'Feb 1', 'Deed', "Sheriff's deed, $900, to CITY OF PHILADELPHIA"],
    ]);
    expect(view.history.timeline.kinds.map((k) => [k.id, k.count])).toEqual([
      ['deed', 1],
      ['violation', 1],
      ['demolition', 1],
      ['clean_seal', 1],
      ['vacancy', 3],
    ]);
  });

  it('puts violations of one day together, and keeps the City\'s titles plain, with no case numbers', () => {
    const view = buildDossier(input('990000001'));
    const august = view.history.timeline.years.find((y) => y.year === '2025')!.rows.find((r) => r.kind === 'violation')!;
    expect(august.items.map((i) => [i.text, i.open])).toEqual([
      ['Exterior area weeds', true],
      ['Vacant structure and land', true],
    ]);
    const rows = flat(view).map((r) => r.join(' '));
    expect(rows).toContain('2019 May 2 Violation Dumping, private lot');
    expect(rows).toContain('2024 Jan 10 Violation Rubbish & garbage (2 times)');
    expect(rows).toContain('2012 Aug 1 Permit Alteration permit for major alterations');
    expect(rows).toContain('2018 Mar 1 Clean and seal Cleaned and sealed by the City\'s Community Life Improvement Program');
    expect(JSON.stringify(view.history.timeline)).not.toMatch(/case ?number|casenumber|permitnumber/i);
  });

  it('says permits in plain words', () => {
    const permit = (title: string | null, detail: string | null) => permitText({ date: null, title, status: null, detail, count: 1 });
    expect(permit('New Construction', 'Residential Building Permit')).toBe('Residential building permit for new construction');
    expect(permit('NEWCON', 'ZONING/USE PERMIT')).toBe('Zoning/use permit for new construction');
    expect(permit('EZPLUM', 'PLUMBING PERMIT')).toBe('Plumbing permit');
    expect(permit('Minor Demolition', 'Demolition Permit')).toBe('Demolition permit for minor demolition');
    expect(permit(null, null)).toBe('Permit');
  });

  it('hides the kinds the reader switched off, in the page and in print', () => {
    const view = buildDossier(input('990000001', { hiddenKinds: ['violation', 'deed'] }));
    const kinds = new Set(view.history.timeline.years.flatMap((y) => y.rows.map((r) => r.kind)));
    expect(kinds.has('violation') || kinds.has('deed')).toBe(false);
    expect(view.history.timeline.kinds.find((k) => k.id === 'violation')!.shown).toBe(false);
    expect(printModel(view, NOW).history.events.every((e) => e.kind !== 'Violation' && e.kind !== 'Deed')).toBe(true);
  });

  it('labels deeds from before 2000 as from records the City says may be incomplete', () => {
    const deed: Transfer = { date: '1987-06-12', type: 'DEED', price: 15000, from: ['A'], to: ['B'], fromMore: 0, toMore: 0, properties: 1 };
    const later: Transfer = { ...deed, date: '2001-01-02' };
    const timeline = buildTimeline({ transfers: [later, deed], li: {}, lists: [], landcare: null, today: '2026-10-04' });
    expect(timeline.rows.map((r) => r.items[0]!.early)).toEqual([false, true]);
    const parcel = { ...shard.parcels.get('990000005')!, transfers: [later, deed] };
    const view = buildDossier(input('990000005', { shard: { status: 'found', parcel, generatedAt: shard.generatedAt, notes } }));
    expect(view.history.transfers!.map((t) => t.early)).toEqual([false, true]);
    const page = render(Dossier, { props: { view, manifest, idPrefix: 'early' } }).body;
    expect(page.split(strings.dossier.history.earlyDeed).length - 1).toBe(2);
  });
});

describe('live data on or off', () => {
  for (const opa of ['990000001', '990000002', '990000004', '990000005', '990000029']) {
    it(`${opa} shows the same timeline either way`, () => {
      const off = buildDossier(input(opa));
      const li = historyOf(history, opa).li!;
      const on = buildDossier(input(opa, { liveOn: true, live: { ...IDLE_PARTS, li: ok(liveFrom(li)) } }));
      expect(flat(on)).toEqual(flat(off));
      expect(on.history.timeline.story).toEqual(off.history.timeline.story);
      expect(on.history.timeline.provenance.tone).toBe('live');
      expect(off.history.timeline.provenance.text).toMatch(/weekly snapshot of October 4, 2026/);
    });
  }

  it('lets live data add a newer record, and nothing else changes', () => {
    const li = historyOf(history, '990000005').li!;
    const off = flat(buildDossier(input('990000005')));
    const newer = { kind: 'violation', date: '2026-09-30T20:30:00Z', title: 'HIGH WEEDS-CUT', status: 'OPEN', detail: null };
    const on = flat(buildDossier(input('990000005', { liveOn: true, live: { ...IDLE_PARTS, li: ok(liveFrom(li, [newer])) } })));
    // An evening record in UTC is still September 30 in Philadelphia.
    const added = ['2026', 'Sep 30', 'Violation', 'High weeds-cut'];
    expect(on).toContainEqual(added);
    expect(on.filter((row) => JSON.stringify(row) !== JSON.stringify(added))).toEqual(off);
  });

  it('completes a live answer the City cut short with the weekly copy\'s older records', () => {
    const copy = historyOf(history, '990000001').li!;
    // The City answers newest first across every kind and stops at its limit.
    const newest = cityRows(copy)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 6);
    const live = groupLi(readLi(newest).events);
    expect(live.permit).toBeUndefined();
    expect(withOlder(live, copy)).toEqual(copy);
  });
});

describe('records the weekly copy does not hold', () => {
  it('says L&I records are missing for a parcel outside the downloads, and offers live data', () => {
    const view = buildDossier(input('990000013'));
    expect(view.history.timeline.notes).toEqual([{ text: tl.liMissing, offerLive: true, retry: false }]);
    expect(view.history.timeline.years.flatMap((y) => y.rows).some((r) => r.kind === 'violation')).toBe(false);
  });

  it('waits for the History part to open, then loads, then reads the copy', () => {
    expect(buildDossier(input('990000002', { history: { status: 'idle' } })).history.timeline.status).toBe('waiting');
    // Still waiting for the copy when the City answered first: the copy holds the vacancy records.
    const liveFirst = buildDossier(input('990000002', { history: { status: 'idle' }, liveOn: true, live: { ...IDLE_PARTS, li: ok(liveFrom({})) } }));
    expect(liveFirst.history.timeline.status).toBe('waiting');
    expect(buildDossier(input('990000002', { history: { status: 'loading' } })).history.timeline.status).toBe('loading');
    const failed = buildDossier(input('990000002', { history: { status: 'failed' } })).history.timeline;
    expect(failed.status).toBe('ready');
    expect(failed.notes[0]).toMatchObject({ text: tl.failed, retry: true });
    // Without the copy's records, the deeds and the dossier's LandCare year still show.
    expect(failed.years.flatMap((y) => y.rows).map((r) => r.kind)).toEqual(['vacancy', 'deed']);
  });

  it('reads a history shard forgivingly and knows a parcel it does not name has no records', () => {
    expect(parseHistoryShard({ schema: 2, parcels: {} }).shard).toBeNull();
    const odd = parseHistoryShard({
      schema: 1,
      parts: ['li'],
      parcels: { '990000001': { li: { violation: [['2020-01-01', 'X'], 'junk', [null, null]], complaint: [['2020-01-01', 'Y']] }, lists: [['2020-01-01', 'other_list'], ['2020-02-02', 'city_land']] }, nope: {} },
    }).shard!;
    expect(odd.parcels.get('990000001')).toEqual({
      li: { violation: [{ date: '2020-01-01', title: 'X', status: null, detail: null, count: 1 }] },
      lists: [{ date: '2020-02-02', list: 'city_land' }],
    });
    expect(historyOf(odd, '990000077')).toEqual({ li: {}, lists: [] });
    expect(historyOf({ ...odd, parts: [] }, '990000077')).toEqual({ li: null, lists: [] });
    expect(historyPath('990000001', manifest)).toBe('dossiers/history/9900.json');
    expect(historyPath('120000001', manifest)).toBeNull();
    expect(historyPath('990000001', { dossiers: { ...manifest.dossiers!, history: null } })).toBeNull();
  });
});

describe('the History part', () => {
  it('shows the story with its sources, the switches, the years, and a spot for old aerial photos', () => {
    const view = buildDossier(input('990000002'));
    // M4.3 (issue #39) adds a button for old aerial photos under the story.
    const historyExtra = createRawSnippet(() => ({ render: () => '<button type="button">Old aerial photos</button>' }));
    const page = render(Dossier, { props: { view, manifest, idPrefix: 'h', historyExtra } }).body;
    expect(page).toContain(tl.storyTitle);
    expect(page).toContain('A building stood here until 2011, when the City demolished it. <span class="source');
    expect(page).toContain(tl.storySource("L&amp;I's demolition records"));
    expect(page).toMatch(/<legend[^>]*>Show in the timeline<\/legend>/);
    expect((page.match(/type="checkbox"/g) ?? []).length).toBe(5);
    // The six most recent years first, then a button for the rest.
    expect(page).toMatch(/<h5 class="year[^"]*">2026<\/h5>[\s\S]*<h5 class="year[^"]*">2009<\/h5>/);
    expect(page).not.toMatch(/<h5 class="year[^"]*">2006<\/h5>/);
    expect(page).toContain(tl.moreYears(1));
    const button = page.indexOf('Old aerial photos');
    expect(button).toBeGreaterThan(page.indexOf('A building stood here until 2011'));
    expect(button).toBeLessThan(page.indexOf('id="h-timeline-title"'));
    expect(findDashViolations(page.replace(/<[^>]+>/g, ' '))).toEqual([]);
  });

  it('prints the 10 newest records of the timeline', () => {
    const view = buildDossier(input('990000001'));
    const model = printModel(view, NOW);
    expect(model.history.events).toHaveLength(PRINT_LIMITS.events);
    expect(model.history.events[0]).toEqual({ date: 'Oct 4, 2026', kind: 'Vacancy record', text: "On the City's list of vacant buildings" });
    expect(model.history.moreEvents).toBe(view.history.timeline.shown - PRINT_LIMITS.events);
    expect(model.history.timelineNote).toBeNull();
    const page = render(DossierPrint, { props: { view, now: NOW } }).body;
    expect(page).toContain(tl.printTitle);
    expect(page).toContain('L&amp;I has listed the building as unsafe since May 2, 2023.');
  });
});

describe('loading the weekly copy\'s records', () => {
  const BASE = 'https://example.org/data/';

  function city() {
    const asked: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      const key = String(url).startsWith(BASE) ? String(url).slice(BASE.length) : 'city';
      asked.push(key);
      const body = key === 'dossiers/9900.json' ? SHARD : key === 'dossiers/history/9900.json' ? HISTORY : key === 'dossiers/common.json' ? {} : { rows: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    return { asked, fetchImpl };
  }

  it('fetches the history shard only when asked, once per lot', async () => {
    clearShardCache();
    clearHistoryCache();
    const fake = city();
    const dossier = new DossierController({ dataBase: BASE, manifest: async () => manifest, liveOn: () => false, fetchImpl: fake.fetchImpl });
    dossier.open('990000002');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.asked).not.toContain('dossiers/history/9900.json');
    expect(dossier.history.status).toBe('idle');
    await Promise.all([dossier.loadHistory(), dossier.loadHistory()]);
    expect(fake.asked.filter((k) => k === 'dossiers/history/9900.json')).toHaveLength(1);
    expect(dossier.history).toMatchObject({ status: 'found', parcel: { lists: [{ list: 'city_land' }, { list: 'june_2024_land' }] } });
    // Another lot starts again, from the same downloaded file.
    dossier.open('990000004');
    expect(dossier.history.status).toBe('idle');
    await dossier.loadHistory();
    expect(dossier.history.status).toBe('found');
    expect(fake.asked.filter((k) => k === 'dossiers/history/9900.json')).toHaveLength(1);
  });

  it('says when this build has no history files', async () => {
    clearHistoryCache();
    const fake = city();
    const older = { ...manifest, dossiers: { ...manifest.dossiers!, history: null } };
    const dossier = new DossierController({ dataBase: BASE, manifest: async () => older, liveOn: () => false, fetchImpl: fake.fetchImpl });
    dossier.open('990000002');
    await dossier.loadHistory();
    expect(dossier.history.status).toBe('unpublished');
    expect(fake.asked).not.toContain('dossiers/history/9900.json');
  });

  it('remembers the kinds switched off, in this browser only', () => {
    const dossier = new DossierController({ dataBase: BASE, manifest: async () => manifest, liveOn: () => false });
    const before = dossier.hiddenKinds;
    dossier.toggleKind('permit');
    expect(dossier.hiddenKinds).toEqual([...before, 'permit']);
    dossier.toggleKind('permit');
    expect(dossier.hiddenKinds).toEqual(before);
    expect(storageKey(TIMELINE_HIDDEN_KEY)).toBe('placekeepers:v1:timeline-hidden');
  });
});

describe('grouping by year', () => {
  it('puts records with no date last', () => {
    const timeline = buildTimeline({
      transfers: [],
      li: { violation: [{ date: null, title: 'WEEDS', status: null, detail: null, count: 1 }, { date: '2020-05-05', title: 'TRASH', status: null, detail: null, count: 1 }] },
      lists: [],
      landcare: null,
      today: '2026-10-04',
    });
    expect(byYear(timeline.rows).map((y) => y.year)).toEqual(['2020', tl.noDate]);
  });
});
