// The lot page and its print layout as HTML: the six sections in order, headings in order, every
// table with a caption, the assessment chart also as a table, a route's warning before its steps,
// the ETHICS.md wording, and nothing the contract does not name.

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import Dossier from '../src/components/dossier/Dossier.svelte';
import DossierPrint from '../src/components/dossier/DossierPrint.svelte';
import OwnerList from '../src/components/dossier/OwnerList.svelte';
import type { AppStore } from '../src/state/store.svelte.ts';
import RouteDetails from '../src/components/dossier/RouteDetails.svelte';
import { parseManifest } from '../src/data/manifest.ts';
import { IDLE_PARTS, buildDossier, routeView, type DossierInput } from '../src/dossier/build.ts';
import { PRINT_LIMITS, printModel } from '../src/dossier/print.ts';
import { parseCommon, parseShard, parseShardParcel } from '../src/dossier/shard.ts';
import { defaultState } from '../src/state/defaults.ts';
import { strings } from '../src/strings.ts';
import { findDashViolations } from '../src/style/no-dashes.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const registry = loadRegistry();
const manifest = parseManifest(read('../fixtures/data/manifest.json')).manifest!;
const SHARD = read('../fixtures/data/dossiers/9900.json');
const shard = parseShard(SHARD).shard!;
const notes = parseCommon(read('../fixtures/data/dossiers/common.json'));
const ETHICS = readFileSync(new URL('../../docs/ETHICS.md', import.meta.url), 'utf8');
const quote = (after: string) => /\*"([^"]+)"\*/s.exec(ETHICS.slice(ETHICS.indexOf(after)))![1]!.replace(/\s+/g, ' ');

function view(opa: string, over: Partial<DossierInput> = {}) {
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
    ...over,
  });
}

function html(opa: string, over: Partial<DossierInput> = {}): string {
  return render(Dossier, { props: { view: view(opa, over), manifest, showTitle: true, idPrefix: 'test' } }).body;
}

