<script lang="ts">
  // Filters for the analysis view, as chips (src/config/filters.ts). Two groups pick one option of
  // a lots layer setting (how sure we are, lots or buildings); the rest narrow by a tile property,
  // where choosing chips shows only those and choosing none shows everything. Everything here
  // lives in the state, so a copied link carries it.
  import { FILTERS, SETTING_CHIPS, filterNarrows, type FilterDef } from '../../config/filters.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';

  let { store }: { store: AppStore } = $props();

  const settingGroups = $derived(
    SETTING_CHIPS.flatMap((group) => {
      const layer = store.registry.layers.find((l) => l.id === group.layer);
      const setting = layer?.settings.find((s) => s.id === group.setting);
      return layer && setting?.type === 'choice' ? [{ ...group, layer, setting }] : [];
    }),
  );
  const narrowedCount = $derived(FILTERS.filter((f) => filterNarrows(f, store.state.filters[f.id])).length);
  const settingsChanged = $derived(
    settingGroups.some((g) => (store.state.settings[g.layer.id]?.[g.setting.id] ?? g.setting.default) !== g.setting.default),
  );

  function all(filter: FilterDef): string[] {
    return filter.options.map((o) => o.value);
  }

  function toggle(filter: FilterDef, value: string, on: boolean) {
    const chosen = store.state.filters[filter.id] ?? all(filter);
    if (!filterNarrows(filter, chosen)) {
      // Everything was shown: the first chip chosen narrows to that one.
      if (on) store.setFilter(filter.id, [value]);
      return;
    }
    const next = on ? [...chosen, value] : chosen.filter((v) => v !== value);
    store.setFilter(filter.id, next.length === 0 ? all(filter) : all(filter).filter((v) => next.includes(v)));
  }

  function clearAll() {
    store.clearFilters();
    for (const group of settingGroups) store.setSetting(group.layer.id, group.setting.id, group.setting.default);
  }
</script>

<section class="filters" aria-labelledby="pk-filters-title">
  <div class="title-row">
    <h2 id="pk-filters-title">{strings.filters.title}</h2>
    {#if narrowedCount > 0 || settingsChanged}
      <button class="button quiet small" type="button" onclick={clearAll}>{strings.filters.clear}</button>
    {/if}
  </div>
  <p class="muted small">{strings.filters.intro}</p>

  {#each settingGroups as group (group.setting.id)}
    {@const value = store.state.settings[group.layer.id]?.[group.setting.id] ?? group.setting.default}
    <fieldset class="group" data-filter={group.setting.id}>
      <legend>{group.label}</legend>
      <div class="chip-row">
        {#each group.setting.options as option (option.value)}
          <label class="chip-choice">
            <input
              class="sr-only"
              type="radio"
              name="pk-filter-{group.setting.id}"
              value={option.value}
              checked={value === option.value}
              onchange={() => store.setSetting(group.layer.id, group.setting.id, option.value)}
            />
            <span>{option.label}</span>
          </label>
        {/each}
      </div>
    </fieldset>
  {/each}

  {#each FILTERS as filter (filter.id)}
    {@const chosen = store.state.filters[filter.id] ?? all(filter)}
    {@const narrowed = filterNarrows(filter, chosen)}
    <fieldset class="group" data-filter={filter.id} aria-describedby={filter.help ? `pk-filter-${filter.id}-help` : undefined}>
      <legend>{filter.label}</legend>
      <div class="chip-row">
        {#each filter.options as option (option.value)}
          <label class="chip-choice">
            <input
              class="sr-only"
              type="checkbox"
              value={option.value}
              checked={narrowed && chosen.includes(option.value)}
              onchange={(e) => toggle(filter, option.value, e.currentTarget.checked)}
            />
            <span>{option.label}</span>
          </label>
        {/each}
      </div>
      {#if filter.help}<p id="pk-filter-{filter.id}-help" class="muted small help">{filter.help}</p>{/if}
      {#if chosen.length === 0}
        <p class="notice" role="status">
          {strings.filters.noneSelected(filter.label)}
          <button class="button quiet small" type="button" onclick={() => store.setFilter(filter.id, all(filter))}>{strings.filters.showAll}</button>
        </p>
      {/if}
    </fieldset>
  {/each}
</section>

<style>
  .filters {
    margin-bottom: 12px;
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .title-row h2 {
    margin: 0;
  }
  .group {
    margin: 10px 0 0;
  }
  .group legend {
    font-size: 0.95rem;
    margin-bottom: 4px;
  }
  .help {
    margin: 4px 0 0;
  }
  .notice {
    margin-top: 6px;
  }
</style>
