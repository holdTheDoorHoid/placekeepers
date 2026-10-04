import { createPropertyExpression, featureFilter, latest } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { FIELD_CHIPS } from '../src/config/chips.ts';
import type { LayerSpecification } from 'maplibre-gl';
import { styleFor } from '../src/map/styles/index.ts';
import { CRASH_COLORS, MEMORIAL_FILL, MEMORIAL_GLOW, MEMORIAL_RING, STREET_RAMP } from '../src/map/styles/palette.ts';
import { streetLens } from '../src/map/styles/street_segments.ts';
import { parcelLens } from '../src/map/styles/vacant_parcels.ts';
import type { Layer, SettingValue } from '../src/registry/types.ts';
import { defaultState, type AppState } from '../src/state/defaults.ts';
import {
  capitalize,
  describeCrash,
  describeMemorial,
  describeSegment,
  memorialMode,
  modesOf,
  removalHref,
  suggestionViews,
  titleStreet,
} from '../src/streets/describe.ts';
import { strings } from '../src/strings.ts';

const reg = loadRegistry();
const layer = (id: string) => reg.layers.find((l) => l.id === id)!;
const LINKS = { takedownEmail: '', repoUrl: 'https://github.com/holdTheDoorHoid/placekeepers' };

function parts(l: Layer, state: AppState) {
  return styleFor(l)!.layers({ layer: l, registry: reg, state, sourceId: 'tiles', sourceLayer: l.source_layer });
}

function part(l: Layer, state: AppState, name: string) {
  return parts(l, state).find((p) => p.id.endsWith(`:${name}`)) as LayerSpecification & {
    filter: unknown;
    paint: Record<string, unknown>;
  };
}

/** Whether a feature with these properties passes the part's filter. */
function shown(l: Layer, state: AppState, name: string, properties: Record<string, unknown>, type = 1): boolean {
  const filter = featureFilter(part(l, state, name).filter as never);
  return filter.filter({ zoom: 15 } as never, { type, properties } as never);
}

function withSetting(l: Layer, id: string, value: SettingValue): AppState {
  const state = defaultState(reg, 'analysis');
  state.settings[l.id] = { ...state.settings[l.id], [id]: value };
  return state;
}

describe('every registry setting has a visible effect', () => {
  it('changes what the style draws for every other value of every setting', () => {
    for (const l of reg.layers) {
      const base = JSON.stringify(parts(l, defaultState(reg, 'analysis')));
      for (const setting of l.settings) {
        const others: SettingValue[] =
          setting.type === 'choice'
            ? setting.options.map((o) => o.value).filter((v) => v !== setting.default)
            : setting.type === 'toggle'
              ? [!setting.default]
              : [setting.min, setting.max].filter((v) => v !== setting.default);
        expect(others.length, `${l.id}.${setting.id} has another value`).toBeGreaterThan(0);
        for (const value of others) {
          const changed = JSON.stringify(parts(l, withSetting(l, setting.id, value)));
          expect(changed, `${l.id}.${setting.id} = ${String(value)}`).not.toEqual(base);
        }
      }
    }
  });
});

