// Parking problems reported with Laser Vision (issue #37): the heat map and its hexagons, the
// kind setting, the window from the manifest, what a tapped area says, and the framing rules:
// counts only, physical fixes, and never tickets, the Parking Authority or enforcement.

import { readFileSync } from 'node:fs';
import { featureFilter } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import { parseManifest } from '../src/data/manifest.ts';
import { STYLES, styleFor } from '../src/map/styles/index.ts';
import { HEX_BREAKS } from '../src/map/styles/parking_reports.ts';
import type { StyleContext } from '../src/map/styles/types.ts';
import { defaultLayers, defaultState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { MIN_REPORTS, PARKING_FIELDS, PARKING_KINDS, describeParking, parkingWindow, parkingWindowText } from '../src/streets/parking.ts';
import { collectStrings, strings } from '../src/strings.ts';

const reg = loadRegistry();
const layer = reg.layers.find((l) => l.id === 'parking_reports')!;
const manifest = parseManifest(JSON.parse(readFileSync(new URL('../fixtures/data/manifest.json', import.meta.url), 'utf8'))).manifest!;

/** Words that must never appear about this layer (docs/ETHICS.md, "Policing"). */
const NEVER = /ticket|citation|\bfine[sd]?\b|parking authority|\bppa\b|enforce|police|report(ing)? (a |the )?drivers?|plate|\btow(ed|ing)?\b/i;

function ctx(kind?: string, withManifest = true): StyleContext {
  const state = defaultState(reg, 'analysis');
  if (kind) state.settings.parking_reports = { kind };
  return { layer, registry: reg, state, sourceId: 'tiles', sourceLayer: 'parking', manifest: withManifest ? manifest : null };
}

const part = (specs: LayerSpecification[], name: string) => specs.find((s) => s.id === `pk:parking_reports:${name}`)!;

/** Whether a part draws a feature of the given geometry type (1 point, 3 polygon). */
function draws(spec: LayerSpecification, type: 1 | 3, properties: Record<string, unknown>, zoom = 14): boolean {
  const filter = featureFilter((spec as { filter: unknown }).filter as never);
  return filter.filter({ zoom } as never, { type, properties } as never);
}

describe('the parking reports layer', () => {
  it('is in the street safety group, off by default in both views, and in no lens', () => {
    expect(layer.group).toBe('streets');
    expect(layer.style).toBe('parking_reports');
    expect(defaultLayers(reg, 'field')).not.toContain('parking_reports');
    expect(defaultLayers(reg, 'analysis')).not.toContain('parking_reports');
    const lensText = JSON.stringify(reg.lenses);
    expect(lensText).not.toMatch(/parking|laser|pba/i);
  });

  it('credits Philly Bike Action under its permission, with a link to its map', () => {
    const source = reg.sources.find((s) => s.id === 'pba_laser')!;
    expect(source.publisher).toBe('Philly Bike Action');
    expect(source.homepage).toBe('https://bikeaction.org/tools/laser/map/');
    expect(source.attribution).toContain('Laser Vision');
    const license = reg.licenses.find((l) => l.id === source.license)!;
    expect(license.label).toContain('permission from Philly Bike Action');
    expect(license.label).toContain('2026-10-08');
  });

  it('has a tile property for every kind the setting offers, and nothing else', () => {
    const setting = layer.settings.find((s) => s.id === 'kind')!;
    expect(setting.type).toBe('choice');
    const values = setting.type === 'choice' ? setting.options.map((o) => o.value) : [];
    expect(values.sort()).toEqual(Object.keys(PARKING_FIELDS).sort());
    expect(Object.values(PARKING_FIELDS).sort()).toEqual(['bl', 'co', 'cw', 'n', 'rp', 'sw']);
    for (const kind of ['all', ...PARKING_KINDS]) expect(strings.parking.kinds[kind], kind).toBeTruthy();
  });

  it('draws a heat map from the centers zoomed out and the hexagons close in', () => {
    const specs = STYLES.parking_reports.layers(ctx());
    const heat = part(specs, 'heat');
    const cells = part(specs, 'cells');
    expect(heat.type).toBe('heatmap');
    expect(heat.maxzoom).toBe(14);
    expect(cells.type).toBe('fill');
    expect(cells.minzoom).toBe(13);
    expect(STYLES.parking_reports.clickable).toEqual(['cells']);
    expect(draws(heat, 1, { n: 12 })).toBe(true);
    expect(draws(heat, 3, { n: 12 })).toBe(false);
    expect(draws(cells, 3, { id: 'x', n: 12 })).toBe(true);
    expect(draws(cells, 1, { n: 12 })).toBe(false);
  });

  it('never draws an area with fewer than 5 reports of the chosen kind', () => {
    for (const kind of ['all', ...PARKING_KINDS]) {
      const field = PARKING_FIELDS[kind as keyof typeof PARKING_FIELDS];
      const specs = STYLES.parking_reports.layers(ctx(kind));
      for (const name of ['heat', 'cells']) {
        const type = name === 'heat' ? 1 : 3;
        expect(draws(part(specs, name), type, { n: 40, [field]: MIN_REPORTS }), `${kind} ${name}`).toBe(true);
        expect(draws(part(specs, name), type, { n: 40, [field]: MIN_REPORTS - 1 }), `${kind} ${name}`).toBe(false);
      }
      if (kind !== 'all') expect(draws(part(specs, 'cells'), 3, { n: 40 }), `${kind} missing`).toBe(false);
    }
  });

  it('weights the heat by the chosen kind', () => {
    const ramp = part(STYLES.parking_reports.layers(ctx('bike_lane')), 'heat') as { paint: Record<string, unknown> };
    expect(JSON.stringify(ramp.paint['heatmap-weight'])).toContain('"bl"');
  });

  it('dates its legend from the manifest: the 12 months to the newest record', () => {
    expect(parkingWindow(manifest)).toEqual({ start: '2025-10-04', end: '2026-10-03' });
    const legend = STYLES.parking_reports.legend(ctx());
    const ramp = legend.find((e) => e.kind === 'ramp')!;
    expect(ramp.kind === 'ramp' && ramp.title).toContain('From October 4, 2025 to October 3, 2026');
    const bins = legend.find((e) => e.kind === 'bins')!;
    expect(bins.kind === 'bins' && bins.bins.map((b) => b.label)).toEqual(['5 to 9', '10 to 24', '25 to 49', '50 to 99', '100 or more']);
    const notes = legend.filter((e) => e.kind === 'note').map((e) => (e.kind === 'note' ? e.text : ''));
    expect(notes.join(' ')).toContain('fewer than 5 reports are left out');
    expect(notes.join(' ')).toContain('one app');
    const without = STYLES.parking_reports.legend(ctx(undefined, false)).find((e) => e.kind === 'ramp')!;
    expect(without.kind === 'ramp' && without.title).toContain('Over 12 months');
  });

  it('starts the window the day after the same date a year before, like the pipeline', () => {
    const at = (end: string) => parkingWindow({ ...manifest, sources: { pba_laser: { ...manifest.sources.pba_laser!, newest_record: end } } });
    expect(at('2026-10-07')).toEqual({ start: '2025-10-08', end: '2026-10-07' });
    expect(at('2028-02-29')).toEqual({ start: '2027-03-01', end: '2028-02-29' });
    expect(at('2026-12-31')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(parkingWindow(null)).toBeNull();
    expect(parkingWindowText(null)).toBe('Over 12 months');
  });

  it('uses classes that start at the threshold and rise', () => {
    for (const breaks of Object.values(HEX_BREAKS)) {
      expect(breaks[0]).toBeGreaterThan(MIN_REPORTS);
      expect([...breaks].sort((a, b) => a - b)).toEqual([...breaks]);
    }
  });
});

describe('an area someone tapped', () => {
  const store = { registry: reg, state: defaultState(reg, 'analysis'), inspected: null, manifest } as unknown as AppStore;
  const details = (properties: Record<string, unknown>) =>
    render(FeatureDetails, {
      props: { store, target: { layerId: 'parking_reports', features: [properties], lngLat: [-75.16, 39.98] } },
    }).body;

  it('gives the counts by kind, "fewer than 5" for the rest, and the window', () => {
    const view = describeParking({ id: '8a2a1072b59ffff', n: 48, sw: 20, bl: 19, cw: 6, co: 3 }, manifest);
    expect(view.total).toBe(48);
    expect(view.kinds.map((k) => k.count)).toEqual([20, 19, 6, null, null]);
    const html = details({ id: '8a2a1072b59ffff', n: 48, sw: 20, bl: 19, cw: 6 });
    expect(html).toContain('48 reports of vehicles blocking the way. From October 4, 2025 to October 3, 2026.');
    expect(html).toContain('On a sidewalk');
    expect(html).toContain('fewer than 5');
    expect(html).toContain(strings.parking.meaning);
  });

  it('frames the counts as evidence for physical fixes, with the City office to ask', () => {
    const html = details({ id: 'x', n: 9, cw: 5 });
    for (const fix of ['curb extensions', 'bollards', 'daylighted corners', 'protected bike lanes', 'loading zones']) expect(html).toContain(fix);
    expect(html).toContain('otis@phila.gov');
  });

  it('credits Philly Bike Action with a link to its map that opens safely', () => {
    const html = details({ id: 'x', n: 7 });
    expect(html).toContain('href="https://bikeaction.org/tools/laser/map/"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('never says anything about tickets, the Parking Authority, drivers or enforcement', () => {
    const html = details({ id: 'x', n: 142, sw: 61, bl: 38, cw: 22, co: 14, rp: 7 });
    expect(html).not.toMatch(NEVER);
    for (const [path, text] of collectStrings(strings.parking)) expect(text, path).not.toMatch(NEVER);
    for (const text of [layer.label, layer.description, ...layer.settings.flatMap((s) => (s.type === 'choice' ? [s.label, ...s.options.map((o) => o.label)] : [s.label]))]) {
      expect(text).not.toMatch(NEVER);
    }
    const legend = JSON.stringify(styleFor(layer)!.legend(ctx()));
    expect(legend).not.toMatch(NEVER);
  });
});
