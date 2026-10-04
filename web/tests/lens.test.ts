import { createPropertyExpression, latest } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../plugins/registry.ts';
import { NO_SCORE, explainScore, lensColorExpression, lensScoreExpression, type ColorRamp } from '../src/map/lens.ts';
import type { Lens } from '../src/registry/types.ts';

const reg = loadRegistry();
const violence = reg.lenses.find((l) => l.id === 'violence')!;
const defaults = Object.fromEntries(violence.factors.map((f) => [f.id, f.default_weight]));
const RAMP: ColorRamp = {
  stops: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837'],
  noData: '#bbbbbb',
  allOff: '#888888',
};

/** Evaluates a style expression the way MapLibre does, for one feature. */
function evaluate(expression: unknown, properties: Record<string, unknown>, spec: object): unknown {
  const parsed = createPropertyExpression(expression, spec as never);
  if (parsed.result !== 'success') throw new Error(JSON.stringify(parsed.value));
  return parsed.value.evaluate({ zoom: 14 } as never, { type: 'Polygon', properties } as never);
}

const scoreSpec = { type: 'number', 'property-type': 'data-driven', expression: { interpolated: false, parameters: ['zoom', 'feature'] } };

function scoreOf(lens: Lens, weights: Record<string, number>, props: Record<string, unknown>): number {
  const expression = lensScoreExpression(lens, weights);
  if (!expression) throw new Error('no expression');
  return evaluate(expression, props, scoreSpec) as number;
}

const SAMPLES: Record<string, unknown>[] = [
  { f_vacant: 100, f_shoot: 80, f_poverty: 60, f_canopy: 10 },
  { f_vacant: 0, f_shoot: 0, f_poverty: 0, f_canopy: 0 },
  { f_vacant: 37, f_shoot: 91, f_poverty: 12, f_canopy: 77 },
  { f_vacant: 55, f_poverty: 40 },
  { f_vacant: 'high', f_shoot: null, f_poverty: 70, f_canopy: 5 },
];

describe('lens score expression', () => {
  it('computes sum(weight * field) / sum(weight)', () => {
    const props = { f_vacant: 90, f_shoot: 60, f_poverty: 30, f_canopy: 0 };
    const expected = (3 * 90 + 3 * 60 + 2 * 30 + 1 * 0) / (3 + 3 + 2 + 1);
    expect(scoreOf(violence, defaults, props)).toBeCloseTo(expected, 10);
  });

  it('agrees with the "why" breakdown on every sample and weight mix', () => {
    const mixes = [defaults, { untreated_vacancy: 1, shootings_nearby: 0, poverty: 0, canopy_gap: 0 }, { untreated_vacancy: 5, shootings_nearby: 1, poverty: 4, canopy_gap: 2 }];
    for (const weights of mixes) {
      for (const props of SAMPLES) {
        const explained = explainScore(violence, weights, props);
        const fromStyle = scoreOf(violence, weights, props);
        if (explained.score === null) expect(fromStyle).toBe(NO_SCORE);
        else expect(fromStyle).toBeCloseTo(explained.score, 10);
      }
    }
  });

  it('leaves factors without data out of the average instead of counting them as zero', () => {
    // Only vacancy (weight 3) and poverty (weight 2) have data here.
    const props = { f_vacant: 55, f_poverty: 40 };
    expect(scoreOf(violence, defaults, props)).toBeCloseTo((3 * 55 + 2 * 40) / 5, 10);
    const why = explainScore(violence, defaults, props);
    expect(why.missing).toEqual(['shootings_nearby', 'canopy_gap']);
  });

  it('treats text and empty values as missing data', () => {
    const props = { f_vacant: 'high', f_shoot: null, f_poverty: 70, f_canopy: 5 };
    expect(scoreOf(violence, defaults, props)).toBeCloseTo((2 * 70 + 1 * 5) / 3, 10);
  });

  it('gives NO_SCORE when no weighted factor has data', () => {
    expect(scoreOf(violence, defaults, {})).toBe(NO_SCORE);
    expect(explainScore(violence, defaults, {}).score).toBeNull();
  });

  it('returns no expression when every weight is zero, so nothing divides by zero', () => {
    const off = { untreated_vacancy: 0, shootings_nearby: 0, poverty: 0, canopy_gap: 0 };
    expect(lensScoreExpression(violence, off)).toBeNull();
    const why = explainScore(violence, off, SAMPLES[0]!);
    expect(why.allOff).toBe(true);
    expect(why.score).toBeNull();
    expect(why.main).toBeNull();
    expect(why.factors.every((f) => f.contribution === 0)).toBe(true);
  });

  it('works with a single weighted factor (no "+" with one input)', () => {
    const one = { untreated_vacancy: 0, shootings_nearby: 4, poverty: 0, canopy_gap: 0 };
    expect(scoreOf(violence, one, { f_vacant: 10, f_shoot: 64 })).toBe(64);
  });

  it('clamps weights outside 0 to 5 and ignores weights for unknown factors', () => {
    const wild = { untreated_vacancy: 50, shootings_nearby: -3, poverty: 2.4, canopy_gap: 0, ghost: 5 };
    const props = { f_vacant: 100, f_shoot: 0, f_poverty: 50, f_canopy: 0 };
    expect(scoreOf(violence, wild, props)).toBeCloseTo((5 * 100 + 2 * 50) / 7, 10);
  });

  it('uses each factor default weight when a weight is missing', () => {
    const props = { f_vacant: 90, f_shoot: 60, f_poverty: 30, f_canopy: 0 };
    expect(scoreOf(violence, {}, props)).toBeCloseTo(scoreOf(violence, defaults, props), 10);
  });
});

describe('the "why" breakdown', () => {
  it('has contributions that sum to the score', () => {
    for (const props of SAMPLES) {
      const why = explainScore(violence, defaults, props);
      if (why.score === null) continue;
      const total = why.factors.reduce((acc, f) => acc + f.contribution, 0);
      expect(total).toBeCloseTo(why.score, 10);
    }
  });

  it('names the factor that adds the most', () => {
    const why = explainScore(violence, defaults, { f_vacant: 10, f_shoot: 95, f_poverty: 20, f_canopy: 5 });
    expect(why.main?.id).toBe('shootings_nearby');
    expect(why.main?.evidence).toBe('context');
  });
});

describe('lens color expression', () => {
  const colorSpec = latest.paint_fill['fill-color'];

  function colorOf(weights: Record<string, number>, props: Record<string, unknown>): string {
    const expression = lensColorExpression(violence, weights, RAMP);
    if (typeof expression === 'string') return expression;
    const color = evaluate(expression, props, colorSpec) as { toString(): string };
    return color.toString();
  }

  it('is a valid fill color expression from the lowest to the highest score', () => {
    const low = colorOf(defaults, { f_vacant: 0, f_shoot: 0, f_poverty: 0, f_canopy: 0 });
    const high = colorOf(defaults, { f_vacant: 100, f_shoot: 100, f_poverty: 100, f_canopy: 100 });
    expect(low).toBe('rgba(255,255,204,1)');
    expect(high).toBe('rgba(0,104,55,1)');
  });

  it('uses the no data color when no factor has data', () => {
    expect(colorOf(defaults, {})).toBe('rgba(187,187,187,1)');
  });

  it('is one flat color when every weight is zero', () => {
    expect(lensColorExpression(violence, { untreated_vacancy: 0, shootings_nearby: 0, poverty: 0, canopy_gap: 0 }, RAMP)).toBe(
      RAMP.allOff,
    );
  });
});
