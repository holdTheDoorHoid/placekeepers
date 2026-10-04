<script lang="ts">
  // Address search: an address, an intersection or a nine digit parcel number. Addresses and
  // intersections go to the City's address service from the browser (only while "Fetch live City
  // data" is on); a parcel number opens its lot page directly. The map flies to the place and,
  // for a property, opens its lot page.
  import { cleanSearchText, searchAddress, type SearchResult } from '../../dossier/ais.ts';
  import { isOpaAccount } from '../../dossier/opa.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';

  let { store, idPrefix }: { store: AppStore; idPrefix: string } = $props();

  let text = $state('');
  let busy = $state(false);
  let message = $state('');
  let results = $state.raw<SearchResult[]>([]);
  let run = 0;
  const s = strings.search;

  function choose(result: SearchResult) {
    results = [];
    message = '';
    store.controller?.flyTo([result.lng, result.lat], 17);
    if (result.opa) store.select(result.opa, null, { center: [result.lng, result.lat] });
    else store.say(result.kind === 'intersection' ? s.showing(result.label) : s.noParcel(result.label));
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const mine = ++run;
    results = [];
    message = '';
    const account = text.replace(/\s+/g, '');
    if (isOpaAccount(account)) {
      store.flyToSelection = true;
      store.select(account, null);
      return;
    }
    if (!cleanSearchText(text)) {
      message = s.tooShort;
      return;
    }
    if (!store.liveCityData) {
      message = s.liveOff;
      return;
    }
    busy = true;
    const outcome = await searchAddress(text);
    if (mine !== run) return;
    busy = false;
    if (!outcome.ok) {
      message = outcome.reason === 'not_found' ? s.notFound : s.failed(strings.failure[outcome.reason] ?? strings.failure.network!);
      return;
    }
    if (outcome.results.length === 1) choose(outcome.results[0]!);
    else {
      results = outcome.results;
      message = s.resultsCount(outcome.results.length);
    }
  }
</script>

<div class="address-search">
  <form class="search" role="search" onsubmit={submit}>
    <label class="sr-only" for="{idPrefix}-search">{s.label}</label>
    <input
      id="{idPrefix}-search"
      type="search"
      bind:value={text}
      placeholder={s.placeholder}
      autocomplete="off"
      spellcheck="false"
      aria-describedby="{idPrefix}-search-note"
      maxlength="120"
    />
    <button class="button small search-button" type="submit" disabled={busy}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
        ><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4" /><path
          d="M15.5 15.5 21 21"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        /></svg
      >
      <span class="sr-only">{busy ? s.searching : s.button}</span>
    </button>
  </form>
  <span id="{idPrefix}-search-note" class="sr-only">{s.privacy}</span>
  <p class="message small" role="status" aria-live="polite">{busy ? s.searching : message}</p>
  {#if results.length}
    <ul class="results" aria-label={s.resultsTitle}>
      {#each results as result (result.label + (result.opa ?? ''))}
        <li>
          <button class="result" type="button" onclick={() => choose(result)}>
            {result.label}{#if result.kind === 'intersection'}<span class="muted"> ({s.intersection})</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .address-search {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  .search {
    display: flex;
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
  .message:empty {
    display: none;
  }
  .message {
    margin: 4px 0 0;
  }
  .results {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--pk-surface-2);
    border-radius: var(--pk-radius);
    background: var(--pk-bg);
  }
  .result {
    display: block;
    width: 100%;
    min-height: 40px;
    padding: 8px 10px;
    border: 0;
    border-bottom: 1px solid var(--pk-surface-2);
    background: none;
    color: var(--pk-accent);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .result:hover {
    background: var(--pk-accent-soft);
  }
  li:last-child .result {
    border-bottom: 0;
  }
</style>
