<script lang="ts">
  // What you can do: each suggestion with its evidence badge and cost, the lawful route that fits
  // this parcel first, and who can help. No buy buttons, price estimates or letters
  // (docs/ETHICS.md); the only links that lead toward acquiring land are the Land Bank's own
  // programs, through the routes in the registry, and its map of the lots the City's land
  // agencies list as available (issue #36).
  import type { DossierView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';
  import DisplacementNote from '../places/DisplacementNote.svelte';
  import BlessingNote from '../streets/BlessingNote.svelte';
  import ListingBox from './ListingBox.svelte';
  import RouteDetails from './RouteDetails.svelte';

  let { actions }: { actions: DossierView['actions'] } = $props();
  const a = strings.dossier.actions;
  const howUrl = `${import.meta.env.BASE_URL}how/`;
</script>

<p class="small">{a.intro}</p>
{#if actions.listing}<ListingBox listing={actions.listing} />{/if}
{#if actions.suggestions.length === 0}
  <p class="muted">{actions.listed ? a.none : a.notListed}</p>
  {#if !actions.listed}<p><a href={howUrl}>{a.howTo}</a></p>{/if}
{/if}

{#each actions.suggestions as item (item.suggestion.id)}
  <article class="suggestion">
    <h4>{item.suggestion.label} <EvidenceBadge level={item.suggestion.evidence} /></h4>
    <BlessingNote suggestionId={item.suggestion.id} />
    <DisplacementNote suggestionId={item.suggestion.id} />
    {#each item.routes as route (route.route.id)}
      <RouteDetails view={route} level={5} />
    {/each}
    <p>{item.suggestion.summary}</p>
    <p class="small"><span class="muted">{a.cost}:</span> {item.suggestion.cost}</p>
    {#if item.partners.length}
      <p class="small muted partners-title">{a.partners}</p>
      <ul class="partners">
        {#each item.partners as partner (partner.id)}
          <li><a href={partner.url} target="_blank" rel="noopener noreferrer">{partner.name}</a>: {partner.one_line}</li>
        {/each}
      </ul>
    {/if}
  </article>
{/each}

{#if actions.otherRoutes.length}
  <h4>{a.otherRoutes}</h4>
  {#each actions.otherRoutes as route (route.route.id)}
    <RouteDetails view={route} level={5} />
  {/each}
{/if}
<p class="muted small">{a.notLegalAdvice}</p>

<style>
  .suggestion {
    margin: 8px 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .suggestion h4 {
    margin-bottom: 4px;
  }
  .partners-title {
    margin: 6px 0 2px;
  }
  .partners {
    margin: 0;
    padding-left: 1.2em;
    font-size: 0.875rem;
  }
</style>
