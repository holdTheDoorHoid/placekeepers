// What the transit comfort lens says about a SEPTA stop (M2.3): its score and the "why" behind
// it, what riders find there from OpenStreetMap, and what neighbors can do, each suggestion with
// its first lawful step and the route's contacts and "last checked" date. Built from the tile
// properties of docs/CONTRACTS.md section 4 (`stops` in tiles/transit.pmtiles: o, om, a, sh, bn,
// li, cv, cp, hin, sg and the f_ factors); the method is in docs/TRANSIT_METHOD.md.
//
// An answer OpenStreetMap does not have yet reads "not yet surveyed", never "no", and the lens
// counts it halfway (50), so a stop no one has surveyed is never scored as missing a shelter it
// may have. Which stop gets which suggestion is decided by the pipeline (`sg`); this file only
// shows, hides and explains them.

import { routeView, type RouteView } from '../dossier/build.ts';
import { explainScore, wholeScore, type FactorExplanation, type ScoreExplanation } from '../map/lens.ts';
import { distanceMeters, firstStepFor, placeSuggestions } from '../places/rank.ts';
import type { Lens, Partner, Registry, Route, Suggestion } from '../registry/types.ts';
import type { AppState } from '../state/defaults.ts';
import { strings } from '../strings.ts';
import { osmUrl } from './amenities.ts';
import { describeStop, stopKind, type StopKind } from './describe.ts';

/** The lens that ranks stops: the first registry lens that applies to stops. */
export function stopLensOf(reg: Registry): Lens | null {
  return reg.lenses.find((l) => l.applies_to === 'stop') ?? null;
}

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** One thing riders may find at the stop: yes, no, or not yet surveyed. */
export interface StopAnswer {
  key: string;
  label: string;
  value: string;
  known: boolean;
}

export interface StopSuggestionView {
  suggestion: Suggestion;
  /** The first step of the suggestion's first route. Stop suggestions never need a landowner's permission. */
  firstStep: { route: Route; step: string } | null;
  /** Every route of the suggestion, with its steps, contacts, links and "last checked" date. */
  routes: RouteView[];
  partners: Partner[];
}

export interface StopComfortView {
  lens: Lens | null;
  why: ScoreExplanation | null;
  /** Rounded score from 0 to 100, or null (a station, or every weight off). */
  score: number | null;
  /**
   * The factor adding the most that rests on something known: an answer no one has given yet
   * counts halfway in the score, but is never called the main reason.
   */
  main: FactorExplanation | null;
  /** Factor ids whose value stands in for an answer no one has given yet. */
  unsurveyed: string[];
  /** OpenStreetMap has this stop (matched by the pipeline). */
  inOsm: boolean;
  /** What riders find, in one line: "A bench, but no shelter mapped", or "not in OpenStreetMap yet". */
  summary: string;
  answers: StopAnswer[];
  anyUnknown: boolean;
  /** The score counts an unsurveyed shelter or bench halfway. */
  halfway: boolean;
  /** How the stop was matched to OpenStreetMap, in plain words, or null. */
  matched: string | null;
  osmUrl: string | null;
  /** Shade and the High Injury Network, as plain sentences. */
  facts: string[];
  suggestions: StopSuggestionView[];
}

/** Lit is `li` here (`lt` is the last departure); the label is the one the amenities layer uses. */
const ANSWERS = [
  ['sh', 'sh'],
  ['bn', 'bn'],
  ['li', 'lt'],
] as const;

/**
 * The lens factors whose value stands in for an answer no one has given yet (the pipeline's
 * halfway value, docs/TRANSIT_METHOD.md): no shelter while the shelter is unknown and the stop is
 * not under a roof, no bench while the bench is unknown.
 */
export function unsurveyedFactors(lens: Lens | null, properties: Record<string, unknown>): string[] {
  if (!lens) return [];
  const fields: string[] = [];
  if (int(properties.sh) === null && int(properties.cv) !== 1) fields.push('f_noshelter');
  if (int(properties.bn) === null) fields.push('f_nobench');
  return lens.factors.filter((f) => fields.includes(f.field) && properties[f.field] !== undefined).map((f) => f.id);
}

/** The factor adding the most to the score, leaving out answers no one has given yet. */
export function knownMainReason(why: ScoreExplanation | null, unsurveyed: string[]): FactorExplanation | null {
  if (!why) return null;
  return why.factors.reduce<FactorExplanation | null>(
    (best, f) => (f.contribution > 0 && !unsurveyed.includes(f.id) && (!best || f.contribution > best.contribution) ? f : best),
    null,
  );
}

