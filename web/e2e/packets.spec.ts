// Packets, letters and who represents you (M5.1, issue #45) on the sample data, at phone and desktop
// sizes: a ten lot packet from a saved list prints one page per lot on Letter paper without cut off
// text, a packet opens from the analysis view's ranked list, the lot page names who represents the
// lot, the letter to an owner follows docs/ETHICS.md, what is typed into a letter never leaves the
// browser, and axe finds no accessibility problems.

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { LOT, SAMPLE_CENTER, expectAccessible, isPhone, openMap } from './helpers.ts';

/** Every parcel of the sample shard, ten of them. */
const TEN = ['990000001', '990000002', '990000004', '990000005', '990000009', '990000013', '990000029', '990000033', '990000098', '990000099'];

/** A saved list of the ten sample lots, as the map keeps it in this browser. */
async function saveTenLots(page: Page): Promise<void> {
  await page.addInitScript((ids) => {
    if (localStorage.getItem('placekeepers:v1:lists')) return;
    const places = ids.map((id, i) => ({ id, address: null, center: [-75.1572 + (i % 4) * 0.0012, 39.9846 + Math.floor(i / 4) * 0.0009], properties: null }));
    localStorage.setItem('placekeepers:v1:lists', JSON.stringify({ version: 1, active: 'ten', lists: [{ id: 'ten', name: 'Ten lots on Sample Street', created: '2026-10-21T12:00:00Z', places }] }));
  }, TEN);
}

async function offline(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.route('**/data/basemap/**', (route) => route.abort());
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(scroll, 'the page scrolls sideways').toBeLessThanOrEqual(width);
}

/** Every request the browser sends: its address and any body. */
function watchRequests(context: BrowserContext): { origins: Set<string>; sent: string[] } {
  const seen = { origins: new Set<string>(), sent: [] as string[] };
  context.on('request', (request) => {
    seen.sent.push(`${request.method()} ${request.url()} ${request.postData() ?? ''} ${JSON.stringify(request.headers())}`);
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') seen.origins.add(url.origin);
  });
  return seen;
}

