<script lang="ts">
  // Downloads places as CSV or GeoJSON, with what each lot page says about the owner
  // (src/places/export.ts, docs/ETHICS.md "Bulk export").
  import { config } from '../../config/index.ts';
  import {
    EXPORT_LIMIT,
    exportFileName,
    gatherExport,
    saveFile,
    toCsv,
    toGeoJson,
    type ExportPlace,
  } from '../../places/export.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';

  let {
    store,
    places,
    title,
    idPrefix,
    headingId,
    off = null,
  }: {
    store: AppStore;
    /** What to download, highest priority first: only the first EXPORT_LIMIT go in the file. */
    places: () => ExportPlace[];
    title: string;
    idPrefix: string;
    /** A heading the page already shows above the buttons; without one they bring their own. */
    headingId?: string;
    /** Why downloads are not offered right now (zoomed out to a sample), shown in place of the help. */
    off?: string | null;
  } = $props();

  const e = strings.export;
  let busy = $state(false);
  let status = $state('');
  let notes = $state<string[]>([]);

  async function download(kind: 'csv' | 'geojson') {
    if (off) return;
    const chosen = places();
    notes = [];
    if (chosen.length === 0) {
      status = e.nothing;
      return;
    }
    busy = true;
    status = e.working(0, 1);
    try {
      const now = new Date();
      const result = await gatherExport({
        places: chosen,
        registry: store.registry,
        state: $state.snapshot(store.state),
        manifest: store.manifest,
        dataBase: config.dataBase,
        siteUrl: new URL(config.siteBase, location.href).href,
        title,
        now,
        onProgress: (done, total) => (status = e.working(done, Math.max(total, 1))),
      });
      const name = exportFileName(title, now, kind);
      if (kind === 'csv') saveFile(name, toCsv(result), 'text/csv;charset=utf-8');
      else saveFile(name, toGeoJson(result), 'application/geo+json');
      status = e.done(result.rows.length);
      notes = [
        ...(result.leftOut ? [e.leftOut(result.leftOut, EXPORT_LIMIT)] : []),
        ...(result.withoutDetails ? [e.withoutDetails(result.withoutDetails)] : []),
      ];
    } catch (error) {
      console.warn('Placekeepers download:', error);
      status = e.failed;
    } finally {
      busy = false;
    }
  }
</script>

<div class="export" role="group" aria-labelledby={headingId ?? `${idPrefix}-export-title`} aria-describedby="{idPrefix}-export-help">
  {#if !headingId}<h3 id="{idPrefix}-export-title" class="sr-only">{e.title}</h3>{/if}
  <div class="buttons">
    <button class="button small" type="button" disabled={busy || !!off} onclick={() => download('csv')}>{e.csv}</button>
    <button class="button small" type="button" disabled={busy || !!off} onclick={() => download('geojson')}>{e.geojson}</button>
  </div>
  <p id="{idPrefix}-export-help" class="small help" class:muted={!off} class:off={!!off}>{off ?? e.help(EXPORT_LIMIT)}</p>
  <p class="small status" role="status" aria-live="polite">{status}</p>
  {#each notes as note (note)}<p class="small note">{note}</p>{/each}
</div>

<style>
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .help,
  .status,
  .note {
    margin: 4px 0 0;
  }
  .off {
    font-weight: 600;
  }
  /* An empty status line takes no room but stays in place, so screen readers hear what fills it. */
  .status:empty {
    margin: 0;
  }
</style>
