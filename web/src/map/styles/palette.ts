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
 * Heat vulnerability by census tract (M3.1), fifths of the city's tracts from least to most:
 * ColorBrewer Oranges, warm but never an alarm red, drawn faintly under everything else. The
 * outline marks the tracts the City rates very high.
 */
export const HEAT_BINS = ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'] as const;
export const HEAT_OPACITY = 0.5;
export const HEAT_PRIORITY_LINE = '#7f2704';

/** The City's trees (M3.1): forest green dots with a pale ring, sized by the trunk. */
export const TREE_FILL = '#3f7f2a';
export const TREE_RING = '#f4fbef';

/**
 * The floodplain (M3.1), in water blues (ColorBrewer Blues): the 1 percent annual chance
 * floodplain stronger, the 0.2 percent annual chance area lighter with a dashed edge, and the
 * floodway, the channel kept open for floods, darkest.
 */
export const FLOOD_COLORS = { high: '#2171b5', moderate: '#9ecae1', floodway: '#08519c' } as const;
export const FLOOD_LINES = { high: '#08519c', moderate: '#4292c6' } as const;
export const FLOOD_OPACITY = { high: 0.28, moderate: 0.22, floodway: 0.4 } as const;

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

/**
 * Public art (M3.2), by kind, from the Okabe and Ito palette, which people with the common kinds
 * of color blindness can tell apart: murals and wall paintings a reddish purple, sculptures and
 * statues a deep blue, mosaics a yellow, other kinds a slate gray, each with a darker ring of its
 * own so every kind reads on the light and the gray base map.
 */
export const ART_COLORS = { mural: '#cc79a7', sculpture: '#0072b2', mosaic: '#f0e442', other: '#6b7c8c' } as const;
export const ART_RINGS = { mural: '#7d3c66', sculpture: '#003d61', mosaic: '#6b6400', other: '#2f3a45' } as const;

/**
 * Walkability by block group (M3.3), from least to most walkable: ColorBrewer PuBuGn, a cool
 * teal ramp clear of the lots' yellow greens, the heat oranges and the shootings' purples, drawn
 * faintly under everything else. The EPA's four national classes use the ramp's two ends and its
 * fourth step, skipping the middle, so the classes never look like fifths.
 */
export const WALK_BINS = ['#f6eff7', '#bdc9e1', '#67a9cf', '#1c9099', '#016c59'] as const;
export const WALK_NATION_BINS = ['#f6eff7', '#bdc9e1', '#1c9099', '#016c59'] as const;
export const WALK_OPACITY = 0.5;

/**
 * People and places within walking distance (M3.3), hexagons from few to many: ColorBrewer Blues,
 * a quiet single hue that reads in grayscale, clear of the shootings' purple hexagons beside it.
 */
export const REACH_BINS = ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'] as const;
export const REACH_OPACITY = 0.5;

/**
 * Traffic stress for people on bikes (M3.3), level 1 to 4: two blues for calm streets, then an
 * orange and a deep brown for stressful ones, never an alarm red, and clear of the High Injury
 * Network's amber (#b35806), which is drawn above them. A thin white casing keeps the lighter
 * colors visible on the base map.
 */
export const STRESS_COLORS: Record<number, string> = { 1: '#2166ac', 2: '#67a9cf', 3: '#e08214', 4: '#7f3b08' };
export const STRESS_CASING = '#ffffff';

/**
 * Parking problems reported with Laser Vision (issue #37), few to many: ColorBrewer PuBu, a cool
 * blue clear of the street group's amber High Injury Network, pink street blocks and brown
 * crashes. The heat map fades in from clear; the hexagons close in use the same five steps.
 */
export const PARKING_RAMP = ['#d0d1e6', '#a6bddb', '#74a9cf', '#2b8cbe', '#045a8d'] as const;
export const PARKING_OPACITY = 0.7;
