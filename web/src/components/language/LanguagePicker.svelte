<script lang="ts">
  // The language button in every page's top bar: a globe and the language in use, in its own
  // name ("English", "Español", "中文"), shortened on a phone. It opens the list of languages.
  import { currentLanguage } from '../../i18n/locale.ts';
  import { strings } from '../../strings.ts';
  import Dialog from '../common/Dialog.svelte';
  import LanguageList from './LanguageList.svelte';

  let open = $state(false);
  const language = currentLanguage();
</script>

<button
  class="button quiet small picker"
  type="button"
  aria-haspopup="dialog"
  aria-label={strings.language.buttonLabel(language.name)}
  onclick={() => (open = true)}
>
  <svg class="globe" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
    <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" />
  </svg>
  <span class="long" lang={language.code}>{language.name}</span><span class="short" lang={language.code}>{language.short}</span>
</button>

<Dialog bind:open title={strings.language.title} id="pk-language">
  <p class="muted small">{strings.language.intro}</p>
  <LanguageList idPrefix="pk-language" />
</Dialog>

<style>
  .picker {
    gap: 6px;
    padding-inline: 10px;
  }
  .globe {
    width: 20px;
    height: 20px;
    flex: none;
  }
  .short {
    display: none;
  }
  @media (max-width: 560px) {
    .long {
      display: none;
    }
    .short {
      display: inline;
    }
  }
</style>
