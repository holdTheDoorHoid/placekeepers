<script lang="ts">
  // One layer setting from the registry: a switch (toggle), a set of radio buttons (choice)
  // or a slider (range).
  import type { Layer, LayerSetting } from '../../registry/types.ts';
  import type { AppStore } from '../../state/store.svelte.ts';

  let { store, layer, setting, idPrefix }: { store: AppStore; layer: Layer; setting: LayerSetting; idPrefix: string } =
    $props();

  const value = $derived(store.state.settings[layer.id]?.[setting.id] ?? setting.default);
  const controlId = $derived(`${idPrefix}-${layer.id}-${setting.id}`);
</script>

{#if setting.type === 'toggle'}
  <div class="toggle">
    <input
      id={controlId}
      type="checkbox"
      role="switch"
      checked={value === true}
      onchange={(e) => store.setSetting(layer.id, setting.id, e.currentTarget.checked)}
    />
    <label for={controlId}>{setting.label}</label>
  </div>
{:else if setting.type === 'choice'}
  <fieldset class="choice">
    <legend>{setting.label}</legend>
    {#each setting.options as option (option.value)}
      <label class="option">
        <input
          type="radio"
          name={controlId}
          value={option.value}
          checked={value === option.value}
          onchange={() => store.setSetting(layer.id, setting.id, option.value)}
        />
        <span>{option.label}</span>
      </label>
    {/each}
  </fieldset>
{:else}
  <div class="range">
    <label for={controlId}>{setting.label}</label>
    <div class="range-row">
      <input
        id={controlId}
        type="range"
        min={setting.min}
        max={setting.max}
        step={setting.step}
        value={Number(value)}
        oninput={(e) => store.setSetting(layer.id, setting.id, Number(e.currentTarget.value))}
      />
      <output for={controlId}>{value}</output>
    </div>
  </div>
{/if}

<style>
  .toggle,
  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
  }
  .choice {
    margin: 6px 0;
  }
  .choice legend {
    font-size: 0.9rem;
    margin-bottom: 2px;
  }
  .option {
    font-size: 0.9rem;
  }
  .range label {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .range-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  output {
    min-width: 3ch;
    text-align: right;
  }
</style>
