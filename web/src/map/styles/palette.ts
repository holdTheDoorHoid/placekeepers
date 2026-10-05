// Map colors. Care, not danger: nothing on the map uses alarm reds. Every ramp runs from
// light to dark in one hue family, so it reads in grayscale and for color blind visitors.
// Ramps follow ColorBrewer's YlGn and Purples schemes.

import type { ColorRamp } from '../lens.ts';

/** Lens priority for parcels, low to high. Green, because the answer is usually greening. */
export const PRIORITY_RAMP: ColorRamp = {
  stops: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837'],
  // A plain mid gray: clearly visible on the base map, and clearly not part of the ramp.
  // Every parcel looks like this until the pipeline publishes the lens factors (M1.4).
  noData: '#a9afb3',
  allOff: '#9cb59a',
};

/** Parcel outlines, darker than every fill so each lot stays distinct. */
export const PARCEL_OUTLINE = '#1f3d2b';

/** The selected place: dark blue on a white casing, distinct from every other color here. */
export const SELECTED = '#0b4f8a';
export const SELECTED_CASING = '#ffffff';

/** Shooting counts per hexagon, few to many. A quiet purple, shown under the lots. */
export const COUNT_BINS = ['#dadaeb', '#bcbddc', '#9e9ac8', '#756bb1', '#54278f'] as const;
export const COUNT_OPACITY = 0.6;

/** High Injury Network streets: amber with a white casing, visible on every base map color. */
export const HIN_COLOR = '#b35806';
export const HIN_CASING = '#ffffff';

/**
 * Street safety lens for street blocks, low to high: pink to deep magenta (ColorBrewer RdPu),
 * clear of the High Injury Network's amber, the lots' greens and the shootings' purples. Lines
 * get thicker and stronger as the score rises, so low scores stay quiet.
 */
export const STREET_RAMP: ColorRamp = {
  stops: ['#fbb4b9', '#f768a1', '#dd3497', '#ae017e', '#7a0177'],
  noData: '#a9afb3',
  allOff: '#a9afb3',
};

/** Crashes by the worst injury: pale yellow (no injury) to deep brown (someone was killed). */
export const CRASH_COLORS = ['#fff3b0', '#fec44f', '#ec7014', '#8c2d04'] as const;
export const CRASH_STROKE = '#ffffff';

/**
 * Memorials: a small soft marker, white with a muted violet gray ring and a faint glow. Quiet on
 * purpose: no red and nothing that looks like a crash.
 */
export const MEMORIAL_FILL = '#fbfaff';
export const MEMORIAL_RING = '#62597e';
export const MEMORIAL_GLOW = '#ffffff';

/** Shown under the data when the base map is missing. */
export const PLAIN_BACKGROUND = '#ecebe4';

/**
 * Bus and trolley stops (M2.2), by what OpenStreetMap says riders find there: a shelter or roof
 * in deep blue, a bench in light blue, neither in a warm amber (a gap worth care, not an alarm),
 * each with a darker outline of its own, so every kind reads at the same size. A stop not yet
 * surveyed is a hollow gray ring, so unknown never looks like missing.
 */
export const STOP_COLORS = { shelter: '#1f5c99', bench: '#8fbfe0', neither: '#e8a33d' } as const;
export const STOP_OUTLINES = { shelter: '#0b2f55', bench: '#1f5c99', neither: '#7a4a05' } as const;
export const STOP_UNKNOWN_FILL = '#ffffff';
export const STOP_UNKNOWN_RING = '#5f6870';

/**
 * Amenities from OpenStreetMap (M3.5): a small dot with a white ring, one hue per kind, clear of
 * the lots' greens, the selection blue and the stops' colors. Toilets and water, on in the field
 * view, are a deep pink and a sky blue, clear of the memorials' gray violet and the High Injury
 * Network's amber shown beside them.
 */
export const AMENITY_COLORS: Record<string, string> = {
  benches: '#8c6d31',
  picnic_tables: '#6b7f1f',
  drinking_water: '#1b8ac2',
  toilets: '#b8327a',
  bookcases: '#c0622f',
};
export const AMENITY_RING = '#ffffff';

/**
 * Public places from the City (M3.5): a larger dot with a white ring. Park drinking fountains share
 * the drinking water blue; pools, spraygrounds and sprinklers are three aquas, from deep to pale,
 * with a dark outline; one not in service this year is a hollow gray ring.
 */
export const PLACE_COLORS: Record<string, string> = {
  park_water: '#1b8ac2',
  libraries: '#3d3f7a',
  recreation_centers: '#1f7a6d',
};
export const POOL_COLORS: Record<number, string> = { 1: '#0096b8', 2: '#4cc3dc', 3: '#97dcea' };
/** Pools draw a dark outline, so the pale sprinkler blue still shows on a pale base map. */
export const POOL_RING = '#0b5468';
export const PLACE_RING = '#ffffff';
export const NOT_IN_SERVICE_RING = '#6b747c';

/**
 * Conditions reported to 311, by block (M3.5): a filled circle where a request is still open, a
 * hollow ring of the same color where every request is closed; bigger with more requests.
 */
export const CONDITION_COLORS: Record<string, string> = {
  dumping: '#8c510a',
  dark_lights: '#3a3a4a',
  graffiti: '#8e4585',
};
