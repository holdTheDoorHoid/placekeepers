<script lang="ts">
  // "Did it work?" (M5.4, issue #48): when a lot or building got care, did the blocks around it
  // change compared with similar places that did not? Reads tables/didit.json (docs/CONTRACTS.md
  // section 12), the yearly study's results. Citywide numbers only, each with its 90 percent
  // interval, its sample size and a plain sentence; the trials first as the real evidence, and the
  // warnings of docs/EVIDENCE.md. Never a verdict on one lot. Reads on a phone and prints.
  import { onMount } from 'svelte';
  import { config } from '../config/index.ts';
  import { DIDIT_METHOD_URL, TRIAL_GREENING_URL, TRIAL_HOUSES_URL, TRIAL_SHOOTINGS_URL, projectReportUrl } from '../config/links.ts';
  import { formatDate, strings } from '../strings.ts';
  import Dialog from '../components/common/Dialog.svelte';
  import SiteNav from '../components/common/SiteNav.svelte';
  import LanguageOffer from '../components/language/LanguageOffer.svelte';
  import LanguagePicker from '../components/language/LanguagePicker.svelte';
  import TranslationNote from '../components/language/TranslationNote.svelte';
  import { OUTCOMES, VERDICTS, detailLines, loadTable, tally, verdictSentence, type DiditTable, type KindBlock } from './data.ts';

  const t = strings.didit;
  const TRIAL_URLS = [TRIAL_GREENING_URL, TRIAL_SHOOTINGS_URL, TRIAL_HOUSES_URL];

  let table = $state<DiditTable | null>(null);
  let loadState = $state<'loading' | 'ok' | 'missing' | 'failed'>('loading');
  let menuOpen = $state(false);

  async function load() {
    loadState = 'loading';
    const result = await loadTable(config.dataBase);
    if (result === 'missing' || result === 'failed') {
      loadState = result;
      return;
    }
    table = result;
    loadState = 'ok';
  }

  onMount(load);

  const counts = $derived(table ? tally(table) : null);
  const tallyText = $derived.by(() => {
    if (!counts) return '';
    const parts = VERDICTS.filter((v) => counts[v] > 0).map((v) => t.tallyParts[v]!(counts[v]));
    return `${t.tallyIntro(counts.total)} ${t.tallyJoin(parts)}`;
  });
  const studied = $derived(table ? table.kinds.filter((k) => k.id !== 'projects') : []);
  const projects = $derived(table?.kinds.find((k) => k.id === 'projects') ?? null);
  const projectsCompared = $derived(projects ? projects.results.some((r) => r.main.places > 0) : false);

  function kindNote(kind: KindBlock): string | null {
    const note = t.kindNotes[kind.id];
    return note ? note(kind.records, kind.dated) : null;
  }

  function monthWords(month: string): string {
    return formatDate(`${month}-01`, 'long')?.replace(/^\w+ 1, /, '') ?? month;
  }

  function day(value: string | null | undefined): string {
    return formatDate(value ?? null) ?? value ?? '';
  }

  $effect(() => {
    document.title = `${t.pageTitle}, Placekeepers`;
  });
</script>

