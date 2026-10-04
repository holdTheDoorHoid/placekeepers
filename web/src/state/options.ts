// App wide options from registry/options.yaml, such as "Fetch live City data". Options are
// personal: they are kept only in this browser (under "placekeepers:v1:options") and are never put
// in a shared link, so opening someone's link can never turn on something you turned off.

import type { AppOption, Registry, SettingValue } from '../registry/types.ts';
import { readItem, removeItem, writeItem, type KeyValueStore } from './storage.ts';

export const OPTIONS_KEY = 'options';

/** The option that lets the browser ask the City's servers for live data. */
export const LIVE_CITY_DATA = 'live_city_data';

export type OptionValues = Record<string, SettingValue>;

export function defaultOptions(reg: Registry): OptionValues {
  return Object.fromEntries(reg.options.map((o) => [o.id, o.default]));
}

function validValue(option: AppOption, value: unknown): SettingValue | undefined {
  if (option.type === 'toggle') return typeof value === 'boolean' ? value : undefined;
  if (option.type === 'choice') return typeof value === 'string' && option.options.some((o) => o.value === value) ? value : undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.min(option.max, Math.max(option.min, value));
  return undefined;
}

/** The saved options, or the defaults for any that are missing or unreadable. */
export function decodeOptions(reg: Registry, text: string | null): OptionValues {
  const values = defaultOptions(reg);
  if (!text) return values;
  let saved: unknown;
  try {
    saved = JSON.parse(text);
  } catch {
    return values;
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return values;
  for (const option of reg.options) {
    const value = validValue(option, (saved as Record<string, unknown>)[option.id]);
    if (value !== undefined) values[option.id] = value;
  }
  return values;
}

/** What to save: only options that differ from their defaults, or null when none do. */
export function encodeOptions(reg: Registry, values: OptionValues): string | null {
  const changed: OptionValues = {};
  for (const option of reg.options) {
    const value = values[option.id];
    if (value !== undefined && value !== option.default) changed[option.id] = value;
  }
  return Object.keys(changed).length ? JSON.stringify(changed) : null;
}

export function readOptions(reg: Registry, store?: KeyValueStore | null): OptionValues {
  return decodeOptions(reg, store === undefined ? readItem(OPTIONS_KEY) : readItem(OPTIONS_KEY, store));
}

export function saveOptions(reg: Registry, values: OptionValues, store?: KeyValueStore | null): void {
  const text = encodeOptions(reg, values);
  if (store === undefined) {
    if (text) writeItem(OPTIONS_KEY, text);
    else removeItem(OPTIONS_KEY);
  } else if (text) writeItem(OPTIONS_KEY, text, store);
  else removeItem(OPTIONS_KEY, store);
}
