// Spreading the dots of the need and first step plot (src/components/analysis/NeedPlot.svelte) so
// each can be seen and chosen: within its row, a dot that would cover another moves up or down to
// the nearest free spot (a "beeswarm"). A row grows to fit its dots, up to a limit; past it, dots
// may touch again, and the ranked list still holds every place.

export interface SwarmDot {
  id: string;
  /** Where the dot sits across the plot, in pixels. */
  x: number;
  /** Which row it belongs to, from 0. */
  row: number;
}

export interface SwarmOptions {
  /** Dot radius in pixels. */
  radius: number;
  /** The least room a row gives its dots, top to bottom, in pixels. */
  minBand: number;
  /** The most room a row may grow to, in pixels. */
  maxBand: number;
  /** How finely spots are tried, in pixels. */
  step?: number;
}

export interface SwarmLayout {
  /** Each dot's offset from the middle of its row's band, in pixels (up is negative). */
  offset: Map<string, number>;
  /** Each row's band height, in pixels. */
  bands: number[];
}

/** A steady number from 0 to 1 for an id, the same on every visit. */
function spread(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 1000) / 999;
}

/**
 * Places dots row by row, from left to right (ties by id, so the layout never jumps as the map
 * moves), each at the free spot closest to the middle of its row.
 */
export function beeswarm(dots: SwarmDot[], rows: number, options: SwarmOptions): SwarmLayout {
  const { radius, minBand, maxBand } = options;
  const step = options.step ?? 1;
  const gap = radius * 2;
  const limit = Math.max(0, (maxBand - gap) / 2);
  const offset = new Map<string, number>();
  const bands = Array.from({ length: rows }, () => minBand);

  for (let row = 0; row < rows; row++) {
    const inRow = dots.filter((d) => d.row === row).sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
    const placed: { x: number; y: number }[] = [];
    let first = 0;
    let reach = 0;
    for (const dot of inRow) {
      // Only dots less than one dot wide to the left can touch this one (they are sorted by x).
      while (first < placed.length && dot.x - placed[first]!.x >= gap) first++;
      const near = placed.slice(first);
      const free = (y: number) => near.every((p) => (p.x - dot.x) ** 2 + (p.y - y) ** 2 >= gap * gap - 0.01);
      let y = 0;
      for (let k = 0; ; k++) {
        const tryUp = -k * step;
        const tryDown = k * step;
        if (Math.abs(tryUp) > limit) {
          // No free spot within the row's limit: a steady spot from the place's id, spread over the
          // band, so the few dots that must touch do not all pile up at its edges.
          y = (spread(dot.id) * 2 - 1) * limit;
          break;
        }
        if (free(tryDown)) {
          y = tryDown;
          break;
        }
        if (free(tryUp)) {
          y = tryUp;
          break;
        }
      }
      placed.push({ x: dot.x, y });
      offset.set(dot.id, y);
      reach = Math.max(reach, Math.abs(y));
    }
    bands[row] = Math.min(maxBand, Math.max(minBand, Math.ceil(2 * (reach + radius) + 2)));
  }
  return { offset, bands };
}
