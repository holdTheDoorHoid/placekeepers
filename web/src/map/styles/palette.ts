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
