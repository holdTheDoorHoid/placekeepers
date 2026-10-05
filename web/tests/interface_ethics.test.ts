// The rules of docs/ETHICS.md as the views show them (docs/VERIFICATION.md, "Interface checks for
// the second half", and decisions D7 and D12): the displacement caution on every greening
// suggestion, conservatorship never offered as a first step and always warned about, no word for
// ease of acquisition, the possible estate flag whole and in order, the family's blessing beside
// every memorial suggestion, and no name in the memorial lists.

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import Dossier from '../src/components/dossier/Dossier.svelte';
import DossierPrint from '../src/components/dossier/DossierPrint.svelte';
import PlaceCard from '../src/components/places/PlaceCard.svelte';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import MemorialList from '../src/components/streets/MemorialList.svelte';
import { FAMILIES_FOR_SAFE_STREETS_URL } from '../src/config/links.ts';
import { PERMISSION_CODES, PERMISSION_ROUTE, permissionLabel, permissionText } from '../src/config/permission.ts';
import { FILTERS } from '../src/config/filters.ts';
import { GREENING_SUGGESTIONS } from '../src/config/suggestions.ts';
import { parseManifest } from '../src/data/manifest.ts';
import { IDLE_PARTS, buildDossier } from '../src/dossier/build.ts';
import { printModel } from '../src/dossier/print.ts';
import { parseCommon, parseShard } from '../src/dossier/shard.ts';
import { exportRow, gatherExport, toCsv } from '../src/places/export.ts';
import { firstStepFor, nearestPlaces } from '../src/places/rank.ts';
import { defaultState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { suggestionViews } from '../src/streets/describe.ts';
import { collectStrings, strings } from '../src/strings.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const registry = loadRegistry();
const manifest = parseManifest(read('../fixtures/data/manifest.json')).manifest!;
const shard = parseShard(read('../fixtures/data/dossiers/9900.json')).shard!;
const notes = parseCommon(read('../fixtures/data/dossiers/common.json'));
const ETHICS = readFileSync(new URL('../../docs/ETHICS.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');
const PARCELS = read('../fixtures/sources/parcels.geojson').features as { properties: Record<string, unknown>; geometry: { coordinates: unknown } }[];

/** The text a reader sees: tags removed, entities decoded, spaces collapsed. */
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

function lotView(opa: string) {
  const parcel = shard.parcels.get(opa)!;
  return buildDossier({
    opa,
    registry,
    state: defaultState(registry, 'analysis'),
    manifest,
    shard: { status: 'found', parcel, generatedAt: shard.generatedAt, notes },
    tile: null,
    live: IDLE_PARTS,
    liveOn: false,
    center: [-75.1557, 39.9851],
    now: new Date('2026-10-04T18:30:00Z'),
  });
}

/** Just enough of the app's store for a card to render on the server. */
const fakeStore = {
  registry,
  state: defaultState(registry, 'field'),
  addresses: { get: () => null },
  lists: { active: null, has: () => false },
  inspected: null,
} as unknown as AppStore;

const CAUTION = 'Greening can raise nearby prices. Consider pairing it with protections.';

describe('the displacement caution on every greening suggestion (decision D12)', () => {
  it('is the ETHICS.md sentence, word for word', () => {
    expect(ETHICS).toContain(`*"${CAUTION}"*`);
    expect(strings.displacement.caution).toBe(CAUTION);
  });

  it('marks clean and green, the greening suggestion of the first release', () => {
    expect([...GREENING_SUGGESTIONS]).toContain('clean_and_green');
    for (const id of GREENING_SUGGESTIONS) expect(registry.suggestions.map((s) => s.id)).toContain(id);
  });

  it('shows on the nearby card of a lot to clean and green, and not on a building to seal', () => {
    const state = defaultState(registry, 'field');
    const places = PARCELS.map((f) => ({ id: String(f.properties.id), properties: f.properties, center: f.geometry.coordinates as [number, number] }));
    const nearby = nearestPlaces(registry, state, places.map((p) => ({ ...p, center: [-75.155, 39.985] as [number, number] })), [-75.155, 39.985]);
    const greening = nearby.find((p) => p.suggestions[0]?.id === 'clean_and_green')!;
    const sealing = nearby.find((p) => p.suggestions[0]?.id === 'seal_abandoned_building')!;
    const card = (place: typeof greening) => textOf(render(PlaceCard, { props: { store: fakeStore, place, lensLabel: 'Violence reduction', fromYou: false } }).body);
    expect(card(greening)).toContain(CAUTION);
    expect(card(sealing)).not.toContain(CAUTION);
  });

  it('shows on the lot page beside the suggestion, and in its print', () => {
    const view = lotView('990000005');
    expect(view.actions.suggestions.map((s) => s.suggestion.id)).toContain('clean_and_green');
    const page = textOf(render(Dossier, { props: { view, manifest, showTitle: true, idPrefix: 'test' } }).body);
    const at = page.indexOf(CAUTION);
    expect(at).toBeGreaterThan(page.indexOf('Clean and green this lot'));
    expect(textOf(render(DossierPrint, { props: { view, now: new Date('2026-10-04T18:30:00Z') } }).body)).toContain(CAUTION);
    expect(printModel(view).actions.find((a) => a.label === 'Clean and green this lot')?.caution).toBe(CAUTION);
  });

  it('goes into a download that holds a greening suggestion', async () => {
    const state = defaultState(registry, 'analysis');
    const lot = PARCELS.find((f) => f.properties.sg === 'clean_and_green')!;
    const result = await gatherExport({
      places: [{ id: String(lot.properties.id), center: [-75.155, 39.985], properties: lot.properties }],
      registry,
      state,
      manifest,
      dataBase: '/data/',
      siteUrl: 'https://example.org/placekeepers/',
      title: 'Test',
      now: new Date('2026-10-04T18:30:00Z'),
      fetchImpl: async () => new Response('{}', { status: 404 }),
    });
    expect(result.notes.join(' ')).toContain(CAUTION);
    expect(toCsv(result).split('\r\n')[0]).toMatch(/terms of use/);
  });
});

describe('conservatorship (interface check 2)', () => {
  it('is never the first step on a card, in the ranked list or in a download', () => {
    expect(Object.values(PERMISSION_ROUTE)).not.toContain('conservatorship');
    for (const suggestion of registry.suggestions.filter((s) => s.applies_to === 'parcel')) {
      for (const code of [null, ...PERMISSION_CODES]) {
        const { firstStep } = firstStepFor(registry, suggestion, code);
        expect(firstStep?.route.id ?? '').not.toContain('conservatorship');
      }
    }
    const row = exportRow({ registry, state: defaultState(registry, 'analysis'), siteUrl: 'https://example.org/' }, { id: '990000005', center: null, properties: PARCELS.find((f) => f.properties.id === '990000005')!.properties }, shard.parcels.get('990000005')!, notes);
    expect(JSON.stringify(row)).not.toMatch(/onservatorship/);
  });

  it('carries the ETHICS.md warning before its steps wherever the lot page or its print lists it', () => {
    const warning = /conservatorship route always carries this note: \*"([^"]+)"\*/.exec(ETHICS)![1]!;
    const view = lotView('990000005');
    const routes = [...view.actions.suggestions.flatMap((s) => s.routes), ...view.actions.otherRoutes].filter((r) => r.route.id === 'conservatorship');
    for (const route of routes) expect(route.warning).toBe(warning);
    for (const action of printModel(view).actions) if (/onservatorship/.test(action.route ?? '')) expect(action.warning).toBe(warning);
  });
});

