// The route survey sheets (M2.4): reading the published files, splitting a route among
// volunteers, our time estimate, links into OpenStreetMap, the boxes kept on this device, the
// sheet as it renders, and the links to it from the map (a route's details and the shelters and
// benches legend).

import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import FeatureDetails from '../src/components/streets/FeatureDetails.svelte';
import { styleFor } from '../src/map/styles/index.ts';
import { defaultState } from '../src/state/defaults.ts';
import type { AppStore } from '../src/state/store.svelte.ts';
import { strings } from '../src/strings.ts';
import { describeRoute, describeRoutes } from '../src/survey/route.ts';
import SurveySheet from '../src/survey/SurveySheet.svelte';
import {
  answeredCount,
  answersKey,
  directionLabel,
  estimateMinutes,
  formatDuration,
  formatMiles,
  isTrolley,
  loadAnswers,
  metersAlong,
  osmEditUrl,
  osmViewUrl,
  parseIndex,
  parseSheet,
  readChoice,
  routeLabel,
  saveAnswers,
  splitParts,
  statusCounts,
  statusOf,
  toggle,
  writeChoice,
  type SheetStop,
} from '../src/survey/sheet.ts';

const t = strings.survey;
const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/data/tables/routes/${name}`, import.meta.url), 'utf8'));
const index = parseIndex(read('index.json'))!;
const route60 = parseSheet(read('60.json'))!;
const east = route60.directions[0]!;

function stops(n: number, spacing = 100): SheetStop[] {
  return Array.from({ length: n }, (_, i) => ({ k: `sp${i}`, sid: String(i), nm: `Stop ${i}`, lat: 39.95 + (i * spacing) / 111_195, lng: -75.16 }));
}

describe('reading the published sheets', () => {
  it('reads the index with each route, its directions and its counts', () => {
    expect(index.as_of).toEqual({ schedules: 'v202609270', osm: '2026-10-03' });
    expect(index.routes.map((r) => r.id)).toEqual(['T1', '16', '60']);
    const r60 = index.routes.find((r) => r.id === '60')!;
    expect(r60.file).toBe('tables/routes/60.json');
    expect(r60.dirs).toEqual([
      { d: 0, dir: 'Eastbound', to: 'Sample Loop', n: 6 },
      { d: 1, dir: 'Westbound', to: 'Sample 1 Ave', n: 3 },
    ]);
    expect(r60.s).toEqual({ '0': 2, '1': 1, '2': 1, '3': 1, none: 4 });
    expect(routeLabel(r60)).toBe('60: Sample route across town');
    expect(isTrolley(index.routes[0]!.md)).toBe(true);
    expect(isTrolley(r60.md)).toBe(false);
  });

  it('reads a route with each stop and what OpenStreetMap shows there', () => {
    expect(route60.r).toBe('60');
    expect(east.stops.map(statusOf)).toEqual(['shelter', 'bench', 'neither', 'missing', 'unsurveyed', 'missing']);
    expect(east.stops[0]).toMatchObject({ k: 'sp1201', sid: '1201', c: 3, osm: 'n9000001', sh: 1, bn: 1, bi: 1, lt: 1 });
    expect(statusCounts(east.stops)).toEqual({ shelter: 1, bench: 1, neither: 1, unsurveyed: 1, missing: 2 });
    expect(route60.directions[1]!.out).toBe(1);
  });

  it('refuses what is not a sheet, and skips files outside the routes folder', () => {
    expect(parseIndex(null)).toBeNull();
    expect(parseIndex({ routes: 'no' })).toBeNull();
    expect(parseSheet({ id: '1' })).toBeNull();
    const odd = parseIndex({ routes: [{ id: 'x', file: '../manifest.json', dirs: [] }, { id: '7', file: 'tables/routes/7.json', dirs: [{ d: 0, n: 2 }] }] })!;
    expect(odd.routes.map((r) => r.id)).toEqual(['7']);
    const sheet = parseSheet({ id: '7', directions: [{ d: 0, stops: [{ k: 'sp1', sid: '1', lat: 39.9, lng: -75.1, c: 9, osm: 'x1' }, { nm: 'broken' }] }] })!;
    expect(sheet.directions[0]!.stops).toEqual([{ k: 'sp1', sid: '1', nm: '1', lat: 39.9, lng: -75.1 }]);
  });

  it('names a direction with what SEPTA gives', () => {
    expect(directionLabel({ d: 0, dir: 'Southbound', to: 'Whitman Plaza' })).toBe('Southbound to Whitman Plaza');
    expect(directionLabel({ d: 1, to: 'Whitman Plaza' })).toBe('Toward Whitman Plaza');
    expect(directionLabel({ d: 1, dir: 'Northbound' })).toBe('Northbound');
    expect(directionLabel({ d: 1 })).toBe('Direction 2');
  });
});

describe('splitting a route among volunteers', () => {
  it('gives each part stops that follow each other, as equal as whole stops allow', () => {
    const parts = splitParts(stops(10), 3);
    expect(parts.map((p) => [p.first, p.last])).toEqual([
      [1, 4],
      [5, 7],
      [8, 10],
    ]);
    expect(parts.flatMap((p) => p.stops.map((s) => s.k))).toEqual(stops(10).map((s) => s.k));
    expect(Math.round(parts[0]!.meters)).toBe(300);
  });

  it('never makes more parts than stops, nor fewer than one', () => {
    expect(splitParts(stops(2), 5).length).toBe(2);
    expect(splitParts(stops(4), 0).length).toBe(1);
    expect(splitParts([], 3)).toEqual([{ number: 1, first: 1, last: 0, stops: [], meters: 0 }]);
  });
});

describe('our time estimate', () => {
  it('walks about 3 miles an hour and spends about a minute at each stop', () => {
    // 1,700 meters is about 21 minutes of walking, plus 20 stops: 41, rounded to 40.
    expect(estimateMinutes(1700, 20)).toBe(40);
    // Route 47 southbound: 16.5 kilometers and 102 stops, about 5 hours.
    expect(estimateMinutes(16529, 102)).toBe(310);
    expect(estimateMinutes(0, 1)).toBe(5);
  });

  it('says it in words', () => {
    expect(formatDuration(40)).toBe('about 40 minutes');
    expect(formatDuration(60)).toBe('about 1 hour');
    expect(formatDuration(75)).toBe('about 1 hour 15 minutes');
    expect(formatDuration(310)).toBe('about 5 hours 10 minutes');
    expect(formatMiles(16529)).toBe('10.3 miles');
    expect(formatMiles(50)).toBe('less than 0.1 miles');
  });

  it('measures along the stops in order', () => {
    expect(Math.round(metersAlong(stops(3, 250)))).toBe(500);
    expect(metersAlong(stops(1))).toBe(0);
  });
});

describe('links into OpenStreetMap', () => {
  const at = { k: 'sp1', sid: '1', nm: 'A', lat: 39.95, lng: -75.16 };

  it('opens the matching stop, or the spot where SEPTA puts it', () => {
    expect(osmViewUrl({ ...at, osm: 'n42' })).toBe('https://www.openstreetmap.org/node/42');
    expect(osmEditUrl({ ...at, osm: 'n42' })).toBe('https://www.openstreetmap.org/edit?node=42');
    expect(osmEditUrl({ ...at, osm: 'w7' })).toBe('https://www.openstreetmap.org/edit?way=7');
    expect(osmViewUrl(at)).toBe('https://www.openstreetmap.org/?mlat=39.95&mlon=-75.16#map=19/39.95/-75.16');
    expect(osmEditUrl(at)).toBe('https://www.openstreetmap.org/edit#map=19/39.95/-75.16');
  });
});

describe('the boxes someone ticks, kept on this device', () => {
  class Memory {
    items = new Map<string, string>();
    getItem(key: string) {
      return this.items.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.items.set(key, value);
    }
    removeItem(key: string) {
      this.items.delete(key);
    }
  }

  it('lets Yes and No replace each other, and a second tick clear the box', () => {
    let a = toggle(undefined, 'sh', 'y');
    expect(a).toEqual({ sh: 'y' });
    a = toggle(a, 'sh', 'n');
    expect(a).toEqual({ sh: 'n' });
    a = toggle(a, 'sh', 'n');
    expect(a).toEqual({});
  });

  it('keeps what was filled in for each route and direction', () => {
    const storage = new Memory();
    const key = answersKey('60', 0);
    expect(key).toBe('pk-survey:60:0');
    expect(saveAnswers(storage, key, { sp1201: { sh: 'y', rp: true, nt: 'Glass cracked' }, sp1202: {} })).toBe(true);
    expect(loadAnswers(storage, key)).toEqual({ sp1201: { sh: 'y', rp: true, nt: 'Glass cracked' } });
    expect(answeredCount(loadAnswers(storage, key), east.stops)).toBe(1);
    saveAnswers(storage, key, {});
    expect(storage.items.has(key)).toBe(false);
  });

  it('carries on without storage, and ignores what it cannot read', () => {
    const broken = { getItem: () => '{not json', setItem: () => {}, removeItem: () => {} };
    expect(loadAnswers(broken, 'k')).toEqual({});
    const odd = { getItem: () => JSON.stringify({ a: { sh: 'maybe', bn: 'n', rp: 'yes' }, b: 4 }) };
    expect(loadAnswers(odd, 'k')).toEqual({ a: { bn: 'n' } });
    const full = { setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    expect(saveAnswers(full, 'k', { a: { sh: 'y' } })).toBe(false);
    expect(loadAnswers(null, 'k')).toEqual({});
    expect(saveAnswers(null, 'k', {})).toBe(false);
  });
});

describe('the address of a sheet', () => {
  it('names the route, direction and parts, so a sheet can be shared', () => {
    expect(writeChoice({ route: '47', d: 1, parts: 3 })).toBe('?route=47&d=1&parts=3');
    expect(writeChoice({ route: '47', d: 0, parts: 1 })).toBe('?route=47&d=0');
    expect(writeChoice({ route: null, d: 0, parts: 2 })).toBe('');
    expect(readChoice('?route=47&d=1&parts=3')).toEqual({ route: '47', d: 1, parts: 3 });
  });

  it('ignores what does not make sense', () => {
    expect(readChoice('?route=../x&d=-1&parts=99')).toEqual({ route: null, d: null, parts: 1 });
    expect(readChoice('')).toEqual({ route: null, d: null, parts: 1 });
  });
});

describe('the sheet as it renders', () => {
  const html = (props: Record<string, unknown>) => render(SurveySheet, { props: { sheet: route60, direction: east, ...props } as never }).body;

  it('lists the stops in order with what OpenStreetMap shows, boxes and a notes column', () => {
    const body = html({});
    const names = east.stops.map((s) => s.nm.replaceAll('&', '&amp;'));
    const rows = body.slice(body.indexOf('<tbody'));
    let last = -1;
    for (const name of names) {
      const at = rows.indexOf(name);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
    for (const word of [t.status.shelter, t.status.bench, t.status.neither, t.status.unsurveyed, t.status.missing]) expect(body).toContain(word);
    for (const column of Object.values(t.columns)) expect(body).toContain(`>${column}</th>`);
    expect(body).toContain(`aria-label="${t.answerLabel(1, 'Sample 2 St &amp; Sample 1 Ave', t.columns.sh!, t.yes)}"`);
    expect(body).toContain(`aria-label="${t.repairLabel(4, 'Sample 2 St &amp; Sample 6 Ave (midblock, near side)')}"`);
    expect(body).toContain('href="https://www.openstreetmap.org/edit?node=9000001"');
    expect(body).toContain(t.sheetFor('60', 'Eastbound to Sample Loop'));
    expect(body).toContain(t.safety[0]);
    expect(body).toContain(t.updates);
    expect(body).not.toContain(t.part(1, 1));
  });

  it('splits into parts, each with its own estimate, and ticks what was filled in', () => {
    const body = html({ parts: 2, answers: { sp1201: { sh: 'y' } }, onprint: () => {} });
    expect(body).toContain(t.part(1, 2));
    expect(body).toContain(t.part(2, 2));
    expect(body).toContain(t.partStops(4, 6));
    expect(body).toContain(t.printPart(2));
    expect(body.match(/<section/g)?.length).toBe(2);
    expect(body).toMatch(/<input[^>]*checked[^>]*aria-label="Stop 1, Sample 2 St &amp; Sample 1 Ave: Shelter, Yes"/);
  });

  it('prints one part alone when asked', () => {
    const body = html({ parts: 3, only: 2 });
    expect(body.match(/class="part[^"]*skip/g)?.length).toBe(2);
    expect(body).not.toMatch(/class="part[^"]*new-page/);
  });
});

describe('links to the sheets from the map', () => {
  const registry = loadRegistry();
  const store = { registry, state: defaultState(registry, 'field'), inspected: null } as unknown as AppStore;
  const details = (layerId: string, features: Record<string, unknown>[]) =>
    render(FeatureDetails, { props: { store, target: { layerId, features, lngLat: [-75.16, 39.98] } } }).body;

  it('opens a bus or trolley route with a link to its survey sheet', () => {
    const body = details('transit_routes', [
      { id: '60', r: '60', nm: 'Sample route across town', md: 1, tw: 44, hm: 30 },
      { id: '60', r: '60', nm: 'Sample route across town', md: 1, tw: 44, hm: 30 },
      { id: 'B1', r: 'B1', nm: 'Broad Street Line Local', md: 4, hm: 7 },
    ]);
    expect(body).toContain(t.routeTitle('60'));
    expect(body).toContain(`href="${import.meta.env.BASE_URL}survey/?route=60"`);
    expect(body).toContain(t.routesHere(2));
    expect(body).not.toContain('survey/?route=B1');
    expect(describeRoute({ id: 'B1', md: 4 })?.survey).toBeNull();
    expect(describeRoute({ id: 'T1', r: 'T1', md: 2, hm: 10 })?.often).toBe('Weekdays from 10 to 2: a trolley about every 10 minutes.');
    expect(describeRoutes([{}, { id: '16' }]).map((v) => v.id)).toEqual(['16']);
  });

  it('links a tapped stop and the shelters and benches legend to the survey page', () => {
    expect(details('stop_amenities', [{ id: 'n6', c: 0, md: 1 }])).toContain(`href="${import.meta.env.BASE_URL}survey/"`);
    const layer = registry.layers.find((l) => l.id === 'stop_amenities')!;
    const legend = styleFor(layer)!.legend({ layer, registry, state: defaultState(registry, 'analysis') });
    expect(legend).toContainEqual(expect.objectContaining({ kind: 'note', link: { page: 'survey', label: strings.legend.stopSurveyRoute } }));
  });

  it('lets someone tap a route line on the map', () => {
    const layer = registry.layers.find((l) => l.id === 'transit_routes')!;
    expect(styleFor(layer)!.clickable).toEqual(['line']);
    expect(strings.streets.detailsTitle('transit_routes')).toBe('Route');
  });
});
