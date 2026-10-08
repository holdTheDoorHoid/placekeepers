// Lots the City's land agencies list as available (issue #36): the status in plain words on every
// lot page, the box at the top of "What you can do" with the side yard route first, the Land
// Bank's note that it may say no, the date of the list, the credit and the link to the Land
// Bank's own map, the map filter, and the rules of docs/ETHICS.md (no price, no buy button).

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import Dossier from '../src/components/dossier/Dossier.svelte';
import PlaceCard from '../src/components/places/PlaceCard.svelte';
import { LAND_BANK_MAP_URL } from '../src/config/links.ts';
import { permissionFromRoutes } from '../src/config/permission.ts';
import { parseManifest } from '../src/data/manifest.ts';
import { IDLE_PARTS, buildDossier, type DossierInput } from '../src/dossier/build.ts';
import { cityListDate, cityStatusText, statusKey } from '../src/dossier/listing.ts';
import { printModel } from '../src/dossier/print.ts';
import { parseCommon, parseShard } from '../src/dossier/shard.ts';
import type { LiveProperty } from '../src/dossier/types.ts';
import { parcelFilter, vacantParcels } from '../src/map/styles/vacant_parcels.ts';
import { describePlace, firstStepFor, nearestPlaces } from '../src/places/rank.ts';
import { defaultState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { collectStrings, strings } from '../src/strings.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const registry = loadRegistry();
const manifest = parseManifest(read('../fixtures/data/manifest.json')).manifest!;
const shard = parseShard(read('../fixtures/data/dossiers/9900.json')).shard!;
const notes = parseCommon(read('../fixtures/data/dossiers/common.json'));
const tiles = (read('../fixtures/sources/parcels.geojson') as { features: { properties: Record<string, unknown> }[] }).features.map((f) => f.properties);
const NOW = new Date('2026-10-04T18:30:00Z');

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
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Every status on the City's list on 2026-10-08 (docs/DATA_SOURCES.md, "Sources checked
// 2026-10-08"), with the four the Land Bank's map shows.
const STATUSES = [
  'Owned - Available',
  'Owned - Available (Garden Agreement)',
  'Owned - Available (no construction permitted)',
  'Owned - Available (not for SY)',
  'Owned - On Hold for AHD',
  'Owned - Not Available',
  'Owned - Processing Applicant, Not Available',
  'Owned - Managed and Not Available',
  'Owned - On Hold',
  'Owned - Sale Pending',
  'Unknown - Research Pending',
  'Owned - RFP Released',
  'Owned - On Hold for HOME SD',
  'Owned - Held for City Council Member',
  'Owned - To Be Featured Soon',
  'Owned - Not Available (GSI Project)',
  'Owned - Competitive Bid Posted',
];

describe('the status on the City list, in plain words', () => {
  it('says what every status means for neighbors', () => {
    const table = strings.dossier.owner.cityStatuses;
    expect(Object.keys(table).sort()).toEqual(STATUSES.map(statusKey).sort());
    for (const status of STATUSES) {
      const text = cityStatusText(status);
      expect(text, status).toMatch(/^Its status there: [a-z].*\. [A-Z].*\.$/);
      expect(text, status).not.toContain(' - ');
    }
  });

  it('names the two statuses neighbors most need to understand', () => {
    expect(cityStatusText('Owned - On Hold for AHD')).toBe(
      'Its status there: held for affordable housing. It is set aside for affordable homes, so it is not offered to neighbors now.',
    );
    expect(cityStatusText('Owned - Processing Applicant, Not Available')).toContain('An application for it is being reviewed');
  });

  it('reads a status however the City spaces or capitalizes it, and shows an unknown one as written', () => {
    expect(cityStatusText('OWNED -  ON HOLD')).toBe(cityStatusText('Owned - On Hold'));
    expect(cityStatusText('Owned - Something New')).toBe('Its status there: Owned, something new.');
  });

  it('shows the status on the lot page of a parcel that is not listed', () => {
    const view = buildDossier(input('990000029'));
    expect(view.owner.cityOwned).toContain('Its status there: someone has applied.');
    expect(view.actions.listing).toBeNull();
  });
});

describe('the box for a lot listed as available', () => {
  it('leads with the side yard route, dated, with the Land Bank note, the map link and the credit', () => {
    const view = buildDossier(input('990000009'));
    const listing = view.actions.listing!;
    expect(listing.title).toBe("Listed as available by the City's land agencies");
    expect(listing.text).toBe("On October 4, 2026, the City's list of public land showed this property as available.");
    expect(listing.sideYardLead).toBe(strings.dossier.listing.sideYardLead);
    expect(listing.sideYard!.route.id).toBe('land_bank_side_yard');
    expect(listing.decline).toMatch(/can turn down any sale or lease/);
    expect(listing.links).toEqual([{ label: "The Land Bank's map of available properties", url: LAND_BANK_MAP_URL }]);
    expect(listing.credit).toContain('Department of Planning and Development (Land Management)');
    expect(listing.credit).toContain('Philadelphia Land Bank');
    // The one line displacement caution: the lot lies outside every displacement watch area (M4.1).
    expect(listing.displacement).toEqual({ caution: strings.displacement.caution, watch: null });
    // The side yard route is not repeated among the other routes.
    expect(view.actions.otherRoutes.map((r) => r.route.id)).not.toContain('land_bank_side_yard');
  });

  it('names a limit the status sets, and offers no side yard where the lot is not eligible', () => {
    const listing = buildDossier(input('990000002')).actions.listing!;
    expect(listing.text).toBe("On October 4, 2026, the City's list of public land showed this property as available. Nothing may be built on it.");
    expect(listing.sideYard).toBeNull();
    expect(listing.sideYardLead).toBeNull();
  });

  it('works from the map alone while the lot page has no dossier, without a side yard', () => {
    const tile = { ...tiles.find((t) => t.id === '990000009')! };
    const view = buildDossier(input('990000009', { shard: { status: 'loading' }, tile }));
    expect(view.actions.listing!.text).toMatch(/showed this property as available\.$/);
    expect(view.actions.listing!.sideYard).toBeNull();
    expect(buildDossier(input('990000009', { shard: { status: 'loading' }, tile: { ...tile, la: undefined } })).actions.listing).toBeNull();
  });

  it('leaves the box out when the City now names another owner', () => {
    const property: LiveProperty = {
      opa: '990000009',
      address: '1233 N SAMPLE ST',
      names: ['NEW OWNER LLC'],
      mailing: null,
      mailingStreet: null,
      mailingCityState: null,
      mailingZip: null,
      category: null,
      buildingDescription: null,
      saleDate: null,
      salePrice: null,
      lng: null,
      lat: null,
      homestead: false,
    } as unknown as LiveProperty;
    const view = buildDossier(input('990000009', { liveOn: true, live: { ...IDLE_PARTS, property: { status: 'ok', data: property, at: NOW.getTime() } } }));
    expect(view.owner.ownerChanged).toBe(true);
    expect(view.actions.listing).toBeNull();
  });

  it('dates the list by the day it was fetched, and credits it among the sources', () => {
    expect(cityListDate(manifest)).toBe('October 4, 2026');
    expect(cityListDate(null)).toBeNull();
    const undated = buildDossier(input('990000009', { manifest: null })).actions.listing!;
    expect(undated.text).toBe("The City's list of public land shows this property as available.");
    const row = buildDossier(input('990000009')).sources.rows.find((r) => r.id === 'city_owned_property')!;
    expect(row.when).toBe('weekly snapshot of October 4, 2026');
  });

  it('renders on the lot page and in print, with no price and no buy button', () => {
    const view = buildDossier(input('990000009'));
    const page = textOf(render(Dossier, { props: { view, manifest, showTitle: true, idPrefix: 'test' } }).body);
    const box = page.slice(page.indexOf("Listed as available by the City's land agencies"));
    expect(box).toMatch(/^Listed as available by the City's land agencies On October 4, 2026/);
    expect(box.indexOf('If you own the house next door')).toBeLessThan(box.indexOf('can turn down'));
    const print = printModel(view, NOW);
    expect(print.listing!.title).toBe("Listed as available by the City's land agencies");
    expect(print.listing!.lines.some((line) => line.includes(LAND_BANK_MAP_URL))).toBe(true);
    expect(print.owner.cityOwned).toContain('listed as available');
    const words = [
      ...collectStrings(strings.dossier.listing).map(([, text]) => text),
      ...collectStrings(strings.dossier.owner.cityStatuses).map(([, text]) => text),
    ];
    for (const text of words) {
      expect(text).not.toMatch(/\$|\bprice\b|\bbuy(ing)?\b|\bcheap|\bbargain|\bdeal\b|acquir|\beas(y|iest)\b/i);
    }
  });
});

describe('a nearby card for a listed lot (finding F7 of the v0.3 review)', () => {
  const state = defaultState(registry, 'field');
  const store = { registry, state, addresses: { get: () => null }, lists: { active: null, has: () => false }, inspected: null } as unknown as AppStore;
  const places = tiles.map((properties) => ({ id: String(properties.id), properties, center: [-75.155, 39.985] as [number, number] }));
  const nearby = nearestPlaces(registry, state, places, [-75.155, 39.985]);
  const card = (opa: string) => {
    const place = nearby.find((p) => p.id === opa)!;
    return { place, text: textOf(render(PlaceCard, { props: { store, place, lensLabel: 'Violence reduction', fromYou: false } }).body) };
  };

  it('says it is listed and starts with the side yard route where the lot may go to the neighbor', () => {
    const { place, text } = card('990000009');
    expect(place.listed).toBe(true);
    expect(place.sideYard).toBe(true);
    expect(text).toContain("Listed as available by the City's land agencies");
    const sideYard = registry.routes.find((r) => r.id === 'land_bank_side_yard')!;
    expect(place.firstStep?.route.id).toBe('land_bank_side_yard');
    expect(text).toContain(`First legal step: ${sideYard.label}. ${sideYard.steps[0]}`);
    // The lot page leads with the same route, in its listing box.
    expect(buildDossier(input('990000009')).actions.listing!.sideYard!.route.id).toBe('land_bank_side_yard');
    // The map's first step category stays the one after the side yard route (issue #36).
    expect(place.permission).toBe(2);
  });

  it('keeps the usual first step for a listed lot that is not offered as a side yard', () => {
    const { place, text } = card('990000002');
    expect(place.listed).toBe(true);
    expect(place.sideYard).toBe(false);
    expect(text).toContain("Listed as available by the City's land agencies");
    expect(place.firstStep?.route.id).not.toBe('land_bank_side_yard');
  });

  it('says nothing of a listing on a lot that is not listed, even with a stray side yard mark', () => {
    const tile = tiles.find((t) => t.la === undefined && String(t.sg).startsWith('clean_and_green'))!;
    const place = describePlace(registry, state, { id: String(tile.id), properties: { ...tile, ly: 1 }, center: [-75.155, 39.985] });
    expect(place.listed).toBe(false);
    expect(place.sideYard).toBe(false);
    expect(place.firstStep?.route.id).not.toBe('land_bank_side_yard');
  });

  it('gives the side yard route only to a suggestion about using the land', () => {
    const report = registry.suggestions.find((s) => s.id === 'seal_abandoned_building')!;
    expect(firstStepFor(registry, report, 2, true).firstStep?.route.id).toBe(report.routes[0]);
    const green = registry.suggestions.find((s) => s.id === 'clean_and_green')!;
    expect(firstStepFor(registry, green, 2, true).firstStep?.route.id).toBe('land_bank_side_yard');
    expect(firstStepFor(registry, green, 2, false).firstStep?.route.id).toBe('land_bank_garden_agreement');
  });
});

describe('the side yard route and the map\'s first step', () => {
  it('passes over the side yard, as the pipeline does', () => {
    expect(permissionFromRoutes(['land_bank_side_yard', 'land_bank_garden_agreement'], false)).toBe(2);
    expect(permissionFromRoutes(['land_bank_side_yard', 'contact_phdc'], true)).toBe(3);
    expect(permissionFromRoutes(['community_landcare', 'land_bank_side_yard', 'land_bank_garden_agreement'], false)).toBe(1);
    expect(permissionFromRoutes(['land_bank_side_yard'], false)).toBe(2);
  });
});

describe('the map filter', () => {
  const layer = registry.layers.find((l) => l.id === 'vacant_parcels')!;
  const ctx = (listed: string) => {
    const state = defaultState(registry, 'analysis');
    state.settings.vacant_parcels = { ...state.settings.vacant_parcels, listed };
    return { registry, state, layer, manifest } as unknown as Parameters<typeof parcelFilter>[0];
  };

  it('shows only the parcels marked `la` when chosen, and every parcel by default', () => {
    expect(layer.settings.find((s) => s.id === 'listed')!.default).toBe('any');
    expect(JSON.stringify(parcelFilter(ctx('any')))).not.toContain('"la"');
    expect(JSON.stringify(parcelFilter(ctx('available')))).toContain('["==",["to-number",["get","la"],0],1]');
    expect(vacantParcels.settings).toContain('listed');
  });

  it('says so in the legend', () => {
    const notes = (listed: string) => vacantParcels.legend(ctx(listed)).filter((e) => e.kind === 'note').map((e) => (e as { text: string }).text);
    expect(notes('available')).toContain(strings.legend.parcelsListed);
    expect(notes('any')).not.toContain(strings.legend.parcelsListed);
  });
});
