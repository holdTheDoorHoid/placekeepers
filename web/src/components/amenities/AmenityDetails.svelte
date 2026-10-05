<script lang="ts">
  // An amenity from OpenStreetMap someone tapped (M3.5): what it is, its name, what OpenStreetMap
  // says about it (anything it does not say is left unsaid, never "no"), a link to it on
  // OpenStreetMap, and the guide on fixing or adding what is missing.
  import { describeAmenity } from '../../amenities/describe.ts';
  import { strings } from '../../strings.ts';

  let { layerId, properties, guide }: { layerId: string; properties: Record<string, unknown>; guide?: string } = $props();

  const view = $derived(describeAmenity(layerId, properties));
  const t = strings.amenities;
  // The site root from the build (not config, so the details also render outside a browser).
  const siteBase = import.meta.env.BASE_URL;
</script>

<section class="amenity">
  <h3>{view.name ?? view.title}</h3>
  {#if view.name}<p class="muted small">{view.title}</p>{/if}
  {#if view.facts.length}
    <ul>
      {#each view.facts as fact (fact)}<li>{fact}</li>{/each}
    </ul>
    <p class="muted small">{t.unknownNote}</p>
  {:else}
    <p class="muted small">{t.nothingMore}</p>
  {/if}
  {#if view.osmUrl}<p class="small"><a href={view.osmUrl} target="_blank" rel="noopener noreferrer">{t.openOsm}</a></p>{/if}
  {#if guide}<p class="small"><a href="{siteBase}{guide}/">{t.fix}</a></p>{/if}
  <p class="muted small">{t.source}</p>
</section>

<style>
  .amenity {
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
