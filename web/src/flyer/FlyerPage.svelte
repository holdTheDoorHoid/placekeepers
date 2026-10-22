<script lang="ts">
  // The neighbor flyer page (M5.2, issue #46): a printable sign for a lot's fence with a big plain
  // headline, the address and a small map, what the organizers hope to do, how to reach them, a QR
  // code to the lot's page on Placekeepers and, if they want, one to their own link. A Letter page,
  // or a half page that prints two to a sheet. What is typed stays in this browser
  // (src/flyer/flyer.ts); the address bar carries only the lot.
  import { onMount } from 'svelte';
  import { config } from '../config/index.ts';
  import { loadManifest, type Manifest } from '../data/manifest.ts';
  import { isOpaAccount } from '../dossier/opa.ts';
  import { plain } from '../dossier/plain.ts';
  import { loadShard, shardLocation } from '../dossier/shard.ts';
  import { strings } from '../strings.ts';
  import Dialog from '../components/common/Dialog.svelte';
  import SiteNav from '../components/common/SiteNav.svelte';
  import LanguageOffer from '../components/language/LanguageOffer.svelte';
  import LanguagePicker from '../components/language/LanguagePicker.svelte';
  import TranslationNote from '../components/language/TranslationNote.svelte';
  import QrCode from '../components/print/QrCode.svelte';
  import StaticMapView from '../components/print/StaticMapView.svelte';
  import { clearFlyers, contactCaution, defaultFields, HOPES, hopeLines, readFlyers, writeFlyers, type FlyerFields, type Hope } from './flyer.ts';
  import { lotPageUrl, ownLink } from './qr.ts';

  const t = strings.flyer;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const opa = isOpaAccount(params.get('opa')) ? params.get('opa') : null;
  const at = (() => {
    const parts = (params.get('at') ?? '').split(',').map(Number);
    const [lng, lat] = parts;
    return parts.length === 2 && lng! > -76 && lng! < -74.5 && lat! > 39.5 && lat! < 40.5 ? ([lng!, lat!] as [number, number]) : null;
  })();
  const key = opa ?? '-';
  const siteUrl = new URL(config.siteBase, window.location.href).href;

  let manifest = $state.raw<Manifest | null>(null);
  let address = $state<string | null>(null);
  let loading = $state(false);
  let menuOpen = $state(false);
  let message = $state('');
  let saved = readFlyers();
  let fields = $state<FlyerFields>({ ...defaultFields(), ...saved[key] });

  const lotUrl = $derived(opa ? lotPageUrl(siteUrl, opa) : null);
  const link = $derived(ownLink(fields.ownLink));
  const hopes = $derived(hopeLines(fields));
  const caution = $derived(contactCaution(fields.contact));
  const copies = $derived(fields.size === 'half' ? [0, 1] : [0]);

  function keep() {
    saved = { ...saved, [key]: $state.snapshot(fields) };
    writeFlyers(saved);
  }

  function toggleHope(hope: Hope, on: boolean) {
    fields.hopes = on ? [...new Set([...fields.hopes, hope])] : fields.hopes.filter((h) => h !== hope);
    keep();
  }

  function clearAll() {
    if (!window.confirm(t.confirmClear)) return;
    clearFlyers();
    saved = {};
    fields = defaultFields();
    message = t.cleared;
  }

  $effect(() => {
    document.title = `${t.pageTitle}, Placekeepers`;
  });

  onMount(async () => {
    if (!opa) return;
    loading = true;
    manifest = (await loadManifest(config.dataBase)).manifest;
    const where = shardLocation(opa, manifest);
    if (where.path) {
      const result = await loadShard(config.dataBase, where.path);
      if (result.ok) address = plain(result.shard.parcels.get(opa)?.address ?? null);
    }
    loading = false;
  });
</script>

