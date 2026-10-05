<script lang="ts">
  // The lot page (docs/DESIGN.md section 5.6), in six sections: Summary, What you can do, Who owns
  // it, History, Nearby, and Sources and freshness. A banner says whether the page is live from the
  // City or from the weekly snapshot, and each part repeats it where it differs.
  import type { Snippet } from 'svelte';
  import type { Manifest } from '../../data/manifest.ts';
  import type { DossierView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';
  import DossierActions from './DossierActions.svelte';
  import DossierHistory from './DossierHistory.svelte';
  import DossierNearby from './DossierNearby.svelte';
  import DossierOwner from './DossierOwner.svelte';
  import DossierSources from './DossierSources.svelte';
  import DossierSummary from './DossierSummary.svelte';

  interface DossierActionsProps {
    onRetry?: () => void;
    onTurnOnLive?: () => void;
    onShowLayer?: (id: string) => void;
    onPrint?: () => void;
    onShowOnMap?: () => void;
    onClear?: () => void;
    onShowOwnerList?: (listId: string) => void;
  }

  let {
    view,
    manifest,
    showTitle = false,
    idPrefix = 'pk-dossier',
    actions = {},
    tools,
  }: {
    view: DossierView;
    manifest: Manifest | null;
    showTitle?: boolean;
    idPrefix?: string;
    actions?: DossierActionsProps;
    /** More buttons beside Print, such as saving the lot to a list. */
    tools?: Snippet;
  } = $props();

  const s = strings.dossier;
  const sections = [
    { key: 'summary', label: s.sections.summary },
    { key: 'actions', label: s.sections.actions },
    { key: 'owner', label: s.sections.owner },
    { key: 'history', label: s.sections.history },
    { key: 'nearby', label: s.sections.nearby },
    { key: 'sources', label: s.sections.sources },
  ] as const;

  // A different lot opening in the same panel starts at its top, not where the last one was read.
  let article: HTMLElement | undefined = $state();
  let shownOpa = '';
  $effect(() => {
    const opa = view.opa;
    if (!article || opa === shownOpa) return;
    if (shownOpa) article.scrollIntoView({ block: 'start' });
    shownOpa = opa;
  });

  function jump(key: string) {
    const heading = document.getElementById(`${idPrefix}-${key}-title`);
    heading?.scrollIntoView({ block: 'start' });
    heading?.focus();
  }
</script>

<article bind:this={article} class="dossier" aria-labelledby={showTitle ? `${idPrefix}-title` : undefined} aria-busy={view.loading || view.banner.tone === 'pending'}>
  {#if showTitle}
    <h2 id="{idPrefix}-title" class="title">{view.title}</h2>
  {/if}
  <p class="banner tone-{view.banner.tone}" role="status">
    {view.banner.text}
    {#if view.banner.retry && actions.onRetry}
      <button class="button small quiet" type="button" onclick={actions.onRetry}>{s.retry}</button>
    {/if}
    {#if view.banner.offerLive && actions.onTurnOnLive}
      <button class="button small quiet" type="button" onclick={actions.onTurnOnLive}>{strings.options.turnOn}</button>
    {/if}
  </p>
  <div class="tools">
    {#if actions.onPrint}<button class="button small" type="button" onclick={actions.onPrint}>{s.printButton}</button>{/if}
    {#if actions.onShowOnMap}<button class="button small quiet" type="button" onclick={actions.onShowOnMap}>{s.showOnMap}</button>{/if}
    {#if actions.onClear}<button class="button small quiet" type="button" onclick={actions.onClear}>{s.clear}</button>{/if}
    {@render tools?.()}
  </div>

  {#if view.loading}
    <p class="muted">{s.loading}</p>
  {:else if view.empty}
    <p class="notice">{view.empty}</p>
  {:else}
    <nav class="contents" aria-label={s.contents}>
      {#each sections as section (section.key)}
        <button class="link" type="button" onclick={() => jump(section.key)}>{section.label}</button>
      {/each}
    </nav>

    <section aria-labelledby="{idPrefix}-summary-title">
      <h3 id="{idPrefix}-summary-title" tabindex="-1">{s.sections.summary}</h3>
      <DossierSummary summary={view.summary} {manifest} opa={view.opa} />
    </section>
    <section aria-labelledby="{idPrefix}-actions-title">
      <h3 id="{idPrefix}-actions-title" tabindex="-1">{s.sections.actions}</h3>
      <DossierActions actions={view.actions} />
    </section>
    <section aria-labelledby="{idPrefix}-owner-title">
      <h3 id="{idPrefix}-owner-title" tabindex="-1">{s.sections.owner}</h3>
      <DossierOwner owner={view.owner} onShowList={actions.onShowOwnerList} />
    </section>
    <section aria-labelledby="{idPrefix}-history-title">
      <h3 id="{idPrefix}-history-title" tabindex="-1">{s.sections.history}</h3>
      <DossierHistory history={view.history} {idPrefix} />
    </section>
    <section aria-labelledby="{idPrefix}-nearby-title">
      <h3 id="{idPrefix}-nearby-title" tabindex="-1">{s.sections.nearby}</h3>
      <DossierNearby nearby={view.nearby} onShowLayer={actions.onShowLayer} />
    </section>
    <section aria-labelledby="{idPrefix}-sources-title">
      <h3 id="{idPrefix}-sources-title" tabindex="-1">{s.sections.sources}</h3>
      <DossierSources sources={view.sources} />
    </section>
  {/if}
</article>

<style>
  .dossier {
    font-size: 0.95rem;
  }
  .title {
    margin-bottom: 6px;
    font-size: 1.2rem;
  }
  .banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    margin: 0 0 8px;
    padding: 6px 10px;
    border-radius: var(--pk-radius);
    background: var(--pk-surface);
    font-size: 0.875rem;
  }
  .banner.tone-live {
    background: var(--pk-ok-bg);
    color: var(--pk-ok-ink);
  }
  .banner.tone-warning {
    background: var(--pk-stale-bg);
    color: var(--pk-stale-ink);
  }
  .banner.tone-pending {
    background: var(--pk-accent-soft);
    color: var(--pk-text);
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .contents {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    margin: 0 0 8px;
    font-size: 0.875rem;
  }
  .link {
    padding: 4px 0;
    border: 0;
    background: none;
    color: var(--pk-accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  section {
    padding: 10px 0 6px;
    border-top: 1px solid var(--pk-surface-2);
  }
  section h3 {
    font-size: 1.05rem;
  }
  section h3:focus {
    outline: none;
  }
  section h3:focus-visible {
    outline: 3px solid var(--pk-focus);
  }
</style>
