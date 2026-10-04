<script lang="ts">
  // Nearby: counts of what is around the lot, framed as care: where care is needed most, never a
  // label for the people who live here (docs/ETHICS.md). Buttons show the matching layers.
  import type { DossierView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';
  import ProvenanceLine from './ProvenanceLine.svelte';

  let { nearby, onShowLayer }: { nearby: DossierView['nearby']; onShowLayer?: (id: string) => void } = $props();
  const n = strings.dossier.nearby;
</script>

<p class="small">{n.intro}</p>
<ProvenanceLine provenance={nearby.provenance} />
{#if nearby.groups.length === 0}
  <p class="muted small">{n.none}</p>
{:else}
  {#each nearby.groups as group (group.heading)}
    <h4>{group.heading}</h4>
    <ul>
      {#each group.rows as row (row)}<li>{row}</li>{/each}
    </ul>
  {/each}
  <p class="muted small">{n.careNote}</p>
{/if}
{#if onShowLayer && nearby.layers.length}
  <div class="layers">
    {#each nearby.layers as layer (layer.id)}
      <button class="button quiet small" type="button" onclick={() => onShowLayer(layer.id)}>{n.showLayer(layer.label)}</button>
    {/each}
  </div>
{/if}

<style>
  ul {
    margin: 0 0 6px;
    padding-left: 1.2em;
  }
  .layers {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .layers .button {
    white-space: normal;
    text-align: left;
  }
</style>
