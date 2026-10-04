<script lang="ts">
  // The selected place in the analysis view's right panel: what it is, how sure we are, the
  // owner type, suggestions with their first legal step, and the "why" breakdown.
  import { describePlace, parcelLensOf } from '../../places/rank.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';
  import WhyBreakdown from '../lens/WhyBreakdown.svelte';
  import { kindLabel } from './labels.ts';

  let { store, properties }: { store: AppStore; properties: Record<string, unknown> } = $props();

  const place = $derived(
    describePlace(store.registry, store.state, { id: store.state.selected ?? '', properties, center: [0, 0] }),
  );
  const lens = $derived(parcelLensOf(store.registry));
</script>

<section class="details" aria-labelledby="pk-place-title">
  <h2 id="pk-place-title">
    {kindLabel(place.kind)}
    <span class="id">{strings.place.parcel(place.id)}</span>
  </h2>
  <dl>
    <dt>{strings.place.confidenceTitle}</dt>
    <dd>{strings.place.confidence[place.confidence] ?? strings.why.noData}</dd>
    <dt>{strings.place.ownerTitle}</dt>
    <dd>{place.ownerType === null ? strings.why.noData : (strings.ownerTypes[place.ownerType] ?? strings.why.noData)}</dd>
  </dl>
  {#if place.landcare}<p>{strings.place.landcare}.</p>{/if}

  <h3>{strings.place.suggestionsTitle}</h3>
  {#if place.suggestions.length === 0}
    <p class="muted">{strings.place.noSuggestion}</p>
  {:else}
    <ul class="suggestions">
      {#each place.suggestions as suggestion (suggestion.id)}
        {@const route = store.registry.routes.find((r) => r.id === suggestion.routes[0])}
        <li>
          <strong>{suggestion.label}</strong>
          <EvidenceBadge level={suggestion.evidence} />
          <p class="small">{suggestion.summary}</p>
          <p class="small">{strings.place.cost(suggestion.cost)}</p>
          {#if route?.steps[0]}
            <p class="small"><strong>{strings.place.firstStep}:</strong> {route.steps[0]} <span class="muted">({route.label})</span></p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if lens && place.why}
    <WhyBreakdown why={place.why} idPrefix="details" />
  {/if}
  <p class="muted small">{strings.place.dossierSoon}</p>
  <button class="button quiet small" type="button" onclick={() => store.select(null)}>{strings.place.clearSelection}</button>
</section>

<style>
  .id {
    display: block;
    font-weight: 400;
    font-size: 0.85rem;
    color: var(--pk-muted);
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    margin: 8px 0;
    font-size: 0.9rem;
  }
  dt {
    color: var(--pk-muted);
  }
  dd {
    margin: 0;
  }
  .suggestions {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .suggestions li {
    padding: 6px 0;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .suggestions p {
    margin: 2px 0;
  }
</style>
