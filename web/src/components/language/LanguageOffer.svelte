<script lang="ts">
  // On a first visit from a browser set to a language the site speaks, a line in that language
  // asks whether to switch. Nothing changes until the visitor answers; either answer is
  // remembered, so the question is asked once (src/i18n/choose.ts, issue #49).
  import { pageLanguage } from '../../i18n/boot.ts';
  import { chooseLanguage, declineOffer } from '../../i18n/choose.ts';
  import { languageOf } from '../../i18n/languages.ts';
  import { strings } from '../../strings.ts';

  let { compact = false }: { compact?: boolean } = $props();

  const offered = pageLanguage().offer;
  const language = offered ? languageOf(offered) : null;
  let open = $state(offered !== null);
</script>

{#if open && language}
  <div class="offer" class:compact role="region" aria-label={strings.language.offerLabel} lang={language.code} dir={language.dir}>
    <p>{language.offer.question}</p>
    <div class="answers">
      <button class="button primary small" type="button" onclick={() => offered && chooseLanguage(offered)}>{language.offer.yes}</button>
      <button
        class="button quiet small"
        type="button"
        onclick={() => {
          declineOffer();
          open = false;
        }}>{language.offer.no}</button
      >
    </div>
  </div>
{/if}

<style>
  .offer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 12px;
    margin: 0 0 12px;
    padding: 8px 12px;
    border-radius: var(--pk-radius);
    background: var(--pk-accent-soft);
    color: var(--pk-text);
  }
  .offer p {
    margin: 0;
    font-weight: 600;
  }
  .answers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .compact {
    margin: 0;
    border-radius: 0;
  }
</style>
