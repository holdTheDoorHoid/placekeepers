<script lang="ts">
  // The caution every greening suggestion carries (docs/ETHICS.md, "Displacement", word for word;
  // docs/VERIFICATION.md, decision D12). Outside a displacement watch area it is one line with a
  // link to the ways to protect neighbors on the "Use this responsibly" page. Inside one (M4.1),
  // the card adds the area's signs and links to each protection: the Neighborhood Gardens Trust,
  // community land trusts, the City's Homestead Exemption and LOOP, and help with a tangled title,
  // each to its official page and with the day it was last checked.
  import { isGreening } from '../../config/suggestions.ts';
  import type { WatchNote } from '../../displacement/watch.ts';
  import { formatDate, strings } from '../../strings.ts';

  // `always` shows the caution whatever the suggestion: the box of a lot listed as available by
  // the City's land agencies (src/components/dossier/ListingBox.svelte) carries it too.
  let {
    suggestionId = '',
    watch = null,
    always = false,
  }: { suggestionId?: string; watch?: WatchNote | null; always?: boolean } = $props();
  // The site root from the build (not config, so the lot page also renders outside a browser).
  const responsiblyUrl = `${import.meta.env.BASE_URL}responsibly/`;
  const d = strings.displacement;
</script>

{#if always || isGreening(suggestionId)}
  {#if watch}
    <div class="displacement watch" data-watch={watch.signs}>
      <p><strong>{d.caution}</strong></p>
      <p>{watch.text}</p>
      {#if watch.links.length}
        <p class="title">{d.protectionsTitle}:</p>
        <ul>
          {#each watch.links as link (link.id)}
            <li>
              <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
              <span class="checked">({d.checked(formatDate(link.checked) ?? link.checked)})</span>
            </li>
          {/each}
        </ul>
      {/if}
      <p><a href={responsiblyUrl}>{d.protections}</a></p>
    </div>
  {:else}
    <p class="displacement">
      {d.caution}
      <a href={responsiblyUrl}>{d.protections}</a>
    </p>
  {/if}
{/if}

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
  .watch p {
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
  .displacement a {
    color: inherit;
  }
  /* Links far enough apart for a fingertip (WCAG 2.2 target size). */
  .watch a {
    display: inline-block;
    padding: 3px 0;
  }
</style>
