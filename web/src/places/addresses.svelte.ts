// Street addresses for the places in the cards, the ranked list, the plot and saved lists. The map
// tiles carry only the parcel number, so the address comes from the parcel's dossier shard
// (docs/CONTRACTS.md section 6), downloaded once per visit and only for places someone is looking
// at, a few files at a time. A parcel whose prefix has no shard has no address to show.

import { SvelteMap } from 'svelte/reactivity';
import type { Manifest } from '../data/manifest.ts';
import { isOpaAccount } from '../dossier/opa.ts';
import { loadShard, shardLocation } from '../dossier/shard.ts';

/** How many shard files are downloaded at the same time. */
const AT_ONCE = 4;

export interface AddressDeps {
  dataBase: string;
  /** The manifest once it has loaded (null when it could not load). */
  manifest: () => Promise<Manifest | null>;
  fetchImpl?: typeof fetch;
}

export class AddressBook {
  private readonly known = new SvelteMap<string, string | null>();
  private readonly waiting = new Set<string>();
  private readonly deps: AddressDeps;

  constructor(deps: AddressDeps) {
    this.deps = deps;
  }

  /** The address; null when there is none to show; undefined while it is not known yet. */
  get(id: string): string | null | undefined {
    return this.known.get(id);
  }

  /** Remembers an address learned elsewhere, such as from an open lot page or an imported list. */
  remember(id: string, address: string | null): void {
    if (isOpaAccount(id) && (address || !this.known.has(id))) this.known.set(id, address);
  }

  /** Looks up the addresses of these parcels, if not known or asked for already. */
  async request(ids: Iterable<string>): Promise<void> {
    const wanted = [...new Set(ids)].filter((id) => isOpaAccount(id) && !this.known.has(id) && !this.waiting.has(id));
    if (wanted.length === 0) return;
    for (const id of wanted) this.waiting.add(id);
    const manifest = await this.deps.manifest();
    const byPath = new Map<string, string[]>();
    for (const id of wanted) {
      const location = shardLocation(id, manifest);
      if (!location.path) {
        this.settle(id, null);
        continue;
      }
      byPath.set(location.path, [...(byPath.get(location.path) ?? []), id]);
    }
    const paths = [...byPath.keys()];
    const next = async (): Promise<void> => {
      const path = paths.shift();
      if (!path) return;
      const result = await loadShard(this.deps.dataBase, path, this.deps.fetchImpl);
      for (const id of byPath.get(path) ?? []) {
        if (result.ok) this.settle(id, result.shard.parcels.get(id)?.address ?? null);
        else if (result.reason === 'not_published') this.settle(id, null);
        // A failed download may work later: forget it was asked for.
        else this.waiting.delete(id);
      }
      await next();
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, paths.length) }, next));
  }

  private settle(id: string, address: string | null): void {
    this.waiting.delete(id);
    this.known.set(id, address);
  }
}
