<script lang="ts">
  // The open lot page, wired to the app: try again, turn on live data, show a layer, print,
  // show the parcel on the map, or clear the selection.
  import type { AppStore } from '../../state/store.svelte.ts';
  import { LIVE_CITY_DATA } from '../../state/options.ts';
  import Dossier from './Dossier.svelte';

  let {
    store,
    showTitle = false,
    idPrefix = 'pk-dossier',
    onShowOnMap,
    clearable = true,
  }: { store: AppStore; showTitle?: boolean; idPrefix?: string; onShowOnMap?: () => void; clearable?: boolean } = $props();

  const view = $derived(store.dossierView);
  const actions = $derived({
    onRetry: () => store.dossier.retry(),
    onTurnOnLive: () => store.setOption(LIVE_CITY_DATA, true),
    onShowLayer: (id: string) => store.setLayerVisible(id, true),
    onPrint: () => window.print(),
    onShowOnMap,
    onClear: clearable ? () => store.select(null) : undefined,
  });
</script>

{#if view}
  <Dossier {view} manifest={store.manifest} {showTitle} {idPrefix} {actions} />
{/if}
