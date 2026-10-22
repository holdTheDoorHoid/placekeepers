<script lang="ts">
  // The packet page (M5.1, issue #45): pick a saved list (or the places the analysis view handed
  // over), see the packet as cards, and print it on Letter paper: a cover with a map, the
  // displacement card once when any place needs it, who to contact, and one page per place
  // (src/packet/model.ts). Everything is read from our weekly copy, in this browser.
  import { onMount } from 'svelte';
  import registry from 'virtual:placekeepers/registry';
  import { config } from '../config/index.ts';
  import { loadManifest, type Manifest } from '../data/manifest.ts';
  import { buildDossier, IDLE_PARTS } from '../dossier/build.ts';
  import { parcelLensOf } from '../places/rank.ts';
  import { ListStore, type SavedList } from '../places/lists.svelte.ts';
  import { loadContacts, type ContactsState } from '../represent/contacts.ts';
  import { defaultState, type AppState } from '../state/defaults.ts';
  import { PREFS_KEY, readItem } from '../state/storage.ts';
  import { decodeState, encodeState } from '../state/url.ts';
  import { formatDate, strings } from '../strings.ts';
  import Dialog from '../components/common/Dialog.svelte';
  import SiteNav from '../components/common/SiteNav.svelte';
  import StaticMapView from '../components/print/StaticMapView.svelte';
  import RcoCard from '../components/represent/RcoCard.svelte';
  import SeatCard from '../components/represent/SeatCard.svelte';
  import { loadPacketLots, packetHash, readPacketHash, readViewHandoff, type LoadedPacket } from './load.ts';
  import { buildPacket, MAX_PACKET, type Packet } from './model.ts';

  const t = strings.packet;
  const choice = readPacketHash(window.location.hash);
  const lists = new ListStore();
  const viewList = readViewHandoff();
  const sources: SavedList[] = [...(viewList ? [viewList] : []), ...lists.lists];

  function initialState(): AppState {
    for (const text of [choice.state, readItem(PREFS_KEY)]) {
      if (!text) continue;
      const decoded = decodeState(registry, text, 'analysis');
      if (decoded.found) return decoded.state;
    }
    return defaultState(registry, 'analysis');
  }

  let appState = $state<AppState>(initialState());
  let sourceId = $state<string | null>(choice.fromView && viewList ? 'view' : (choice.list ?? (sources[0]?.id ?? null)));
  let manifest = $state.raw<Manifest | null>(null);
  let contacts = $state.raw<ContactsState>({ status: 'idle' });
  let loaded = $state.raw<LoadedPacket | null>(null);
  let progress = $state('');
  let failed = $state(false);
  let menuOpen = $state(false);
  let run = 0;

  const source = $derived(sources.find((s) => s.id === sourceId) ?? null);
  const lenses = registry.lenses.filter((l) => l.applies_to === 'parcel');
  const lots = registry.layers.find((l) => l.style === 'vacant_parcels');
  const lens = $derived(parcelLensOf(registry, appState));
  const lotPage = (opa: string) => `${config.siteBase}#p=${opa}`;
  const flyerPage = (opa: string, at: [number, number] | null) =>
    `${config.siteBase}flyer/#opa=${opa}${at ? `&at=${at[0].toFixed(6)},${at[1].toFixed(6)}` : ''}`;
  const lettersPage = (opa: string) => `${config.siteBase}letters/#${new URLSearchParams({ opa, ...(sourceId && sourceId !== 'view' ? { list: sourceId } : {}) }).toString()}`;

  const packet: Packet | null = $derived.by(() => {
    if (!loaded || !source) return null;
    const now = new Date();
    const inputs = loaded.lots.map(({ place, parcel, generatedAt }) => ({
      opa: place.id,
      parcel,
      center: place.center,
      view: buildDossier({
        opa: place.id,
        registry,
        state: appState,
        manifest,
        shard: parcel ? { status: 'found', parcel, generatedAt, notes: loaded!.notes } : { status: 'absent', reason: 'unlisted' },
        tile: parcel ? null : place.properties,
        live: IDLE_PARTS,
        liveOn: false,
        center: place.center,
        now,
        contacts,
      }),
    }));
    return buildPacket({
      title: source.name,
      lots: inputs,
      leftOut: Math.max(0, source.places.length - MAX_PACKET),
      registry,
      contacts,
      dataDate: manifest?.generated_at ?? null,
      lensLabel: lens?.label ?? null,
      now,
    });
  });

  const points = $derived(
    packet ? packet.lots.filter((lot) => lot.center).map((lot) => ({ lng: lot.center![0], lat: lot.center![1], label: String(lot.n) })) : [],
  );
  const noPoint = $derived(packet ? packet.lots.filter((lot) => !lot.center).length : 0);

  async function load() {
    const mine = ++run;
    failed = false;
    loaded = null;
    if (!source || source.places.length === 0) return;
    const places = source.places.slice(0, MAX_PACKET);
    const result = await loadPacketLots(places, {
      dataBase: config.dataBase,
      manifest,
      onProgress: (done, total) => {
        if (mine === run) progress = done < total ? t.loading(done, total) : '';
      },
    });
    if (mine !== run) return;
    failed = result.failed > 0;
    loaded = result;
  }

  function remember() {
    const state = encodeState(registry, $state.snapshot(appState), { includeMap: false, includeSelection: false, layers: 'ifChanged' });
    history.replaceState(null, '', `#${packetHash({ list: sourceId !== 'view' ? sourceId : null, fromView: sourceId === 'view', state })}`);
  }

  function pickSource(id: string) {
    sourceId = id;
    remember();
    void load();
  }

  function pickLens(id: string) {
    if (!lots) return;
    appState.settings = { ...appState.settings, [lots.id]: { ...(appState.settings[lots.id] ?? {}), lens: id } };
    remember();
  }

  $effect(() => {
    document.title = packet ? `${packet.title}: ${t.pageTitle}, Placekeepers` : `${t.pageTitle}, Placekeepers`;
  });

  onMount(async () => {
    const result = await loadManifest(config.dataBase);
    manifest = result.manifest;
    contacts = await loadContacts(config.dataBase, manifest?.files ?? null);
    await load();
  });

  function lotList(ns: number[]): string {
    return ns.join(', ');
  }
