// Bus and trolley stops under the transit comfort lens (M2.3): the Bus stops chip, stops listed
// beside lots in "What you can do nearby", a stop's details with its score and suggestions, and
// using the lens showing the stops on the map.

import { expect, test } from '@playwright/test';
import { expectAccessible, expectHash, isPhone, openMap } from './helpers.ts';

/** A busy sample stop with neither a shelter nor a bench (web/scripts/make-fixtures.mjs). */
const STOP = { id: 'sp1002', name: 'N Broad St & Sample 2 St', lng: -75.156241, lat: 39.985539 };

test.describe('transit comfort', () => {
  test('the Bus stops chip lists stops beside lots, nearest first, and a card opens the stop', async ({ page }) => {
    await openMap(page, `v=f&m=17/${STOP.lat}/${STOP.lng}`);
    const chip = page.getByRole('button', { name: 'Bus stops' });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expectHash(page, 'l', /transit_stops/);

    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const card = page.locator(`article.card[data-stop="${STOP.id}"]`);
    await expect(card).toBeVisible();
    // The stop under the middle of the map comes first; lots are still listed with it.
    await expect(page.locator('article.card').first()).toHaveAttribute('data-stop', STOP.id);
    await expect(page.locator('article.card[data-place]').first()).toBeAttached();
    await expect(card).toContainText('Bus stop');
    await expect(card).toContainText(STOP.name);
    await expect(card).toContainText('feet from the middle of the map');
    await expect(card).toContainText('Priority 79 of 100 for transit comfort. Main reason: No shelter.');
    await expect(card).toContainText('What you could do: Ask the City for a shelter at this stop.');
    await expect(card).toContainText('First step: Ask the City for a bus shelter.');
    await expectAccessible(page, 'the nearby list with stops');

    await card.locator('button.open').click();
    const details = page.getByRole('dialog', { name: 'Stop' });
    await expect(details).toBeVisible();
    await expect(details).toContainText('What riders find here');
    await expect(details).toContainText('Shelter: No');
    await expect(details).toContainText('What neighbors can do here');
    await expect(details).toContainText('Report a dark streetlight at this stop');
    await expect(details).toContainText('Why this score');
    await details.getByText('Steps, contacts and links').first().click();
    await expect(details).toContainText('otis@phila.gov');
    await expect(details).toContainText('Still to be confirmed with the organization named here.');
    await expectAccessible(page, 'a stop with its score and suggestions');

    await details.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(details).toBeHidden();
    // Show on map marks the stop and closes the list, without opening the details over the map.
    await card.getByRole('button', { name: 'Show on map' }).click();
    await expect(page.getByRole('button', { name: /What you can do nearby/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(details).toBeHidden();
  });

  test('using the transit comfort lens shows the stops, colored by it', async ({ page }, info) => {
    test.skip(isPhone(info), 'The lens sliders sit in the analysis view, beside the map on a wide screen.');
    await openMap(page, `v=a&m=16/${STOP.lat}/${STOP.lng}`);
    const lens = page.locator('section[aria-labelledby="left-lens-transit_comfort"]');
    await expect(lens).toContainText('The map is not showing this lens on "Bus and trolley stops" right now.');
    await lens.getByRole('button', { name: 'Heat and shade' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Now showing "Bus and trolley stops", colored by the transit comfort lens.' })).toBeAttached();
    await expectHash(page, 'l', /transit_stops/);
    await expect(lens).not.toContainText('The map is not showing this lens');
    await expect(lens.getByRole('button', { name: 'Heat and shade' })).toHaveAttribute('aria-pressed', 'true');
  });
});
