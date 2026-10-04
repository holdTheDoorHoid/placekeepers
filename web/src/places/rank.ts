// Turns the parcels drawn in the current view into the places people see in the field
// view's "What you can do nearby" cards and the analysis view's ranked list: each with
// its lens score and main reason, the first suggestion that is switched on, and the first
// step of that suggestion's first legal route.
//
// Which places get which suggestion is decided by the pipeline (the `sg` tile property);
// this file only shows, hides and explains them.

import { explainScore, type ScoreExplanation } from '../map/lens.ts';
import type { Lens, Registry, Route, Suggestion } from '../registry/types.ts';
import type { AppState } from '../state/defaults.ts';

export interface PlaceInput {
  id: string;
  properties: Record<string, unknown>;
  center: [number, number];
}

export interface RankedPlace extends PlaceInput {
  /** 1 vacant lot, 2 vacant building, 0 unknown (CONTRACTS.md, parcels.k). */
  kind: number;
  /** 1 low, 2 medium, 3 high (parcels.vc). */
  confidence: number;
  ownerType: number | null;
  landcare: boolean;
  why: ScoreExplanation | null;
  /** Rounded score from 0 to 100, or null. */
  score: number | null;
  suggestions: Suggestion[];
  firstStep: { route: Route; step: string } | null;
}

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parcelLensOf(reg: Registry): Lens | null {
  return reg.lenses.find((l) => l.applies_to === 'parcel') ?? null;
}

/** Suggestions named in the place's `sg` property that exist and are switched on, in that order. */
export function placeSuggestions(reg: Registry, state: AppState, properties: Record<string, unknown>): Suggestion[] {
  const ids = typeof properties.sg === 'string' ? properties.sg.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return ids
    .map((id) => reg.suggestions.find((s) => s.id === id))
    .filter((s): s is Suggestion => !!s && state.suggestions[s.id] !== false);
}

export function describePlace(reg: Registry, state: AppState, place: PlaceInput): RankedPlace {
  const lens = parcelLensOf(reg);
  const why = lens ? explainScore(lens, state.weights[lens.id], place.properties) : null;
  const suggestions = placeSuggestions(reg, state, place.properties);
  const route = suggestions[0] ? reg.routes.find((r) => r.id === suggestions[0]!.routes[0]) : undefined;
  return {
    ...place,
    kind: int(place.properties.k) ?? 0,
    confidence: int(place.properties.vc) ?? 0,
    ownerType: int(place.properties.ot),
    landcare: int(place.properties.lc) === 1,
    why,
    score: why?.score === null || why?.score === undefined ? null : Math.round(why.score),
    suggestions,
    firstStep: route?.steps[0] ? { route, step: route.steps[0] } : null,
  };
}

/**
 * Places sorted by score, highest first. Places without a score come last. When every lens
 * weight is off nothing is ranked, so the order is simply by parcel number.
 */
export function rankPlaces(reg: Registry, state: AppState, places: PlaceInput[], limit = Infinity): RankedPlace[] {
  const described = places.map((p) => describePlace(reg, state, p));
  described.sort((a, b) => {
    const sa = a.why?.score ?? -1;
    const sb = b.why?.score ?? -1;
    return sb - sa || a.id.localeCompare(b.id);
  });
  return described.slice(0, limit);
}

export interface AreaSummary {
  lots: number;
  buildings: number;
  high: number;
  landcare: number;
}

export function summarizeArea(places: RankedPlace[]): AreaSummary {
  return {
    lots: places.filter((p) => p.kind === 1).length,
    buildings: places.filter((p) => p.kind === 2).length,
    high: places.filter((p) => p.confidence === 3).length,
    landcare: places.filter((p) => p.landcare).length,
  };
}
