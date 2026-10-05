<script lang="ts">
  // The field view, phones first: search, "Near me", the three main chips, and a bottom
  // sheet listing what you can do nearby.
  import { FIELD_CHIPS } from '../../config/chips.ts';
  import { FILTERS, filterNarrows } from '../../config/filters.ts';
  import { STYLES, styleFor } from '../../map/styles/index.ts';
  import { nearestPlaces, parcelLensOf } from '../../places/rank.ts';
  import { PHILLY_BOUNDS } from '../../state/defaults.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import Dialog from '../common/Dialog.svelte';
  import DossierPanel from '../dossier/DossierPanel.svelte';
  import LayerList from '../layers/LayerList.svelte';
  import SavedLists from '../lists/SavedLists.svelte';
  import PlaceCard from '../places/PlaceCard.svelte';
  import AddressSearch from '../search/AddressSearch.svelte';
  import FeatureDetails from '../streets/FeatureDetails.svelte';

  let { store }: { store: AppStore } = $props();

  /** Below this zoom the view is too wide to call anything "nearby". */
  const NEARBY_MIN_ZOOM = 13;
  /** Cards shown at first, and added by "Show more places", up to MAX_CARDS. */
  const CARDS_STEP = 5;
  const MAX_CARDS = 25;

  let layersOpen = $state(false);
  let listsOpen = $state(false);
  let sheetOpen = $state(false);
  let locating = $state(false);
  let cardCount = $state(CARDS_STEP);

  const registry = $derived(store.registry);
  const lens = $derived(parcelLensOf(registry));
  const chips = $derived(
    FIELD_CHIPS.map((chip) => {
      const layers = chip.layers.filter((id) => registry.layers.some((l) => l.id === id));
      return { ...chip, layers, on: layers.length > 0 && layers.every((id) => store.state.layers.includes(id)) };
    }),
  );
  const lotsShown = $derived(
    registry.layers.some((l) => styleFor(l) === STYLES.vacant_parcels && store.state.layers.includes(l.id)),
  );
  const nearby = $derived(store.state.map.zoom >= NEARBY_MIN_ZOOM);
  /** The person's location, while they use it and it is on the map; otherwise the map's middle. */
  const fromYou = $derived.by(() => {
    const at = store.userLocation;
    const b = store.viewBounds;
    return !!at && !!b && at[0] >= b[0] && at[0] <= b[2] && at[1] >= b[1] && at[1] <= b[3];
  });
  const anchor = $derived<[number, number]>(fromYou && store.userLocation ? store.userLocation : [store.state.map.lng, store.state.map.lat]);
  const all = $derived(nearby ? nearestPlaces(registry, store.state, store.parcelsInView, anchor, MAX_CARDS) : []);
  const places = $derived(all.slice(0, cardCount));
  const narrowed = $derived(FILTERS.filter((f) => filterNarrows(f, store.state.filters[f.id])).length);

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
    {#if store.userLocation}
      <button class="button small near-me" type="button" onclick={stopLocation}>{strings.field.stopLocation}</button>
    {:else}
      <button class="button small primary near-me" type="button" onclick={nearMe} disabled={locating} aria-describedby="pk-near-me-note">
        {locating ? strings.field.nearMeBusy : strings.field.nearMe}
      </button>
      <span id="pk-near-me-note" class="sr-only">{strings.field.nearMePrivacy}</span>
    {/if}
  </div>
  {#if store.userLocation}<p class="location-note small" role="status">{strings.field.locationInUse}</p>{/if}
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
    <button type="button" class="sheet-toggle" aria-expanded={sheetOpen} aria-controls="pk-places" onclick={() => (sheetOpen = !sheetOpen)}>
      <span class="grip" aria-hidden="true"></span>
      <span class="title">{strings.sheet.title}</span>
      {#if places.length > 0}<span class="count">{strings.sheet.countLabel(places.length)}</span>{/if}
      <span class="sr-only">{sheetOpen ? strings.sheet.hide : strings.sheet.show}</span>
    </button>
  </h2>
  <div id="pk-places" class="body" hidden={!sheetOpen}>
    {#if !lotsShown}
      <p>{strings.sheet.noLotsLayer}</p>
    {:else if !nearby}
      <p>{strings.sheet.zoomIn}</p>
    {:else if store.parcelsInView.length === 0}
      <p>{strings.sheet.nothingHere}</p>
    {:else if places.length === 0}
      <p>{strings.sheet.noneWithSuggestion}</p>
    {:else}
      <p class="muted small order">{fromYou ? strings.sheet.nearestToYou : strings.sheet.nearestToCenter}</p>
      {#if narrowed}
        <p class="notice">
          {strings.filters.narrowedNote(narrowed)}
          <button class="button quiet small" type="button" onclick={() => store.clearFilters()}>{strings.filters.clear}</button>
        </p>
      {/if}
      <div class="cards">
        {#each places as place (place.id)}
          <PlaceCard {store} {place} lensLabel={lens?.label ?? ''} {fromYou} onShow={() => (sheetOpen = false)} />
        {/each}
      </div>
      {#if all.length > places.length}
        <button class="button quiet small" type="button" onclick={() => (cardCount += CARDS_STEP)}>{strings.sheet.showMore}</button>
      {/if}
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
      sheetOpen = false;
      if (store.dossier.center) store.controller?.flyTo(store.dossier.center);
    }}
  />
</Dialog>

<Dialog
  bind:open={() => store.inspected !== null, (open) => !open && store.inspect(null)}
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
  /* Phones: one row of chips that scrolls sideways, so the map keeps its room. */
  @media (max-width: 560px) {
    .chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      margin: 0 -12px;
      padding: 2px 12px;
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
    margin-bottom: 8px;
  }
  .notice {
    margin-bottom: 8px;
  }
  .order {
    margin-bottom: 8px;
  }
  .location-note {
    margin: 0;
    color: var(--pk-muted);
  }
</style>
