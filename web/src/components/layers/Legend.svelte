<script lang="ts">
  // Draws a style module's legend entries: color ramps, swatches, lines, count classes, notes.
  // An entry may link to one of the site's content pages (such as the bus stop survey guide).
  import { config } from '../../config/index.ts';
  import type { LegendEntry } from '../../map/styles/index.ts';

  let { entries }: { entries: LegendEntry[] } = $props();
</script>

<ul class="legend">
  {#each entries as entry, i (i)}
    {#if entry.kind === 'ramp'}
      <li class="ramp">
        <span class="title">{entry.title}</span>
        <span class="bar" style:background="linear-gradient(to right, {entry.stops.join(', ')})" aria-hidden="true"></span>
        <span class="ends"><span>{entry.low}</span><span>{entry.high}</span></span>
      </li>
    {:else if entry.kind === 'swatch'}
      <li class="row">
        <svg width="28" height="18" aria-hidden="true">
          <rect
            x="2"
            y="2"
            width="24"
            height="14"
            fill={entry.fill}
            fill-opacity={entry.fillOpacity ?? 1}
            stroke={entry.stroke}
            stroke-width={entry.strokeWidth}
            stroke-dasharray={entry.dashed ? '4 3' : undefined}
          />
        </svg>
        <span>{entry.label}</span>
      </li>
    {:else if entry.kind === 'line'}
      <li class="row">
        <svg width="28" height="18" aria-hidden="true">
          {#if entry.casing}<line x1="2" y1="9" x2="26" y2="9" stroke={entry.casing} stroke-width={entry.width + 3} stroke-linecap="round" />{/if}
          <line x1="2" y1="9" x2="26" y2="9" stroke={entry.color} stroke-width={entry.width} stroke-linecap="round" />
        </svg>
        <span>{entry.label}</span>
      </li>
    {:else if entry.kind === 'circle'}
      <li class="row">
        <svg width="28" height="18" aria-hidden="true">
          <circle cx="14" cy="9" r={entry.radius} fill={entry.fill} stroke={entry.stroke} stroke-width="1.5" />
        </svg>
        <span>
          {entry.label}{#if entry.link}<br /><a href="{config.siteBase}{entry.link.page}/">{entry.link.label}</a>{/if}
        </span>
      </li>
    {:else if entry.kind === 'bins'}
      <li>
        <span class="title">{entry.title}</span>
        <ul class="bins">
          {#each entry.bins as bin (bin.label)}
            <li class="row">
              <span class="box" style:background={bin.color} style:opacity={entry.opacity} aria-hidden="true"></span>
              <span>{bin.label}</span>
            </li>
          {/each}
        </ul>
      </li>
    {:else}
      <li class="note">{entry.text}</li>
    {/if}
  {/each}
</ul>

<style>
  .legend,
  .bins {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.875rem;
  }
  .legend > li {
    margin: 4px 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .title {
    display: block;
    font-weight: 600;
  }
  .bar {
    display: block;
    height: 12px;
    border-radius: 3px;
    border: 1px solid var(--pk-border);
    margin: 4px 0 2px;
  }
  .ends {
    display: flex;
    justify-content: space-between;
    color: var(--pk-muted);
  }
  .box {
    width: 24px;
    height: 14px;
    border-radius: 2px;
    border: 1px solid var(--pk-border);
  }
  .bins {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: 4px;
  }
  .note {
    color: var(--pk-muted);
  }
</style>
