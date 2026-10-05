<script lang="ts">
  // Lens sliders and presets. Moving a slider changes one weight in the state; the map
  // recolors at once through a paint property, without reloading data.
  import { matchingPreset } from '../../state/defaults.ts';
  import type { Lens } from '../../registry/types.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';

  let {
    store,
    lens,
    idPrefix,
    level = 3,
  }: {
    store: AppStore;
    lens: Lens;
    idPrefix: string;
    /** The heading level of the lens title, so headings stay in order wherever the panel sits. */
    level?: 2 | 3 | 4;
  } = $props();

  const weights = $derived(store.state.weights[lens.id] ?? {});
  const active = $derived(matchingPreset(lens, weights));
  const allOff = $derived(lens.factors.every((f) => (weights[f.id] ?? f.default_weight) === 0));
</script>

<section class="lens" aria-labelledby="{idPrefix}-lens-{lens.id}">
  <svelte:element this={`h${level}`} id="{idPrefix}-lens-{lens.id}" class="lens-title">{strings.lens.title}: {lens.label}</svelte:element>
  <p class="muted small">{lens.description}</p>

  {#if lens.presets.length}
    <div class="presets" role="group" aria-label={strings.lens.presets}>
      {#each lens.presets as preset (preset.id)}
        <button
          class="chip"
          type="button"
          aria-pressed={active === preset.id}
          onclick={() => store.applyPreset(lens.id, preset.id)}>{preset.label}</button
        >
      {/each}
    </div>
  {/if}

  {#if allOff}<p class="notice" role="status">{strings.lens.allOffFor(lens.applies_to)}</p>{/if}

  {#each lens.factors as factor (factor.id)}
    {@const w = weights[factor.id] ?? factor.default_weight}
    {@const sliderId = `${idPrefix}-w-${lens.id}-${factor.id}`}
    <div class="factor">
      <div class="factor-head">
        <label for={sliderId}>{factor.label}</label>
        <EvidenceBadge level={factor.evidence} />
      </div>
      <div class="slider-row">
        <input
          id={sliderId}
          type="range"
          min="0"
          max="5"
          step="1"
          value={w}
          aria-valuetext={strings.lens.weightValue(w)}
          oninput={(e) => store.setWeight(lens.id, factor.id, Number(e.currentTarget.value))}
        />
        <output for={sliderId}>{strings.lens.weightValue(w)}</output>
      </div>
      <details>
        <summary>{strings.lens.explainToggle}</summary>
        <p class="small">{factor.explain}</p>
      </details>
    </div>
  {/each}

  <button class="button quiet small" type="button" onclick={() => store.resetWeights(lens.id)}>{strings.lens.resetWeights}</button>
</section>

<style>
  .lens {
    margin-bottom: 12px;
  }
  .lens-title {
    font-size: 1rem;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0 10px;
  }
  .factor {
    padding: 8px 0;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .factor-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
  }
  .factor-head label {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  output {
    flex: none;
    width: 4.5em;
    text-align: right;
    font-size: 0.9rem;
  }
  details {
    font-size: 0.875rem;
  }
  .notice {
    margin-bottom: 8px;
  }
  .lens > .button {
    margin-top: 8px;
  }
</style>
