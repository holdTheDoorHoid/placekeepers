<script lang="ts">
  // The note on every page in another language until a native speaker has checked it (issue #49):
  // translated with the help of AI, not yet checked, and a link to the "Fix a translation" form.
  // Nothing shows in English or in a reviewed language.
  import { fixTranslationUrl } from '../../i18n/fix.ts';
  import { currentLanguage, currentLocale, isSourceLocale } from '../../i18n/locale.ts';
  import { strings } from '../../strings.ts';

  let {
    inEnglish = false,
    compact = false,
    onHide,
  }: { inEnglish?: boolean; compact?: boolean; onHide?: () => void } = $props();

  const language = currentLanguage();
  const shown = !isSourceLocale() && !language.reviewed;
  const url = typeof window === 'undefined' ? '' : fixTranslationUrl(currentLocale(), window.location.pathname);
</script>

{#if shown || (inEnglish && !isSourceLocale())}
  <p class="translation-note" class:compact role="note">
    {#if inEnglish}<span>{strings.language.pageInEnglish}</span>{/if}
    {#if shown}<span>{strings.language.aiNote}</span>
      <a href={url} target="_blank" rel="noopener noreferrer">{strings.language.fixLink}</a>{/if}
    {#if onHide}<button class="hide" type="button" aria-label={strings.app.hideNoteLabel} onclick={onHide}>{strings.app.hideNote}</button>{/if}
  </p>
{/if}

<style>
  .translation-note {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    margin: 0 0 12px;
    padding: 8px 12px;
    border-radius: var(--pk-radius);
    background: var(--pk-note-bg);
    color: var(--pk-note-ink);
    font-size: 0.875rem;
  }
  .translation-note a {
    color: inherit;
    font-weight: 600;
  }
  .hide {
    flex: none;
    min-height: 32px;
    padding: 2px 10px;
    border: 1px solid currentColor;
    border-radius: var(--pk-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .compact {
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 4px 12px;
    border-radius: 0;
    text-align: center;
  }
</style>
