<script lang="ts">
  // The SEPTA routes someone tapped on the map (M2.4): routes that share a street lie on top of
  // each other, so every route under the finger is listed, each with a link to its survey sheet
  // when it is a bus or trolley route.
  import { describeRoutes } from '../../survey/route.ts';
  import { strings } from '../../strings.ts';

  let { features }: { features: Record<string, unknown>[] } = $props();
  const views = $derived(describeRoutes(features).slice(0, 8));
  const s = strings.survey;
  // The site root from the build (not config, so the details also render outside a browser).
  const siteBase = import.meta.env.BASE_URL;
</script>

{#if views.length > 1}<p class="muted small">{s.routesHere(views.length)}</p>{/if}
{#each views as view (view.id)}
  <section class="route">
    <h3>{view.title}</h3>
    {#if view.name}<p>{view.name}</p>{/if}
    <p class="muted small">{view.kind}.{#if view.often}{' '}{view.often}{/if}</p>
    {#if view.survey}<p class="small"><a href="{siteBase}{view.survey}">{s.surveyThisRoute}</a></p>{/if}
  </section>
{/each}
<p class="muted small">{strings.transit.source}</p>

<style>
  .route {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  h3 {
    margin-bottom: 2px;
  }
  p {
    margin: 2px 0;
  }
</style>
