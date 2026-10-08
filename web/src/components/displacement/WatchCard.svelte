<script lang="ts">
  // The full displacement card (docs/ETHICS.md, "Displacement"; M4.1): the caution word for word,
  // the area's signs, and a link to each way to protect neighbors (the Neighborhood Gardens Trust,
  // community land trusts, the City's Homestead Exemption and LOOP, and help with a tangled title),
  // each to its official page with the day it was last checked.
  //
  // A lot page, its print and a list of nearby places show it once (decided by the owner on
  // 2026-10-08, decision D5 of docs/VERIFICATION_V0_3.md), with an `id` and a heading, and each
  // card there with a caution points to it (src/components/places/DisplacementNote.svelte, `jumpTo`).
  // A card shown on its own, such as a tapped bus stop's, carries it whole.
  import type { ProtectionLink } from '../../displacement/watch.ts';
  import { formatDate, strings } from '../../strings.ts';

  let {
    cautions,
    text,
    links,
    signs = null,
    id = null,
    heading = null,
    level = 4,
  }: {
    /** The caution sentences, each word for word: one per kind of card the page or list holds. */
    cautions: string[];
    /** The area's signs in a sentence, or, over a list of places, what the list's cards say. */
    text: string;
    links: ProtectionLink[];
    signs?: number | null;
    /** Set when the card is shown once for a page or a list, so the cards there can jump to it. */
    id?: string | null;
    heading?: string | null;
    level?: 3 | 4;
  } = $props();
  // The site root from the build (not config, so the lot page also renders outside a browser).
  const responsiblyUrl = `${import.meta.env.BASE_URL}responsibly/`;
  const d = strings.displacement;
</script>

<div
  class="displacement watch"
  data-watch={signs ?? undefined}
  data-watch-card={id ? '' : undefined}
  {id}
  tabindex="-1"
  role={id && heading ? 'region' : undefined}
  aria-labelledby={id && heading ? `${id}-title` : undefined}
>
  {#if heading}
    <svelte:element this={`h${level}`} id={id ? `${id}-title` : undefined} class="heading">{heading}</svelte:element>
  {/if}
  {#each cautions as caution (caution)}
    <p><strong>{caution}</strong></p>
  {/each}
  <p>{text}</p>
  {#if links.length}
    <p class="title">{d.protectionsTitle}:</p>
    <ul>
      {#each links as link (link.id)}
        <li>
          <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
          <span class="checked">({d.checked(formatDate(link.checked) ?? link.checked)})</span>
        </li>
      {/each}
    </ul>
  {/if}
  <p><a href={responsiblyUrl}>{d.protections}</a></p>
</div>

<style>
  .displacement {
    position: relative;
    z-index: 1;
    margin: 4px 0;
    padding: 4px 8px;
    border-left: 3px solid var(--pk-note-ink);
    background: var(--pk-note-bg);
    color: var(--pk-note-ink);
    font-size: 0.875rem;
  }
  .displacement:focus-visible {
    outline: 3px solid var(--pk-focus);
    outline-offset: 2px;
  }
  .heading {
    margin: 2px 0 4px;
    font-size: 0.95rem;
  }
  p {
    margin: 2px 0;
  }
  .title {
    font-weight: 600;
  }
  ul {
    margin: 0 0 2px;
    padding-left: 1.2em;
  }
  .checked {
    font-size: 0.8rem;
  }
  a {
    color: inherit;
    /* Links far enough apart for a fingertip (WCAG 2.2 target size). */
    display: inline-block;
    padding: 3px 0;
  }
</style>
