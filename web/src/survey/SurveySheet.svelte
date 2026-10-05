<script lang="ts">
  // The survey sheet for one direction of a route (M2.4): the stops in order, what OpenStreetMap
  // shows at each one now, Yes and No boxes for a shelter, a bench, a waste basket and a light, a
  // box for "needs repair", and a notes column. Split among volunteers, each part starts on a new
  // printed page with its own estimate, safety tips and how to get the answers into
  // OpenStreetMap, so one part can be handed out alone. On a wide screen and on paper it is a
  // table; on a phone each stop is a card. The boxes work on screen too and are kept by the page
  // (SurveyPage.svelte). Black and white on paper: what OpenStreetMap shows is in words.
  import { strings } from '../strings.ts';
  import {
    QUESTIONS,
    directionLabel,
    estimateMinutes,
    formatDuration,
    formatMiles,
    osmEditUrl,
    osmViewUrl,
    splitParts,
    statusOf,
    type Answers,
    type Question,
    type RouteSheet,
    type SheetDirection,
    type YesNo,
  } from './sheet.ts';

  let {
    sheet,
    direction,
    parts = 1,
    answers = {},
    only = null,
    asOf = '',
    onanswer,
    onrepair,
    onnote,
    onprint,
  }: {
    sheet: RouteSheet;
    direction: SheetDirection;
    parts?: number;
    answers?: Answers;
    /** while printing one part alone: its number */
    only?: number | null;
    /** the dates of the data, in words */
    asOf?: string;
    onanswer?: (stop: string, question: Question, value: YesNo) => void;
    onrepair?: (stop: string) => void;
    onnote?: (stop: string, text: string) => void;
    onprint?: (part: number) => void;
  } = $props();

  const t = strings.survey;
  const split = $derived(splitParts(direction.stops, parts));
  const title = $derived(t.sheetFor(sheet.r, directionLabel(direction)));
</script>

