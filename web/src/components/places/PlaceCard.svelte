<script lang="ts">
  // A card in "What you can do nearby": what the place is, why it matters (with its evidence
  // badge), the suggestion with its cost, and the first legal step.
  import type { RankedPlace } from '../../places/rank.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';
  import { kindLabel } from './labels.ts';

  let {
    store,
    place,
    lensLabel,
    onShow,
  }: { store: AppStore; place: RankedPlace; lensLabel: string; onShow?: () => void } = $props();
  const suggestion = $derived(place.suggestions[0]);
</script>

<article class="card" aria-labelledby="card-{place.id}">
  <h3 id="card-{place.id}">
    {kindLabel(place.kind)}
    <span class="id">{strings.place.parcel(place.id)}</span>
  </h3>
  <p class="sure">{strings.place.confidence[place.confidence] ?? ''}{#if place.landcare}. {strings.place.landcare}{/if}</p>
  {#if place.score !== null && place.why?.main}
    <p>
      {strings.place.priority(place.score, lensLabel)}. {strings.place.mainReason(place.why.main.label)}
      <EvidenceBadge level={place.why.main.evidence} />
    </p>
  {:else if !place.why?.allOff}
    <p class="muted">{strings.place.noScore}</p>
  {/if}
  {#if suggestion}
    <p>
      <strong>{strings.place.bestSuggestion}:</strong>
      {suggestion.label}. <EvidenceBadge level={suggestion.evidence} />
      <span class="cost">{strings.place.cost(suggestion.cost)}</span>
    </p>
    {#if place.firstStep}
      <p><strong>{strings.place.firstStep}:</strong> {place.firstStep.step}</p>
    {/if}
  {:else}
    <p class="muted">{strings.place.noSuggestion}</p>
  {/if}
  <div class="buttons">
    <button
      class="button small primary"
      type="button"
      onclick={() => {
        store.select(place.id, place.properties, { center: place.center });
        store.controller?.flyTo(place.center);
      }}>{strings.sheet.openLotPage}</button
    >
    <button
      class="button small"
      type="button"
      onclick={() => {
        store.select(place.id, place.properties, { center: place.center, open: false });
        store.controller?.flyTo(place.center);
        onShow?.();
      }}>{strings.sheet.showOnMap}</button
    >
  </div>
</article>

<style>
  .card {
    padding: 12px;
    border: 1px solid var(--pk-surface-2);
    border-radius: var(--pk-radius);
    background: var(--pk-bg);
  }
  h3 {
    margin-bottom: 2px;
  }
  .id {
    display: block;
    font-weight: 400;
    font-size: 0.85rem;
    color: var(--pk-muted);
  }
  .sure {
    font-size: 0.875rem;
    color: var(--pk-muted);
  }
  .cost {
    display: block;
    font-size: 0.875rem;
  }
  p {
    font-size: 0.95rem;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
