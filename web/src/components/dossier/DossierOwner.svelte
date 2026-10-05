<script lang="ts">
  // Who owns it: the owner names and mailing address as the City publishes them, the kind of
  // owner and why, the deed fraud notice with any flag on a person's parcel, each flag in its three
  // parts, help for owners and families, and taxes, always dated July 2025 with a link to the
  // City's Tax Center for today's balance (docs/ETHICS.md). On a parcel that may be someone's
  // home, a line says why the notes about an owner who may be a person are not shown.
  import type { DossierView } from '../../dossier/build.ts';
  import { strings } from '../../strings.ts';
  import FlagItem from './FlagItem.svelte';
  import ProvenanceLine from './ProvenanceLine.svelte';

  let { owner, onShowList }: { owner: DossierView['owner']; onShowList?: (listId: string) => void } = $props();
  const o = strings.dossier.owner;
</script>

<dl class="facts">
  <dt>{o.names}</dt>
  <dd>
    {#if owner.names.length}
      {#each owner.names as name (name)}<span class="name">{name}</span>{/each}
    {:else}
      <span class="muted">{o.noNames}</span>
    {/if}
  </dd>
  <dt>{o.mailing}</dt>
  <dd>{#if owner.mailing}{owner.mailing}{:else}<span class="muted">{o.noMailing}</span>{/if}</dd>
  <dt>{o.type}</dt>
  <dd>{owner.typeLabel}{#if owner.typeReason}<span class="reason">{owner.typeReason}</span>{/if}</dd>
  {#if owner.cityOwned}
    <dt>{o.cityListTitle}</dt>
    <dd>{owner.cityOwned}</dd>
  {/if}
</dl>
<ProvenanceLine provenance={owner.provenance} />
{#if owner.ownerChanged}<p class="notice">{o.ownerChanged}</p>{/if}

{#if owner.deedFraud}
  <aside class="deed-fraud" aria-labelledby="pk-deed-fraud-title">
    <h4 id="pk-deed-fraud-title">{o.deedFraudTitle}</h4>
    <p>{owner.deedFraud.text}</p>
    <ul class="links">
      {#each owner.deedFraud.links as link (link.url)}<li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>{/each}
    </ul>
  </aside>
{/if}

<h4>{o.flagsTitle}</h4>
{#if owner.flags.length === 0 && !owner.held}
  <p class="muted small">{o.noFlags}</p>
{:else}
  {#each owner.flags as flag (flag.id + flag.text)}<FlagItem {flag} {onShowList} />{/each}
{/if}
{#if owner.held}<p class="muted small">{owner.held}</p>{/if}

{#if owner.help}
  <h4>{o.helpTitle}</h4>
  <ul class="links">
    {#each owner.help as link (link.url)}<li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>{/each}
  </ul>
{/if}

<h4>{o.taxTitle}</h4>
{#if owner.tax.flag}
  <FlagItem flag={owner.tax.flag} />
{:else}
  <p class="small">{owner.tax.text}</p>
  <p class="small"><a href={owner.tax.link.url} target="_blank" rel="noopener noreferrer">{owner.tax.link.label}</a></p>
{/if}

<style>
  .facts {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    margin: 0 0 4px;
  }
  .facts dt {
    margin-top: 6px;
    color: var(--pk-muted);
    font-size: 0.8rem;
    font-weight: 600;
  }
  .facts dd {
    margin: 0;
  }
  .name {
    display: block;
  }
  .reason {
    display: block;
    color: var(--pk-muted);
    font-size: 0.85rem;
  }
  .deed-fraud {
    margin: 10px 0;
    padding: 8px 10px;
    border-radius: var(--pk-radius);
    background: var(--pk-accent-soft);
    color: var(--pk-text);
    font-size: 0.9rem;
  }
  .deed-fraud h4 {
    margin: 0 0 4px;
  }
  .deed-fraud p {
    margin: 0 0 4px;
  }
  .links {
    margin: 4px 0 8px;
    padding-left: 1.2em;
    font-size: 0.875rem;
  }
</style>