<div class="page">
  <header class="topbar screen-only">
    <a class="brand" href={config.siteBase}>{strings.app.name}</a>
    <div class="tools">
      <LanguagePicker />
      <button class="button quiet small" type="button" aria-haspopup="dialog" onclick={() => (menuOpen = true)}>{strings.nav.menu}</button>
    </div>
  </header>

  <main>
    <div class="screen-only controls">
      <LanguageOffer />
      <TranslationNote />
      <h1>{t.pageTitle}</h1>
      <p>{t.intro}</p>
      <p class="small privacy">{t.kept}</p>
      {#if !opa}<p class="notice">{t.noLot}</p>{/if}
      {#if loading}<p class="muted small" role="status">{t.loading}</p>{/if}

      <form onsubmit={(e) => e.preventDefault()} aria-label={t.pageTitle}>
        <label class="field">{t.headline}<input type="text" maxlength="80" value={fields.headline} oninput={(e) => ((fields.headline = e.currentTarget.value), keep())} /></label>
        <fieldset class="field">
          <legend>{t.hopes}</legend>
          {#each HOPES as hope (hope)}
            <label class="check"><input type="checkbox" checked={fields.hopes.includes(hope)} onchange={(e) => toggleHope(hope, e.currentTarget.checked)} /> {t.hopeOptions[hope]}</label>
          {/each}
        </fieldset>
        <label class="field">{t.ownWords}<input type="text" maxlength="200" value={fields.ownWords} oninput={(e) => ((fields.ownWords = e.currentTarget.value), keep())} /></label>
        <div class="field">
          <label for="pk-flyer-contact">{t.contact}</label>
          <p class="warning" id="pk-flyer-public" role="note">{t.publicWarning}</p>
          <textarea id="pk-flyer-contact" rows="3" maxlength="300" aria-describedby="pk-flyer-public pk-flyer-contact-help" value={fields.contact} oninput={(e) => ((fields.contact = e.currentTarget.value), keep())}></textarea>
          <span id="pk-flyer-contact-help" class="muted small">{t.contactHelp}</span>
          {#if caution}<p class="notice small" role="status">{t.publicCaution}</p>{/if}
        </div>
        <div class="field">
          <label for="pk-flyer-link">{t.ownLink}</label>
          <input id="pk-flyer-link" type="url" inputmode="url" value={fields.ownLink} placeholder="https://" aria-describedby="pk-flyer-link-help" oninput={(e) => ((fields.ownLink = e.currentTarget.value), keep())} />
          <span id="pk-flyer-link-help" class="muted small">{t.ownLinkHelp}</span>
        </div>
        {#if fields.ownLink.trim() && !link}<p class="notice small" role="status">{t.ownLinkBad}</p>{/if}
        {#if link}
          <label class="field">{t.ownLinkLabel}<input type="text" maxlength="60" placeholder={t.ownLinkLabelPlaceholder} value={fields.ownLinkLabel} oninput={(e) => ((fields.ownLinkLabel = e.currentTarget.value), keep())} /></label>
        {/if}
        <fieldset class="field">
          <legend>{t.size}</legend>
          {#each ['letter', 'half'] as const as size (size)}
            <label class="check"><input type="radio" name="pk-flyer-size" checked={fields.size === size} onchange={() => ((fields.size = size), keep())} /> {t.sizes[size]}</label>
          {/each}
        </fieldset>
      </form>

      <section class="where" aria-labelledby="pk-flyer-where">
        <h2 id="pk-flyer-where">{t.where}</h2>
        <p>{t.whereLead}</p>
        <p>{t.whereNot}</p>
        <p><a href="{config.siteBase}posting/">{t.whereLink}</a></p>
      </section>

      <div class="row">
        <button class="button primary" type="button" disabled={!opa} onclick={() => window.print()}>{t.print}</button>
        <button class="button quiet" type="button" onclick={clearAll}>{t.clear}</button>
      </div>
      <p class="small" role="status" aria-live="polite">{message}</p>
      <p class="muted small">{t.qrCredit}</p>
      <h2>{t.preview}</h2>
    </div>

    {#if opa}
      <div class="sheet size-{fields.size}" data-testid="flyer">
        {#each copies as copy (copy)}
          <article class="flyer" aria-label={copy === 0 ? t.preview : undefined} aria-hidden={copy === 1 ? 'true' : undefined}>
            <h2 class="headline">{fields.headline.trim() || t.defaultHeadline}</h2>
            <p class="address">{address ?? strings.place.parcel(opa)}</p>
            <div class="middle">
              {#if at}
                <div class="map">
                  <StaticMapView points={[{ lng: at[0], lat: at[1], label: '' }]} width={fields.size === 'half' ? 220 : 400} height={fields.size === 'half' ? 120 : 260} maxZoom={16.5} marker="pin" alt={t.mapAlt(address ?? opa)} />
                </div>
              {/if}
              {#if hopes.length}
                <div class="hopes">
                  <h3>{t.hopeTitle}</h3>
                  <ul>{#each hopes as line (line)}<li>{line}</li>{/each}</ul>
                </div>
              {/if}
            </div>
            {#if fields.contact.trim()}
              <div class="reach">
                <h3>{t.reachTitle}</h3>
                <p>{fields.contact.trim()}</p>
              </div>
            {/if}
            <div class="codes">
              {#if lotUrl}
                <figure>
                  <QrCode text={lotUrl} label={t.qrLabel(t.scanLot)} size={fields.size === 'half' ? 84 : 160} />
                  <figcaption>{t.scanLot}</figcaption>
                </figure>
              {/if}
              {#if link}
                <figure>
                  <QrCode text={link} label={t.qrLabel(fields.ownLinkLabel.trim() || t.scanOwn)} size={fields.size === 'half' ? 84 : 160} />
                  <figcaption>{fields.ownLinkLabel.trim() || t.scanOwn}</figcaption>
                </figure>
              {/if}
            </div>
            <p class="by">{t.byNeighbors}</p>
          </article>
        {/each}
      </div>
    {/if}
  </main>
</div>

<Dialog bind:open={menuOpen} title={strings.nav.menuTitle} id="pk-menu">
  <SiteNav />
</Dialog>

<style>
  .page {
    max-width: 860px;
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
  .tools {
    display: flex;
    gap: 8px;
  }
  .brand {
    font-size: 1.15rem;
    font-weight: 700;
    text-decoration: none;
    color: var(--pk-text);
  }
  h1 {
    font-size: 1.6rem;
    margin-top: 8px;
  }
  .privacy {
    padding: 6px 10px;
    border-radius: var(--pk-radius);
    background: var(--pk-surface);
  }
  form {
    display: grid;
    gap: 12px;
    margin: 12px 0;
  }
  .field {
    display: grid;
    gap: 4px;
    font-weight: 600;
    min-width: 0;
    border: 0;
    padding: 0;
    margin: 0;
  }
  .field input[type='text'],
  .field input[type='url'],
  .field textarea {
    width: 100%;
    min-height: 40px;
    padding: 6px 8px;
    border: 1px solid var(--pk-border);
    border-radius: var(--pk-radius);
    font: inherit;
    font-weight: 400;
    background: var(--pk-bg);
    color: var(--pk-text);
    box-sizing: border-box;
  }
  .field .muted {
    font-weight: 400;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 400;
    padding: 4px 0;
  }
  .check input {
    width: 20px;
    min-height: 20px;
  }
  .warning {
    margin: 0;
    padding: 6px 10px;
    border-left: 4px solid var(--pk-stale-ink, #8a4b00);
    background: var(--pk-stale-bg, #fff4e0);
    border-radius: var(--pk-radius);
    font-weight: 400;
    font-size: 0.9rem;
  }
  .where {
    margin: 12px 0;
    padding: 8px 12px;
    border: 1px solid var(--pk-surface-2);
    border-radius: var(--pk-radius);
  }
  .where h2 {
    font-size: 1.05rem;
    margin: 0 0 4px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }
  p[role='status']:empty {
    margin: 0;
  }

  /* The flyer itself: black on white, large type, the same on screen and paper. */
  .sheet {
    background: #fff;
    color: #000;
  }
  .flyer {
    padding: 24px;
    border: 1px solid #999;
    font-family: var(--pk-font, sans-serif);
    overflow-wrap: anywhere;
  }
  .size-half .flyer + .flyer {
    margin-top: 12px;
  }
  .headline {
    margin: 0 0 6px;
    font-size: 2.4rem;
    line-height: 1.1;
  }
  .address {
    margin: 0 0 12px;
    font-size: 1.5rem;
    font-weight: 700;
  }
  .middle {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
  }
  .map {
    flex: 0 1 auto;
  }
  .hopes {
    flex: 1 1 200px;
  }
  .flyer h3 {
    margin: 0 0 4px;
    font-size: 1.2rem;
  }
  .hopes ul {
    margin: 0;
    padding-left: 1.2em;
    font-size: 1.15rem;
  }
  .reach {
    margin: 12px 0;
    padding: 8px 10px;
    border: 2px solid #000;
  }
  .reach p {
    margin: 0;
    font-size: 1.3rem;
    white-space: pre-line;
  }
  .codes {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-top: 12px;
  }
  figure {
    margin: 0;
    display: flex;
    gap: 10px;
    align-items: center;
    max-width: 360px;
  }
  figure :global(.qr) {
    flex: none;
  }
  figcaption {
    font-size: 0.95rem;
  }
  .by {
    margin: 12px 0 0;
    font-size: 0.8rem;
  }
  .size-half .headline {
    font-size: 1.7rem;
  }
  .size-half .address {
    font-size: 1.15rem;
    margin-bottom: 6px;
  }
  .size-half .flyer {
    padding: 14px;
  }
  .size-half .hopes ul,
  .size-half .reach p {
    font-size: 1rem;
  }

  @media print {
    @page {
      size: letter portrait;
      margin: 0.4in;
    }
    :global(html),
    :global(body) {
      background: #fff;
    }
    .screen-only {
      display: none !important;
    }
    .page {
      max-width: none;
      padding: 0;
    }
    .flyer {
      border: 0;
      padding: 0;
    }
    .size-letter .flyer {
      display: flex;
      flex-direction: column;
      min-height: 9.9in;
    }
    .size-letter .codes {
      margin-top: auto;
    }
    .size-letter .headline {
      font-size: 44pt;
    }
    .size-letter .address {
      font-size: 26pt;
    }
    .size-letter .hopes ul {
      font-size: 17pt;
    }
    .size-letter .reach p {
      font-size: 20pt;
    }
    /* Two half pages on one sheet, with a dashed line to cut along. */
    .size-half .flyer {
      height: 4.95in;
      overflow: hidden;
      box-sizing: border-box;
      break-inside: avoid;
    }
    .size-half .headline {
      font-size: 20pt;
    }
    .size-half .reach {
      margin: 6px 0;
      padding: 4px 8px;
    }
    .size-half .codes {
      margin-top: 6px;
    }
    .size-half .by {
      margin-top: 4px;
      font-size: 7pt;
    }
    .size-half .flyer + .flyer {
      margin-top: 0.15in;
      padding-top: 0.15in;
      border-top: 1px dashed #000;
    }
  }
</style>
