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

// The story of the lot in one timeline (issue #38), from the weekly copy alone: the City's live
// lookups are refused here, so everything shown comes from the sample history shard, which loads
// only when History comes into view.
test.describe('lot page history', () => {
  test('tells the story of the lot from records, and each kind of record can be switched off', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/dossiers/history/')) asked.push(request.url());
    });
    await openMap(page, 'v=a&m=16/40.06/-75.03&p=990000002');
    const details = page.locator('#pk-right');
    await expect(details.getByRole('heading', { name: '1203 N SAMPLE ST' })).toBeVisible();
    const history = details.locator('section', { has: page.getByRole('heading', { name: 'History', exact: true }) });
    await history.getByRole('heading', { name: 'The story of this lot' }).scrollIntoViewIfNeeded();
    await expect(history.getByText('A building stood here until 2011, when the City demolished it.')).toBeVisible();
    await expect(history.getByText("From L&I's demolition records.")).toBeVisible();
    expect(asked).toHaveLength(1);
    const events = history.locator('.events li.event');
    await expect(events.filter({ hasText: 'High weeds-cut' })).toHaveCount(1);
    await history.getByRole('checkbox', { name: /Violations/ }).uncheck();
    await expect(events.filter({ hasText: 'High weeds-cut' })).toHaveCount(0);
    await expect(events.filter({ hasText: 'City demolition, by the City' })).toHaveCount(1);
    await history.getByRole('checkbox', { name: /Violations/ }).check();
    await expect(events.filter({ hasText: 'High weeds-cut' })).toHaveCount(1);
  });
});
