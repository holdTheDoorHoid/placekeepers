<script lang="ts">
  // A small map for paper (src/map/static-map.ts): the base map as a picture, each place's number
  // drawn on top in black and white, and the base map's credit under it. Without a base map the
  // numbers stand on a plain frame where the places are.
  import { config } from '../../config/index.ts';
  import { renderStaticMap, type StaticMap, type StaticPoint } from '../../map/static-map.ts';
  import { strings } from '../../strings.ts';

  let {
    points,
    width = 480,
    height = 300,
    maxZoom = 16,
    alt,
    marker = 'number',
  }: {
    points: StaticPoint[];
    width?: number;
    height?: number;
    maxZoom?: number;
    alt: string;
    /** Numbers in circles (a packet's lots), or one pin (a flyer's lot). */
    marker?: 'number' | 'pin';
  } = $props();

  let map = $state<StaticMap | null>(null);
  let key = '';

  $effect(() => {
    const wanted = JSON.stringify([points, width, height, maxZoom]);
    if (wanted === key) return;
    key = wanted;
    map = null;
    void renderStaticMap({ dataBase: config.dataBase, mode: config.basemap, points, width, height, maxZoom }).then((drawn) => {
      if (key === wanted) map = drawn;
    });
  });
</script>

<figure class="static-map" style="width: {width}px; max-width: 100%;" data-static-map={map ? (map.image ? 'image' : 'plain') : 'loading'}>
  <div class="frame" style="aspect-ratio: {width} / {height};">
    {#if map?.image}<img src={map.image} {alt} width={width} height={height} />{/if}
    {#if map}
      <svg viewBox="0 0 {width} {height}" role={map.image ? 'presentation' : 'img'} aria-label={map.image ? undefined : alt}>
        {#each map.marks as mark (mark.label + mark.x + mark.y)}
          {#if marker === 'pin'}
            <circle cx={mark.x} cy={mark.y} r="13" class="halo" />
            <circle cx={mark.x} cy={mark.y} r="9" class="dot" />
            <circle cx={mark.x} cy={mark.y} r="3" class="center" />
          {:else}
            <circle cx={mark.x} cy={mark.y} r="10" class="dot" />
            <text x={mark.x} y={mark.y} dy="0.35em" text-anchor="middle">{mark.label}</text>
          {/if}
        {/each}
      </svg>
    {:else}
      <p class="muted small loading">{strings.packet.mapLoading}</p>
    {/if}
  </div>
  {#if map?.credit}<figcaption>{strings.packet.mapCredit}</figcaption>{/if}
  {#if map && !map.image}<figcaption>{strings.packet.mapPlain}</figcaption>{/if}
</figure>

<style>
  .static-map {
    margin: 4px 0 8px;
  }
  .frame {
    position: relative;
    width: 100%;
    border: 1px solid #555;
    background: #fff;
    overflow: hidden;
  }
  img,
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  img {
    filter: grayscale(1) contrast(1.05);
  }
  .dot {
    fill: #fff;
    stroke: #000;
    stroke-width: 2.5;
  }
  .halo {
    fill: rgba(255, 255, 255, 0.7);
    stroke: none;
  }
  .center {
    fill: #000;
  }
  text {
    font: 700 11px/1 var(--pk-font, sans-serif);
    fill: #000;
  }
  figcaption {
    font-size: 0.72rem;
    color: #333;
  }
  .loading {
    padding: 8px;
  }
</style>
