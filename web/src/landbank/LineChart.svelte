<script lang="ts">
  // One series over time (the weekly count of listed lots): a 2px line with 8px markers, the first
  // and last dates labelled, each point's value on hover. The table that follows holds the same
  // numbers.
  import { formatDate, formatNumber } from '../strings.ts';
  import { SINGLE_COLOR } from './data.ts';

  let { points, label }: { points: { date: string; value: number }[]; label: string } = $props();

  const W = 340;
  const H = 130;
  const PAD = { top: 16, right: 14, bottom: 20, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  function niceMax(max: number): number {
    if (max <= 0) return 1;
    const step = 10 ** Math.floor(Math.log10(max));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= max) return m * step;
    return 10 * step;
  }

  const top = $derived(niceMax(Math.max(0, ...points.map((p) => p.value))));
  const times = $derived(points.map((p) => new Date(`${p.date}T12:00:00Z`).getTime()));
  const t0 = $derived(Math.min(...times));
  const t1 = $derived(Math.max(...times));
  const x = (t: number) => PAD.left + (t1 > t0 ? ((t - t0) / (t1 - t0)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]!)},${y(p.value)}`).join(''));
</script>

{#if points.length > 1}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={label} class="chart">
    <line x1={PAD.left} x2={W - PAD.right} y1={y(top)} y2={y(top)} class="grid" />
    <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} class="axis" />
    <text x={PAD.left - 6} y={y(top) + 4} class="tick" text-anchor="end">{formatNumber(top)}</text>
    <text x={PAD.left - 6} y={PAD.top + plotH + 4} class="tick" text-anchor="end">0</text>
    <path d={line} fill="none" stroke={SINGLE_COLOR} stroke-width="2" />
    {#each points as p, i (p.date)}
      <circle cx={x(times[i]!)} cy={y(p.value)} r="4" fill={SINGLE_COLOR} stroke="var(--pk-bg)" stroke-width="2" class="dot"
        ><title>{formatDate(p.date)}: {formatNumber(p.value)}</title></circle
      >
    {/each}
    <text x={x(t0)} y={H - 5} class="tick" text-anchor="start">{formatDate(points[0]!.date, 'short')}</text>
    <text x={x(t1)} y={H - 5} class="tick" text-anchor="end">{formatDate(points[points.length - 1]!.date, 'short')}</text>
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
</style>
