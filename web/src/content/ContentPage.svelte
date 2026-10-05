<script lang="ts">
  // The shared layout for every content page (About, Why this works, How to do it, Use this
  // responsibly, How we find vacant land, Terms, Privacy, Contact): a small header with the
  // site menu, the page itself (already rendered from Markdown to HTML at build time, see
  // plugins/content.ts), and the footer every page carries.
  import { config } from '../config/index.ts';
  import { strings } from '../strings.ts';
  import Dialog from '../components/common/Dialog.svelte';
  import SiteNav from '../components/common/SiteNav.svelte';

  let { slug, html }: { slug: string; html: string } = $props();
  let menuOpen = $state(false);
</script>

<div class="page">
  <header class="topbar">
    <a class="brand" href={config.siteBase}>{strings.app.name}</a>
    <button class="button quiet small" type="button" aria-haspopup="dialog" onclick={() => (menuOpen = true)}>
      {strings.nav.menu}
    </button>
  </header>

  <!-- The page's own Markdown supplies the heading (an <h1>), so none is added here. -->
  <main class="prose">
    {@html html}
  </main>

  <footer class="muted small">{strings.app.notAffiliated} {strings.app.licenses}</footer>
</div>

<Dialog bind:open={menuOpen} title={strings.nav.menuTitle} id="pk-menu">
  <SiteNav current={slug} />
</Dialog>

<style>
  .page {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 16px 32px;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .brand {
    font-size: 1.15rem;
    font-weight: 700;
    text-decoration: none;
    color: var(--pk-text);
  }
  /* Long words and web addresses wrap instead of pushing the page sideways on a phone. */
  .prose {
    overflow-wrap: break-word;
  }
  .prose :global(.table-scroll) {
    max-width: 100%;
    overflow-x: auto;
    margin: 0.6em 0 1.2em;
  }
  .prose :global(.table-scroll:focus-visible) {
    outline: 3px solid var(--pk-focus);
    outline-offset: 2px;
  }
  .prose :global(h1) {
    font-size: 1.6rem;
    margin-top: 8px;
  }
  .prose :global(h2) {
    margin-top: 1.4em;
  }
  .prose :global(ul),
  .prose :global(ol) {
    padding-left: 22px;
  }
  .prose :global(li) {
    margin-bottom: 0.3em;
  }
  .prose :global(blockquote) {
    margin: 0.8em 0;
    padding: 2px 14px;
    border-left: 4px solid var(--pk-accent);
    color: var(--pk-muted);
  }
  .prose :global(table) {
    margin: 0;
    font-size: 0.925rem;
  }
  .prose :global(a) {
    text-decoration: underline;
  }
  footer {
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid var(--pk-surface-2);
  }
</style>
