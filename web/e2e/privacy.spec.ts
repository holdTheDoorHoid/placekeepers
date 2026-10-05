// Privacy, as docs/ETHICS.md promises it: with "Fetch live City data" off the site asks no other
// server for anything, and with it on only the City's own servers (registry/options.yaml); "Near
// me" keeps the person's location on the page, out of storage, links and requests; saved lists
// stay in this browser under placekeepers:v1:; and links that open a new tab carry no opener and
// no referrer. Every request to another server is refused here, but the browser still asks, so
// the test sees exactly what a visitor's browser would send.

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { LOT, SAMPLE_CENTER, isPhone } from './helpers.ts';

/** The only other servers the code names on purpose: the City's Carto SQL API and its address service. */
const CITY_ORIGINS = ['https://phl.carto.com', 'https://api.phila.gov'];

/** Every origin the browser asks for anything, pages, scripts and map workers included. */
function watchOrigins(context: BrowserContext): { origins: Set<string>; urls: string[] } {
  const seen = { origins: new Set<string>(), urls: [] as string[] };
  context.on('request', (request) => {
    seen.urls.push(request.url());
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') seen.origins.add(url.origin);
  });
  return seen;
}

async function open(page: Page, hash: string): Promise<void> {
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.goto(`./#${hash}`);
  await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });
}

/** A visit that touches every part that could ask a server for something. */
async function visit(page: Page, phone: boolean): Promise<void> {
  // A lot page, opened from a link.
  await open(page, `v=f&m=17/${LOT.lat}/${LOT.lng}&p=${LOT.id}`);
  const lotPage = page.getByRole('dialog', { name: LOT.address });
  await expect(lotPage).toContainText('Who owns it');
  await page.keyboard.press('Escape');

  // An address search and a parcel number search.
  const search = page.getByRole('searchbox', { name: 'Search for an address, an intersection or a parcel number' });
  await search.fill('1305 N Example Ave');
  await search.press('Enter');
  await expect(page.locator('.address-search [role="status"]')).not.toBeEmpty();
  await search.fill(LOT.id);
  await search.press('Enter');
  await expect(lotPage).toBeVisible();
  await page.keyboard.press('Escape');

  // A tap on the map where no lot is, close in: with live data on, the City is asked which parcel it is.
  await page.goto('about:blank');
  await open(page, `v=f&m=18/39.9878/-75.1609`);
  const canvas = page.locator('canvas.maplibregl-canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
  await expect(page.locator('.toast')).not.toBeEmpty();

  // The analysis view: the drawer, the plot, a download and the saved lists.
  await page.goto('about:blank');
  await open(page, `v=a&m=15.4/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
  const drawer = page.locator('#places-section');
  await drawer.getByRole('button', { name: /Ranked list/ }).click();
  await expect(page.locator('#pk-drawer-table tbody tr').first()).toBeVisible();
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator('#pk-drawer-table').getByRole('button', { name: 'Download CSV' }).click()]);
  await file.path();
  await drawer.getByRole('button', { name: /Need and first step/ }).click();
  await drawer.getByRole('button', { name: /Saved lists/ }).click();
  if (phone) await page.getByRole('button', { name: 'Lens and layers' }).click();
  await page.locator('#pk-left').getByRole('searchbox').fill('1305 N Example Ave');
  await page.locator('#pk-left').getByRole('searchbox').press('Enter');
}

test.describe('privacy', () => {
  test('with live City data off, nothing is asked of any other server', async ({ page, context }, info) => {
    await page.addInitScript(() => localStorage.setItem('placekeepers:v1:options', JSON.stringify({ live_city_data: false })));
    const seen = watchOrigins(context);
    await visit(page, isPhone(info));
    // The search box says live data is off instead of asking the City.
    await expect(page.locator('#pk-left .address-search [role="status"]')).toContainText('live City data is turned off');
    const local = new URL(page.url()).origin;
    expect([...seen.origins].filter((origin) => origin !== local)).toEqual([]);
  });

  test('with live City data on, the only other servers asked are the City\'s', async ({ page, context }, info) => {
    const seen = watchOrigins(context);
    await visit(page, isPhone(info));
    const local = new URL(page.url()).origin;
    const others = [...seen.origins].filter((origin) => origin !== local);
    // The City was asked (the lot page, the search and the tap), and no one else.
    expect(others.sort()).toEqual([...CITY_ORIGINS].sort());
  });

  test('Near me keeps the location on the page: not in storage, links, cookies or requests', async ({ page, context }) => {
    await context.grantPermissions(['geolocation', 'clipboard-read', 'clipboard-write']);
    // A spot among the sample lots, with digits no other number on the page shares.
    const here = { latitude: 39.985371, longitude: -75.154917 };
    await context.setGeolocation(here);
    const seen = watchOrigins(context);
    await open(page, `v=f&m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    await page.getByRole('button', { name: 'Near me' }).click();
    await expect(page.getByText('Nearest to you first.')).toBeVisible();
    // Save a place and open its lot page, so lists and lookups run while the location is in use.
    const card = page.locator('article.card').first();
    await card.getByRole('button', { name: 'Save to my list' }).click();
    await card.locator('button.open').click();
    await expect(page.getByRole('dialog').filter({ hasText: 'Who owns it' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.locator('.toast')).toContainText('It leaves out where the map is');
    await page.waitForTimeout(400);

    const digits = [String(here.latitude), String(here.longitude), '39.98537', '75.15491', '75.15492'];
    const kept = await page.evaluate(() => ({
      local: Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])),
      session: Object.keys(sessionStorage).length,
      cookie: document.cookie,
      hash: location.hash,
    }));
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    for (const text of [JSON.stringify(kept.local), kept.hash, copied, ...seen.urls]) {
      for (const d of digits) expect(text, 'the location leaked').not.toContain(d);
    }
    expect(new URLSearchParams(copied.split('#')[1] ?? '').has('m')).toBe(false);
    expect(kept.session).toBe(0);
    expect(kept.cookie).toBe('');
    expect(await context.cookies()).toEqual([]);
    // Saved lists and settings stay in this browser, under the site's own prefix.
    expect(Object.keys(kept.local).length).toBeGreaterThan(0);
    for (const key of Object.keys(kept.local)) expect(key).toMatch(/^placekeepers:v1:/);
  });

  test('links that open a new tab carry no opener and no referrer', async ({ page }, info) => {
    await open(page, `v=a&m=18/${LOT.lat}/${LOT.lng}&p=${LOT.id}`);
    await expect(page.locator('#pk-right')).toContainText('Who owns it');
    if (isPhone(info)) {
      await page.locator('#pk-right').getByRole('button', { name: 'Close panel' }).click();
      await page.getByRole('button', { name: 'Lens and layers' }).click();
    }
    // Open every "About this layer", where each source links out.
    for (const summary of await page.locator('#pk-left details > summary').all()) await summary.click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const links = page.locator('a[target="_blank"]');
    expect(await links.count()).toBeGreaterThan(5);
    for (const rel of await links.evaluateAll((all) => all.map((a) => a.getAttribute('rel') ?? ''))) {
      expect(rel.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    }
    // And every page asks the browser to send no referrer at all.
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  });
});
