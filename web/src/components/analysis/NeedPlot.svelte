<script lang="ts">
  // Need against the first step to get permission (docs/DESIGN.md section 5.4): a strip plot with
  // the lens score across and the first step down, one row per category in the fixed order of its
  // codes (src/config/permission.ts). It answers "where does care help most, and whom would we ask",
  // never "which lots are easiest to get": the rows are kinds of steps, not a ranking.
  // Choosing a dot opens the lot page. The ranked list holds the same places for keyboards and
  // screen readers.
  import { PERMISSION_CODES, permissionLabel, permissionText } from '../../config/permission.ts';
  import type { RankedPlace } from '../../places/rank.ts';
  import type { AppStore } from '../../state/store.svelte.ts';
  import { strings } from '../../strings.ts';

  let { store, places, idPrefix }: { store: AppStore; places: RankedPlace[]; idPrefix: string } = $props();

  /** The most dots drawn at once, the highest scores first. */
  const MAX_DOTS = 1000;
  const ROW = 34;
  const TOP = 8;
  const BOTTOM = 40;
  const p = strings.plot;

  let width = $state(640);
  const narrow = $derived(width < 480);
  const left = $derived(narrow ? 120 : 190);
  const right = 16;
  const height = $derived(TOP + ROW * PERMISSION_CODES.length + BOTTOM);
  const x = (score: number) => left + (score / 100) * Math.max(10, width - left - right);

  const scored = $derived(places.filter((place) => place.score !== null && place.permission !== null));
  const drawn = $derived([...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, MAX_DOTS));
  const noScore = $derived(places.filter((place) => place.score === null).length);
  const noStep = $derived(places.filter((place) => place.score !== null && place.permission === null).length);
  const counts = $derived(PERMISSION_CODES.map((code) => scored.filter((place) => place.permission === code).length));
  const summary = $derived(p.summary(PERMISSION_CODES.map((code, i) => p.rowSummary(permissionLabel(code), counts[i]!)).join('; ')));

  /** A steady spread within a row, from the parcel number, so dots do not jump as the map moves. */
  function jitter(id: string): number {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return ((h % 1000) / 1000 - 0.5) * (ROW - 14);
  }

  function rowY(code: number): number {
    return TOP + ROW * PERMISSION_CODES.indexOf(code as (typeof PERMISSION_CODES)[number]) + ROW / 2;
  }

  function choose(event: MouseEvent) {
    const id = (event.target as Element | null)?.closest?.('[data-place]')?.getAttribute('data-place');
    const place = id ? drawn.find((d) => d.id === id) : undefined;
    if (!place) return;
    store.select(place.id, place.properties, { center: place.center });
    store.controller?.flyTo(place.center);
  }
</script>

<div class="plot">
  <h3 id="{idPrefix}-plot-title">{p.title}</h3>
  <p class="muted small">{p.intro}</p>
  {#if places.length === 0}
    <p class="muted">{p.empty}</p>
  {:else}
    <div class="frame" bind:clientWidth={width} role="presentation" onclick={choose}>
      <svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-labelledby="{idPrefix}-plot-title {idPrefix}-plot-desc">
        <desc id="{idPrefix}-plot-desc">{summary} {p.tableNote}</desc>
        {#each PERMISSION_CODES as code, i (code)}
          <rect class="band" class:odd={i % 2 === 1} x="0" y={TOP + ROW * i} {width} height={ROW} />
          <text class="row-label" x={left - 8} y={TOP + ROW * i + ROW / 2} text-anchor="end" dominant-baseline="middle">
            <title>{permissionText(code)}</title>
            {permissionLabel(code)} ({counts[i]})
          </text>
        {/each}
        {#each [0, 25, 50, 75, 100] as tick (tick)}
          <line class="grid" x1={x(tick)} x2={x(tick)} y1={TOP} y2={TOP + ROW * PERMISSION_CODES.length} />
          <text class="tick" x={x(tick)} y={TOP + ROW * PERMISSION_CODES.length + 14} text-anchor="middle">{tick}</text>
        {/each}
        <text class="axis" x={left + (width - left - right) / 2} y={height - 6} text-anchor="middle">{p.axisX}</text>
        {#each drawn as place (place.id)}
          {@const selected = store.state.selected === place.id}
          <g class="dot" class:selected data-place={place.id} transform="translate({x(place.score ?? 0)} {rowY(place.permission ?? 0) + jitter(place.id)})">
            <title>{p.dot(store.addresses.get(place.id) ?? strings.place.parcel(place.id), place.score ?? 0, permissionLabel(place.permission))}</title>
            <circle class="hit" r="9" />
            <circle class="mark" r={selected ? 7 : 4.5} />
          </g>
        {/each}
      </svg>
    </div>
    {#if scored.length > drawn.length}<p class="muted small">{p.capped(drawn.length, scored.length)}</p>{/if}
    {#if noScore}<p class="muted small">{p.noScore(noScore)}</p>{/if}
    {#if noStep}<p class="muted small">{p.noStep(noStep)}</p>{/if}
    <p class="muted small">{p.tableNote}</p>
  {/if}
</div>

<style>
  .plot h3 {
    margin-bottom: 2px;
  }
  .frame {
    width: 100%;
    overflow: hidden;
  }
  svg {
    display: block;
    font-family: var(--pk-font);
  }
  .band {
    fill: var(--pk-bg);
  }
  .band.odd {
    fill: var(--pk-surface);
  }
  .row-label {
    font-size: 12px;
    font-weight: 600;
    fill: var(--pk-text);
  }
  .grid {
    stroke: var(--pk-surface-2);
    stroke-width: 1;
  }
  .tick {
    font-size: 11px;
    fill: var(--pk-muted);
  }
  .axis {
    font-size: 12px;
    fill: var(--pk-muted);
  }
  .dot {
    cursor: pointer;
  }
  .hit {
    fill: transparent;
  }
  .mark {
    fill: var(--pk-accent);
    fill-opacity: 0.8;
    stroke: #ffffff;
    stroke-width: 1;
  }
  .dot:hover .mark {
    fill-opacity: 1;
    stroke: var(--pk-text);
  }
  .selected .mark {
    fill: #0b4f8a;
    fill-opacity: 1;
    stroke: #1d2327;
    stroke-width: 2.5;
  }
</style>