/** The suggestions named in the stop's `sg` that exist and are switched on, with their routes. */
export function stopSuggestionViews(reg: Registry, state: AppState, properties: Record<string, unknown>): StopSuggestionView[] {
  return placeSuggestions(reg, state, properties).map((suggestion) => ({
    suggestion,
    firstStep: firstStepFor(reg, suggestion, null).firstStep,
    routes: suggestion.routes
      .map((id) => reg.routes.find((r) => r.id === id))
      .filter((r): r is Route => !!r)
      .map(routeView),
    partners: suggestion.partners.map((id) => reg.partners.find((p) => p.id === id)).filter((p): p is Partner => !!p),
  }));
}

export function describeComfort(reg: Registry, state: AppState, properties: Record<string, unknown>): StopComfortView {
  const s = strings.stopAmenities;
  const t = strings.transit;
  const lens = stopLensOf(reg);
  const why = lens ? explainScore(lens, state.weights[lens.id], properties) : null;
  const code = int(properties.a);
  const inOsm = code !== null;

  const answers: StopAnswer[] = ANSWERS.map(([key, labelKey]) => {
    const value = int(properties[key]);
    return { key, label: s.answers[labelKey] ?? key, value: value === null ? s.unknown : value === 1 ? s.yes : s.no, known: value !== null };
  });
  // A roof over the whole stop is listed only where OpenStreetMap says so.
  const covered = int(properties.cv);
  if (covered !== null) answers.push({ key: 'cv', label: s.answers.cv ?? 'cv', value: covered === 1 ? s.yes : s.no, known: true });

  const unsurveyed = unsurveyedFactors(lens, properties);
  // The score counts an unknown answer halfway only while its factor has a weight.
  const halfway = why !== null && why.score !== null && why.factors.some((f) => unsurveyed.includes(f.id) && f.weight > 0);

  const facts: string[] = [];
  const canopy = int(properties.cp);
  if (canopy !== null) facts.push(t.canopy(canopy));
  if (int(properties.hin) === 1) facts.push(t.onHin);

  const how = int(properties.om);
  return {
    lens,
    why,
    score: wholeScore(why?.score),
    main: knownMainReason(why, unsurveyed),
    unsurveyed,
    inOsm,
    summary: inOsm ? (s.comfort[code] ?? s.comfort[0]!) : t.notInOsm,
    answers,
    anyUnknown: answers.some((a) => !a.known),
    halfway,
    matched: how === 1 ? t.matchedByNumber : how === 2 ? t.matchedByPlace : null,
    osmUrl: osmUrl(properties.o),
    facts,
    suggestions: stopSuggestionViews(reg, state, properties),
  };
}

/** A stop in "What you can do nearby": what it is, how far, its score and its first suggestion. */
export interface NearbyStop {
  id: string;
  layerId: string;
  properties: Record<string, unknown>;
  lngLat: [number, number];
  /** Meters from the point the list is sorted around. */
  distance: number;
  kind: StopKind;
  title: string;
  routes: string | null;
  why: ScoreExplanation | null;
  score: number | null;
  /** The main reason, never an answer no one has given yet. */
  main: FactorExplanation | null;
  suggestions: StopSuggestionView[];
}

export interface StopInput {
  layerId: string;
  properties: Record<string, unknown>;
  lngLat: [number, number];
}

/** The stops with a suggestion switched on, nearest to a point first. */
export function nearestStops(
  reg: Registry,
  state: AppState,
  stops: StopInput[],
  anchor: [number, number],
  limit = Infinity,
): NearbyStop[] {
  const lens = stopLensOf(reg);
  return stops
    .map((stop) => {
      const suggestions = stopSuggestionViews(reg, state, stop.properties);
      if (suggestions.length === 0) return null;
      const why = lens ? explainScore(lens, state.weights[lens.id], stop.properties) : null;
      const view = describeStop(stop.properties);
      return {
        ...stop,
        id: String(stop.properties.id ?? ''),
        distance: distanceMeters(anchor, stop.lngLat),
        kind: stopKind(stop.properties.md),
        title: view.title,
        routes: view.routes,
        why,
        score: wholeScore(why?.score),
        main: knownMainReason(why, unsurveyedFactors(lens, stop.properties)),
        suggestions,
      } satisfies NearbyStop;
    })
    .filter((stop): stop is NearbyStop => stop !== null)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, limit);
}
