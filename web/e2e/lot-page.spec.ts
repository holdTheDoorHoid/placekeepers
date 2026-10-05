// A lot page shows the same score breakdown however it was opened (issue #31). Opened from a link
// while the map looks somewhere else, the parcel's map tile is never loaded and the City's live
// lookups are refused, so the breakdown can only come from the lot's own record in its dossier.

import { expect, test } from '@playwright/test';
import { LOT, openMap } from './helpers.ts';

test.describe('lot page', () => {
  test('opened from a link, it shows the score breakdown, adding up to the score', async ({ page }) => {
    // Far to the northeast of the sample parcels, so none of their tiles is drawn.
    await openMap(page, `v=a&m=16/40.06/-75.03&p=${LOT.id}`);
    const details = page.locator('#pk-right');
    await expect(details.getByRole('heading', { name: LOT.address })).toBeVisible();
    const why = details.locator('section.why');
    await expect(why).toBeVisible();
    const adds = (await why.locator('tbody .adds').allTextContents()).map(Number);
    const total = Number(await why.locator('tfoot strong').textContent());
    expect(adds.length).toBeGreaterThan(1);
    expect(total).toBeGreaterThan(0);
    expect(Math.round(adds.reduce((sum, n) => sum + n, 0) * 10) / 10).toBe(total);
  });
});
