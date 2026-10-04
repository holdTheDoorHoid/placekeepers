<script lang="ts">
  // A modal panel built on the native <dialog> element: it traps focus, closes with the
  // Escape key, and returns focus to the button that opened it.
  import type { Snippet } from 'svelte';
  import { strings } from '../../strings.ts';

  let {
    open = $bindable(false),
    title,
    id,
    children,
  }: { open?: boolean; title: string; id: string; children: Snippet } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="drawer"
  aria-labelledby="{id}-title"
  onclose={() => (open = false)}
  onclick={(e) => {
    if (e.target === dialog) open = false;
  }}
>
  <div class="inner">
    <header>
      <h2 id="{id}-title">{title}</h2>
      <button class="icon-button" type="button" aria-label={strings.app.close} onclick={() => (open = false)}>&times;</button>
    </header>
    <div class="body">
      {#if open}{@render children()}{/if}
    </div>
  </div>
</dialog>

<style>
  .drawer {
    margin: 0 0 0 auto;
    padding: 0;
    width: min(440px, 100vw);
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border: 0;
    background: var(--pk-bg);
    color: var(--pk-text);
    box-shadow: var(--pk-shadow);
  }
  .drawer::backdrop {
    background: rgba(16, 24, 32, 0.35);
  }
  .inner {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  header h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .body {
    position: relative;
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px 24px;
  }
</style>