describe('crashes style', () => {
  const crashes = layer('crashes');

  it('shows the most recent five years of deaths and serious injuries by default', () => {
    const state = defaultState(reg, 'analysis');
    expect(shown(crashes, state, 'circle', { ya: 0, sev: 3, m: 1 })).toBe(true);
    expect(shown(crashes, state, 'circle', { ya: 4, sev: 2, m: 0 })).toBe(true);
    expect(shown(crashes, state, 'circle', { ya: 5, sev: 3, m: 1 })).toBe(false);
    expect(shown(crashes, state, 'circle', { ya: 0, sev: 1, m: 1 })).toBe(false);
  });

  it('filters by years', () => {
    expect(shown(crashes, withSetting(crashes, 'years', 'latest'), 'circle', { ya: 1, sev: 3 })).toBe(false);
    expect(shown(crashes, withSetting(crashes, 'years', 'latest'), 'circle', { ya: 0, sev: 3 })).toBe(true);
    expect(shown(crashes, withSetting(crashes, 'years', 'all'), 'circle', { ya: 9, sev: 3 })).toBe(true);
  });

  it('filters by how badly people were hurt', () => {
    expect(shown(crashes, withSetting(crashes, 'severity', '3'), 'circle', { ya: 0, sev: 2 })).toBe(false);
    expect(shown(crashes, withSetting(crashes, 'severity', '1'), 'circle', { ya: 0, sev: 1 })).toBe(true);
    expect(shown(crashes, withSetting(crashes, 'severity', '0'), 'circle', { ya: 0, sev: 0 })).toBe(true);
  });

  it('filters by who was involved, reading the mode bit flags', () => {
    const walkCycle = withSetting(crashes, 'mode', 'walk_cycle');
    expect([0, 1, 2, 3, 4, 5, 6].map((m) => shown(crashes, walkCycle, 'circle', { ya: 0, sev: 3, m }))).toEqual([
      false,
      true,
      true,
      true,
      false,
      true,
      true,
    ]);
    const cycle = withSetting(crashes, 'mode', 'cycle');
    expect([1, 2, 3, 6].map((m) => shown(crashes, cycle, 'circle', { ya: 0, sev: 3, m }))).toEqual([false, true, true, true]);
    const motorcycle = withSetting(crashes, 'mode', 'motorcycle');
    expect([1, 4, 5].map((m) => shown(crashes, motorcycle, 'circle', { ya: 0, sev: 3, m }))).toEqual([false, true, true]);
  });

  it('tells people to zoom in for lesser crashes', () => {
    const notes = (state: AppState) => styleFor(crashes)!.legend({ layer: crashes, registry: reg, state });
    expect(notes(defaultState(reg, 'analysis'))).not.toContainEqual({ kind: 'note', text: strings.legend.crashesZoom });
    expect(notes(withSetting(crashes, 'severity', '0'))).toContainEqual({ kind: 'note', text: strings.legend.crashesZoom });
  });
});

describe('memorials style', () => {
  const memorials = layer('memorials');

  it('remembers people walking, cycling or riding a scooter by default', () => {
    const state = defaultState(reg, 'analysis');
    expect([0, 1, 2, 4, 8, 9, 5].map((m) => shown(memorials, state, 'marker', { m }))).toEqual([
      false,
      true,
      true,
      false,
      true,
      true,
      true,
    ]);
    const everyone = withSetting(memorials, 'all_fatal', true);
    expect([0, 4].map((m) => shown(memorials, everyone, 'marker', { m }))).toEqual([true, true]);
  });

  it('is a small quiet marker: no red, no crash imagery, never a name drawn on the map', () => {
    for (const p of parts(memorials, defaultState(reg, 'analysis'))) {
      expect(p.type).toBe('circle');
      expect(JSON.stringify(p)).not.toContain('text-field');
    }
    const marker = part(memorials, defaultState(reg, 'analysis'), 'marker');
    expect(marker.paint['circle-color']).toBe(MEMORIAL_FILL);
    expect(marker.paint['circle-stroke-color']).toBe(MEMORIAL_RING);
  });

  it('turns every name off at once with show names', () => {
    const on = part(memorials, defaultState(reg, 'analysis'), 'marker').paint['circle-stroke-width'];
    const off = part(memorials, withSetting(memorials, 'show_names', false), 'marker').paint['circle-stroke-width'];
    expect(on).not.toEqual(off);
    const spec = latest.paint_circle['circle-stroke-width'];
    const width = (value: unknown, properties: Record<string, unknown>) => {
      const parsed = createPropertyExpression(value, spec as never);
      if (parsed.result !== 'success') throw new Error(JSON.stringify(parsed.value));
      return parsed.value.evaluate({ zoom: 15 } as never, { type: 'Point', properties } as never);
    };
    // With names on, a marker that has a public name gets a fuller ring; with names off, every
    // marker looks the same.
    expect(width(on, { nm: 'Alex Example' })).toBeGreaterThan(width(on, {}) as number);
    expect(width(off, { nm: 'Alex Example' })).toBe(width(off, {}));

    const props = { id: 'fc20260820_1000', d: '2026-08-20', m: 1, pl: 'unit block of Oak St', nm: 'Alex Example', src: 'https://example.org/a' };
    const named = describeMemorial(props, true, LINKS);
    expect(named.name).toBe('Alex Example');
    expect(named.source).toBe('https://example.org/a');
    const hidden = describeMemorial(props, false, LINKS);
    expect(hidden.name).toBeNull();
    expect(hidden.source).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain('Alex Example');
  });
});

