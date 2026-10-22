// Where a packet's places come from, and reading their lot pages from the weekly copy (M5.1).
//
// A packet is opened in its own tab with what it should hold after "#" in the address, which the
// browser never sends to any server: `list=<id>` for a saved list, or `from=view` for the places the
// analysis view ranked, which the map hands over in this browser's storage just before. The app's
// own settings (the lens and the suggestions switched on) follow in `s=`, as the map writes them.

import type { Manifest } from '../data/manifest.ts';
import type { DossierNotes, ShardParcel } from '../dossier/types.ts';
import { loadCommon, loadShard, shardLocation } from '../dossier/shard.ts';
import { readPlace, type SavedList, type SavedPlace } from '../places/lists.svelte.ts';
import { readItem, writeItem, type KeyValueStore } from '../state/storage.ts';
import { MAX_PACKET } from './model.ts';

/** The places the analysis view hands to a packet, under "placekeepers:v1:packet-view". */
export const VIEW_HANDOFF_KEY = 'packet-view';

export interface PacketChoice {
  list: string | null;
  fromView: boolean;
  /** The map's settings, as its address bar writes them. */
  state: string | null;
}

export function readPacketHash(hash: string): PacketChoice {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const list = params.get('list');
  return {
    list: list && /^[a-z0-9]{1,24}$/.test(list) ? list : null,
    fromView: params.get('from') === 'view',
    state: params.get('s'),
  };
}

export function packetHash(choice: { list?: string | null; fromView?: boolean; state?: string | null }): string {
  const params = new URLSearchParams();
  if (choice.list) params.set('list', choice.list);
  if (choice.fromView) params.set('from', 'view');
  if (choice.state) params.set('s', choice.state);
  return params.toString();
}

/** Keeps the places the analysis view ranked for the packet tab to read (this browser only). */
export function writeViewHandoff(name: string, places: SavedPlace[], store?: KeyValueStore | null): boolean {
  const body = JSON.stringify({ name, created: new Date().toISOString(), places: places.slice(0, MAX_PACKET * 2) });
  return store === undefined ? writeItem(VIEW_HANDOFF_KEY, body) : writeItem(VIEW_HANDOFF_KEY, body, store);
}

/** The places the analysis view handed over, read forgivingly; null when there are none. */
export function readViewHandoff(store?: KeyValueStore | null): SavedList | null {
  const text = store === undefined ? readItem(VIEW_HANDOFF_KEY) : readItem(VIEW_HANDOFF_KEY, store);
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as { name?: unknown; created?: unknown; places?: unknown };
    const places: SavedPlace[] = [];
    for (const item of Array.isArray(raw.places) ? raw.places : []) {
      const place = readPlace(item);
      if (place && !places.some((p) => p.id === place.id)) places.push(place);
    }
    if (!places.length) return null;
    return {
      id: 'view',
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Places on the map',
      created: typeof raw.created === 'string' ? raw.created : new Date().toISOString(),
      places,
    };
  } catch {
    return null;
  }
}

export interface LoadedLot {
  place: SavedPlace;
  parcel: ShardParcel | null;
  generatedAt: string | null;
}

export interface LoadedPacket {
  lots: LoadedLot[];
  notes: DossierNotes | null;
  /** Shard files that could not be downloaded (their lots show without details). */
  failed: number;
}

/** Reads every place's dossier record from the weekly copy, a few files at a time. */
export async function loadPacketLots(
  places: SavedPlace[],
  deps: { dataBase: string; manifest: Manifest | null; fetchImpl?: typeof fetch; onProgress?: (done: number, total: number) => void },
): Promise<LoadedPacket> {
  const byPath = new Map<string, string[]>();
  for (const place of places) {
    const where = shardLocation(place.id, deps.manifest);
    if (where.path) byPath.set(where.path, [...(byPath.get(where.path) ?? []), place.id]);
  }
  const found = new Map<string, { parcel: ShardParcel; generatedAt: string | null }>();
  const paths = [...byPath.keys()];
  const total = paths.length;
  let done = 0;
  let failed = 0;
  let notes: DossierNotes | null = null;
  deps.onProgress?.(0, total);
  const next = async (): Promise<void> => {
    const path = paths.shift();
    if (!path) return;
    const result = await loadShard(deps.dataBase, path, deps.fetchImpl);
    if (result.ok) {
      for (const id of byPath.get(path) ?? []) {
        const parcel = result.shard.parcels.get(id);
        if (parcel) found.set(id, { parcel, generatedAt: result.shard.generatedAt });
      }
      if (result.shard.notes && !notes) notes = result.shard.notes;
    } else if (result.reason === 'failed') failed += 1;
    done += 1;
    deps.onProgress?.(done, total);
    await next();
  };
  const [common] = await Promise.all([loadCommon(deps.dataBase, deps.manifest?.files ?? null, deps.fetchImpl), ...Array.from({ length: Math.min(4, total) }, next)]);
  const merged: DossierNotes | null =
    notes && common ? { ...common, flags: { ...common.flags, ...(notes as DossierNotes).flags }, notices: { ...common.notices, ...(notes as DossierNotes).notices } } : (notes ?? common);
  return {
    lots: places.map((place) => ({ place, parcel: found.get(place.id)?.parcel ?? null, generatedAt: found.get(place.id)?.generatedAt ?? null })),
    notes: merged,
    failed,
  };
}
