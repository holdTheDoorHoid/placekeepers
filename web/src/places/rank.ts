// Turns the parcels drawn in the current view into the places people see in the field view's
// "What you can do nearby" cards, the analysis view's ranked list and its plot: each with its lens
// score and main reason, the first suggestion that is switched on, and the first lawful step for
// that suggestion.
//
// Which places get which suggestion is decided by the pipeline (the `sg` tile property), and so is
// the first step to get permission (`rt`); this file only shows, hides and explains them.

import { PERMISSION_ROUTE, PERMISSION_ROUTES, permissionCode, type PermissionCode } from '../config/permission.ts';
import { explainScore, wholeScore, type ScoreExplanation } from '../map/lens.ts';
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
  /** The first step to get permission (parcels.rt), or null when the tiles do not carry it. */
  permission: PermissionCode | null;
  why: ScoreExplanation | null;
  /** Rounded score from 0 to 100, or null. */
  score: number | null;
  suggestions: Suggestion[];
  /**
   * The first lawful step for the first suggestion: for a suggestion about using the land (such as
   * clean and green), the route to permission that fits the owner (`rt`); for one that needs no
   * permission (such as reporting an open building to 311), the suggestion's own first route.
   */
  firstStep: { route: Route; step: string } | null;
  /** The suggestion needs permission and City records name no owner to ask (`rt` 0). */
  noRoute: boolean;
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

/** True for a suggestion that needs the owner's permission to use the land. */
export function needsPermission(suggestion: Suggestion): boolean {
  return suggestion.routes.some((id) => PERMISSION_ROUTES.has(id));
}

/** The first lawful step for a suggestion at a place with this first step to get permission. */
export function firstStepFor(
  reg: Registry,
  suggestion: Suggestion | undefined,
  permission: PermissionCode | null,
): { firstStep: { route: Route; step: string } | null; noRoute: boolean } {
  if (!suggestion) return { firstStep: null, noRoute: false };
  let routeId: string | null | undefined;
  if (needsPermission(suggestion)) {
    if (permission === null) return { firstStep: null, noRoute: false };
    routeId = PERMISSION_ROUTE[permission];
    if (routeId === null) return { firstStep: null, noRoute: true };
  } else routeId = suggestion.routes[0];
  const route = reg.routes.find((r) => r.id === routeId);
  return { firstStep: route?.steps[0] ? { route, step: route.steps[0] } : null, noRoute: false };
}

export function describePlace(reg: Registry, state: AppState, place: PlaceInput): RankedPlace {
  const lens = parcelLensOf(reg);
  const why = lens ? explainScore(lens, state.weights[lens.id], place.properties) : null;
  const suggestions = placeSuggestions(reg, state, place.properties);
  const permission = permissionCode(place.properties);
  return {
    ...place,
    kind: int(place.properties.k) ?? 0,
    confidence: int(place.properties.vc) ?? 0,
    ownerType: int(place.properties.ot),
    landcare: int(place.properties.lc) === 1,
    permission,
    why,
    score: wholeScore(why?.score),
    suggestions,
    ...firstStepFor(reg, suggestions[0], permission),
  };
}

export type ScoreOrder = 'desc' | 'asc';

/**
 * Places sorted by score, highest first (or lowest first). Places without a score come last
 * either way. When every lens weight is off nothing is ranked, so the order is by parcel number.
 */
export function rankPlaces(
  reg: Registry,
  state: AppState,
  places: PlaceInput[],
  limit = Infinity,
  order: ScoreOrder = 'desc',
): RankedPlace[] {
  const described = places.map((p) => describePlace(reg, state, p));
  const sign = order === 'desc' ? 1 : -1;
  described.sort((a, b) => {
    const sa = a.why?.score ?? null;
    const sb = b.why?.score ?? null;
    if (sa === null || sb === null) return (sa === null ? 1 : 0) - (sb === null ? 1 : 0) || a.id.localeCompare(b.id);
    return sign * (sb - sa) || a.id.localeCompare(b.id);
  });
  return described.slice(0, limit);
}

/** Distance in meters between two points, close enough for a city. */
export function distanceMeters(a: [number, number], b: [number, number]): number {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (a[0] - b[0]) * 111_320 * Math.cos(lat);
  const dy = (a[1] - b[1]) * 110_574;
  return Math.hypot(dx, dy);
}

export interface NearbyPlace extends RankedPlace {
  /** Meters from the point the list is sorted around. */
  distance: number;
}

/** The places with a suggestion switched on, nearest to a point first. */
export function nearestPlaces(
  reg: Registry,
  state: AppState,
  places: PlaceInput[],
  anchor: [number, number],
  limit = Infinity,
): NearbyPlace[] {
  return places
    .map((p) => ({ ...describePlace(reg, state, p), distance: distanceMeters(anchor, p.center) }))
    .filter((p) => p.suggestions.length > 0)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, limit);
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
