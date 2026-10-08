// Lots the City's land agencies list as available (issue #36), at phone and desktop sizes: the
// lots layer's setting narrows the map and the ranked list and travels in the link, and a listed
// lot's page leads with the side yard route, says the Land Bank may say no, dates the list and
// links to the Land Bank's own map, with nothing for axe to flag.

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { LAND_BANK_LOT, SAMPLE_CENTER, expectAccessible, expectHash, isPhone, openMap } from './helpers.ts';

const IN_VIEW = `v=a&m=15.4/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`;

async function openLeft(page: Page, info: TestInfo) {
  if (isPhone(info)) await page.getByRole('button', { name: 'Lens and layers' }).click();
}

async function closeLeft(page: Page, info: TestInfo) {
  if (isPhone(info)) await page.locator('#pk-left').getByRole('button', { name: 'Close panel' }).click();
}

async function openRankedList(page: Page) {
  const tab = page.locator('#places-section').getByRole('button', { name: /Ranked list/ });
  if ((await tab.getAttribute('aria-expanded')) !== 'true') await tab.click();
}

const rows = (page: Page) => page.locator('#pk-drawer-table tbody tr');

test.describe('lots listed as available by the City\'s land agencies', () => {
  test('the setting narrows the lots to the listed ones and travels in the link', async ({ page }, info) => {
    await openMap(page, IN_VIEW);
    await openRankedList(page);
    await expect(rows(page).first()).toBeVisible();
    const all = await rows(page).count();

    await openLeft(page, info);
    const listed = page.locator('[data-filter="listed"]');
    await expect(listed.locator('legend')).toHaveText("Listed by the City's land agencies");
    await listed.getByText('Listed as available only', { exact: true }).click();
    await expectHash(page, 's', /vacant_parcels\.listed:available/);
    await closeLeft(page, info);

    // The sample has two listed lots, both at least probably vacant (web/scripts/make-fixtures.mjs);
    // the small map a phone leaves above the drawer shows one of them.
    await openRankedList(page);
    await expect.poll(() => rows(page).count()).toBeLessThan(all);
    const places = await rows(page).locator('td:nth-child(2) button').allTextContents();
    expect(places.length).toBeGreaterThan(0);
    for (const place of places) expect(['1203 N SAMPLE ST', '1313 N EXAMPLE AVE']).toContain(place.trim());
  });

  test('a listed lot page leads with the side yard and links to the Land Bank map', async ({ page }) => {
    await openMap(page, `${IN_VIEW}&p=${LAND_BANK_LOT.id}`);
    const details = page.locator('#pk-right');
    const box = details.locator('aside.listing');
    await expect(box.getByRole('heading', { name: "Listed as available by the City's land agencies" })).toBeVisible();
    await expect(box).toContainText("On October 4, 2026, the City's list of public land showed this property as available.");
    await expect(box).toContainText('If you own the house next door, start with the side yard program');
    await expect(box.getByRole('heading', { name: /side or rear yard/ })).toBeVisible();
    await expect(box).toContainText('can turn down any sale or lease');
    await expect(box.getByRole('link', { name: "The Land Bank's map of available properties" })).toHaveAttribute(
      'href',
      'https://phillylandbank.org/view-properties-map/',
    );
    // The status in plain words, under Who owns it, said once.
    await expect(details).toContainText('Its status there: listed as available.');
    await expect(details.getByText("The City's list of public property names the Philadelphia Land Bank as the owner.")).toHaveCount(1);
    await expectAccessible(page, 'a lot page listed as available');
  });

  test('a nearby card for a listed lot says so and starts with the side yard, as its lot page does', async ({ page }) => {
    await openMap(page, `v=f&m=17.5/${LAND_BANK_LOT.lat}/${LAND_BANK_LOT.lng}`);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const card = page.locator(`article.card[data-place="${LAND_BANK_LOT.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Listed as available by the City's land agencies");
    await expect(card).toContainText('First legal step: Get it as a side or rear yard (next door owners only).');
    await expectAccessible(page, 'a nearby card for a listed lot');
  });
});
