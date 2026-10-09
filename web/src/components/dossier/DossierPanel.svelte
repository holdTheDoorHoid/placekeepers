<script lang="ts">
  // The open lot page, wired to the app: try again, turn on live data, show a layer, print,
  // show the parcel on the map, or clear the selection.
  import { config } from '../../config/index.ts';
  import type { OwnerListTarget } from '../../dossier/owners-table.ts';
  import type { SettingValue } from '../../registry/types.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { LIVE_CITY_DATA } from '../../state/options.ts';
  import { strings } from '../../strings.ts';
  import Dialog from '../common/Dialog.svelte';
  import ListToggle from '../lists/ListToggle.svelte';
  import Dossier from './Dossier.svelte';
  import OwnerList from './OwnerList.svelte';

  let {
    store,
    showTitle = false,
    idPrefix = 'pk-dossier',
    onShowOnMap,
    clearable = true,
  }: { store: AppStore; showTitle?: boolean; idPrefix?: string; onShowOnMap?: () => void; clearable?: boolean } = $props();

  const view = $derived(store.dossierView);
  let ownerList = $state.raw<OwnerListTarget | null>(null);
  const actions = $derived({
    onRetry: () => store.dossier.retry(),
    onTurnOnLive: () => store.setOption(LIVE_CITY_DATA, true),
    onShowLayer: (id: string, settings: Record<string, SettingValue> = {}, message?: string) => {
      for (const [setting, value] of Object.entries(settings)) store.setSetting(id, setting, value);
      store.setLayerVisible(id, true);
      if (message && store.state.layers.includes(id)) store.say(message);
    },
    onPrint: () => window.print(),
    onShowOnMap,
    onClear: clearable ? () => store.select(null) : undefined,
    onShowOwnerList: (target: OwnerListTarget) => (ownerList = target),
  });
</script>

{#if view}
  <Dossier {view} manifest={store.manifest} {showTitle} {idPrefix} {actions}>
    {#snippet tools()}
      {#if view && !view.loading}
        <ListToggle
          {store}
          id={view.opa}
          center={store.dossier.center}
          properties={store.dossier.tile}
          address={view.title !== strings.dossier.parcel(view.opa) ? view.title : null}
        />
      {/if}
    {/snippet}
  </Dossier>
{/if}

<Dialog bind:open={() => ownerList !== null, (open) => !open && (ownerList = null)} title={strings.dossier.ownerList.title} id="{idPrefix}-owner-list">
  {#if ownerList}
    <OwnerList
      {store}
      target={ownerList}
      dataBase={config.dataBase}
      onOpen={(id) => {
        ownerList = null;
        store.flyToSelection = true;
        store.select(id, null);
      }}
    />
  {/if}
</Dialog>
