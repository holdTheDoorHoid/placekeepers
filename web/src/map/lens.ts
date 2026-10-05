// Lens scores, computed inside the map style so moving a slider recolors the map at once,
// without reloading any data.
//
// The contract (docs/CONTRACTS.md, lenses) defines the score as sum(weight * field) / sum(weight)
// over the lens factors, where each field is a 0 to 100 citywide percentile. A factor whose
// field is missing for a place is left out of that place's average (both the top and the
// bottom of the fraction), so missing data never counts as zero need. The same rule is
// implemented twice: once as a MapLibre expression (lensScoreExpression) and once in plain
// TypeScript (explainScore) for the "why" breakdown. tests/lens.test.ts checks they agree.

import type { ExpressionSpecification } from 'maplibre-gl';
import type { Lens, LensFactor } from '../registry/types.ts';
import { clampWeight } from '../state/defaults.ts';

/** The score a place gets when none of the weighted factors has data for it. */
export const NO_SCORE = -1;

export interface WeightedFactor {
  factor: LensFactor;
  weight: number;
}

/** Factors with a weight above zero, in registry order. */
export function activeFactors(lens: Lens, weights: Record<string, number> | undefined): WeightedFactor[] {
  return lens.factors
    .map((factor) => ({ factor, weight: clampWeight(weights?.[factor.id] ?? factor.default_weight) }))
    .filter((f) => f.weight > 0);
}

function sum(terms: ExpressionSpecification[]): ExpressionSpecification {
  // MapLibre's "+" needs at least two inputs.
  return terms.length === 1 ? terms[0]! : (['+', ...terms] as ExpressionSpecification);
}

function hasNumber(value: ExpressionSpecification | number): ExpressionSpecification {
  return ['==', ['typeof', value], 'number'];
}

/**
 * For a lens whose features do not carry every factor themselves (decision D1: SEPTA's stops get
 * OpenStreetMap's answers in the browser, src/transit/answers.ts).
 */
export interface LensExpressionOptions {
  /** An expression (or a number) giving a factor's value, by field, instead of the feature's property. */
  values?: Record<string, ExpressionSpecification | number>;
  /** Only features where this holds are scored; the rest get NO_SCORE. */
  when?: ExpressionSpecification;
}

/**
 * A MapLibre expression for the lens score of a feature, from 0 to 100, or NO_SCORE when
 * none of the weighted factors has data. Returns null when every weight is zero, because
 * then there is nothing to rank by.
 */
export function lensScoreExpression(
  lens: Lens,
  weights: Record<string, number> | undefined,
  options: LensExpressionOptions = {},
): ExpressionSpecification | null {
  const factors = activeFactors(lens, weights);
  if (factors.length === 0) return null;
  const value = (field: string): ExpressionSpecification | number => options.values?.[field] ?? ['get', field];
  const numerator = sum(
    factors.map(({ factor, weight }) => ['case', hasNumber(value(factor.field)), ['*', weight, value(factor.field)], 0] as ExpressionSpecification),
  );
  const denominator = sum(
    factors.map(({ factor, weight }) => ['case', hasNumber(value(factor.field)), weight, 0] as ExpressionSpecification),
  );
  const score: ExpressionSpecification = [
    'let',
    'pk_num',
    numerator,
    'pk_den',
    denominator,
    ['case', ['==', ['var', 'pk_den'], 0], NO_SCORE, ['/', ['var', 'pk_num'], ['var', 'pk_den']]],
  ];
  return options.when ? ['case', options.when, score, NO_SCORE] : score;
}

export interface ColorRamp {
  /** Colors for scores 0, 25, 50, 75 and 100. */
  stops: readonly string[];
  /** Places with no score. */
  noData: string;
  /** Every weight is zero. */
  allOff: string;
}

