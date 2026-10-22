<script lang="ts">
  // Who represents you (M5.1, issue #45): the lot's ward and division, its City Council member, state
  // representative, state senator and member of Congress with their official offices, the Council
  // members at large, and the Registered Community Organizations covering the lot, each with its
  // source and the day it was last checked (src/represent/contacts.ts).
  import type { RepresentView } from '../../represent/contacts.ts';
  import { strings } from '../../strings.ts';
  import RcoCard from '../represent/RcoCard.svelte';
  import SeatCard from '../represent/SeatCard.svelte';

  let { represent }: { represent: RepresentView } = $props();
  const r = strings.represent;
</script>

<p class="small">{r.intro}</p>
{#if represent.ward}
  <p class="ward"><strong>{represent.ward}</strong> <span class="muted small">{r.wardHelp}</span></p>
{/if}

{#if represent.status === 'ready'}
  <ul class="seats">
    {#each represent.rows as row (row.kind)}
      <li><SeatCard {row} /></li>
    {/each}
  </ul>
  {#if represent.councilAtLarge.length}
    <h4>{r.atLargeTitle}</h4>
    <p class="small">
      {r.atLarge}
      {#each represent.councilAtLarge as seat, i (seat.name)}{#if seat.website}<a href={seat.website} target="_blank" rel="noopener noreferrer">{seat.name}</a>{:else}{seat.name}{/if}{i < represent.councilAtLarge.length - 1 ? ', ' : '.'}{/each}
    </p>
    {#if represent.atLargeSource}<p class="muted small">{represent.atLargeSource}</p>{/if}
  {/if}

  <h4>{r.rcoTitle}</h4>
  {#if represent.rcos.length}
    <p class="small">{r.rcoIntro}</p>
    <ul class="rcos">
      {#each represent.rcos as row (row.rco.id)}
        <li><RcoCard {row} /></li>
      {/each}
    </ul>
    <p class="muted small">{r.rcoAsPublished}</p>
  {/if}
  {#if represent.rcoNote}<p class="muted small">{represent.rcoNote}</p>{/if}
  {#if represent.rcosUnknown}<p class="muted small">{r.rcoUnknown(represent.rcosUnknown)}</p>{/if}
  <p class="muted small">{r.officialOnly} {r.officesMove}</p>
{:else}
  <p class="muted small">{represent.status === 'loading' ? r.loading : represent.status === 'unlisted' ? r.unlisted : r.missing}</p>
{/if}
<ul class="links">
  {#each represent.links as link (link.url)}
    <li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
  {/each}
</ul>

<style>
  .ward {
    margin: 4px 0 8px;
  }
  .seats,
  .rcos,
  .links {
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }
  .seats li,
  .rcos li {
    padding: 6px 0;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .links {
    font-size: 0.875rem;
  }
</style>
