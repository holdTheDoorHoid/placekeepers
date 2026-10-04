// Compact address bar encoding of the app state, so a copied link restores the same view.
//
// The state lives in the part of the address after "#", which browsers never send to a
// server. Example:
//
//   #v=a&m=14.25/39.98712/-75.15623&l=vacant_parcels,hin_2025&s=vacant_parcels.min_confidence:3
//    &w=violence.poverty:0&g=seal_abandoned_building:0&f=owner_type:3+4&p=990000012
//
//   v  view: f (field) or a (analysis)
//   m  map: zoom/latitude/longitude, plus /bearing/pitch when the map is turned or tilted
//   l  visible layers, listed in full (an empty value means none)
//   s  layer settings that differ from the registry default: layer.setting:value
//   w  lens weights that differ from the registry default: lens.factor:weight
//   g  suggestion types that differ from the default: suggestion:1 or suggestion:0
//   f  filters that differ from the default (everything): filter:value+value
//   p  the selected parcel
//
// Ids come from the registry and never change once published (docs/CONTRACTS.md), which is
// what keeps old links working. Unknown ids and bad values are ignored, never fatal.

import { FILTERS } from '../config/filters.ts';
import type { Registry, SettingValue, ViewName } from '../registry/types.ts';
import {
  DEFAULT_MAP,
  clampWeight,
  defaultFilters,
  defaultState,
  orderLayers,
  type AppState,
  type MapPosition,
} from './defaults.ts';

