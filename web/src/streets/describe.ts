// What the map says when someone opens a memorial, a crash or a street block: plain sentences
// built from the tile properties of docs/CONTRACTS.md section 4, the registry and the state.
// Kept apart from the components so the wording rules can be tested.
//
// Memorials follow docs/ETHICS.md: a name only when the curated public list has one and "show
// names" is on; the date, how the person was traveling and the place; a link to the public
// memorial page when there is one; "request removal" on every memorial; and "only with the
// family's blessing" beside every memorial suggestion. Nothing else about the person.

import { explainScore, wholeScore, type ScoreExplanation } from '../map/lens.ts';
import { placeSuggestions } from '../places/rank.ts';
import type { Lens, Registry, Route, Suggestion } from '../registry/types.ts';
import type { AppState } from '../state/defaults.ts';
import { formatDate, strings } from '../strings.ts';

/** Suggestions that are memorials: they always carry the family's blessing line. */
export const MEMORIAL_SUGGESTIONS = new Set(['memorial_or_ghost_bike']);

export type ModeKey = 'walk' | 'bike' | 'scooter' | 'motorcycle';
const MODE_BITS: [ModeKey, number][] = [
  ['walk', 1],
  ['bike', 2],
  ['scooter', 8],
  ['motorcycle', 4],
];

function int(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Every mode set in the `m` bit flags, walking first. */
export function modesOf(m: unknown): ModeKey[] {
  const bits = int(m);
  return MODE_BITS.filter(([, bit]) => (bits & bit) !== 0).map(([key]) => key);
}

/**
 * How the person was traveling, for a memorial. The Police record the units involved, not who
 * died, so when a crash involved more than one of walking, cycling, a scooter or a motorcycle the
 * memorial says only "killed in a traffic crash" rather than guess.
 */
export function memorialMode(m: unknown): ModeKey | 'other' {
  const modes = modesOf(m);
  return modes.length === 1 ? modes[0]! : 'other';
}

export function capitalize(value: string): string {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value;
}

/** "N BROAD ST" becomes "N Broad St" and "52ND ST" becomes "52nd St". */
export function titleStreet(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => (/^\d/.test(word) ? word : /^[nsew]$/.test(word) ? word.toUpperCase() : capitalize(word)))
    .join(' ');
}

export interface SuggestionView {
  suggestion: Suggestion;
  /** A memorial suggestion: shown with "only with the family's blessing". */
  memorial: boolean;
  firstStep: { route: Route; step: string } | null;
}

export function suggestionViews(reg: Registry, state: AppState, properties: Record<string, unknown>): SuggestionView[] {
  return placeSuggestions(reg, state, properties).map((suggestion) => {
    const route = reg.routes.find((r) => r.id === suggestion.routes[0]);
    return {
      suggestion,
      memorial: MEMORIAL_SUGGESTIONS.has(suggestion.id),
      firstStep: route?.steps[0] ? { route, step: route.steps[0] } : null,
    };
  });
}

export interface LinkOptions {
  /** The dedicated removal address (web/src/content/removal-email.ts), or null until it exists. */
  removalEmail: string | null;
  /** The Contact page, which says how to ask for a removal. */
  contactUrl: string;
}

/**
 * The "request removal" link: an email naming the memorial by id only, never by name. A removal
 * request is personal, so it never goes to a public form; until the owner sets up the address,
 * the link opens the Contact page, which says how to reach us.
 */
export function removalHref(id: string, options: LinkOptions): string {
  if (!options.removalEmail) return options.contactUrl;
  const subject = encodeURIComponent(strings.streets.removalSubject(id));
  const body = encodeURIComponent(strings.streets.removalBody(id));
  return `mailto:${options.removalEmail}?subject=${subject}&body=${body}`;
}

export interface MemorialView {
  id: string;
  /** The name from the public memorial list, or null (none, or names are hidden). */
  name: string | null;
  /** For example "Killed while walking on August 20, 2026." */
  sentence: string;
  place: string | null;
  /** The public memorial page, when the curated list gives one. */
  source: string | null;
  removalHref: string;
}

export function describeMemorial(properties: Record<string, unknown>, showNames: boolean, options: LinkOptions): MemorialView {
  const id = text(properties.id) ?? String(properties.id ?? '');
  const date = formatDate(text(properties.d)) ?? '';
  const killed = strings.streets.killed[memorialMode(properties.m)];
  const place = text(properties.pl);
  return {
    id,
    name: showNames ? text(properties.nm) : null,
    sentence: date ? strings.streets.killedOn(killed, date) : `${killed}.`,
    place: place ? capitalize(place) : null,
    // The source page names the person, so it follows the names setting too.
    source: showNames ? text(properties.src) : null,
    removalHref: removalHref(id, options),
  };
}

export interface CrashView {
  year: string;
  severity: string;
  involved: string;
}

export function describeCrash(properties: Record<string, unknown>): CrashView {
  const modes = modesOf(properties.m);
  const involved = modes.length ? modes.map((mode) => strings.streets.involvedModes[mode]) : [strings.streets.involvedOthers];
  return {
    year: String(int(properties.y) || ''),
    severity: strings.legend.crashSeverity[Math.min(3, Math.max(0, int(properties.sev)))]!,
    involved: capitalize(involved.join(', ')),
  };
}

export interface SegmentView {
  name: string;
  lens: Lens | null;
  /** Rounded score from 0 to 100, or null. */
  score: number | null;
  why: ScoreExplanation | null;
  facts: string[];
}

export function describeSegment(reg: Registry, state: AppState, properties: Record<string, unknown>): SegmentView {
  const lens = reg.lenses.find((l) => l.applies_to === 'segment') ?? null;
  const why = lens ? explainScore(lens, state.weights[lens.id], properties) : null;
  const s = strings.streets;
  const facts: string[] = [];
  if (int(properties.hin) === 1) facts.push(s.onHin);
  if ('ksi' in properties) facts.push(int(properties.ksi) > 0 ? s.ksi(int(properties.ksi)) : s.noKsi);
  if (int(properties.k2) > 0) facts.push(s.killed2(int(properties.k2)));
  if (int(properties.sch) === 1) facts.push(s.school);
  return {
    name: titleStreet(text(properties.name) ?? ''),
    lens,
    score: wholeScore(why?.score),
    why,
    facts,
  };
}
