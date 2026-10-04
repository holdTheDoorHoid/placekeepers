<script lang="ts">
  // The one page printed lot page (src/dossier/print.ts). Hidden on screen; when someone prints
  // with a lot page open, only this is printed.
  import type { DossierView } from '../../dossier/build.ts';
  import { printModel } from '../../dossier/print.ts';
  import { strings } from '../../strings.ts';

  let { view, now = new Date() }: { view: DossierView; now?: Date } = $props();
  const m = $derived(printModel(view, now));
  const s = strings.dossier;
</script>

<article class="print-sheet">
  <header>
    <p class="brand">{strings.app.name}</p>
    <h1>{m.title}</h1>
    <p class="meta">{s.parcel(m.opa)}. {m.printed}</p>
  </header>

  <section>
    <h2>{s.sections.summary}</h2>
    <p><strong>{m.summary.kind}</strong>{#if m.summary.confidence}. {m.summary.confidence}{/if}.</p>
    {#if m.summary.reasons.length}
      <ul>{#each m.summary.reasons as reason (reason)}<li>{reason}.</li>{/each}</ul>
    {/if}
    {#if m.summary.cityCalls}<p>{m.summary.cityCalls}</p>{/if}
    {#each m.summary.care as line (line)}<p>{line}</p>{/each}
  </section>

  <section>
    <h2>{s.sections.actions}</h2>
    {#if m.actions.length === 0}<p>{s.actions.none}</p>{/if}
    {#each m.actions as action (action.label)}
      <h3>{action.label}</h3>
      {#if action.route}<p>{s.actions.route}: {action.route}</p>{/if}
      {#if action.warning}<p class="warning">{action.warning}</p>{/if}
      {#if action.steps.length}<ol>{#each action.steps as step (step)}<li>{step}</li>{/each}</ol>{/if}
      <p>{s.actions.cost}: {action.cost}</p>
    {/each}
  </section>

  <section>
    <h2>{s.sections.owner}</h2>
    <p>{m.owner.names.join('; ') || s.owner.noNames}</p>
    {#if m.owner.mailing}<p>{s.owner.mailing}: {m.owner.mailing}</p>{/if}
    <p>{s.owner.type}: {m.owner.type}</p>
    {#each m.owner.flags as flag (flag.title + flag.text)}<p><strong>{flag.title}:</strong> {flag.text}</p>{/each}
    <p>{m.owner.tax}</p>
    {#if m.owner.deedFraud}<p class="note">{m.owner.deedFraud}</p>{/if}
  </section>

  <section>
    <h2>{s.print.recent}</h2>
    {#if m.history.transfers.length}
      <table>
        <caption>{s.history.transfersCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{s.history.recorded}</th>
            <th scope="col">{s.history.document}</th>
            <th scope="col">{s.history.price}</th>
            <th scope="col">{s.history.from}</th>
            <th scope="col">{s.history.to}</th>
          </tr>
        </thead>
        <tbody>
          {#each m.history.transfers as row, i (i)}
            <tr><td>{row.date}</td><td>{row.document}</td><td>{row.price}</td><td>{row.from}</td><td>{row.to}</td></tr>
          {/each}
        </tbody>
      </table>
      {#if m.history.moreTransfers}<p class="meta">{s.print.moreOnline(m.history.moreTransfers)}</p>{/if}
    {/if}
    {#if m.history.assessment}<p>{m.history.assessment}</p>{/if}
    {#each m.history.li as line (line)}<p>{line}</p>{/each}
  </section>

  <section>
    <h2>{s.sections.sources}</h2>
    <ul class="sources">{#each m.sources as line (line)}<li>{line}</li>{/each}</ul>
    {#if m.moreSources}<p class="meta">{m.moreSources}</p>{/if}
  </section>

  <footer>
    <p><strong>{m.notLegalAdvice}</strong></p>
  </footer>
</article>

<style>
  .print-sheet {
    font: 9pt/1.25 var(--pk-font);
    color: #000;
  }
  .brand {
    margin: 0;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  h1 {
    margin: 0 0 2px;
    font-size: 14pt;
  }
  h2 {
    margin: 6px 0 2px;
    padding-bottom: 1px;
    border-bottom: 1px solid #999;
    font-size: 10.5pt;
  }
  h3 {
    margin: 4px 0 1px;
    font-size: 10pt;
  }
  p {
    margin: 0 0 2px;
  }
  ul,
  ol {
    margin: 0 0 3px;
    padding-left: 1.3em;
  }
  .meta {
    color: #333;
    font-size: 8.5pt;
  }
  .warning,
  .note {
    font-size: 8pt;
  }
  .warning {
    font-weight: 700;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 8pt;
  }
  caption {
    text-align: left;
    font-weight: 600;
  }
  th,
  td {
    padding: 2px 4px;
    border-bottom: 1px solid #ccc;
    text-align: left;
    vertical-align: top;
  }
  .sources {
    font-size: 8pt;
  }
  footer {
    margin-top: 8px;
    padding-top: 4px;
    border-top: 1px solid #999;
  }
  section {
    break-inside: avoid-page;
  }
</style>
