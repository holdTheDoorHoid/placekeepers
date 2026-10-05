<script lang="ts">
  // History: every recorded sale and transfer newest first, the City's assessments by year (a
  // chart and the same numbers as a table), and the L&I timeline of permits, violations and
  // demolitions. Each part says whether it is live or from the weekly snapshot. Records the
  // weekly copy does not hold for this parcel are said to be missing, never "none on record",
  // with a way to see them live.
  import type { DossierView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';
  import AssessmentChart from './AssessmentChart.svelte';
  import ProvenanceLine from './ProvenanceLine.svelte';

  let {
    history,
    idPrefix,
    onTurnOnLive,
    onRetry,
  }: { history: DossierView['history']; idPrefix: string; onTurnOnLive?: () => void; onRetry?: () => void } = $props();
  const h = strings.dossier.history;
  /** The L&I timeline starts short; "Show all" opens the rest. */
  const FIRST_LI = 12;
  let allLi = $state(false);
  const liRows = $derived(history.li.rows ? (allLi ? history.li.rows : history.li.rows.slice(0, FIRST_LI)) : null);
</script>

{#if history.notInCopy}
  <p class="notice not-in-copy">
    {history.notInCopy.text}
    {#if history.notInCopy.offerLive && onTurnOnLive}
      {h.notInCopyOff}
      <button class="button small quiet" type="button" onclick={onTurnOnLive}>{strings.options.turnOn}</button>
    {:else if history.notInCopy.retry && onRetry}
      {h.notInCopyFailed}
      <button class="button small quiet" type="button" onclick={onRetry}>{strings.dossier.retry}</button>
    {/if}
  </p>
{/if}

<h4>{h.transfersTitle}</h4>
<ProvenanceLine provenance={history.transfersProvenance} />
{#if history.transfers && history.transfers.length}
  <div class="scroll">
    <table class="transfers">
      <caption id="{idPrefix}-transfers-caption">{h.transfersCaption}</caption>
      <thead>
        <tr>
          <th scope="col">{h.date}</th>
          <th scope="col">{h.documentAndPrice}</th>
          <th scope="col">{h.fromAndTo}</th>
        </tr>
      </thead>
      <tbody>
        {#each history.transfers as row, i (i)}
          <tr class:sheriff={row.sheriff}>
            <td class="nowrap">{row.date}</td>
            <td>{row.document}<span class="price">{row.price}</span></td>
            <td>
              <span class="party"><span class="muted">{h.from}:</span> {row.from}</span>
              <span class="party"><span class="muted">{h.to}:</span> {row.to}</span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="muted small">{h.datesNote} {h.recordsNote}</p>
{:else if history.transfers}
  <p class="muted small">{h.noTransfers} {h.recordsNote}</p>
{/if}

<h4>{h.assessmentsTitle}</h4>
<ProvenanceLine provenance={history.assessmentsProvenance} />
{#if history.assessments && history.assessments.length}
  <AssessmentChart rows={history.assessments} />
  <table class="assessments">
    <caption>{h.assessmentsCaption}</caption>
    <thead>
      <tr>
        <th scope="col">{h.year}</th>
        <th scope="col" class="num">{h.marketValue}</th>
      </tr>
    </thead>
    <tbody>
      {#each history.assessments as row (row.year)}
        <tr>
          <th scope="row">{row.year}</th>
          <td class="num">{row.value}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="muted small">{h.assessmentNote}</p>
{:else if history.assessments}
  <p class="muted small">{h.noAssessments}</p>
{/if}

<h4>{h.liTitle}</h4>
<ProvenanceLine provenance={history.liProvenance} />
{#if history.li.summary && history.li.summary.length}
  <ul class="li-summary">
    {#each history.li.summary as line (line)}<li>{line}</li>{/each}
  </ul>
{/if}
{#if liRows && liRows.length}
  <table class="li">
    <caption>{h.liCaption}</caption>
    <thead>
      <tr>
        <th scope="col">{h.date}</th>
        <th scope="col">{h.liRecord}</th>
      </tr>
    </thead>
    <tbody>
      {#each liRows as row, i (i)}
        <tr>
          <td class="nowrap">{row.date}</td>
          <td>
            <strong>{row.kind}</strong>{#if row.open}{' '}<span class="open">{h.open}</span>{/if}
            {#if row.what}<span class="what">{row.what}</span>{/if}
            {#if row.status && !row.open}<span class="status">{row.status}</span>{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if history.li.rows && history.li.rows.length > FIRST_LI}
    <button class="button quiet small" type="button" aria-expanded={allLi} onclick={() => (allLi = !allLi)}
      >{allLi ? h.showFewer : h.showAll(history.li.rows.length)}</button
    >
  {/if}
  {#if history.li.truncated}<p class="muted small">{h.truncated}</p>{/if}
{:else if history.li.rows}
  <p class="muted small">{h.noLi}</p>
{/if}
{#if history.li.liveForTimeline}<p class="muted small">{h.liLiveForTimeline}</p>{/if}

<style>
  .scroll {
    position: relative;
    overflow-x: auto;
  }
  .transfers {
    font-size: 0.85rem;
  }
  .price,
  .party {
    display: block;
  }
  .price {
    font-variant-numeric: tabular-nums;
  }
  .assessments {
    max-width: 320px;
    font-size: 0.875rem;
  }
  .li {
    font-size: 0.85rem;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .nowrap {
    white-space: nowrap;
  }
  .sheriff td {
    background: var(--pk-note-bg);
  }
  .open {
    display: inline-block;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--pk-stale-bg);
    color: var(--pk-stale-ink);
    font-size: 0.75rem;
    font-weight: 700;
  }
  .what,
  .status {
    display: block;
  }
  .status {
    color: var(--pk-muted);
    font-size: 0.8rem;
  }
  .li-summary {
    margin: 0 0 6px;
    padding-left: 1.2em;
    font-size: 0.9rem;
  }
  caption {
    font-size: 0.85rem;
  }

</style>
