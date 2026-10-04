<script lang="ts">
  // A small column chart of the City's assessment by year, oldest on the left. One series, so no
  // legend: the heading names it. The same numbers are always in the table that follows, which is
  // what screen readers use; each column also shows its year and value on hover.
  import type { AssessmentRow } from '../../dossier/build.ts';
  import { formatMoney, strings } from '../../strings.ts';

  let { rows }: { rows: AssessmentRow[] } = $props();

  const W = 320;
  const H = 128;
  const PAD = { top: 18, right: 6, bottom: 20, left: 44 };
  /** The bar color: checked with the charting rules for lightness, chroma and contrast on white. */
  const BAR = '#1f6fb2';

  function niceMax(max: number): number {
    if (max <= 0) return 1;
    const step = 10 ** Math.floor(Math.log10(max));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= max) return m * step;
    return 10 * step;
  }

  function compact(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
    if (n >= 1_000) return `$${(n / 1_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`;
    return formatMoney(n);
  }

  const ordered = $derived([...rows].sort((a, b) => a.year - b.year));
  const values = $derived(ordered.map((r) => r.marketValue).filter((v): v is number => v !== null));
  const top = $derived(niceMax(Math.max(0, ...values)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = $derived(plotW / Math.max(1, ordered.length));
  const barW = $derived(Math.max(2, Math.min(24, slot - 2)));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const label = $derived(
    values.length
      ? strings.dossier.history.chartLabel(
          ordered[0]!.year,
          ordered[ordered.length - 1]!.year,
          formatMoney(Math.min(...values)),
          formatMoney(Math.max(...values)),
        )
      : '',
  );
  const latest = $derived([...ordered].reverse().find((r) => r.marketValue !== null) ?? null);

  /** A column with a 4px rounded top and a square foot on the baseline. */
  function column(x: number, w: number, value: number): string {
    const tip = y(value);
    const base = PAD.top + plotH;
    const r = Math.min(4, w / 2, base - tip);
    return `M${x},${base}V${tip + r}Q${x},${tip} ${x + r},${tip}H${x + w - r}Q${x + w},${tip} ${x + w},${tip + r}V${base}Z`;
  }
</script>

{#if values.length > 1}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={label} class="chart">
    <line x1={PAD.left} x2={W - PAD.right} y1={y(top)} y2={y(top)} class="grid" />
    <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} class="axis" />
    <text x={PAD.left - 6} y={y(top) + 4} class="tick" text-anchor="end">{compact(top)}</text>
    <text x={PAD.left - 6} y={PAD.top + plotH + 4} class="tick" text-anchor="end">$0</text>
    {#each ordered as row, i (row.year)}
      {@const x = PAD.left + i * slot + (slot - barW) / 2}
      {#if row.marketValue !== null && row.marketValue > 0}
        <path d={column(x, barW, row.marketValue)} fill={BAR} class="bar"><title>{row.year}: {row.value}</title></path>
      {/if}
      {#if i === 0 || i === ordered.length - 1}
        <text x={x + barW / 2} y={H - 5} class="tick" text-anchor="middle">{row.year}</text>
      {/if}
    {/each}
    {#if latest && latest.marketValue !== null}
      {@const i = ordered.indexOf(latest)}
      <text x={Math.min(W - PAD.right, PAD.left + i * slot + slot / 2)} y={y(latest.marketValue) - 5} class="value" text-anchor="end"
        >{compact(latest.marketValue)}</text
      >
    {/if}
  </svg>
{/if}

<style>
  .chart {
    display: block;
    max-width: 440px;
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
  .bar:hover {
    opacity: 0.8;
  }
</style>
