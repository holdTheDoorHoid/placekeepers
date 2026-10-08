<script lang="ts">
  // The caution every greening suggestion carries (docs/ETHICS.md, "Displacement", word for word;
  // docs/VERIFICATION.md, decision D12), or its placemaking version for a place to sit, a garden
  // or art (M3.4). Outside a displacement watch area it is one line with a link to the ways to
  // protect neighbors on the "Use this responsibly" page. Inside one (M4.1), the full card adds
  // the area's signs and links to each protection (src/components/displacement/WatchCard.svelte).
  //
  // A lot page and a list of nearby places show that full card once (decided by the owner on
  // 2026-10-08): there, `jumpTo` names it, and this card keeps the one line caution with a button
  // that moves to it. In a list of places, whose cards may lie in different areas, `withSigns`
  // keeps the card's own area's signs beside the caution.
  import { displacementCaution } from '../../config/suggestions.ts';
  import type { WatchNote } from '../../displacement/watch.ts';
  import { strings } from '../../strings.ts';
  import WatchCard from '../displacement/WatchCard.svelte';

  // `always` shows the greening caution whatever the suggestion: the box of a lot listed as
  // available by the City's land agencies (src/components/dossier/ListingBox.svelte) carries it too.
  let {
    suggestionId = '',
    watch = null,
    always = false,
    jumpTo = null,
    withSigns = false,
  }: { suggestionId?: string; watch?: WatchNote | null; always?: boolean; jumpTo?: string | null; withSigns?: boolean } = $props();
  // The site root from the build (not config, so the lot page also renders outside a browser).
  const responsiblyUrl = `${import.meta.env.BASE_URL}responsibly/`;
  const d = strings.displacement;
  const caution = $derived(always ? d.caution : displacementCaution(suggestionId));

  function jump() {
    const target = jumpTo ? document.getElementById(jumpTo) : null;
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }
</script>

{#if caution}
  {#if watch && jumpTo}
    <p class="displacement" data-watch-jump={watch.signs}>
      {caution}
      {#if withSigns}{watch.text}{/if}
      <button class="jump" type="button" onclick={jump}>{withSigns ? d.jumpToProtections : d.jumpToWatch}</button>
    </p>
  {:else if watch}
    <WatchCard cautions={[caution]} text={watch.text} links={watch.links} signs={watch.signs} />
  {:else}
    <p class="displacement">
      {caution}
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
  .displacement a {
    color: inherit;
  }
  /* A button that reads as a link: it moves to the full card shown once on the page or list. */
  .jump {
    padding: 3px 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
