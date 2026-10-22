<script lang="ts">
  // One Registered Community Organization with what the City publishes for reaching it: its
  // address, where it meets, how it prefers to be contacted, its primary contact and its website,
  // with the source and the day it was last checked (src/represent/contacts.ts).
  import type { RcoRow } from '../../represent/contacts.ts';
  import { strings } from '../../strings.ts';

  let { row, extra }: { row: RcoRow; extra?: string | null } = $props();
  const r = strings.represent;
  const rco = $derived(row.rco);

  function tel(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }
</script>

<div class="rco">
  <p><strong>{rco.name}</strong></p>
  {#if extra}<p class="small">{extra}</p>{/if}
  {#if rco.address}<p class="small">{r.rcoAddress}: {rco.address}</p>{/if}
  {#if rco.meeting}<p class="small">{r.rcoMeeting}: {rco.meeting}</p>{/if}
  {#if rco.contact}
    <p class="small">
      {r.rcoContact}:
      {#if rco.contact.name}{rco.contact.name}{/if}{#if rco.contact.phone}{rco.contact.name ? ', ' : ''}<a href={tel(rco.contact.phone)}>{rco.contact.phone}</a>{/if}{#if rco.contact.email}{rco.contact.name || rco.contact.phone ? ', ' : ''}<a href="mailto:{rco.contact.email}">{rco.contact.email}</a>{/if}
    </p>
  {/if}
  {#if rco.preferred}<p class="small">{r.rcoPreferred}: {rco.preferred}</p>{/if}
  {#if rco.website}<p class="small"><a href={rco.website} target="_blank" rel="noopener noreferrer">{rco.website}</a></p>{/if}
  <p class="muted source">{row.source}</p>
</div>

<style>
  p {
    margin: 0 0 2px;
    overflow-wrap: anywhere;
  }
  .source {
    font-size: 0.78rem;
  }
  @media print {
    a {
      color: #000;
      text-decoration: none;
    }
  }
</style>