</script>

<div class="page">
  <header class="topbar screen-only">
    <a class="brand" href={config.siteBase}>{strings.app.name}</a>
    <button class="button quiet small" type="button" aria-haspopup="dialog" onclick={() => (menuOpen = true)}>{strings.nav.menu}</button>
  </header>

  <main>
    <section class="controls screen-only" aria-labelledby="pk-packet-title">
      <h1 id="pk-packet-title">{t.pageTitle}</h1>
      <p>{t.intro}</p>
      {#if sources.length === 0}
        <p class="notice">{t.noLists}</p>
        <p><a class="button" href={config.siteBase}>{t.backToMap}</a></p>
      {:else}
        <div class="choose">
          <label>
            {t.chooseList}
            <select value={sourceId ?? ''} onchange={(e) => pickSource(e.currentTarget.value)}>
              {#each sources as s (s.id)}
                <option value={s.id}>{s.id === 'view' ? t.fromView(s.name, s.places.length) : `${s.name} (${strings.lists.count(s.places.length)})`}</option>
              {/each}
            </select>
          </label>
          {#if lenses.length > 1}
            <label>
              {t.lensLabel}
              <select value={lens?.id ?? ''} onchange={(e) => pickLens(e.currentTarget.value)}>
                {#each lenses as l (l.id)}<option value={l.id}>{l.label}</option>{/each}
              </select>
            </label>
          {/if}
        </div>
        <div class="row">
          <button class="button primary" type="button" disabled={!packet} onclick={() => window.print()}>{t.print}</button>
          <a class="button quiet" href={config.siteBase}>{t.backToMap}</a>
        </div>
        <p class="muted small">{t.printHelp}</p>
        <p class="small privacy">{t.privacy}</p>
        <p class="small" role="status" aria-live="polite">{progress}</p>
        {#if failed}
          <p class="notice">{t.failed} <button class="button small quiet" type="button" onclick={() => void load()}>{t.retry}</button></p>
        {/if}
        {#if source && source.places.length === 0}<p class="notice">{t.emptyList}</p>{/if}
      {/if}
    </section>

    {#if packet}
      <article class="packet" aria-label={packet.title} data-testid="packet">
        <!-- Cover -->
        <section class="sheet cover" aria-labelledby="pk-packet-cover">
          <p class="kicker">{t.coverKicker}</p>
          <h2 id="pk-packet-cover">{packet.title}</h2>
          <p class="meta">{t.made(packet.date)}. {t.count(packet.count)}.</p>
          {#if packet.leftOut}<p class="note">{t.leftOut(packet.leftOut, MAX_PACKET)}</p>{/if}
          {#if points.length}
            <h3>{t.mapTitle}</h3>
            <StaticMapView {points} width={560} height={300} alt={t.mapAlt(points.length)} />
          {/if}
          {#if noPoint}<p class="meta">{t.noPoint(noPoint)}</p>{/if}
          <h3>{t.contentsTitle}</h3>
          <ul class="contents">
            {#each packet.contents as line (line)}<li>{line}</li>{/each}
          </ul>
          {#if packet.dataDate}<p class="meta">{t.dataFrom(packet.dataDate)}</p>{/if}
          {#if packet.lensLabel}<p class="meta">{t.lensUsed(packet.lensLabel)}</p>{/if}
          <p class="meta"><strong>{packet.notLegalAdvice}</strong></p>
        </section>

        <!-- The displacement card, once (docs/ETHICS.md, "Displacement") -->
        {#if packet.watch}
          <section class="sheet watch" aria-labelledby="pk-packet-watch">
            <h2 id="pk-packet-watch">{strings.displacement.watchTitle}</h2>
            {#each packet.watch.cautions as caution (caution)}<p class="caution"><strong>{caution}</strong></p>{/each}
            <p>{t.watchIntro}</p>
            {#each packet.watch.areas as area (area.tract + area.signs)}
              <h3>{t.watchArea(area.tract)}</h3>
              <p>{t.areaSigns(area.signs)}</p>
              <p class="meta">{t.watchLots(area.lots.map((l) => `${l.n}. ${l.title}`).join('; '))}</p>
            {/each}
            <h3>{strings.displacement.protections}</h3>
            <ul>
              {#each packet.watch.links as link (link.id)}
                <li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>: <span class="url">{link.url}</span> ({strings.displacement.checked(formatDate(link.checked) ?? link.checked)})</li>
              {/each}
            </ul>
            <p class="meta">{strings.displacement.meaning}</p>
          </section>
        {/if}

        <!-- Who to contact -->
        <section class="sheet contacts" aria-labelledby="pk-packet-contacts">
          <h2 id="pk-packet-contacts">{t.contactsTitle}</h2>
          <p class="meta">{t.contactsIntro}</p>
          {#if packet.contacts.status === 'missing'}
            <p>{t.contactsMissing}</p>
          {:else}
            {#if packet.contacts.rcos.length}
              <h3>{strings.represent.rcoTitle}</h3>
              <p class="meta">{strings.represent.rcoIntro}</p>
              <ul class="cards">
                {#each packet.contacts.rcos as g (g.key)}
                  <li><RcoCard row={g.item} extra={g.lots.length > 1 ? t.forLots(lotList(g.lots)) : t.forLot(g.lots[0]!)} /></li>
                {/each}
              </ul>
            {/if}
            {#each ['council', 'house', 'senate', 'congress'] as const as kind (kind)}
              {#if packet.contacts.seats[kind].length}
                <h3>{strings.represent.offices[kind]}</h3>
                <ul class="cards">
                  {#each packet.contacts.seats[kind] as g (g.key)}
                    <li>
                      <SeatCard row={g.item} compact />
                      <p class="meta">{g.lots.length > 1 ? t.forLots(lotList(g.lots)) : t.forLot(g.lots[0]!)}</p>
                    </li>
                  {/each}
                </ul>
              {/if}
            {/each}
            {#if packet.contacts.councilAtLarge.length}
              <h3>{strings.represent.atLargeTitle}</h3>
              <p class="meta">
                {strings.represent.atLarge}
                {packet.contacts.councilAtLarge.map((s) => `${s.name}${s.offices[0]?.phone ? ` (${s.offices[0].phone})` : ''}`).join('; ')}.
              </p>
            {/if}
            <h3>{t.wardsTitle}</h3>
            <p class="meta">{t.wardsIntro}</p>
            <table class="wards">
              <tbody>
                {#each packet.contacts.wards as w (w.n)}
                  <tr><td>{w.n}. {w.title}</td><td>{w.ward ?? strings.represent.notWorkedOut}</td></tr>
                {/each}
              </tbody>
            </table>
            {#if packet.contacts.unknown.length}<p class="meta">{t.contactsUnknown(lotList(packet.contacts.unknown))}</p>{/if}
            <p class="meta">{strings.represent.officialOnly} {strings.represent.officesMove}</p>
          {/if}
        </section>

        <!-- One page per lot -->
        {#each packet.lots as lot (lot.opa)}
          <section class="sheet lot" aria-labelledby="pk-packet-lot-{lot.n}" data-testid="packet-lot">
            <header>
              <p class="kicker">{t.lotPlace(lot.n)}</p>
              <h2 id="pk-packet-lot-{lot.n}">{lot.title}</h2>
              <p class="meta">
                {t.parcel(lot.opa)}.
                <a class="screen-only" href={lotPage(lot.opa)}>{t.lotPage}</a>
                <a class="screen-only" href={lettersPage(lot.opa)}>{t.lettersLink}</a>
                <a class="screen-only" href={flyerPage(lot.opa, lot.center)}>{strings.flyer.make}</a>
              </p>
            </header>
            {#if !lot.listed}<p class="note">{t.notListed}</p>{/if}
            {#if lot.hearing}<p class="hearing"><strong>{lot.hearing}</strong></p>{/if}

            <h3>{t.sections.vacancy}</h3>
            <p><strong>{lot.kind}</strong>{#if lot.confidence}. {lot.confidence}{/if}.</p>
            {#if lot.reasons.length}<ul>{#each lot.reasons as reason (reason)}<li>{reason}.</li>{/each}</ul>{/if}

            <h3>{t.sections.owner}</h3>
            <p>{[t.ownerType(lot.ownerType), lot.cityOwned].filter(Boolean).join(' ')}</p>
            {#each lot.flags as flag (flag.title + flag.text)}<p><strong>{flag.title}:</strong> {flag.text}</p>{/each}
            {#if lot.held}<p class="note">{lot.held}</p>{/if}
            {#if lot.deedFraud}<p class="note">{lot.deedFraud}</p>{/if}
            <p class="note">{t.noNames}</p>

            {#if lot.listing}
              <h3>{lot.listing.title}</h3>
              {#each lot.listing.lines as line (line)}<p>{line}</p>{/each}
            {/if}
            {#if lot.routes.length}
              <h3>{t.sections.permission}</h3>
              <ol>
                {#each lot.routes as route (route.label)}
                  <li>
                    {#if route.warning}<p class="warning">{route.warning}</p>{/if}
                    <p><strong>{route.label}</strong>{#if route.first}{`. ${t.firstStep}: ${route.first}`}{/if}</p>
                  </li>
                {/each}
              </ol>
            {/if}

            <h3>{t.sections.actions}</h3>
            {#if lot.noActions}<p>{lot.noActions}</p>{/if}
            {#each lot.actions as action (action.label)}
              <p><strong>{action.label}</strong> <span class="meta">({action.evidence}. {t.cost}: {action.cost})</span></p>
              {#if action.caution}<p class="note">{action.caution}</p>{/if}
              {#if action.soil}<p class="note">{action.soil}</p>{/if}
              {#if action.blessing}<p class="note">{action.blessing}</p>{/if}
            {/each}

            {#if lot.rules.length}
              <h3>{t.sections.rules}</h3>
              {#each lot.rules as line (line)}<p>{line}</p>{/each}
            {/if}

            <h3>{t.sections.represent}</h3>
            <ul class="represent">{#each lot.represent as line (line)}<li>{line}</li>{/each}</ul>
            <p class="meta">
              <strong>{t.ownerLetter}:</strong>
              {#if lot.ownerLetter.offered}{t.ownerLetterOffered}{:else}{lot.ownerLetter.text}{/if}
            </p>

            <h3>{t.sections.notChecked}</h3>
            <p class="meta">{lot.couldNotCheck}</p>
            <footer class="meta">{packet.title}. {t.lotPlace(lot.n)}. {packet.notLegalAdvice}</footer>
          </section>
        {/each}
      </article>
    {/if}
  </main>
</div>

<Dialog bind:open={menuOpen} title={strings.nav.menuTitle} id="pk-menu">
  <SiteNav />
</Dialog>

<style>
  .page {
    max-width: 900px;
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
  h1 {
    font-size: 1.6rem;
    margin-top: 8px;
  }
  .choose {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
    margin: 16px 0;
  }
  .choose label {
    display: grid;
    gap: 4px;
    font-weight: 600;
    flex: 1 1 260px;
    max-width: 100%;
  }
  .choose select {
    width: 100%;
    min-height: 40px;
    font: inherit;
    font-weight: 400;
    padding: 6px 8px;
    border: 1px solid var(--pk-border);
    border-radius: var(--pk-radius);
    background: var(--pk-bg);
    color: var(--pk-text);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .privacy {
    padding: 6px 10px;
    border-radius: var(--pk-radius);
    background: var(--pk-surface);
  }
  p[role='status']:empty {
    margin: 0;
  }
</style>
