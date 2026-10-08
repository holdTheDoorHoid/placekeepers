// The placemaking lens (M3.4): six factors on the lots with their evidence badges, its presets,
// using it colors the lots by it, cards and lot pages lead with its suggestions, a place to sit, a
// garden and art carry the displacement caution, and the reports to Philly311 point to the City's
// own services for physical conditions, never to the police.

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import PlaceCard from '../src/components/places/PlaceCard.svelte';
import { LENS_SUGGESTIONS, isGreening } from '../src/config/suggestions.ts';
import { IDLE_PARTS, buildDossier } from '../src/dossier/build.ts';
import { displayedBreakdown } from '../src/map/lens.ts';
import { lensChanges, lensShown } from '../src/map/lens-layers.ts';
import { styleFor } from '../src/map/styles/index.ts';
import { describePlace, firstStepFor, parcelLensOf } from '../src/places/rank.ts';
import { defaultState } from '../src/state/defaults.ts';
import { AppStore } from '../src/state/store.svelte.ts';
import { strings } from '../src/strings.ts';

const reg = loadRegistry();
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const CAUTION = 'Greening can raise nearby prices. Consider pairing it with protections.';
const lens = reg.lenses.find((l) => l.id === 'placemaking')!;
const fixtureLots = read('../fixtures/sources/parcels.geojson').features as { properties: Record<string, unknown> }[];
const PLACEMAKING = ['seating_and_shade', 'community_garden', 'art_request'];
const REPORTS = ['report_dumping', 'report_dark_light', 'report_graffiti'];

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

function placeOf(id: string) {
  const found = fixtureLots.find((f) => f.properties.id === id)!;
  return { id, properties: { ...found.properties }, center: [-75.155, 39.985] as [number, number] };
}

function lotPage(id: string, lensId = 'placemaking') {
  const state = defaultState(reg, 'analysis');
  state.settings.vacant_parcels!.lens = lensId;
  return buildDossier({
    opa: id,
    registry: reg,
    state,
    manifest: null,
    shard: { status: 'loading' } as never,
    tile: { ...placeOf(id).properties },
    live: IDLE_PARTS,
    liveOn: false,
    center: null,
    now: new Date('2026-10-08T12:00:00Z'),
  });
}