const VIEW_CODES: Record<ViewName, string> = { field: 'f', analysis: 'a' };
const SELECTED_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export interface EncodeOptions {
  includeView?: boolean;
  includeMap?: boolean;
  includeSelection?: boolean;
  /** "ifChanged" leaves out the layer list when it equals the view's defaults. */
  layers?: 'always' | 'ifChanged';
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function dec(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function round(n: number, digits: number): string {
  // Number() drops trailing zeros, so 12.50 becomes 12.5.
  return String(Number(n.toFixed(digits)));
}

export function encodeMap(map: MapPosition): string {
  // Five decimals is about one meter, plenty to restore a view.
  const parts = [round(map.zoom, 2), round(map.lat, 5), round(map.lng, 5)];
  if (Math.abs(map.bearing) >= 0.05 || Math.abs(map.pitch) >= 0.05) {
    parts.push(round(map.bearing, 1), round(map.pitch, 1));
  }
  return parts.join('/');
}

export function decodeMap(text: string): MapPosition | null {
  const parts = text.split('/').map(Number);
  if (parts.length !== 3 && parts.length !== 5) return null;
  if (parts.some((n) => !Number.isFinite(n))) return null;
  const [zoom, lat, lng, bearing = 0, pitch = 0] = parts as [number, number, number, number?, number?];
  if (zoom < 0 || zoom > 22 || lat < -85 || lat > 85 || lng < -180 || lng > 180) return null;
  if (pitch < 0 || pitch > 85) return null;
  const normalizedBearing = ((((bearing + 180) % 360) + 360) % 360) - 180;
  return { zoom, lat, lng, bearing: normalizedBearing, pitch };
}

function encodeSettingValue(value: SettingValue): string {
  if (typeof value === 'boolean') return value ? '1' : '0';
  return enc(String(value));
}

export function encodeState(reg: Registry, state: AppState, options: EncodeOptions = {}): string {
  const { includeView = true, includeMap = true, includeSelection = true, layers = 'always' } = options;
  const defaults = defaultState(reg, state.view);
  const params: string[] = [];

  if (includeView) params.push(`v=${VIEW_CODES[state.view]}`);
  if (includeMap) params.push(`m=${encodeMap(state.map)}`);
  const visible = orderLayers(reg, state.layers);
  if (layers === 'always' || visible.join(',') !== defaults.layers.join(',')) params.push(`l=${visible.join(',')}`);

  const settings: string[] = [];
  for (const layer of reg.layers) {
    for (const setting of layer.settings) {
      const value = state.settings[layer.id]?.[setting.id];
      if (value === undefined || value === defaults.settings[layer.id]?.[setting.id]) continue;
      settings.push(`${layer.id}.${setting.id}:${encodeSettingValue(value)}`);
    }
  }
  if (settings.length) params.push(`s=${settings.join(',')}`);

  const weights: string[] = [];
  for (const lens of reg.lenses) {
    for (const factor of lens.factors) {
      const w = state.weights[lens.id]?.[factor.id];
      if (w === undefined || clampWeight(w) === factor.default_weight) continue;
      weights.push(`${lens.id}.${factor.id}:${clampWeight(w)}`);
    }
  }
  if (weights.length) params.push(`w=${weights.join(',')}`);

  const suggestions: string[] = [];
  for (const s of reg.suggestions) {
    const on = state.suggestions[s.id];
    if (on === undefined || on === s.default_on) continue;
    suggestions.push(`${s.id}:${on ? 1 : 0}`);
  }
  if (suggestions.length) params.push(`g=${suggestions.join(',')}`);

  const filters: string[] = [];
  const filterDefaults = defaultFilters();
  for (const filter of FILTERS) {
    const chosen = state.filters[filter.id];
    if (!chosen) continue;
    const ordered = filter.options.map((o) => o.value).filter((v) => chosen.includes(v));
    const all = filterDefaults[filter.id] ?? [];
    if (ordered.length === all.length) continue;
    filters.push(`${filter.id}:${ordered.map(enc).join('+')}`);
  }
  if (filters.length) params.push(`f=${filters.join(',')}`);

  if (includeSelection && state.selected && SELECTED_PATTERN.test(state.selected)) {
    params.push(`p=${state.selected}`);
  }
  return params.join('&');
}

/** Splits "a.b:c" into ["a", "b", "c"]; the value may contain dots. */
function splitItem(item: string): [string, string, string] | null {
  const colon = item.indexOf(':');
  if (colon < 0) return null;
  const key = item.slice(0, colon);
  const dot = key.indexOf('.');
  if (dot < 0) return null;
  return [key.slice(0, dot), key.slice(dot + 1), item.slice(colon + 1)];
}

function parseParams(text: string): Map<string, string> {
  const params = new Map<string, string>();
  const body = text.startsWith('#') ? text.slice(1) : text;
  for (const part of body.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    params.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return params;
}

export interface DecodeResult {
  state: AppState;
  /** True when the text held at least one state parameter. */
  found: boolean;
  /** True when the text named a view. */
  hasView: boolean;
}

/**
 * Reads state from the text after "#". Anything missing comes from the registry defaults
 * for the view (the given fallback view when the text names none).
 */
export function decodeState(reg: Registry, text: string, fallbackView: ViewName, fallbackMap: MapPosition = DEFAULT_MAP): DecodeResult {
  const params = parseParams(text);
  const viewCode = params.get('v');
  const view = (Object.keys(VIEW_CODES) as ViewName[]).find((v) => VIEW_CODES[v] === viewCode);
  const state = defaultState(reg, view ?? fallbackView, fallbackMap);
  const known = ['v', 'm', 'l', 's', 'w', 'g', 'f', 'p'];
  const found = known.some((k) => params.has(k));

  const map = params.get('m');
  if (map !== undefined) state.map = decodeMap(map) ?? state.map;

  const layers = params.get('l');
  if (layers !== undefined) state.layers = orderLayers(reg, layers.split(',').filter(Boolean));

  for (const item of (params.get('s') ?? '').split(',')) {
    const parts = splitItem(item);
    if (!parts) continue;
    const [layerId, settingId, rawValue] = parts;
    const setting = reg.layers.find((l) => l.id === layerId)?.settings.find((s) => s.id === settingId);
    const value = dec(rawValue);
    if (!setting || value === null) continue;
    const layerSettings = (state.settings[layerId] ??= {});
    if (setting.type === 'toggle') {
      if (value === '1' || value === '0') layerSettings[settingId] = value === '1';
    } else if (setting.type === 'choice') {
      if (setting.options.some((o) => o.value === value)) layerSettings[settingId] = value;
    } else {
      const n = Number(value);
      if (value.trim() !== '' && Number.isFinite(n)) layerSettings[settingId] = Math.min(setting.max, Math.max(setting.min, n));
    }
  }

  for (const item of (params.get('w') ?? '').split(',')) {
    const parts = splitItem(item);
    if (!parts) continue;
    const [lensId, factorId, rawValue] = parts;
    const lens = reg.lenses.find((l) => l.id === lensId);
    if (!lens?.factors.some((f) => f.id === factorId) || rawValue === '') continue;
    (state.weights[lensId] ??= {})[factorId] = clampWeight(rawValue);
  }

  for (const item of (params.get('g') ?? '').split(',')) {
    const colon = item.indexOf(':');
    if (colon < 0) continue;
    const id = item.slice(0, colon);
    const value = item.slice(colon + 1);
    if (reg.suggestions.some((s) => s.id === id) && (value === '1' || value === '0')) {
      state.suggestions[id] = value === '1';
    }
  }

  for (const item of (params.get('f') ?? '').split(',')) {
    const colon = item.indexOf(':');
    if (colon < 0) continue;
    const filter = FILTERS.find((f) => f.id === item.slice(0, colon));
    if (!filter) continue;
    const rawValues = item.slice(colon + 1);
    const values = rawValues === '' ? [] : rawValues.split('+').map(dec);
    state.filters[filter.id] = filter.options.map((o) => o.value).filter((v) => values.includes(v));
  }

  const selected = params.get('p');
  if (selected && SELECTED_PATTERN.test(selected)) state.selected = selected;

  return { state, found, hasView: view !== undefined };
}
