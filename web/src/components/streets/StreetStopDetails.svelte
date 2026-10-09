<script lang="ts">
  // A City bus shelter, street pole, traffic calming device or school crossing guard post someone
  // tapped (M4.5): what it is and where, from the City's lists, in plain sentences
  // (src/streets/streets-stops.ts). Things close together can be tapped at once; the first few
  // are listed.
  import { describeCalming, describeGuard, describePole, describeShelter, type SmallView } from '../../streets/streets-stops.ts';
  import { strings } from '../../strings.ts';

  type Kind = 'shelter' | 'pole' | 'calming' | 'guard';
  let { kind, features }: { kind: Kind; features: Record<string, unknown>[] } = $props();
  const t = strings.streetsStops;
  /** At most this many are listed for one tap. */
  const MAX_SHOWN = 4;
  const describe: Record<Kind, (p: Record<string, unknown>) => SmallView> = {
    shelter: describeShelter,
    pole: describePole,
    calming: describeCalming,
    guard: describeGuard,
  };
  const here: Record<Kind, (n: number) => string> = {
    shelter: t.sheltersHere,
    pole: t.polesHere,
    calming: t.calmingHere,
    guard: t.guardsHere,
  };
  const views = $derived(features.slice(0, MAX_SHOWN).map((p) => describe[kind](p)));
</script>

{#if features.length > 1}<p class="muted small">{here[kind](features.length)}</p>{/if}
{#each views as view, i (i)}
  <section class="item">
    <h3>{view.title}</h3>
    {#each view.lines as line (line)}<p>{line}</p>{/each}
  </section>
{/each}
{#if views.length}<p class="muted small">{views[0]!.source}</p>{/if}

<style>
  .item {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  h3 {
    margin-bottom: 2px;
  }
  p {
    margin: 2px 0;
  }
</style>
