<script lang="ts">
  // The analysis view, desktop first: lens sliders, filters and layers on the left, the
  // selected place or a summary of the area on the right, and a ranked list underneath.
  // On narrower screens the side panels become panels that open over the map.
  import { strings } from '../../strings.ts';
  import { rankPlaces, type ScoreOrder } from '../../places/rank.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import DossierPanel from '../dossier/DossierPanel.svelte';
  import LayerList from '../layers/LayerList.svelte';
  import LensPanel from '../lens/LensPanel.svelte';
  import SavedLists from '../lists/SavedLists.svelte';
  import AreaSummary from '../places/AreaSummary.svelte';
  import ExportButtons from '../places/ExportButtons.svelte';
  import RankedTable from '../places/RankedTable.svelte';
  import AddressSearch from '../search/AddressSearch.svelte';
  import FeatureDetails from '../streets/FeatureDetails.svelte';
  import Filters from './Filters.svelte';
  import NeedPlot from './NeedPlot.svelte';

  let { store }: { store: AppStore } = $props();

  type Panel = 'table' | 'plot' | 'lists';
  let leftOpen = $state(false);
  let rightOpen = $state(false);
  /** Which part of the drawer under the map is open, if any. */
  let panel = $state<Panel | null>(null);
  let order = $state<ScoreOrder>('desc');

  const ranked = $derived(rankPlaces(store.registry, store.state, store.parcelsInView, Infinity, order));
  const panels: { id: Panel; label: string }[] = [
    { id: 'table', label: strings.analysis.tabTable },
    { id: 'plot', label: strings.analysis.tabPlot },
    { id: 'lists', label: strings.analysis.tabLists },
  ];
  const listCount = $derived(store.lists.active?.places.length ?? 0);

  function toggle(id: Panel) {
    panel = panel === id ? null : id;
  }

  /** The places in view for a download, highest score first (the download keeps the first 500). */
  function inView() {
    return rankPlaces(store.registry, store.state, store.parcelsInView).map((p) => ({ id: p.id, center: p.center, properties: p.properties }));
  }

  // Selecting a place, or tapping a memorial, crash or street block, opens the details panel on
  // screens where it is hidden.
  $effect(() => {
    if (store.state.selected || store.inspected) rightOpen = true;
  });
</script>

<div class="toolbar">
  <button class="button small narrow-only" type="button" aria-expanded={leftOpen} aria-controls="pk-left" onclick={() => (leftOpen = !leftOpen)}
    >{strings.analysis.openLeft}</button
  >
  <button class="button small" type="button" aria-expanded={rightOpen} aria-controls="pk-right" onclick={() => (rightOpen = !rightOpen)}
    >{strings.analysis.openRight}</button
  >
</div>

