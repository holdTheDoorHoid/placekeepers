// The neighbor flyer (M5.2, issue #46): its QR codes are made in the browser and decode back to the
// lot's page on Placekeepers, with nothing added that could track who scanned it; a second code
// carries only a plain web address someone typed; what is typed stays under the site's prefix and
// one button clears it; the contact field reminds people that what they print is public.

import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { clearFlyers, contactCaution, defaultFields, hopeLines, readFlyers, writeFlyers } from '../src/flyer/flyer.ts';
import { lotPageUrl, ownLink, qrMatrix, qrPath, type QrMatrix } from '../src/flyer/qr.ts';
import type { KeyValueStore } from '../src/state/storage.ts';
import { collectStrings, strings } from '../src/strings.ts';

const SITE = 'https://holdthedoorhoid.github.io/placekeepers/';

/** Draws a QR code as pixels, four to a module with a quiet zone, the way a camera would see it. */
function pixels(matrix: QrMatrix, scale = 4, margin = 4): { data: Uint8ClampedArray; width: number } {
  const width = (matrix.size + 2 * margin) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.dark[row]![col]) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const i = (((row + margin) * scale + y) * width + (col + margin) * scale + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width };
}

function decode(text: string): string | null {
  const { data, width } = pixels(qrMatrix(text));
  return jsQR(data, width, width)?.data ?? null;
}

describe('the QR codes', () => {
  it('decode back to the lot\'s page on Placekeepers, with no tracking parameters', () => {
    const url = lotPageUrl(SITE, '990000005');
    expect(url).toBe('https://holdthedoorhoid.github.io/placekeepers/#p=990000005');
    expect(decode(url)).toBe(url);
    const parsed = new URL(url);
    expect(parsed.search).toBe('');
    expect([...new URLSearchParams(parsed.hash.slice(1)).keys()]).toEqual(['p']);
    expect(lotPageUrl('https://example.org/site', '371000001')).toBe('https://example.org/site/#p=371000001');
  });

  it('decode for every sample lot and for a long link', () => {
    for (const opa of ['990000001', '990000013', '990000099']) expect(decode(lotPageUrl(SITE, opa))).toBe(lotPageUrl(SITE, opa));
    const long = `https://chat.whatsapp.com/${'AbCdEfGh1234'.repeat(6)}`;
    expect(decode(long)).toBe(long);
    expect(decode('https://example.org/café')).toBe('https://example.org/café');
  });

  it('draw every dark module once, inside a quiet zone', () => {
    const matrix = qrMatrix('https://example.org/');
    const { viewBox, path } = qrPath(matrix);
    expect(viewBox).toBe(`0 0 ${matrix.size + 8} ${matrix.size + 8}`);
    const drawn = [...path.matchAll(/h(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    const dark = matrix.dark.flat().filter(Boolean).length;
    expect(drawn).toBe(dark);
  });

  it('take only a plain web address for the second code', () => {
    expect(ownLink(' https://chat.example.org/invite/abc ')).toBe('https://chat.example.org/invite/abc');
    expect(ownLink('javascript:alert(1)')).toBeNull();
    expect(ownLink('mailto:me@example.org')).toBeNull();
    expect(ownLink('not a link')).toBeNull();
    expect(ownLink('')).toBeNull();
  });
});

describe('what goes on the flyer', () => {
  it('lists the hopes chosen, then the organizers\' own words', () => {
    expect(hopeLines({ hopes: ['garden', 'cleanup'], ownWords: ' Keep the lot open for kids ' })).toEqual([
      'Clean it up together',
      'Plant a garden',
      'Keep the lot open for kids',
    ]);
    expect(hopeLines({ hopes: [], ownWords: '' })).toEqual([]);
  });

  it('reminds people that a home address or a personal phone is public, without blocking it', () => {
    expect(contactCaution('215-555-0100')).toBe(true);
    expect(contactCaution('(215) 555 0100')).toBe(true);
    expect(contactCaution('Meet at 1305 N Example Ave on Saturdays')).toBe(true);
    expect(contactCaution('https://chat.example.org/invite/abc')).toBe(false);
    expect(contactCaution('sample.street.garden@example.org')).toBe(false);
    expect(contactCaution('')).toBe(false);
    expect(strings.flyer.publicWarning).toContain('What you print is public');
  });

  it('never mentions the police, and says neighbors put it up', () => {
    const text = collectStrings(strings.flyer).map(([, s]) => s).join(' ');
    expect(text).not.toMatch(/\bpolice\b|\benforcement\b/i);
    expect(strings.flyer.byNeighbors).toContain('not by the City or the owner');
    expect(defaultFields().headline).toBe('Neighbors care about this lot');
  });
});

describe('what is typed for a flyer', () => {
  function memory(): KeyValueStore & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }

  it('stays in this browser under the site\'s prefix, read forgivingly, and one button clears it', () => {
    const store = memory();
    writeFlyers({ '990000005': { contact: 'group chat', hopes: ['garden'], size: 'half' } }, store);
    expect([...store.data.keys()]).toEqual(['placekeepers:v1:flyer']);
    expect(readFlyers(store)).toEqual({ '990000005': { contact: 'group chat', hopes: ['garden'], size: 'half' } });
    store.setItem('placekeepers:v1:flyer', JSON.stringify({ version: 1, lots: { '990000005': { hopes: ['garden', 'riot'], size: 'poster', contact: 3 }, nope: {} } }));
    expect(readFlyers(store)).toEqual({ '990000005': { hopes: ['garden'] } });
    clearFlyers(store);
    expect(store.data.size).toBe(0);
    expect(readFlyers(store)).toEqual({});
  });
});
