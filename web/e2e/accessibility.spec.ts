// Accessibility of both views and the content pages, at phone and desktop sizes, aiming at WCAG 2.2
// AA wherever a map allows: automated checks with axe of every panel, the keyboard paths that reach
// everything without the map canvas (memorials included), Escape and focus, pages that never
// scroll sideways at 320 pixels or at 200 percent zoom, and maps that do not fly for people who
// prefer reduced motion. The map canvas itself is drawn pixels; the lists stand in for it.

import { expect, test, type Page } from '@playwright/test';
import { LOT, SAMPLE_CENTER, expectAccessible, hashParams, isPhone, openMap } from './helpers.ts';

const AT_LOT = `v=f&m=17/${LOT.lat}/${LOT.lng}`;
/** The field view with sample lots and memorials in view, even on a phone. */
const FIELD = `v=f&m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`;
const IN_VIEW = `v=a&m=15.4/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`;
const CONTENT_PAGES = ['about', 'why', 'how', 'responsibly', 'vacant-land', 'terms', 'privacy', 'contact', 'status'];

/** What has keyboard focus, as its role and accessible name would read. */
async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'nothing';
    const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
    return `${el.tagName.toLowerCase()}: ${label.replace(/\s+/g, ' ').trim()}`;
  });
}

/** Presses Tab until focus reaches something matching `pattern`, and returns what it passed. */
async function tabTo(page: Page, pattern: RegExp, limit = 80): Promise<string[]> {
  const passed: string[] = [];
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const now = await focused(page);
    passed.push(now);
    if (pattern.test(now)) return passed;
  }
  throw new Error(`Tab never reached ${pattern}; it passed ${passed.join(' | ')}`);
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(scroll, 'the page scrolls sideways').toBeLessThanOrEqual(width);
}

