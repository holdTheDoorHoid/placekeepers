<script lang="ts">
  // In History on the lot page (M4.3): "See this lot in old aerial photos" turns on the aerial
  // photos at the oldest year the slider has, and shows the lot on the map, as "Show on map" does
  // (on a phone the lot page closes first). The photos come straight from the City's servers, so
  // with live City data off the button is off too and says why, with a way to turn live data on.
  import type { SettingValue } from '../../registry/types.ts';
  import { strings } from '../../strings.ts';

  /** The registry layer of the aerial photos. */
  const LAYER = 'aerial_photos';

  let {
    oldest,
    liveOn,
    onShowLayer,
    onShowOnMap,
    onTurnOnLive,
  }: {
    /** The oldest year of the photos, the one the button opens at. */
    oldest: string;
    liveOn: boolean;
    onShowLayer?: (id: string, settings?: Record<string, SettingValue>, message?: string) => void;
    onShowOnMap?: () => void;
    onTurnOnLive?: () => void;
  } = $props();
  const uid = $props.id();
  const h = strings.historic;
  const whyId = `${uid}-why`;

  function show() {
    onShowLayer?.(LAYER, { year: oldest }, h.shown(oldest));
    onShowOnMap?.();
  }
</script>

{#if onShowLayer}
  <h4>{h.lotTitle}</h4>
  {#if liveOn}
    <p class="small muted">{h.lotHelp(oldest)}</p>
    <button class="button small" type="button" onclick={show}>{h.lotButton}</button>
  {:else}
    <p class="small muted" id={whyId}>{h.lotLiveOff}</p>
    <button class="button small" type="button" disabled aria-describedby={whyId}>{h.lotButton}</button>
    {#if onTurnOnLive}<button class="button small quiet" type="button" onclick={onTurnOnLive}>{strings.options.turnOn}</button>{/if}
  {/if}
{/if}

<style>
  h4 {
    margin-top: 14px;
  }
</style>