test.describe('packets', () => {
  test('a ten lot packet from a saved list: cover, displacement card, contacts and one page per lot', async ({ page }, info) => {
    await offline(page);
    await saveTenLots(page);
    await page.goto('./packet/#list=ten');
    await expect(page.getByRole('heading', { level: 1, name: 'Make a packet' })).toBeVisible();
    const lots = page.getByTestId('packet-lot');
    await expect(lots).toHaveCount(10);
    await expect(page.getByRole('heading', { level: 2, name: 'Ten lots on Sample Street' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Displacement watch' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Who to contact' })).toBeVisible();
    await expect(lots.nth(0)).toContainText('1201 N SAMPLE ST');
    await expect(lots.nth(0)).toContainText('Conservatorship can take a property away from its owner.');
    await expect(lots.nth(0)).toContainText('City Council, District 7: Avery Example');
    await expect(lots.nth(5)).toContainText('See "Displacement watch" at the front of this packet.');
    await expect(lots.nth(3)).toContainText('A zoning hearing about this lot is set for November 6, 2030');
    await expect(page.locator('.contacts')).toContainText('Example Avenue Neighbors');
    await expect(page.locator('.contacts')).toContainText('For places 1, 2, 3, 4, 5');
    await expect(page.locator('[data-static-map]')).toHaveAttribute('data-static-map', /image|plain/, { timeout: 30_000 });
    // Nothing about the owner's name or mailing address on the pages.
    await expect(page.getByTestId('packet')).not.toContainText('EXAMPLE DARNELL');
    await noSidewaysScroll(page);
    await expectAccessible(page, 'packet');

    if (isPhone(info)) return;
    // On Letter paper (7.5 by 10 inches inside half inch margins, 96 pixels to the inch): every lot
    // fits on one page and no text is cut off.
    await page.setViewportSize({ width: 720, height: 960 });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.controls')).toBeHidden();
    const measured = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll<HTMLElement>('.packet .sheet')];
      const cut = [...document.querySelectorAll<HTMLElement>('.packet *')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible');
      return {
        heights: sheets.filter((s) => s.classList.contains('lot')).map((s) => s.getBoundingClientRect().height),
        widest: Math.max(...sheets.map((s) => s.scrollWidth)),
        cut: cut.map((el) => el.className || el.tagName),
        breaks: sheets.map((s) => getComputedStyle(s).breakAfter),
      };
    });
    expect(measured.heights).toHaveLength(10);
    for (const [i, height] of measured.heights.entries()) expect(height, `lot ${i + 1} fits one page`).toBeLessThanOrEqual(960);
    expect(measured.widest).toBeLessThanOrEqual(720);
    expect(measured.cut).toEqual([]);
    expect(measured.breaks.slice(0, -1).every((b) => b === 'page')).toBe(true);
    // Chromium's own PDF: the cover, the displacement card, the contacts (one or two pages) and ten lots.
    const pdf = (await page.pdf({ format: 'Letter', margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' } })).toString('latin1');
    const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(13);
    expect(pages).toBeLessThanOrEqual(15);
  });

  test('a packet of the places the analysis view ranks opens in its own tab', async ({ page, context }, info) => {
    test.skip(isPhone(info), 'The ranked list belongs to the analysis view.');
    await openMap(page, `v=a&m=15.4/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    const drawer = page.locator('#places-section');
    await drawer.getByRole('button', { name: /Ranked list/ }).click();
    await expect(page.locator('#pk-drawer-table tbody tr').first()).toBeVisible();
    await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    const [packet] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Make a packet of these places' }).click()]);
    await packet.waitForLoadState();
    expect(new URL(packet.url()).hash).toContain('from=view');
    await expect(packet.getByTestId('packet-lot').first()).toBeVisible();
    await expect(packet.getByRole('combobox', { name: 'Places in the packet' })).toContainText('from the map');
  });

  test('a saved list offers a packet', async ({ page, context }, info) => {
    await saveTenLots(page);
    await openMap(page, `v=a&m=15.4/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    if (isPhone(info)) return;
    await page.locator('#places-section').getByRole('button', { name: /Saved lists/ }).click();
    await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    const [packet] = await Promise.all([context.waitForEvent('page'), page.locator('#pk-drawer-lists').getByRole('button', { name: 'Make a packet' }).click()]);
    await packet.waitForLoadState();
    expect(new URL(packet.url()).hash).toContain('list=ten');
    await expect(packet.getByTestId('packet-lot')).toHaveCount(10);
  });
});

test.describe('who represents you', () => {
  test('the lot page names the ward and division, each seat and the community organizations', async ({ page }) => {
    await openMap(page, `v=a&m=17/${LOT.lat}/${LOT.lng}&p=${LOT.id}`);
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Who represents you' }) });
    await section.scrollIntoViewIfNeeded();
    await expect(section).toContainText('Ward 37, division 14');
    await expect(section).toContainText('Avery Example');
    await expect(section).toContainText('Taylor Example');
    await expect(section).toContainText('Drew Example');
    await expect(section).toContainText('Rowan Example');
    await expect(section).toContainText('Example Avenue Neighbors');
    await expect(section).toContainText('checked October 4, 2026');
    await expect(section.getByRole('link', { name: /Atlas/ })).toHaveAttribute('href', `https://atlas.phila.gov/${LOT.id}/voting`);
  });
});

test.describe('letters', () => {
  test('the letter to an owner follows the rules of the owner flags, and says why when it is not offered', async ({ page }) => {
    await offline(page);
    await page.goto('./letters/#opa=990000002&t=owner');
    await expect(page.getByTestId('owner-letter-not-offered')).toContainText('This lot is public land');
    await expect(page.getByTestId('letter')).toHaveCount(0);
    await page.goto('about:blank');
    await page.goto('./letters/#opa=990000005&t=owner');
    await expect(page.getByTestId('letter')).toBeVisible();
    await expect(page.getByTestId('letter')).toContainText('A lawyer has not reviewed this letter yet. It is not legal advice.');
    await expect(page.getByTestId('letter')).toContainText('Dear property owner,');
    await expect(page.getByTestId('letter')).not.toContainText('EST OF');
    await expect(page.getByText('A lawyer has not reviewed this letter yet.').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'https://groundedinphilly.org/request-representation/' })).toBeVisible();
    await expectAccessible(page, 'letters');
    await noSidewaysScroll(page);
  });

  test('a letter written from a page in Spanish prints in English, with a translation on screen', async ({ page }) => {
    await offline(page);
    await page.goto('./letters/?lang=es#opa=990000005&t=owner');
    const letter = page.getByTestId('letter');
    await expect(letter).toContainText('Dear property owner,');
    await expect(letter).toContainText('A lawyer has not reviewed this letter yet. It is not legal advice.');
    await expect(letter.locator('[lang="en"]').first()).toBeAttached();
    // The sender reads what the letter says in Spanish, on screen only.
    const translation = page.getByTestId('letter-translation');
    await expect(translation).toContainText('Estimado/a propietario/a:');
    await page.emulateMedia({ media: 'print' });
    await expect(translation).toBeHidden();
    await expect(letter).toBeVisible();
    await page.emulateMedia({ media: 'screen' });

    // Chosen: the letter prints in Spanish, says its translation is not yet checked, and needs no second copy.
    await page.getByTestId('letter-language').getByRole('radio', { name: 'Español' }).check();
    await expect(letter).toContainText('Estimado/a propietario/a:');
    await expect(letter).toContainText('Un abogado todavía no ha revisado esta carta.');
    await expect(letter).toContainText('Traducido con ayuda de inteligencia artificial');
    await expect(translation).toHaveCount(0);
    await expectAccessible(page, 'a letter from a page in Spanish');
  });

  test('what is typed into a letter never leaves the browser, and one button clears it', async ({ page, context }) => {
    const seen = watchRequests(context);
    await offline(page);
    const marker = 'Zq7Private Neighbor Words';
    await page.goto('./letters/#opa=990000001&t=owner');
    await expect(page.getByTestId('letter')).toBeVisible();
    for (const label of ['Your name', 'Your group or block, if any', 'How to reach you', 'In your own words (optional)']) {
      await page.getByLabel(label, { exact: true }).fill(`${marker} ${label}`);
    }
    await expect(page.getByTestId('letter')).toContainText(`${marker} Your name`);
    // Every other letter, and printing.
    for (const t of ['council', 'rco', 'followup']) {
      await page.getByRole('radio', { name: new RegExp(t === 'council' ? 'City Council office' : t === 'rco' ? 'Registered Community Organization' : '311 report') }).check();
      await page.getByLabel('In your own words (optional)', { exact: true }).fill(`${marker} ${t}`);
    }
    await page.getByLabel('Philly311 request number').fill('Zq7-12345');
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByRole('button', { name: 'Print the letter' }).click();
    await page.reload();
    await expect(page.getByLabel('Your name', { exact: true })).toHaveValue(`${marker} Your name`);
    await page.waitForTimeout(300);

    const kept = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    for (const key of Object.keys(kept)) expect(key).toMatch(/^placekeepers:v1:/);
    expect(kept['placekeepers:v1:letters']).toContain(marker);
    for (const sent of seen.sent) {
      expect(sent, 'letter text left the browser').not.toContain('Zq7');
      expect(sent).not.toContain(encodeURIComponent(marker));
    }
    const local = new URL(page.url()).origin;
    expect([...seen.origins].filter((origin) => origin !== local)).toEqual([]);
    expect(new URL(page.url()).hash).not.toContain('Zq7');

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Clear everything I typed' }).click();
    await expect(page.getByText('Cleared. Nothing you typed is kept in this browser now.')).toBeVisible();
    const after = await page.evaluate(() => localStorage.getItem('placekeepers:v1:letters'));
    expect(after ?? '').not.toContain('Zq7');
  });
});
