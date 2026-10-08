<script lang="ts">
  // The street blocks drawn on the map, as a list: the way to reach them without the map, with a
  // keyboard or a screen reader (src/streets/blocks.ts). Each entry names the street and gives its
  // street safety priority and the main reason; opening one shows the same details as tapping the
  // block, and brings it into view.
  import type { AppStore } from '../../state/store.svelte.ts';
  import type { BlockEntry } from '../../streets/blocks.ts';
  import { strings } from '../../strings.ts';

  let {
    store,
    blocks,
    lensLabel,
    fromYou = null,
  }: {
    store: AppStore;
    blocks: (BlockEntry & { distance?: number })[];
    lensLabel: string;
    /** In the field view: say how far each block is, from the person or the map's middle. */
    fromYou?: boolean | null;
  } = $props();

  function open(block: BlockEntry) {
    store.inspect({ layerId: block.layerId, features: [block.properties], lngLat: block.lngLat });
    store.controller?.flyTo(block.lngLat);
  }

  /** What the entry says under the street's name, as one sentence or two. */
  function about(block: BlockEntry & { distance?: number }): string {
    const parts =
      block.score === null
        ? [strings.streets.blockNoScore]
        : [`${strings.place.priority(block.score, lensLabel)}.`, ...(block.reason ? [strings.place.mainReason(block.reason)] : [])];
    if (fromYou !== null && block.distance !== undefined) parts.push(`${strings.sheet.distance(block.distance, fromYou)}.`);
    return parts.join(' ');
  }

  function isOpen(block: BlockEntry): boolean {
    const target = store.inspected;
    return !!target && target.layerId === block.layerId && target.features.some((f) => f.id === block.properties.id);
  }
</script>

<ul class="entries">
  {#each blocks as block (block.key)}
    <li data-block={block.key}>
      <button class="link" type="button" aria-pressed={isOpen(block)} onclick={() => open(block)}>
        <span class="name">{block.name}</span>
        <span class="about">{about(block)}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .entries {
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
    cursor: pointer;
  }
  .link[aria-pressed='true'] .name {
    font-weight: 700;
  }
  .name {
    text-decoration: underline;
  }
  .about {
    display: block;
    color: var(--pk-muted);
    font-size: 0.875rem;
  }
</style>