describe('street segments style', () => {
  const segments = layer('segments');
  const weights = (state: AppState, w: Record<string, number>) => {
    state.weights.street_safety = { ...state.weights.street_safety, ...w };
    return state;
  };

  it('is colored by the street safety lens, beside the violence lens on parcels', () => {
    const ctx = { registry: reg };
    expect(streetLens(ctx)?.id).toBe('street_safety');
    expect(parcelLens({ layer: segments, registry: reg, state: defaultState(reg, 'analysis') })?.id).toBe('violence');
    const line = part(segments, defaultState(reg, 'analysis'), 'line');
    expect(JSON.stringify(line.paint['line-color'])).toContain('f_ksi_vru');
    expect(JSON.stringify(line.paint['line-color'])).toContain(STREET_RAMP.stops[4]);
  });

  it('shows blocks that score at least the chosen threshold', () => {
    const state = defaultState(reg, 'analysis');
    // Default weights 3, 3, 2, 1: a school alone scores 11, the network alone 33.
    expect(shown(segments, state, 'line', { f_hin: 0, f_ksi_vru: 0, f_fatal2: 0, f_school: 100 }, 2)).toBe(false);
    expect(shown(segments, state, 'line', { f_hin: 100, f_ksi_vru: 0, f_fatal2: 0, f_school: 0 }, 2)).toBe(true);
    expect(shown(segments, state, 'line', { f_hin: 0, f_ksi_vru: 0, f_fatal2: 100, f_school: 0 }, 2)).toBe(true);
    const any = withSetting(segments, 'min_score', '1');
    expect(shown(segments, any, 'line', { f_hin: 0, f_ksi_vru: 0, f_fatal2: 0, f_school: 100 }, 2)).toBe(true);
    expect(shown(segments, any, 'line', { f_hin: 0, f_ksi_vru: 0, f_fatal2: 0, f_school: 0 }, 2)).toBe(false);
    // Moving the sliders changes which blocks pass, with no new data.
    const schools = weights(defaultState(reg, 'analysis'), { high_injury_network: 0, walking_cycling_harm: 0, recent_death: 0, school_nearby: 5 });
    expect(shown(segments, schools, 'line', { f_hin: 0, f_ksi_vru: 0, f_fatal2: 0, f_school: 100 }, 2)).toBe(true);
  });

  it('draws nothing when every street weight is off', () => {
    const off = weights(defaultState(reg, 'analysis'), { high_injury_network: 0, walking_cycling_harm: 0, recent_death: 0, school_nearby: 0 });
    expect(shown(segments, off, 'line', { f_hin: 100, f_ksi_vru: 100, f_fatal2: 100, f_school: 100 }, 2)).toBe(false);
    const legend = styleFor(segments)!.legend({ layer: segments, registry: reg, state: off });
    expect(legend).toEqual([{ kind: 'note', text: strings.lens.allOffFor('segment') }]);
  });
});

describe('street safety colors', () => {
  it('uses no alarm reds', () => {
    for (const color of [...STREET_RAMP.stops, ...CRASH_COLORS, MEMORIAL_FILL, MEMORIAL_RING, MEMORIAL_GLOW]) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      expect(r > 180 && g < 90 && b < 90, color).toBe(false);
    }
  });
});

