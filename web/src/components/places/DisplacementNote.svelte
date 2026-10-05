<script lang="ts">
  // The caution every greening suggestion carries until the displacement watch overlay exists
  // (docs/ETHICS.md, "Displacement", word for word; docs/VERIFICATION.md, decision D12), with a
  // link to the ways to protect neighbors on the "Use this responsibly" page.
  import { isGreening } from '../../config/suggestions.ts';
  import { strings } from '../../strings.ts';

  let { suggestionId }: { suggestionId: string } = $props();
  // The site root from the build (not config, so the lot page also renders outside a browser).
  const responsiblyUrl = `${import.meta.env.BASE_URL}responsibly/`;
</script>

{#if isGreening(suggestionId)}
  <p class="displacement">
    {strings.displacement.caution}
    <a href={responsiblyUrl}>{strings.displacement.protections}</a>
  </p>
{/if}

<style>
  .displacement {
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
</style>
