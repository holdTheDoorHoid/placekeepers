<script lang="ts">
  // History: the story of the lot in one or two sentences built only from records, then every
  // record in one timeline, newest first by year (deeds, violations, permits, demolitions, clean
  // and seal, unsafe and imminently dangerous notices, and vacancy records), with each kind
  // switchable; then every deed in a table and the City's assessments as a chart and a table
  // (issue #38). The timeline's records from the weekly copy load only when this part comes into
  // view, so opening a lot stays fast on a phone. Each part says whether it is live or from the
  // weekly copy. Records the weekly copy does not hold for this parcel are said to be missing,
  // never "none on record", with a way to see them live.
  import type { Snippet } from 'svelte';
  import type { DossierView } from '../../dossier/build.ts';
  import type { TimelineKind } from '../../dossier/timeline.ts';
  import { strings } from '../../strings.ts';
  import AssessmentChart from './AssessmentChart.svelte';
  import ProvenanceLine from './ProvenanceLine.svelte';

  let {
    history,
    idPrefix,
    onTurnOnLive,
    onRetry,
    onOpenHistory,
    onToggleKind,
    extra,
  }: {
    history: DossierView['history'];
    idPrefix: string;
    onTurnOnLive?: () => void;
    onRetry?: () => void;
    /** Asks for the timeline's records from the weekly copy: called once this part comes into view. */
    onOpenHistory?: () => void;
    onToggleKind?: (kind: TimelineKind) => void;
    /**
     * One more control under the story, such as "See this lot in old aerial photos" (M4.3,
     * issue #39, which adds it here).
     */
    extra?: Snippet;
  } = $props();
  const h = strings.dossier.history;
  const tl = h.timeline;
  const timeline = $derived(history.timeline);
  /** The timeline starts with its most recent years; "Show earlier years" opens the rest. */
  const FIRST_YEARS = 6;
  let allYears = $state(false);
  const years = $derived(allYears ? timeline.years : timeline.years.slice(0, FIRST_YEARS));

  // Ask for the weekly copy's records once this part is near the screen (at once where the
  // browser cannot tell, as in tests).
  let root: HTMLElement | undefined = $state();
  $effect(() => {
    if (!root || !onOpenHistory || timeline.status !== 'waiting') return;
    const ask = onOpenHistory;
    if (typeof IntersectionObserver === 'undefined') {
      ask();
      return;
    }
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          watcher.disconnect();
          ask();
        }
      },
      { rootMargin: '300px 0px' },
    );
    watcher.observe(root);
    return () => watcher.disconnect();
  });
</script>

