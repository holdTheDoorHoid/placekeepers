<script lang="ts">
  // Hosts the MapLibre map. The map code is loaded after the page appears, so the panels
  // and text show up first on slow connections.
  import { onMount, untrack } from 'svelte';
  import { config } from '../config/index.ts';
  import { extractAvailable } from '../map/basemap-mode.ts';
  import type { MapController } from '../map/controller.ts';
  import { pagePadding } from '../map/covered.ts';
  import type { AppStore } from '../state/store.svelte.ts';
  import { strings } from '../strings.ts';

  let { store }: { store: AppStore } = $props();
  let container: HTMLDivElement;
  /** Until the map has drawn once with its data, a loading note covers it. */
  let ready = $state(false);
  let failed = $state(false);
  /** A selection from the link the page opened with, to bring into view once its place is known. */
  let restoring = untrack(() => store.state.selected !== null);

  function refreshFromMap() {
    const controller = store.controller;
    if (!controller) return;
    store.viewBounds = controller.bounds();
    store.parcelsInView = controller.parcelsInView();
    store.memorialsInView = controller.memorialsInView();
    const selected = store.state.selected;
    if (selected && !store.selectedProperties) {
      const found = controller.findParcel(selected);
      if (found) {
        // A point on the parcel, for "Show on map" and street imagery, when nothing else gave one.
        if (store.dossier.opa === selected && !store.dossier.center) store.dossier.center = found.center;
        store.selectedProperties = found.properties;
      }
    }
  }

  onMount(() => {
    let disposed = false;
    let controller: MapController | null = null;
    (async () => {
      // Ask whether the base map file is there while the map library downloads, not after.
      const extract = config.basemap === 'protomaps' ? extractAvailable(config.dataBase) : undefined;
      const [{ MapController }, { chooseBasemap, isProtomaps, warmLabelFont }] = await Promise.all([
        import('../map/controller.ts'),
        import('../map/basemap.ts'),
      ]);
      const basemap = await chooseBasemap(config.basemap, config.dataBase, fetch, extract);
      if (isProtomaps(basemap.style)) warmLabelFont(config.dataBase);
      if (disposed) return;
      store.basemapMissing = basemap.missing;
      controller = new MapController({
        container,
        registry: store.registry,
        dataBase: config.dataBase,
        siteBase: config.siteBase,
        padding: () => pagePadding(container),
        style: basemap.style,
        state: $state.snapshot(store.state),
        manifest: store.manifest,
        events: {
          move: (position, byPerson) => store.setMap(position, byPerson),
          select: (id, properties, lngLat) => store.select(id, properties, { center: lngLat ?? null }),
          pick: (lngLat) => void store.pickAt(lngLat),
          inspect: (target) => store.inspect(target),
          idle: refreshFromMap,
          ready: () => {
            ready = true;
            store.mapReady = true;
          },
          layerStatus: (id, status) => (store.layerStatus = { ...store.layerStatus, [id]: status }),
        },
      });
      store.controller = controller;
      // The end to end tests watch the camera through this, for example that the map jumps
      // instead of flying for people who prefer reduced motion. Only in the tests' build.
      if (__PK_E2E__) (window as unknown as { pkMap?: unknown }).pkMap = controller.map;
    })().catch((error: unknown) => {
      // Most often a browser or device without WebGL, which MapLibre needs to draw.
      console.warn('Placekeepers map:', error);
      failed = true;
    });
    return () => {
      disposed = true;
      controller?.destroy();
      store.controller = null;
    };
  });

  $effect(() => {
    const snapshot = $state.snapshot(store.state);
    store.controller?.setState(snapshot);
  });

  $effect(() => {
    const manifest = store.manifest;
    store.controller?.setManifest(manifest);
  });

  $effect(() => {
    const inspected = store.inspected;
    store.controller?.setInspected(inspected);
  });

  // A link that opens with a lot page: once the map has drawn and the parcel's place is known, bring
  // it to the middle of the part of the map the lot page leaves uncovered, at the link's zoom.
  $effect(() => {
    const center = store.dossier.center;
    if (!restoring || !ready || !center || !store.controller || store.dossier.opa !== store.state.selected) return;
    restoring = false;
    store.controller.showPlace(center);
  });

  // After a search by parcel number, fly there once the parcel's place is known.
  $effect(() => {
    const center = store.dossier.center;
    if (!store.flyToSelection || !center || !store.controller) return;
    store.flyToSelection = false;
    store.controller.flyTo(center);
  });

  // A parcel opened by a lookup (not from the lots layer) is outlined from its City shape.
  $effect(() => {
    const shape = store.dossier.opa && !store.dossier.tile ? store.dossier.shape : null;
    store.controller?.setSelectedShape(shape);
  });
</script>

<div class="map-wrap" data-map-ready={ready ? 'true' : 'false'}>
  <div class="map" bind:this={container}></div>
  {#if failed}
    <p class="loading failed" role="alert">{strings.app.mapFailed}</p>
  {:else if !ready}
    <div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>{strings.app.loadingMap}</div>
  {/if}
  {#if store.picking}<p class="notice picking" role="status">{strings.pick.looking}</p>{/if}
  {#if store.userLocation && store.state.view === 'analysis'}
    <p class="notice location">
      {strings.field.locationInUse}
      <button
        class="button quiet small"
        type="button"
        onclick={() => {
          store.setUserLocation(null);
          store.controller?.hideUserLocation();
        }}>{strings.field.stopLocation}</button
      >
    </p>
  {/if}
  {#if store.basemapMissing}<p class="notice basemap-note" class:below-credits={store.state.view === 'field'}>{strings.basemap.missing}</p>{/if}
</div>

<style>
  .map-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: #ecebe4;
    /* Notes and buttons on the map never spill onto the panels around it. */
    overflow: hidden;
  }
  .map {
    position: absolute;
    inset: 0;
  }
  .loading {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 0;
    padding: 16px;
    background: rgba(236, 235, 228, 0.85);
    color: var(--pk-text);
    font-weight: 600;
    text-align: center;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 4px solid var(--pk-surface-2);
    border-top-color: var(--pk-accent);
    border-radius: 50%;
    animation: pk-spin 0.9s linear infinite;
  }
  @keyframes pk-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .picking {
    position: absolute;
    left: 50%;
    top: 8px;
    transform: translateX(-50%);
    z-index: 2;
    box-shadow: var(--pk-shadow);
  }
  .location {
    position: absolute;
    left: 8px;
    bottom: 32px;
    max-width: min(420px, calc(100% - 16px));
    z-index: 2;
    box-shadow: var(--pk-shadow);
  }
  .basemap-note {
    position: absolute;
    left: 8px;
    top: 8px;
    max-width: min(360px, calc(100% - 70px));
    z-index: 2;
    box-shadow: var(--pk-shadow);
  }
  /* In the field view the credits line has the top left corner. */
  .basemap-note.below-credits {
    top: 48px;
  }
</style>
