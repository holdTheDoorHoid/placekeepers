<script lang="ts">
  // What the map says about the SEPTA stops someone tapped: in the analysis view's details panel
  // and in the panel over the map in the field view. Subway platforms in both directions often
  // stand at one spot, so every stop under the finger is listed.
  import { describeStop } from '../../transit/describe.ts';
  import { strings } from '../../strings.ts';

  let { features }: { features: Record<string, unknown>[] } = $props();
  const t = strings.transit;
  const views = $derived(features.slice(0, 6).map((properties) => describeStop(properties)));
</script>

{#if features.length > 1}<p class="muted small">{t.stopsHere(features.length)}</p>{/if}
{#each views as view, i (i)}
  <section class="stop">
    <h3>{view.title}</h3>
    <p class="small">{view.kind}.{#if view.routes}{' '}{view.routes}{/if}</p>
    <h4>{t.howOften}</h4>
    <ul>
      {#each view.often as line (line)}<li>{line}</li>{/each}
    </ul>
    <h4>{t.riders}</h4>
    <ul>
      {#each view.riders as line (line)}<li>{line}</li>{/each}
    </ul>
    {#if view.details.length}
      <p class="small muted">{view.details.join(' ')}</p>
    {/if}
  </section>
{/each}
<p class="muted small">{t.source}</p>

<style>
  .stop {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  h3 {
    margin-bottom: 2px;
  }
  h4 {
    margin: 8px 0 2px;
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  p {
    margin: 2px 0;
  }
</style>
