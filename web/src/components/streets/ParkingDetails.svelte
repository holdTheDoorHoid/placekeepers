<script lang="ts">
  // An area of the parking reports layer someone tapped (issue #37): how many reports of vehicles
  // blocking the way Laser Vision received there in the 12 months, by kind (a kind with fewer than
  // 5 says so instead of a number), the window, what the counts can and cannot say, the physical
  // fixes they are evidence for, the City office to ask, and the credit with a link to Philly Bike
  // Action's map. Never a single report, a vehicle, a time of day or who reported; never a word
  // about tickets, the Parking Authority or enforcement (docs/ETHICS.md, "Policing").
  import type { Manifest } from '../../data/manifest.ts';
  import type { Route } from '../../registry/types.ts';
  import { MIN_REPORTS, describeParking } from '../../streets/parking.ts';
  import { strings } from '../../strings.ts';

  let {
    properties,
    manifest,
    route,
    homepage,
  }: { properties: Record<string, unknown>; manifest: Manifest | null; route?: Route; homepage?: string } = $props();

  const view = $derived(describeParking(properties, manifest));
  const t = strings.parking;
</script>

<section class="parking">
  <h3>{t.title}</h3>
  <p>{t.summary(view.total, view.window)}</p>
  <h4>{t.byKind}</h4>
  <ul class="kinds">
    {#each view.kinds as kind (kind.kind)}
      <li>
        <span>{kind.label}</span>
        <strong>{kind.count === null ? t.fewerThan(MIN_REPORTS) : t.count(kind.count)}</strong>
      </li>
    {/each}
  </ul>
  <p class="muted small">{t.meaning}</p>
  <p class="small">{t.fixes}</p>
  {#if route}
    <p class="small"><strong>{t.askCity}:</strong> {route.steps[0]}</p>
  {/if}
  {#if homepage}
    <p class="small"><a href={homepage} target="_blank" rel="noopener noreferrer">{t.source}</a></p>
  {/if}
  <p class="muted small">{t.refreshed}</p>
</section>

<style>
  .parking {
    padding-bottom: 6px;
  }
  h3 {
    margin-bottom: 2px;
  }
  h4 {
    margin: 8px 0 2px;
    font-size: 0.9rem;
  }
  p {
    margin: 4px 0;
  }
  .kinds {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .kinds li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 0;
    border-bottom: 1px solid var(--pk-surface-2);
  }
</style>
