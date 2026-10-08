<script lang="ts">
  // A lot the City's land agencies list as available (issue #36), at the top of "What you can do":
  // the date of the list, the side yard route first where the lot may go to the neighbor next
  // door, the Land Bank's note that it may turn a request down (in our words), a link to the Land
  // Bank's own map, and the credit. No price and no buy button (docs/ETHICS.md).
  import type { ListingView } from '../../dossier/build.ts';
  import DisplacementNote from '../places/DisplacementNote.svelte';
  import RouteDetails from './RouteDetails.svelte';

  let { listing }: { listing: ListingView } = $props();
</script>

<aside class="listing" aria-labelledby="pk-listing-title">
  <h4 id="pk-listing-title">{listing.title}</h4>
  <p>{listing.text}</p>
  <!--
    The displacement caution (docs/ETHICS.md, "Displacement"; M4.1): the full card with the area's
    signs and the ways to protect neighbors inside a displacement watch area, the one line caution
    elsewhere.
  -->
  <DisplacementNote always watch={listing.displacement.watch} />
  {#if listing.sideYard}
    <p>{listing.sideYardLead}</p>
    <RouteDetails view={listing.sideYard} level={5} />
  {/if}
  <p>{listing.decline} {listing.changes}</p>
  <ul class="links">
    {#each listing.links as link (link.url)}<li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>{/each}
  </ul>
  <p class="credit">{listing.credit}</p>
</aside>

<style>
  .listing {
    margin: 8px 0 12px;
    padding: 8px 10px;
    border-radius: var(--pk-radius);
    background: var(--pk-accent-soft);
    color: var(--pk-text);
    font-size: 0.9rem;
  }
  .listing h4 {
    margin: 0 0 4px;
  }
  .listing p {
    margin: 0 0 6px;
  }
  .links {
    margin: 4px 0 6px;
    padding-left: 1.2em;
  }
  .credit {
    font-size: 0.8rem;
  }
</style>
