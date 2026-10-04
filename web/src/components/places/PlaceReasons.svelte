<script lang="ts">
  // The vacancy model's reasons for the selected place: the records that say it is vacant, then
  // the ones that give us pause (src/places/reasons.ts).
  import type { Manifest } from '../../data/manifest.ts';
  import { placeReasons, reasonContext } from '../../places/reasons.ts';
  import { strings } from '../../strings.ts';

  let { properties, manifest }: { properties: Record<string, unknown>; manifest: Manifest | null } = $props();

  const reasons = $derived(placeReasons(properties, reasonContext(manifest)));
</script>

{#if reasons === null}
  <p class="muted small">{strings.reasons.notPublished}</p>
{:else}
  {#if reasons.agree.length}
    <h3>{strings.reasons.title}</h3>
    <ul class="reasons">
      {#each reasons.agree as text (text)}<li>{text}.</li>{/each}
    </ul>
  {/if}
  {#if reasons.doubt.length}
    <h3>{strings.reasons.againstTitle}</h3>
    <ul class="reasons doubt">
      {#each reasons.doubt as text (text)}<li>{text}.</li>{/each}
    </ul>
  {/if}
{/if}

<style>
  .reasons {
    margin: 4px 0 8px;
    padding-left: 1.2em;
    font-size: 0.9rem;
  }
  .reasons li {
    margin: 2px 0;
  }
  .doubt {
    color: var(--pk-muted);
  }
</style>
