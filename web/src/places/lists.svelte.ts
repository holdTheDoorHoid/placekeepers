// Saved lists of places, kept only in this browser (docs/DESIGN.md section 8.3, docs/ETHICS.md
// "Privacy"): no accounts, nothing sent anywhere. A list moves to another device, or to someone
// else, as a file: its GeoJSON or CSV export, which the import reads back.
//
// Browser storage can be missing, full or blocked (private windows, strict settings). Every read
// and write goes through src/state/storage.ts, which never throws; when storage fails, lists still
// work for this visit, and `persistent` turns false so the page can say so.

import { isOpaAccount } from '../dossier/opa.ts';
import { readItem, writeItem, type KeyValueStore } from '../state/storage.ts';
import { strings } from '../strings.ts';

/** Under "placekeepers:v1:lists". */
export const LISTS_KEY = 'lists';
export const LISTS_VERSION = 1;
export const MAX_LISTS = 20;
/** The most places a list holds, the same as the export limit. */
export const MAX_LIST_PLACES = 500;
const MAX_NAME = 80;

export interface SavedPlace {
  /** The OPA account number, nine digits. */
  id: string;
  address: string | null;
  /** A point on the parcel, when known. */
  center: [number, number] | null;
  /**
   * The map's tile properties when the place was added (kind, confidence, owner type, LandCare,
   * first step, suggestions and lens factors), so a list can be scored and exported later.
   */
  properties: Record<string, number | string> | null;
}

export interface SavedList {
  id: string;
  name: string;
  /** When the list was made, as an ISO timestamp. */
  created: string;
  places: SavedPlace[];
}

/** The tile properties worth keeping with a saved place. */
const KEPT = new Set(['k', 'vc', 'ot', 'lc', 'rt', 'sg']);

export function keptProperties(properties: Record<string, unknown> | null | undefined): Record<string, number | string> | null {
  if (!properties) return null;
  const out: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!(KEPT.has(key) || /^f_[a-z0-9_]+$/.test(key))) continue;
    if ((typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 200)) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

export function cleanName(name: unknown, fallback: string): string {
  const text = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
  return text || fallback;
}

function readCenter(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [lng, lat] = v;
  if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -76 || lng > -74.5 || lat < 39.5 || lat > 40.5) return null;
  return [lng, lat];
}

export function readPlace(v: unknown): SavedPlace | null {
  if (!v || typeof v !== 'object') return null;
  const raw = v as Record<string, unknown>;
  if (!isOpaAccount(raw.id)) return null;
  const address = typeof raw.address === 'string' && raw.address.trim() ? raw.address.trim().slice(0, 200) : null;
  const properties = raw.properties && typeof raw.properties === 'object' ? keptProperties(raw.properties as Record<string, unknown>) : null;
  return { id: raw.id, address, center: readCenter(raw.center), properties };
}

/** The lists saved in this browser, read forgivingly: anything unreadable is left out. */
export function parseLists(text: string | null): { lists: SavedList[]; active: string | null } {
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!json || typeof json !== 'object' || (json as { version?: unknown }).version !== LISTS_VERSION) return { lists: [], active: null };
  const raw = json as { lists?: unknown; active?: unknown };
  const lists: SavedList[] = [];
  for (const item of Array.isArray(raw.lists) ? raw.lists.slice(0, MAX_LISTS) : []) {
    if (!item || typeof item !== 'object') continue;
    const l = item as Record<string, unknown>;
    if (typeof l.id !== 'string' || !/^[a-z0-9]{1,24}$/.test(l.id) || lists.some((x) => x.id === l.id)) continue;
    const places: SavedPlace[] = [];
    for (const p of Array.isArray(l.places) ? l.places : []) {
      const place = readPlace(p);
      if (place && !places.some((x) => x.id === place.id) && places.length < MAX_LIST_PLACES) places.push(place);
    }
    lists.push({
      id: l.id,
      name: cleanName(l.name, strings.lists.untitled),
      created: typeof l.created === 'string' && !Number.isNaN(Date.parse(l.created)) ? l.created : new Date(0).toISOString(),
      places,
    });
  }
  const active = typeof raw.active === 'string' && lists.some((l) => l.id === raw.active) ? raw.active : (lists[0]?.id ?? null);
  return { lists, active };
}

