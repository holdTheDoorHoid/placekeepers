<script lang="ts">
  // The open lot page, wired to the app: try again, turn on live data, show a layer, print,
  // show the parcel on the map, or clear the selection.
  import { config } from '../../config/index.ts';
  import type { OwnerListTarget } from '../../dossier/owners-table.ts';
  import type { TimelineKind } from '../../dossier/timeline.ts';
  import type { SettingValue } from '../../registry/types.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { LIVE_CITY_DATA } from '../../state/options.ts';
  import { strings } from '../../strings.ts';
  import Dialog from '../common/Dialog.svelte';
  import ListToggle from '../lists/ListToggle.svelte';
  import Dossier from './Dossier.svelte';
  import OldAerialPhotos from './OldAerialPhotos.svelte';
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
    onShowLayer: (id: string) => store.setLayerVisible(id, true),
    // The printed page lists the timeline's newest records, so they are fetched first.
    onPrint: async () => {
      await store.dossier.loadHistory();
      window.print();
    },
    onOpenHistory: () => void store.dossier.loadHistory(),
    onToggleKind: (kind: TimelineKind) => store.dossier.toggleKind(kind),
    onShowOnMap,
    onClear: clearable ? () => store.select(null) : undefined,
    onShowOwnerList: (target: OwnerListTarget) => (ownerList = target),
  });

  /** The first year of the aerial photos' slider, where the lot page's button opens them (M4.3). */
  const oldestPhotoYear = $derived.by(() => {
    const year = store.registry.layers.find((l) => l.id === 'aerial_photos')?.settings.find((s) => s.id === 'year');
    return year?.type === 'choice' ? (year.options[0]?.value ?? '') : '';
  });

  /** Turns on a layer with some of its settings, as the old aerial photos button does (M4.3). */
  function showLayerWith(id: string, settings: Record<string, SettingValue> = {}, message?: string) {
    for (const [setting, value] of Object.entries(settings)) store.setSetting(id, setting, value);
    store.setLayerVisible(id, true);
    if (message && store.state.layers.includes(id)) store.say(message);
  }
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
    {#snippet historyExtra()}
      <OldAerialPhotos oldest={oldestPhotoYear} liveOn={store.liveCityData} onShowLayer={showLayerWith} {onShowOnMap} onTurnOnLive={actions.onTurnOnLive} />
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
