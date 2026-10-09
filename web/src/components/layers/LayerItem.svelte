<script lang="ts">
  // One registry layer: its switch, evidence badge, settings and legend (while shown), and an
  // "About this layer" section with the plain description, a link to its guide when it has one
  // (how anyone can help improve its data), sources, licenses and credits.
  import { isOutsideLayer } from '../../map/raster.ts';
  import { styleFor } from '../../map/styles/index.ts';
  import type { Layer } from '../../registry/types.ts';
  import { LIVE_CITY_DATA } from '../../state/options.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';
  import Legend from './Legend.svelte';
  import SettingControl from './SettingControl.svelte';

  let {
    store,
    layer,
    idPrefix,
    level = 4,
  }: {
    store: AppStore;
    layer: Layer;
    idPrefix: string;
    /** The heading level inside this layer (its legend and its sources). */
    level?: 4 | 5;
  } = $props();

  const registry = $derived(store.registry);
  // Pictures from the City's servers (M4.3) cannot be turned on while live City data is off.
  const blocked = $derived(store.layerBlocked(layer.id));
  const visible = $derived(store.state.layers.includes(layer.id) && !blocked);
  const status = $derived(store.layerStatus[layer.id]);
  const legend = $derived(styleFor(layer)?.legend({ layer, registry, state: store.state, manifest: store.manifest }) ?? []);
  const sources = $derived(
    layer.sources.map((id) => registry.sources.find((s) => s.id === id)).filter((s) => s !== undefined),
  );
  const switchId = $derived(`${idPrefix}-layer-${layer.id}`);
  // The site root from the build (not config, so the layer also renders outside a browser).
  const siteBase = import.meta.env.BASE_URL;

  function licenseOf(id: string) {
    return registry.licenses.find((l) => l.id === id);
  }
</script>

<div class="layer" class:on={visible}>
  <div class="head">
    <input
      id={switchId}
      type="checkbox"
      role="switch"
      checked={visible}
      disabled={blocked}
      aria-describedby={blocked ? `${switchId}-why` : undefined}
      onchange={(e) => store.setLayerVisible(layer.id, e.currentTarget.checked)}
    />
    <label for={switchId}>{layer.label}</label>
    <EvidenceBadge level={layer.evidence} />
  </div>

  {#if blocked}
    <p class="status" id="{switchId}-why">
      {strings.historic.liveOff}
      <button class="button small quiet" type="button" onclick={() => store.setOption(LIVE_CITY_DATA, true)}>{strings.options.turnOn}</button>
    </p>
  {:else if visible && status === 'unavailable'}
    <p class="status">{styleFor(layer)?.base ? strings.basemap.unavailable : strings.layers.noData}</p>
  {:else if visible && status === 'error'}
    <p class="status">{isOutsideLayer(layer) ? strings.historic.serverError : strings.layers.dataError}</p>
  {/if}

  {#if visible}
    <div class="shown">
      {#each layer.settings as setting (setting.id)}
        <SettingControl {store} {layer} {setting} {idPrefix} />
      {/each}
      {#if legend.length}
        <svelte:element this={`h${level}`} class="sr-only">{strings.layers.legend}</svelte:element>
        <Legend entries={legend} />
      {/if}
    </div>
  {/if}

  <details>
    <summary>{strings.layers.details}</summary>
    <p>{layer.description}</p>
    {#if layer.guide}<p><a href="{siteBase}{layer.guide}/">{strings.layers.guide}</a></p>{/if}
    <svelte:element this={`h${level}`} class="sources-title">{strings.layers.sources}</svelte:element>
    <ul class="sources">
      {#each sources as source (source.id)}
        {@const license = licenseOf(source.license)}
        <li>
          <a href={source.homepage} target="_blank" rel="noopener noreferrer">{source.name}</a>,
          {source.publisher}.
          {#if license}
            {strings.layers.license}: <a href={license.url} target="_blank" rel="noopener noreferrer">{license.label}</a>.
          {/if}
          <span class="credit">{source.attribution}</span>
        </li>
      {/each}
    </ul>
  </details>
</div>

<style>
  .layer {
    padding: 10px 0;
    border-bottom: 1px solid var(--pk-surface-2);
  }
  .head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
  }
  .head label {
    font-weight: 600;
    flex: 1 1 10rem;
    min-width: 0;
  }
  .status {
    margin: 6px 0 0 28px;
    font-size: 0.875rem;
    color: var(--pk-muted);
  }
  .shown {
    margin: 6px 0 0 28px;
  }
  details {
    margin: 6px 0 0 28px;
    font-size: 0.9rem;
  }
  .sources-title {
    font-size: 0.9rem;
  }
  .sources {
    margin: 0;
    padding-left: 18px;
  }
  .sources li {
    margin-bottom: 4px;
  }
  .credit {
    display: block;
    color: var(--pk-muted);
    font-size: 0.85rem;
  }
</style>
