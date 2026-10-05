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
  }: {
    store: AppStore;
    /** What to download, highest priority first: only the first EXPORT_LIMIT go in the file. */
    places: () => ExportPlace[];
    title: string;
    idPrefix: string;
  } = $props();

  const e = strings.export;
  let busy = $state(false);
  let status = $state('');
  let notes = $state<string[]>([]);

  async function download(kind: 'csv' | 'geojson') {
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

<div class="export" role="group" aria-labelledby="{idPrefix}-export-title" aria-describedby="{idPrefix}-export-help">
  <h3 id="{idPrefix}-export-title" class="sr-only">{e.title}</h3>
  <div class="buttons">
    <button class="button small" type="button" disabled={busy} onclick={() => download('csv')}>{e.csv}</button>
    <button class="button small" type="button" disabled={busy} onclick={() => download('geojson')}>{e.geojson}</button>
  </div>
  <p id="{idPrefix}-export-help" class="muted small help">{e.help(EXPORT_LIMIT)}</p>
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
  .status:empty {
    display: none;
  }
</style>
