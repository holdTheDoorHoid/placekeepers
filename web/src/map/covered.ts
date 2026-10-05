// How much of the map the page covers right now: a lot page panel over one side of the map (the
// analysis view on medium screens), a panel over all of it (phones), or the field view's bottom
// sheet. The map flies and eases with this as MapLibre's `padding`, so a place it shows lands in
// the middle of the part people can see, never behind a panel.
//
// Elements that can cover the map carry the attribute `data-map-cover`.

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const NO_PADDING: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

/** Less uncovered map than this, in pixels across or down, counts as none. */
const MIN_VISIBLE = 80;

/**
 * The padding that keeps clear of every cover over the map: a panel down one side covers that
 * side, a sheet across the top or bottom covers that edge, and a box in a corner (the field view's
 * sheet on a wide screen) covers whichever edge loses less map. Null when nothing useful is left
 * uncovered, such as a panel over the whole map on a phone.
 */
export function coveredPadding(map: Rect, covers: Rect[]): Padding | null {
  const width = map.right - map.left;
  const height = map.bottom - map.top;
  const p = { ...NO_PADDING };
  for (const r of covers) {
    const x0 = Math.max(map.left, r.left);
    const x1 = Math.min(map.right, r.right);
    const y0 = Math.max(map.top, r.top);
    const y1 = Math.min(map.bottom, r.bottom);
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    const touchesLeft = x0 <= map.left + 1;
    const touchesRight = x1 >= map.right - 1;
    const touchesTop = y0 <= map.top + 1;
    const touchesBottom = y1 >= map.bottom - 1;
    const fromLeft = x1 - map.left;
    const fromRight = map.right - x0;
    const fromTop = y1 - map.top;
    const fromBottom = map.bottom - y0;
    // The cheapest way to step around this cover: the edge it is attached to that loses least.
    const options: [keyof Padding, number][] = [];
    if (touchesLeft) options.push(['left', fromLeft]);
    if (touchesRight) options.push(['right', fromRight]);
    if (touchesTop) options.push(['top', fromTop]);
    if (touchesBottom) options.push(['bottom', fromBottom]);
    if (options.length === 0) continue;
    const loss = ([side, size]: [keyof Padding, number]) => size * (side === 'left' || side === 'right' ? height : width);
    const [side, size] = options.reduce((best, option) => (loss(option) < loss(best) ? option : best));
    p[side] = Math.max(p[side], Math.round(size));
  }
  if (width - p.left - p.right < MIN_VISIBLE || height - p.top - p.bottom < MIN_VISIBLE) return null;
  return p;
}

function rectOf(element: Element): Rect | null {
  if (!(element instanceof HTMLElement) || element.hidden || element.getClientRects().length === 0) return null;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return null;
  const r = element.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/** The padding for the map in `container`, from the covers on the page now. */
export function pagePadding(container: HTMLElement): Padding | null {
  const map = rectOf(container);
  if (!map) return NO_PADDING;
  const covers = [...document.querySelectorAll('[data-map-cover]')].map(rectOf).filter((r): r is Rect => r !== null);
  return coveredPadding(map, covers);
}
