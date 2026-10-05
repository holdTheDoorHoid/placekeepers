<script lang="ts">
  // The field view, phones first: search, "Near me", the main chips, and a bottom sheet listing
  // what you can do nearby: vacant lots and, with the Bus stops chip on, bus and trolley stops,
  // nearest first.
  import { tick } from 'svelte';
  import { FIELD_CHIPS } from '../../config/chips.ts';
  import { FILTERS, filterNarrows } from '../../config/filters.ts';
  import { STYLES, styleFor } from '../../map/styles/index.ts';
  import { mergeNearby } from '../../places/nearby.ts';
  import { distanceMeters, nearestPlaces, parcelLensOf } from '../../places/rank.ts';
  import { LOTS_DETAIL_ZOOM, isSampleFeature } from '../../places/sample.ts';
  import { PHILLY_BOUNDS } from '../../state/defaults.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import { nearestStops, stopLensOf } from '../../transit/comfort.ts';
  import Dialog from '../common/Dialog.svelte';
  import DossierPanel from '../dossier/DossierPanel.svelte';
  import LayerList from '../layers/LayerList.svelte';
  import SavedLists from '../lists/SavedLists.svelte';
  import PlaceCard from '../places/PlaceCard.svelte';
  import AddressSearch from '../search/AddressSearch.svelte';
  import FeatureDetails from '../streets/FeatureDetails.svelte';
  import MemorialList from '../streets/MemorialList.svelte';
  import StopCard from '../transit/StopCard.svelte';

  let { store }: { store: AppStore } = $props();

  /**
   * Below this zoom the view is too wide to call anything "nearby", and the map draws only a sample
   * of the parcels (src/places/sample.ts), so the list starts where every parcel is drawn.
   */
  const NEARBY_MIN_ZOOM = LOTS_DETAIL_ZOOM;
  /** Cards shown at first, and added by "Show more places", up to MAX_CARDS. */
  const CARDS_STEP = 5;
  const MAX_CARDS = 25;
  /** Memorials listed under the cards, nearest first. */
  const MAX_MEMORIALS = 10;

  let layersOpen = $state(false);
  let listsOpen = $state(false);
  let sheetOpen = $state(false);
  let locating = $state(false);
  let cardCount = $state(CARDS_STEP);

  const registry = $derived(store.registry);
  const lens = $derived(parcelLensOf(registry, store.state));
  const stopLens = $derived(stopLensOf(registry));
  const chips = $derived(
    FIELD_CHIPS.map((chip) => {
      const layers = chip.layers.filter((id) => registry.layers.some((l) => l.id === id));
      return { ...chip, layers, on: layers.length > 0 && layers.every((id) => store.state.layers.includes(id)) };
    }),
  );
  const lotsShown = $derived(
    registry.layers.some((l) => styleFor(l) === STYLES.vacant_parcels && store.state.layers.includes(l.id)),
  );
  const stopsShown = $derived(
    registry.layers.some((l) => styleFor(l) === STYLES.transit_stops && store.state.layers.includes(l.id)),
  );
  const nearby = $derived(store.state.map.zoom >= NEARBY_MIN_ZOOM);
  /** The person's location, while they use it and it is on the map; otherwise the map's middle. */
  const fromYou = $derived.by(() => {
    const at = store.userLocation;
    const b = store.viewBounds;
    return !!at && !!b && at[0] >= b[0] && at[0] <= b[2] && at[1] >= b[1] && at[1] <= b[3];
  });
  const anchor = $derived<[number, number]>(fromYou && store.userLocation ? store.userLocation : [store.state.map.lng, store.state.map.lat]);
  /**
   * Every parcel drawn, never the zoomed out sample: just after zooming in, the map can still show
   * the sample for a moment while the detailed tiles load.
   */
  const detailed = $derived(store.parcelsInView.filter((p) => !isSampleFeature(p.properties)));
  const lots = $derived(nearby ? nearestPlaces(registry, store.state, detailed, anchor, MAX_CARDS) : []);
  /** The stops drawn on the map with a suggestion switched on (the list follows the stops layer). */
  const stops = $derived(
    nearby && stopsShown ? nearestStops(registry, store.state, store.stopsInView, anchor, store.stopTable, MAX_CARDS) : [],
  );
  const all = $derived(mergeNearby(lots, stops, MAX_CARDS));
  const items = $derived(all.slice(0, cardCount));
  const places = $derived(items.flatMap((item) => (item.kind === 'place' ? [item.place] : [])));
  /** Nothing of the kinds on show is drawn here at all. */
  const empty = $derived((!lotsShown || detailed.length === 0) && (!stopsShown || store.stopsInView.length === 0));
  const narrowed = $derived(FILTERS.filter((f) => filterNarrows(f, store.state.filters[f.id])).length);
  const memorialsShown = $derived(
    registry.layers.some((l) => styleFor(l) === STYLES.memorials && store.state.layers.includes(l.id)),
  );
  /** The memorials drawn on the map, nearest first: the way to reach them without the map. */
  const memorials = $derived(
    nearby && memorialsShown
      ? [...store.memorialsInView].sort((a, b) => distanceMeters(anchor, a.lngLat) - distanceMeters(anchor, b.lngLat))
      : [],
  );

  /** The sheet's own button: where keyboard focus goes when the sheet closes under it. */
  let sheetToggle: HTMLButtonElement | undefined = $state();

  /** Closes the sheet to show the map, keeping keyboard focus on the sheet's button. */
  async function closeSheetForMap() {
    sheetOpen = false;
    await tick();
    sheetToggle?.focus();
  }

  // Addresses come from the lot dossiers, for the cards on show.
  $effect(() => {
    void store.addresses.request(places.map((p) => p.id));
  });

  function nearMe() {
    if (!('geolocation' in navigator)) {
      store.say(strings.field.nearMeUnsupported);
      return;
    }
    locating = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        locating = false;
        const { longitude: lng, latitude: lat } = position.coords;
        const [[west, south], [east, north]] = PHILLY_BOUNDS;
        if (lng < west || lng > east || lat < south || lat > north) {
          store.say(strings.field.nearMeOutside);
          return;
        }
        store.setUserLocation([lng, lat]);
        store.controller?.showUserLocation(lng, lat);
        cardCount = CARDS_STEP;
        sheetOpen = true;
      },
      (error) => {
        locating = false;
        store.say(error.code === error.PERMISSION_DENIED ? strings.field.nearMeDenied : strings.field.nearMeUnavailable);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function stopLocation() {
    store.setUserLocation(null);
    store.controller?.hideUserLocation();
  }
</script>

<div class="field-controls">
  <div class="row">
    <AddressSearch {store} idPrefix="pk-field" />
    <!-- Near me stays here while the location is in use (it finds the person again); stopping sits
         beside the note below, so the search box keeps its width on a phone. -->
    <button class="button small primary near-me" type="button" onclick={nearMe} disabled={locating} aria-describedby="pk-near-me-note">
      {locating ? strings.field.nearMeBusy : strings.field.nearMe}
    </button>
    <span id="pk-near-me-note" class="sr-only">{strings.field.nearMePrivacy}</span>
  </div>
  <div class="location" class:in-use={store.userLocation !== null}>
    <!-- Always in place, so screen readers announce the note when Near me fills it. -->
    <p class="location-note small" role="status">{store.userLocation ? strings.field.locationInUse : ''}</p>
    {#if store.userLocation}
      <button class="button quiet small stop" type="button" aria-label={strings.field.stopLocation} onclick={stopLocation}>{strings.field.stop}</button>
    {/if}
  </div>
  <div class="chips" role="group" aria-label={strings.field.chipsLabel}>
    {#each chips as chip (chip.id)}
      {#if chip.layers.length > 0}
        <button class="chip" type="button" aria-pressed={chip.on} onclick={() => store.setLayersVisible(chip.layers, !chip.on)}
          >{chip.label}</button
        >
      {:else}
        <button class="chip" type="button" aria-disabled="true" onclick={() => store.say(chip.soon ?? strings.chips.comingSoon)}>
          {chip.label} <span class="soon">({strings.chips.comingSoon})</span>
        </button>
      {/if}
    {/each}
    <button class="chip" type="button" aria-haspopup="dialog" onclick={() => (layersOpen = true)}>{strings.field.moreLayers}</button>
    <button class="chip" type="button" aria-haspopup="dialog" onclick={() => (listsOpen = true)}>{strings.field.myLists}</button>
  </div>
</div>

<section class="sheet" class:open={sheetOpen} id="places-section" tabindex="-1" aria-labelledby="pk-sheet-title" data-map-cover>
  <h2 id="pk-sheet-title">
    <button
      type="button"
      class="sheet-toggle"
      bind:this={sheetToggle}
      aria-expanded={sheetOpen}
      aria-controls="pk-places"
      onclick={() => (sheetOpen = !sheetOpen)}
    >
      <span class="grip" aria-hidden="true"></span>
      <span class="title">{strings.sheet.title}</span>
      {#if items.length > 0}<span class="count">{strings.sheet.countLabel(items.length)}</span>{/if}
      <span class="sr-only">{sheetOpen ? strings.sheet.hide : strings.sheet.show}</span>
    </button>
  </h2>
  <div id="pk-places" class="body" hidden={!sheetOpen}>
    {#if !lotsShown && !stopsShown}
      <p>{strings.sheet.noLotsLayer}</p>
    {:else if !nearby}
      <p>{strings.sheet.zoomIn}</p>
    {:else if lotsShown && detailed.length === 0 && store.parcelsSampled}
      <p role="status">{strings.sheet.finding}</p>
    {:else if empty}
      <p>{!stopsShown ? strings.sheet.nothingHere : !lotsShown ? strings.sheet.noStopsHere : strings.sheet.nothingHereStops}</p>
    {:else if items.length === 0}
      <p>{strings.sheet.noneWithSuggestion}</p>
    {:else}
      <p class="muted small order">{fromYou ? strings.sheet.nearestToYou : strings.sheet.nearestToCenter}</p>
      {#if narrowed}
        <p class="notice">
          {strings.filters.narrowedNote(narrowed)}
          <button class="button quiet small" type="button" onclick={() => store.clearFilters()}>{strings.filters.clear}</button>
        </p>
      {/if}
      <ul class="cards" aria-label={strings.sheet.title}>
        {#each items as item (item.key)}
          <li>
            {#if item.kind === 'place'}
              <PlaceCard {store} place={item.place} lensLabel={lens?.label ?? ''} {fromYou} onShow={() => void closeSheetForMap()} />
            {:else}
              <StopCard {store} stop={item.stop} lensLabel={stopLens?.label ?? ''} {fromYou} onShow={() => void closeSheetForMap()} />
            {/if}
          </li>
        {/each}
      </ul>
      {#if all.length > items.length}
        <button class="button quiet small" type="button" onclick={() => (cardCount += CARDS_STEP)}>{strings.sheet.showMore}</button>
      {/if}
    {/if}
    {#if memorials.length > 0}
      <section class="memorials" aria-labelledby="pk-sheet-memorials">
        <h3 id="pk-sheet-memorials">
          {strings.streets.memorialsNearby} <span class="count">{strings.streets.memorialCount(memorials.length)}</span>
        </h3>
        <p class="muted small">{strings.streets.memorialsIntro}</p>
        <MemorialList {store} memorials={memorials.slice(0, MAX_MEMORIALS)} />
        {#if memorials.length > MAX_MEMORIALS}<p class="muted small">{strings.streets.memorialsMore(memorials.length - MAX_MEMORIALS)}</p>{/if}
      </section>
    {/if}
  </div>
</section>

<Dialog bind:open={layersOpen} title={strings.field.layersTitle} id="pk-field-layers">
  <LayerList {store} idPrefix="field" />
</Dialog>

<Dialog bind:open={listsOpen} title={strings.field.listsTitle} id="pk-field-lists">
  <SavedLists {store} idPrefix="pk-field" onOpen={() => (listsOpen = false)} />
</Dialog>

<!-- The lot page: a full screen sheet on phones. Closing it keeps the parcel marked on the map. -->
<Dialog
  bind:open={() => store.dossierOpen && store.dossierView !== null, (open) => !open && (store.dossierOpen = false)}
  title={store.dossierView?.title ?? strings.dossier.pageTitle}
  id="pk-field-dossier"
>
  <DossierPanel
    {store}
    idPrefix="pk-field-dossier"
    onShowOnMap={() => {
      store.dossierOpen = false;
      if (store.dossier.center) store.controller?.flyTo(store.dossier.center);
      void closeSheetForMap();
    }}
  />
</Dialog>

<Dialog
  bind:open={() => store.inspected !== null && store.inspectedOpen, (open) => !open && store.inspect(null)}
  title={strings.streets.detailsTitle(store.registry.layers.find((l) => l.id === store.inspected?.layerId)?.style ?? '')}
  id="pk-field-feature"
>
  {#if store.inspected}<FeatureDetails {store} target={store.inspected} />{/if}
</Dialog>

<style>
  .field-controls {
    grid-area: controls;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
    background: var(--pk-surface);
    border-bottom: 1px solid var(--pk-surface-2);
    min-width: 0;
  }
  .row {
    display: flex;
    gap: 8px;
    min-width: 0;
  }
  .row {
    align-items: flex-start;
  }
  .near-me {
    flex: none;
    min-height: 40px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  /* Phones: one row of chips that scrolls sideways, so the map keeps its room. Its right edge
     fades, so it shows there is more to see; the last chip can scroll clear of the fade. */
  @media (max-width: 560px) {
    .chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      margin: 0 -12px;
      padding: 2px 40px 2px 12px;
      mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent);
    }
    .chips .chip {
      flex: none;
    }
  }
  .sheet {
    grid-area: map;
    align-self: end;
    justify-self: start;
    z-index: 3;
    width: min(100%, 520px);
    max-height: 62%;
    display: flex;
    flex-direction: column;
    background: var(--pk-bg);
    border-radius: 14px 14px 0 0;
    box-shadow: var(--pk-shadow);
  }
  /* A phone turned sideways: the open sheet runs down the left of the map, so the map stays in
     sight beside it instead of being squeezed under it. */
  @media (max-height: 500px) and (min-width: 560px) {
    .sheet.open {
      align-self: stretch;
      max-height: none;
      width: min(55%, 440px);
      border-radius: 0 14px 0 0;
    }
  }
  .sheet h2 {
    margin: 0;
    font-size: 1rem;
  }
  .sheet-toggle {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 10px;
    width: 100%;
    min-height: 52px;
    padding: 14px 16px 10px;
    border: 0;
    border-radius: 14px 14px 0 0;
    background: none;
    color: var(--pk-text);
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
    position: relative;
  }
  .grip {
    position: absolute;
    top: 5px;
    left: 50%;
    width: 40px;
    height: 4px;
    margin-left: -20px;
    border-radius: 2px;
    background: var(--pk-border);
  }
  .count {
    font-weight: 400;
    color: var(--pk-muted);
  }
  .body {
    position: relative;
    overflow-y: auto;
    padding: 0 16px 16px;
  }
  .cards {
    display: grid;
    gap: 10px;
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }
  .memorials {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--pk-surface-2);
  }
  .memorials h3 {
    margin-bottom: 2px;
  }
  .notice {
    margin-bottom: 8px;
  }
  .order {
    margin-bottom: 8px;
  }
  .location {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
  }
  /* Nothing to show until Near me is used: no room taken, but the status line stays in place. */
  .location:not(.in-use) {
    margin-top: -8px;
  }
  .location-note {
    flex: 1 1 14rem;
    margin: 0;
    color: var(--pk-muted);
  }
  .stop {
    flex: none;
  }
  @media (max-width: 560px) {
    .location-note {
      font-size: 0.8rem;
    }
  }
</style>
