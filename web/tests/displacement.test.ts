// The displacement watch (M4.1; docs/ETHICS.md, "Displacement"): the signs and the rule match the
// pipeline's, a greening card in a watch area adds the ETHICS.md text word for word with the
// area's signs and the ways to protect neighbors, outside one it keeps the one line caution (D12),
// and the lot page, its print and downloads follow the same rule. A tapped area lists its signs in
// care words and ranks nothing.

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import WatchCard from '../src/components/displacement/WatchCard.svelte';
import WatchDetails from '../src/components/displacement/WatchDetails.svelte';
import Dossier from '../src/components/dossier/Dossier.svelte';
import DossierPrint from '../src/components/dossier/DossierPrint.svelte';
import PlaceCard from '../src/components/places/PlaceCard.svelte';
import StopCard from '../src/components/transit/StopCard.svelte';
import TransitStopDetails from '../src/components/transit/TransitStopDetails.svelte';
import { parseStopTable } from '../src/transit/answers.ts';
import { GREENING_SUGGESTIONS, displacementCaution } from '../src/config/suggestions.ts';
import { parseManifest } from '../src/data/manifest.ts';
import {
  PROTECTION_ROUTES,
  SIGNS,
  PRICE_SIGNS,
  describeArea,
  isWatch,
  listWatch,
  protectionLinks,
  signsText,
  tractNumber,
  watchNote,
  watchSigns,
} from '../src/displacement/watch.ts';
import { IDLE_PARTS, buildDossier } from '../src/dossier/build.ts';
import { printModel } from '../src/dossier/print.ts';
import { parseCommon, parseShard } from '../src/dossier/shard.ts';
import { displacementWatch, WATCH_TAP_MAX_ZOOM } from '../src/map/styles/displacement_watch.ts';
import { gatherExport, toCsv } from '../src/places/export.ts';
import { nearestPlaces } from '../src/places/rank.ts';
import { defaultState } from '../src/state/defaults.ts';
import { AppStore, PICK_MIN_ZOOM } from '../src/state/store.svelte.ts';
import { collectStrings, strings } from '../src/strings.ts';
import type { NearbyStop } from '../src/transit/comfort.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const registry = loadRegistry();
const manifest = parseManifest(read('../fixtures/data/manifest.json')).manifest!;
const shard = parseShard(read('../fixtures/data/dossiers/9900.json')).shard!;
const notes = parseCommon(read('../fixtures/data/dossiers/common.json'));
const parity = read('../../pipeline/tests/fixtures/watch_parity.json') as {
  signs: Record<string, number>;
  price_signs: number;
  cases: { signs: number; watch: boolean }[];
};
const PARCELS = read('../fixtures/sources/parcels.geojson').features as { properties: Record<string, unknown> }[];
const AREAS = read('../fixtures/data/tiles/displacement.watch.geojson').features as { properties: Record<string, unknown> }[];
const ETHICS = readFileSync(new URL('../../docs/ETHICS.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');
const CAUTION = 'Greening can raise nearby prices. Consider pairing it with protections.';

function textOf(markup: string): string {
  return markup
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function lotView(opa: string, tile: Record<string, unknown> | null = null) {
  return buildDossier({
    opa,
    registry,
    state: defaultState(registry, 'analysis'),
    manifest,
    shard: { status: 'found', parcel: shard.parcels.get(opa)!, generatedAt: shard.generatedAt, notes },
    tile,
    live: IDLE_PARTS,
    liveOn: false,
    center: [-75.1557, 39.9851],
    now: new Date('2026-10-04T18:30:00Z'),
  });
}

describe("the signs and the rule are the pipeline's", () => {
  it('reads the bits and the rule of watch_parity.json', () => {
    expect(SIGNS).toEqual(parity.signs);
    expect(PRICE_SIGNS).toBe(parity.price_signs);
    for (const c of parity.cases) expect(isWatch(c.signs), String(c.signs)).toBe(c.watch);
  });

  it('takes the signs from the tile first, then the dossier, and never a combination outside the watch', () => {
    expect(watchSigns({ dw: 7 })).toBe(7);
    expect(watchSigns({ dw: '28' })).toBe(28);
    expect(watchSigns(null, 7)).toBe(7);
    expect(watchSigns({ dw: 7 }, 28)).toBe(7);
    // Companies, renters and rent burden alone are not a watch area; nor are a single sign or
    // nonsense, such as a bit no sign has.
    for (const bad of [SIGNS.companies | SIGNS.renters, SIGNS.rent_burden, SIGNS.renters | SIGNS.rent_burden, SIGNS.prices, 0, 64, 64 | 7, -1, 'x', null]) {
      expect(watchSigns({ dw: bad })).toBeNull();
    }
    // Rent burden with a sign about prices is (owner, 2026-10-09).
    expect(watchSigns({ dw: SIGNS.mva | SIGNS.rent_burden })).toBe(48);
    expect(watchSigns(null, 39)).toBe(39);
  });

  it('never makes a watch area of rent burden without a sign about prices', () => {
    expect(isWatch(SIGNS.rent_burden)).toBe(false);
    expect(isWatch(SIGNS.rent_burden | SIGNS.renters | SIGNS.companies)).toBe(false);
    for (const price of [SIGNS.prices, SIGNS.assessments, SIGNS.mva]) expect(isWatch(price | SIGNS.rent_burden)).toBe(true);
    expect(parity.cases).toHaveLength(64);
  });

  it('says the signs in plain words, prices first', () => {
    expect(signsText(SIGNS.prices | SIGNS.companies | SIGNS.assessments)).toBe(
      "home prices rising faster than across the city; the City's assessed values rising faster than across the city; and companies buying many of the homes sold",
    );
    expect(signsText(SIGNS.renters | SIGNS.mva)).toBe("the City's Market Value Analysis finding home prices climbing out of reach of longtime residents; and at least three in five homes rented");
    expect(signsText(SIGNS.assessments | SIGNS.rent_burden)).toBe(
      "the City's assessed values rising faster than across the city; and many renters paying half their income or more on rent",
    );
  });

  it('names a census tract as people write it', () => {
    expect(tractNumber('42101016000')).toBe('160');
    expect(tractNumber('42101000101')).toBe('1.01');
    expect(tractNumber('42101989100')).toBe('9891');
  });
});

describe('the ways to protect neighbors', () => {
  const OFFICIAL = /^https:\/\/(www\.)?(ngtrust\.org|groundedsolutions\.org|phila\.gov|phillyvip\.org)\//;

  it('links each protection ETHICS.md names to its official page, with the day it was checked', () => {
    expect(ETHICS).toContain('the Neighborhood Gardens Trust, community land trust guidance, the City\'s Homestead Exemption and Longtime Owner Occupants Program, and tangled title help');
    const links = protectionLinks(registry);
    expect(links.map((l) => l.id)).toEqual([...PROTECTION_ROUTES]);
    for (const link of links) {
      expect(link.url, link.id).toMatch(OFFICIAL);
      expect(link.checked, link.id).toMatch(/^2026-\d\d-\d\d$/);
      const route = registry.routes.find((r) => r.id === link.id)!;
      expect(route.status).toBe('verified');
    }
  });
});

describe('greening cards in and out of watch areas', () => {
  const state = defaultState(registry, 'field');
  const places = PARCELS.map((f) => ({ id: String(f.properties.id), properties: f.properties, center: [-75.155, 39.985] as [number, number] }));
  const nearby = nearestPlaces(registry, state, places, [-75.155, 39.985]);
  const fakeStore = {
    registry,
    state,
    addresses: { get: () => null },
    lists: { active: null, has: () => false },
    inspected: null,
  } as unknown as AppStore;
  const card = (place: (typeof nearby)[number]) => textOf(render(PlaceCard, { props: { store: fakeStore, place, lensLabel: 'Violence reduction', fromYou: false } }).body);

  it('adds the area, its signs and every protection inside a watch area', () => {
    const inside = nearby.find((p) => p.suggestions[0]?.id === 'clean_and_green' && p.properties.dw === 39)!;
    const text = card(inside);
    expect(text).toContain(CAUTION);
    expect(text).toContain('This place is in a displacement watch area, with signs that prices are rising here: home prices rising faster than across the city');
    for (const label of ['Neighborhood Gardens Trust', 'Community land trusts', "The City's Homestead Exemption", "The City's Longtime Owner Occupants Program (LOOP)", 'Help with a tangled title']) {
      expect(text).toContain(label);
    }
  });

  it('keeps the one line caution outside every watch area', () => {
    const outside = nearby.find((p) => p.suggestions[0]?.id === 'clean_and_green' && p.properties.dw === undefined)!;
    const text = card(outside);
    expect(text).toContain(CAUTION);
    expect(text).not.toContain('displacement watch area');
    expect(text).not.toContain('Homestead');
  });

  it('adds nothing to a building to seal, even inside a watch area', () => {
    const sealing = nearby.find((p) => p.suggestions[0]?.id === 'seal_abandoned_building' && p.properties.dw !== undefined)!;
    expect(card(sealing)).not.toContain(CAUTION);
  });

  it('does the same for shade trees at a bus stop', () => {
    const store = new AppStore(registry, { state: defaultState(registry, 'field'), viewPinned: true }, { listStorage: null });
    const suggestion = { suggestion: registry.suggestions.find((s) => s.id === 'stop_shade_trees')!, firstStep: null, routes: [], partners: [] };
    const stop = (properties: Record<string, unknown>): NearbyStop =>
      ({ id: 'sp9', layerId: 'transit_stops', properties, lngLat: [-75.15, 39.98], distance: 10, kind: 'bus', title: 'Sample St', routes: null, why: null, score: null, main: null, suggestions: [suggestion] }) as unknown as NearbyStop;
    const inside = textOf(render(StopCard, { props: { store, stop: stop({ id: 'sp9', dw: 28 }), lensLabel: 'Transit comfort', fromYou: false } }).body);
    expect(inside).toContain(CAUTION);
    expect(inside).toContain('displacement watch area');
    const outside = textOf(render(StopCard, { props: { store, stop: stop({ id: 'sp9' }), lensLabel: 'Transit comfort', fromYou: false } }).body);
    expect(outside).toContain(CAUTION);
    expect(outside).not.toContain('displacement watch area');
  });

  it("does the same in a tapped stop's details", () => {
    const stops = read('../fixtures/data/tiles/transit.stops.geojson').features as { properties: Record<string, unknown> }[];
    const shaded = stops.find((f) => f.properties.id === 'sp1002')!.properties;
    const store = new AppStore(registry, { state: defaultState(registry, 'analysis'), viewPinned: true }, { listStorage: null });
    store.stopTable = parseStopTable(read('../fixtures/data/tables/stop_amenities.json'))!;
    store.stopTableStatus = 'ok';
    const details = (properties: Record<string, unknown>) => textOf(render(TransitStopDetails, { props: { store, features: [properties] } }).body);
    const outside = details(shaded);
    expect(outside).toContain(CAUTION);
    expect(outside).not.toContain('displacement watch area');
    const inside = details({ ...shaded, dw: SIGNS.prices | SIGNS.renters });
    expect(inside).toContain('displacement watch area, with signs that prices are rising here: home prices rising faster than across the city; and at least three in five homes rented');
  });

  it('shows the full card once above a list of nearby places, and each card there points to it', () => {
    const inside = nearby.filter((p) => p.suggestions[0] && displacementCaution(p.suggestions[0].id) && watchSigns(p.properties) !== null);
    const outside = nearby.filter((p) => p.suggestions[0] && displacementCaution(p.suggestions[0].id) && watchSigns(p.properties) === null);
    expect(inside.length).toBeGreaterThan(1);
    expect(outside.length).toBeGreaterThan(0);
    const cards = (places: typeof nearby) => places.map((p) => ({ suggestionId: p.suggestions[0]?.id, properties: p.properties }));
    // A list with places in watch areas: the card above it, with each caution once.
    const list = listWatch(registry, cards([...inside, ...outside]))!;
    expect(list.text).toBe(strings.displacement.listIntro);
    expect(list.links.map((l) => l.id)).toEqual([...PROTECTION_ROUTES]);
    expect(new Set(list.cautions).size).toBe(list.cautions.length);
    expect(list.cautions).toContain(CAUTION);
    // A list with no place in a watch area, or only a building to seal there, needs none.
    expect(listWatch(registry, cards(outside))).toBeNull();
    const sealing = nearby.filter((p) => p.suggestions[0]?.id === 'seal_abandoned_building' && p.properties.dw !== undefined);
    expect(sealing.length).toBeGreaterThan(0);
    expect(listWatch(registry, cards(sealing))).toBeNull();
    // Each card in a watch area keeps its caution and its own area's signs, and points to the card
    // above instead of repeating the protections.
    const jumping = (place: (typeof nearby)[number]) =>
      textOf(render(PlaceCard, { props: { store: fakeStore, place, lensLabel: 'Violence reduction', fromYou: false, watchJump: 'pk-places-watch' } }).body);
    const text = jumping(inside[0]!);
    expect(text).toContain(CAUTION);
    expect(text).toContain(watchNote(registry, watchSigns(inside[0]!.properties))!.text);
    expect(text).toContain(strings.displacement.jumpToProtections);
    expect(text).not.toContain('Homestead');
    // Outside every watch area a card is unchanged.
    expect(jumping(outside[0]!)).toContain(`${CAUTION} Ways to protect neighbors`);
    // The card above, as the list shows it.
    const above = render(WatchCard, { props: { id: 'pk-places-watch', heading: strings.displacement.watchTitle, level: 3, cautions: list.cautions, text: list.text, links: list.links } }).body;
    expect(above).toContain('id="pk-places-watch"');
    expect(textOf(above)).toContain("The City's Homestead Exemption");
  });

  it('covers every greening suggestion', () => {
    for (const id of GREENING_SUGGESTIONS) expect(registry.suggestions.some((s) => s.id === id), id).toBe(true);
  });
});

describe('the lot page, its print and downloads follow the same rule', () => {
  it('shows the full card on a lot page in a watch area, opened from a link (the dossier) or the map (the tile)', () => {
    // Sample Heights holds rent burden too since 2026-10-09 (39 = 1, 2, 4 and 32).
    for (const [view, signs] of [
      [lotView('990000013'), 39],
      [lotView('990000005', { dw: 7, k: 1, vc: 3, sg: 'clean_and_green' }), 7],
    ] as const) {
      expect(view.actions.watch?.signs).toBe(signs);
      const page = textOf(render(Dossier, { props: { view, manifest, showTitle: true, idPrefix: 'test' } }).body);
      expect(page).toContain(CAUTION);
      expect(page).toContain('displacement watch area');
      expect(page).toContain("The City's Homestead Exemption");
    }
  });

  it('shows the full card exactly once on a lot page in a watch area, and each card points to it', () => {
    // 990000013 on the map lists four suggestions with a caution: clean and green, green the lot to
    // cool the block, a place to sit in the shade and a community garden (its page opened from the
    // map before its dossier has arrived).
    const tile = PARCELS.find((f) => f.properties.id === '990000013')!.properties;
    const view = buildDossier({
      opa: '990000013',
      registry,
      state: defaultState(registry, 'analysis'),
      manifest,
      shard: { status: 'loading' },
      tile: { ...tile },
      live: IDLE_PARTS,
      liveOn: false,
      center: [-75.1557, 39.9851],
      now: new Date('2026-10-04T18:30:00Z'),
    });
    const cautioned = view.actions.suggestions.filter((item) => displacementCaution(item.suggestion.id) !== null);
    expect(cautioned.length).toBe(4);
    const markup = render(Dossier, { props: { view, manifest, showTitle: true, idPrefix: 'test' } }).body;
    const page = textOf(markup);
    const count = (text: string) => page.split(text).length - 1;
    expect(count('This place is in a displacement watch area')).toBe(1);
    expect(count(strings.displacement.protectionsTitle)).toBe(1);
    for (const link of protectionLinks(registry)) expect(markup.split(`href="${link.url}"`).length - 1, link.id).toBe(1);
    expect(count("The City's Longtime Owner Occupants Program (LOOP)")).toBe(1);
    expect(markup.match(/data-watch-card/g)?.length).toBe(1);
    expect(markup).toContain('id="test-watch"');
    // Near the top of "What you can do": before the first suggestion, with both cautions.
    const actions = page.slice(page.indexOf('What you can do'));
    expect(actions.indexOf('Displacement watch')).toBeLessThan(actions.indexOf(cautioned[0]!.suggestion.label));
    expect(actions.indexOf(CAUTION)).toBeLessThan(actions.indexOf(cautioned[0]!.suggestion.label));
    expect(actions.indexOf(strings.displacement.placemakingCaution)).toBeLessThan(actions.indexOf(cautioned[0]!.suggestion.label));
    // Every greening and placemaking card keeps its one line caution, word for word, and a button
    // to the full card.
    expect(markup.match(/data-watch-jump/g)?.length).toBe(4);
    expect(count(strings.displacement.jumpToWatch)).toBe(4);
    for (const item of cautioned) {
      const card = page.slice(page.indexOf(item.suggestion.label));
      expect(card.indexOf(displacementCaution(item.suggestion.id)!)).toBeLessThan(card.indexOf(strings.displacement.jumpToWatch));
    }
    // The report to Philly311 and other cards carry nothing.
    expect(count(CAUTION)).toBe(1 + view.actions.suggestions.filter((item) => displacementCaution(item.suggestion.id) === CAUTION).length);
  });

  it('keeps the full card on a card shown alone, such as a bus stop, and changes nothing outside the watch', () => {
    const outside = render(Dossier, { props: { view: lotView('990000005'), manifest, showTitle: true, idPrefix: 'test' } }).body;
    expect(outside).not.toContain('data-watch-card');
    expect(outside).not.toContain('data-watch-jump');
    expect(textOf(outside)).toContain(`${CAUTION} Ways to protect neighbors`);
  });

  it('keeps the one line on a lot page outside every watch area', () => {
    const view = lotView('990000005');
    expect(view.actions.watch).toBeNull();
    const page = textOf(render(Dossier, { props: { view, manifest, showTitle: true, idPrefix: 'test' } }).body);
    expect(page).toContain(CAUTION);
    expect(page).not.toContain('displacement watch area');
  });

  it("adds the caution to the box of a lot the City's land agencies list as available", () => {
    const tile = PARCELS.find((f) => f.properties.id === '990000009')!.properties;
    expect(tile.la).toBe(1);
    // Outside every watch area: the one line caution in the box.
    const outside = lotView('990000009', tile);
    expect(outside.actions.listing!.displacement).toEqual({ caution: CAUTION, watch: null });
    const box = (view: ReturnType<typeof lotView>) => {
      const page = render(Dossier, { props: { view, manifest, showTitle: true, idPrefix: 'test' } }).body;
      return textOf(page.slice(page.indexOf('class="listing'), page.indexOf('</aside>')));
    };
    expect(box(outside)).toContain(CAUTION);
    expect(box(outside)).not.toContain('displacement watch area');
    // Inside one (the map's `dw`, or the dossier's displacement block): the one line caution
    // pointing to the full card, shown once above the box at the top of "What you can do".
    const inside = lotView('990000009', { ...tile, dw: SIGNS.assessments | SIGNS.renters });
    expect(inside.actions.listing!.displacement.watch?.signs).toBe(SIGNS.assessments | SIGNS.renters);
    expect(box(inside)).toContain(CAUTION);
    expect(box(inside)).toContain(strings.displacement.jumpToWatch);
    const page = textOf(render(Dossier, { props: { view: inside, manifest, showTitle: true, idPrefix: 'test' } }).body);
    const full = "This place is in a displacement watch area, with signs that prices are rising here: the City's assessed values rising";
    expect(page.split(full).length - 1).toBe(1);
    expect(page.indexOf(full)).toBeLessThan(page.indexOf(strings.dossier.listing.title));
    expect(page.split("The City's Homestead Exemption").length - 1).toBe(1);
    const printed = printModel(inside);
    expect(printed.listing!.lines).toContain(CAUTION);
    expect(printed.listing!.lines).toContain(strings.displacement.printSeeAbove);
    expect(printed.listing!.lines.join(' ')).not.toContain('This place is in a displacement watch area');
    expect(printed.watch?.links.length).toBe(5);
  });

  it('prints the area and each protection with its address, once, at the top of what you can do', () => {
    const view = lotView('990000013');
    const model = printModel(view);
    expect(model.actions.find((a) => a.label === 'Clean and green this lot')?.caution).toBe(CAUTION);
    expect(model.watch?.links.some((l) => l.includes('https://www.phila.gov/'))).toBe(true);
    expect(model.watchPointer).toBe(strings.displacement.printSeeAbove);
    const sheet = textOf(render(DossierPrint, { props: { view, now: new Date('2026-10-04T18:30:00Z') } }).body);
    expect(sheet).toContain('Displacement watch');
    expect(sheet.split('https://ngtrust.org/preservation/').length - 1).toBe(1);
    expect(sheet.split('This place is in a displacement watch area').length - 1).toBe(1);
    const actions = sheet.slice(sheet.indexOf('What you can do'));
    expect(actions.indexOf('Displacement watch')).toBeLessThan(actions.indexOf('Clean and green this lot'));
    expect(actions).toContain(`${CAUTION} ${strings.displacement.printSeeAbove}`);
    const outside = printModel(lotView('990000005'));
    expect(outside.watch).toBeNull();
    expect(outside.watchPointer).toBeNull();
  });

  it('marks places in watch areas in downloads and adds the protections to the notes', async () => {
    const lot = (dw: boolean) => PARCELS.find((f) => String(f.properties.sg).startsWith('clean_and_green') && (f.properties.dw !== undefined) === dw)!;
    const gather = (features: { properties: Record<string, unknown> }[]) =>
      gatherExport({
        places: features.map((f) => ({ id: String(f.properties.id), center: [-75.155, 39.985] as [number, number], properties: f.properties })),
        registry,
        state: defaultState(registry, 'analysis'),
        manifest,
        dataBase: '/data/',
        siteUrl: 'https://example.org/placekeepers/',
        title: 'Test',
        now: new Date('2026-10-04T18:30:00Z'),
        fetchImpl: async () => new Response('{}', { status: 404 }),
      });
    const both = await gather([lot(true), lot(false)]);
    expect(both.rows[0]!.displacement_watch).toMatch(/^Displacement watch area: home prices rising/);
    expect(both.rows[1]!.displacement_watch).toBe('');
    const notes = both.notes.join(' ');
    expect(notes).toContain(`About greening in displacement watch areas: ${CAUTION}`);
    expect(notes).toContain('https://www.phila.gov/');
    expect(toCsv(both).split('\r\n').find((line) => line.startsWith('opa_account'))).toContain('displacement_watch');
    const outside = await gather([lot(false)]);
    expect(outside.notes.join(' ')).toContain(CAUTION);
    expect(outside.notes.join(' ')).not.toContain('displacement watch areas');
  });
});

describe('a tapped watch area', () => {
  const summary = manifest.displacement!;

  it('reads the manifest block', () => {
    expect(summary.city).toEqual({ p0: 180000, p1: 230000, pc: 28, cb: 27, ac: 69, rp: 48, rb: 30, gr: 1397, hi: 61953, vp: 9 });
    expect(summary.periods?.recent_to).toBe('2026-09-02');
    expect(summary.thresholds.price_points).toBe(25);
    expect(summary.thresholds.rent_burden_points).toBe(10);
    expect(summary.thresholds.min_renters).toBe(100);
  });

  it('lists the signs that hold, with what was measured against the city, then the others', () => {
    const area = describeArea(AREAS[0]!.properties, summary);
    expect(area.title).toBe('Census tract 9002');
    expect(area.place).toBe('Sample Heights');
    expect(area.holding.map((r) => r.id)).toEqual(['prices', 'assessments', 'companies', 'rent_burden']);
    // The rent burden sign with its margin of error beside it (owner, 2026-10-09).
    expect(area.holding[3]!.text).toBe(
      '41% of the 880 renter households here pay half their income or more on rent and utilities (give or take 9 points), against 30% across the city (Census Bureau survey, 2020 to 2024). Rising rents fall hardest on them.',
    );
    expect(area.holding[0]!.text).toBe(
      'The middle price of the homes sold went from $61,000 to $112,000, up 84%, against up 28% across the city (sales of 2018 to 2021 and of 2023 to 2026).',
    );
    expect(area.holding[2]!.text).toBe('Companies bought 46% of the 158 homes sold in the last three years, against 27% across the city.');
    expect(area.other.map((r) => r.id)).toEqual(['mva', 'renters']);
    const sparse = describeArea(AREAS[1]!.properties, summary);
    expect(sparse.other.find((r) => r.id === 'prices')!.text).toBe('Too few home sales to tell (31 and 24; at least 50 in each period are needed).');
    expect(sparse.holding.find((r) => r.id === 'mva')!.text).toContain('In 1 of the 2 block groups here');
    expect(sparse.other.find((r) => r.id === 'rent_burden')!.text).toBe(strings.displacement.burdenTooFew);
  });

  it('renders in care words, with the protections and what it cannot tell', () => {
    const body = textOf(render(WatchDetails, { props: { features: [AREAS[0]!.properties], summary, registry } }).body);
    expect(body).toContain('Signs that prices are rising here');
    expect(body).toContain('not a forecast');
    expect(body).toContain('Neighborhood Gardens Trust');
    expect(body).not.toMatch(/gentrif|rank|hot ?spot|dangerous/i);
  });

  it('never calls an area gentrifying or ranks areas, anywhere people read', () => {
    const layer = registry.layers.find((l) => l.id === 'displacement_watch')!;
    const texts = [...collectStrings({ displacement: strings.displacement }).map(([, t]) => t), layer.label, layer.description];
    expect(texts.filter((t) => /gentrif|rank|hot ?spot|worst|best neighborhood/i.test(t))).toEqual([]);
    expect(layer.label).toBe('Displacement watch: signs that prices are rising');
    expect(layer.default).toEqual({ field: false, analysis: true });
  });
});

describe('the map style', () => {
  const ctx = (shade: boolean) => {
    const state = defaultState(registry, 'analysis');
    state.settings.displacement_watch = { shade };
    const layer = registry.layers.find((l) => l.id === 'displacement_watch')!;
    return { layer, registry, state, sourceId: 'src', sourceLayer: 'watch' };
  };

  it('lets a tap close in pick the parcel under it instead of the area', () => {
    expect(WATCH_TAP_MAX_ZOOM).toBe(PICK_MIN_ZOOM);
    const fill = displacementWatch.layers(ctx(true)).find((l) => l.id.endsWith(':fill'))!;
    expect(fill.maxzoom).toBe(PICK_MIN_ZOOM);
    expect(displacementWatch.clickable).toEqual(['fill', 'line']);
  });

  it('draws outlines only when shading is off', () => {
    const shaded = displacementWatch.layers(ctx(true));
    const plain = displacementWatch.layers(ctx(false));
    expect(shaded.map((l) => l.id.split(':').at(-1))).toEqual(['fill', 'shade', 'line']);
    expect(plain.map((l) => l.id.split(':').at(-1))).toEqual(['fill', 'line']);
    const opacity = (layers: typeof plain) => (layers[0] as { paint: Record<string, unknown> }).paint['fill-opacity'];
    expect(opacity(plain)).toBe(0);
    expect(opacity(shaded)).toBeGreaterThan(0);
  });

  it('has the same look for every area, however many signs it has', () => {
    const layers = JSON.stringify(displacementWatch.layers(ctx(true)));
    expect(layers).not.toContain('"w"');
  });
});

describe('watch notes', () => {
  it('builds nothing outside a watch area', () => {
    expect(watchNote(registry, null)).toBeNull();
    expect(watchNote(registry, 7)?.links).toHaveLength(5);
  });
});
