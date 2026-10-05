<script lang="ts">
  // The settings drawer, generated from the registry: the view, every layer with its own
  // settings, the lens weights, which suggestion types to show, and "Reset to defaults".
  import { config } from '../config/index.ts';
  import { autoView } from '../state/defaults.ts';
  import type { AppStore } from '../state/store.svelte.ts';
  import { strings } from '../strings.ts';
  import Dialog from './common/Dialog.svelte';
  import EvidenceBadge from './common/EvidenceBadge.svelte';
  import LayerList from './layers/LayerList.svelte';
  import LensPanel from './lens/LensPanel.svelte';
  import DisplacementNote from './places/DisplacementNote.svelte';
  import BlessingNote from './streets/BlessingNote.svelte';

  let { store, open = $bindable(false) }: { store: AppStore; open?: boolean } = $props();

  const viewChoice = $derived(store.viewChosen ? store.state.view : 'auto');
  const choices = [
    { value: 'field', label: strings.views.fieldLong, hint: strings.views.fieldHint },
    { value: 'analysis', label: strings.views.analysisLong, hint: strings.views.analysisHint },
    { value: 'auto', label: strings.views.auto, hint: strings.views.autoHint },
  ] as const;

  function chooseView(value: (typeof choices)[number]['value']) {
    if (value === 'auto') store.unpinView(autoView(window.innerWidth));
    else store.setView(value);
  }
</script>

<Dialog bind:open title={strings.settings.title} id="pk-settings">
  <p class="muted small">{strings.settings.intro}</p>

  <section aria-labelledby="pk-settings-view">
    <h3 id="pk-settings-view">{strings.settings.viewTitle}</h3>
    <fieldset>
      <legend class="sr-only">{strings.settings.viewTitle}</legend>
      {#each choices as choice (choice.value)}
        <label class="option">
          <input type="radio" name="pk-settings-view" checked={viewChoice === choice.value} onchange={() => chooseView(choice.value)} />
          <span><strong>{choice.label}</strong><span class="hint">{choice.hint}</span></span>
        </label>
      {/each}
    </fieldset>
  </section>

  <section aria-labelledby="pk-settings-options">
    <h3 id="pk-settings-options">{strings.options.title}</h3>
    {#each store.registry.options as option (option.id)}
      <div class="option-setting">
        {#if option.type === 'toggle'}
          <div class="head">
            <input
              id="pk-option-{option.id}"
              type="checkbox"
              role="switch"
              checked={store.options[option.id] === true}
              aria-describedby="pk-option-{option.id}-about"
              onchange={(e) => store.setOption(option.id, e.currentTarget.checked)}
            />
            <label for="pk-option-{option.id}">{option.label}</label>
          </div>
        {:else if option.type === 'choice'}
          <label for="pk-option-{option.id}">{option.label}</label>
          <select
            id="pk-option-{option.id}"
            aria-describedby="pk-option-{option.id}-about"
            value={String(store.options[option.id])}
            onchange={(e) => store.setOption(option.id, e.currentTarget.value)}
          >
            {#each option.options as choice (choice.value)}<option value={choice.value}>{choice.label}</option>{/each}
          </select>
        {:else}
          <label for="pk-option-{option.id}">{option.label}</label>
          <input
            id="pk-option-{option.id}"
            type="range"
            min={option.min}
            max={option.max}
            step={option.step}
            value={Number(store.options[option.id])}
            aria-describedby="pk-option-{option.id}-about"
            onchange={(e) => store.setOption(option.id, Number(e.currentTarget.value))}
          />
        {/if}
        <p id="pk-option-{option.id}-about" class="muted small">{option.description}</p>
      </div>
    {/each}
    <p class="small"><a href="{config.siteBase}privacy/">{strings.options.privacyLink}</a></p>
  </section>

  <section aria-labelledby="pk-settings-layers">
    <h3 id="pk-settings-layers">{strings.settings.layersTitle}</h3>
    <LayerList {store} idPrefix="settings" showReset={false} level={4} />
  </section>

  <section aria-labelledby="pk-settings-lens">
    <h3 id="pk-settings-lens">{strings.settings.lensTitle}</h3>
    {#each store.registry.lenses as lens (lens.id)}
      <LensPanel {store} {lens} idPrefix="settings" level={4} />
    {/each}
  </section>

  <section aria-labelledby="pk-settings-suggestions">
    <h3 id="pk-settings-suggestions">{strings.settings.suggestionsTitle}</h3>
    {#each store.registry.suggestions as suggestion (suggestion.id)}
      <div class="suggestion">
        <div class="head">
          <input
            id="pk-suggestion-{suggestion.id}"
            type="checkbox"
            role="switch"
            checked={store.state.suggestions[suggestion.id] !== false}
            onchange={(e) => store.setSuggestion(suggestion.id, e.currentTarget.checked)}
          />
          <label for="pk-suggestion-{suggestion.id}">{suggestion.label}</label>
          <EvidenceBadge level={suggestion.evidence} />
        </div>
        <div class="note"><BlessingNote suggestionId={suggestion.id} /><DisplacementNote suggestionId={suggestion.id} /></div>
        <p class="muted small">{suggestion.summary}</p>
      </div>
    {/each}
  </section>

  <section aria-labelledby="pk-settings-reset">
    <h3 id="pk-settings-reset">{strings.settings.resetTitle}</h3>
    <p class="small">{strings.settings.resetHelp} {strings.options.resetNote}</p>
    <button
      class="button"
      type="button"
      onclick={() => {
        store.resetToDefaults();
        store.say(strings.layers.resetDone);
      }}>{strings.settings.reset}</button
    >
    <p class="muted small note">{strings.settings.storageNote}</p>
  </section>
</Dialog>

<style>
  section {
    padding: 12px 0;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  section:last-child {
    border-bottom: 0;
  }
  .option {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 0;
  }
  .option input {
    margin-top: 3px;
  }
  .hint {
    display: block;
    font-size: 0.875rem;
    color: var(--pk-muted);
  }
  .option-setting {
    padding: 6px 0;
  }
  .option-setting .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .option-setting label {
    font-weight: 600;
  }
  .option-setting p {
    margin: 4px 0 0 28px;
  }
  .suggestion {
    padding: 6px 0;
  }
  .suggestion .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
  }
  .suggestion label {
    font-weight: 600;
  }
  .suggestion p,
  .suggestion .note {
    margin: 2px 0 0 28px;
  }
  .note {
    margin-top: 8px;
  }
</style>
