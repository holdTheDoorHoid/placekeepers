<script lang="ts">
  // Filters for the analysis view, from src/config/filters.ts.
  import { FILTERS } from '../../config/filters.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';

  let { store }: { store: AppStore } = $props();

  function toggle(id: string, value: string, on: boolean) {
    const current = store.state.filters[id] ?? [];
    store.setFilter(id, on ? [...current, value] : current.filter((v) => v !== value));
  }
</script>

<section aria-labelledby="pk-filters-title">
  <h2 id="pk-filters-title">{strings.filters.title}</h2>
  {#each FILTERS as filter (filter.id)}
    {@const chosen = store.state.filters[filter.id] ?? []}
    <fieldset>
      <legend>{filter.label}</legend>
      <div class="quick">
        <button class="button quiet small" type="button" onclick={() => store.setFilter(filter.id, filter.options.map((o) => o.value))}
          >{strings.filters.all}</button
        >
        <button class="button quiet small" type="button" onclick={() => store.setFilter(filter.id, [])}>{strings.filters.none}</button>
      </div>
      <div class="options">
        {#each filter.options as option (option.value)}
          <label>
            <input
              type="checkbox"
              checked={chosen.includes(option.value)}
              onchange={(e) => toggle(filter.id, option.value, e.currentTarget.checked)}
            />
            <span>{option.label}</span>
          </label>
        {/each}
      </div>
      {#if chosen.length === 0}<p class="notice" role="status">{strings.filters.noneSelected}</p>{/if}
    </fieldset>
  {/each}
</section>

<style>
  .quick {
    display: flex;
    gap: 6px;
    margin: 4px 0;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 2px 10px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    font-size: 0.9rem;
  }
  .notice {
    margin-top: 6px;
  }
</style>
