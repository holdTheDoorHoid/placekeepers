<script lang="ts">
  // Projects here (M5.3, issue #47): the projects neighbors finished on this lot that the owner
  // approved, newest first, each with what was done, when, the group if it chose to show one, what
  // it took, and a link to the report and its photos on GitHub; then the form to report one,
  // prefilled with the lot. Nothing is fetched from GitHub; the links are plain links.
  import type { DossierView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';

  let { projects, onShowLayer }: { projects: DossierView['projects']; onShowLayer?: (id: string) => void } = $props();
  const p = strings.projects;
</script>

<div class="projects" data-testid="lot-projects">
  {#if projects.status === 'loading'}
    <p class="muted small">{p.loading}</p>
  {:else if projects.status === 'unpublished'}
    <p class="muted small">{p.unpublished}</p>
  {:else if projects.status === 'failed'}
    <p class="muted small">{p.failed}</p>
  {:else if projects.items.length === 0}
    <p class="muted small">{p.none}</p>
  {:else}
    <ul class="items">
      {#each projects.items as project (project.id)}
        <li>
          <strong>{project.kind}</strong>
          <p class="small">{project.when}{#if project.by}<br />{project.by}{/if}</p>
          {#if project.note}
            <p class="small"><span class="muted">{p.whatItTook}:</span> {project.note}</p>
          {/if}
          {#if project.link}
            <p class="small"><a href={project.link.url} target="_blank" rel="noopener noreferrer">{project.link.label}</a></p>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="muted small">{p.oneLot} {p.privacy}</p>
    {#if onShowLayer}
      <button class="button quiet small" type="button" onclick={() => onShowLayer('projects')}>{strings.dossier.nearby.showLayer(strings.projects.timelineToggle)}</button>
    {/if}
  {/if}
  <p class="tell">
    <a class="button small" href={projects.reportUrl} target="_blank" rel="noopener noreferrer">{p.tellUsHere}</a>
  </p>
  <p class="muted small">{p.tellUsNote}</p>
</div>

<style>
  .items {
    margin: 0 0 6px;
    padding-left: 1.2em;
  }
  .items li {
    margin-bottom: 6px;
  }
  .items p {
    margin: 2px 0;
  }
  .tell {
    margin: 8px 0 2px;
  }
</style>
