<script lang="ts">
  // The list of languages, each in its own name and script, with the page language's name for it
  // below. Choosing one saves it and reloads the page in that language (src/i18n/choose.ts).
  // Buttons rather than radio buttons: moving through radio buttons with the arrow keys would
  // reload the page at the first key press.
  import { pageLanguage } from '../../i18n/boot.ts';
  import { chooseLanguage, pickerLanguages } from '../../i18n/choose.ts';
  import { currentLanguage } from '../../i18n/locale.ts';
  import { strings } from '../../strings.ts';

  let { idPrefix = 'pk-lang' }: { idPrefix?: string } = $props();

  const page = pageLanguage();
  const languages = pickerLanguages(page.code, page.showAll);

  /** What the page's own language calls a language ("Spanish", "español"), or its English name. */
  function localName(code: string, english: string): string {
    try {
      return new Intl.DisplayNames([currentLanguage().intl], { type: 'language' }).of(code) ?? english;
    } catch {
      return english;
    }
  }
</script>

<ul class="languages" aria-label={strings.language.listLabel} id="{idPrefix}-list">
  {#each languages as language (language.code)}
    {@const current = language.code === page.code}
    <li>
      <button
        type="button"
        class="language"
        class:current
        aria-current={current ? 'true' : undefined}
        onclick={() => {
          if (!current) chooseLanguage(language.code);
        }}
      >
        <span class="name" lang={language.code} dir={language.dir}>{language.name}</span>
        <span class="also">
          {localName(language.code, language.english)}{#if current}<span class="sr-only">, </span><span class="in-use"
              >{strings.language.inUse}</span
            >{:else if !language.ready}<span class="sr-only">, </span><span class="in-use">{strings.language.notReady}</span>{/if}
        </span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .languages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .language {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    min-height: 48px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: var(--pk-radius);
    background: transparent;
    color: var(--pk-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .language:hover {
    background: var(--pk-surface);
  }
  .language.current {
    border-color: var(--pk-accent);
    background: var(--pk-accent-soft);
    cursor: default;
  }
  .name {
    font-size: 1.05rem;
    font-weight: 700;
  }
  .also {
    font-size: 0.875rem;
    color: var(--pk-muted);
  }
  .in-use {
    margin-inline-start: 8px;
    font-weight: 600;
    color: var(--pk-accent);
  }
</style>
