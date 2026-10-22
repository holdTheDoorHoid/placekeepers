<script lang="ts">
  // "Make a packet" (M5.1): opens the packet page in a new tab, for the saved list in use or for the
  // places the analysis view ranks. What the packet holds goes after "#" in its address, or into
  // this browser's storage for the places on the map, so no server is told (src/packet/load.ts).
  import { config } from '../../config/index.ts';
  import type { SavedPlace } from '../../places/lists.svelte.ts';
  import { keptProperties } from '../../places/lists.svelte.ts';
  import { MAX_PACKET } from '../../packet/model.ts';
  import { packetHash, writeViewHandoff } from '../../packet/load.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { encodeState } from '../../state/url.ts';
  import { strings } from '../../strings.ts';

  let {
    store,
    listId = null,
    places = null,
    off = null,
  }: {
    store: AppStore;
    /** A saved list's id. */
    listId?: string | null;
    /** Or the places the analysis view ranks, in its order. */
    places?: (() => { id: string; center: [number, number] | null; properties: Record<string, unknown> | null }[]) | null;
    /** Why a packet is not offered right now, shown instead of the button. */
    off?: string | null;
  } = $props();

  const t = strings.packet;

  function open() {
    const state = encodeState(store.registry, $state.snapshot(store.state), { includeMap: false, includeSelection: false, layers: 'ifChanged' });
    let hash: string;
    if (places) {
      const chosen: SavedPlace[] = places()
        .slice(0, MAX_PACKET)
        .map((p) => ({ id: p.id, center: p.center, address: store.addresses.get(p.id) ?? null, properties: keptProperties(p.properties) }));
      if (chosen.length === 0) {
        store.say(strings.export.nothing);
        return;
      }
      writeViewHandoff(t.viewName, chosen);
      hash = packetHash({ fromView: true, state });
    } else {
      hash = packetHash({ list: listId, state });
    }
    window.open(`${config.siteBase}packet/#${hash}`, '_blank', 'noopener');
  }
</script>

<div class="packet-button">
  {#if off}
    <p class="muted small">{off}</p>
  {:else}
    <button class="button small" type="button" onclick={open}>{places ? t.makeFromView : t.make}</button>
    <span class="muted small">{places ? t.makeFromViewHelp(MAX_PACKET) : t.makeHelp}</span>
  {/if}
</div>

<style>
  .packet-button {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin: 8px 0;
  }
</style>
