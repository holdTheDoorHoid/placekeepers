<script lang="ts">
  import { summarizeArea, type RankedPlace } from '../../places/rank.ts';
  import { strings } from '../../strings.ts';

  let { places, sampled = false }: { places: RankedPlace[]; sampled?: boolean } = $props();
  const area = $derived(summarizeArea(places));
</script>

<section aria-labelledby="pk-area-title">
  <h2 id="pk-area-title">{strings.analysis.areaTitle}</h2>
  {#if sampled}
    <!-- Zoomed out, the map draws a sample: counting it would understate what is there. -->
    <p class="notice sample" role="status">{strings.analysis.sampleArea}</p>
  {:else if places.length === 0}
    <p class="muted">{strings.analysis.areaEmpty}</p>
  {:else}
    <ul>
      <li>{strings.analysis.areaLots(area.lots)}</li>
      <li>{strings.analysis.areaBuildings(area.buildings)}</li>
      <li>{strings.analysis.areaHigh(area.high)}</li>
      <li>{strings.analysis.areaLandcare(area.landcare)}</li>
    </ul>
    <p class="muted small">{strings.analysis.areaHint}</p>
  {/if}
</section>

<style>
  ul {
    margin: 0 0 8px;
    padding-left: 18px;
  }
</style>
