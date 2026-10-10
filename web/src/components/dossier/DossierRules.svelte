<script lang="ts">
  // Rules for this lot (M4.6, issue #42; src/dossier/rules.ts): historic designation, zoning and
  // its overlays, federal brownfield records, and appeals and hearings, leading with the lawful
  // step (ask the Historical Commission first; check with the zoning office). It never says
  // whether a lot can or cannot be built on, and never calls a place clean or safe. Who filed an
  // appeal and the owner the City names appear here and nowhere else on the site
  // (docs/ETHICS.md, "Appeals and hearings"); the appeal's grounds are a link to the City.
  import type { DossierView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';
  import ProvenanceLine from './ProvenanceLine.svelte';
  import SoilNote from '../rules/SoilNote.svelte';

  let {
    rules,
    idPrefix,
    onTurnOnLive,
    onRetry,
  }: { rules: DossierView['rules']; idPrefix: string; onTurnOnLive?: () => void; onRetry?: () => void } = $props();
  const r = strings.dossier.rules;
</script>

<div class="rules">
  <p class="small">{rules.intro}</p>
  {#if rules.provenance.text}<ProvenanceLine provenance={rules.provenance} />{/if}
  {#if rules.notOnList}
    <p class="notice">{rules.notOnList}</p>
    <ul class="links">
      {#each rules.links as link (link.url)}
        <li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
      {/each}
    </ul>
  {/if}
  {#each rules.missing as text (text)}<p class="notice">{text}</p>{/each}

  {#if rules.historic}
    <section class="part historic" aria-labelledby="{idPrefix}-historic-title">
      <h4 id="{idPrefix}-historic-title">{r.historicTitle}</h4>
      {#each rules.historic.lines as line (line)}<p>{line}</p>{/each}
      <p class="ask"><strong>{rules.historic.askFirst}</strong></p>
      <p>{rules.historic.contact}</p>
      <p class="muted small">{rules.historic.confirm}</p>
      <ul class="links">
        {#each rules.historic.links as link (link.url)}
          <li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if rules.zoning}
    <section class="part zoning" aria-labelledby="{idPrefix}-zoning-title">
      <h4 id="{idPrefix}-zoning-title">{r.zoningTitle}</h4>
      {#if rules.zoning.base}
        <p>
          {rules.zoning.base}
          {#if rules.zoning.basePending}{r.basePending} <a href={rules.zoning.basePending.url} target="_blank" rel="noopener noreferrer">{rules.zoning.basePending.label}</a>{/if}
        </p>
      {/if}
      {#if rules.zoning.overlaysIntro}<p>{rules.zoning.overlaysIntro}</p>{/if}
      {#if rules.zoning.overlays.length}
        <ul class="overlays">
          {#each rules.zoning.overlays as overlay (overlay.name)}
            <li>
              <strong>{overlay.name}</strong> <span class="muted small">({overlay.kind})</span>
              <span class="meaning">{overlay.meaning}</span>
              {#if overlay.sunset}<span class="small">{overlay.sunset}</span>{/if}
              {#if overlay.pending}
                <span class="small">
                  {overlay.pending.text}
                  {#if overlay.pending.link}<a href={overlay.pending.link.url} target="_blank" rel="noopener noreferrer">{overlay.pending.link.label}</a>{/if}
                </span>
              {/if}
              {#if overlay.link}<a class="small" href={overlay.link.url} target="_blank" rel="noopener noreferrer">{overlay.link.label}</a>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <p class="muted small">{rules.zoning.note}</p>
      <ul class="links">
        {#each rules.zoning.links as link (link.url)}
          <li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if rules.brownfield}
    <section class="part brownfield" aria-labelledby="{idPrefix}-brownfield-title">
      <h4 id="{idPrefix}-brownfield-title">{r.brownfieldTitle}</h4>
      <SoilNote />
      <ul class="sites">
        {#each rules.brownfield.sites as site (site.link.url)}
          <li>{site.text}. <a href={site.link.url} target="_blank" rel="noopener noreferrer">{site.link.label}</a></li>
        {/each}
        {#if rules.brownfield.more}<li class="muted">{rules.brownfield.more}</li>{/if}
      </ul>
      <p class="muted small">{rules.brownfield.note}</p>
    </section>
  {/if}

  <section class="part appeals" aria-labelledby="{idPrefix}-appeals-title">
    <h4 id="{idPrefix}-appeals-title">{r.appealsTitle}</h4>
    <ProvenanceLine provenance={rules.appealsProvenance} />
    {#if rules.appeals.missing}
      <p class="notice">
        {rules.appeals.missing.text}
        {#if rules.appeals.missing.offerLive && onTurnOnLive}
          {r.appealsMissingOff}
          <button class="button small quiet" type="button" onclick={onTurnOnLive}>{strings.options.turnOn}</button>
        {:else if rules.appeals.missing.retry && onRetry}
          <button class="button small quiet" type="button" onclick={onRetry}>{strings.dossier.retry}</button>
        {/if}
      </p>
    {/if}
    {#if rules.appeals.empty}<p class="muted small">{rules.appeals.empty}</p>{/if}
    {#if rules.appeals.items.length}
      <p class="small">{r.appealsIntro}</p>
      <ul class="appeal-list">
        {#each rules.appeals.items as appeal, i (i)}
          <li class="appeal" class:upcoming={appeal.upcoming}>
            <p class="what">
              {#if appeal.upcoming}<span class="badge">{r.comingUp}</span>{/if}
              <strong>{appeal.board}</strong>{#if appeal.kind}: {appeal.kind}{/if}
            </p>
            <p class="small">{appeal.dates.join('. ')}.</p>
            {#if appeal.decision || appeal.status}<p class="small">{[appeal.decision, appeal.status].filter(Boolean).join('. ')}.</p>{/if}
            {#if appeal.rco}<p class="small">{appeal.rco}</p>{/if}
            {#if appeal.filedBy || appeal.ownerNamed}
              <dl class="names small">
                {#if appeal.filedBy}<dt>{r.filedBy}</dt><dd>{appeal.filedBy}</dd>{/if}
                {#if appeal.ownerNamed}<dt>{r.ownerNamed}</dt><dd>{appeal.ownerNamed}</dd>{/if}
              </dl>
            {/if}
            {#if appeal.upcoming}
              <p class="small"><a href={appeal.takePart.url} target="_blank" rel="noopener noreferrer">{appeal.takePart.label}</a></p>
            {/if}
          </li>
        {/each}
      </ul>
      {#if rules.appeals.grounds}
        <p class="small"><a href={rules.appeals.grounds.url} target="_blank" rel="noopener noreferrer">{rules.appeals.grounds.label}</a></p>
      {/if}
      {#if rules.appeals.namesNote}<p class="muted small">{rules.appeals.namesNote}</p>{/if}
    {/if}
  </section>
</div>

<style>
  .part {
    margin: 8px 0 10px;
  }
  .part p {
    margin: 0 0 4px;
  }
  .ask {
    padding: 6px 10px;
    border-left: 3px solid var(--pk-accent);
    border-radius: var(--pk-radius);
    background: var(--pk-accent-soft);
  }
  .links,
  .sites {
    margin: 2px 0 6px;
    padding-left: 1.2em;
    font-size: 0.875rem;
  }
  .overlays {
    margin: 2px 0 6px;
    padding-left: 1.2em;
  }
  .overlays li {
    margin-bottom: 6px;
  }
  .overlays .meaning,
  .overlays .small,
  .overlays a {
    display: block;
  }
  .appeal-list {
    margin: 4px 0;
    padding: 0;
    list-style: none;
  }
  .appeal {
    margin-bottom: 8px;
    padding: 6px 10px;
    border-left: 3px solid var(--pk-surface-2);
  }
  .appeal.upcoming {
    border-left-color: var(--pk-accent);
    background: var(--pk-accent-soft);
  }
  .appeal p {
    margin: 0 0 2px;
  }
  .badge {
    display: inline-block;
    margin-right: 6px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--pk-accent);
    color: var(--pk-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
  }
  .names {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0 8px;
    margin: 2px 0;
  }
  .names dt {
    color: var(--pk-muted);
  }
  .names dd {
    margin: 0;
  }
</style>
