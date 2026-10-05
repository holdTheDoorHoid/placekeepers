// The field view, for standing on the block: "What you can do nearby", the lot page, Near me and
// saving places, at phone and desktop sizes.

import { expect, test } from '@playwright/test';
import { LOT, SAMPLE_CENTER, expectHash, expectSelectedInView, hashParams, openMap, parcelsDrawn, zoomTo } from './helpers.ts';

const AT_LOT = `v=f&m=17/${LOT.lat}/${LOT.lng}`;

test.describe('field view', () => {
  test('shows a loading note until the map has drawn, then the nearest places with a suggestion', async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    await page.route('**/data/basemap/**', (route) => route.abort());
    // A slow connection: the lots arrive late, and the note stays until they are drawn.
    await page.route('**/data/tiles/lots.pmtiles', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto(`./#${AT_LOT}`);
    // The note covers the map until it has drawn once with its data.
    await expect(page.getByRole('status').filter({ hasText: 'Loading the map' })).toBeVisible();
    await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });
    await expect(page.getByText('Loading the map')).toHaveCount(0);

    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    await expect(page.getByText('Nearest to the middle of the map first.')).toBeVisible();
    const first = page.locator('article.card').first();
    // The nearest place is the lot under the middle of the map, named by its lot page's address.
    await expect(first).toHaveAttribute('data-place', LOT.id);
    await expect(first).toContainText(LOT.address);
    await expect(first).toContainText('Vacant lot');
    await expect(first).toContainText('feet from the middle of the map');
    await expect(first).toContainText('What you could do: Clean and green this lot.');
    await expect(first).toContainText('First legal step: Ask the owner for permission. Find the owner\'s mailing address on the lot page.');
    // Cards are nearest first.
    const cards = page.locator('article.card');
    expect(await cards.count()).toBeGreaterThan(1);
    // The short credits line stays open on the map.
    await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('Data: City of Philadelphia and others');
    await expect(page.locator('.maplibregl-ctrl-attrib a', { hasText: 'others' })).toHaveAttribute('href', /\/placekeepers\/status\/$/);
  });

  test('tapping a card opens the lot page, and Show on map brings the parcel into view', async ({ page }) => {
    await openMap(page, AT_LOT);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    await page.locator(`article.card[data-place="${LOT.id}"] button.open`).click();
    const lotPage = page.getByRole('dialog', { name: LOT.address });
    await expect(lotPage).toBeVisible();
    await expect(lotPage).toContainText('Who owns it');
    await expectHash(page, 'p', new RegExp(`^${LOT.id}$`));

    await lotPage.getByRole('button', { name: 'Show on map' }).click();
    await expect(lotPage).toBeHidden();
    await expectSelectedInView(page);
  });

  test('a link with a lot page opens it, with the parcel in view behind it', async ({ page }) => {
    await openMap(page, `${AT_LOT}&p=${LOT.id}`);
    const lotPage = page.getByRole('dialog', { name: LOT.address });
    await expect(lotPage).toBeVisible();
    await lotPage.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(lotPage).toBeHidden();
    await expectSelectedInView(page);
  });

  test('Near me sorts by the person\'s location, which stays out of links', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: LOT.lat, longitude: LOT.lng });
    await openMap(page, `v=f&m=16/39.9858/-75.1535`);
    await page.getByRole('button', { name: 'Near me' }).click();
    await expect(page.getByText(/^Using your location\./)).toBeVisible();
    await expect(page.getByText('Nearest to you first.')).toBeVisible();
    await expect(page.locator('article.card').first()).toContainText('feet from you');
    // While the location is in use, the address bar leaves out where the map is.
    await expect.poll(async () => (await hashParams(page)).has('m')).toBe(false);
    expect((await hashParams(page)).get('v')).toBe('f');

    await page.getByRole('button', { name: 'Stop using my location' }).click();
    await expect(page.getByRole('button', { name: 'Near me' })).toBeVisible();
    // The map still shows where the person was, so links leave it out until they move the map.
    await page.waitForTimeout(500);
    expect((await hashParams(page)).has('m')).toBe(false);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect.poll(async () => (await hashParams(page)).has('m')).toBe(true);
  });

  test('zoomed out, the nearby list waits for every parcel instead of listing the sample', async ({ page }) => {
    await openMap(page, `v=f&m=12.4/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    await expect.poll(async () => (await parcelsDrawn(page)).sample).toBeGreaterThan(0);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    await expect(page.locator('#pk-places')).toContainText('Move or zoom the map to a neighborhood to see places nearby.');
    await expect(page.locator('article.card')).toHaveCount(0);
    await zoomTo(page, 13.4);
    await expect.poll(async () => (await parcelsDrawn(page)).sample).toBe(0);
    await expect(page.locator('article.card').first()).toBeVisible();
    await expect(page.getByText('Nearest to the middle of the map first.')).toBeVisible();
  });

  test('saves a place to a list from its card, kept in this browser', async ({ page }) => {
    await openMap(page, AT_LOT);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const card = page.locator(`article.card[data-place="${LOT.id}"]`);
    await card.getByRole('button', { name: 'Save to my list' }).click();
    await expect(card.getByRole('button', { name: 'Saved to My list' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'My lists' }).click();
    const lists = page.getByRole('dialog', { name: 'Saved lists' });
    await expect(lists).toContainText('Lists stay in this browser, on this device. Nothing is sent anywhere.');
    await expect(lists.getByRole('button', { name: `Open the lot page for ${LOT.address}` })).toBeVisible();

    // Still there after a reload: the list lives in this browser's storage.
    await page.reload();
    await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });
    await page.getByRole('button', { name: 'My lists' }).click();
    await expect(page.getByRole('dialog', { name: 'Saved lists' }).getByRole('button', { name: `Open the lot page for ${LOT.address}` })).toBeVisible();
  });
});
