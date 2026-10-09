<script lang="ts">
  // In History on the lot page (M4.3): "See this lot in old aerial photos" turns on the City's
  // aerial photos at the oldest year, 1996, and shows the lot on the map, as "Show on map" does
  // (on a phone the lot page closes first). The photos come straight from the City's servers, so
  // with live City data off the button is off too and says why, with a way to turn live data on.
  import type { SettingValue } from '../../registry/types.ts';
  import { strings } from '../../strings.ts';

  /** The registry layer of the City's aerial photos, and the year the button opens at. */
  const LAYER = 'aerial_photos';
  const OLDEST = '1996';

  let {
    liveOn,
    onShowLayer,
    onShowOnMap,
    onTurnOnLive,
  }: {
    liveOn: boolean;
    onShowLayer?: (id: string, settings?: Record<string, SettingValue>, message?: string) => void;
    onShowOnMap?: () => void;
    onTurnOnLive?: () => void;
  } = $props();
  const uid = $props.id();
  const h = strings.historic;
  const whyId = `${uid}-why`;

  function show() {
    onShowLayer?.(LAYER, { year: OLDEST }, h.shown);
    onShowOnMap?.();
  }
</script>

{#if onShowLayer}
  <h4>{h.lotTitle}</h4>
  {#if liveOn}
    <p class="small muted">{h.lotHelp}</p>
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