describe('no word for ease of acquisition (interface check 3)', () => {
  const EASE = /\b(easiest|easy to (get|take|buy)|cheap(est)?|bargain|deal|acquir\w*|acquisition|buy(ing)?|steal|flip)\b/i;

  it('names no filter, sort, column, preset or plot row by how easy a lot is to get', () => {
    const texts = [
      ...FILTERS.flatMap((f) => [f.label, f.help ?? '', ...f.options.map((o) => o.label)]),
      ...PERMISSION_CODES.flatMap((code) => [permissionLabel(code), permissionText(code)]),
      ...collectStrings({ analysis: strings.analysis, plot: strings.plot, filters: strings.filters, permission: strings.permission, export: strings.export }).map(([, text]) => text),
      ...registry.lenses.flatMap((l) => [l.label, ...l.presets.map((p) => p.label), ...l.factors.map((f) => f.label)]),
    ];
    expect(texts.filter((text) => EASE.test(text))).toEqual([]);
  });
});

describe('care words, never danger words (interface check 8)', () => {
  // ETHICS.md: "where care is needed most", never "dangerous", "high crime" or "hot spot". L&I's own
  // terms for a building ("unsafe", "imminently dangerous") are about the structure, not a place,
  // and the shootings layer says it is "not to label places as dangerous".
  const DANGER = /\b(dangerous|high crime|crime ridden|hot ?spots?|bad (area|neighborhood)|safe(st)? neighborhoods?)\b/i;
  const LI_TERMS = /imminently dangerous|not to label places as dangerous/gi;

  it('no interface string, layer, lens or group calls a place dangerous', () => {
    const texts = [
      ...collectStrings(strings).map(([, text]) => text),
      ...registry.layers.flatMap((l) => [l.label, l.description, ...l.settings.map((setting) => setting.label)]),
      ...registry.groups.flatMap((g) => [g.label, g.description]),
      ...registry.lenses.flatMap((l) => [l.label, l.description, ...l.factors.flatMap((f) => [f.label, f.explain])]),
    ];
    expect(texts.filter((text) => DANGER.test(text.replace(LI_TERMS, '')))).toEqual([]);
  });

  it('ranks no area: the area summary counts lots in view, and shootings are never listed by area', () => {
    const area = collectStrings({ area: [strings.analysis.areaTitle, strings.analysis.areaLots(2), strings.analysis.areaBuildings(1), strings.analysis.areaHigh(1), strings.analysis.areaLandcare(1)] });
    for (const [, text] of area) expect(text).not.toMatch(/shoot|crime|violen|rank/i);
    // The only ranked list ranks lots for care under the lens a person chose.
    expect(strings.analysis.tableCaption).toBe('Places in view, ranked by the current lens blend');
  });
});