/** The text a reader sees: tags removed, entities decoded, spaces collapsed. */
function textOf(markup: string): string {
  return markup
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('the lot page', () => {
  const page = html('990000005');
  const text = textOf(page);

  it('has the six sections of DESIGN.md 5.6, in order', () => {
    const s = strings.dossier.sections;
    const order = [s.summary, s.actions, s.owner, s.history, s.nearby, s.sources].map((title) => page.indexOf(`>${title}</h3>`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('keeps headings in order, never skipping a level', () => {
    const levels = [...page.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    expect(levels[0]).toBe(2);
    for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!, `heading ${i}`).toBeLessThanOrEqual(1);
  });

  it('gives every table a caption, and shows the assessment chart as a table too', () => {
    const withDeeds = html('990000001');
    const tables = [...(page.match(/<table\b[\s\S]*?<\/table>/g) ?? []), ...(withDeeds.match(/<table\b[\s\S]*?<\/table>/g) ?? [])];
    expect(tables.length).toBeGreaterThanOrEqual(3);
    for (const table of tables) expect(table).toMatch(/<caption\b/);
    expect(page).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Chart of the City's assessment from 2015 to 2027/);
    expect(text).toContain(strings.dossier.history.assessmentsCaption);
  });

  it('shows the possible estate flag word for word, the deed fraud notice, and tax debt dated with the Tax Center', () => {
    expect(text).toContain(quote('"Possible estate" reads:').split('. ')[0]!);
    for (const part of [strings.dossier.flags.possible_estate.text, strings.dossier.flags.possible_estate.careful, strings.dossier.flags.possible_estate.next]) {
      expect(text).toContain(part);
    }
    expect(text).toContain(notes!.notices.deed_fraud!.text);
    expect(text).toContain('Tax debt as of July 2025');
    expect(page).toContain('href="https://tax-services.phila.gov/"');
    expect(page).toContain('href="https://www.phila.gov/2022-09-06-own-property-in-philadelphia-get-free-deed-fraud-protection-with-fraud-guard/"');
  });

  it('links out to the City\'s pages and street imagery, never embedding it, and to a prefilled correction', () => {
    expect(page).toContain('href="https://property.phila.gov/?p=990000005"');
    expect(page).toContain('href="https://atlas.phila.gov/990000005"');
    expect(page).toContain('map_action=pano');
    expect(page).not.toMatch(/<iframe|<img/);
    expect(page).toContain('issues/new?template=correction.yml');
    expect(text).toContain(strings.app.notAffiliated);
  });

  it('shows the conservatorship warning, and offers no buy button, price estimate or letter', () => {
    expect(text).toContain(quote('The conservatorship route always carries this note:'));
    expect(text).not.toMatch(/\bbuy\b|acquisition|estimated (price|value)|easiest|ease of|send (a )?letter/i);
    expect(page).not.toMatch(/mailto:/);
  });

  it('keeps every word the reader sees free of dashes as punctuation', () => {
    for (const opa of shard.parcels.keys()) expect(findDashViolations(textOf(html(opa))), opa).toEqual([]);
  });

  it('never shows a field the contract does not name, even when a shard carries one', () => {
    const raw = structuredClone(SHARD.parcels['990000005']);
    raw.acquisition_price = 4321;
    raw.ease_of_acquisition = 'very easy';
    raw.owner.phone = '215 555 0100';
    raw.owner.email = 'owner@example.org';
    raw.transfers = [{ date: '2020-01-02', type: 'DEED', price: 10, from: ['A'], to: ['B'], estimate: 98765 }];
    const parcel = parseShardParcel(raw)!;
    const page = html('990000005', { shard: { status: 'found', parcel, generatedAt: null, notes } });
    for (const word of ['4321', 'very easy', '215 555', 'owner@example.org', '98765']) expect(page).not.toContain(word);
  });

  it('lists a person\'s other parcels from the lot\'s own record, each opening its lot page', () => {
    const parcels = [
      { id: '372000002', address: '2904 N 5TH ST', kind: 'lot' as const, confidence: 'medium' as const },
      { id: '372000003', address: null, kind: null, confidence: null },
    ];
    const body = render(OwnerList, { props: { store: {} as AppStore, target: { parcels }, dataBase: '/data/', onOpen: () => {} } }).body;
    const text = textOf(body);
    expect(text).toContain(strings.dossier.ownerList.others);
    expect(text).toContain('2904 N 5TH ST');
    expect(text).toContain('Vacant lot, probably vacant');
    expect(text).toContain(strings.dossier.parcel('372000003'));
    expect(text).not.toContain(strings.dossier.ownerList.loading);
  });

  it('never says "No deeds on record." for a dossier built without deeds', () => {
    const parcel = parseShardParcel({ ...SHARD.parcels['990000005'], partial: ['transfers', 'assessments', 'li'], transfers: null, assessments: null })!;
    const markup = render(Dossier, {
      props: {
        view: view('990000005', { shard: { status: 'found', parcel, generatedAt: shard.generatedAt, notes } }),
        manifest,
        showTitle: true,
        idPrefix: 'test',
        actions: { onTurnOnLive: () => {} },
      },
    }).body;
    const text = textOf(markup);
    expect(text).not.toContain(strings.dossier.history.noTransfers);
    expect(text).not.toContain(strings.dossier.history.noAssessments);
    expect(text).toContain('Our weekly copy does not include deed records, assessments and L&I violation records for this parcel');
    expect(text).toContain(strings.dossier.history.notInCopyOff);
  });

  it('says plainly when there is nothing to show', () => {
    const empty = render(Dossier, {
      props: {
        view: buildDossier({
          opa: '371163500',
          registry,
          state: defaultState(registry, 'analysis'),
          manifest,
          shard: { status: 'absent', reason: 'unlisted' },
          tile: null,
          live: IDLE_PARTS,
          liveOn: false,
          center: null,
          now: new Date(),
        }),
        manifest,
      },
    }).body;
    expect(textOf(empty)).toContain(strings.dossier.noData);
    expect(empty).not.toContain('<section');
  });
});

describe('a legal route', () => {
  it('shows its warning before its steps', () => {
    const conservatorship = registry.routes.find((r) => r.id === 'conservatorship')!;
    expect(conservatorship.warning).toBeTruthy();
    const page = render(RouteDetails, { props: { view: routeView(conservatorship) } }).body;
    const warning = page.indexOf(conservatorship.warning!.slice(0, 40));
    expect(warning).toBeGreaterThan(-1);
    expect(warning).toBeLessThan(page.indexOf(strings.dossier.actions.steps));
    expect(warning).toBeLessThan(page.indexOf(conservatorship.steps[0]!.slice(0, 30)));
  });

  it('shows any route\'s own warning the same way', () => {
    const route = { ...registry.routes.find((r) => r.id === 'ask_the_owner')!, warning: 'Check the zoning first.' };
    const page = render(RouteDetails, { props: { view: routeView(route) } }).body;
    expect(page.indexOf('Check the zoning first.')).toBeLessThan(page.indexOf(route.steps[0]!));
    expect(routeView({ ...route, warning: undefined }).warning).toBeNull();
    // A conservatorship route without its own warning still gets the ETHICS.md one.
    expect(routeView({ ...route, id: 'conservatorship_other', warning: undefined }).warning).toBe(strings.dossier.actions.conservatorshipWarning);
  });
});

describe('the printed lot page', () => {
  const now = new Date('2026-10-04T18:30:00Z');

  it('has the summary, what you can do, who owns it, recent history, sources and "not legal advice"', () => {
    const page = render(DossierPrint, { props: { view: view('990000001'), now } }).body;
    const text = textOf(page);
    const s = strings.dossier;
    const order = [s.sections.summary, s.sections.actions, s.sections.owner, s.print.recent, s.sections.sources].map((t) => page.indexOf(`>${t}</h2>`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).toContain('1201 N SAMPLE ST');
    expect(text).toContain('Printed from Placekeepers on October 4, 2026.');
    expect(text).toContain(strings.app.notAffiliated);
    expect(text).toContain("Today's balance: the City's Tax Center, https://tax-services.phila.gov/");
    expect(page).not.toMatch(/<button|<input|<form/);
    for (const table of page.match(/<table\b[\s\S]*?<\/table>/g) ?? []) expect(table).toMatch(/<caption\b/);
  });

  it('keeps to one page: at most a few transfers, flags and sources', () => {
    const model = printModel(view('990000001'), now);
    expect(model.history.transfers.length).toBeLessThanOrEqual(PRINT_LIMITS.transfers);
    expect(model.history.moreTransfers).toBe(5 - PRINT_LIMITS.transfers);
    expect(model.owner.flags.length).toBeLessThanOrEqual(PRINT_LIMITS.flags);
    expect(model.sources.length).toBeLessThanOrEqual(PRINT_LIMITS.sources);
  });

  it('prints the possible estate flag in full and the deed fraud notice', () => {
    const model = printModel(view('990000005'), now);
    expect(model.owner.flags.find((f) => f.title === 'Possible estate')!.text).toBe(quote('"Possible estate" reads:'));
    expect(model.owner.deedFraud).toMatch(/Fraud Guard/);
    expect(model.owner.tax).toMatch(/^Tax debt as of July 2025: As of July 2025/);
  });
});
