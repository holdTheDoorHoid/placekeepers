<script lang="ts">
  // The ranked list of places in view. It is also the text alternative to the map and the plot:
  // every place drawn on the map can be reached and opened from here with a keyboard. It sorts by
  // score only, highest or lowest first; nothing sorts by the first step to get permission, which
  // is a kind of step, not a score (docs/ETHICS.md).
  import { permissionLabel } from '../../config/permission.ts';
  import type { RankedPlace, ScoreOrder } from '../../places/rank.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import ListToggle from '../lists/ListToggle.svelte';
  import { kindLabel } from './labels.ts';

  /** Rows shown at once; the download holds more. */
  const TABLE_ROWS = 50;

  let {
    store,
    places,
    order,
    onOrder,
  }: { store: AppStore; places: RankedPlace[]; order: ScoreOrder; onOrder: (order: ScoreOrder) => void } = $props();

  const a = strings.analysis;
  const shown = $derived(places.slice(0, TABLE_ROWS));
  const scored = $derived(places.filter((p) => p.score !== null).length);

  // Addresses come from the lot dossiers, for the rows on show.
  $effect(() => {
    void store.addresses.request(shown.map((p) => p.id));
  });

  function nameOf(place: RankedPlace): string {
    return store.addresses.get(place.id) ?? strings.place.parcel(place.id);
  }
</script>

{#if places.length === 0}
  <p class="muted">{a.tableEmpty}</p>
{:else}
  {#if places.every((p) => p.score === null && !p.why?.allOff)}<p class="notice">{a.noScores}</p>{/if}
  <div class="scroll">
    <table>
      <caption>{a.tableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">{a.rank}</th>
          <th scope="col">{a.place}</th>
          <th scope="col" aria-sort={order === 'desc' ? 'descending' : 'ascending'}>
            <button
              class="sort"
              type="button"
              aria-label="{a.score}. {order === 'desc' ? a.sortHighFirst : a.sortLowFirst}"
              onclick={() => onOrder(order === 'desc' ? 'asc' : 'desc')}
              >{a.score} <span aria-hidden="true">{order === 'desc' ? '\u25BC' : '\u25B2'}</span></button
            >
          </th>
          <th scope="col">{a.reason}</th>
          <th scope="col">{strings.permission.title}</th>
          <th scope="col"><span class="sr-only">{a.save}</span></th>
        </tr>
      </thead>
      <tbody>
        {#each shown as place, i (place.id)}
          {@const name = nameOf(place)}
          <tr class:selected={store.state.selected === place.id} data-place={place.id}>
            <td>{place.score === null ? '' : order === 'desc' ? i + 1 : scored - i}</td>
            <td>
              <button
                class="link"
                type="button"
                aria-pressed={store.state.selected === place.id}
                onclick={() => {
                  store.select(place.id, place.properties, { center: place.center });
                  store.controller?.flyTo(place.center);
                }}>{name}</button
              >
              <span class="about">{kindLabel(place.kind)}. {strings.place.confidence[place.confidence] ?? ''}</span>
            </td>
            <td class="score">{place.score ?? ''}</td>
            <td>{place.why?.main?.label ?? ''}</td>
            <td>{permissionLabel(place.permission)}</td>
            <td><ListToggle {store} id={place.id} center={place.center} properties={place.properties} compact label={name} /></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if places.length > shown.length}<p class="muted small">{a.tableMore(shown.length, places.length)}</p>{/if}
{/if}

<style>
  .scroll {
    position: relative;
    overflow-x: auto;
  }
  table {
    font-size: 0.875rem;
    min-width: 560px;
  }
  .about {
    display: block;
    color: var(--pk-muted);
    font-size: 0.8rem;
  }
  .selected {
    background: var(--pk-accent-soft);
  }
  .score {
    font-variant-numeric: tabular-nums;
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
  .sort {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
