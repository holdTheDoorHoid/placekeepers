<script lang="ts">
  // The ranked list of places in view. It is also the text alternative to the map: every
  // place drawn on the map can be reached and selected from here with a keyboard.
  import type { RankedPlace } from '../../places/rank.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import { kindLabel } from './labels.ts';

  let { store, places }: { store: AppStore; places: RankedPlace[] } = $props();
</script>

{#if places.length === 0}
  <p class="muted">{strings.analysis.tableEmpty}</p>
{:else}
  {#if places.every((p) => p.score === null && !p.why?.allOff)}<p class="notice">{strings.analysis.noScores}</p>{/if}
  <div class="scroll">
    <table>
      <caption>{strings.analysis.tableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">{strings.analysis.rank}</th>
          <th scope="col">{strings.analysis.place}</th>
          <th scope="col">{strings.analysis.kind}</th>
          <th scope="col">{strings.analysis.sure}</th>
          <th scope="col">{strings.analysis.score}</th>
          <th scope="col">{strings.analysis.reason}</th>
        </tr>
      </thead>
      <tbody>
        {#each places as place, i (place.id)}
          <tr class:selected={store.state.selected === place.id}>
            <td>{place.score === null ? '' : i + 1}</td>
            <td>
              <button
                class="link"
                type="button"
                aria-pressed={store.state.selected === place.id}
                onclick={() => {
                  store.select(place.id, place.properties);
                  store.controller?.flyTo(place.center);
                }}>{strings.place.parcel(place.id)}</button
              >
            </td>
            <td>{kindLabel(place.kind)}</td>
            <td>{strings.place.confidence[place.confidence] ?? ''}</td>
            <td>{place.score ?? ''}</td>
            <td>{place.why?.main?.label ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
<p class="muted small">{strings.analysis.tablePlaceholder}</p>

<style>
  .scroll {
    position: relative;
    overflow-x: auto;
  }
  table {
    font-size: 0.875rem;
    min-width: 560px;
  }
  .selected {
    background: var(--pk-accent-soft);
  }
  .link {
    padding: 4px 0;
    border: 0;
    background: none;
    color: var(--pk-accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
