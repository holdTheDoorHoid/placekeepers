<script lang="ts">
  // A City tree someone tapped (M3.1): its kind and the size of its trunk, from Parks and
  // Recreation's tree inventory, and a watering note for a small, likely young tree. Trees close
  // together can be tapped at once; the first few are listed.
  import { SMALL_TRUNK } from '../../map/styles/city_trees.ts';
  import { strings } from '../../strings.ts';

  let { features }: { features: Record<string, unknown>[] } = $props();
  const h = strings.heat;
  /** At most this many trees are listed for one tap. */
  const MAX_TREES = 4;

  function inches(properties: Record<string, unknown>): number | null {
    const d = properties.d;
    return typeof d === 'number' && Number.isFinite(d) ? d : null;
  }
</script>

{#if features.length > 1}<p class="muted small">{h.treesHere(features.length)}</p>{/if}
<ul class="trees">
  {#each features.slice(0, MAX_TREES) as properties, i (i)}
    {@const trunk = inches(properties)}
    <li>
      <strong>{typeof properties.sp === 'string' && properties.sp ? properties.sp : h.treeUnnamed}</strong>
      <span>{trunk === null ? h.treeNoTrunk : h.treeTrunk(trunk)}</span>
      {#if trunk !== null && trunk < SMALL_TRUNK}<span class="small">{h.treeYoung}</span>{/if}
    </li>
  {/each}
</ul>
<p class="muted small">{h.treeSource}</p>

<style>
  .trees {
    margin: 0;
    padding-left: 18px;
  }
  .trees li {
    margin-bottom: 6px;
  }
  .trees span {
    display: block;
  }
</style>