describe('the possible estate flag (interface check 5)', () => {
  const words = /"Possible estate" reads: \*"([^"]+)"\*/.exec(ETHICS)![1]!;

  it('reads as ETHICS.md, in order, on the lot page and in print', () => {
    const opa = [...shard.parcels.keys()].find((id) => shard.parcels.get(id)!.owner?.flags.some((f) => f.id === 'possible_estate'))!;
    expect(opa).toBeTruthy();
    const view = lotView(opa);
    const flag = view.owner.flags.find((f) => f.id === 'possible_estate')!;
    expect([flag.text, flag.careful, flag.nextStep].join(' ')).toBe(words);
    const page = textOf(render(Dossier, { props: { view, manifest, showTitle: true, idPrefix: 'test' } }).body);
    const parts = [flag.text, flag.careful!, flag.nextStep!].map((part) => page.indexOf(part));
    expect(parts.every((at) => at >= 0)).toBe(true);
    expect([...parts].sort((a, b) => a - b)).toEqual(parts);
    expect(textOf(render(DossierPrint, { props: { view } }).body)).toContain(words);
  });
});

describe('memorials (interface checks 6 and 7)', () => {
  const memorial = { id: 'fc20260820_1000', d: '2026-08-20', m: 1, pl: 'unit block of Oak St', nm: 'Alex Example', src: 'https://example.org/a', sg: 'memorial_or_ghost_bike' };

  it('never names anyone in the memorial lists, whatever the names setting', () => {
    const html = render(MemorialList, { props: { store: fakeStore, memorials: [{ layerId: 'memorials', properties: memorial, lngLat: [-75.15, 39.98] }] } }).body;
    expect(textOf(html)).toContain('Killed while walking on August 20, 2026.');
    expect(html).not.toContain('Alex');
    expect(html).not.toContain('example.org');
  });

  it('puts the family blessing beside every memorial suggestion, with Families for Safe Streets', () => {
    const views = suggestionViews(registry, defaultState(registry, 'field'), memorial);
    expect(views.find((v) => v.suggestion.id === 'memorial_or_ghost_bike')?.memorial).toBe(true);
    const html = render(FeatureDetails, { props: { store: fakeStore, target: { layerId: 'memorials', features: [memorial], lngLat: [-75.15, 39.98] } } }).body;
    const text = textOf(html);
    const blessing = text.indexOf("Only with the family's blessing.");
    expect(blessing).toBeGreaterThan(text.indexOf('A memorial or a ghost bike'));
    expect(html).toContain(FAMILIES_FOR_SAFE_STREETS_URL);
  });
});
