// Browser storage for personal defaults. The github.io origin is shared with the owner's
// other sites, so every key starts with "placekeepers:v1:". Storage can be missing, full,
// or blocked (private windows, strict settings), so every access is wrapped and failures
// simply mean nothing is remembered.

export const STORAGE_PREFIX = 'placekeepers:v1:';

/** The saved settings, in the same compact form as the address bar (without map or selection). */
export const PREFS_KEY = 'prefs';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function storageKey(name: string): string {
  return STORAGE_PREFIX + name;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readItem(name: string, store: KeyValueStore | null = defaultStore()): string | null {
  if (!store) return null;
  try {
    return store.getItem(storageKey(name));
  } catch {
    return null;
  }
}

export function writeItem(name: string, value: string, store: KeyValueStore | null = defaultStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(storageKey(name), value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(name: string, store: KeyValueStore | null = defaultStore()): boolean {
  if (!store) return false;
  try {
    store.removeItem(storageKey(name));
    return true;
  } catch {
    return false;
  }
}
