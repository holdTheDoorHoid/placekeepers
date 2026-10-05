// The map flies with the parts of the page that cover it as padding (src/map/covered.ts), so a
// place it shows lands where people can see it, never behind a lot page panel or the bottom sheet.
import { describe, expect, it } from 'vitest';
import { coveredPadding, NO_PADDING } from '../src/map/covered.ts';

const map = { left: 320, top: 100, right: 800, bottom: 760 };

describe('the part of the map the page covers', () => {
  it('is nothing when nothing overlaps the map', () => {
    expect(coveredPadding(map, [])).toEqual(NO_PADDING);
    // The analysis view's side panels on a wide screen sit beside the map.
    expect(coveredPadding(map, [{ left: 0, top: 100, right: 320, bottom: 760 }, { left: 800, top: 100, right: 1240, bottom: 760 }])).toEqual(NO_PADDING);
  });

  it('is the side a lot page panel covers', () => {
    // The details panel opens over the right of the map on medium screens.
    expect(coveredPadding(map, [{ left: 440, top: 100, right: 800, bottom: 760 }])).toEqual({ ...NO_PADDING, right: 360 });
  });

  it('is the height of the bottom sheet on phones', () => {
    const phone = { left: 0, top: 250, right: 375, bottom: 812 };
    expect(coveredPadding(phone, [{ left: 0, top: 760, right: 375, bottom: 812 }])).toEqual({ ...NO_PADDING, bottom: 52 });
  });

  it('steps around a box in a corner by the edge that keeps more map', () => {
    const wide = { left: 0, top: 100, right: 1280, bottom: 800 };
    // A collapsed sheet at the bottom left: lose a strip at the bottom, not a third of the width.
    expect(coveredPadding(wide, [{ left: 0, top: 748, right: 520, bottom: 800 }])).toEqual({ ...NO_PADDING, bottom: 52 });
    // An open sheet over most of the height: lose its width on the left instead.
    expect(coveredPadding(wide, [{ left: 0, top: 360, right: 520, bottom: 800 }])).toEqual({ ...NO_PADDING, left: 520 });
  });

  it('is none left at all when a panel covers the whole map', () => {
    expect(coveredPadding(map, [{ left: 320, top: 100, right: 800, bottom: 760 }])).toBeNull();
    expect(coveredPadding(map, [{ left: 340, top: 100, right: 800, bottom: 760 }])).toBeNull();
  });
});
