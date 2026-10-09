<script lang="ts">
  // The public Data status page: every source in the registry, whether it is up to date,
  // out of date ("stale since"), not working, or not fetched yet, in plain words.
  import { onMount } from 'svelte';
  import { config } from '../config/index.ts';
  import {
    describeStatus,
    isSampleData,
    loadBaseMapInfo,
    loadManifest,
    statusRows,
    statusSummary,
    type BaseMapInfo,
    type ParseResult,
  } from '../data/manifest.ts';
  import type { Registry } from '../registry/types.ts';
  import { formatDate, strings } from '../strings.ts';
  import Dialog from '../components/common/Dialog.svelte';
  import SiteNav from '../components/common/SiteNav.svelte';

  let { registry }: { registry: Registry } = $props();

  let result = $state<ParseResult | null>(null);
  let basemap = $state<BaseMapInfo | undefined>(undefined);
  let loading = $state(true);
  let menuOpen = $state(false);

  async function load() {
    loading = true;
    [result, basemap] = await Promise.all([loadManifest(config.dataBase), loadBaseMapInfo(config.dataBase)]);
    loading = false;
  }

  onMount(load);

  const manifest = $derived(result?.manifest ?? null);
  const rows = $derived(manifest ? statusRows(registry, manifest, basemap) : []);
  const built = $derived(formatDate(manifest?.generated_at));
  const s = strings.status;

  function license(id: string | undefined) {
    return registry.licenses.find((l) => l.id === id);
  }
</script>

<div class="page">
  <header>
    <a class="back" href={config.siteBase}>{s.back}</a>
    <button class="button quiet small menu" type="button" aria-haspopup="dialog" onclick={() => (menuOpen = true)}
      >{strings.nav.menu}</button
    >
    <h1>{s.pageTitle}</h1>
    <p>{s.intro}</p>
  </header>

  <Dialog bind:open={menuOpen} title={strings.nav.menuTitle} id="pk-menu">
    <SiteNav current="status" />
  </Dialog>

  <main>
    {#if loading}
      <p role="status">{s.loading}</p>
    {:else if !manifest}
      <div class="notice" role="alert">
        <p>{s.loadFailed}</p>
        <button class="button" type="button" onclick={load}>{s.retry}</button>
      </div>
    {:else}
      {#if isSampleData(manifest)}<p class="notice">{strings.app.sampleData}</p>{/if}
      <p class="summary">
        <strong>{statusSummary(rows)}</strong>
        {#if built}<span class="muted">{s.builtOn(built)}. {s.buildId(manifest.build_id)}.</span>{/if}
      </p>

      <ul class="sources">
        {#each rows as row (row.id)}
          {@const text = describeStatus(row)}
          {@const lic = license(row.source?.license)}
          <li class="source" data-status={row.status}>
            <div class="title">
              <h2>{row.name}</h2>
              <span class="status">{text.label}</span>
            </div>
            {#if text.summary}<p>{text.summary}</p>{/if}
            {#if text.details.length}
              <ul class="details">
                {#each text.details as line, i (i)}<li>{line}</li>{/each}
              </ul>
            {/if}
            {#if row.source}
              <p class="meta">
                {s.cadence[row.source.cadence] ?? ''}.
                {s.publisher}: {row.source.publisher}.
                <a href={row.source.homepage} target="_blank" rel="noopener noreferrer">{s.homepage}</a>.
                {#if lic}{s.license}: <a href={lic.url} target="_blank" rel="noopener noreferrer">{lic.label}</a>.{/if}
              </p>
              {#if lic?.non_commercial}<p class="non-commercial">{strings.redlining.statusNote}</p>{/if}
            {/if}
          </li>
        {/each}
      </ul>

      {#if manifest.notes.length}
        <section class="notes" aria-labelledby="pk-notes-title">
          <h2 id="pk-notes-title">{s.notesTitle}</h2>
          <ul>
            {#each manifest.notes as note, i (i)}<li>{note}</li>{/each}
          </ul>
        </section>
      {/if}

      {#if result?.problems.length}
        <details>
          <summary>{s.problems}</summary>
          <ul>
            {#each result.problems as problem, i (i)}<li>{problem}</li>{/each}
          </ul>
        </details>
      {/if}
    {/if}
  </main>
  <footer class="muted small">{strings.app.notAffiliated} {strings.app.licenses}</footer>
</div>

<style>
  .page {
    max-width: 860px;
    margin: 0 auto;
    padding: 16px;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 16px;
  }
  header h1,
  header p {
    flex-basis: 100%;
  }
  h1 {
    font-size: 1.6rem;
    margin-top: 12px;
  }
  .back {
    font-weight: 600;
  }
  .menu {
    margin-left: auto;
  }
  .summary {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sources {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }
  .source {
    padding: 12px 14px;
    border: 1px solid var(--pk-surface-2);
    border-left: 6px solid var(--pk-border);
    border-radius: var(--pk-radius);
  }
  .source[data-status='ok'] {
    border-left-color: var(--pk-ok-ink);
  }
  .source[data-status='stale'] {
    border-left-color: #b07d12;
  }
  .source[data-status='failing'],
  .source[data-status='unknown'] {
    border-left-color: var(--pk-fail-ink);
  }
  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
  }
  .title h2 {
    margin: 0;
    font-size: 1.05rem;
  }
  .status {
    padding: 1px 10px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 700;
    background: var(--pk-surface);
  }
  [data-status='ok'] .status {
    background: var(--pk-ok-bg);
    color: var(--pk-ok-ink);
  }
  [data-status='stale'] .status {
    background: var(--pk-stale-bg);
    color: var(--pk-stale-ink);
  }
  [data-status='failing'] .status,
  [data-status='unknown'] .status {
    background: var(--pk-fail-bg);
    color: var(--pk-fail-ink);
  }
  .details {
    margin: 4px 0 6px;
    padding-left: 18px;
    font-size: 0.925rem;
  }
  .meta {
    margin: 0;
    font-size: 0.85rem;
    color: var(--pk-muted);
  }
  .notice {
    margin-bottom: 12px;
  }
  .notes {
    margin-top: 20px;
  }
  .notes h2 {
    font-size: 1.1rem;
  }
  .notes ul {
    padding-left: 20px;
  }
  footer {
    margin-top: 24px;
  }
</style>
