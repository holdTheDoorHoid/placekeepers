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

/** Shown under the data when the base map is missing. */
export const PLAIN_BACKGROUND = '#ecebe4';
