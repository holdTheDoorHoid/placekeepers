<script lang="ts">
  // Projects neighbors finished that someone tapped (M5.3, issue #47): what was done, when it was
  // finished, the group's name if it chose to show one, what it took, and a link to the report and
  // its photos on GitHub. The map loads nothing from GitHub: the link is a plain link. Projects
  // close together can be tapped at once; the first few are listed.
  import { describeProject, projectFromFeature } from '../../projects/projects.ts';
  import { strings } from '../../strings.ts';

  let {
    features,
    lngLat,
    onOpenLot,
  }: {
    features: Record<string, unknown>[];
    lngLat: [number, number];
    onOpenLot?: (opa: string) => void;
  } = $props();
  const p = strings.projects;
  /** At most this many projects are listed for one tap. */
  const MAX_PROJECTS = 4;
  const shown = $derived(
    features
      .slice(0, MAX_PROJECTS)
      .map((f) => projectFromFeature(f, lngLat))
      .filter((x) => x !== null)
      .map(describeProject),
  );
</script>

{#if features.length > 1}<p class="muted small">{p.here(features.length)}</p>{/if}
{#each shown as project (project.id)}
  <section class="project" data-testid="project-details">
    <h3>{project.kind}</h3>
    <p>{project.when}</p>
    {#if project.by}<p>{project.by}</p>{/if}
    {#if project.where}<p class="muted small">{project.where}</p>{/if}
    {#if project.note}
      <h4>{p.whatItTook}</h4>
      <p class="note">{project.note}</p>
    {/if}
    {#if project.link}
      <p class="small"><a href={project.link.url} target="_blank" rel="noopener noreferrer">{project.link.label}</a></p>
    {/if}
    {#if project.parcel && onOpenLot}
      {@const opa = project.parcel}
      <button class="button small quiet" type="button" onclick={() => onOpenLot?.(opa)}>{p.openLot}</button>
    {/if}
  </section>
{/each}
<p class="muted small">{p.privacy}</p>

<style>
  .project {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  .project p {
    margin: 2px 0;
  }
  h3 {
    margin-bottom: 2px;
  }
  h4 {
    margin: 6px 0 2px;
    font-size: 0.9rem;
  }
  .note {
    white-space: pre-line;
  }
</style>
