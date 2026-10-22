<script lang="ts">
  // One elected seat: the office and district, the member, each official office with its phone, the
  // website, and where it comes from (src/represent/contacts.ts). Used on the lot page and in
  // packets; phones are links on screen and plain text on paper.
  import type { SeatRow } from '../../represent/contacts.ts';
  import { strings } from '../../strings.ts';

  let { row, compact = false }: { row: SeatRow; compact?: boolean } = $props();
  const r = strings.represent;

  function tel(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }
</script>

<div class="seat" class:compact>
  <p class="office">{row.office}{#if row.district}, {row.district}{/if}</p>
  {#if row.seat}
    <p class="name"><strong>{row.seat.name}</strong>{#if row.seat.role}, {row.seat.role}{/if}</p>
    {#each row.seat.offices as office, i (i)}
      <p class="small">
        {#if office.address}{office.address}{/if}{#if office.address && office.phone}. {/if}{#if office.phone}{r.phone}: <a href={tel(office.phone)}>{office.phone}</a>{/if}
      </p>
    {/each}
    {#if row.seat.website}
      <p class="small"><a href={row.seat.website} target="_blank" rel="noopener noreferrer">{r.website}</a> <span class="print-url">{row.seat.website}</span></p>
    {/if}
    {#if row.source}<p class="muted source">{row.source}</p>{/if}
  {:else}
    <p class="muted small">{row.note}</p>
  {/if}
</div>

<style>
  p {
    margin: 0 0 2px;
  }
  .office {
    font-size: 0.85rem;
    color: var(--pk-muted, #555);
  }
  .source {
    font-size: 0.78rem;
  }
  .print-url {
    display: none;
  }
  @media print {
    .print-url {
      display: inline;
      font-size: 8pt;
    }
    a {
      color: #000;
      text-decoration: none;
    }
  }
</style>
