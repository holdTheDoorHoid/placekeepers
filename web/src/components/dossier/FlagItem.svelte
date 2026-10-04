<script lang="ts">
  // One owner flag in its three parts (docs/ETHICS.md): what it means, why to be careful, and a
  // protective next step, with its links and where it came from.
  import type { FlagView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';
  import ProvenanceLine from './ProvenanceLine.svelte';

  let { flag, onShowList }: { flag: FlagView; onShowList?: (listId: string) => void } = $props();
  const parts = strings.dossier.owner.parts;
</script>

<article class="flag" data-flag={flag.id}>
  <h5>{flag.title}</h5>
  <dl>
    <dt>{parts.meaning}</dt>
    <dd>{flag.text}</dd>
    {#if flag.careful}
      <dt>{parts.careful}</dt>
      <dd>{flag.careful}</dd>
    {/if}
    {#if flag.nextStep}
      <dt>{parts.next}</dt>
      <dd>{flag.nextStep}</dd>
    {/if}
  </dl>
  {#if flag.list && onShowList}
    <p><button class="button small quiet" type="button" onclick={() => onShowList(flag.list!)}>{strings.dossier.owner.seeList}</button></p>
  {/if}
  {#if flag.links.length}
    <ul class="links">
      {#each flag.links as link (link.url)}<li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>{/each}
    </ul>
  {/if}
  <ProvenanceLine provenance={flag.provenance} />
</article>

<style>
  .flag {
    margin: 8px 0;
    padding: 8px 10px;
    border: 1px solid var(--pk-surface-2);
    border-radius: var(--pk-radius);
  }
  h5 {
    margin: 0 0 4px;
    font-size: 0.95rem;
  }
  dl {
    margin: 0;
    font-size: 0.9rem;
  }
  dt {
    margin-top: 4px;
    color: var(--pk-muted);
    font-size: 0.8rem;
    font-weight: 600;
  }
  dd {
    margin: 0;
  }
  .links {
    margin: 6px 0 0;
    padding-left: 1.2em;
    font-size: 0.875rem;
  }
</style>
