<script lang="ts">
  // The "why" behind a score: each factor's value from 0 to 100, its weight, and how many points
  // it adds. The points add up to the score.
  import { displayedBreakdown, type ScoreExplanation } from '../../map/lens.ts';
  import { strings } from '../../strings.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';

  let {
    why,
    idPrefix,
    level = 3,
    appliesTo = 'parcel',
  }: {
    why: ScoreExplanation;
    idPrefix: string;
    level?: 3 | 4;
    /** What the lens ranks, for the note when every factor is off. */
    appliesTo?: string;
  } = $props();
  const max = $derived(Math.max(1, ...why.factors.map((f) => f.contribution)));
  // Shown to a tenth of a point, rounded so the column adds up to the score exactly.
  const shown = $derived(displayedBreakdown(why));
</script>

<section class="why" aria-labelledby="{idPrefix}-why">
  <svelte:element this={`h${level}`} id="{idPrefix}-why">{strings.why.title}</svelte:element>
  {#if why.allOff}
    <p class="notice">{strings.lens.allOffFor(appliesTo)}</p>
  {:else}
    <p class="muted small">{strings.why.intro}</p>
    <table>
      <caption class="sr-only">{strings.why.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{strings.why.factor}</th>
          <th scope="col">{strings.why.value}</th>
          <th scope="col">{strings.why.weight}</th>
          <th scope="col">{strings.why.adds}</th>
        </tr>
      </thead>
      <tbody>
        {#each why.factors as f, i (f.id)}
          <tr class:off={f.weight === 0}>
            <th scope="row">
              <span class="label">{f.label}</span>
              <EvidenceBadge level={f.evidence} />
            </th>
            <td>{f.value === null ? strings.why.noData : f.value}</td>
            <td>{f.weight === 0 ? strings.why.off : f.weight}</td>
            <td>
              <span class="adds">{shown.contributions[i]!.toFixed(1)}</span>
              <span class="bar" style:width="{(f.contribution / max) * 100}%" aria-hidden="true"></span>
            </td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{strings.why.total}</th>
          <td colspan="3"><strong>{shown.score === null ? strings.why.noData : shown.score.toFixed(1)}</strong></td>
        </tr>
      </tfoot>
    </table>
    {#if why.missing.length}<p class="muted small">{strings.why.missingNote}</p>{/if}
  {/if}
</section>

<style>
  .why {
    margin-top: 12px;
  }
  table {
    font-size: 0.875rem;
  }
  th[scope='row'] {
    color: var(--pk-text);
    font-size: 0.875rem;
    font-weight: 400;
  }
  .label {
    display: block;
    margin-bottom: 2px;
  }
  .off td,
  .off .label {
    color: var(--pk-muted);
  }
  .bar {
    display: block;
    height: 6px;
    margin-top: 3px;
    border-radius: 3px;
    background: #31a354;
  }
  tfoot th,
  tfoot td {
    border-bottom: 0;
    font-size: 0.95rem;
  }
</style>
