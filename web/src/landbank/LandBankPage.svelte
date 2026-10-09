<script lang="ts">
  // "The Land Bank in numbers" (M4.4, issue #40): what the Philadelphia Land Bank and the City's
  // other land agencies conveyed, year by year, from the City's deed records
  // (tables/land_bank.json, docs/CONTRACTS.md section 9), the City's own counts by program, and
  // the weekly count of lots listed as available. Neutral facts with their sources and dates, and
  // what the numbers cannot show; counts only, never a name, an address or a parcel (ETHICS.md).
  // Every chart has its table, and every section its CSV download, whose first line points to
  // the terms of use.
  import { onMount } from 'svelte';
  import { config } from '../config/index.ts';
  import {
    COUNCIL_LEGISLATION_URL,
    LAND_BANK_BOARD_URL,
    LAND_BANK_MAP_URL,
    LAND_BANK_METHOD_URL,
    LAND_CONVEYED_BY_FY_URL,
    REAL_ESTATE_TRANSFERS_URL,
  } from '../config/links.ts';
  import { statusKey } from '../dossier/listing.ts';
  import { plain } from '../dossier/plain.ts';
  import { saveFile } from '../places/export.ts';
  import { formatDate, formatMoney, formatNumber, sentenceCase, strings } from '../strings.ts';
  import Dialog from '../components/common/Dialog.svelte';
  import SiteNav from '../components/common/SiteNav.svelte';
  import LineChart from './LineChart.svelte';
  import StackedColumns from './StackedColumns.svelte';
  import {
    AGENCIES,
    AGENCY_CHOICES,
    BUYERS,
    CHARTED_BUYERS,
    SERIES_COLORS,
    SINGLE_COLOR,
    byAgencyYears,
    districtsCsv,
    listedCsv,
    loadTable,
    percent,
    programRows,
    programsCsv,
    yearsCsv,
    yearsFromFirst,
    type AgencyChoice,
    type CsvNotes,
    type LandBankTable,
    type Series,
  } from './data.ts';

  const t = strings.landBank;
  const AGENCY_PARAM = 'agency';

  let table = $state<LandBankTable | null>(null);
  let loadState = $state<'loading' | 'ok' | 'missing' | 'failed'>('loading');
  let menuOpen = $state(false);
  let choice = $state<AgencyChoice>(readChoice());

  function readChoice(): AgencyChoice {
    const value = new URLSearchParams(window.location.search).get(AGENCY_PARAM);
    return (AGENCY_CHOICES as string[]).includes(value ?? '') ? (value as AgencyChoice) : 'all';
  }

  function pick(value: string) {
    choice = (AGENCY_CHOICES as string[]).includes(value) ? (value as AgencyChoice) : 'all';
    const query = choice === 'all' ? '' : `?${AGENCY_PARAM}=${choice}`;
    history.replaceState(null, '', `${window.location.pathname}${query}`);
  }

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

  const stats = $derived(table ? table.agencies[choice] : null);
  const years = $derived(stats ? yearsFromFirst(stats) : []);
  const yearList = $derived(years.map((y) => y.year));
  const first = $derived(formatDate(table?.deeds.first));
  const last = $derived(formatDate(table?.deeds.last));
  const fetched = $derived(formatDate(table?.deeds.fetched));

  const agencySeries: Series[] = AGENCIES.map((a, i) => ({ key: a, label: t.agencies[a]!, color: SERIES_COLORS[i]! }));
  const buyerSeries: Series[] = CHARTED_BUYERS.map((b, i) => ({ key: b, label: t.buyers.groups[b]!, color: SERIES_COLORS[i]! }));
  const sideYardSeries: Series[] = [{ key: 'side_yard', label: t.programs.series, color: SINGLE_COLOR }];
  const totalSeries: Series[] = $derived([{ key: 'n', label: t.agencies[choice]!, color: SINGLE_COLOR }]);

  const perYearValues = $derived(
    table && choice === 'all'
      ? byAgencyYears(table, 'all').map((row) => AGENCIES.map((a) => row.values[a]))
      : years.map((y) => [y.n]),
  );
  const buyerValues = $derived(years.map((y) => CHARTED_BUYERS.map((b) => y.buyers[b] ?? 0)));
  const sideYardValues = $derived(years.map((y) => [y.programs.side_yard]));

  function maxOf(rows: number[][]): string {
    return formatNumber(Math.max(0, ...rows.map((r) => r.reduce((a, b) => a + b, 0))));
  }

  const fyRows = $derived(table ? programRows(table) : []);
  const compareRows = $derived(fyRows.filter((r) => r.fy >= 2019 && r.side_yards !== null));
  const weeks = $derived(table?.listed?.weeks ?? []);
  const latestWeek = $derived(weeks.length ? weeks[weeks.length - 1]! : null);
  const districtRows = $derived(stats ? stats.districts.filter((d) => d.district !== null) : []);
  const noLocation = $derived(stats?.districts.find((d) => d.district === null)?.n ?? 0);
  const districtMax = $derived(Math.max(1, ...districtRows.map((d) => d.n)));

  function statusLabel(status: string): string {
    const known = strings.dossier.owner.cityStatuses[statusKey(status)];
    return known ? sentenceCase(known[0]) : plain(sentenceCase(status));
  }

  function notes(about: string): CsvNotes {
    const siteUrl = new URL(config.siteBase, window.location.href).href;
    return {
      terms: strings.export.termsLine(`${siteUrl}terms/`),
      about: [about, t.csv.counts, t.csv.dates(table?.deeds.fetched ?? '', table?.deeds.last ?? '')],
    };
  }

  function download(part: 'years' | 'districts' | 'programs' | 'listed') {
    if (!table) return;
    const day = new Date().toISOString().slice(0, 10);
    const text =
      part === 'years'
        ? yearsCsv(table, notes(t.csv.years(t.agencies[choice]!)))
        : part === 'districts'
          ? districtsCsv(table, notes(t.csv.districts))
          : part === 'programs'
            ? programsCsv(table, notes(t.csv.programs))
            : listedCsv(table, notes(t.csv.listed), statusLabel);
    saveFile(t.csv.file(part, day), text, 'text/csv;charset=utf-8');
  }

  $effect(() => {
    document.title = `${t.pageTitle}, Placekeepers`;
  });
