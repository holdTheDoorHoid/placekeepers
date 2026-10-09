<script lang="ts">
  // What the map says about the SEPTA stops someone tapped: in the analysis view's details panel
  // and in the panel over the map in the field view. Subway platforms in both directions often
  // stand at one spot, so every stop under the finger is listed. A bus or trolley stop shows its
  // priority under the transit comfort lens, what riders find there (from OpenStreetMap, with "not
  // yet surveyed" where no one has recorded it, never "no"), what neighbors can do with the first
  // lawful step and the route's contacts, the "why" behind the score, then its service and riders.
  // What OpenStreetMap says is joined here from its own file (decision D1, src/transit/answers.ts).
  // A trolley tunnel station is shown like a station: the lens leaves it out.
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import { describeComfort, outsideLens, tunnelStation } from '../../transit/comfort.ts';
  import { describeStop } from '../../transit/describe.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';
  import DisplacementNote from '../places/DisplacementNote.svelte';
  import { watchNote, watchSigns } from '../../displacement/watch.ts';
  import RouteDetails from '../dossier/RouteDetails.svelte';
  import WhyBreakdown from '../lens/WhyBreakdown.svelte';

  let { store, features, guide }: { store: AppStore; features: Record<string, unknown>[]; guide?: string } = $props();
  const t = strings.transit;
  const s = strings.stopAmenities;
  // The site root from the build (not config, so the details also render outside a browser).
  const siteBase = import.meta.env.BASE_URL;
  const views = $derived(
    features.slice(0, 6).map((properties) => ({
      id: String(properties.id ?? ''),
      stop: describeStop(properties),
      comfort: outsideLens(properties) ? null : describeComfort(store.registry, store.state, properties, store.stopTable),
      tunnel: tunnelStation(properties),
      // A link to OpenStreetMap whose answers have not arrived (or could not be loaded).
      waiting: typeof properties.o === 'string' && store.stopTableStatus !== 'ok',
      // The displacement watch area the stop lies in (`dw`, M4.1), for its shade trees.
      watch: watchNote(store.registry, watchSigns(properties)),
    })),
  );
  const anyComfort = $derived(views.some((v) => v.comfort !== null));
</script>

{#if features.length > 1}<p class="muted small">{t.stopsHere(features.length)}</p>{/if}
{#each views as view, i (i)}
  {@const comfort = view.comfort}
  <section class="stop" data-stop={view.id}>
    <h3>{view.stop.title}</h3>
    <p class="small">{view.stop.kind}.{#if view.stop.routes}{' '}{view.stop.routes}{/if}</p>
    {#if comfort?.lens}
      {#if comfort.score !== null}
        <p class="score">
          <strong>{strings.place.priority(comfort.score, comfort.lens.label)}.</strong>
          {#if comfort.main}{strings.place.mainReason(comfort.main.label)} <EvidenceBadge level={comfort.main.evidence} />{/if}
        </p>
      {:else if comfort.why?.allOff}
        <p class="muted small">{strings.lens.allOffFor('stop')}</p>
      {/if}
    {/if}

    {#if view.tunnel}<p class="muted small">{t.tunnelStation}</p>{/if}
    {#if comfort}
      <h4>{t.findTitle}</h4>
      <p data-city-shelter>{comfort.cityShelter}</p>
      {#if comfort.disagree}<p class="disagree" role="note">{comfort.disagree}</p>{/if}
      {#if view.waiting}
        <p class="muted" role="status">{store.stopTableStatus === 'unavailable' ? t.answersUnavailable : t.answersLoading}</p>
      {:else}
        {#if comfort.inOsm}<p class="small muted">{s.factsTitle}</p>{/if}
        <p>{comfort.summary}</p>
        <ul class="facts">
          {#each comfort.answers as answer (answer.key)}
            <li class:unknown={!answer.known}>{answer.label}: {answer.value}</li>
          {/each}
        </ul>
        {#if comfort.anyUnknown}<p class="muted small">{s.unknownNote}</p>{/if}
      {/if}
      {#if comfort.lamps}<p class="small">{comfort.lamps}</p>{/if}
      {#if comfort.facts.length}
        <ul class="facts">
          {#each comfort.facts as fact (fact)}<li>{fact}</li>{/each}
        </ul>
      {/if}

      {#if comfort.suggestions.length}
        <h4>{t.canDo}</h4>
        <ul class="suggestions">
          {#each comfort.suggestions as item (item.suggestion.id)}
            <li data-suggestion={item.suggestion.id}>
              <strong>{item.suggestion.label}</strong>
              <EvidenceBadge level={item.suggestion.evidence} />
              <p class="small">{item.suggestion.summary}</p>
              <p class="small">{strings.streets.cost(item.suggestion.cost)}</p>
              <DisplacementNote suggestionId={item.suggestion.id} watch={view.watch} />
              {#if item.firstStep}
                <p class="small"><strong>{strings.streets.firstStep}:</strong> {item.firstStep.step} <span class="muted">({item.firstStep.route.label})</span></p>
              {/if}
              {#if item.routes.length || item.partners.length}
                <details>
                  <summary>{t.routeDetails}</summary>
                  {#each item.routes as route (route.route.id)}<RouteDetails view={route} level={5} />{/each}
                  {#if item.partners.length}
                    <p class="small muted">{strings.dossier.actions.partners}</p>
                    <ul class="partners">
                      {#each item.partners as partner (partner.id)}
                        <li class="small"><a href={partner.url} target="_blank" rel="noopener noreferrer">{partner.name}</a>: {partner.one_line}</li>
                      {/each}
                    </ul>
                  {/if}
                </details>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      {#if comfort.why && comfort.lens && !comfort.why.allOff}
        <WhyBreakdown
          why={comfort.why}
          idPrefix="stop-{i}"
          level={4}
          appliesTo="stop"
          valueNotes={Object.fromEntries(comfort.unsurveyed.map((id) => [id, s.unknown.toLowerCase()]))}
        />
        {#if comfort.halfway}<p class="muted small">{t.halfway}</p>{/if}
      {/if}
    {/if}

    <h4>{t.howOften}</h4>
    <ul>
      {#each view.stop.often as line (line)}<li>{line}</li>{/each}
    </ul>
    <h4>{t.riders}</h4>
    <ul>
      {#each view.stop.riders as line (line)}<li>{line}</li>{/each}
    </ul>
    {#if view.stop.details.length}
      <p class="small muted">{view.stop.details.join(' ')}</p>
    {/if}
    {#if comfort}
      {#if comfort.matched}<p class="small muted">{comfort.matched}</p>{/if}
      {#if guide}<p class="small"><a href="{siteBase}{guide}/">{t.surveyGuide}</a></p>{/if}
      {#if comfort.osmUrl}
        <p class="small"><a href={comfort.osmUrl} target="_blank" rel="noopener noreferrer">{s.openOsm}</a></p>
      {/if}
    {/if}
  </section>
{/each}
<p class="muted small">{t.source}</p>
{#if anyComfort}<p class="muted small">{t.osmSource} {strings.streetsStops.shelterSource}</p>{/if}

<style>
  .stop {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  h3 {
    margin-bottom: 2px;
  }
  h4 {
    margin: 8px 0 2px;
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  p {
    margin: 2px 0;
  }
  .unknown {
    color: var(--pk-muted);
  }
  .disagree {
    border-left: 3px solid var(--pk-surface-2);
    padding-left: 6px;
  }
  .suggestions li {
    margin-bottom: 8px;
  }
  details {
    margin-top: 4px;
    font-size: 0.875rem;
  }
  .partners {
    padding-left: 18px;
  }
</style>
