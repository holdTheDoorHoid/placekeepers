<script lang="ts">
  // The always visible switch between the field view and the analysis view.
  import { VIEWS } from '../registry/types.ts';
  import type { AppStore } from '../state/store.svelte.ts';
  import { strings } from '../strings.ts';

  let { store }: { store: AppStore } = $props();
  const labels = { field: strings.views.field, analysis: strings.views.analysis };
  const hints = { field: strings.views.fieldHint, analysis: strings.views.analysisHint };
</script>

<fieldset class="switch">
  <legend class="sr-only">{strings.views.groupLabel}</legend>
  {#each VIEWS as view (view)}
    <label class:active={store.state.view === view} title={hints[view]}>
      <input
        class="sr-only"
        type="radio"
        name="pk-view"
        value={view}
        checked={store.state.view === view}
        onchange={() => store.setView(view)}
      />
      <span>{labels[view]}</span>
    </label>
  {/each}
</fieldset>

<style>
  .switch {
    display: inline-flex;
    border: 1px solid var(--pk-accent);
    border-radius: var(--pk-radius);
    overflow: hidden;
    flex: none;
  }
  label {
    display: inline-flex;
    align-items: center;
    min-height: 38px;
    padding: 4px 14px;
    color: var(--pk-accent);
    background: var(--pk-bg);
    font-weight: 600;
    cursor: pointer;
  }
  label + label {
    border-left: 1px solid var(--pk-accent);
  }
  label.active {
    background: var(--pk-accent);
    color: var(--pk-accent-ink);
  }
  label:has(input:focus-visible) {
    outline: 3px solid var(--pk-focus);
    outline-offset: -5px;
  }
  label.active:has(input:focus-visible) {
    outline-color: #ffffff;
  }
</style>
