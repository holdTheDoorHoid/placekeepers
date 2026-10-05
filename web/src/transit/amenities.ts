// What the details panel says about the shelter and bench at a stop someone tapped (M2.2), from
// the tile properties of `stops` in tiles/amenities.pmtiles (docs/CONTRACTS.md section 4). Every
// answer comes from OpenStreetMap; one it does not have yet reads "not yet surveyed", never "no".
// SEPTA's own stops have their own wording, in ./describe.ts.

import { strings } from '../strings.ts';

export interface AmenityAnswer {
  key: string;
  label: string;
  value: string;
  known: boolean;
  /** The answer comes from a shelter or bench mapped on its own beside the stop. */
  nearby: boolean;
}

export interface StopAmenitiesView {
  name: string | null;
  ref: string | null;
  served: string;
  c: number;
  comfort: string;
  answers: AmenityAnswer[];
  anyUnknown: boolean;
  osmUrl: string | null;
}

/** Answers StreetComplete asks at stops in the United States: always listed, known or not. */
const ALWAYS = ['sh', 'bn', 'bi', 'lt', 'tp'] as const;
/** Answers StreetComplete does not ask at stops: listed only when OpenStreetMap has them. */
const WHEN_KNOWN = ['wc', 'db', 'cv'] as const;
/** `nb` bits: 1 the shelter, 2 the bench, mapped on its own beside the stop. */
const NEARBY_BITS: Record<string, number> = { sh: 1, bn: 2 };

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : NaN;
  return Number.isInteger(n) ? n : null;
}

/** The stop's page on OpenStreetMap, from its id (n123 for a node, w123 for a way). */
export function osmUrl(id: unknown): string | null {
  const match = /^([nw])(\d+)$/.exec(String(id ?? ''));
  if (!match) return null;
  return `https://www.openstreetmap.org/${match[1] === 'n' ? 'node' : 'way'}/${match[2]}`;
}

export function describeStopAmenities(properties: Record<string, unknown>): StopAmenitiesView {
  const s = strings.stopAmenities;
  const nearby = int(properties.nb) ?? 0;
  const answers: AmenityAnswer[] = [];
  for (const key of [...ALWAYS, ...WHEN_KNOWN]) {
    const value = int(properties[key]);
    if (value === null && (WHEN_KNOWN as readonly string[]).includes(key)) continue;
    answers.push({
      key,
      label: s.answers[key] ?? key,
      value: value === null ? s.unknown : value === 1 ? s.yes : value === 2 ? s.limited : s.no,
      known: value !== null,
      nearby: value === 1 && ((NEARBY_BITS[key] ?? 0) & nearby) !== 0,
    });
  }
  const c = int(properties.c) ?? 0;
  return {
    name: text(properties.nm),
    ref: text(properties.ref),
    served: s.served[int(properties.md) ?? 1] ?? s.served[1]!,
    c,
    comfort: s.comfort[c] ?? s.comfort[0]!,
    answers,
    anyUnknown: answers.some((a) => !a.known),
    osmUrl: osmUrl(properties.id),
  };
}