<div bind:this={root} class="history">
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

  <h4 id="{idPrefix}-story-title">{tl.storyTitle}</h4>
  {#if timeline.story.length}
    <ul class="story" aria-labelledby="{idPrefix}-story-title">
      {#each timeline.story as line (line.text)}
        <li>{line.text} <span class="source">{tl.storySource(line.source)}</span></li>
      {/each}
    </ul>
  {:else if timeline.status === 'ready'}
    <p class="muted small">{tl.noStory}</p>
  {:else}
    <p class="muted small">{tl.loading}</p>
  {/if}

  <!-- M4.3 (issue #39): the "See this lot in old aerial photos" button goes here. -->
  {#if extra}<div class="history-extra">{@render extra()}</div>{/if}

  <h4 id="{idPrefix}-timeline-title">{tl.title}</h4>
  <ProvenanceLine provenance={timeline.provenance} />
  {#each timeline.notes as note (note.text)}
    <p class="notice">
      {note.text}
      {#if note.offerLive && onTurnOnLive}
        {tl.liMissingOff}
        <button class="button small quiet" type="button" onclick={onTurnOnLive}>{strings.options.turnOn}</button>
      {:else if note.retry && onRetry}
        <button class="button small quiet" type="button" onclick={onRetry}>{strings.dossier.retry}</button>
      {/if}
    </p>
  {/each}
  {#if timeline.status !== 'ready' && !timeline.years.length}
    <p class="muted small">{tl.loading}</p>
  {:else}
    {#if timeline.kinds.length}
      <fieldset class="kinds">
        <legend>{tl.show}</legend>
        {#each timeline.kinds as kind (kind.id)}
          <label>
            <input type="checkbox" checked={kind.shown} onchange={() => onToggleKind?.(kind.id)} disabled={!onToggleKind} />
            {kind.label} <span class="count">({kind.count})</span>
          </label>
        {/each}
      </fieldset>
    {/if}
    {#if timeline.years.length}
      <p class="muted small intro">{tl.intro}</p>
      <div class="years" aria-labelledby="{idPrefix}-timeline-title">
        {#each years as year (year.year)}
          <h5 class="year">{year.year}</h5>
          <ul class="events">
            {#each year.rows as row, i (i)}
              <li class="event kind-{row.kind}">
                <span class="date">{row.dateLabel}</span>
                <span class="body">
                  <strong>{row.label}</strong>
                  {#if row.items.length === 1}
                    {@const item = row.items[0]!}
                    <span class="what">{item.text}{#if item.open}{' '}<span class="open">{h.open}</span>{/if}</span>
                    {#if item.status}<span class="status">{item.status}</span>{/if}
                    {#if item.early}<span class="early">{h.earlyDeed}</span>{/if}
                  {:else}
                    <ul class="items">
                      {#each row.items as item, j (j)}
                        <li>
                          {item.text}{#if item.open}{' '}<span class="open">{h.open}</span>{/if}{#if item.status}<span class="status">{item.status}</span>{/if}
                        </li>
                      {/each}
                    </ul>
                  {/if}
                  {#if row.future}<span class="early">{tl.future}</span>{/if}
                </span>
              </li>
            {/each}
          </ul>
        {/each}
      </div>
      {#if timeline.years.length > FIRST_YEARS}
        <button class="button quiet small" type="button" aria-expanded={allYears} onclick={() => (allYears = !allYears)}
          >{allYears ? tl.fewerYears : tl.moreYears(timeline.years.length - FIRST_YEARS)}</button
        >
      {/if}
    {:else if timeline.kinds.length}
      <p class="muted small">{tl.allHidden}</p>
    {:else if timeline.status === 'ready' && !timeline.notes.length}
      <p class="muted small">{tl.none}</p>
    {/if}
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
              <td>
                {row.document}<span class="price">{row.price}</span>
                {#if row.early}<span class="early">{h.earlyDeed}</span>{/if}
              </td>
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

  {#if history.li.summary && history.li.summary.length}
    <h4>{h.liNowTitle}</h4>
    <ProvenanceLine provenance={history.liProvenance} />
    <ul class="li-summary">
      {#each history.li.summary as line (line)}<li>{line}</li>{/each}
    </ul>
  {/if}
</div>

<style>
  .scroll {
    position: relative;
    overflow-x: auto;
  }
  .transfers {
    font-size: 0.85rem;
  }
  .price,
  .party,
  .early {
    display: block;
  }
  .price {
    font-variant-numeric: tabular-nums;
  }
  .early {
    color: var(--pk-muted);
    font-size: 0.75rem;
  }
  .assessments {
    max-width: 320px;
    font-size: 0.875rem;
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
  .story {
    margin: 0 0 8px;
    padding-left: 1.2em;
  }
  .story li {
    margin-bottom: 4px;
  }
  .source {
    color: var(--pk-muted);
    font-size: 0.8rem;
  }
  .history-extra {
    margin: 0 0 8px;
  }
  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 14px;
    margin: 0 0 8px;
    padding: 6px 10px;
    border: 1px solid var(--pk-surface-2);
    border-radius: var(--pk-radius);
    font-size: 0.85rem;
  }
  .kinds legend {
    padding: 0 4px;
    font-weight: 600;
  }
  .kinds label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
  }
  .count {
    color: var(--pk-muted);
  }
  .intro {
    margin-top: 0;
  }
  .year {
    margin: 10px 0 2px;
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }
  .events {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.85rem;
  }
  .event {
    display: grid;
    grid-template-columns: 4.2em 1fr;
    gap: 8px;
    padding: 4px 0 4px 8px;
    border-left: 3px solid var(--pk-surface-2);
  }
  .event.kind-deed {
    border-left-color: var(--pk-accent);
  }
  .event.kind-demolition,
  .event.kind-notice {
    border-left-color: var(--pk-stale-ink);
  }
  .date {
    color: var(--pk-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .what,
  .status {
    display: block;
  }
  .status {
    color: var(--pk-muted);
    font-size: 0.8rem;
  }
  .items {
    margin: 2px 0 0;
    padding-left: 1.1em;
  }
  .items .status {
    display: inline;
    margin-left: 6px;
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
  .li-summary {
    margin: 0 0 6px;
    padding-left: 1.2em;
    font-size: 0.9rem;
  }
  caption {
    font-size: 0.85rem;
  }
</style>
