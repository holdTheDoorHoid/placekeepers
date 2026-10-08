<script lang="ts">
  // A street someone tapped on the traffic stress layer (M3.3): its level from 1 to 4 and what
  // that means for people on bikes, a calmer other direction, the kind of bike lane, the speed of
  // traffic and the lanes, as DVRPC rates them. Streets close together can be tapped at once;
  // the first few are listed.
  import { describeStress } from '../../walk/describe.ts';
  import { STRESS_COLORS } from '../../map/styles/palette.ts';
  import { strings } from '../../strings.ts';

  let { features }: { features: Record<string, unknown>[] } = $props();
  const w = strings.walk;
  /** At most this many streets are listed for one tap. */
  const MAX_STREETS = 3;
  const streets = $derived(features.slice(0, MAX_STREETS).map(describeStress).filter((s) => s !== null));
</script>

{#if features.length > 1}<p class="muted small">{w.streetsHere(features.length)}</p>{/if}
<ul class="streets">
  {#each streets as street, i (i)}
    <li>
      <strong><span class="swatch" style:background={STRESS_COLORS[street.level]} aria-hidden="true"></span>{street.title}</strong>
      <span>{street.meaning}</span>
      {#each street.facts as fact (fact)}<span class="small">{fact}</span>{/each}
    </li>
  {/each}
</ul>
<p class="muted small">{w.stressDetailsSource}</p>

<style>
  .streets {
    margin: 0;
    padding-left: 18px;
  }
  .streets li {
    margin-bottom: 6px;
  }
  .streets span {
    display: block;
  }
  .streets .swatch {
    display: inline-block;
    width: 18px;
    height: 6px;
    margin-right: 6px;
    vertical-align: middle;
    border-radius: 3px;
  }
</style>
