<script lang="ts">
  // One lawful route: its warning first (the conservatorship route always carries the abuse
  // warning of docs/ETHICS.md), then who can do it, the steps, cost, timeline, links and the date
  // the route was last checked.
  import type { RouteView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';

  let { view, level = 5 }: { view: RouteView; level?: 4 | 5 } = $props();
  const a = strings.dossier.actions;
</script>

<div class="route">
  <svelte:element this={`h${level}`} class="route-title">{a.route}: {view.route.label}</svelte:element>
  {#if view.warning}<p class="warning" role="note">{view.warning}</p>{/if}
  <dl>
    <dt>{a.who}</dt>
    <dd>{view.route.who}</dd>
  </dl>
  <p class="steps-title">{a.steps}</p>
  <ol class="steps">
    {#each view.route.steps as step (step)}<li>{step}</li>{/each}
  </ol>
  <dl>
    <dt>{a.cost}</dt>
    <dd>{view.route.cost}</dd>
    <dt>{a.timeline}</dt>
    <dd>{view.route.timeline}</dd>
  </dl>
  {#if view.route.links.length}
    <ul class="links">
      {#each view.route.links as link (link.url)}<li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>{/each}
    </ul>
  {/if}
  <p class="checked">{a.lastChecked(view.lastChecked)}{#if view.confirm}{' '}{a.toConfirm}{/if}</p>
</div>

<style>
  .route {
    margin: 6px 0 10px;
    padding: 8px 10px;
    border-left: 3px solid var(--pk-accent);
    background: var(--pk-surface);
    border-radius: 0 var(--pk-radius) var(--pk-radius) 0;
  }
  .route-title {
    margin: 0 0 4px;
    font-size: 0.9rem;
  }
  .warning {
    margin: 4px 0 8px;
    padding: 6px 8px;
    border-radius: var(--pk-radius);
    background: var(--pk-note-bg);
    color: var(--pk-note-ink);
    font-weight: 600;
    font-size: 0.9rem;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 4px 0;
    font-size: 0.875rem;
  }
  dt {
    color: var(--pk-muted);
  }
  dd {
    margin: 0;
  }
  .steps-title {
    margin: 6px 0 2px;
    font-size: 0.875rem;
    color: var(--pk-muted);
  }
  .steps {
    margin: 0 0 4px;
    padding-left: 1.3em;
    font-size: 0.9rem;
  }
  .links {
    margin: 4px 0;
    padding-left: 1.2em;
    font-size: 0.875rem;
  }
  .checked {
    margin: 4px 0 0;
    font-size: 0.8rem;
    color: var(--pk-muted);
  }
</style>
