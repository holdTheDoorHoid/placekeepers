<script lang="ts">
  // Saves a place to the list in use, or takes it off again. The first save starts a list.
  // Lists stay in this browser (src/places/lists.svelte.ts).
  import { MAX_LISTS, MAX_LIST_PLACES, keptProperties } from '../../places/lists.svelte.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';

  let {
    store,
    id,
    center = null,
    properties = null,
    address = null,
    compact = false,
    label = '',
  }: {
    store: AppStore;
    id: string;
    center?: [number, number] | null;
    properties?: Record<string, unknown> | null;
    address?: string | null;
    /** A short button for table rows. */
    compact?: boolean;
    /** What the place is called, for screen readers when the button is short. */
    label?: string;
  } = $props();

  const s = strings.lists;
  const list = $derived(store.lists.active);
  const saved = $derived(store.lists.has(id));
  const name = $derived(list?.name ?? s.defaultName);

  function toggle() {
    if (saved && list) {
      store.lists.removePlace(id);
      store.say(s.removed(list.name));
      return;
    }
    const known = address ?? store.addresses.get(id) ?? null;
    const result = store.lists.add({ id, address: known, center, properties: keptProperties(properties) }, s.defaultName);
    if (result === 'full') store.say(store.lists.active ? s.full(MAX_LIST_PLACES) : s.tooMany(MAX_LISTS));
    else store.say(s.added(store.lists.active?.name ?? name));
  }
</script>

<button
  class="button small save"
  class:quiet={!saved}
  type="button"
  aria-pressed={saved}
  aria-label={compact && label ? s.saveShortLabel(label, name) : undefined}
  onclick={toggle}
>
  {#if compact}{saved ? s.savedShort : s.saveShort}{:else}{saved ? s.saved(name) : list ? s.saveTo(name) : s.save}{/if}
</button>

<style>
  .save[aria-pressed='true']::before {
    content: '\2713';
    font-weight: 700;
  }
</style>
