// Shared steps for the end to end tests: open the site on the sample data with nothing leaving the
// machine, wait for the map, and find things on the drawn map by their color.

import { expect, type Page, type TestInfo } from '@playwright/test';
import { inflateSync } from 'node:zlib';

/** The sample parcels (web/fixtures/sources/parcels.geojson): a lot with a full sample lot page. */
export const LOT = { id: '990000005', address: '1305 N EXAMPLE AVE', lng: -75.15572, lat: 39.98513 };
/** A building on the sample lot pages, and a Land Bank lot. */
export const BUILDING = { id: '990000001', lng: -75.157607, lat: 39.985265 };
export const LAND_BANK_LOT = { id: '990000009', lng: -75.155485, lat: 39.98513 };
/** The middle of the sample parcels. */
export const SAMPLE_CENTER = { lng: -75.15353, lat: 39.9858 };

/** The selected parcel's outline on the map (SELECTED in src/map/styles/palette.ts). */
export const SELECTED_RGB: [number, number, number] = [0x0b, 0x4f, 0x8a];

export function isPhone(info: TestInfo): boolean {
  return info.project.name === 'phone';
}

/**
 * Opens the map at a link. Requests to other sites (the City's live lookups) and to the base map
 * are refused, so every run sees the same sample data on a plain background, as CI does.
 */
export async function openMap(page: Page, hash: string): Promise<void> {
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.route('**/data/basemap/**', (route) => route.abort());
  await page.goto(`./#${hash}`);
  await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });
}

/** The parameters in the address bar after "#". */
export async function hashParams(page: Page): Promise<URLSearchParams> {
  const hash = await page.evaluate(() => location.hash.slice(1));
  return new URLSearchParams(hash);
}

/** Waits for the address bar to show a parameter matching a pattern (it follows the state after a moment). */
export async function expectHash(page: Page, key: string, pattern: RegExp): Promise<void> {
  await expect.poll(async () => (await hashParams(page)).get(key) ?? '', { timeout: 10_000 }).toMatch(pattern);
}

// Finding colors on screen ------------------------------------------------------------------------

/** Reads an 8 bit RGB or RGBA PNG, as Chromium writes screenshots, into RGBA pixels. */
export function decodePng(png: Buffer): { width: number; height: number; rgba: Uint8Array } {
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const data: Buffer[] = [];
  while (pos < png.length) {
    const length = png.readUInt32BE(pos);
    const type = png.toString('ascii', pos + 4, pos + 8);
    const body = png.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('Only 8 bit, non interlaced PNGs are read here');
      colorType = body[9]!;
    } else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
    pos += 12 + length;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`PNG color type ${colorType} is not read here`);
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let v = line[i]!;
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      out.set([cur[x * channels]!, cur[x * channels + 1]!, cur[x * channels + 2]!, channels === 4 ? cur[x * channels + 3]! : 255], (y * width + x) * 4);
    }
    prev = cur;
  }
  return { width, height, rgba: out };
}

/**
 * Where a color shows on screen, inside a box of the page: the middle of every matching pixel, in
 * page pixels, or null when fewer than `min` pixels match.
 */
export async function findColor(
  page: Page,
  rgb: [number, number, number],
  box: { x: number; y: number; width: number; height: number },
  min = 12,
): Promise<{ x: number; y: number; count: number } | null> {
  const clip = { x: Math.max(0, Math.floor(box.x)), y: Math.max(0, Math.floor(box.y)), width: Math.floor(box.width), height: Math.floor(box.height) };
  const image = decodePng(await page.screenshot({ clip, animations: 'disabled' }));
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (Math.abs(image.rgba[i]! - rgb[0]) <= 14 && Math.abs(image.rgba[i + 1]! - rgb[1]) <= 14 && Math.abs(image.rgba[i + 2]! - rgb[2]) <= 14) {
        sx += x;
        sy += y;
        count++;
      }
    }
  }
  if (count < min) return null;
  // The screenshot may be larger than the box when the screen has more than one pixel per point.
  const scale = image.width / clip.width;
  return { x: clip.x + sx / count / scale, y: clip.y + sy / count / scale, count };
}

/**
 * Checks that the selected parcel is drawn in a part of the map no panel or sheet covers: its outline
 * shows on screen, and the map itself is the topmost thing at that spot.
 */
export async function expectSelectedInView(page: Page): Promise<void> {
  const canvas = page.locator('canvas.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  let spot: { x: number; y: number } | null = null;
  await expect
    .poll(
      async () => {
        const box = await canvas.boundingBox();
        if (!box) return false;
        spot = await findColor(page, SELECTED_RGB, box);
        if (!spot) return false;
        const { x, y } = spot;
        return page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.classList.contains('maplibregl-canvas') ?? false, [x, y]);
      },
      { timeout: 20_000, intervals: [500, 1000, 1500] },
    )
    .toBe(true);
}
