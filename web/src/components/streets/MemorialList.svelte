<script lang="ts">
  // The memorials drawn on the map, as a list: the way to reach them without the map, with a
  // keyboard or a screen reader. Each entry says what the marker says before it is opened (how
  // the person was traveling, the date and the place), never a name; opening one shows the same
  // details as tapping its marker, where a name appears only under the rules of docs/ETHICS.md.
  import { config } from '../../config/index.ts';
  import { REMOVAL_EMAIL } from '../../content/removal-email.ts';
  import type { MemorialInView } from '../../map/controller.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { describeMemorial } from '../../streets/describe.ts';
  import { strings } from '../../strings.ts';

  let { store, memorials }: { store: AppStore; memorials: MemorialInView[] } = $props();

  const links = { removalEmail: REMOVAL_EMAIL, contactUrl: `${config.siteBase}contact/` };

  function open(memorial: MemorialInView) {
    store.inspect({ layerId: memorial.layerId, features: [memorial.properties], lngLat: memorial.lngLat });
    store.controller?.flyTo(memorial.lngLat);
  }
</script>

<ul class="memorials">
  {#each memorials as memorial (String(memorial.properties.id))}
    {@const view = describeMemorial(memorial.properties, false, links)}
    <li data-memorial={view.id}>
      <button class="link" type="button" aria-pressed={store.inspected?.features.some((f) => f.id === memorial.properties.id) ?? false} onclick={() => open(memorial)}>
        {view.sentence}{#if view.place}<span class="place">{view.place}</span>{/if}
      </button>
    </li>
  {/each}
</ul>

<style>
  .memorials {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .link {
    display: block;
    width: 100%;
    min-height: 44px;
    padding: 6px 0;
    border: 0;
    background: none;
    color: var(--pk-accent);
    font: inherit;
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
  }
  .link[aria-pressed='true'] {
    font-weight: 700;
  }
  .place {
    display: block;
    color: var(--pk-muted);
    font-size: 0.875rem;
    text-decoration: none;
  }
</style>
