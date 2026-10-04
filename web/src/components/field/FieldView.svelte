<script lang="ts">
  // The field view, phones first: search, "Near me", the three main chips, and a bottom
  // sheet listing what you can do nearby.
  import { FIELD_CHIPS } from '../../config/chips.ts';
  import { STYLES, styleFor } from '../../map/styles/index.ts';
  import { parcelLensOf, rankPlaces } from '../../places/rank.ts';
  import { PHILLY_BOUNDS } from '../../state/defaults.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import Dialog from '../common/Dialog.svelte';
  import LayerList from '../layers/LayerList.svelte';
  import PlaceCard from '../places/PlaceCard.svelte';

  let { store }: { store: AppStore } = $props();

  /** Below this zoom the view is too wide to call anything "nearby". */
  const NEARBY_MIN_ZOOM = 13;

  let layersOpen = $state(false);
  let sheetOpen = $state(false);
  let locating = $state(false);

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
  const places = $derived(nearby ? rankPlaces(registry, store.state, store.parcelsInView, 5) : []);
  const allOff = $derived(places.length > 0 && places.every((p) => p.why?.allOff));
  const noScores = $derived(!allOff && places.length > 0 && places.every((p) => p.score === null));

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
        store.controller?.showUserLocation(lng, lat);
      },
      (error) => {
        locating = false;
        store.say(error.code === error.PERMISSION_DENIED ? strings.field.nearMeDenied : strings.field.nearMeUnavailable);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
</script>

<div class="field-controls">
  <div class="row">
    <form
      class="search"
      role="search"
      onsubmit={(e) => {
        e.preventDefault();
        store.say(strings.field.searchSoon);
      }}
    >
      <label class="sr-only" for="pk-search">{strings.field.searchLabel}</label>
      <input id="pk-search" type="search" placeholder={strings.field.searchPlaceholder} />
      <button class="button small search-button" type="submit">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
          ><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4" /><path
            d="M15.5 15.5 21 21"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          /></svg
        >
        <span class="sr-only">{strings.field.searchButton}</span>
      </button>
    </form>
    <button class="button small primary" type="button" onclick={nearMe} disabled={locating} aria-describedby="pk-near-me-note">
      {locating ? strings.field.nearMeBusy : strings.field.nearMe}
    </button>
    <span id="pk-near-me-note" class="sr-only">{strings.field.nearMePrivacy}</span>
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
  </div>
</div>

<section class="sheet" class:open={sheetOpen} id="places-section" tabindex="-1" aria-labelledby="pk-sheet-title">
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
    {:else if places.length === 0}
      <p>{strings.sheet.nothingHere}</p>
    {:else}
      {#if allOff}<p class="notice">{strings.sheet.allOff}</p>{/if}
      {#if noScores}<p class="notice">{strings.sheet.noScores}</p>{/if}
      <div class="cards">
        {#each places as place (place.id)}
          <PlaceCard {store} {place} lensLabel={lens?.label ?? ''} onShow={() => (sheetOpen = false)} />
        {/each}
      </div>
      <p class="muted small">{strings.sheet.preview}</p>
    {/if}
  </div>
</section>

<Dialog bind:open={layersOpen} title={strings.field.layersTitle} id="pk-field-layers">
  <LayerList {store} idPrefix="field" />
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
  .search {
    display: flex;
    flex: 1;
    gap: 6px;
    min-width: 0;
  }
  .search input {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    padding: 6px 10px;
    border: 1px solid var(--pk-border);
    border-radius: var(--pk-radius);
    font: inherit;
  }
  .search-button {
    padding: 6px 10px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
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
</style>
