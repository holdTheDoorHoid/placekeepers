<script lang="ts">
  // Every registry layer, grouped in the order of registry/groups.yaml. Groups with no
  // layers yet are left out.
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import LayerItem from './LayerItem.svelte';

  let { store, idPrefix, showReset = true }: { store: AppStore; idPrefix: string; showReset?: boolean } = $props();

  const groups = $derived(
    store.registry.groups
      .map((group) => ({ group, layers: store.registry.layers.filter((l) => l.group === group.id) }))
      .filter((g) => g.layers.length > 0),
  );
</script>

<div class="layer-list">
  {#each groups as { group, layers } (group.id)}
    <section class="group" aria-labelledby="{idPrefix}-group-{group.id}">
      <h3 id="{idPrefix}-group-{group.id}">{group.label}</h3>
      <p class="muted small">{group.description}</p>
      {#each layers as layer (layer.id)}
        <LayerItem {store} {layer} {idPrefix} />
      {/each}
    </section>
  {/each}
  {#if showReset}
    <button
      class="button quiet small reset"
      type="button"
      onclick={() => {
        store.resetToDefaults();
        store.say(strings.layers.resetDone);
      }}>{strings.layers.resetAll}</button
    >
  {/if}
</div>

<style>
  .group {
    margin-bottom: 14px;
  }
  .group h3 {
    margin-bottom: 2px;
  }
  .group > p {
    margin-bottom: 2px;
  }
  .reset {
    margin-top: 4px;
  }
</style>
