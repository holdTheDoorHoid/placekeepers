<script lang="ts">
  // Columns per year, stacked by series, in the style of the lot page's assessment chart
  // (components/dossier/AssessmentChart.svelte): thin columns with a rounded top, a recessive grid
  // and axis, the top value and the first and last year labelled, and each segment's numbers on
  // hover. A legend names the series whenever there are two or more; the table that follows the
  // chart holds the same numbers for screen readers and keyboards. Colors come in a fixed order
  // and follow the series, never its rank (checked with the charting rules' palette validator).
  import { formatNumber } from '../strings.ts';
  import type { Series } from './data.ts';

  let {
    years,
    series,
    values,
    label,
  }: {
    years: number[];
    series: Series[];
    /** values[i][j]: year i, series j */
    values: number[][];
    label: string;
  } = $props();

  const W = 340;
  const H = 150;
  const PAD = { top: 18, right: 6, bottom: 20, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  function niceMax(max: number): number {
    if (max <= 0) return 1;
    const step = 10 ** Math.floor(Math.log10(max));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= max) return m * step;
    return 10 * step;
  }

  const totals = $derived(values.map((row) => row.reduce((a, b) => a + b, 0)));
  const top = $derived(niceMax(Math.max(0, ...totals)));
  const slot = $derived(plotW / Math.max(1, years.length));
  const barW = $derived(Math.max(3, Math.min(18, slot - 4)));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const shown = $derived(series.filter((_, j) => values.some((row) => (row[j] ?? 0) > 0)));
  const peak = $derived(totals.length ? totals.indexOf(Math.max(...totals)) : -1);
  /** Year labels: the first, the last, and every third year between, so they never crowd. */
  const labelled = $derived(new Set(years.filter((_, i) => i === 0 || i === years.length - 1 || (i % 3 === 0 && years.length - 1 - i >= 2))));

  /** A column segment; only the top one of a stack gets the 4px rounded top. */
  function segment(x: number, w: number, from: number, to: number, rounded: boolean): string {
    const base = y(from);
    const tip = y(to);
    const r = rounded ? Math.min(4, w / 2, base - tip) : 0;
    return `M${x},${base}V${tip + r}Q${x},${tip} ${x + r},${tip}H${x + w - r}Q${x + w},${tip} ${x + w},${tip + r}V${base}Z`;
  }

  function stack(row: number[]): { j: number; from: number; to: number; last: boolean }[] {
    const parts: { j: number; from: number; to: number; last: boolean }[] = [];
    let at = 0;
    row.forEach((v, j) => {
      if (v > 0) {
        parts.push({ j, from: at, to: at + v, last: false });
        at += v;
      }
    });
    if (parts.length) parts[parts.length - 1]!.last = true;
    return parts;
  }
</script>

{#if years.length}
  {#if shown.length > 1}
    <ul class="legend">
      {#each shown as s (s.key)}
        <li><span class="swatch" style="background: {s.color}"></span>{s.label}</li>
      {/each}
    </ul>
  {/if}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={label} class="chart">
    <line x1={PAD.left} x2={W - PAD.right} y1={y(top)} y2={y(top)} class="grid" />
    <line x1={PAD.left} x2={W - PAD.right} y1={y(top / 2)} y2={y(top / 2)} class="grid" />
    <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} class="axis" />
    <text x={PAD.left - 6} y={y(top) + 4} class="tick" text-anchor="end">{formatNumber(top)}</text>
    <text x={PAD.left - 6} y={y(top / 2) + 4} class="tick" text-anchor="end">{formatNumber(top / 2)}</text>
    <text x={PAD.left - 6} y={PAD.top + plotH + 4} class="tick" text-anchor="end">0</text>
    {#each years as year, i (year)}
      {@const x = PAD.left + i * slot + (slot - barW) / 2}
      {#each stack(values[i] ?? []) as part (part.j)}
        <path d={segment(x, barW, part.from, part.to, part.last)} fill={series[part.j]!.color} class="bar"
          ><title>{year}, {series[part.j]!.label}: {formatNumber(part.to - part.from)}</title></path
        >
      {/each}
      {#if labelled.has(year)}
        <text x={x + barW / 2} y={H - 5} class="tick" text-anchor="middle">{year}</text>
      {/if}
    {/each}
    {#if peak >= 0 && totals[peak]! > 0}
      <text
        x={Math.min(W - PAD.right, Math.max(PAD.left + 12, PAD.left + peak * slot + slot / 2))}
        y={y(totals[peak]!) - 5}
        class="value"
        text-anchor="middle">{formatNumber(totals[peak]!)}</text
      >
    {/if}
  </svg>
{/if}

<style>
  .chart {
    display: block;
    max-width: 560px;
    margin: 4px 0 6px;
    overflow: visible;
  }
  .grid {
    stroke: var(--pk-surface-2);
    stroke-width: 1;
  }
  .axis {
    stroke: var(--pk-border);
    stroke-width: 1;
  }
  .tick {
    fill: var(--pk-muted);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .value {
    fill: var(--pk-text);
    font-size: 10px;
    font-weight: 600;
  }
  /* A thin surface gap between stacked segments. */
  .bar {
    stroke: var(--pk-bg);
    stroke-width: 1;
  }
  .bar:hover {
    opacity: 0.8;
  }
  .legend {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 6px 0 0;
    padding: 0;
    font-size: 0.9rem;
    color: var(--pk-text);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    display: inline-block;
  }
</style>
