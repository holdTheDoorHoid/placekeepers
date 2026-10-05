// Which map layers draw the places a lens ranks, and what it takes to show the lens on them
// (M2.3). Using a lens (moving a slider or choosing a preset) shows its places, so the change is
// never invisible: the transit comfort lens colors SEPTA's stops, a layer that is off by default
// and can also be colored by waits or riders. Two lenses rank the lots (violence reduction and,
// from M3.1, heat and shade), so the lots layer's coloring setting names them by id, and using
// either one colors the lots by it.

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

/**
 * The layer's setting that chooses what colors it, and the value that colors it by this lens: the
 * choice `lens` (the one lens that ranks the layer's places), or the lens's own id when the
 * choices name lenses (the lots, colored by violence reduction or heat and shade). Null when no
 * setting of the layer chooses the lens.
 */
export function lensColorSetting(layer: Layer, lens: Lens): { setting: string; value: string } | null {
  for (const s of layer.settings) {
    if (s.type !== 'choice') continue;
    const value = [lens.id, BY_LENS].find((v) => s.options.some((o) => o.value === v));
    if (value !== undefined) return { setting: s.id, value };
  }
  return null;
}

export interface LensChanges {
  /** Layers to turn on. */
  turnOn: Layer[];
  /** Coloring settings to set: layer, setting id, and the value that colors it by the lens. */
  recolor: { layer: Layer; setting: string; value: string }[];
}

/** What it takes to show the lens on the map: nothing when it already shows. */
export function lensChanges(reg: Registry, state: AppState, lens: Lens): LensChanges {
  const layers = lensLayers(reg, lens);
  const turnOn = layers.filter((l) => !state.layers.includes(l.id));
  const recolor = layers.flatMap((layer) => {
    const found = lensColorSetting(layer, lens);
    if (!found) return [];
    const value = state.settings[layer.id]?.[found.setting] ?? layer.settings.find((s) => s.id === found.setting)?.default;
    return value === found.value ? [] : [{ layer, ...found }];
  });
  return { turnOn, recolor };
}

export function lensShown(reg: Registry, state: AppState, lens: Lens): boolean {
  const { turnOn, recolor } = lensChanges(reg, state, lens);
  return turnOn.length === 0 && recolor.length === 0;
}
