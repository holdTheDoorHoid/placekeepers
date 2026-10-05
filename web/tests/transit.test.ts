import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import { defaultState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { strings } from '../src/strings.ts';
import { describeStop, osmUrl } from '../src/transit/describe.ts';

describe('what a tapped bus stop says', () => {
  const s = strings.stops;

  it('lists each answer StreetComplete asks, with "not yet surveyed" where OpenStreetMap has none', () => {
    const view = describeStop({ id: 'n7735158249', c: 3, md: 2, sh: 1, bn: 0, nm: 'Chester Avenue & 43rd Street', ref: '20801' });
    expect(view.name).toBe('Chester Avenue & 43rd Street');
    expect(view.ref).toBe('20801');
    expect(view.served).toBe(s.served[2]);
    expect(view.comfort).toBe(s.comfort[3]);
    expect(view.answers.map((a) => [a.key, a.value])).toEqual([
      ['sh', s.yes],
      ['bn', s.no],
      ['bi', s.unknown],
      ['lt', s.unknown],
      ['tp', s.unknown],
    ]);
    expect(view.anyUnknown).toBe(true);
    expect(view.osmUrl).toBe('https://www.openstreetmap.org/node/7735158249');
  });

  it('adds wheelchair access, a departures board and a roof only when known', () => {
    const view = describeStop({ id: 'w42', c: 3, md: 1, sh: 1, bn: 1, bi: 1, lt: 1, tp: 1, wc: 2, cv: 1 });
    expect(view.answers.map((a) => [a.key, a.value])).toEqual([
      ['sh', s.yes],
      ['bn', s.yes],
      ['bi', s.yes],
      ['lt', s.yes],
      ['tp', s.yes],
      ['wc', s.limited],
      ['cv', s.yes],
    ]);
    expect(view.anyUnknown).toBe(false);
    expect(view.osmUrl).toBe('https://www.openstreetmap.org/way/42');
    expect(view.name).toBeNull();
  });

  it('says when a shelter or bench is mapped on its own beside the stop', () => {
    const view = describeStop({ id: 'n1', c: 3, md: 1, sh: 1, bn: 1, nb: 1 });
    expect(view.answers.find((a) => a.key === 'sh')?.nearby).toBe(true);
    expect(view.answers.find((a) => a.key === 'bn')?.nearby).toBe(false);
  });

  it('never calls an unknown stop empty', () => {
    const view = describeStop({ id: 'n2', c: 0, md: 1 });
    expect(view.comfort).toBe(s.comfort[0]);
    expect(view.answers.every((a) => a.value === s.unknown)).toBe(true);
  });

  it('links only well formed ids to OpenStreetMap', () => {
    expect(osmUrl('n12')).toBe('https://www.openstreetmap.org/node/12');
    expect(osmUrl('x12')).toBeNull();
    expect(osmUrl(undefined)).toBeNull();
  });
});

describe('the details panel for a tapped stop', () => {
  const registry = loadRegistry();
  const store = { registry, state: defaultState(registry, 'field'), inspected: null } as unknown as AppStore;
  const details = (properties: Record<string, unknown>) =>
    render(FeatureDetails, { props: { store, target: { layerId: 'bus_stops', features: [properties], lngLat: [-75.2, 39.95] } } }).body;

  it('says not yet surveyed, never no, and links to the survey guide and to OpenStreetMap', () => {
    const html = details({ id: 'n6', c: 0, md: 1, nm: 'Sample St & Test Ave' });
    expect(html).toContain('Sample St &amp; Test Ave');
    expect(html).toContain(strings.stops.unknownNote);
    expect(html).not.toContain(`${strings.stops.answers.sh}: ${strings.stops.no}`);
    expect(html).toContain('href="/placekeepers/streetcomplete/"');
    expect(html).toContain('href="https://www.openstreetmap.org/node/6"');
    expect(html).toContain(strings.stops.source);
  });
});
