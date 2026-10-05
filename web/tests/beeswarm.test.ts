// The plot's dots spread out so each can be seen and chosen (issue #23).

import { describe, expect, it } from 'vitest';
import { beeswarm, type SwarmDot } from '../src/places/beeswarm.ts';

const OPTIONS = { radius: 5, minBand: 32, maxBand: 120 };

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('beeswarm', () => {
  it('leaves a lone dot in the middle of its row', () => {
    const layout = beeswarm([{ id: 'a', x: 50, row: 2 }], 6, OPTIONS);
    expect(layout.offset.get('a')).toBe(0);
    expect(layout.bands).toEqual([32, 32, 32, 32, 32, 32]);
  });

  it('spreads places that share a score so no two dots cover each other', () => {
    const dots: SwarmDot[] = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, x: 100, row: 0 }));
    dots.push(...Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, x: 160 + i * 4, row: 0 })));
    const layout = beeswarm(dots, 1, OPTIONS);
    const at = dots.map((d) => ({ x: d.x, y: layout.offset.get(d.id)! }));
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) expect(distance(at[i]!, at[j]!)).toBeGreaterThanOrEqual(9.99);
    // The row grows to hold them, within its limit.
    expect(layout.bands[0]).toBeGreaterThan(32);
    expect(layout.bands[0]).toBeLessThanOrEqual(120);
    for (const p of at) expect(Math.abs(p.y) + 5).toBeLessThanOrEqual(layout.bands[0]! / 2 + 0.01);
  });

  it('keeps every dot in its own row, and the same layout for the same places', () => {
    const dots: SwarmDot[] = Array.from({ length: 200 }, (_, i) => ({ id: String(990000000 + i), x: (i * 37) % 300, row: i % 6 }));
    const one = beeswarm(dots, 6, OPTIONS);
    const two = beeswarm([...dots].reverse(), 6, OPTIONS);
    expect([...one.offset.entries()].sort()).toEqual([...two.offset.entries()].sort());
    for (const [row, band] of one.bands.entries()) {
      for (const d of dots.filter((dot) => dot.row === row)) expect(Math.abs(one.offset.get(d.id)!)).toBeLessThanOrEqual(band / 2);
    }
  });

  it('stops growing a row at its limit when too many places share one score, and keeps them inside it', () => {
    const dots: SwarmDot[] = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, x: 100, row: 0 }));
    const layout = beeswarm(dots, 1, OPTIONS);
    expect(layout.bands[0]).toBeGreaterThan(100);
    expect(layout.bands[0]).toBeLessThanOrEqual(120);
    for (const d of dots) expect(Math.abs(layout.offset.get(d.id)!) + 5).toBeLessThanOrEqual(layout.bands[0]! / 2 + 0.01);
    // The ones that cannot fit spread over the band instead of piling up at its edges.
    const edges = dots.filter((d) => Math.abs(layout.offset.get(d.id)!) > 50).length;
    expect(edges).toBeLessThan(10);
  });
});