</script>

<div class="page">
  <header>
    <a class="back" href={config.siteBase}>{t.back}</a>
    <button class="button quiet small menu" type="button" aria-haspopup="dialog" onclick={() => (menuOpen = true)}>{strings.nav.menu}</button>
    <h1>{t.pageTitle}</h1>
    <p>{t.intro}</p>
  </header>

  <Dialog bind:open={menuOpen} title={strings.nav.menuTitle} id="pk-menu">
    <SiteNav current="land-bank" />
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
    {:else if table && stats}
      <form class="choose" onsubmit={(e) => e.preventDefault()}>
        <label>
          <span>{t.agencyLabel}</span>
          <select value={choice} onchange={(e) => pick(e.currentTarget.value)}>
            {#each AGENCY_CHOICES as a (a)}<option value={a}>{t.agencies[a]}</option>{/each}
          </select>
        </label>
        <p class="small muted">{t.agencyHelp}</p>
      </form>

      <section class="summary" aria-labelledby="pk-lb-summary" aria-live="polite">
        <h2 id="pk-lb-summary" class="visually-hidden">{t.agencies[choice]}</h2>
        {#if first && last}
          <p class="headline">{t.headline(t.agencyLong[choice]!, stats.total.n, stats.total.deeds, first, last)}</p>
        {/if}
        <p>{choice === 'all' ? t.movedAll(stats.total.moved_out) : t.moved(stats.total.moved_in, stats.total.moved_out)}</p>
        <p>{t.whatCounts}</p>
        {#if table.deeds.partial_year && last}<p class="small muted">{t.partial(table.deeds.partial_year, last)}</p>{/if}
        <p class="small muted">{t.noNames}</p>
      </section>

      <section aria-labelledby="pk-lb-years">
        <h2 id="pk-lb-years">{t.perYear.title}</h2>
        <p class="caption">{t.perYear.caption}</p>
        <StackedColumns
          years={yearList}
          series={choice === 'all' ? agencySeries : totalSeries}
          values={perYearValues}
          label={t.chartLabel(t.perYear.title, yearList[0] ?? 0, yearList[yearList.length - 1] ?? 0, maxOf(perYearValues))}
        />
        <details>
          <summary>{t.showNumbers}</summary>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (a table that may scroll sideways is reached with the keyboard) -->
          <div class="table-wrap" role="region" aria-label={t.perYear.title} tabindex="0">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.year}</th>
                  {#if choice === 'all'}{#each AGENCIES as a (a)}<th scope="col">{t.agencies[a]}</th>{/each}{/if}
                  <th scope="col">{choice === 'all' ? t.total : t.properties}</th>
                  <th scope="col">{t.perYear.deeds}</th>
                </tr>
              </thead>
              <tbody>
                {#each years as y, i (y.year)}
                  <tr>
                    <th scope="row">{y.year}</th>
                    {#if choice === 'all'}{#each AGENCIES as a, j (a)}<td>{formatNumber(perYearValues[i]?.[j] ?? 0)}</td>{/each}{/if}
                    <td>{formatNumber(y.n)}</td>
                    <td>{formatNumber(y.deeds)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </details>
        <p><button class="button quiet small" type="button" onclick={() => download('years')}>{t.downloadCsv}</button></p>
      </section>

      <section aria-labelledby="pk-lb-buyers">
        <h2 id="pk-lb-buyers">{t.buyers.title}</h2>
        <p class="caption">{t.buyers.caption}</p>
        <p class="small">
          {t.buyers.shares}:
          {CHARTED_BUYERS.map((b) => t.buyers.share(t.buyers.groups[b]!, percent(stats.total.buyers[b] ?? 0, stats.total.n) ?? 0)).join(', ')}.
        </p>
        <StackedColumns
          years={yearList}
          series={buyerSeries}
          values={buyerValues}
          label={t.chartLabel(t.buyers.title, yearList[0] ?? 0, yearList[yearList.length - 1] ?? 0, maxOf(buyerValues))}
        />
        <details>
          <summary>{t.showNumbers}</summary>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (a table that may scroll sideways is reached with the keyboard) -->
          <div class="table-wrap" role="region" aria-label={t.buyers.title} tabindex="0">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.year}</th>
                  {#each BUYERS as b (b)}<th scope="col">{t.buyers.groups[b]}</th>{/each}
                </tr>
              </thead>
              <tbody>
                {#each years as y (y.year)}
                  <tr>
                    <th scope="row">{y.year}</th>
                    {#each BUYERS as b (b)}<td>{formatNumber(y.buyers[b] ?? 0)}</td>{/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </details>
        <p><button class="button quiet small" type="button" onclick={() => download('years')}>{t.downloadCsv}</button></p>
      </section>

      <section aria-labelledby="pk-lb-programs">
        <h2 id="pk-lb-programs">{t.programs.title}</h2>
        <p class="caption">{t.programs.caption}</p>
        <StackedColumns
          years={yearList}
          series={sideYardSeries}
          values={sideYardValues}
          label={t.chartLabel(t.programs.series, yearList[0] ?? 0, yearList[yearList.length - 1] ?? 0, maxOf(sideYardValues))}
        />
        <p class="small">{t.programs.checked}</p>
        {#if compareRows.length}
          <p class="small">
            {t.programs.compare(
              compareRows.reduce((a, r) => a + (r.side_yards ?? 0), 0),
              compareRows.reduce((a, r) => a + r.inferred_all, 0),
              compareRows.reduce((a, r) => a + r.inferred_plb, 0),
              compareRows[0]!.fy,
              compareRows[compareRows.length - 1]!.fy,
            )}
          </p>
        {/if}
        <details>
          <summary>{t.showNumbers}</summary>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (a table that may scroll sideways is reached with the keyboard) -->
          <div class="table-wrap" role="region" aria-label={t.programs.series} tabindex="0">
            <table>
              <thead><tr><th scope="col">{t.year}</th><th scope="col">{t.programs.series}</th><th scope="col">{t.properties}</th></tr></thead>
              <tbody>
                {#each years as y (y.year)}
                  <tr><th scope="row">{y.year}</th><td>{formatNumber(y.programs.side_yard)}</td><td>{formatNumber(y.n)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </details>

        {#if table.programs_fy && fyRows.length}
          <h3>{t.programs.cityTitle}</h3>
          <p class="caption">{t.programs.cityCaption(formatDate(table.programs_fy.edited) ?? table.programs_fy.edited)}</p>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (a table that may scroll sideways is reached with the keyboard) -->
          <div class="table-wrap" role="region" aria-label={t.programs.cityTitle} tabindex="0">
            <table class="wide">
              <thead>
                <tr>
                  <th scope="col">{t.programs.fy}</th>
                  <th scope="col">{t.programs.sideYards}</th>
                  <th scope="col">{t.programs.gardens}</th>
                  <th scope="col">{t.programs.business}</th>
                  <th scope="col">{t.programs.homesBelow30}</th>
                  <th scope="col">{t.programs.homes60to80}</th>
                  <th scope="col">{t.programs.homes80to120}</th>
                  <th scope="col">{t.programs.homesMarket}</th>
                  <th scope="col">{t.programs.oursPlb}</th>
                  <th scope="col">{t.programs.oursAll}</th>
                </tr>
              </thead>
              <tbody>
                {#each fyRows as r (r.fy)}
                  <tr>
                    <th scope="row">{t.programs.fyLabel(r.fy)}</th>
                    {#each [r.side_yards, r.gardens, r.business, r.homes_below_30, r.homes_60_80, r.homes_80_120, r.homes_market, r.inferred_plb, r.inferred_all] as v, k (k)}
                      <td>{v === null ? '' : formatNumber(v)}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <p><button class="button quiet small" type="button" onclick={() => download('programs')}>{t.downloadCsv}</button></p>
        {/if}
      </section>

      <section aria-labelledby="pk-lb-prices">
        <h2 id="pk-lb-prices">{t.prices.title}</h2>
        <p class="caption">{t.prices.caption(formatMoney(table.deeds.nominal_max))}</p>
        {#if stats.total.price.median !== null}
          <p>{t.prices.summary(formatMoney(stats.total.price.median), percent(stats.total.price.nominal, stats.total.price.priced) ?? 0)}</p>
        {/if}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (a table that may scroll sideways is reached with the keyboard) -->
        <div class="table-wrap" role="region" aria-label={t.prices.title} tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col">{t.year}</th>
                <th scope="col">{t.prices.priced}</th>
                <th scope="col">{t.prices.median}</th>
                <th scope="col">{t.prices.nominal}</th>
                <th scope="col">{t.prices.none}</th>
              </tr>
            </thead>
            <tbody>
              {#each years as y (y.year)}
                <tr>
                  <th scope="row">{y.year}</th>
                  <td>{formatNumber(y.price.priced)}</td>
                  <td>{y.price.median === null ? '' : formatMoney(y.price.median)}</td>
                  <td>{formatNumber(y.price.nominal)}</td>
                  <td>{formatNumber(y.price.none)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p><button class="button quiet small" type="button" onclick={() => download('years')}>{t.downloadCsv}</button></p>
      </section>

      <section aria-labelledby="pk-lb-districts">
        <h2 id="pk-lb-districts">{t.districts.title}</h2>
        <p class="caption">{t.districts.caption}</p>
        <ul class="bars" aria-label={t.districts.chartLabel}>
          {#each districtRows as d (d.district)}
            <li>
              <span class="bar-label">{t.districts.districtName(d.district ?? 0)}</span>
              <span class="bar-track"><span class="bar-fill" style="width: {(100 * d.n) / districtMax}%; background: {SINGLE_COLOR}"></span></span>
              <span class="bar-value">{formatNumber(d.n)}</span>
            </li>
          {/each}
        </ul>
        {#if noLocation}<p class="small muted">{t.districts.noLocation}: {formatNumber(noLocation)}</p>{/if}
        <p><button class="button quiet small" type="button" onclick={() => download('districts')}>{t.downloadCsv}</button></p>
      </section>

      <section aria-labelledby="pk-lb-listed">
        <h2 id="pk-lb-listed">{t.listed.title}</h2>
        {#if weeks.length}
          <p class="caption">{t.listed.caption(formatDate(weeks[0]!.date) ?? weeks[0]!.date)}</p>
          {#if weeks.length > 1}
            <LineChart
              points={weeks.map((w) => ({ date: w.date, value: w.listed }))}
              label={t.listed.chartLabel(formatDate(weeks[0]!.date) ?? '', formatDate(weeks[weeks.length - 1]!.date) ?? '')}
            />
          {:else}
            <p class="small muted">{t.listed.oneWeek}</p>
          {/if}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (a table that may scroll sideways is reached with the keyboard) -->
          <div class="table-wrap" role="region" aria-label={t.listed.title} tabindex="0">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.listed.date}</th>
                  <th scope="col">{t.listed.records}</th>
                  <th scope="col">{t.listed.parcels}</th>
                  <th scope="col">{t.listed.sideYard}</th>
                </tr>
              </thead>
              <tbody>
                {#each [...weeks].reverse() as w (w.date)}
                  <tr>
                    <th scope="row">{formatDate(w.date)}</th>
                    <td>{formatNumber(w.listed)}</td>
                    <td>{formatNumber(w.parcels)}</td>
                    <td>{formatNumber(w.side_yard)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if latestWeek}
            <details>
              <summary>{t.listed.byStatus(formatDate(latestWeek.date) ?? latestWeek.date)}</summary>
              <!-- svelte-ignore a11y_no_noninteractive_tabindex (a table that may scroll sideways is reached with the keyboard) -->
              <div class="table-wrap" role="region" aria-label={t.listed.byStatus(formatDate(latestWeek.date) ?? '')} tabindex="0">
                <table>
                  <thead><tr><th scope="col">{t.listed.status}</th><th scope="col">{t.listed.count}</th></tr></thead>
                  <tbody>
                    {#each Object.entries(latestWeek.by_status) as [status, n] (status)}
                      <tr><th scope="row">{statusLabel(status)}</th><td>{formatNumber(n)}</td></tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </details>
          {/if}
          <p>
            <button class="button quiet small" type="button" onclick={() => download('listed')}>{t.downloadCsv}</button>
            <a href={LAND_BANK_MAP_URL} target="_blank" rel="noopener noreferrer">{t.listed.mapLink}</a>
          </p>
        {:else}
          <p class="notice">{t.missing}</p>
        {/if}
      </section>

      <section aria-labelledby="pk-lb-limits">
        <h2 id="pk-lb-limits">{t.limits.title}</h2>
        <ul>
          {#each t.limits.items as item (item)}<li>{item}</li>{/each}
        </ul>
      </section>

      <section aria-labelledby="pk-lb-sources" class="sources">
        <h2 id="pk-lb-sources">{t.sources.title}</h2>
        <ul>
          {#if fetched && last}<li>{t.sources.deeds(fetched, last)} <a href={REAL_ESTATE_TRANSFERS_URL} target="_blank" rel="noopener noreferrer">{t.sources.deedsLink}</a></li>{/if}
          {#if table.programs_fy}
            <li>
              {t.sources.programs(formatDate(table.programs_fy.edited) ?? table.programs_fy.edited)}
              <a href={LAND_CONVEYED_BY_FY_URL} target="_blank" rel="noopener noreferrer">{t.sources.programsLink}</a>
            </li>
          {/if}
          <li>{t.sources.listed}</li>
          <li>{t.sources.districts}</li>
          <li>{t.sources.neighbours}</li>
          <li><a href={LAND_BANK_BOARD_URL} target="_blank" rel="noopener noreferrer">{t.sources.board}</a></li>
          <li><a href={COUNCIL_LEGISLATION_URL} target="_blank" rel="noopener noreferrer">{t.sources.council}</a></li>
          <li><a href={LAND_BANK_METHOD_URL} target="_blank" rel="noopener noreferrer">{t.sources.method}</a></li>
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
  .menu {
    margin-left: auto;
  }
  section {
    margin: 24px 0;
  }
  .choose label {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    font-weight: 600;
  }
  .choose select {
    font: inherit;
    padding: 6px 8px;
    min-height: 40px;
    max-width: 100%;
  }
  .headline {
    font-size: 1.15rem;
    font-weight: 600;
  }
  .caption {
    color: var(--pk-muted);
  }
  .table-wrap {
    overflow-x: auto;
    max-width: 100%;
  }
  table {
    font-variant-numeric: tabular-nums;
  }
  table.wide {
    min-width: 640px;
  }
  .bars {
    list-style: none;
    margin: 8px 0;
    padding: 0;
    display: grid;
    gap: 6px;
    max-width: 560px;
  }
  .bars li {
    display: grid;
    grid-template-columns: 6.5em 1fr 3.5em;
    align-items: center;
    gap: 8px;
  }
  .bar-track {
    display: block;
    height: 12px;
  }
  .bar-fill {
    display: block;
    height: 100%;
    min-width: 2px;
    border-radius: 0 4px 4px 0;
  }
  .bar-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .sources a,
  section > p > a {
    margin-left: 4px;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
