<script lang="ts">
  // A bus or trolley stop in "What you can do nearby", beside the lots: what the stop is and how
  // far away, its priority under the transit comfort lens with the main reason, the first
  // suggestion with its cost, and the first step. Tapping the card opens the stop's details, as
  // tapping the stop on the map does.
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import type { NearbyStop } from '../../transit/comfort.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';
  import DisplacementNote from '../places/DisplacementNote.svelte';
  import { watchNote, watchSigns } from '../../displacement/watch.ts';

  let {
    store,
    stop,
    lensLabel,
    fromYou,
    onShow,
  }: { store: AppStore; stop: NearbyStop; lensLabel: string; fromYou: boolean; onShow?: () => void } = $props();

  const suggestion = $derived(stop.suggestions[0]);
  // Shade trees are greening: the caution, with the watch area's signs when the stop lies in one.
  const watch = $derived(watchNote(store.registry, watchSigns(stop.properties)));
  const domId = $derived(`stop-card-${stop.id.replace(/[^A-Za-z0-9_-]/g, '_')}`);

  function inspect() {
    store.inspect({ layerId: stop.layerId, features: [stop.properties], lngLat: stop.lngLat });
  }
</script>

<article class="card" aria-labelledby={domId} data-stop={stop.id}>
  <h3 id={domId}>
    <button
      class="open"
      type="button"
      onclick={() => {
        inspect();
        store.controller?.flyTo(stop.lngLat);
      }}
    >
      <span class="kind">{strings.transit.kinds[stop.kind]}</span>
      <span class="name">{stop.title}</span>
    </button>
  </h3>
  <p class="meta">{strings.sheet.distance(stop.distance, fromYou)}.{#if stop.routes}{' '}{stop.routes}{/if}</p>
  {#if stop.score !== null}
    <p>
      {strings.place.priority(stop.score, lensLabel)}.{#if stop.main}{' '}{strings.place.mainReason(stop.main.label)}
        <EvidenceBadge level={stop.main.evidence} />{/if}
    </p>
  {/if}
  {#if suggestion}
    <p>
      <strong>{strings.place.bestSuggestion}:</strong>
      {suggestion.suggestion.label}. <EvidenceBadge level={suggestion.suggestion.evidence} />
      <span class="cost">{strings.place.cost(suggestion.suggestion.cost)}</span>
    </p>
    <DisplacementNote suggestionId={suggestion.suggestion.id} {watch} />
    {#if suggestion.firstStep}
      <p class="step"><strong>{strings.streets.firstStep}:</strong> {suggestion.firstStep.route.label}. {suggestion.firstStep.step}</p>
    {/if}
  {/if}
  <div class="buttons">
    <button
      class="button small quiet"
      type="button"
      onclick={() => {
        // Marks the stop on the map without opening its details over it.
        store.inspect({ layerId: stop.layerId, features: [stop.properties], lngLat: stop.lngLat }, false);
        store.controller?.flyTo(stop.lngLat);
        onShow?.();
      }}>{strings.sheet.showOnMap}</button
    >
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
  /* The whole card opens the stop's details; the buttons below sit above this layer. */
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
