// The heat and shade lens (M3.1): using it colors the lots by it, a lot's card leads with planting
// shade trees or greening to cool, its lot page names the lens behind the score and shows FEMA's
// floodplain beside it, and the heat, tree and floodplain layers sit in their own group.

import { expect, test } from '@playwright/test';
import { expectAccessible, expectHash, isPhone, openMap, SAMPLE_CENTER } from './helpers.ts';

/** A sample lot in the floodplain, in a very heat vulnerable sample tract (web/scripts/make-fixtures.mjs). */
const FLOOD_LOT = { id: '990000021', lng: -75.14975, lat: 39.98529 };

test.describe('heat and shade', () => {
  test('using the heat and shade lens colors the lots by it, and says so', async ({ page }, info) => {
    test.skip(isPhone(info), 'The lens sliders sit in the analysis view, beside the map on a wide screen.');
    await openMap(page, `v=a&m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    const lens = page.locator('section[aria-labelledby="left-lens-heat"]');
    await expect(lens).toContainText('Lens: Heat and shade');
    await expect(lens).toContainText('The map is not showing this lens on "Vacant lots and buildings" right now.');
    await lens.getByRole('button', { name: 'Fewest trees' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Now showing "Vacant lots and buildings", colored by the heat and shade lens.' })).toBeAttached();
    await expectHash(page, 's', /vacant_parcels\.lens:heat/);
    await expect(lens).not.toContainText('The map is not showing this lens');
    await expect(lens.getByRole('button', { name: 'Fewest trees' })).toHaveAttribute('aria-pressed', 'true');
    // The violence lens now says the lots show another lens, and using it brings it back.
    const violence = page.locator('section[aria-labelledby="left-lens-violence"]');
    await expect(violence).toContainText('The map is not showing this lens on "Vacant lots and buildings" right now.');
    await violence.getByRole('button', { name: 'Show it on the map' }).click();
    await expectHash(page, 's', /^(?!.*vacant_parcels\.lens)/);
    await expectAccessible(page, 'the analysis view with the heat and shade lens');
  });

  test('under the heat lens a lot leads with a heat suggestion, and its page shows the floodplain beside the score', async ({ page }) => {
    await openMap(page, `v=f&m=17.5/${FLOOD_LOT.lat}/${FLOOD_LOT.lng}&s=vacant_parcels.lens:heat`);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const card = page.locator(`article.card[data-place="${FLOOD_LOT.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText('for heat and shade');
    await expect(card).toContainText('What you could do: Green this lot to cool the block.');
    await expect(card).toContainText('Greening can raise nearby prices. Consider pairing it with protections.');
    await card.locator('button').first().click();
    const lotPage = page.locator('article.dossier').first();
    await expect(lotPage).toContainText('Priority under the heat and shade lens, the lens the map colors the lots by.');
    await expect(lotPage).toContainText('Flood risk');
    await expect(lotPage).toContainText("Part of this lot lies in FEMA's 1 percent annual chance floodplain");
    await expect(lotPage).toContainText('Neighborhood heat vulnerability');
    await expectAccessible(page, 'a lot page under the heat and shade lens');
  });

  test('heat, the City trees and the floodplain are layers of their own, off until chosen', async ({ page }, info) => {
    await openMap(page, `v=a&m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    if (isPhone(info)) await page.getByRole('button', { name: 'Lens and layers' }).click();
    const group = page.locator('#pk-left section[aria-labelledby="left-group-heat"]');
    await expect(group.getByRole('heading', { name: 'Heat, trees and flooding' })).toBeVisible();
    for (const label of ['Heat vulnerability by neighborhood', 'Street and park trees', 'Floodplain']) {
      const toggle = group.getByRole('switch', { name: label, exact: true });
      await expect(toggle).not.toBeChecked();
      await toggle.check();
    }
    await expectHash(page, 'l', /heat_tracts/);
    await expectHash(page, 'l', /city_trees/);
    await expectHash(page, 'l', /floodplain/);
    await expectAccessible(page, 'the layer list with heat, trees and the floodplain on');
  });
});
