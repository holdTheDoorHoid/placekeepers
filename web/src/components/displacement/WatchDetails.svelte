<script lang="ts">
  // A displacement watch area someone tapped (M4.1): the signs that hold there, each with what was
  // measured against the whole city, then the signs measured that do not hold, what it means, the
  // ways to protect neighbors and what the watch cannot tell. Care words only: "signs that prices
  // are rising here", never a label for the neighborhood, and no rank among areas.
  import { describeArea, protectionLinks, type WatchSummary } from '../../displacement/watch.ts';
  import type { Registry } from '../../registry/types.ts';
  import { formatDate, strings } from '../../strings.ts';

  let {
    features,
    summary,
    registry,
  }: { features: Record<string, unknown>[]; summary: WatchSummary | null; registry: Registry } = $props();
  const d = strings.displacement;
  const areas = $derived(features.slice(0, 2).map((properties) => describeArea(properties, summary)));
  const links = $derived(protectionLinks(registry));
  const responsiblyUrl = `${import.meta.env.BASE_URL}responsibly/`;
</script>

{#each areas as area, i (i)}
  <section class="watch-area" data-watch-area={area.title}>
    <h3>{d.heading}</h3>
    <p class="small">{area.title}{#if area.place}. {d.around(area.place)}{/if}.</p>
    <h4>{d.signsHere}</h4>
    <ul class="signs">
      {#each area.holding as row (row.id)}
        <li data-sign={row.id}><strong>{row.title}.</strong> {row.text}</li>
      {/each}
    </ul>
    {#if area.other.length}
      <details>
        <summary>{d.alsoMeasured}</summary>
        <ul class="signs other">
          {#each area.other as row (row.id)}
            <li data-sign={row.id}><strong>{row.title}.</strong> {row.text}</li>
          {/each}
        </ul>
      </details>
    {/if}
  </section>
{/each}
<p class="small">{d.rule}</p>
<p>{d.meaning}</p>
{#if links.length}
  <p class="small"><strong>{d.protectionsTitle}:</strong></p>
  <ul class="links">
    {#each links as link (link.id)}
      <li class="small">
        <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
        <span class="muted">({d.checked(formatDate(link.checked) ?? link.checked)})</span>
      </li>
    {/each}
  </ul>
{/if}
<p class="muted small">{d.cannotTell} <a href={responsiblyUrl}>{d.protections}</a></p>

<style>
  .watch-area {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  .watch-area h3 {
    margin-bottom: 2px;
  }
  .signs,
  .links {
    margin: 0 0 4px;
    padding-left: 18px;
  }
  .signs li {
    margin-bottom: 4px;
  }
  .other {
    margin-top: 4px;
  }
</style>
