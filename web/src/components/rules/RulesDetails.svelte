<script lang="ts">
  // What a tap on a rules layer shows (M4.6, src/rules/describe.ts): a historic district or
  // property, every zoning overlay at the spot, the hearings still to come there (with a button to
  // open the lot's page), or an EPA brownfield site. Never a name from an appeal.
  import { brownfieldCard, districtCard, hearingCard, overlayCard, propertyCard, type RuleCard } from '../../rules/describe.ts';
  import { strings } from '../../strings.ts';

  let {
    style,
    features,
    onOpenLot,
  }: {
    style: 'historic_districts' | 'historic_properties' | 'zoning_overlays' | 'hearings' | 'brownfields';
    features: Record<string, unknown>[];
    onOpenLot?: (opa: string) => void;
  } = $props();

  const make: Record<typeof style, (p: Record<string, unknown>) => RuleCard> = {
    historic_districts: districtCard,
    historic_properties: propertyCard,
    zoning_overlays: overlayCard,
    hearings: hearingCard,
    brownfields: brownfieldCard,
  };
  const cards = $derived(features.slice(0, 8).map((p) => make[style](p)));
</script>

{#if style === 'zoning_overlays' && cards.length > 1}<h3>{strings.rulesMap.overlaysHere(cards.length)}</h3>{/if}
{#if style === 'hearings' && cards.length > 1}<h3>{strings.rulesMap.hearingsHere(cards.length)}</h3>{/if}
{#each cards as card, i (i)}
  <section class="rule-card">
    <h3>{card.title}</h3>
    {#each card.lines as line (line)}<p>{line}</p>{/each}
    {#if card.links.length}
      <ul class="links">
        {#each card.links as link (link.url)}
          <li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
        {/each}
      </ul>
    {/if}
    {#if card.opa && onOpenLot}
      <button class="button small" type="button" onclick={() => onOpenLot?.(card.opa!)}>{strings.rulesMap.openLot}</button>
    {/if}
  </section>
{/each}

<style>
  .rule-card {
    margin-bottom: 10px;
  }
  .rule-card p {
    margin: 0 0 4px;
  }
  .links {
    margin: 2px 0 6px;
    padding-left: 1.2em;
    font-size: 0.875rem;
  }
</style>