describe('what a memorial says', () => {
  it('names how the person was traveling, walking first', () => {
    expect([1, 2, 8, 4, 0, 3, 12].map((m) => memorialMode(m))).toEqual(['walk', 'bike', 'scooter', 'motorcycle', 'other', 'walk', 'scooter']);
    expect(modesOf(13)).toEqual(['walk', 'scooter', 'motorcycle']);
  });

  it('gives the date, how the person was traveling and the place, in plain words', () => {
    const view = describeMemorial({ id: 'fc20260820_1000', d: '2026-08-20', m: 2, pl: 'unit block of Oak St' }, true, LINKS);
    expect(view.sentence).toBe('Killed while cycling on August 20, 2026.');
    expect(view.place).toBe('Unit block of Oak St');
    expect(view.name).toBeNull();
    expect(describeMemorial({ id: 'x', d: '2025-01-02', m: 8 }, true, LINKS).sentence).toBe('Killed while riding a scooter on January 2, 2025.');
    expect(describeMemorial({ id: 'x', d: '2025-01-02', m: 1 }, true, LINKS).sentence).toBe('Killed while walking on January 2, 2025.');
  });

  it('always offers removal, by id and never by name', () => {
    const view = describeMemorial({ id: 'fc20260820_1000', d: '2026-08-20', m: 1, nm: 'Alex Example' }, true, LINKS);
    expect(view.removalHref.startsWith('https://github.com/holdTheDoorHoid/placekeepers/issues/new?')).toBe(true);
    expect(view.removalHref).toContain('fc20260820_1000');
    expect(decodeURIComponent(view.removalHref)).not.toContain('Alex');
    const mail = removalHref('fc20260820_1000', { takedownEmail: 'remove@example.org', repoUrl: LINKS.repoUrl });
    expect(mail.startsWith('mailto:remove@example.org?subject=')).toBe(true);
  });

  it('puts the family blessing beside every memorial suggestion', () => {
    const state = defaultState(reg, 'field');
    const views = suggestionViews(reg, state, { sg: 'memorial_or_ghost_bike,daylighting_check,unknown_one' });
    expect(views.map((v) => [v.suggestion.id, v.memorial])).toEqual([
      ['memorial_or_ghost_bike', true],
      ['daylighting_check', false],
    ]);
    expect(views[0]!.firstStep?.step).toContain("blessing");
    state.suggestions.memorial_or_ghost_bike = false;
    expect(suggestionViews(reg, state, { sg: 'memorial_or_ghost_bike' })).toEqual([]);
  });
});

describe('what a crash and a street block say', () => {
  it('describes a crash by year, harm and who was involved', () => {
    expect(describeCrash({ y: 2023, sev: 2, m: 3 })).toEqual({
      year: '2023',
      severity: 'Someone was seriously injured',
      involved: 'Someone walking, someone cycling',
    });
    expect(describeCrash({ y: 2019, sev: 0, m: 0 }).involved).toBe('People in cars or other vehicles');
  });

  it('describes a block with its score, its facts and the why breakdown', () => {
    const state = defaultState(reg, 'analysis');
    const view = describeSegment(reg, state, {
      name: 'N BROAD ST',
      hin: 1,
      f_hin: 100,
      ksi: 2,
      f_ksi_vru: 90,
      k2: 1,
      f_fatal2: 100,
      sch: 0,
      f_school: 0,
    });
    expect(view.name).toBe('N Broad St');
    expect(view.score).toBe(Math.round((3 * 100 + 3 * 90 + 2 * 100 + 1 * 0) / 9));
    expect(view.facts[0]).toBe(strings.streets.onHin);
    expect(view.facts[1]).toContain('2 people killed or seriously injured');
    expect(view.facts[2]).toBe('1 person killed here in the last two years');
    expect(view.why?.factors.map((f) => f.id)).toEqual(['high_injury_network', 'walking_cycling_harm', 'recent_death', 'school_nearby']);
  });

  it('writes street names the way people read them', () => {
    expect(titleStreet('N BROAD ST')).toBe('N Broad St');
    expect(titleStreet('52ND ST')).toBe('52nd St');
    expect(titleStreet('W  LEHIGH AVE')).toBe('W Lehigh Ave');
    expect(capitalize('unit block of Oak St')).toBe('Unit block of Oak St');
  });
});

describe('the field view chips', () => {
  it('turns the Memorials chip on: every chip controls registry layers', () => {
    for (const chip of FIELD_CHIPS) {
      expect(chip.layers.every((id) => reg.layers.some((l) => l.id === id)), chip.id).toBe(true);
    }
    expect(FIELD_CHIPS.find((c) => c.id === 'memorials')?.layers).toEqual(['memorials']);
    expect(layer('memorials').default.field).toBe(true);
  });
});
