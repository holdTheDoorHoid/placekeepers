<script lang="ts">
  // A block with conditions reported to 311 someone tapped (M3.5): how many requests in the last
  // 90 days, how many are still open, the newest, and how to report it to Philly311. Counted by
  // block: never an address, and nothing about who reported. Physical conditions only; nothing
  // here ever suggests the police (docs/ETHICS.md).
  import { describeCondition } from '../../amenities/describe.ts';
  import { lightsPolesLine } from '../../streets/streets-stops.ts';
  import type { Route } from '../../registry/types.ts';
  import { strings } from '../../strings.ts';

  let { layerId, properties, route }: { layerId: string; properties: Record<string, unknown>; route?: Route } = $props();

  const view = $derived(describeCondition(layerId, properties));
  const t = strings.conditions;
  const link = $derived(route?.links[0] ?? null);
  // Beside a street light reported out, the poles the City lists along the block (M4.5).
  const poles = $derived(layerId === 'dark_lights' ? lightsPolesLine(properties) : null);
</script>

<section class="condition">
  <h3>{view.title}</h3>
  {#if view.place}<p class="muted small">{view.place}</p>{/if}
  <p>{view.summary}</p>
  {#if view.facts.length}<p class="small">{view.facts.join(' ')}</p>{/if}
  {#if poles}<p class="small">{poles}</p>{/if}
  <p class="muted small">{t.meaning} {t.byBlock}</p>
  {#if link}<p class="small"><a href={link.url} target="_blank" rel="noopener noreferrer">{t.report}</a></p>{/if}
  <p class="muted small">{t.source}</p>
</section>

<style>
  .condition {
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