/** A color for each feature from its lens score, or one flat color when every weight is zero. */
export function lensColorExpression(
  lens: Lens,
  weights: Record<string, number> | undefined,
  ramp: ColorRamp,
  options: LensExpressionOptions = {},
): ExpressionSpecification | string {
  const score = lensScoreExpression(lens, weights, options);
  if (!score) return ramp.allOff;
  const step = 100 / (ramp.stops.length - 1);
  const stops = ramp.stops.flatMap((color, i) => [Math.round(i * step), color]);
  return [
    'let',
    'pk_score',
    score,
    [
      'case',
      ['<', ['var', 'pk_score'], 0],
      ramp.noData,
      ['interpolate', ['linear'], ['var', 'pk_score'], ...stops] as unknown as ExpressionSpecification,
    ],
  ];
}

export interface FactorExplanation {
  id: string;
  label: string;
  evidence: LensFactor['evidence'];
  explain: string;
  weight: number;
  /** The 0 to 100 percentile, or null when the place has no data for it. */
  value: number | null;
  /** How many points of the score this factor adds. Contributions sum to the score. */
  contribution: number;
}

export interface ScoreExplanation {
  /** 0 to 100, or null when no weighted factor has data (or every weight is zero). */
  score: number | null;
  allOff: boolean;
  factors: FactorExplanation[];
  /** The factor adding the most, if any. */
  main: FactorExplanation | null;
  /** Weighted factors with no data for this place. */
  missing: string[];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The "why" breakdown: each factor's value, weight and share of the score. */
export function explainScore(
  lens: Lens,
  weights: Record<string, number> | undefined,
  properties: Record<string, unknown>,
): ScoreExplanation {
  const rows = lens.factors.map((factor) => ({
    factor,
    weight: clampWeight(weights?.[factor.id] ?? factor.default_weight),
    value: numberOrNull(properties[factor.field]),
  }));
  const counted = rows.filter((r) => r.weight > 0 && r.value !== null);
  const denominator = counted.reduce((acc, r) => acc + r.weight, 0);
  const numerator = counted.reduce((acc, r) => acc + r.weight * (r.value as number), 0);
  const factors: FactorExplanation[] = rows.map(({ factor, weight, value }) => ({
    id: factor.id,
    label: factor.label,
    evidence: factor.evidence,
    explain: factor.explain,
    weight,
    value,
    contribution: denominator > 0 && weight > 0 && value !== null ? (weight * value) / denominator : 0,
  }));
  const main = factors.reduce<FactorExplanation | null>(
    (best, f) => (f.contribution > 0 && (!best || f.contribution > best.contribution) ? f : best),
    null,
  );
  return {
    score: denominator > 0 ? numerator / denominator : null,
    allOff: rows.every((r) => r.weight === 0),
    factors,
    main,
    missing: rows.filter((r) => r.weight > 0 && r.value === null).map((r) => r.factor.id),
  };
}

/**
 * Each factor's contribution in tenths of a point, for display, rounded so that they add up
 * exactly to the displayed score (largest remainder rounding). Rounding each one on its own
 * could leave the column a tenth away from the total. Returns the displayed score too.
 */
/**
 * The whole number a card, the ranked list or the plot shows for a score: the shown tenth
 * rounded, so it agrees with the breakdown on the lot page (57.46 shows there as 57.5, so here
 * as 58, not 57).
 */
export function wholeScore(score: number | null | undefined): number | null {
  return score === null || score === undefined ? null : Math.round(Math.round(score * 10) / 10);
}

export function displayedBreakdown(why: ScoreExplanation): { contributions: number[]; score: number | null } {
  if (why.score === null) return { contributions: why.factors.map(() => 0), score: null };
  const tenths = why.factors.map((f) => f.contribution * 10);
  const floors = tenths.map((t) => Math.floor(t + 1e-9));
  const target = Math.round(why.score * 10);
  let left = target - floors.reduce((a, b) => a + b, 0);
  const order = tenths.map((t, i) => ({ i, rest: t - floors[i]! })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (why.factors[i]!.contribution <= 0) continue;
    floors[i]! += 1;
    left -= 1;
  }
  return { contributions: floors.map((f) => f / 10), score: target / 10 };
}
