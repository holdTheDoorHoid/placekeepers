<script lang="ts">
  // A card in "What you can do nearby": what the place is and how far away, why it matters (with
  // its evidence badge), the suggestion with its cost, and the first lawful step. Tapping the card
  // opens the lot page.
  import type { NearbyPlace } from '../../places/rank.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';
  import ListToggle from '../lists/ListToggle.svelte';
  import DisplacementNote from './DisplacementNote.svelte';
  import { kindLabel } from './labels.ts';

  let {
    store,
    place,
    lensLabel,
    fromYou,
    onShow,
  }: { store: AppStore; place: NearbyPlace; lensLabel: string; fromYou: boolean; onShow?: () => void } = $props();

  const suggestion = $derived(place.suggestions[0]);
  const address = $derived(store.addresses.get(place.id));
  const name = $derived(address ?? strings.place.parcel(place.id));
</script>

<article class="card" aria-labelledby="card-{place.id}" data-place={place.id}>
  <h3 id="card-{place.id}">
    <button
      class="open"
      type="button"
      onclick={() => {
        store.select(place.id, place.properties, { center: place.center });
        store.controller?.flyTo(place.center);
      }}
    >
      <span class="kind">{kindLabel(place.kind)}</span>
      <span class="name">{name}</span>
    </button>
  </h3>
  <p class="meta">
    {strings.sheet.distance(place.distance, fromYou)}. {strings.place.confidence[place.confidence] ?? ''}{#if place.landcare}. {strings.place.landcare}{/if}.
  </p>
  {#if place.score !== null && place.why?.main}
    <p>
      {strings.place.priority(place.score, lensLabel)}. {strings.place.mainReason(place.why.main.label)}
      <EvidenceBadge level={place.why.main.evidence} />
    </p>
  {/if}
  {#if suggestion}
    <p>
      <strong>{strings.place.bestSuggestion}:</strong>
      {suggestion.label}. <EvidenceBadge level={suggestion.evidence} />
      <span class="cost">{strings.place.cost(suggestion.cost)}</span>
    </p>
    <DisplacementNote suggestionId={suggestion.id} />
    <p class="step">
      <strong>{strings.place.firstStep}:</strong>
      {#if place.firstStep}{place.firstStep.route.label}. {place.firstStep.step}{:else if place.noRoute}{strings.permission.noRoute}{:else}{strings.permission.seeLotPage}{/if}
    </p>
  {/if}
  <div class="buttons">
    <button
      class="button small quiet"
      type="button"
      onclick={() => {
        store.select(place.id, place.properties, { center: place.center, open: false });
        store.controller?.flyTo(place.center);
        onShow?.();
      }}>{strings.sheet.showOnMap}</button
    >
    <ListToggle {store} id={place.id} center={place.center} properties={place.properties} address={address ?? null} />
  </div>
</article>

<style>
  .card {
    position: relative;
    padding: 12px;
    border: 1px solid var(--pk-surface-2);
    border-radius: var(--pk-radius);
    background: var(--pk-bg);
  }
  .card:hover {
    border-color: var(--pk-border);
  }
  h3 {
    margin-bottom: 2px;
    font-size: 1rem;
  }
  /* The whole card opens the lot page; the buttons below sit above this layer. */
  .open {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--pk-text);
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .open::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--pk-radius);
  }
  .open:focus-visible {
    outline: none;
  }
  .open:focus-visible::after {
    outline: 3px solid var(--pk-focus);
    outline-offset: 2px;
  }
  .name {
    font-weight: 600;
    color: var(--pk-accent);
    text-decoration: underline;
  }
  .meta {
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
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