describe('the placemaking lens', () => {
  it('ranks lots by six factors with the evidence badges of docs/EVIDENCE.md', () => {
    expect(lens.applies_to).toBe('parcel');
    expect(lens.factors.map((f) => [f.field, f.evidence])).toEqual([
      ['f_neighbors', 'context'],
      ['f_dest', 'mixed'],
      ['f_walk', 'mixed'],
      ['f_park', 'context'],
      ['f_art', 'context'],
      ['f_corr', 'mixed'],
    ]);
    expect(lens.factors.map((f) => f.label)).toEqual([
      'People within a 5 minute walk',
      'Everyday places within a 10 minute walk',
      'Walkability',
      'Far from a park',
      'No public art nearby',
      'On or near a commercial corridor',
    ]);
    expect(lens.presets.map((p) => p.label)).toEqual(['Balanced', 'Most neighbors', 'Where people already walk', 'Far from a park']);
    // The default weights are its Balanced preset, so a preset shows as in use from the start.
    const defaults = Object.fromEntries(lens.factors.map((f) => [f.id, f.default_weight]));
    expect(lens.presets[0]!.weights).toEqual(defaults);
  });

  it('never claims to reduce violence', () => {
    const text = [lens.description, ...lens.factors.map((f) => f.explain)].join(' ');
    expect(lens.factors.every((f) => f.evidence !== 'strong' && f.evidence !== 'moderate')).toBe(true);
    expect(text).toMatch(/not about crime/);
    expect(text).not.toMatch(/reduces? (gun )?violence|less crime|safer from/i);
  });

  it('is offered by the lots layer and colors the lots when chosen or when a preset is used', () => {
    const lots = reg.layers.find((l) => l.id === 'vacant_parcels')!;
    const setting = lots.settings.find((s) => s.id === 'lens')!;
    expect(setting.type === 'choice' && setting.options.find((o) => o.value === 'placemaking')?.label).toBe('The placemaking lens');
    const store = new AppStore(reg, { state: defaultState(reg, 'analysis'), viewPinned: true }, { listStorage: null });
    expect(lensShown(reg, store.state, lens)).toBe(false);
    expect(lensChanges(reg, store.state, lens).recolor.map((r) => [r.layer.id, r.setting, r.value])).toEqual([['vacant_parcels', 'lens', 'placemaking']]);
    store.applyPreset('placemaking', 'far_from_a_park');
    expect(store.state.settings.vacant_parcels!.lens).toBe('placemaking');
    expect(parcelLensOf(reg, store.state)?.id).toBe('placemaking');
    expect(lensShown(reg, store.state, lens)).toBe(true);
    const fill = styleFor(lots)!
      .layers({ layer: lots, registry: reg, state: store.state, sourceId: 'tiles', sourceLayer: lots.source_layer })
      .find((p) => p.id.endsWith(':fill')) as { paint: Record<string, unknown> };
    const paint = JSON.stringify(fill.paint['fill-color']);
    expect(paint).toContain('f_park');
    expect(paint).not.toContain('f_shoot');
    // The preset turns walking and art off, so only neighbors and parks are in the blend.
    expect(paint).not.toContain('f_walk');
    const legend = styleFor(lots)!.legend({ layer: lots, registry: reg, state: store.state });
    expect((legend.find((e) => e.kind === 'ramp') as { title: string }).title).toBe(strings.legend.parcelsFillLens('Placemaking'));
  });

  it('gives a breakdown that adds up to the score, and leads the cards with its own suggestions', () => {
    const state = defaultState(reg, 'field');
    state.settings.vacant_parcels!.lens = 'placemaking';
    for (const f of fixtureLots) {
      const described = describePlace(reg, state, placeOf(String(f.properties.id)));
      expect(described.why?.factors.map((x) => x.id)).toEqual(lens.factors.map((x) => x.id));
      const shown = displayedBreakdown(described.why!);
      if (shown.score === null) continue;
      const total = shown.contributions.reduce((a, b) => a + b, 0);
      expect(Math.round(total * 10) / 10).toBe(shown.score);
    }
    expect(LENS_SUGGESTIONS.placemaking).toEqual(PLACEMAKING);
    const seat = describePlace(reg, state, placeOf('990000021'));
    expect(seat.suggestions[0]!.id).toBe('seating_and_shade');
    const garden = describePlace(reg, state, placeOf('990000028'));
    expect(garden.suggestions[0]!.id).toBe('community_garden');
    // Under the violence lens, the same lot leads with clean and green.
    expect(describePlace(reg, defaultState(reg, 'field'), placeOf('990000021')).suggestions[0]!.id).toBe('clean_and_green');
    // A report to Philly311 never leads, even under this lens.
    const report = describePlace(reg, state, placeOf('990000022'));
    expect(report.suggestions.map((s) => s.id).slice(-2)).toEqual(['report_dumping', 'report_dark_light']);
  });

  it('names the lens behind the score on the lot page, with every factor in the breakdown', () => {
    const view = lotPage('990000007');
    expect(view.summary.lens?.id).toBe('placemaking');
    expect(view.summary.why?.factors.map((f) => f.label)).toEqual(lens.factors.map((f) => f.label));
    expect(view.summary.why?.factors.find((f) => f.id === 'commercial_corridor')?.value).toBe(0);
    expect(view.actions.suggestions.map((s) => s.suggestion.id)).toEqual([
      'seating_and_shade',
      'art_request',
      'clean_and_green',
      'report_dumping',
    ]);
  });
});

