<script lang="ts">
  // Works of public art someone tapped (M3.2): each one's kind, title, artist, year and material
  // where a source gives them, where it is, and a link to each source; a memorial artwork only as
  // such, with its sources (docs/ETHICS.md). Works close together can be tapped at once; the first
  // few are listed. Mural Arts Philadelphia's own list is linked beside murals, never copied.
  import { describeArt } from '../../art/describe.ts';
  import type { Registry } from '../../registry/types.ts';
  import { strings } from '../../strings.ts';

  let {
    features,
    lngLat,
    registry,
  }: { features: Record<string, unknown>[]; lngLat: [number, number]; registry: Registry } = $props();
  const a = strings.art;
  /** At most this many works are listed for one tap. */
  const MAX_WORKS = 4;
  const cityList = $derived(registry.sources.find((s) => s.id === 'percent_for_art')?.homepage ?? null);
  const works = $derived(features.slice(0, MAX_WORKS).map((p) => describeArt(p, lngLat, cityList)));
</script>

{#if features.length > 1}<p class="muted small">{a.worksHere(features.length)}</p>{/if}
{#each works as work, i (i)}
  <section class="work" class:memorial={work.memorial}>
    <h3>{work.heading}</h3>
    {#if work.memorial}
      <p>{a.memorialText}</p>
    {:else}
      {#if work.kind}<p class="muted small">{work.kind}</p>{/if}
      {#each work.facts as fact (fact)}<p>{fact}</p>{/each}
    {/if}
    {#if work.links.length}
      <h4>{a.sourcesTitle}</h4>
      <ul class="links">
        {#each work.links as link (link.url)}
          <li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
        {/each}
      </ul>
    {/if}
    {#if work.muralArts}
      <p class="small"><a href={work.muralArts} target="_blank" rel="noopener noreferrer">{a.muralArts}</a></p>
    {/if}
    <p class="small muted">{a.fix} <a href={work.fixUrl} target="_blank" rel="noopener noreferrer">{a.fixLink}</a></p>
  </section>
{/each}
<p class="muted small">{a.credit}</p>

<style>
  .work {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  .work p {
    margin: 2px 0;
  }
  h3 {
    margin-bottom: 2px;
  }
  h4 {
    margin: 6px 0 2px;
    font-size: 0.9rem;
  }
  .links {
    margin: 0;
    padding-left: 18px;
  }
</style>
