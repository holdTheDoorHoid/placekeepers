// The placemaking lens (M3.4): using it colors the lots by it, a lot's card leads with a place to
// sit, a garden or art and carries the displacement caution, its lot page names the lens and every
// factor behind the score, and a lot facing a block with an open request offers a report to
// Philly311, never the police.

import { expect, test } from '@playwright/test';
import { expectAccessible, expectHash, isPhone, openMap, SAMPLE_CENTER } from './helpers.ts';

/** Two sample lots side by side in the east (web/scripts/make-fixtures.mjs): many neighbors, and
 *  the second faces blocks with open requests about dumping and a dark light. */
const SEAT_LOT = { id: '990000021', lng: -75.14975, lat: 39.98529 };
const REPORT_LOT = '990000022';

test.describe('placemaking', () => {
  test('using the placemaking lens colors the lots by it, and says so', async ({ page }, info) => {
    test.skip(isPhone(info), 'The lens sliders sit in the analysis view, beside the map on a wide screen.');
    await openMap(page, `v=a&m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    const lens = page.locator('section[aria-labelledby="left-lens-placemaking"]');
    await expect(lens).toContainText('Lens: Placemaking');
    await expect(lens).toContainText('The map is not showing this lens on "Vacant lots and buildings" right now.');
    for (const label of ['People within a 5 minute walk', 'Far from a park', 'No public art nearby', 'On or near a commercial corridor']) {
      await expect(lens).toContainText(label);
    }
    await lens.getByRole('button', { name: 'Far from a park' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Now showing "Vacant lots and buildings", colored by the placemaking lens.' })).toBeAttached();
    await expectHash(page, 's', /vacant_parcels\.lens:placemaking/);
    await expect(lens).not.toContainText('The map is not showing this lens');
    await expect(lens.getByRole('button', { name: 'Far from a park' })).toHaveAttribute('aria-pressed', 'true');
    await expect(lens.getByRole('button', { name: 'Where people already walk' })).toHaveAttribute('aria-pressed', 'false');
    await expectAccessible(page, 'the analysis view with the placemaking lens');
  });

  test('under the placemaking lens a lot leads with a place to sit, and its page shows every factor', async ({ page }) => {
    await openMap(page, `v=f&m=17.5/${SEAT_LOT.lat}/${SEAT_LOT.lng}&s=vacant_parcels.lens:placemaking`);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const card = page.locator(`article.card[data-place="${SEAT_LOT.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText('for placemaking');
    await expect(card).toContainText('What you could do: Make a place to sit in the shade.');
    await expect(card).toContainText('Greening can raise nearby prices. Consider pairing it with protections.');
    await card.locator('button').first().click();
    const lotPage = page.locator('article.dossier').first();
    await expect(lotPage).toContainText('Priority under the placemaking lens, the lens the map colors the lots by.');
    for (const label of ['People within a 5 minute walk', 'Everyday places within a 10 minute walk', 'Walkability', 'Far from a park', 'No public art nearby']) {
      await expect(lotPage).toContainText(label);
    }
    await expect(lotPage).toContainText('Make a place to sit in the shade');
    await expect(lotPage).toContainText('Feet First Philly');
    await expectAccessible(page, 'a lot page under the placemaking lens');
  });

  test('a lot facing a block with open requests offers reports to Philly311, never the police', async ({ page }) => {
    await openMap(page, `v=f&m=17.5/${SEAT_LOT.lat}/${SEAT_LOT.lng}`);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const card = page.locator(`article.card[data-place="${REPORT_LOT}"]`);
    await expect(card).toBeVisible();
    // Under the violence lens the card still leads with clean and green.
    await expect(card).toContainText('What you could do: Clean and green this lot.');
    await card.locator('button').first().click();
    const lotPage = page.locator('article.dossier').first();
    await expect(lotPage).toContainText('Report the illegal dumping to Philly311');
    await expect(lotPage).toContainText('Report the dark street light to Philly311');
    await expect(lotPage).toContainText('Report it to Philly311');
    await expect(lotPage).not.toContainText(/police/i);
    await expectAccessible(page, 'a lot page with reports to Philly311');
  });
});
