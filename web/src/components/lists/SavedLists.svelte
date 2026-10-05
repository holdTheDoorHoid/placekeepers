<script lang="ts">
  // Saved lists: choose the list in use, make, rename and delete lists, open or remove places,
  // download a list with its owner details, and open a list file. Lists stay in this browser; a
  // downloaded file is how a list moves to another device or to someone else.
  import { MAX_LISTS, MAX_LIST_PLACES, type SavedPlace } from '../../places/lists.svelte.ts';
  import { MAX_IMPORT_BYTES, parseListFile } from '../../places/import.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import ExportButtons from '../places/ExportButtons.svelte';

  let { store, idPrefix, onOpen }: { store: AppStore; idPrefix: string; onOpen?: () => void } = $props();

  const s = strings.lists;
  const lists = $derived(store.lists.lists);
  const active = $derived(store.lists.active);
  let naming = $state<'new' | 'rename' | null>(null);
  let name = $state('');
  let importMessage = $state('');

  // Saved places learn their addresses as they become known.
  $effect(() => {
    const places = active?.places ?? [];
    void store.addresses.request(places.filter((p) => !p.address).map((p) => p.id));
  });

  function placeName(place: SavedPlace): string {
    return place.address ?? store.addresses.get(place.id) ?? strings.place.parcel(place.id);
  }

  function kindOf(place: SavedPlace): string {
    const k = place.properties?.k;
    return k === 1 ? strings.place.kindLot : k === 2 ? strings.place.kindBuilding : '';
  }

  function startNaming(kind: 'new' | 'rename') {
    naming = kind;
    name = kind === 'rename' && active ? active.name : '';
  }

  function submitName(event: SubmitEvent) {
    event.preventDefault();
    if (naming === 'new') {
      if (!store.lists.create(name || s.defaultName)) store.say(s.tooMany(MAX_LISTS));
    } else if (naming === 'rename' && active) store.lists.rename(active.id, name);
    naming = null;
  }

  function remove() {
    if (!active) return;
    if (!window.confirm(s.confirmDelete(active.name, active.places.length))) return;
    store.lists.delete(active.id);
  }

  function open(place: SavedPlace) {
    onOpen?.();
    store.select(place.id, null, { center: place.center });
    if (place.center) store.controller?.flyTo(place.center);
    else store.flyToSelection = true;
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      importMessage = s.importTooBig;
      return;
    }
    const result = parseListFile(await file.text(), file.name, s.untitled);
    if (!result.ok) {
      importMessage = result.reason === 'too_big' ? s.importTooBig : s.importFailed;
      return;
    }
    const list = store.lists.create(result.list.name, result.list.places);
    if (!list) {
      importMessage = s.tooMany(MAX_LISTS);
      return;
    }
    for (const place of result.list.places) if (place.address) store.addresses.remember(place.id, place.address);
    importMessage = [s.imported(list.name, list.places.length), result.list.leftOut ? s.importLeftOut(result.list.leftOut, MAX_LIST_PLACES) : '']
      .filter(Boolean)
      .join(' ');
  }

  /** The list's places for a download, with the map's details when the place is on screen now. */
  function exportPlaces() {
    const onScreen = new Map(store.parcelsInView.map((p) => [p.id, p]));
    return (active?.places ?? []).map((place) => ({
      id: place.id,
      center: place.center ?? onScreen.get(place.id)?.center ?? null,
      properties: onScreen.get(place.id)?.properties ?? place.properties,
      address: place.address,
    }));
  }
</script>

<div class="lists">
  <p class="small privacy">{s.privacy}</p>
  {#if !store.lists.persistent}<p class="notice" role="status">{s.notKept}</p>{/if}

  {#if lists.length === 0}
    <p class="muted">{s.empty}</p>
  {:else}
    <div class="choose">
      <label for="{idPrefix}-list-choice">{s.inUse}</label>
      <select id="{idPrefix}-list-choice" value={store.lists.activeId} onchange={(e) => store.lists.use(e.currentTarget.value)}>
        {#each lists as list (list.id)}
          <option value={list.id}>{list.name} ({s.count(list.places.length)})</option>
        {/each}
      </select>
    </div>
  {/if}

  <div class="row">
    <button class="button quiet small" type="button" onclick={() => startNaming('new')}>{s.newList}</button>
    {#if active}
      <button class="button quiet small" type="button" onclick={() => startNaming('rename')}>{s.rename}</button>
      <button class="button quiet small" type="button" onclick={remove}>{s.delete}</button>
    {/if}
  </div>

  {#if naming}
    <form class="name-form" onsubmit={submitName}>
      <label for="{idPrefix}-list-name">{naming === 'new' ? s.newName : s.renameLabel}</label>
      <div class="row">
        <input id="{idPrefix}-list-name" type="text" bind:value={name} maxlength="80" autocomplete="off" />
        <button class="button small primary" type="submit">{naming === 'new' ? s.create : s.saveName}</button>
        <button class="button quiet small" type="button" onclick={() => (naming = null)}>{s.cancel}</button>
      </div>
    </form>
  {/if}

  {#if active}
    <h3 class="list-name">{active.name} <span class="muted count">{s.count(active.places.length)}</span></h3>
    {#if active.places.length === 0}
      <p class="muted small">{s.noPlaces}</p>
    {:else}
      <ul class="places">
        {#each active.places as place (place.id)}
          {@const label = placeName(place)}
          <li>
            <button class="link" type="button" aria-label={s.open(label)} onclick={() => open(place)}>{label}</button>
            {#if kindOf(place)}<span class="muted small">{kindOf(place)}</span>{/if}
            <button class="button quiet small" type="button" aria-label={s.removeLabel(label)} onclick={() => store.lists.removePlace(place.id)}
              >{s.remove}</button
            >
          </li>
        {/each}
      </ul>
      <h4>{s.download}</h4>
      <ExportButtons {store} places={exportPlaces} title={active.name} idPrefix="{idPrefix}-list" />
    {/if}
  {/if}

  <h4>{s.importTitle}</h4>
  <p class="muted small">{s.importHelp}</p>
  <input
    id="{idPrefix}-list-file"
    class="file"
    type="file"
    accept=".csv,.geojson,.json,.txt,text/csv,text/plain,application/json,application/geo+json"
    aria-label={s.importTitle}
    onchange={importFile}
  />
  <p class="small" role="status" aria-live="polite">{importMessage}</p>
</div>

<style>
  .lists {
    font-size: 0.95rem;
  }
  .privacy {
    padding: 6px 10px;
    border-radius: var(--pk-radius);
    background: var(--pk-surface);
  }
  .choose {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    margin: 8px 0;
  }
  .choose label,
  .name-form label {
    font-weight: 600;
  }
  select,
  input[type='text'] {
    min-height: 36px;
    padding: 4px 8px;
    border: 1px solid var(--pk-border);
    border-radius: var(--pk-radius);
    font: inherit;
    max-width: 100%;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0;
  }
  .name-form {
    margin: 6px 0 10px;
  }
  .list-name {
    margin-top: 12px;
  }
  .count {
    font-weight: 400;
    font-size: 0.875rem;
  }
  .places {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
  }
  .places li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    padding: 4px 0;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .places li .button {
    margin-left: auto;
  }
  .link {
    padding: 4px 0;
    border: 0;
    background: none;
    color: var(--pk-accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
    text-align: left;
  }
  h4 {
    margin-top: 12px;
  }
  .file {
    max-width: 100%;
    font-size: 0.875rem;
  }
  p[role='status']:empty {
    display: none;
  }
</style>
