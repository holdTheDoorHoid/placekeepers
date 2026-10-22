<script lang="ts">
  // The letters page (M5.1, issue #45): four low stakes letters, filled in and printed here. Every
  // letter says at the top that a lawyer has not reviewed it and that it is not legal advice, with
  // a link to Grounded in Philly for legal help (owner, 2026-10-21). The letter to an owner is
  // offered only where docs/ETHICS.md lets the flags about the owner show (src/letters/gate.ts),
  // one lot at a time. What is typed stays in this browser (src/letters/storage.ts); the address
  // bar carries only the lot and the letter chosen, and nothing is ever sent.
  import { onMount } from 'svelte';
  import { config } from '../config/index.ts';
  import { GROUNDED_LEGAL_HELP_URL } from '../config/links.ts';
  import { loadManifest, type Manifest } from '../data/manifest.ts';
  import { isOpaAccount } from '../dossier/opa.ts';
  import { plain } from '../dossier/plain.ts';
  import { loadShard, shardLocation } from '../dossier/shard.ts';
  import type { ShardParcel } from '../dossier/types.ts';
  import { ListStore } from '../places/lists.svelte.ts';
  import { loadContacts, rcoRows, type ContactsState } from '../represent/contacts.ts';
  import { englishStrings } from '../i18n/english.ts';
  import { languageOf, type LanguageCode } from '../i18n/languages.ts';
  import { currentLanguage, currentLocale, withLocale } from '../i18n/locale.ts';
  import { formatDate, labelledParts, strings } from '../strings.ts';
  import Dialog from '../components/common/Dialog.svelte';
  import SiteNav from '../components/common/SiteNav.svelte';
  import LanguageOffer from '../components/language/LanguageOffer.svelte';
  import LanguagePicker from '../components/language/LanguagePicker.svelte';
  import TranslationNote from '../components/language/TranslationNote.svelte';
  import { ownerAddressee, ownerLetterGate } from './gate.ts';
  import LetterBody from './LetterBody.svelte';
  import { draftKey, LetterDrafts } from './storage.ts';
  import { buildLetter, EMPTY_FIELDS, isTemplate, TEMPLATES, type LetterFields, type LetterText, type TemplateId } from './templates.ts';

  const l = strings.letters;
  const f = l.fields;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const listId = params.get('list');
  const list = listId ? (new ListStore().lists.find((x) => x.id === listId) ?? null) : null;

  let opa = $state<string | null>(isOpaAccount(params.get('opa')) ? params.get('opa') : (list?.places[0]?.id ?? null));
  let template = $state<TemplateId>(isTemplate(params.get('t')) ? (params.get('t') as TemplateId) : 'council');
  let manifest = $state.raw<Manifest | null>(null);
  let contacts = $state.raw<ContactsState>({ status: 'idle' });
  let parcel = $state.raw<ShardParcel | null>(null);
  let generatedAt = $state<string | null>(null);
  let loading = $state(false);
  let menuOpen = $state(false);
  let message = $state('');
  const drafts = new LetterDrafts();
  let version = $state(0);
  let rcoChoice = $state<string | null>(null);
  /**
   * The language the letter prints in: English by default, since the people it goes to mostly
   * read English, or the page's own language when the sender chooses it (orchestrator, 2026-10-22).
   */
  const pageCode = currentLocale();
  let letterCode = $state<LanguageCode>('en');
  const textOf = (code: LanguageCode): LetterText => (code === pageCode ? strings : englishStrings());

  const gate = $derived(ownerLetterGate(parcel));
  const key = $derived(draftKey(template, opa));
  const table = $derived(contacts.status === 'ready' ? contacts.table : null);
  const seat = $derived(parcel?.represent?.council && table ? (table.seats.council.get(parcel.represent.council) ?? null) : null);
  const rcos = $derived(parcel?.represent && table ? rcoRows(parcel.represent, table).rows.map((r) => r.rco) : []);
  const rco = $derived(rcos.find((r) => r.id === rcoChoice) ?? rcos[0] ?? null);
  const lotTitle = $derived(plain(parcel?.address ?? null) ?? list?.places.find((p) => p.id === opa)?.address ?? null);

  /** What the City's records fill in for this letter, before anything is typed, in a letter's language. */
  function prefillIn(code: LanguageCode): Partial<LetterFields> {
    const lot = lotTitle ?? '';
    if (template === 'owner') {
      const to = ownerAddressee(parcel, plain, textOf(code).join.names);
      return { lotAddress: lot, recipientName: to.name, recipientAddress: to.address };
    }
    if (template === 'rco') return { lotAddress: lot, recipientName: rco?.name ?? '', recipientAddress: rco?.address ?? '' };
    return { lotAddress: lot, recipientName: seat?.name ?? '', recipientAddress: seat?.offices[0]?.address ?? '' };
  }

  /** The fields as a letter in this language uses them: what was typed, as typed, over what is filled in. */
  function valuesIn(code: LanguageCode): LetterFields {
    void version;
    const today = withLocale(code, () => formatDate(new Date().toISOString())) ?? '';
    return { ...EMPTY_FIELDS, date: today, ...prefillIn(code), ...drafts.get(key) };
  }

  /** The letter in a language, with that language's words, numbers and dates. */
  function letterIn(code: LanguageCode) {
    return withLocale(code, () => buildLetter(template, valuesIn(code), textOf(code)));
  }

  // The form shows what fills the printed letter.
  const values = $derived(valuesIn(letterCode));
  const letter = $derived(letterIn(letterCode));
  /** On screen only, beside an English letter on a page in another language: what it says, in the sender's language. */
  const translation = $derived(letterCode !== pageCode ? letterIn(pageCode) : null);
  /** The note at the top of the printed letter, in the letter's language. */
  const note = $derived.by(() => {
    const words = textOf(letterCode);
    return { words: words.letters, label: labelledParts(words.letters.senderNote, words.join), help: words.join.labelled(words.letters.legalHelpShort, GROUNDED_LEGAL_HELP_URL) };
  });
  const letterLanguage = $derived(languageOf(letterCode));
  const offered = $derived(template !== 'owner' || gate.offered);
  const prefilled = $derived(
    (template === 'owner' ? !!parcel?.owner : template === 'rco' ? !!rco : !!seat) && generatedAt ? l.prefilledFrom(l.cityRecords, formatDate(generatedAt) ?? '') : null,
  );

  function set(field: keyof LetterFields, value: string | string[]) {
    drafts.set(key, field, value);
    version += 1;
  }

  function togglePlan(id: string, on: boolean) {
    const plans = new Set(values.plans);
    if (on) plans.add(id);
    else plans.delete(id);
    set('plans', [...plans]);
  }

  function pickRco(id: string) {
    rcoChoice = id;
    const chosen = rcos.find((r) => r.id === id);
    if (!chosen) return;
    set('recipientName', chosen.name);
    set('recipientAddress', chosen.address ?? '');
  }

  function clearAll() {
    if (!window.confirm(l.confirmClear)) return;
    drafts.clear();
    version += 1;
    message = l.cleared;
  }

  function remember() {
    const next = new URLSearchParams();
    if (opa) next.set('opa', opa);
    if (listId) next.set('list', listId);
    next.set('t', template);
    history.replaceState(null, '', `#${next.toString()}`);
  }

  async function loadLot() {
    parcel = null;
    generatedAt = null;
    if (!opa) return;
    loading = true;
    const where = shardLocation(opa, manifest);
    if (where.path) {
      const result = await loadShard(config.dataBase, where.path);
      if (result.ok) {
        parcel = result.shard.parcels.get(opa) ?? null;
        generatedAt = result.shard.generatedAt;
      }
    }
    loading = false;
  }

  function pickLot(id: string) {
    opa = id;
    remember();
    void loadLot();
  }

  function pickTemplate(id: TemplateId) {
    template = id;
    remember();
  }

  $effect(() => {
    document.title = `${l.pageTitle}, Placekeepers`;
  });

  onMount(async () => {
    manifest = (await loadManifest(config.dataBase)).manifest;
    contacts = await loadContacts(config.dataBase, manifest?.files ?? null);
    await loadLot();
    remember();
  });

  const id = (name: string) => `pk-letter-${name}`;
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
    <div class="screen-only">
      <LanguageOffer />
      <TranslationNote />
      <h1>{l.pageTitle}</h1>
      <p class="unreviewed" role="note">
        <strong>{l.unreviewed}</strong>
        {#if true}{@const help = labelledParts(l.legalHelp)}{help.label}{help.gap}<a href={GROUNDED_LEGAL_HELP_URL} target="_blank" rel="noopener noreferrer">{GROUNDED_LEGAL_HELP_URL}</a>{help.after}{/if}
      </p>
      <p>{l.intro}</p>
      <p class="small privacy">{drafts.persistent ? l.kept : l.notKept}</p>

      {#if list && list.places.length > 1}
        <label class="field">
          {l.chooseLot}
          <select value={opa ?? ''} onchange={(e) => pickLot(e.currentTarget.value)}>
            {#each list.places as place (place.id)}<option value={place.id}>{place.address ?? strings.place.parcel(place.id)}</option>{/each}
          </select>
        </label>
      {/if}
      {#if lotTitle}<p><strong>{l.forLot(lotTitle)}</strong></p>{:else if !opa}<p class="muted small">{l.noLot}</p>{/if}
      {#if loading}<p class="muted small" role="status">{l.loading}</p>{/if}

      <fieldset class="templates">
        <legend>{l.chooseTemplate}</legend>
        {#each TEMPLATES as t (t)}
          <label class="choice">
            <input type="radio" name="pk-letter-template" value={t} checked={template === t} onchange={() => pickTemplate(t)} />
            <span>
              <strong>{l.templates[t]}</strong>
              <span class="muted small">{l.templateHelp[t]}</span>
            </span>
          </label>
        {/each}
      </fieldset>

      {#if !offered && !gate.offered}
        <div class="notice" role="status" data-testid="owner-letter-not-offered">
          <p><strong>{l.notOffered}.</strong> {gate.text}</p>
        </div>
      {:else}
        <form class="fields" onsubmit={(e) => e.preventDefault()} aria-label={l.templates[template]}>
          {#if prefilled}<p class="muted small">{prefilled}</p>{/if}
          {#if template === 'owner' && ownerAddressee(parcel, plain).nameLeftOut}<p class="muted small">{l.nameLeftOut}</p>{/if}
          <div class="grid">
            <label class="field">{f.senderName}<input id={id('sender')} type="text" autocomplete="name" value={values.senderName} oninput={(e) => set('senderName', e.currentTarget.value)} /></label>
            <label class="field">{f.group}<input type="text" value={values.group} oninput={(e) => set('group', e.currentTarget.value)} /></label>
            <div class="field wide">
              <label for={id('contact')}>{f.contact}</label>
              <input id={id('contact')} type="text" value={values.contact} aria-describedby={id('contact-help')} oninput={(e) => set('contact', e.currentTarget.value)} />
              <span id={id('contact-help')} class="muted small">{f.contactHelp}</span>
            </div>
            <label class="field">{f.date}<input type="text" value={values.date} oninput={(e) => set('date', e.currentTarget.value)} /></label>
            {#if template === 'rco' && rcos.length > 1}
              <label class="field">
                {strings.represent.rcoTitle}
                <select value={rco?.id ?? ''} onchange={(e) => pickRco(e.currentTarget.value)}>
                  {#each rcos as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
                </select>
              </label>
            {/if}
            <label class="field">
              {template === 'owner' ? f.ownerName : f.recipientName}
              <input type="text" value={values.recipientName} oninput={(e) => set('recipientName', e.currentTarget.value)} />
            </label>
            <label class="field wide">
              {template === 'owner' ? f.ownerAddress : f.recipientAddress}
              <textarea rows="2" value={values.recipientAddress} oninput={(e) => set('recipientAddress', e.currentTarget.value)}></textarea>
            </label>
            <label class="field wide">{f.lotAddress}<input type="text" value={values.lotAddress} oninput={(e) => set('lotAddress', e.currentTarget.value)} /></label>

            {#if template === 'owner'}
              <fieldset class="field wide">
                <legend>{f.plans}</legend>
                {#each Object.entries(f.planOptions) as [plan, label] (plan)}
                  <label class="check"><input type="checkbox" checked={values.plans.includes(plan)} onchange={(e) => togglePlan(plan, e.currentTarget.checked)} /> {label}</label>
                {/each}
              </fieldset>
              <label class="field">{f.duration}<input type="text" placeholder={f.durationPlaceholder} value={values.duration} oninput={(e) => set('duration', e.currentTarget.value)} /></label>
            {:else if template === 'council'}
              <fieldset class="field wide">
                <legend>{f.ask}</legend>
                {#each Object.entries(f.askOptions) as [ask, label] (ask)}
                  <label class="check"><input type="radio" name="pk-letter-ask" checked={values.ask === ask} onchange={() => set('ask', ask)} /> {label}</label>
                {/each}
              </fieldset>
            {:else if template === 'rco'}
              <label class="field wide">{f.project}<input type="text" placeholder={f.projectPlaceholder} value={values.project} oninput={(e) => set('project', e.currentTarget.value)} /></label>
            {:else}
              <label class="field">{f.requestNumber}<input type="text" inputmode="numeric" value={values.requestNumber} oninput={(e) => set('requestNumber', e.currentTarget.value)} /></label>
              <label class="field">{f.reportedOn}<input type="text" value={values.reportedOn} oninput={(e) => set('reportedOn', e.currentTarget.value)} /></label>
              <label class="field">
                {f.problem}
                <select value={values.problem} onchange={(e) => set('problem', e.currentTarget.value)}>
                  {#each Object.entries(f.problemOptions) as [problem, label] (problem)}<option value={problem}>{label}</option>{/each}
                </select>
              </label>
              {#if values.problem === 'other'}
                <label class="field">{f.problemOther}<input type="text" value={values.problemOther} oninput={(e) => set('problemOther', e.currentTarget.value)} /></label>
              {/if}
            {/if}
            <label class="field wide">{f.extra}<textarea rows="3" value={values.extra} oninput={(e) => set('extra', e.currentTarget.value)}></textarea></label>
          </div>
        </form>
      {/if}
      {#if offered && pageCode !== 'en'}
        <fieldset class="field language" data-testid="letter-language">
          <legend>{l.language}</legend>
          <p class="muted small">{l.languageHelp}</p>
          {#each ['en', pageCode] as const as code (code)}
            <label class="check">
              <input type="radio" name="pk-letter-language" value={code} checked={letterCode === code} onchange={() => (letterCode = code)} />
              <span lang={code} dir={languageOf(code).dir}>{languageOf(code).name}</span>
            </label>
          {/each}
        </fieldset>
      {/if}
      <div class="row">
        {#if offered}<button class="button primary" type="button" onclick={() => window.print()}>{l.print}</button>{/if}
        <button class="button quiet" type="button" onclick={clearAll}>{l.clear}</button>
      </div>
      <p class="small" role="status" aria-live="polite">{message}</p>
      {#if offered}<h2 class="preview-title">{l.preview}</h2>{/if}
    </div>

    {#if offered}
      <article class="letter-sheet" aria-label={l.preview} data-testid="letter">
        <div lang={letterCode} dir={letterLanguage.dir}>
          <aside class="sender-note">
            <strong>{note.label.label}</strong>{note.label.gap}{note.words.unreviewed} {note.help}{note.label.after}
            <!-- A letter in a language not yet checked by a native speaker says so, in that language. -->
            {#if letterCode !== 'en' && !currentLanguage().reviewed}<br />{strings.language.aiNote}{/if}
          </aside>
          <LetterBody {letter} />
        </div>
      </article>
      {#if translation}
        <section class="translation screen-only" aria-labelledby="pk-letter-translation" data-testid="letter-translation">
          <h2 id="pk-letter-translation" class="preview-title">{l.translationTitle}</h2>
          <p class="muted small">{l.translationNote}</p>
          <div class="letter-sheet">
            <LetterBody letter={translation} />
          </div>
        </section>
      {/if}
    {/if}
  </main>
</div>

<Dialog bind:open={menuOpen} title={strings.nav.menuTitle} id="pk-menu">
  <SiteNav />
</Dialog>

<style>
  .page {
    max-width: 820px;
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
  .unreviewed {
    padding: 8px 10px;
    border-left: 4px solid var(--pk-accent);
    background: var(--pk-accent-soft);
    border-radius: var(--pk-radius);
    overflow-wrap: anywhere;
  }
  .privacy {
    padding: 6px 10px;
    border-radius: var(--pk-radius);
    background: var(--pk-surface);
  }
  .templates {
    margin: 12px 0;
    padding: 8px 12px;
    border: 1px solid var(--pk-surface-2);
    border-radius: var(--pk-radius);
  }
  .templates legend {
    font-weight: 600;
  }
  .choice {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 6px 0;
  }
  .choice span {
    display: grid;
    gap: 2px;
  }
  .choice input {
    margin-top: 4px;
    min-width: 20px;
    min-height: 20px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px 14px;
  }
  .field {
    display: grid;
    gap: 4px;
    font-weight: 600;
    min-width: 0;
  }
  .field.wide {
    grid-column: 1 / -1;
  }
  fieldset.field {
    border: 0;
    padding: 0;
    margin: 0;
  }
  .field input,
  .field textarea,
  .field select {
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
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }
  .preview-title {
    margin-top: 16px;
    font-size: 1.1rem;
  }
  .letter-sheet {
    padding: 24px;
    border: 1px solid var(--pk-surface-2);
    border-radius: var(--pk-radius);
    background: #fff;
    color: #000;
    font: 11pt/1.45 Georgia, 'Times New Roman', serif;
    overflow-wrap: anywhere;
  }
  .letter-sheet :global(p) {
    margin: 0 0 10px;
  }
  .sender-note {
    margin: 0 0 16px;
    padding: 6px 8px;
    border: 1px solid #555;
    font: 8.5pt/1.3 var(--pk-font, sans-serif);
  }
  .letter-sheet :global(.date),
  .letter-sheet :global(.to) {
    margin-bottom: 16px;
  }
  .letter-sheet :global(.closing) {
    margin-top: 16px;
  }
  .language {
    margin: 12px 0 0;
  }
  p[role='status']:empty {
    margin: 0;
  }
  @media print {
    @page {
      size: letter portrait;
      margin: 0.75in;
    }
    .screen-only {
      display: none !important;
    }
    .page {
      max-width: none;
      padding: 0;
    }
    .letter-sheet {
      padding: 0;
      border: 0;
      border-radius: 0;
    }
  }
</style>
