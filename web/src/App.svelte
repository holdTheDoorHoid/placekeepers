<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { config } from './config/index.ts';
  import { isSampleData, loadManifest } from './data/manifest.ts';
  import { FIELD_VIEW_MAX_WIDTH, autoView } from './state/defaults.ts';
  import { savedText } from './state/init.ts';
  import { PREFS_KEY, removeItem, writeItem } from './state/storage.ts';
  import type { AppStore } from './state/store.svelte.ts';
  import { decodeState, encodeState } from './state/url.ts';
  import { strings } from './strings.ts';
  import { isOpaAccount } from './dossier/opa.ts';
  import AnalysisView from './components/analysis/AnalysisView.svelte';
  import DossierPrint from './components/dossier/DossierPrint.svelte';
  import FieldView from './components/field/FieldView.svelte';
  import Header from './components/Header.svelte';
  import MapView from './components/MapView.svelte';
  import SettingsDrawer from './components/SettingsDrawer.svelte';

  let { store }: { store: AppStore } = $props();
  let settingsOpen = $state(false);

  // The address bar follows the state, a moment after changes settle.
  let lastHash = location.hash.slice(1);
  let hashTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    // While the person's location is in use, the map position would show where they are.
    const text = encodeState(store.registry, $state.snapshot(store.state), { includeMap: !store.mapPrivate });
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      if (text === lastHash) return;
      lastHash = text;
      history.replaceState(history.state, '', `#${text}`);
    }, 250);
  });

  // Browser storage keeps personal settings, but only once the person changes something,
  // so opening someone else's link does not replace your own settings.
  $effect(() => {
    const text = savedText(store.registry, $state.snapshot(store.state), store.viewChosen);
    if (!store.touched) return;
    if (text) writeItem(PREFS_KEY, text);
    else removeItem(PREFS_KEY);
  });

  // Short messages disappear after a while; screen readers have already read them.
  let messageTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    if (!store.message) return;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => (store.message = ''), 7000);
  });

  // The lot page follows the selection, wherever it came from: a tap, a search, or a link. When
  // the map finds the selected parcel in its lots layer later, the page gets its tile data too.
  $effect(() => {
    const id = store.state.selected;
    const tile = store.selectedProperties;
    untrack(() => {
      if (id && isOpaAccount(id)) store.dossier.open(id, { tile });
      else if (store.dossier.opa) store.dossier.close();
    });
  });

  // The browser tab and a printed page carry the lot's address.
  $effect(() => {
    const title = store.dossierView?.title;
    document.title = title ? `${title} | ${strings.app.name}` : strings.app.name;
  });

  // An open lot page knows its address: cards, the ranked list and saved lists can use it too.
  $effect(() => {
    const view = store.dossierView;
    if (!view || view.loading || view.title === strings.dossier.parcel(view.opa)) return;
    untrack(() => {
      store.addresses.remember(view.opa, view.title);
      store.lists.update(view.opa, { address: view.title, center: store.dossier.center });
    });
  });

  onMount(() => {
    loadManifest(config.dataBase).then((result) => {
      store.setManifest(result);
      if (result.error) console.warn('Placekeepers data:', result.error);
      if (result.problems.length) console.warn('Placekeepers manifest problems:', result.problems);
    });

    // A link pasted into an open tab.
    const onHashChange = () => {
      const text = location.hash.slice(1);
      if (text === lastHash) return;
      const decoded = decodeState(store.registry, text, store.state.view);
      if (!decoded.found) return;
      lastHash = text;
      store.replace(decoded.state, decoded.hasView || store.viewPinned);
    };
    window.addEventListener('hashchange', onHashChange);

    // Until someone picks a view, it follows the screen width.
    const narrow = window.matchMedia(`(max-width: ${FIELD_VIEW_MAX_WIDTH - 0.02}px)`);
    const onWidth = () => {
      if (!store.viewPinned) store.setView(autoView(window.innerWidth), false);
    };
    narrow.addEventListener('change', onWidth);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      narrow.removeEventListener('change', onWidth);
    };
  });

  const sample = $derived(isSampleData(store.manifest));
</script>

<div class="app">
  <!-- Moves focus without touching the address bar, which holds the map state. -->
  <a
    class="skip-link"
    href="#places-section"
    onclick={(e) => {
      e.preventDefault();
      document.getElementById('places-section')?.focus();
    }}>{strings.app.skipToList}</a
  >
  <Header {store} onOpenSettings={() => (settingsOpen = true)} />
  {#if sample}<p class="sample" role="note">{strings.app.sampleData}</p>{:else}<p class="sample" role="note">
      {strings.app.earlyPreview}
      <a href={strings.app.repoUrl}>{strings.app.followAlong}</a>
    </p>{/if}
  <main class="stage {store.state.view}" class:with-dossier={store.dossierView !== null && !store.inspected}>
    <div class="map-area"><MapView {store} /></div>
    {#if store.state.view === 'field'}
      <FieldView {store} />
    {:else}
      <AnalysisView {store} />
    {/if}
  </main>
  <SettingsDrawer {store} bind:open={settingsOpen} />
  <div class="toast" class:shown={store.message !== ''} role="status" aria-live="polite">{store.message}</div>
</div>
{#if store.dossierView && !store.dossierView.loading && !store.dossierView.empty}
  <!-- Printed instead of the map while a lot page is open (see app.css). -->
  <div class="pk-print"><DossierPrint view={store.dossierView} /></div>
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    /* clip, not hidden: a hidden overflow can still be scrolled by focus or scrollIntoView. */
    overflow: hidden;
    overflow: clip;
  }
  .sample {
    margin: 0;
    padding: 4px 12px;
    background: var(--pk-note-bg);
    color: var(--pk-note-ink);
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
  }
  .stage {
    flex: 1;
    min-height: 0;
    display: grid;
    position: relative;
    overflow: hidden;
    overflow: clip;
  }
  .stage.field {
    grid-template:
      'controls' auto
      'map' minmax(0, 1fr)
      / minmax(0, 1fr);
  }
  .stage.analysis {
    grid-template:
      'left map right' minmax(0, 1fr)
      'left drawer right' auto
      / minmax(290px, 340px) minmax(0, 1fr) minmax(290px, 340px);
  }
  /* A lot page needs more room than the area summary: its tables have five columns. */
  .stage.analysis.with-dossier {
    grid-template-columns: minmax(290px, 340px) minmax(0, 1fr) minmax(320px, 440px);
  }
  @media (max-width: 1099px) {
    .stage.analysis.with-dossier,
    .stage.analysis {
      grid-template:
        'left toolbar' auto
        'left map' minmax(0, 1fr)
        'left drawer' auto
        / minmax(270px, 320px) minmax(0, 1fr);
    }
  }
  @media (max-width: 767px) {
    .stage.analysis.with-dossier,
    .stage.analysis {
      grid-template:
        'toolbar' auto
        'map' minmax(0, 1fr)
        'drawer' auto
        / minmax(0, 1fr);
    }
  }
  .map-area {
    grid-area: map;
    min-height: 0;
    min-width: 0;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    z-index: 50;
    width: max-content;
    max-width: min(480px, calc(100vw - 32px));
    padding: 10px 14px;
    border-radius: var(--pk-radius);
    background: #1d2327;
    color: #ffffff;
    box-shadow: var(--pk-shadow);
    font-size: 0.95rem;
    opacity: 0;
    pointer-events: none;
  }
  .toast.shown {
    opacity: 1;
  }
</style>
