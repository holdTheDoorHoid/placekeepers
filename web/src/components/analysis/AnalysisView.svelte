<script lang="ts">
  // The analysis view, desktop first: lens sliders, filters and layers on the left, the
  // selected place or a summary of the area on the right, and a ranked list underneath.
  // On narrower screens the side panels become panels that open over the map.
  import { tick } from 'svelte';
  import { STYLES, styleFor } from '../../map/styles/index.ts';
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
  import MemorialList from '../streets/MemorialList.svelte';
  import Filters from './Filters.svelte';
  import NeedPlot from './NeedPlot.svelte';

  let { store }: { store: AppStore } = $props();

  type Panel = 'table' | 'plot' | 'lists' | 'memorials';
  type Side = 'left' | 'right';
  let leftOpen = $state(false);
  let rightOpen = $state(false);
  let leftToggle: HTMLButtonElement | undefined = $state();
  let rightToggle: HTMLButtonElement | undefined = $state();
  let leftPanel: HTMLElement | undefined = $state();
  let rightPanel: HTMLElement | undefined = $state();
  /** Screen widths where each side panel opens over the map instead of sitting beside it. */
  const OVER_MAP: Record<Side, string> = { left: '(max-width: 767px)', right: '(max-width: 1099px)' };
  /** Which part of the drawer under the map is open, if any. */
  let panel = $state<Panel | null>(null);
  let order = $state<ScoreOrder>('desc');

  /** Zoomed out, the map draws only a sample of the parcels, so nothing here lists or counts them. */
  const sampled = $derived(store.parcelsSampled);
  const ranked = $derived(sampled ? [] : rankPlaces(store.registry, store.state, store.parcelsInView, Infinity, order));
  const panels: { id: Panel; label: string }[] = [
    { id: 'table', label: strings.analysis.tabTable },
    { id: 'plot', label: strings.analysis.tabPlot },
    { id: 'lists', label: strings.analysis.tabLists },
    { id: 'memorials', label: strings.analysis.tabMemorials },
  ];
  const listCount = $derived(store.lists.active?.places.length ?? 0);
  /** Most memorials listed at once, newest first. */
  const MAX_MEMORIALS = 200;
  const memorialsShown = $derived(
    store.registry.layers.some((l) => styleFor(l) === STYLES.memorials && store.state.layers.includes(l.id)),
  );
  /** The memorials drawn on the map, newest first: the way to reach them without the map. */
  const memorials = $derived(
    memorialsShown
      ? [...store.memorialsInView].sort((a, b) => String(b.properties.d ?? '').localeCompare(String(a.properties.d ?? '')))
      : [],
  );

  function overMap(side: Side): boolean {
    return window.matchMedia(OVER_MAP[side]).matches;
  }

  /**
   * Opens or closes a side panel. Where the panel opens over the map, keyboard focus moves into it
   * when it opens and back to its button when it closes, so it never sits behind the panel.
   */
  async function setPanel(side: Side, open: boolean) {
    if (side === 'left') leftOpen = open;
    else rightOpen = open;
    if (!overMap(side)) return;
    await tick();
    if (open) (side === 'left' ? leftPanel : rightPanel)?.querySelector<HTMLElement>('.panel-close button')?.focus();
    else (side === 'left' ? leftToggle : rightToggle)?.focus();
  }

  /** Escape closes a panel that covers the map, as it closes the other panels on the page. */
  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const target = event.target as Node | null;
    for (const side of ['left', 'right'] as const) {
      const panel = side === 'left' ? leftPanel : rightPanel;
      const open = side === 'left' ? leftOpen : rightOpen;
      if (open && panel?.contains(target) && overMap(side)) {
        event.preventDefault();
        void setPanel(side, false);
      }
    }
  }

  /** Flies to the open lot. On phones the details panel covers the whole map, so it closes first. */
  function showOnMap() {
    const center = store.dossier.center;
    if (!center || !store.controller) return;
    if (store.controller.coverPadding() === null) void setPanel('right', false);
    store.controller.flyTo(center);
  }

  function toggle(id: Panel) {
    panel = panel === id ? null : id;
  }

  /** The places in view for a download, highest score first (the download keeps the first 500). */
  function inView() {
    // Never a sample: downloads are off while zoomed out, and this checks again at the moment.
    if (store.parcelsSampled) return [];
    return rankPlaces(store.registry, store.state, store.parcelsInView).map((p) => ({ id: p.id, center: p.center, properties: p.properties }));
  }

  // Selecting a place, or tapping a memorial, crash or street block, opens the details panel on
  // screens where it is hidden.
  $effect(() => {
    if (store.state.selected || store.inspected) rightOpen = true;
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="toolbar">
  <button
    class="button small narrow-only"
    type="button"
    bind:this={leftToggle}
    aria-expanded={leftOpen}
    aria-controls="pk-left"
    onclick={() => void setPanel('left', !leftOpen)}>{strings.analysis.openLeft}</button
  >
  <button
    class="button small"
    type="button"
    bind:this={rightToggle}
    aria-expanded={rightOpen}
    aria-controls="pk-right"
    onclick={() => void setPanel('right', !rightOpen)}>{strings.analysis.openRight}</button
  >
</div>

<aside id="pk-left" class="panel left" class:open={leftOpen} aria-label={strings.analysis.leftTitle} data-map-cover bind:this={leftPanel}>
  <div class="panel-close narrow-only">
    <button class="icon-button" type="button" aria-label={strings.analysis.closePanel} onclick={() => void setPanel('left', false)}>&times;</button>
  </div>
  <div class="search"><AddressSearch {store} idPrefix="pk-analysis" /></div>
  {#each store.registry.lenses as lens (lens.id)}
    <LensPanel {store} {lens} idPrefix="left" level={2} />
  {/each}
  <Filters {store} />
  <section class="layers" aria-labelledby="pk-left-layers">
    <h2 id="pk-left-layers">{strings.layers.title}</h2>
    <LayerList {store} idPrefix="left" />
  </section>
</aside>

<aside id="pk-right" class="panel right" class:open={rightOpen} aria-label={strings.analysis.rightTitle} data-map-cover bind:this={rightPanel}>
  <div class="panel-close not-wide">
    <button class="icon-button" type="button" aria-label={strings.analysis.closePanel} onclick={() => void setPanel('right', false)}>&times;</button>
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
      onShowOnMap={store.dossier.center ? showOnMap : undefined}
    />
  {:else}
    <AreaSummary places={ranked} {sampled} />
  {/if}
</aside>

<section class="drawer" id="places-section" tabindex="-1" aria-labelledby="pk-drawer-title">
  <h2 id="pk-drawer-title" class="sr-only">{strings.analysis.drawerLabel}</h2>
  <div class="tabs" role="group" aria-labelledby="pk-drawer-title">
    {#each panels as item (item.id)}
      <button type="button" class="tab" aria-expanded={panel === item.id} aria-controls="pk-drawer-{item.id}" onclick={() => toggle(item.id)}>
        <span>{item.label}</span>
        {#if item.id === 'table'}<span class="count">{sampled ? strings.analysis.sampleTab : strings.sheet.countLabel(ranked.length)}</span>{/if}
        {#if item.id === 'lists' && store.lists.active}<span class="count">{strings.lists.count(listCount)}</span>{/if}
        {#if item.id === 'memorials' && memorialsShown}<span class="count">{strings.streets.memorialCount(memorials.length)}</span>{/if}
      </button>
    {/each}
  </div>
  <div id="pk-drawer-table" class="drawer-body" hidden={panel !== 'table'}>
    {#if panel === 'table'}
      <ExportButtons {store} places={inView} title={strings.export.inView} idPrefix="pk-view" off={sampled ? strings.export.sampleOff : null} />
      {#if sampled}
        <p class="notice sample" role="status">{strings.analysis.sampleList}</p>
      {:else}
        <RankedTable {store} places={ranked} {order} onOrder={(next) => (order = next)} />
      {/if}
    {/if}
  </div>
  <!-- The plot has nothing to tab to (the ranked list is its keyboard alternative), so its box
       takes focus itself, letting the arrow keys scroll it (WCAG 2.1.1). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div id="pk-drawer-plot" class="drawer-body" hidden={panel !== 'plot'} tabindex="0" role="region" aria-label={strings.analysis.tabPlot}>
    {#if panel === 'plot'}
      {#if sampled}
        <p class="notice sample" role="status">{strings.analysis.sampleList}</p>
      {:else}
        <NeedPlot {store} places={ranked} idPrefix="pk-analysis" />
      {/if}
    {/if}
  </div>
  <div id="pk-drawer-lists" class="drawer-body" hidden={panel !== 'lists'}>
    {#if panel === 'lists'}<SavedLists {store} idPrefix="pk-analysis" />{/if}
  </div>
  <div id="pk-drawer-memorials" class="drawer-body" hidden={panel !== 'memorials'}>
    {#if panel === 'memorials'}
      <h3 class="sr-only">{strings.streets.memorialsInView}</h3>
      {#if !memorialsShown}
        <p class="muted">{strings.streets.memorialsLayerOff}</p>
      {:else if memorials.length === 0}
        <p class="muted">{strings.streets.memorialsNone}</p>
      {:else}
        <p class="muted small">{strings.streets.memorialsIntro}</p>
        <MemorialList {store} memorials={memorials.slice(0, MAX_MEMORIALS)} />
        {#if memorials.length > MAX_MEMORIALS}<p class="muted small">{strings.streets.memorialsMore(memorials.length - MAX_MEMORIALS)}</p>{/if}
      {/if}
    {/if}
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

  /* Phones: both panels open over the map, one at a time, and the drawer's tabs stay in one row
     that scrolls sideways, with a fade at its right edge to show there are more. */
  @media (max-width: 767px) {
    .tabs {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      padding-right: 32px;
      mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
    }
    .tab {
      flex: none;
      padding: 8px 12px;
    }
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