<div class="page">
  <header>
    <a class="back" href={config.siteBase}>{t.back}</a>
    <div class="tools">
      <button class="button quiet small" type="button" onclick={() => window.print()}>{t.print}</button>
      <LanguagePicker />
      <button class="button quiet small menu" type="button" aria-haspopup="dialog" onclick={() => (menuOpen = true)}>{strings.nav.menu}</button>
    </div>
    <LanguageOffer />
    <TranslationNote />
    <h1>{t.pageTitle}</h1>
    <p>{t.intro}</p>
  </header>

  <Dialog bind:open={menuOpen} title={strings.nav.menuTitle} id="pk-menu">
    <SiteNav current="did-it-work" />
  </Dialog>

  <main>
    {#if loadState === 'loading'}
      <p role="status">{t.loading}</p>
    {:else if loadState === 'failed'}
      <div class="notice" role="alert">
        <p>{t.loadFailed}</p>
        <button class="button" type="button" onclick={load}>{t.retry}</button>
      </div>
    {:else if loadState === 'missing'}
      <p class="notice">{t.missing}</p>
    {:else if table && counts}
      <section class="short" aria-labelledby="pk-dw-short">
        <h2 id="pk-dw-short">{t.shortTitle}</h2>
        <p class="headline">{tallyText}</p>
        <p>{counts.fewer === 0 ? t.noneFewer : t.someFewer}</p>
        <p>{t.notOneLot}</p>
        <p class="small muted">{t.runOn(day(table.generated), day(table.data_through))}</p>
      </section>

      <section class="evidence" aria-labelledby="pk-dw-trials">
        <h2 id="pk-dw-trials">{t.trialsTitle}</h2>
        <p>{t.trialsIntro}</p>
        <ul>
          {#each t.trials as trial, i (trial)}
            <li>{trial} <a href={TRIAL_URLS[i]} target="_blank" rel="noopener noreferrer">{t.trialLinks[i]}</a></li>
          {/each}
        </ul>
        <p><a href="{config.siteBase}why/">{t.whyLink}</a></p>
        <h3>{t.warningsTitle}</h3>
        <ul>
          {#each t.warnings as warning (warning)}<li>{warning}</li>{/each}
        </ul>
      </section>

      {#each studied as kind (kind.id)}
        <section class="kind" aria-labelledby="pk-dw-{kind.id}" data-kind={kind.id}>
          <h2 id="pk-dw-{kind.id}">{t.kinds[kind.id]}</h2>
          {#if kindNote(kind)}<p class="caption">{kindNote(kind)}</p>{/if}
          {#each OUTCOMES as outcome (outcome)}
            {@const r = kind.results.find((x) => x.outcome === outcome)}
            {#if r}
              {@const lines = detailLines(r)}
              <article class="result" data-outcome={outcome} data-verdict={r.verdict}>
                <h3>{t.outcomes[outcome]}</h3>
                <p class="verdict {r.verdict}"><strong>{t.verdictLabels[r.verdict]}.</strong></p>
                {#each verdictSentence(kind.id, r, table.rules) as line (line)}<p>{line}</p>{/each}
                {#if lines.length}
                  <h4 class="checks-title">{t.checksTitle}</h4>
                  <ul class="checks small">
                    {#each lines as line (line)}<li>{line}</li>{/each}
                  </ul>
                {/if}
              </article>
            {/if}
          {/each}
        </section>
      {/each}

      <section class="kind" aria-labelledby="pk-dw-projects" data-kind="projects">
        <h2 id="pk-dw-projects">{t.kinds.projects}</h2>
        {#if projects && projectsCompared}
          {#each OUTCOMES as outcome (outcome)}
            {@const r = projects.results.find((x) => x.outcome === outcome)}
            {#if r}
              <article class="result" data-outcome={outcome} data-verdict={r.verdict}>
                <h3>{t.outcomes[outcome]}</h3>
                <p class="verdict {r.verdict}"><strong>{t.verdictLabels[r.verdict]}.</strong></p>
                {#each verdictSentence('projects', r, table.rules) as line (line)}<p>{line}</p>{/each}
                <ul class="checks small">
                  {#each detailLines(r) as line (line)}<li>{line}</li>{/each}
                </ul>
              </article>
            {/if}
          {/each}
        {/if}
        {#if table.projects_now}
          <p>{t.projectsNow(table.projects_now.shown, table.projects_now.ready, monthWords(table.projects_now.ready_before))}</p>
        {:else}
          <p>{t.projectsNotRead}</p>
        {/if}
        <p>{t.projectsNeed(table.rules.min_places)}</p>
        <p class="no-print"><a class="button small" href={projectReportUrl()} target="_blank" rel="noopener noreferrer">{t.projectsLink}</a></p>
      </section>

      <section aria-labelledby="pk-dw-cannot">
        <h2 id="pk-dw-cannot">{t.cannotTitle}</h2>
        <ul>
          {#each t.cannot as item (item)}<li>{item}</li>{/each}
          <li>{t.chance(counts.total)}</li>
        </ul>
      </section>

      <section aria-labelledby="pk-dw-method">
        <h2 id="pk-dw-method">{t.methodTitle}</h2>
        <ul>
          {#each t.method as item (item)}<li>{item}</li>{/each}
        </ul>
        <p><a href={DIDIT_METHOD_URL} target="_blank" rel="noopener noreferrer">{t.methodLink}</a></p>
      </section>

      <section class="sources" aria-labelledby="pk-dw-sources">
        <h2 id="pk-dw-sources">{t.sourcesTitle}</h2>
        <ul class="small">
          <li>{t.sources.landcare}</li>
          <li>{t.sources.clean_seal}</li>
          <li>{t.sources.demolition}</li>
          <li>{t.sources.shootings(day(table.outcomes.shootings.first), day(table.outcomes.shootings.last))}</li>
          <li>{t.sources.dumping(day(table.outcomes.dumping.first), day(table.outcomes.dumping.last))}</li>
          <li>{t.sources.complaints(day(table.outcomes.complaints.first), day(table.outcomes.complaints.last))}</li>
          <li>{t.sources.poverty}</li>
          <li>{t.sources.projects}</li>
        </ul>
      </section>
    {/if}
  </main>
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
    margin-bottom: 8px;
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
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-inline-start: auto;
  }
  header :global(.offer),
  header :global(.translation-note) {
    flex-basis: 100%;
  }
  section {
    margin: 24px 0;
  }
  .headline {
    font-size: 1.15rem;
    font-weight: 600;
  }
  .caption {
    color: var(--pk-muted);
  }
  .evidence {
    padding: 4px 14px;
    border-inline-start: 4px solid var(--pk-accent);
    border-radius: var(--pk-radius);
    background: var(--pk-surface);
  }
  .result {
    margin: 14px 0;
    padding: 10px 14px;
    border: 1px solid var(--pk-border);
    border-radius: var(--pk-radius);
    break-inside: avoid;
  }
  .result h3 {
    margin: 0 0 6px;
    font-size: 1.02rem;
  }
  .result p {
    margin: 4px 0;
  }
  .verdict {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--pk-radius);
    background: var(--pk-surface);
  }
  .checks-title {
    margin: 10px 0 2px;
    font-size: 0.9rem;
  }
  .checks {
    margin: 4px 0 0;
    padding-inline-start: 1.2em;
  }
  .checks li {
    margin: 3px 0;
  }
  .sources ul {
    padding-inline-start: 1.2em;
  }
  @media print {
    .tools,
    .no-print,
    header :global(.offer) {
      display: none !important;
    }
    .page {
      max-width: none;
      padding: 0;
    }
    .evidence {
      background: none;
    }
    a[href^='http']::after {
      content: ' (' attr(href) ')';
      font-size: 0.8em;
      word-break: break-all;
    }
  }
</style>
