<script lang="ts">
  // The crashes drawn on the map, as a list: the way to reach them without the map, with a keyboard
  // or a screen reader (src/streets/blocks.ts). Each entry says the year, how badly people were hurt
  // and who was involved, as the crash's details do, and the nearest street block drawn; opening
  // one shows those details and brings the crash into view.
  import type { AppStore } from '../../state/store.svelte.ts';
  import type { CrashEntry } from '../../streets/blocks.ts';
  import { strings } from '../../strings.ts';

  let {
    store,
    crashes,
    fromYou = null,
  }: {
    store: AppStore;
    crashes: (CrashEntry & { distance?: number })[];
    /** In the field view: say how far each crash is, from the person or the map's middle. */
    fromYou?: boolean | null;
  } = $props();
  const s = strings.streets;

  function open(crash: CrashEntry) {
    store.inspect({ layerId: crash.layerId, features: [crash.properties], lngLat: crash.lngLat });
    store.controller?.flyTo(crash.lngLat);
  }

  /** What the entry says under its title: who was involved, the nearest block, how far. */
  function about(crash: CrashEntry & { distance?: number }): string {
    const parts = [`${s.involved}: ${crash.crash.involved}.`];
    if (crash.near) parts.push(`${s.crashNear(crash.near)}.`);
    if (fromYou !== null && crash.distance !== undefined) parts.push(`${strings.sheet.distance(crash.distance, fromYou)}.`);
    return parts.join(' ');
  }

  function isOpen(crash: CrashEntry): boolean {
    const target = store.inspected;
    return !!target && target.layerId === crash.layerId && target.features.some((f) => f.id === crash.properties.id);
  }
</script>

<ul class="entries">
  {#each crashes as crash (crash.key)}
    <li data-crash={crash.key}>
      <button class="link" type="button" aria-pressed={isOpen(crash)} onclick={() => open(crash)}>
        <span class="name">{s.crashTitle(crash.crash.year)}: {crash.crash.severity}.</span>
        <span class="about">{about(crash)}</span>
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
