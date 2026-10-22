// QR codes for the neighbor flyer (M5.2, issue #46), made in the browser with qrcode-generator
// (MIT, Kazuhiko Arase, pinned in package.json): nothing is asked of any server, and the codes
// carry only the address they are given, with no tracking parameters.

import qrcode from 'qrcode-generator';

export interface QrMatrix {
  size: number;
  dark: boolean[][];
}

/**
 * The modules of a QR code for `text` (UTF-8, byte mode), at error correction level M (about 15
 * percent of the code can be damaged, enough for a flyer outdoors) unless asked otherwise.
 */
export function qrMatrix(text: string, level: 'L' | 'M' | 'Q' | 'H' = 'M'): QrMatrix {
  // Byte mode reads text as UTF-8 (the library's own default keeps only the low byte of each letter).
  qrcode.stringToBytes = (value: string) => Array.from(new TextEncoder().encode(value));
  const code = qrcode(0, level);
  code.addData(text, 'Byte');
  code.make();
  const size = code.getModuleCount();
  const dark = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => code.isDark(row, col)));
  return { size, dark };
}

/** One SVG path drawing every dark module, inside a quiet zone of `margin` modules. */
export function qrPath(matrix: QrMatrix, margin = 4): { viewBox: string; path: string } {
  const parts: string[] = [];
  for (let row = 0; row < matrix.size; row++) {
    let col = 0;
    while (col < matrix.size) {
      if (!matrix.dark[row]![col]) {
        col++;
        continue;
      }
      let run = 1;
      while (col + run < matrix.size && matrix.dark[row]![col + run]) run++;
      parts.push(`M${col + margin} ${row + margin}h${run}v1h${-run}z`);
      col += run;
    }
  }
  const total = matrix.size + 2 * margin;
  return { viewBox: `0 0 ${total} ${total}`, path: parts.join('') };
}

/** The lot's page on Placekeepers: the site's address with the lot after "#", nothing else. */
export function lotPageUrl(siteUrl: string, opa: string): string {
  const base = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  return `${base}#p=${encodeURIComponent(opa)}`;
}

/** A link someone typed for their own QR code, when it is a plain web address; null otherwise. */
export function ownLink(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 500) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
