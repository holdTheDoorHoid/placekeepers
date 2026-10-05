<script lang="ts">
  // One registry layer: its switch, evidence badge, settings and legend (while shown), and an
  // "About this layer" section with the plain description, a link to its guide when it has one
  // (how anyone can help improve its data), sources, licenses and credits.
  import { config } from '../../config/index.ts';
  import { styleFor } from '../../map/styles/index.ts';
  import type { Layer } from '../../registry/types.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';
  import EvidenceBadge from '../common/EvidenceBadge.svelte';
  import Legend from './Legend.svelte';
  import SettingControl from './SettingControl.svelte';

  let { store, layer, idPrefix }: { store: AppStore; layer: Layer; idPrefix: string } = $props();

  const registry = $derived(store.registry);
  const visible = $derived(store.state.layers.includes(layer.id));
  const status = $derived(store.layerStatus[layer.id]);
  const legend = $derived(styleFor(layer)?.legend({ layer, registry, state: store.state }) ?? []);
  const sources = $derived(
    layer.sources.map((id) => registry.sources.find((s) => s.id === id)).filter((s) => s !== undefined),
  );
  const switchId = $derived(`${idPrefix}-layer-${layer.id}`);

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
      onchange={(e) => store.setLayerVisible(layer.id, e.currentTarget.checked)}
    />
    <label for={switchId}>{layer.label}</label>
    <EvidenceBadge level={layer.evidence} />
  </div>

  {#if visible && status === 'unavailable'}
    <p class="status">{styleFor(layer)?.base ? strings.basemap.unavailable : strings.layers.noData}</p>
  {:else if visible && status === 'error'}
    <p class="status">{strings.layers.dataError}</p>
  {/if}

  {#if visible}
    <div class="shown">
      {#each layer.settings as setting (setting.id)}
        <SettingControl {store} {layer} {setting} {idPrefix} />
      {/each}
      {#if legend.length}
        <h4 class="sr-only">{strings.layers.legend}</h4>
        <Legend entries={legend} />
      {/if}
    </div>
  {/if}

  <details>
    <summary>{strings.layers.details}</summary>
    <p>{layer.description}</p>
    {#if layer.guide}<p><a href="{config.siteBase}{layer.guide}/">{strings.layers.guide}</a></p>{/if}
    <h4>{strings.layers.sources}</h4>
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