describe('the placemaking suggestions', () => {
  it('carry the displacement caution for a place to sit, a garden and art, not for a report', () => {
    for (const id of PLACEMAKING) expect(isGreening(id)).toBe(true);
    for (const id of REPORTS) expect(isGreening(id)).toBe(false);
    const state = defaultState(reg, 'field');
    state.settings.vacant_parcels!.lens = 'placemaking';
    const store = {
      registry: reg,
      state,
      addresses: { get: () => null },
      lists: { active: null, has: () => false },
      inspected: null,
    } as unknown as AppStore;
    const place = { ...describePlace(reg, state, placeOf('990000021')), distance: 20 };
    const card = textOf(render(PlaceCard, { props: { store, place, lensLabel: 'Placemaking', fromYou: false } }).body);
    expect(card).toContain('What you could do: Make a place to sit in the shade.');
    expect(card).toContain(CAUTION);
  });

  it('need the land owner for a place to sit or a garden, and a wall owner for a mural', () => {
    for (const id of ['seating_and_shade', 'community_garden']) {
      const suggestion = reg.suggestions.find((s) => s.id === id)!;
      expect(suggestion.applies_to).toBe('parcel');
      expect(suggestion.routes.slice(0, 3)).toEqual(['land_bank_garden_agreement', 'ask_the_owner', 'community_landcare']);
    }
    const garden = lotPage('990000028').actions.suggestions.find((s) => s.suggestion.id === 'community_garden')!;
    expect(garden.partners.map((p) => p.id)).toEqual(['phs', 'ngt', 'gjli']);
    const seat = lotPage('990000021').actions.suggestions.find((s) => s.suggestion.id === 'seating_and_shade')!;
    expect(seat.routes.map((r) => r.route.id)).toEqual(['land_bank_garden_agreement', 'public_space_mini_grant', 'treephilly_yard_trees', 'street_tree_request']);
    const art = reg.suggestions.find((s) => s.id === 'art_request')!;
    const { firstStep } = firstStepFor(reg, art, 5);
    expect(firstStep?.route.id).toBe('mural_arts_wall_request');
    expect(firstStep?.step).toMatch(/ask its owner/);
  });

  it('link out to Mural Arts only through its own request page, and copy nothing from it', () => {
    const urls = [...reg.routes.flatMap((r) => r.links.map((l) => l.url)), ...reg.partners.map((p) => p.url)].filter((u) => u.includes('muralarts.org'));
    expect(urls.sort()).toEqual(['https://muralarts.org/', 'https://muralarts.org/contact/']);
  });

  it('report physical conditions to Philly311, never to the police', () => {
    for (const id of REPORTS) {
      const suggestion = reg.suggestions.find((s) => s.id === id)!;
      expect(suggestion.routes).toEqual(['report_to_311']);
      const { firstStep } = firstStepFor(reg, suggestion, 5);
      expect(firstStep?.route.id).toBe('report_to_311');
      expect(firstStep?.step).toMatch(/Philly311/);
    }
    const route = reg.routes.find((r) => r.id === 'report_to_311')!;
    expect(route.steps[0]).toMatch(/illegal dumping, graffiti, or dark street or alley light/);
    const words = [...PLACEMAKING, ...REPORTS].flatMap((id) => {
      const s = reg.suggestions.find((x) => x.id === id)!;
      const routes = s.routes.map((r) => reg.routes.find((x) => x.id === r)!);
      return [s.label, s.summary, ...routes.flatMap((r) => [r.label, ...r.steps])];
    });
    expect(words.join(' ')).not.toMatch(/police|enforce|arrest|citation/i);
  });

  it('list a report after the lot\'s first suggestions on its page', () => {
    const view = lotPage('990000038', 'violence');
    const ids = view.actions.suggestions.map((s) => s.suggestion.id);
    expect(ids[0]).toBe('clean_and_green');
    expect(ids.at(-1)).toBe('report_graffiti');
    const report = view.actions.suggestions.at(-1)!;
    expect(report.routes.map((r) => r.route.id)).toEqual(['report_to_311']);
  });
});