export function serializeLists(lists: SavedList[], active: string | null): string {
  return JSON.stringify({ version: LISTS_VERSION, active, lists });
}

export type AddResult = 'added' | 'already' | 'full';

export class ListStore {
  lists = $state<SavedList[]>([]);
  activeId = $state<string | null>(null);
  /** False when this browser did not keep the last change (storage blocked or full). */
  persistent = $state(true);
  private readonly storage: KeyValueStore | null | undefined;
  private counter = 0;

  /** `storage` is for tests; the page uses the browser's own storage. */
  constructor(storage?: KeyValueStore | null) {
    this.storage = storage;
    const saved = parseLists(storage === undefined ? readItem(LISTS_KEY) : readItem(LISTS_KEY, storage));
    this.lists = saved.lists;
    this.activeId = saved.active;
  }

  get active(): SavedList | null {
    return this.lists.find((l) => l.id === this.activeId) ?? null;
  }

  /** True when the place is on the list in use. */
  has(id: string): boolean {
    return this.active?.places.some((p) => p.id === id) ?? false;
  }

  private newId(): string {
    this.counter += 1;
    return `${Date.now().toString(36)}${this.counter.toString(36)}`.slice(-24);
  }

  private save(): void {
    const text = serializeLists($state.snapshot(this.lists), this.activeId);
    this.persistent = this.storage === undefined ? writeItem(LISTS_KEY, text) : writeItem(LISTS_KEY, text, this.storage);
  }

  /** Makes a new list and puts it in use. Null when there are too many lists already. */
  create(name: string, places: SavedPlace[] = []): SavedList | null {
    if (this.lists.length >= MAX_LISTS) return null;
    const list: SavedList = {
      id: this.newId(),
      name: cleanName(name, strings.lists.untitled),
      created: new Date().toISOString(),
      places: places.slice(0, MAX_LIST_PLACES),
    };
    this.lists.push(list);
    this.activeId = list.id;
    this.save();
    return this.active;
  }

  rename(listId: string, name: string): void {
    const list = this.lists.find((l) => l.id === listId);
    if (!list) return;
    list.name = cleanName(name, list.name);
    this.save();
  }

  delete(listId: string): void {
    this.lists = this.lists.filter((l) => l.id !== listId);
    if (this.activeId === listId) this.activeId = this.lists[0]?.id ?? null;
    this.save();
  }

  use(listId: string): void {
    if (!this.lists.some((l) => l.id === listId)) return;
    this.activeId = listId;
    this.save();
  }

  /** Adds a place to the list in use, making a first list when there is none. */
  add(place: SavedPlace, firstListName: string): AddResult {
    const list = this.active ?? this.create(firstListName);
    if (!list) return 'full';
    if (list.places.some((p) => p.id === place.id)) return 'already';
    if (list.places.length >= MAX_LIST_PLACES) return 'full';
    list.places.push(place);
    this.save();
    return 'added';
  }

  removePlace(id: string, listId: string | null = this.activeId): void {
    const list = this.lists.find((l) => l.id === listId);
    if (!list) return;
    list.places = list.places.filter((p) => p.id !== id);
    this.save();
  }

  /** Fills in what a saved place was missing, such as its address once it is known. */
  update(id: string, patch: Partial<Omit<SavedPlace, 'id'>>): void {
    let changed = false;
    for (const list of this.lists) {
      for (const place of list.places) {
        if (place.id !== id) continue;
        if (patch.address && !place.address) {
          place.address = patch.address;
          changed = true;
        }
        if (patch.center && !place.center) {
          place.center = patch.center;
          changed = true;
        }
      }
    }
    if (changed) this.save();
  }
}
