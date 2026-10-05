// The app state and its defaults. Both views share one state; only the layer defaults
// differ by view (each registry layer says whether it starts on in the field view and in
// the analysis view). Settings, lens weights and suggestions have one default each.

import { FILTERS } from '../config/filters.ts';
import {
  MAX_WEIGHT,
  type Layer,
  type Lens,
  type Registry,
  type SettingValue,
  type ViewName,
} from '../registry/types.ts';

export interface MapPosition {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

/** layer id, then setting id, then value */
export type LayerSettings = Record<string, Record<string, SettingValue>>;
/** lens id, then factor id, then weight from 0 to 5 */
export type LensWeights = Record<string, Record<string, number>>;

export interface AppState {
  view: ViewName;
  map: MapPosition;
  /** Visible layer ids, always in registry order. */
  layers: string[];
  settings: LayerSettings;
  weights: LensWeights;
  /** Suggestion id to shown or hidden. */
  suggestions: Record<string, boolean>;
  /** Filter id to the selected option values. Every value selected means no filtering. */
  filters: Record<string, string[]>;
  /** OPA account number of the selected parcel. */
  selected: string | null;
}

/** Philadelphia, framed so the whole city fits on a laptop screen. */
export const DEFAULT_MAP: MapPosition = { lng: -75.135, lat: 40.0, zoom: 10.6, bearing: 0, pitch: 0 };

/** The map stays near the city; the base map extract covers a little more than this. */
export const PHILLY_BOUNDS: [[number, number], [number, number]] = [
  [-75.32, 39.84],
  [-74.93, 40.16],
];

/** Screens narrower than this start in the field view. */
export const FIELD_VIEW_MAX_WIDTH = 768;
/** Touch screens shorter than this (a phone turned sideways) start in the field view too. */
export const FIELD_VIEW_MAX_HEIGHT = 500;

/**
 * The view that suits a screen: the field view on phones, held either way up, and the analysis
 * view on larger screens. A short window on a computer (no touch) keeps the analysis view.
 */
export function autoView(width: number, height = Infinity, touch = false): ViewName {
  return width < FIELD_VIEW_MAX_WIDTH || (touch && height < FIELD_VIEW_MAX_HEIGHT) ? 'field' : 'analysis';
}

/**
 * The base map (style `basemap`): a layer like the others, except in links, where it is on unless
 * the link says otherwise, because links made before it had a switch never list it (src/state/url.ts).
 */
export function isBaseLayer(layer: Layer): boolean {
  return layer.style === 'basemap';
}

export function defaultLayers(reg: Registry, view: ViewName): string[] {
  return reg.layers.filter((l) => l.default[view]).map((l) => l.id);
}

export function defaultSettings(reg: Registry): LayerSettings {
  const out: LayerSettings = {};
  for (const layer of reg.layers) {
    out[layer.id] = Object.fromEntries(layer.settings.map((s) => [s.id, s.default]));
  }
  return out;
}

export function defaultLensWeights(lens: Lens): Record<string, number> {
  return Object.fromEntries(lens.factors.map((f) => [f.id, f.default_weight]));
}

export function defaultWeights(reg: Registry): LensWeights {
  return Object.fromEntries(reg.lenses.map((lens) => [lens.id, defaultLensWeights(lens)]));
}

export function defaultSuggestions(reg: Registry): Record<string, boolean> {
  return Object.fromEntries(reg.suggestions.map((s) => [s.id, s.default_on]));
}

export function defaultFilters(): Record<string, string[]> {
  return Object.fromEntries(FILTERS.map((f) => [f.id, f.options.map((o) => o.value)]));
}

export function defaultState(reg: Registry, view: ViewName, map: MapPosition = DEFAULT_MAP): AppState {
  return {
    view,
    map: { ...map },
    layers: defaultLayers(reg, view),
    settings: defaultSettings(reg),
    weights: defaultWeights(reg),
    suggestions: defaultSuggestions(reg),
    filters: defaultFilters(),
    selected: null,
  };
}

/** Known layer ids only, without repeats, in registry order. */
export function orderLayers(reg: Registry, ids: Iterable<string>): string[] {
  const wanted = new Set(ids);
  return reg.layers.filter((l) => wanted.has(l.id)).map((l) => l.id);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * Which layers to show after switching views. If the layers are still the old view's
 * defaults, the person has not chosen any, so the new view's defaults apply. If they
 * changed anything, their choice is kept.
 */
export function layersAfterViewSwitch(reg: Registry, layers: string[], from: ViewName, to: ViewName): string[] {
  if (from === to) return layers;
  return sameSet(layers, defaultLayers(reg, from)) ? defaultLayers(reg, to) : layers;
}

/** Weights as whole numbers from 0 to 5. Anything unreadable counts as off. */
export function clampWeight(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_WEIGHT, Math.max(0, Math.round(n)));
}

/** The weights a preset sets. Factors the preset does not mention are turned off. */
export function presetWeights(lens: Lens, presetId: string): Record<string, number> | null {
  const preset = lens.presets.find((p) => p.id === presetId);
  if (!preset) return null;
  return Object.fromEntries(lens.factors.map((f) => [f.id, clampWeight(preset.weights[f.id] ?? 0)]));
}

/** The preset whose weights match the current ones exactly, if any. */
export function matchingPreset(lens: Lens, weights: Record<string, number> | undefined): string | null {
  if (!weights) return null;
  for (const preset of lens.presets) {
    const target = presetWeights(lens, preset.id);
    if (target && lens.factors.every((f) => clampWeight(weights[f.id]) === target[f.id])) return preset.id;
  }
  return null;
}

/** A deep copy that is safe to hand to code outside Svelte's reactivity. */
export function cloneState(state: AppState): AppState {
  return structuredClone(state);
}
