<script lang="ts">
  // Hosts the MapLibre map. The map code is loaded after the page appears, so the panels
  // and text show up first on slow connections.
  import { onMount } from 'svelte';
  import { config } from '../config/index.ts';
  import type { MapController } from '../map/controller.ts';
  import type { AppStore } from '../state/store.svelte.ts';
  import { strings } from '../strings.ts';

  let { store }: { store: AppStore } = $props();
  let container: HTMLDivElement;
  let loading = $state(true);

  function refreshFromMap() {
    const controller = store.controller;
    if (!controller) return;
    store.parcelsInView = controller.parcelsInView();
    const selected = store.state.selected;
    if (selected && !store.selectedProperties) store.selectedProperties = controller.findParcel(selected);
  }

  onMount(() => {
    let disposed = false;
    let controller: MapController | null = null;
    (async () => {
      const [{ MapController }, { chooseBasemap }] = await Promise.all([
        import('../map/controller.ts'),
        import('../map/basemap.ts'),
      ]);
      const basemap = await chooseBasemap(config.basemap, config.dataBase);
      if (disposed) return;
      store.basemapMissing = basemap.missing;
      controller = new MapController({
        container,
        registry: store.registry,
        dataBase: config.dataBase,
        style: basemap.style,
        state: $state.snapshot(store.state),
        manifest: store.manifest,
        events: {
          move: (position) => store.setMap(position),
          select: (id, properties) => store.select(id, properties),
          inspect: (target) => store.inspect(target),
          idle: refreshFromMap,
          layerStatus: (id, status) => (store.layerStatus = { ...store.layerStatus, [id]: status }),
        },
      });
      store.controller = controller;
      loading = false;
    })();
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
</script>

<div class="map-wrap">
  <div class="map" bind:this={container}></div>
  {#if loading}<p class="loading" role="status">{strings.app.loadingMap}</p>{/if}
  {#if store.basemapMissing}<p class="notice basemap-note">{strings.basemap.missing}</p>{/if}
</div>

<style>
  .map-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: #ecebe4;
  }
  .map {
    position: absolute;
    inset: 0;
  }
  .loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: var(--pk-muted);
  }
  .basemap-note {
    position: absolute;
    left: 8px;
    top: 8px;
    max-width: min(360px, calc(100% - 70px));
    z-index: 2;
    box-shadow: var(--pk-shadow);
  }
</style>