{#each split as part (part.number)}
  {@const minutes = estimateMinutes(part.meters, part.stops.length)}
  <section
    class="part"
    class:skip={only !== null && only !== part.number}
    class:new-page={only === null && part.number > 1}
    aria-labelledby="pk-part-{part.number}"
  >
    <div class="head">
      <p class="brand print-only">Placekeepers</p>
      <h2 id="pk-part-{part.number}">
        {title}{#if split.length > 1}<br /><span class="which">{t.part(part.number, split.length)}: {t.partStops(part.first, part.last)}</span>{/if}
      </h2>
      <p class="estimate">{t.partEstimate(formatDuration(minutes), formatMiles(part.meters))}</p>
      <p class="fill-lines print-only"><span>{t.nameLine}</span><span>{t.dateLine}</span></p>
      {#if split.length > 1 && onprint}
        <button class="button quiet small screen-only" type="button" onclick={() => onprint(part.number)}>{t.printPart(part.number)}</button>
      {/if}
    </div>

    <div class="print-only box">
      <p><strong>{t.safetyTitle}.</strong> {t.safety.join(' ')}</p>
      <p>{t.howToFill}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th scope="col" class="c-num">{t.columns.number}</th>
          <th scope="col" class="c-stop">{t.columns.stop}</th>
          <th scope="col" class="c-now">{t.columns.now}</th>
          {#each QUESTIONS as q (q)}<th scope="col" class="c-yn">{t.columns[q]}</th>{/each}
          <th scope="col" class="c-rp">{t.columns.rp}</th>
          <th scope="col" class="c-nt">{t.columns.nt}</th>
        </tr>
      </thead>
      <tbody>
        {#each part.stops as stop, i (stop.k)}
          {@const n = part.first + i}
          {@const status = statusOf(stop)}
          {@const mine = answers[stop.k] ?? {}}
          <tr>
            <td class="c-num">{n}</td>
            <th scope="row" class="c-stop">
              <span class="name">{stop.nm}</span>
              <span class="sid">{t.stopNumber(stop.sid)}</span>
            </th>
            <td class="c-now" data-status={status}>
              <span class="status">{t.status[status]}</span>
              <span class="links screen-only">
                <a href={osmViewUrl(stop)} target="_blank" rel="noopener noreferrer">{t.openOsm}</a>
                <a href={osmEditUrl(stop)} target="_blank" rel="noopener noreferrer">{t.editOsm}</a>
              </span>
            </td>
            {#each QUESTIONS as q (q)}
              <td class="c-yn">
                <span class="cell-label" aria-hidden="true">{t.columns[q]}</span>
                {#each [['y', t.yes, t.yesShort], ['n', t.no, t.noShort]] as [value, long, short] (value)}
                  <label class="tick">
                    <input
                      type="checkbox"
                      checked={mine[q] === value}
                      aria-label={t.answerLabel(n, stop.nm, t.columns[q]!, long!)}
                      onchange={() => onanswer?.(stop.k, q, value as YesNo)}
                    /><span class="short" aria-hidden="true">{short}</span><span class="long" aria-hidden="true">{long}</span>
                  </label>
                {/each}
              </td>
            {/each}
            <td class="c-rp">
              <label class="tick">
                <input type="checkbox" checked={mine.rp === true} aria-label={t.repairLabel(n, stop.nm)} onchange={() => onrepair?.(stop.k)} /><span
                  class="long"
                  aria-hidden="true">{t.columns.rp}</span
                >
              </label>
            </td>
            <td class="c-nt">
              <span class="cell-label" aria-hidden="true">{t.columns.nt}</span>
              <input
                class="notes"
                type="text"
                maxlength="500"
                value={mine.nt ?? ''}
                aria-label={t.notesLabel(n, stop.nm)}
                onchange={(e) => onnote?.(stop.k, e.currentTarget.value)}
              />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <div class="print-only box after">
      <p><strong>{t.answersTitle}.</strong> {t.withApp} {t.withoutApp} {t.editorSteps.join(' ')}</p>
      <p>{t.notFound} {t.repairNote} {t.updates}</p>
      <p class="credit">{t.printedFrom} {asOf}</p>
    </div>
  </section>
{/each}

<style>
  .part {
    margin: 20px 0 28px;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    margin-bottom: 8px;
  }
  .head h2,
  .head .estimate {
    flex-basis: 100%;
    margin: 0;
  }
  .which {
    font-size: 0.95rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th,
  td {
    padding: 6px;
    border: 1px solid var(--pk-surface-2);
    text-align: left;
    vertical-align: top;
  }
  thead th {
    background: var(--pk-surface);
    font-size: 0.8rem;
  }
  tbody th {
    font-weight: 600;
  }
  .sid {
    display: block;
    font-weight: 400;
    font-size: 0.8rem;
    color: var(--pk-muted);
  }
  .c-num {
    width: 2.5em;
    text-align: right;
  }
  .c-yn,
  .c-rp {
    white-space: nowrap;
  }
  .links {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 0.8rem;
  }
  .c-now[data-status='unsurveyed'] .status,
  .c-now[data-status='missing'] .status {
    font-style: italic;
  }
  .tick {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-right: 6px;
    min-height: 28px;
    cursor: pointer;
  }
  /* Square boxes that print in black and white, with a tick drawn when checked. */
  .tick input {
    appearance: none;
    width: 18px;
    height: 18px;
    margin: 0;
    border: 1.5px solid var(--pk-text);
    border-radius: 2px;
    background: var(--pk-bg);
    display: inline-grid;
    place-content: center;
    cursor: pointer;
  }
  .tick input:checked::before {
    content: '';
    width: 11px;
    height: 11px;
    background: var(--pk-text);
    clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
  }
  .tick .long,
  .cell-label {
    display: none;
  }
  .notes {
    width: 100%;
    min-width: 6em;
    min-height: 28px;
    border: none;
    border-bottom: 1px solid var(--pk-border);
    background: transparent;
    font: inherit;
  }

  /* A phone: each stop is a card, with its boxes labeled in words. */
  @media screen and (max-width: 720px) {
    table,
    tbody,
    tr,
    td,
    tbody th {
      display: block;
    }
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }
    tr {
      position: relative;
      margin: 0 0 10px;
      padding: 8px 10px 10px 40px;
      border: 1px solid var(--pk-surface-2);
      border-radius: var(--pk-radius);
    }
    td,
    tbody th {
      border: none;
      padding: 2px 0;
      width: auto;
    }
    .c-num {
      position: absolute;
      left: 8px;
      top: 8px;
      width: 26px;
      font-weight: 700;
    }
    .c-yn {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .cell-label {
      display: inline-block;
      min-width: 7.5em;
    }
    .tick {
      min-height: 36px;
      margin-right: 12px;
    }
    .tick .short {
      display: none;
    }
    .tick .long {
      display: inline;
    }
    .c-nt {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .notes {
      min-height: 36px;
    }
  }

  @media print {
    .part {
      margin: 0;
      font: 8.5pt/1.25 var(--pk-font);
      color: #000;
    }
    .skip {
      display: none;
    }
    .new-page {
      break-before: page;
    }
    .brand {
      margin: 0;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .head {
      margin-bottom: 4px;
    }
    .head h2 {
      font-size: 12pt;
    }
    .which {
      font-size: 10pt;
    }
    .fill-lines {
      display: flex;
      gap: 24px;
      flex-basis: 100%;
      margin: 4px 0 0;
    }
    .fill-lines span {
      flex: 1;
      border-bottom: 1px solid #000;
      padding-bottom: 10px;
    }
    .box {
      margin: 4px 0;
      padding: 4px 6px;
      border: 1px solid #000;
      font-size: 7.5pt;
    }
    .box p {
      margin: 0 0 2px;
    }
    .credit {
      color: #333;
    }
    table {
      font-size: 8.5pt;
    }
    th,
    td {
      border: 1px solid #000;
      padding: 2px 4px;
      color: #000;
    }
    thead th {
      background: #fff;
      font-size: 7.5pt;
      vertical-align: bottom;
    }
    tbody tr {
      height: 0.36in;
      break-inside: avoid;
    }
    .c-num {
      width: 0.3in;
    }
    .c-stop {
      width: 1.9in;
    }
    .c-now {
      width: 0.8in;
      font-size: 7.5pt;
    }
    .c-yn {
      width: 0.62in;
    }
    .c-rp {
      width: 0.48in;
    }
    .sid {
      color: #000;
      font-size: 7pt;
    }
    .tick {
      min-height: 0;
      margin-right: 3px;
      gap: 1px;
    }
    .tick input {
      width: 11px;
      height: 11px;
      border: 1px solid #000;
      background: #fff;
    }
    .tick input:checked::before {
      width: 8px;
      height: 8px;
      background: #000;
    }
    .notes {
      border: none;
      min-height: 0;
      font-size: 8pt;
    }
  }
</style>
