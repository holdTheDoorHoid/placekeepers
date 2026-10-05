<script lang="ts">
  // The "Survey a route" page (M2.4): pick a SEPTA bus or trolley route, a direction and how many
  // people share the walk, and get the survey sheet (SurveySheet.svelte) with a summary, our own
  // time estimate, safety tips and how to get the answers into OpenStreetMap. The choice lives in
  // the address (?route=47&d=0&parts=3) so a sheet can be shared. What someone ticks stays in this
  // browser only (sheet.ts). What OpenStreetMap says at each stop comes from its own file and is
  // joined to the sheet here (decision D1, src/transit/answers.ts).
  import { onMount, tick } from 'svelte';
  import { config } from '../config/index.ts';
  import { formatDate, strings } from '../strings.ts';
  import Dialog from '../components/common/Dialog.svelte';
  import SiteNav from '../components/common/SiteNav.svelte';
  import { loadStopTable } from '../transit/answers.ts';
  import SurveySheet from './SurveySheet.svelte';
  import {
    MAX_PARTS,
    answeredCount,
    answersKey,
    directionLabel,
    estimateMinutes,
    formatDuration,
    formatMiles,
    isTrolley,
    joinSheet,
    loadAnswers,
    moveLegacyAnswers,
    parseIndex,
    parseSheet,
    readChoice,
    routeLabel,
    saveAnswers,
    statusCounts,
    toggle,
    writeChoice,
    type Answers,
    type Choice,
    type Question,
    type RouteIndex,
    type RouteSheet,
    type StopStatus,
    type YesNo,
  } from './sheet.ts';

  const t = strings.survey;
  const STATUS_ORDER: StopStatus[] = ['shelter', 'bench', 'neither', 'unsurveyed', 'missing'];

  let index = $state<RouteIndex | null>(null);
  let indexState = $state<'loading' | 'ok' | 'failed' | 'missing'>('loading');
  let choice = $state<Choice>(readChoice(window.location.search));
  let sheet = $state<RouteSheet | null>(null);
  let sheetState = $state<'idle' | 'loading' | 'ok' | 'failed'>('idle');
  let answers = $state<Answers>({});
  let kept = $state(true);
  let only = $state<number | null>(null);
  let menuOpen = $state(false);
  /** What OpenStreetMap says at each stop (tables/stop_amenities.json), loaded once per visit. */
  const stopTable = loadStopTable(config.dataBase);
  /** The table could not be loaded: linked stops show as not yet surveyed, and the page says so. */
  let answersMissing = $state(false);

  function storage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  const buses = $derived(index?.routes.filter((r) => !isTrolley(r.md)) ?? []);
  const trolleys = $derived(index?.routes.filter((r) => isTrolley(r.md)) ?? []);
  const entry = $derived(index?.routes.find((r) => r.id === choice.route) ?? null);
  const direction = $derived(sheet ? (sheet.directions.find((d) => d.d === choice.d) ?? sheet.directions[0] ?? null) : null);
  const counts = $derived(direction ? statusCounts(direction.stops) : null);
  const asOf = $derived(t.asOf(formatDate(sheet?.as_of.osm ?? index?.as_of.osm), sheet?.as_of.schedules ?? index?.as_of.schedules ?? null));
  const filled = $derived(direction ? answeredCount(answers, direction.stops) : 0);

  function remember() {
    history.replaceState(null, '', `${window.location.pathname}${writeChoice(choice)}`);
  }

  async function loadIndex() {
    indexState = 'loading';
    try {
      const response = await fetch(`${config.dataBase}tables/routes/index.json`);
      if (response.status === 404) {
        indexState = 'missing';
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      index = parseIndex(await response.json());
      indexState = index && index.routes.length ? 'ok' : 'missing';
      if (indexState === 'ok' && choice.route) {
        if (index?.routes.some((r) => r.id === choice.route)) await loadSheet();
        else choice = { route: null, d: null, parts: 1 };
      }
    } catch {
      indexState = 'failed';
    }
  }

  async function loadSheet() {
    const wanted = entry;
    if (!wanted) return;
    sheetState = 'loading';
    sheet = null;
    try {
      const response = await fetch(`${config.dataBase}${wanted.file}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = parseSheet(await response.json());
      if (!parsed || !parsed.directions.length) throw new Error('not a route sheet');
      const table = await stopTable;
      if (choice.route !== wanted.id) return; // someone picked another route meanwhile
      answersMissing = table === null;
      sheet = joinSheet(parsed, table);
      if (!parsed.directions.some((d) => d.d === choice.d)) choice.d = parsed.directions[0]!.d;
      sheetState = 'ok';
      readAnswers();
      remember();
    } catch {
      if (choice.route === wanted.id) sheetState = 'failed';
    }
  }

  function readAnswers() {
    if (!sheet || choice.d === null) return;
    const store = storage();
    answers = loadAnswers(store, answersKey(sheet.id, choice.d));
    kept = store !== null;
  }

  function writeAnswers(next: Answers) {
    answers = next;
    if (sheet && choice.d !== null) kept = saveAnswers(storage(), answersKey(sheet.id, choice.d), next);
  }

  function pickRoute(id: string) {
    choice = { route: id || null, d: null, parts: choice.parts };
    sheet = null;
    answers = {};
    remember();
    if (id) loadSheet();
    else sheetState = 'idle';
  }

  function pickDirection(d: number) {
    choice.d = d;
    readAnswers();
    remember();
  }

  function pickParts(parts: number) {
    choice.parts = parts;
    remember();
  }

  function answer(stop: string, question: Question, value: YesNo) {
    writeAnswers({ ...answers, [stop]: toggle(answers[stop], question, value) });
  }

  function repair(stop: string) {
    const next = { ...answers[stop] };
    if (next.rp) delete next.rp;
    else next.rp = true;
    writeAnswers({ ...answers, [stop]: next });
  }

  function note(stop: string, text: string) {
    const next = { ...answers[stop] };
    const trimmed = text.trim().slice(0, 500);
    if (trimmed) next.nt = trimmed;
    else delete next.nt;
    writeAnswers({ ...answers, [stop]: next });
  }

  function clearAnswers() {
    if (window.confirm(t.clearConfirm)) writeAnswers({});
  }

  async function print(part: number | null) {
    only = part;
    await tick();
    window.print();
    only = null;
  }

  $effect(() => {
    document.title = sheet && direction ? `${t.title(sheet.r, directionLabel(direction))}, Placekeepers` : `${t.pageTitle}, Placekeepers`;
  });

  onMount(() => {
    const reset = () => (only = null);
    window.addEventListener('afterprint', reset);
    moveLegacyAnswers(storage());
    loadIndex();
    return () => window.removeEventListener('afterprint', reset);
  });
</script>

<div class="page">
  <header class="topbar screen-only">
    <a class="brand" href={config.siteBase}>{strings.app.name}</a>
    <button class="button quiet small" type="button" aria-haspopup="dialog" onclick={() => (menuOpen = true)}>
      {strings.nav.menu}
    </button>
  </header>

  <main>
    <div class="screen-only">
      <h1>{t.pageTitle}</h1>
      <p>{t.intro} <a href="{config.siteBase}streetcomplete/">{t.guideLink}</a>.</p>

      {#if indexState === 'loading'}
        <p role="status">{t.loading}</p>
      {:else if indexState === 'failed'}
        <div class="notice" role="alert">
          <p>{t.loadFailed}</p>
          <button class="button" type="button" onclick={loadIndex}>{t.retry}</button>
        </div>
      {:else if indexState === 'missing'}
        <p class="notice">{t.notPublished}</p>
      {:else if index}
        <form class="choose" onsubmit={(e) => e.preventDefault()}>
          <label>
            <span>{t.routeLabel}</span>
            <select value={choice.route ?? ''} onchange={(e) => pickRoute(e.currentTarget.value)}>
              <option value="" disabled>{t.routePlaceholder}</option>
              {#if buses.length}
                <optgroup label={t.buses}>
                  {#each buses as route (route.id)}<option value={route.id}>{routeLabel(route)}</option>{/each}
                </optgroup>
              {/if}
              {#if trolleys.length}
                <optgroup label={t.trolleys}>
                  {#each trolleys as route (route.id)}<option value={route.id}>{routeLabel(route)}</option>{/each}
                </optgroup>
              {/if}
            </select>
          </label>
          {#if entry}
            <label>
              <span>{t.directionLabel}</span>
              <select value={choice.d ?? entry.dirs[0]?.d} onchange={(e) => pickDirection(Number(e.currentTarget.value))} disabled={!sheet}>
                {#each entry.dirs as dir (dir.d)}
                  <option value={dir.d}>{directionLabel(dir)} ({t.stopCount(dir.n)})</option>
                {/each}
              </select>
            </label>
            <label>
              <span>{t.partsLabel}</span>
              <select value={choice.parts} onchange={(e) => pickParts(Number(e.currentTarget.value))}>
                {#each Array.from({ length: MAX_PARTS }, (_, i) => i + 1) as n (n)}
                  <option value={n}>{t.partsChoice(n)}</option>
                {/each}
              </select>
            </label>
          {/if}
        </form>

        {#if sheetState === 'loading'}
          <p role="status">{t.loading}</p>
        {:else if sheetState === 'failed'}
          <div class="notice" role="alert">
            <p>{t.sheetFailed}</p>
            <button class="button" type="button" onclick={loadSheet}>{t.retry}</button>
          </div>
        {/if}
      {/if}
    </div>

    {#if sheet && direction && counts}
      <section class="summary screen-only" aria-labelledby="pk-survey-title">
        <h2 id="pk-survey-title">{t.title(sheet.r, directionLabel(direction))}</h2>
        {#if sheet.nm}<p class="muted">{sheet.nm}</p>{/if}
        <p>
          {t.summary(direction.stops.length, formatMiles(direction.m))}
          {#if direction.out}{t.outside(direction.out)}{/if}
        </p>
        <h3>{t.statusTitle}</h3>
        {#if answersMissing}<p class="notice">{t.answersMissing}</p>{/if}
        <ul class="counts">
          {#each STATUS_ORDER.filter((k) => counts[k] > 0) as k (k)}
            <li>{t.stopCount(counts[k])} {t.statusLong[k]}</li>
          {/each}
        </ul>
        <h3>{t.estimateTitle}</h3>
        <p>{t.estimate(formatDuration(estimateMinutes(direction.m, direction.stops.length)))}</p>
        <p class="small muted">{t.estimateBasis}</p>
        {#if isTrolley(sheet.md)}<p class="notice">{t.trolleyTunnel}</p>{/if}
        {#if asOf}<p class="small muted">{asOf}</p>{/if}
        <p class="actions">
          <button class="button primary" type="button" onclick={() => print(null)}>{choice.parts > 1 ? t.printAll : t.print}</button>
          {#if filled}<button class="button quiet" type="button" onclick={clearAnswers}>{t.clear}</button>{/if}
        </p>
        <p class="small muted" role="status">{#if filled}{t.answered(filled, direction.stops.length)}{/if} {kept ? t.kept : t.notKept}</p>
      </section>

      <section class="guidance screen-only" aria-labelledby="pk-safety">
        <div>
          <h3 id="pk-safety">{t.safetyTitle}</h3>
          <ul>
            {#each t.safety as line (line)}<li>{line}</li>{/each}
          </ul>
          <p class="small">{t.howToFill}</p>
        </div>
        <div>
          <h3>{t.answersTitle}</h3>
          <p>{t.withApp} <a href="{config.siteBase}streetcomplete/">{t.guideLink}</a>.</p>
          <p>{t.withoutApp}</p>
          <ol>
            {#each t.editorSteps as step (step)}<li>{step}</li>{/each}
          </ol>
          <p class="small">{t.notFound}</p>
          <p class="small">{t.repairNote}</p>
          <p class="small">{t.updates}</p>
        </div>
      </section>

      <SurveySheet
        {sheet}
        {direction}
        parts={choice.parts}
        {answers}
        {only}
        {asOf}
        onanswer={answer}
        onrepair={repair}
        onnote={note}
        onprint={(n) => print(n)}
      />
    {/if}
  </main>

  <footer class="muted small screen-only">{strings.app.notAffiliated} {strings.app.licenses}</footer>
</div>

<Dialog bind:open={menuOpen} title={strings.nav.menuTitle} id="pk-menu">
  <SiteNav current="streetcomplete" />
</Dialog>

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 16px 32px;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .brand {
    font-size: 1.15rem;
    font-weight: 700;
    text-decoration: none;
    color: var(--pk-text);
  }
  h1 {
    font-size: 1.6rem;
    margin-top: 8px;
  }
  main > div > p {
    max-width: 70ch;
  }
  .choose {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
    margin: 16px 0;
  }
  .choose label {
    display: grid;
    gap: 4px;
    font-weight: 600;
    flex: 1 1 220px;
    max-width: 100%;
  }
  .choose select {
    width: 100%;
    min-height: 40px;
    font: inherit;
    font-weight: 400;
    padding: 6px 8px;
    border: 1px solid var(--pk-border);
    border-radius: var(--pk-radius);
    background: var(--pk-bg);
    color: var(--pk-text);
  }
  .summary {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--pk-surface-2);
  }
  .summary h3 {
    margin-top: 12px;
  }
  .counts {
    margin: 0;
    padding-left: 20px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .guidance {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 8px 24px;
    margin-top: 16px;
    padding: 12px 16px;
    border-radius: var(--pk-radius);
    background: var(--pk-surface);
  }
  .guidance ul,
  .guidance ol {
    padding-left: 20px;
    margin: 0 0 8px;
  }
  footer {
    margin-top: 24px;
  }
  @media print {
    .page {
      max-width: none;
      padding: 0;
    }
  }
</style>
