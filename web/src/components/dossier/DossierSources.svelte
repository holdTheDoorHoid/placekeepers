<script lang="ts">
  // Sources and freshness: each source this page used with its date, "Report a correction"
  // (a prefilled GitHub issue), and where owners can fix a City record at the source.
  import type { DossierView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';

  let { sources }: { sources: DossierView['sources'] } = $props();
  const src = strings.dossier.sources;
</script>

<p class="small">{src.intro}</p>
<ul class="sources">
  {#each sources.rows as row (row.id)}
    <li>
      <a href={row.homepage} target="_blank" rel="noopener noreferrer">{row.name}</a>: {row.when}
      <span class="publisher muted">{src.by(row.publisher)}</span>
    </li>
  {/each}
</ul>
<p>
  <a class="button small" href={sources.correctionUrl} target="_blank" rel="noopener noreferrer">{src.correction}</a>
</p>
<p class="muted small">{src.correctionHelp}</p>
<p class="small">{src.ownerNote}</p>
<p class="muted small">{strings.app.notAffiliated}</p>

<style>
  .sources {
    margin: 0 0 8px;
    padding-left: 1.2em;
    font-size: 0.875rem;
  }
  .sources li {
    margin: 4px 0;
  }
  .publisher {
    display: block;
    font-size: 0.8rem;
  }
</style>
