<script lang="ts">
  // The line every memorial suggestion carries, wherever it is listed (docs/ETHICS.md): only with
  // the family's blessing, with a link to Families for Safe Streets.
  import { FAMILIES_FOR_SAFE_STREETS_URL } from '../../config/links.ts';
  import { MEMORIAL_SUGGESTIONS } from '../../streets/describe.ts';
  import { strings } from '../../strings.ts';

  let { suggestionId }: { suggestionId: string } = $props();
</script>

{#if MEMORIAL_SUGGESTIONS.has(suggestionId)}
  <p class="blessing">
    {strings.streets.blessing}
    <a href={FAMILIES_FOR_SAFE_STREETS_URL} target="_blank" rel="noopener noreferrer">{strings.streets.families}</a>
  </p>
{/if}

<style>
  .blessing {
    margin: 2px 0;
    font-weight: 600;
  }
</style>