test.describe('accessibility', () => {
  test('field view: the map, the nearby list, a lot page, layers, lists, settings and the menu', async ({ page }) => {
    await openMap(page, FIELD);
    await expectAccessible(page, 'field view');

    const sheet = page.getByRole('button', { name: /What you can do nearby/ });
    await sheet.click();
    await expect(page.getByRole('list', { name: 'What you can do nearby' }).getByRole('listitem').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Memorials nearby/ })).toBeVisible();
    await expectAccessible(page, 'nearby list');

    const card = page.locator('article.card').first();
    await card.getByRole('button', { name: 'Save to my list' }).click();
    await card.locator('button.open').click();
    const lotPage = page.getByRole('dialog').filter({ hasText: 'Who owns it' });
    await expect(lotPage).toBeVisible();
    await expectAccessible(page, 'lot page');
    await page.keyboard.press('Escape');

    for (const [button, dialog] of [
      ['More layers', 'Layers'],
      ['My lists', 'Saved lists'],
      ['Settings', 'Settings'],
      ['Menu', 'Site menu'],
    ] as const) {
      await page.getByRole('button', { name: button, exact: true }).click();
      await expect(page.getByRole('dialog', { name: dialog })).toBeVisible();
      await expectAccessible(page, dialog);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: dialog })).toBeHidden();
    }

    // A memorial opened from the list shows the same details as its marker.
    await expect(sheet).toHaveAttribute('aria-expanded', 'true');
    await page.locator('[data-memorial]').first().getByRole('button').click();
    await expect(page.getByRole('dialog', { name: 'Memorial' })).toBeVisible();
    await expectAccessible(page, 'memorial');
  });

  test('analysis view: panels, ranked list, plot, saved lists, memorials and a lot page', async ({ page }, info) => {
    await openMap(page, IN_VIEW);
    await expectAccessible(page, 'analysis view');
    if (isPhone(info)) {
      await page.getByRole('button', { name: 'Lens and layers' }).click();
      await expect(page.locator('#pk-left')).toBeVisible();
      await expectAccessible(page, 'left panel');
      await page.locator('#pk-left').getByRole('button', { name: 'Close panel' }).click();
    }
    const drawer = page.locator('#places-section');
    for (const [tab, body] of [
      [/Ranked list/, '#pk-drawer-table tbody tr'],
      [/Need and first step/, '#pk-drawer-plot g.dot'],
      [/Saved lists/, '#pk-drawer-lists button'],
      [/Memorials/, '#pk-drawer-memorials [data-memorial]'],
    ] as const) {
      await drawer.getByRole('button', { name: tab }).click();
      await expect(page.locator(body).first()).toBeAttached();
      await expectAccessible(page, String(tab));
    }
    // A memorial chosen in the list opens in the details panel.
    await page.locator('#pk-drawer-memorials [data-memorial]').first().getByRole('button').click();
    await expect(page.locator('#pk-right').getByRole('heading', { name: 'Memorial' })).toBeVisible();
    await expectAccessible(page, 'memorial details');

    await page.goto('about:blank');
    await openMap(page, `v=a&m=18/${LOT.lat}/${LOT.lng}&p=${LOT.id}`);
    await expect(page.locator('#pk-right')).toContainText('Who owns it');
    await expectAccessible(page, 'lot page');
  });

  test('street blocks and crashes can be reached without the map, in both views', async ({ page }, info) => {
    // Both layers on (the crash layer is off by default, the blocks layer in the field view).
    const layers = 'l=vacant_parcels,segments,crashes,memorials';

    // The field view: the sheet lists the blocks and crashes nearby, after the places and memorials.
    await openMap(page, `v=f&m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}&${layers}`);
    const sheet = page.getByRole('button', { name: /What you can do nearby/ });
    await sheet.click();
    await expect(page.getByRole('heading', { name: /Street blocks nearby/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Crashes nearby/ })).toBeVisible();
    await expect(page.locator('[data-block]').first()).toContainText(/Priority \d+ of 100 for street safety\. Main reason: |No street safety score/);
    await expect(page.locator('[data-block]').first()).toContainText(/feet from the middle of the map\./);
    await expectAccessible(page, 'street blocks nearby');
    // A block opens by keyboard to the same details as tapping it, and Escape gives focus back.
    await page.locator('[data-block] button').first().focus();
    const name = (await page.locator('[data-block] .name').first().textContent())!.trim();
    await page.keyboard.press('Enter');
    const details = page.getByRole('dialog', { name: 'Street block' });
    await expect(details).toBeVisible();
    await expect(details.getByRole('heading', { name })).toBeVisible();
    await expectAccessible(page, 'street block details');
    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();
    await expect(page.locator('[data-block] button').first()).toBeFocused();
    await page.locator('[data-crash] button').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Crash' })).toContainText(/Crash in \d{4}/);
    await page.keyboard.press('Escape');

    // The analysis view: a "Street blocks" tab in the drawer, highest priority first, then crashes.
    await page.goto('about:blank');
    await openMap(page, `v=a&m=15.4/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}&${layers}`);
    const tab = page.locator('#places-section').getByRole('button', { name: /Street blocks/ });
    await expect(tab).toContainText(/\d+ blocks?/);
    await tab.click();
    const drawer = page.locator('#pk-drawer-blocks');
    await expect(drawer.locator('[data-block]').first()).toBeVisible();
    await expect(drawer.getByRole('heading', { name: /Crashes in view/ })).toBeVisible();
    await expectAccessible(page, 'street blocks tab');
    // Tab moves from the drawer's tab into the list; Enter opens the block in the details panel.
    await tab.focus();
    for (let i = 0; i < 10 && !(await drawer.locator('[data-block] button').first().evaluate((b) => b === document.activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expect(drawer.locator('[data-block] button').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#pk-right').getByRole('heading', { name: 'Street block' })).toBeVisible();
    await expect(drawer.locator('[data-block] button').first()).toHaveAttribute('aria-pressed', 'true');
    if (!isPhone(info)) await expectAccessible(page, 'street block in the details panel');
  });

  test('content pages pass the checks and never scroll sideways', async ({ page }, info) => {
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    if (isPhone(info)) await page.setViewportSize({ width: 320, height: 640 });
    for (const slug of CONTENT_PAGES) {
      await page.goto(`./${slug}/`);
      await expect(page.locator('h1').first()).toBeVisible();
      await expectAccessible(page, `${slug} page`);
      await noSidewaysScroll(page);
    }
  });

  test('The Land Bank in numbers passes the checks, never scrolls sideways and works by keyboard', async ({ page }, info) => {
    // Added by M4.4 (issue #40): an app page of its own, reached from the site menu.
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    if (isPhone(info)) await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./land-bank/');
    await expect(page.getByRole('heading', { level: 1, name: 'The Land Bank in numbers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conveyances per year' })).toBeVisible();
    // Every chart has a text alternative, and its numbers in a table.
    for (const chart of await page.locator('svg[role="img"]').all()) await expect(chart).toHaveAttribute('aria-label', /\S/);
    for (const details of await page.locator('details').all()) await details.locator('summary').click();
    await expectAccessible(page, 'the Land Bank page, every table open');
    await noSidewaysScroll(page);

    // The agency choice works from the keyboard, follows into the link, and changes the numbers.
    const select = page.getByRole('combobox', { name: 'Agency' });
    await select.focus();
    await select.selectOption('PLB');
    await expect(page.locator('.headline')).toContainText('the Philadelphia Land Bank conveyed');
    await expect(page).toHaveURL(/[?&]agency=PLB/);
    await expectAccessible(page, 'the Land Bank page, one agency');
    await noSidewaysScroll(page);
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Agency' })).toHaveValue('PLB');

    // The site menu lists the page, marked as the current one.
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Site menu' });
    await expect(menu.getByRole('link', { name: 'The Land Bank in numbers' })).toHaveAttribute('aria-current', 'page');
    await expectAccessible(page, 'the site menu on the Land Bank page');
  });

  test('keyboard: the controls come before the map, and a memorial opens without the map', async ({ page }) => {
    await openMap(page, FIELD);
    // The search box, Near me and the chips come first, then the list of places, then the map.
    const passed = await tabTo(page, /What you can do nearby/);
    const index = (pattern: RegExp) => passed.findIndex((item) => pattern.test(item));
    expect(index(/Address, intersection or parcel number|input: $/)).toBeGreaterThanOrEqual(0);
    expect(index(/Near me/)).toBeLessThan(index(/What you can do nearby/));
    expect(passed.some((item) => item.startsWith('canvas'))).toBe(false);
    await page.keyboard.press('Enter');
    await expect(page.locator('#pk-places')).toBeVisible();

    // Every memorial on the map is in the list, and opens with the keyboard alone.
    await tabTo(page, /Killed while/);
    await page.keyboard.press('Enter');
    const memorial = page.getByRole('dialog', { name: 'Memorial' });
    await expect(memorial).toBeVisible();
    await expect(memorial).toContainText(/Killed while (walking|cycling|riding a scooter) on/);
    await page.keyboard.press('Escape');
    await expect(memorial).toBeHidden();
    expect(await focused(page)).toMatch(/^button: Killed while/);
  });

  test('keyboard: Escape closes what it opened and focus comes back', async ({ page }) => {
    await openMap(page, AT_LOT);
    for (const name of ['Settings', 'Menu', 'More layers']) {
      const button = page.getByRole('button', { name, exact: true });
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('dialog[open]')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await expect(button).toBeFocused();
    }

    // A lot page opened from a card gives focus back to the card.
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const open = page.locator(`article.card[data-place="${LOT.id}"] button.open`);
    await open.focus();
    await page.keyboard.press('Enter');
    const lotPage = page.getByRole('dialog', { name: LOT.address });
    await expect(lotPage).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(lotPage).toBeHidden();
    await expect(open).toBeFocused();

    // Show on map closes the lot page and the list; focus waits on the list's button.
    await page.keyboard.press('Enter');
    await lotPage.getByRole('button', { name: 'Show on map' }).focus();
    await page.keyboard.press('Enter');
    await expect(lotPage).toBeHidden();
    await expect(page.getByRole('button', { name: /What you can do nearby/ })).toBeFocused();
  });

  test('keyboard: panels over the map close with Escape and give focus back', async ({ page }, info) => {
    if (!isPhone(info)) await page.setViewportSize({ width: 900, height: 800 });
    await openMap(page, IN_VIEW);
    if (isPhone(info)) {
      const toggle = page.getByRole('button', { name: 'Lens and layers' });
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#pk-left').getByRole('button', { name: 'Close panel' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('#pk-left')).toBeHidden();
      await expect(toggle).toBeFocused();
    }
    const details = page.getByRole('button', { name: 'Details', exact: true });
    await details.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#pk-right').getByRole('button', { name: 'Close panel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#pk-right')).toBeHidden();
    await expect(details).toBeFocused();
  });

  test('keyboard: saved lists can be made, renamed and deleted, and focus stays put', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await openMap(page, IN_VIEW);
    await page.locator('#places-section').getByRole('button', { name: /Saved lists/ }).click();
    const lists = page.locator('#pk-drawer-lists');
    const newList = lists.getByRole('button', { name: 'New list' });
    await newList.focus();
    await page.keyboard.press('Enter');
    await expect(lists.getByLabel('Name for the new list')).toBeFocused();
    await page.keyboard.type('Block walk');
    await page.keyboard.press('Enter');
    await expect(lists.getByRole('heading', { name: /Block walk/ })).toBeVisible();
    await expect(newList).toBeFocused();
    await expect(page.locator('.toast')).toHaveText('Made the list "Block walk". Places you save now go to it.');

    const rename = lists.getByRole('button', { name: 'Rename' });
    await rename.focus();
    await page.keyboard.press('Enter');
    await expect(lists.getByLabel('New name for this list')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(lists.getByLabel('New name for this list')).toHaveCount(0);
    await expect(rename).toBeFocused();

    await lists.getByRole('button', { name: 'Delete this list' }).focus();
    await page.keyboard.press('Enter');
    await expect(lists).toContainText('No lists yet.');
    await expect(newList).toBeFocused();
  });

  test('both views fit 320 pixels wide and 200 percent zoom without sideways scrolling', async ({ page }, info) => {
    // 200 percent zoom on a 1280 by 800 window leaves 640 by 400 pixels for the page.
    await page.setViewportSize(isPhone(info) ? { width: 320, height: 568 } : { width: 640, height: 400 });
    for (const hash of [AT_LOT, `${AT_LOT}&p=${LOT.id}`, IN_VIEW, `v=a&m=18/${LOT.lat}/${LOT.lng}&p=${LOT.id}`]) {
      await page.goto('about:blank');
      await openMap(page, hash);
      await noSidewaysScroll(page);
    }
  });

  test('the map moves without flying for people who prefer reduced motion', async ({ page }) => {
    /**
     * Shows the first nearby place on the map, from zoom 15, and returns every zoom level the map
     * passed through on its way to zoom 17 (the test build hands the tests the map as pkMap).
     */
    async function zoomsOnShow(): Promise<number[]> {
      await page.goto('about:blank');
      await openMap(page, `v=f&m=15/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
      await page.evaluate(() => {
        const w = window as unknown as { pkMap: { on(event: string, fn: () => void): void; getZoom(): number }; pkZooms: number[] };
        w.pkZooms = [];
        w.pkMap.on('zoom', () => w.pkZooms.push(w.pkMap.getZoom()));
      });
      await page.getByRole('button', { name: /What you can do nearby/ }).click();
      await page.locator('article.card').first().getByRole('button', { name: 'Show on map' }).click();
      await expect.poll(async () => (await hashParams(page)).get('m') ?? '', { timeout: 20_000 }).toMatch(/^17\//);
      return page.evaluate(() => (window as unknown as { pkZooms: number[] }).pkZooms);
    }
    const between = (zooms: number[]) => zooms.filter((z) => Math.abs(z - 15) > 0.01 && Math.abs(z - 17) > 0.01);

    // Flying from zoom 15 to 17 passes through the zoom levels in between...
    expect(between(await zoomsOnShow()).length).toBeGreaterThan(0);
    // ...but for people who prefer reduced motion the map goes straight there, however slow the
    // machine: no zoom level in between, only the one it lands on.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const zooms = await zoomsOnShow();
    expect(zooms.length).toBeGreaterThan(0);
    expect(between(zooms)).toEqual([]);
  });
});