<aside id="pk-left" class="panel left" class:open={leftOpen} aria-label={strings.analysis.leftTitle}>
  <div class="panel-close narrow-only">
    <button class="icon-button" type="button" aria-label={strings.analysis.closePanel} onclick={() => (leftOpen = false)}>&times;</button>
  </div>
  <div class="search"><AddressSearch {store} idPrefix="pk-analysis" /></div>
  {#each store.registry.lenses as lens (lens.id)}
    <LensPanel {store} {lens} idPrefix="left" />
  {/each}
  <Filters {store} />
  <section class="layers" aria-labelledby="pk-left-layers">
    <h2 id="pk-left-layers">{strings.layers.title}</h2>
    <LayerList {store} idPrefix="left" />
  </section>
</aside>

<aside id="pk-right" class="panel right" class:open={rightOpen} aria-label={strings.analysis.rightTitle}>
  <div class="panel-close not-wide">
    <button class="icon-button" type="button" aria-label={strings.analysis.closePanel} onclick={() => (rightOpen = false)}>&times;</button>
  </div>
  {#if store.inspected}
    <FeatureDetails
      {store}
      target={store.inspected}
      heading={strings.streets.detailsTitle(store.registry.layers.find((l) => l.id === store.inspected?.layerId)?.style ?? '')}
      onClose={() => store.inspect(null)}
    />
  {:else if store.dossierView}
    <DossierPanel
      {store}
      showTitle
      idPrefix="pk-analysis-dossier"
      onShowOnMap={store.dossier.center ? () => store.controller?.flyTo(store.dossier.center!) : undefined}
    />
  {:else}
    <AreaSummary places={ranked} />
  {/if}
</aside>

<section class="drawer" id="places-section" tabindex="-1" aria-labelledby="pk-drawer-title">
  <h2 id="pk-drawer-title" class="sr-only">{strings.analysis.drawerLabel}</h2>
  <div class="tabs" role="group" aria-labelledby="pk-drawer-title">
    {#each panels as item (item.id)}
      <button type="button" class="tab" aria-expanded={panel === item.id} aria-controls="pk-drawer-{item.id}" onclick={() => toggle(item.id)}>
        <span>{item.label}</span>
        {#if item.id === 'table'}<span class="count">{strings.sheet.countLabel(ranked.length)}</span>{/if}
        {#if item.id === 'lists' && store.lists.active}<span class="count">{strings.lists.count(listCount)}</span>{/if}
      </button>
    {/each}
  </div>
  <div id="pk-drawer-table" class="drawer-body" hidden={panel !== 'table'}>
    {#if panel === 'table'}
      <ExportButtons {store} places={inView} title={strings.export.inView} idPrefix="pk-view" />
      <RankedTable {store} places={ranked} {order} onOrder={(next) => (order = next)} />
    {/if}
  </div>
  <div id="pk-drawer-plot" class="drawer-body" hidden={panel !== 'plot'}>
    {#if panel === 'plot'}<NeedPlot {store} places={ranked} idPrefix="pk-analysis" />{/if}
  </div>
  <div id="pk-drawer-lists" class="drawer-body" hidden={panel !== 'lists'}>
    {#if panel === 'lists'}<SavedLists {store} idPrefix="pk-analysis" />{/if}
  </div>
</section>

<style>
  .toolbar {
    grid-area: toolbar;
    display: none;
    gap: 8px;
    padding: 6px 12px;
    background: var(--pk-surface);
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .panel {
    position: relative;
    overflow-y: auto;
    padding: 12px 14px 20px;
    background: var(--pk-bg);
    min-height: 0;
    min-width: 0;
  }
  .left {
    grid-area: left;
    border-right: 1px solid var(--pk-surface-2);
  }
  .right {
    grid-area: right;
    border-left: 1px solid var(--pk-surface-2);
  }
  .panel-close {
    display: none;
    justify-content: flex-end;
    margin-bottom: 4px;
  }
  .layers {
    margin-top: 12px;
  }
  .search {
    margin-bottom: 12px;
  }
  .drawer {
    grid-area: drawer;
    min-width: 0;
    background: var(--pk-bg);
    border-top: 1px solid var(--pk-surface-2);
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    background: var(--pk-surface);
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 14px;
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    color: var(--pk-text);
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .tab::after {
    content: '\25B4';
    font-size: 0.8rem;
  }
  .tab[aria-expanded='true'] {
    border-bottom-color: var(--pk-accent);
    background: var(--pk-bg);
  }
  .tab[aria-expanded='true']::after {
    content: '\25BE';
  }
  .count {
    font-weight: 400;
    color: var(--pk-muted);
  }
  .drawer-body {
    position: relative;
    max-height: 42vh;
    overflow-y: auto;
    padding: 8px 14px 12px;
  }

  /* Medium screens: the details panel opens over the right edge of the map. */
  @media (max-width: 1099px) {
    .toolbar {
      display: flex;
    }
    .right {
      grid-area: map;
      justify-self: end;
      align-self: stretch;
      width: min(360px, 100%);
      z-index: 4;
      box-shadow: var(--pk-shadow);
      display: none;
    }
    .right.open {
      display: block;
    }
    .not-wide {
      display: flex;
    }
  }

  /* Phones: both panels open over the map, one at a time. */
  @media (max-width: 767px) {
    .left {
      grid-area: map;
      z-index: 4;
      display: none;
      border-right: 0;
    }
    .left.open {
      display: block;
    }
    .right {
      width: 100%;
    }
    .narrow-only {
      display: flex;
    }
  }

  @media (min-width: 768px) {
    .narrow-only {
      display: none;
    }
  }
</style>
