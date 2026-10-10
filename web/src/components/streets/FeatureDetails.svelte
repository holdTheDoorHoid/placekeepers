<script lang="ts">
  // What the map shows about a memorial, a crash, a street block or a stop someone tapped: in
  // the analysis view's details panel, and in a panel over the map in the field view. Memorials are
  // quiet: the name only from a public memorial list and only while "show names" is on, the
  // date, how the person was traveling, the place, the public memorial page, "request removal",
  // and the family's blessing beside every memorial suggestion (docs/ETHICS.md).
  import { REMOVAL_EMAIL } from '../../content/removal-email.ts';
  import type { InspectTarget } from '../../map/controller.ts';
  import { STYLES, styleFor } from '../../map/styles/index.ts';
  import { showNames } from '../../map/styles/memorials.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { describeCrash, describeMemorial, describeSegment, suggestionViews } from '../../streets/describe.ts';
  import { strings } from '../../strings.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';
  import WhyBreakdown from '../lens/WhyBreakdown.svelte';
  import BlessingNote from './BlessingNote.svelte';
  import TransitStopDetails from '../transit/TransitStopDetails.svelte';
  import StopAmenityDetails from '../transit/StopAmenityDetails.svelte';
  import TreeDetails from '../heat/TreeDetails.svelte';
  import ArtDetails from '../art/ArtDetails.svelte';
  import RouteDetails from '../transit/RouteDetails.svelte';
  import AmenityDetails from '../amenities/AmenityDetails.svelte';
  import ConditionDetails from '../amenities/ConditionDetails.svelte';
  import PlaceDetails from '../amenities/PlaceDetails.svelte';
  import StressDetails from '../walk/StressDetails.svelte';
  import ParkingDetails from './ParkingDetails.svelte';
  import StreetStopDetails from './StreetStopDetails.svelte';
  import { blockCalming, blockPolesLine, memorialCalmingLine } from '../../streets/streets-stops.ts';
  import WatchDetails from '../displacement/WatchDetails.svelte';
  import RulesDetails from '../rules/RulesDetails.svelte';
  import RedliningDetails from '../history/RedliningDetails.svelte';
  import { watchSummaryOf } from '../../displacement/watch.ts';
  import { sitePlace } from '../../amenities/describe.ts';
  import { COOLING_LAYER } from '../../map/styles/public_place.ts';

  let {
    store,
    target,
    heading,
    onClose,
  }: { store: AppStore; target: InspectTarget; heading?: string; onClose?: () => void } = $props();

  const layer = $derived(store.registry.layers.find((l) => l.id === target.layerId));
  const style = $derived(layer ? styleFor(layer) : null);
  const names = $derived(layer ? showNames({ layer, registry: store.registry, state: store.state }) : true);
  const first = $derived(target.features[0] ?? {});
  const views = $derived(style === STYLES.memorials ? suggestionViews(store.registry, store.state, first) : []);
  const segment = $derived(style === STYLES.street_segments ? describeSegment(store.registry, store.state, first) : null);
  // Streets and stops (M4.5): the poles and traffic calming the City lists on a block, and the
  // request for traffic calming where it may apply.
  const blockViews = $derived(segment ? suggestionViews(store.registry, store.state, first) : []);
  const poles = $derived(segment ? blockPolesLine(first) : null);
  const calming = $derived(segment ? blockCalming(first) : null);
  const memorialCalming = $derived(style === STYLES.memorials ? memorialCalmingLine(first) : null);
  // "No traffic calming recorded here yet" stands beside the request when the block offers it, so
  // it is not repeated among the facts.
  const asksCalming = $derived(blockViews.some((v) => v.suggestion.id === 'traffic_calming_petition'));
  // The site root from the build (not config, so the details also render outside a browser).
  const links = { removalEmail: REMOVAL_EMAIL, contactUrl: `${import.meta.env.BASE_URL}contact/` };
  const s = strings.streets;
</script>

