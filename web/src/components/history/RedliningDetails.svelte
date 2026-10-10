<script lang="ts">
  // An area of the 1937 redlining map someone tapped (owner, 2026-10-09): its label and grade, a
  // short plain account of what redlining was, a link to its 1937 description at Mapping
  // Inequality (never copied here), the credit and the non commercial note its license asks for.
  import { strings } from '../../strings.ts';

  let { features }: { features: Record<string, unknown>[] } = $props();
  const r = strings.redlining;
  const AREA_PAGE = 'https://dsl.richmond.edu/panorama/redlining/map/PA/Philadelphia/area_descriptions/';
  const areas = $derived(
    features.slice(0, 2).map((p) => ({ label: typeof p.l === 'string' ? p.l : '', grade: typeof p.g === 'string' ? p.g : null })),
  );
</script>

{#each areas as area (area.label)}
  <section class="holc-area" data-holc-grade={area.grade ?? 'none'}>
    <h3>{area.grade ? r.area(area.label, area.grade) : r.areaUngraded(area.label)}</h3>
    {#if area.grade}
      <p class="small">{r.grades[area.grade]}</p>
      <p><a href="{AREA_PAGE}{encodeURIComponent(area.label)}" target="_blank" rel="noopener noreferrer">{r.description(area.label)}</a></p>
    {/if}
  </section>
{/each}
<p class="small">{r.context}</p>
<p class="small">{r.notToday}</p>
<p class="small muted">{r.descriptionNote}</p>
<p class="small muted">
  {r.credit} <a href={r.homepage} target="_blank" rel="noopener noreferrer">{r.homepageLabel}</a>.
  {r.nonCommercial} <a href={r.licenseUrl} target="_blank" rel="noopener noreferrer">{r.licenseLabel}</a>.
</p>
