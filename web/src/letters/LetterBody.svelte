<script lang="ts">
  // The words of one letter, as it prints: date, recipient, subject, salutation, paragraphs,
  // closing and signature (src/letters/templates.ts). The letters page shows it twice on a page in
  // another language: the letter to print, and a translation for the sender.
  import type { Letter } from './templates.ts';

  let { letter }: { letter: Letter } = $props();
</script>

{#if letter.date}<p class="date">{letter.date}</p>{/if}
{#if letter.to.length}<p class="to">{#each letter.to as line, i (i)}{line}<br />{/each}</p>{/if}
{#if letter.subject}<p><strong>{letter.subject}</strong></p>{/if}
<p>{letter.salutation}</p>
{#each letter.paragraphs as paragraph, i (i)}<p>{paragraph}</p>{/each}
<p class="closing">{letter.closing}</p>
<p class="signature">{#each letter.signature as line, i (i)}{line}<br />{/each}</p>