<section class="pk-feature" aria-label={s.popupLabel}>
  {#if heading}<h2>{heading}</h2>{/if}
  {#if style === STYLES.memorials}
    {#if target.features.length > 1}<p class="muted small">{s.peopleHere(target.features.length)}</p>{/if}
    {#each target.features as properties, i (i)}
      {@const memorial = describeMemorial(properties, names, links)}
      <section class="memorial">
        <h3>{memorial.name ?? s.memorialTitle}</h3>
        <p>{memorial.sentence}</p>
        {#if memorial.place}<p>{memorial.place}</p>{/if}
        {#if memorial.source}
          <p><a href={memorial.source} target="_blank" rel="noopener noreferrer">{s.memorialSource}</a></p>
        {/if}
        <p class="small">
          <a href={memorial.removalHref}>{s.removal}</a>
          <span class="muted">{s.removalNote(REMOVAL_EMAIL !== null)}</span>
        </p>
      </section>
    {/each}
    {#if views.length}
      <h4>{s.canDo}</h4>
      <ul class="suggestions">
        {#each views as view (view.suggestion.id)}
          <li>
            <strong>{view.suggestion.label}</strong>
            <EvidenceBadge level={view.suggestion.evidence} />
            <BlessingNote suggestionId={view.suggestion.id} />
            {#if view.suggestion.id === 'traffic_calming_petition' && memorialCalming}<p class="small">{memorialCalming}</p>{/if}
            <p class="small">{view.suggestion.summary}</p>
            <p class="small">{s.cost(view.suggestion.cost)}</p>
            {#if view.firstStep}
              <p class="small"><strong>{s.firstStep}:</strong> {view.firstStep.step} <span class="muted">({view.firstStep.route.label})</span></p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {:else if style === STYLES.crashes}
    {#if target.features.length > 1}<h3>{s.crashesHere(target.features.length)}</h3>{/if}
    <ul class="crashes">
      {#each target.features.slice(0, 6) as properties, i (i)}
        {@const crash = describeCrash(properties)}
        <li>
          <strong>{s.crashTitle(crash.year)}</strong>
          <span>{crash.severity}.</span>
          <span class="small">{s.involved}: {crash.involved}.</span>
        </li>
      {/each}
    </ul>
    <p class="muted small">{s.crashSource}</p>
  {:else if segment}
    <h3>{segment.name}</h3>
    {#if segment.lens && segment.score !== null}
      <p>{s.segmentScore(segment.score, segment.lens.label)}</p>
    {:else}
      <p class="muted">{s.segmentNoScore}</p>
    {/if}
    <ul class="facts">
      {#each segment.facts as fact (fact)}<li>{fact}</li>{/each}
      {#if calming && !asksCalming}<li>{calming.line}</li>{/if}
      {#if poles}<li>{poles}</li>{/if}
    </ul>
    {#if calming?.arterial}<p class="small">{calming.arterial}</p>{/if}
    {#if blockViews.length}
      <h4>{s.canDo}</h4>
      <ul class="suggestions">
        {#each blockViews as view (view.suggestion.id)}
          <li>
            <strong>{view.suggestion.label}</strong>
            <EvidenceBadge level={view.suggestion.evidence} />
            {#if calming && view.suggestion.id === 'traffic_calming_petition'}<p class="small">{calming.line}</p>{/if}
            <p class="small">{view.suggestion.summary}</p>
            <p class="small">{s.cost(view.suggestion.cost)}</p>
            {#if view.firstStep}
              <p class="small"><strong>{s.firstStep}:</strong> {view.firstStep.step} <span class="muted">({view.firstStep.route.label})</span></p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    {#if segment.why}<WhyBreakdown why={segment.why} idPrefix="feature" appliesTo="segment" />{/if}
  {:else if style === STYLES.transit_stops}
    <TransitStopDetails {store} features={target.features} guide={layer?.guide} />
  {:else if style === STYLES.stop_amenities}
    {#each target.features.slice(0, 4) as properties, i (i)}
      <StopAmenityDetails {properties} guide={layer?.guide} />
    {/each}
  {:else if style === STYLES.transit_routes}
    <RouteDetails features={target.features} />
  {:else if style === STYLES.city_trees}
    <TreeDetails features={target.features} />
  {:else if style === STYLES.amenity}
    {#each target.features.slice(0, 4) as properties, i (i)}
      <AmenityDetails layerId={target.layerId} {properties} guide={layer?.guide} />
    {/each}
  {:else if style === STYLES.public_place}
    {#each target.features.slice(0, 4) as properties, i (i)}
      {@const place = target.layerId === COOLING_LAYER ? sitePlace(properties) : null}
      <PlaceDetails layerId={target.layerId} {properties} manifest={store.manifest} />
      {#if place && store.state.layers.includes(place.layerId)}
        <!-- One place, one marker (M4.7): the library or recreation center this site is, whose own
             marker the site's marker stands for while both layers are on. -->
        {#each (store.controller?.featuresWith(place.layerId, 'id', place.id) ?? []).slice(0, 1) as related, j (j)}
          <PlaceDetails layerId={place.layerId} properties={related} />
        {/each}
      {/if}
    {/each}
  {:else if style === STYLES.condition}
    {#each target.features.slice(0, 4) as properties, i (i)}
      <ConditionDetails layerId={target.layerId} {properties} route={store.registry.routes.find((r) => r.id === 'report_to_311')} />
    {/each}
  {:else if style === STYLES.displacement_watch}
    <WatchDetails features={target.features} summary={watchSummaryOf(store.manifest)} registry={store.registry} />
  {:else if style === STYLES.public_art}
    <ArtDetails
      features={target.features}
      lngLat={target.lngLat}
      registry={store.registry}
      related={(g) => store.controller?.featuresWith(target.layerId, 'g', g) ?? []}
    />
  {:else if style === STYLES.historic_districts || style === STYLES.historic_properties || style === STYLES.zoning_overlays || style === STYLES.hearings || style === STYLES.brownfields}
    <RulesDetails
      style={layer!.style as 'historic_districts' | 'historic_properties' | 'zoning_overlays' | 'hearings' | 'brownfields'}
      features={target.features}
      onOpenLot={(opa) => store.select(opa, null, { center: target.lngLat })}
    />
  {:else if style === STYLES.city_shelters}
    <StreetStopDetails kind="shelter" features={target.features} />
  {:else if style === STYLES.street_poles}
    <StreetStopDetails kind="pole" features={target.features} />
  {:else if style === STYLES.traffic_calming}
    <StreetStopDetails kind="calming" features={target.features} />
  {:else if style === STYLES.crossing_guards}
    <StreetStopDetails kind="guard" features={target.features} />
  {:else if style === STYLES.redlining}
    <RedliningDetails features={target.features} />
  {:else if style === STYLES.traffic_stress}
    <StressDetails features={target.features} />
  {:else if style === STYLES.parking_reports}
    <ParkingDetails
      properties={first}
      manifest={store.manifest}
      route={store.registry.routes.find((r) => r.id === 'otis_contact')}
      homepage={store.registry.sources.find((source) => source.id === 'pba_laser')?.homepage}
    />
  {/if}
  {#if onClose}
    <button class="button quiet small" type="button" onclick={onClose}>{strings.place.clearSelection}</button>
  {/if}
</section>

<style>
  .pk-feature {
    font-size: 0.95rem;
  }
  h3 {
    margin-bottom: 2px;
  }
  .memorial {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pk-surface-2);
    margin-bottom: 6px;
  }
  .memorial p {
    margin: 2px 0;
  }
  .suggestions,
  .crashes,
  .facts {
    margin: 0;
    padding-left: 18px;
  }
  .suggestions li,
  .crashes li {
    margin-bottom: 6px;
  }
  .suggestions p {
    margin: 2px 0;
  }
  .crashes span {
    display: block;
  }
</style>
