<script lang="ts">
  // A bus or trolley stop someone tapped (M2.2): its name and number, what the map shows, and
  // each answer OpenStreetMap has, with "not yet surveyed" where it has none yet, never "no".
  // Links to the survey guide (the layer's guide page) and to the stop on OpenStreetMap.
  import { strings } from '../../strings.ts';
  import { describeStop } from '../../transit/describe.ts';

  let { properties, guide }: { properties: Record<string, unknown>; guide?: string } = $props();

  const stop = $derived(describeStop(properties));
  const s = strings.stops;
  // The site root from the build (not config, so the details also render outside a browser).
  const siteBase = import.meta.env.BASE_URL;
</script>

<section class="stop">
  <h3>{stop.name ?? s.unnamed}</h3>
  <p class="muted small">{stop.served}{#if stop.ref}. {s.number(stop.ref)}{/if}</p>
  <p><strong>{stop.comfort}</strong></p>
  <h4>{s.factsTitle}</h4>
  <ul class="facts">
    {#each stop.answers as item (item.key)}
      <li class:unknown={!item.known}>{item.label}: {item.value}{#if item.nearby} ({s.nearby}){/if}</li>
    {/each}
  </ul>
  {#if stop.anyUnknown}<p class="muted small">{s.unknownNote}</p>{/if}
  {#if guide}<p><a href="{siteBase}{guide}/">{s.survey}</a></p>{/if}
  {#if stop.osmUrl}
    <p class="small"><a href={stop.osmUrl} target="_blank" rel="noopener noreferrer">{s.openOsm}</a></p>
  {/if}
  <p class="muted small">{s.source}</p>
</section>

<style>
  .stop {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  .stop p {
    margin: 2px 0;
  }
  .facts {
    margin: 0;
    padding-left: 18px;
  }
  .unknown {
    color: var(--pk-muted);
  }
</style>
