<script lang="ts">
  // Summary: what we think the parcel is and how sure we are, the vacancy model's reasons
  // (src/places/reasons.ts), what City records call it, care already happening, the lens
  // priority, and links to the City's pages and street imagery (never copied).
  import type { Manifest } from '../../data/manifest.ts';
  import type { DossierView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';
  import WhyBreakdown from '../lens/WhyBreakdown.svelte';
  import PlaceReasons from '../places/PlaceReasons.svelte';
  import ProvenanceLine from './ProvenanceLine.svelte';

  let { summary, manifest, opa }: { summary: DossierView['summary']; manifest: Manifest | null; opa: string } = $props();
  const s = strings.dossier.summary;
</script>

<p class="kind"><strong>{summary.kindLabel}</strong></p>
{#if summary.kindHelp}<p class="small">{summary.kindHelp}</p>{/if}
<p class="muted small">{strings.dossier.parcel(opa)}</p>
{#if summary.confidence}
  <p><span class="muted">{s.confidenceTitle}:</span> {summary.confidence}.{#if summary.signals}{' '}{summary.signals}{/if}</p>
{/if}
{#if summary.reasonProperties}
  <PlaceReasons properties={summary.reasonProperties} {manifest} level={4} />
{/if}
{#if summary.cityCalls}<p>{summary.cityCalls}</p>{/if}
{#each summary.care as line (line)}<p class="care">{line}</p>{/each}
<ProvenanceLine provenance={summary.provenance} />

{#if summary.lens && summary.why}
  <p class="muted small lens-line">{s.lensLine(summary.lens.label)}</p>
  <WhyBreakdown why={summary.why} idPrefix="dossier-{opa}" level={4} />
{/if}
{#if summary.flood}
  <section class="flood" aria-labelledby="dossier-{opa}-flood">
    <h4 id="dossier-{opa}-flood">{s.floodTitle}</h4>
    <p class="small">{summary.flood}</p>
  </section>
{/if}

<h4>{s.linksTitle}</h4>
<ul class="links">
  {#each summary.links as link (link.url)}
    <li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
  {/each}
</ul>
<p class="muted small">{s.linksNote}</p>

<style>
  .kind {
    margin-bottom: 2px;
    font-size: 1.05rem;
  }
  .care {
    padding: 4px 8px;
    border-radius: var(--pk-radius);
    background: var(--pk-ok-bg);
    color: var(--pk-ok-ink);
    font-size: 0.9rem;
  }
  .lens-line {
    margin: 10px 0 0;
  }
  .flood {
    margin-top: 10px;
    padding: 6px 10px;
    border-left: 4px solid #2171b5;
    border-radius: var(--pk-radius);
    background: var(--pk-surface);
  }
  .flood h4 {
    margin: 0 0 2px;
  }
  .flood p {
    margin: 0;
  }
  .links {
    margin: 0 0 4px;
    padding-left: 1.2em;
  }
  .links li {
    margin: 2px 0;
  }
</style>
