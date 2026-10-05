<script lang="ts">
  // An owner's parcels on our list, from the "many vacant parcels" flag: an organization's from
  // tables/owners.json, a person's other parcels from the lot's own record (no citywide file lists
  // people). In the order given (by account), never ranked; each opens its own lot page. The
  // flag's careful note is repeated here: one owner can appear under several spellings, and
  // holding vacant land is not wrongdoing by itself.
  import { loadOwnerList, type OwnerList, type OwnerListTarget } from '../../dossier/owners-table.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';

  let {
    store,
    target,
    dataBase,
    onOpen,
  }: { store: AppStore; target: OwnerListTarget; dataBase: string; onOpen: (id: string) => void } = $props();

  const s = strings.dossier;
  // A person's other parcels are already here; an organization's list is fetched once.
  const inline = $derived<OwnerList | null>('parcels' in target ? { names: [], parcels: target.parcels } : null);
  let fetched = $state.raw<OwnerList | null>(null);
  let loading = $state(true);
  const list = $derived(inline ?? fetched);

  $effect(() => {
    const current = target;
    if (!('listId' in current)) return;
    loading = true;
    store.manifestReady.then(() => loadOwnerList(dataBase, current.listId, store.manifest?.files ?? null)).then((found) => {
      if (current !== target) return;
      fetched = found;
      loading = false;
    });
  });
</script>

{#if !inline && loading}
  <p class="muted">{s.ownerList.loading}</p>
{:else if !list}
  <p class="notice">{s.ownerList.missing}</p>
{:else}
  <p>{inline ? s.ownerList.others : s.ownerList.intro(list.names.join('; '))}</p>
  <p class="muted small">{s.flags.many_parcels.careful}</p>
  <ul class="parcels">
    {#each list.parcels as parcel (parcel.id)}
      <li>
        <button class="link" type="button" aria-label={s.ownerList.open(parcel.address ?? s.parcel(parcel.id))} onclick={() => onOpen(parcel.id)}>
          {parcel.address ?? s.parcel(parcel.id)}
        </button>
        {#if parcel.kind}
          <span class="muted small"
            >{s.ownerList.kind(s.summary.kind[parcel.kind] ?? parcel.kind, parcel.confidence ? (s.summary.confidence[parcel.confidence] ?? null) : null)}</span
          >
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .parcels {
    margin: 8px 0;
    padding-left: 1.2em;
  }
  .parcels li {
    margin: 4px 0;
  }
  .link {
    padding: 2px 0;
    border: 0;
    background: none;
    color: var(--pk-accent);
    font: inherit;
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
  }
  .parcels .muted {
    display: block;
  }
</style>
