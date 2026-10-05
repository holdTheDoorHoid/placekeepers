// Which map layers draw the places a lens ranks, and what it takes to show the lens on them
// (M2.3). Using a lens (moving a slider or choosing a preset) shows its places, so the change is
// never invisible: the transit comfort lens colors SEPTA's stops, a layer that is off by default
// and can also be colored by waits or riders.

import type { Lens, Layer, Registry } from '../registry/types.ts';
import type { AppState } from '../state/defaults.ts';
import { STYLES, styleFor } from './styles/index.ts';
import type { StyleModule } from './styles/types.ts';

/** The style that draws each kind of place a lens can rank. */
const LENS_STYLES: Record<string, StyleModule> = {
  parcel: STYLES.vacant_parcels,
  segment: STYLES.street_segments,
  stop: STYLES.transit_stops,
};

/** The value of a coloring setting that colors a layer by its lens. */
export const BY_LENS = 'lens';

/** The registry layers that draw the places this lens ranks. */
export function lensLayers(reg: Registry, lens: Lens): Layer[] {
  const style = LENS_STYLES[lens.applies_to];
  return style ? reg.layers.filter((l) => styleFor(l) === style) : [];
}

/** The layer's setting that chooses what colors it, when one of its choices is the lens. */
export function lensColorSetting(layer: Layer): string | null {
  const setting = layer.settings.find((s) => s.type === 'choice' && s.options.some((o) => o.value === BY_LENS));
  return setting?.id ?? null;
}

export interface LensChanges {
  /** Layers to turn on. */
  turnOn: Layer[];
  /** Coloring settings to set to the lens: layer id and setting id. */
  recolor: { layer: Layer; setting: string }[];
}

/** What it takes to show the lens on the map: nothing when it already shows. */
export function lensChanges(reg: Registry, state: AppState, lens: Lens): LensChanges {
  const layers = lensLayers(reg, lens);
  const turnOn = layers.filter((l) => !state.layers.includes(l.id));
  const recolor = layers.flatMap((layer) => {
    const setting = lensColorSetting(layer);
    if (!setting) return [];
    const value = state.settings[layer.id]?.[setting] ?? layer.settings.find((s) => s.id === setting)?.default;
    return value === BY_LENS ? [] : [{ layer, setting }];
  });
  return { turnOn, recolor };
}

export function lensShown(reg: Registry, state: AppState, lens: Lens): boolean {
  const { turnOn, recolor } = lensChanges(reg, state, lens);
  return turnOn.length === 0 && recolor.length === 0;
}
