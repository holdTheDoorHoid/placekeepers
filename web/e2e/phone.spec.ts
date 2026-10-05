// A neighbor on a phone, from start to finish: open the site, find what can be done nearby, open a
// lot page, read who owns it and the first legal step, save it to a list, and download the list.
// Then the same screens on the smallest phones (320 by 568) and on a phone turned sideways, where
// the map must keep room to be seen. Phone sizes only.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { LOT, SAMPLE_CENTER, isPhone, openMap } from './helpers.ts';

/**
 * A wide font, as many Android phones and GitHub's test machines have (DejaVu Sans, wider than the
 * Ubuntu or Noto fonts of most laptops), and optionally larger text, as a phone's text size setting
 * gives. The layout must hold with both.
 */
async function wideFont(page: Page, scale = 1): Promise<void> {
  const size = scale === 1 ? '' : `html, body { font-size: ${16 * scale}px !important; }`;
  await page.addStyleTag({ content: `* { font-family: "DejaVu Sans", sans-serif !important; } ${size}` });
}

/** How many rows the top bar's controls sit in: controls whose middles are close share a row. */
async function topBarRows(page: Page): Promise<number> {
  return page.locator('.topbar').evaluate((bar) => {
    const shown = [...bar.querySelectorAll('.brand, .switch, .actions > *, .settings')].filter(
      (el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none',
    );
    const middles = shown.map((el) => (el.getBoundingClientRect().top + el.getBoundingClientRect().bottom) / 2).sort((a, b) => a - b);
    let rows = 0;
    let last = -Infinity;
    for (const middle of middles) {
      if (middle - last > 12) rows++;
      last = middle;
    }
    return rows;
  });
}

test.describe('a neighbor on a phone', () => {
  test.beforeEach(({}, info) => {
    test.skip(!isPhone(info), 'phone sizes only');
  });

  test('finds a place nearby, reads who owns it and the first step, saves it and downloads the list', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: LOT.lat, longitude: LOT.lng });
    await openMap(page, `m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    // A phone gets the field view without asking.
    await expect(page.getByRole('radio', { name: 'Field' })).toBeChecked();

    await page.getByRole('button', { name: 'Near me' }).click();
    await expect(page.getByText('Nearest to you first.')).toBeVisible();
    const card = page.locator(`article.card[data-place="${LOT.id}"]`);
    await expect(card).toContainText('First legal step: Ask the owner for permission.');
    // Every button on the card is big enough for a thumb.
    for (const box of await card.getByRole('button').evaluateAll((all) => all.map((b) => b.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(40);

    await card.locator('button.open').click();
    const lotPage = page.getByRole('dialog', { name: LOT.address });
    await lotPage.getByRole('button', { name: 'Who owns it' }).click();
    await expect(lotPage.getByRole('heading', { name: 'Who owns it' })).toBeInViewport();
    await expect(lotPage).toContainText('Owner, as the City publishes it');
    await lotPage.getByRole('button', { name: 'What you can do' }).click();
    await expect(lotPage.getByRole('heading', { name: 'What you can do' })).toBeInViewport();
    await expect(lotPage).toContainText('The lawful route: Ask the owner for permission');
    await lotPage.getByRole('button', { name: 'Save to my list' }).click();
    await expect(lotPage.getByRole('button', { name: 'Saved to My list' })).toBeVisible();
    await lotPage.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('button', { name: 'My lists' }).click();
    const lists = page.getByRole('dialog', { name: 'Saved lists' });
    const [file] = await Promise.all([page.waitForEvent('download'), lists.getByRole('button', { name: 'Download CSV' }).click()]);
    const csv = readFileSync((await file.path())!, 'utf8');
    expect(csv).toContain(LOT.id);
    expect(csv).toContain('Read the terms of use first');
  });

  test('on the smallest phones the map keeps its room', async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: LOT.lat, longitude: LOT.lng });
    await openMap(page, `m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    // The top bar keeps to two rows, with the longest data status and a wide font, even with larger
    // text: Settings shows a gear (still named "Settings"), and "Copy link" waits in the menu.
    await expect(page.locator('.topbar')).toContainText('Some data is not loading');
    for (const scale of [1, 1.3]) {
      await wideFont(page, scale);
      expect(await topBarRows(page), `rows at ${scale * 100} percent text`).toBe(2);
    }
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });
    await wideFont(page);
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Site menu' }).getByRole('button', { name: 'Copy link' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The note about the data can be hidden, and stays hidden.
    await page.getByRole('button', { name: 'Hide this note' }).click();
    await expect(page.getByRole('note')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });
    await wideFont(page);
    await expect(page.getByRole('button', { name: 'Hide this note' })).toHaveCount(0);

    // With Near me in use, the search box keeps its width and the map is still in sight.
    await page.getByRole('button', { name: 'Near me' }).click();
    await expect(page.getByRole('button', { name: 'Stop using my location' })).toBeVisible();
    expect((await page.getByRole('searchbox').boundingBox())!.width).toBeGreaterThan(120);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    expect((await page.locator('.map-area').boundingBox())!.height).toBeGreaterThan(250);
    await page.getByRole('button', { name: 'Stop using my location' }).click();
    await expect(page.getByRole('button', { name: 'Near me' })).toBeVisible();
  });

  test('a phone turned sideways gets the field view, with the list beside the map', async ({ page }) => {
    await page.setViewportSize({ width: 812, height: 375 });
    await openMap(page, `m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    await expect(page.getByRole('radio', { name: 'Field' })).toBeChecked();
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const sheet = (await page.locator('#places-section').boundingBox())!;
    const map = (await page.locator('.map-area').boundingBox())!;
    // The open list runs down the left of the map and leaves the rest of it uncovered.
    expect(sheet.width).toBeLessThan(map.width * 0.6);
    expect(sheet.height).toBeGreaterThan(map.height * 0.9);
  });
});
