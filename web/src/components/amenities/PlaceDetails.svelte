<script lang="ts">
  // A public place from the City someone tapped (M3.5): a library, a recreation center, a pool or
  // sprayground, or a drinking fountain in a park, with what the City lists about it.
  import { describePlace } from '../../amenities/describe.ts';

  let { layerId, properties }: { layerId: string; properties: Record<string, unknown> } = $props();

  const view = $derived(describePlace(layerId, properties));
</script>

<section class="place">
  <h3>{view.title}</h3>
  {#if view.kind}<p class="muted small">{view.kind}</p>{/if}
  {#if view.facts.length}
    <ul>
      {#each view.facts as fact (fact)}<li>{fact}</li>{/each}
    </ul>
  {/if}
  {#if view.link}<p class="small"><a href={view.link.href} target="_blank" rel="noopener noreferrer">{view.link.label}</a></p>{/if}
  <p class="muted small">{view.source}</p>
</section>

<style>
  .place {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  h3 {
    margin-bottom: 2px;
  }
  ul {
    margin: 2px 0;
    padding-left: 18px;
  }
  p {
    margin: 2px 0;
  }
</style>
