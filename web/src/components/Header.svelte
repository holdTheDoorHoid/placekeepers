<script lang="ts">
  import type { Snippet } from 'svelte';
  import { config } from '../config/index.ts';
  import { freshness } from '../data/manifest.ts';
  import type { AppStore } from '../state/store.svelte.ts';
  import { encodeState } from '../state/url.ts';
  import { strings } from '../strings.ts';
  import Dialog from './common/Dialog.svelte';
  import SiteNav from './common/SiteNav.svelte';
  import ViewSwitch from './ViewSwitch.svelte';

  let { store, onOpenSettings, children }: { store: AppStore; onOpenSettings: () => void; children?: Snippet } = $props();

  let menuOpen = $state(false);

  const fresh = $derived(
    store.manifestLoaded ? freshness(store.registry, store.manifest) : { kind: 'unknown' as const, text: strings.freshness.checking },
  );

  async function share() {
    // While the person's location is in use, the map position would show where they are.
    const located = store.mapPrivate;
    const url = `${location.origin}${location.pathname}#${encodeState(store.registry, $state.snapshot(store.state), { includeMap: !located })}`;
    try {
      await navigator.clipboard.writeText(url);
      store.say(located ? strings.header.shareDoneNoMap : strings.header.shareDone);
    } catch {
      store.say(strings.header.shareFailed);
    }
  }
</script>

<!-- The page's banner: the top bar, and any note about the whole site (children) below it. -->
<header class="masthead">
  <div class="topbar">
    <h1 class="brand">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#1f5f8b" />
        <path d="M16 6c-5 4-8 8-8 12a8 8 0 0 0 16 0c0-4-3-8-8-12z" fill="#c2e699" />
        <path d="M16 12v14" stroke="#1f5f8b" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span class="name">{strings.app.name}</span>
    </h1>
    <ViewSwitch {store} />
    <div class="actions">
      <button class="button quiet small" type="button" aria-haspopup="dialog" onclick={() => (menuOpen = true)}
        >{strings.nav.menu}</button
      >
      <a class="freshness" data-kind={fresh.kind} href="{config.siteBase}status/">
        <span class="dot" aria-hidden="true"></span><span class="fresh-text">{fresh.text}</span><span class="sr-only">. {strings.header.dataStatus}</span>
      </a>
      <button class="button quiet small share" type="button" onclick={share}>{strings.header.share}</button>
    </div>
    <button class="button primary small settings" type="button" aria-haspopup="dialog" onclick={onOpenSettings}
      >{strings.header.settings}</button
    >
  </div>
  {@render children?.()}
</header>

<Dialog bind:open={menuOpen} title={strings.nav.menuTitle} id="pk-menu">
  <!-- On the narrowest phones "Copy link" moves here from the top bar. -->
  <p class="menu-share">
    <button
      class="button quiet"
      type="button"
      onclick={() => {
        menuOpen = false;
        void share();
      }}>{strings.header.share}</button
    >
  </p>
  <SiteNav current="map" />
</Dialog>

<style>
  .topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--pk-surface-2);
    background: var(--pk-bg);
    position: relative;
    z-index: 5;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1.15rem;
  }
  .mark {
    width: 28px;
    height: 28px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px 8px;
    margin-left: auto;
  }
  .freshness {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    background: var(--pk-surface);
    color: var(--pk-text);
  }
  .freshness .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--pk-muted);
  }
  .freshness[data-kind='ok'] {
    background: var(--pk-ok-bg);
    color: var(--pk-ok-ink);
  }
  .freshness[data-kind='ok'] .dot {
    background: var(--pk-ok-ink);
  }
  .freshness[data-kind='stale'] {
    background: var(--pk-stale-bg);
    color: var(--pk-stale-ink);
  }
  .freshness[data-kind='stale'] .dot {
    background: var(--pk-stale-ink);
  }
  .freshness[data-kind='failing'] {
    background: var(--pk-fail-bg);
    color: var(--pk-fail-ink);
  }
  .freshness[data-kind='failing'] .dot {
    background: var(--pk-fail-ink);
  }
  .settings {
    order: 4;
  }
  .menu-share {
    display: none;
  }
  /* Phones: logo, view switch and Settings on the first row; data date and link below. */
  @media (max-width: 560px) {
    .topbar {
      gap: 6px 8px;
      padding: 6px 12px;
    }
    .brand .name {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
    .settings {
      order: 2;
      margin-left: auto;
    }
    .actions {
      order: 3;
      width: 100%;
      flex-wrap: nowrap;
      justify-content: space-between;
      margin-left: 0;
    }
    /* The data date shares its row with Menu and Copy link: smaller, and cut short with "..." on
       screen if it still does not fit (the Data status page it links to says it in full). */
    .freshness {
      min-width: 0;
      font-size: 0.8rem;
      padding: 2px 8px;
    }
    .fresh-text {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }
  /* The narrowest phones: "Copy link" waits in the menu, so the top bar keeps to two rows. */
  @media (max-width: 360px) {
    .share {
      display: none;
    }
    .menu-share {
      display: block;
      margin: 0 0 8px;
    }
    .topbar {
      padding-inline: 8px;
    }
  }
</style>
