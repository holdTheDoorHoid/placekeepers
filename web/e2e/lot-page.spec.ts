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

// Rules for this lot (M4.6, issue #42), from the weekly copy alone (the City's live lookups are
// refused here): a hearing still to come at the top, every appeal with who filed it on the lot's
// own page, historic designation with "ask them first", the overlays, and the brownfield note on a
// garden suggestion.
test.describe('lot page rules', () => {
  test('puts a hearing still to come at the top, and lists the appeal with who filed it', async ({ page }) => {
    await openMap(page, `v=a&m=16/40.06/-75.03&p=${LOT.id}`);
    const details = page.locator('#pk-right');
    await expect(details.getByRole('heading', { name: LOT.address })).toBeVisible();
    const notice = details.getByTestId('hearing-notice');
    await expect(notice).toContainText('A zoning hearing about this lot is set for November 6, 2030, at 9:30 AM.');
    await expect(notice.getByRole('link', { name: 'How to take part in a zoning hearing' })).toHaveAttribute('href', /participate-in-a-zoning-board-of-adjustment-hearing/);
    await notice.getByRole('button', { name: 'See the appeal' }).click();
    const rules = details.locator('section', { has: page.getByRole('heading', { name: 'Rules for this lot', exact: true }) });
    await expect(rules.getByRole('heading', { name: 'Appeals and hearings' })).toBeInViewport();
    await expect(rules).toContainText('Zoning Board of Adjustment: Permit denial, variance');
    await expect(rules).toContainText('QUINN SAMPLE; SAMPLE HOLDINGS LLC');
    await expect(rules).toContainText('Sample Neighbors Association');
    await expect(rules.getByRole('link', { name: /grounds at the City/ })).toHaveAttribute('href', /li\.phila\.gov\/property-history\/search\?address=1305/);
    await expect(rules).toContainText('/NCO Neighborhood Conservation Overlay District, Sample Area');
    await expect(rules).toContainText('Base zoning: CMX-2, a commercial and mixed use district.');
  });

  test('leads with the Historical Commission on a historic lot, and adds the soil note to its garden', async ({ page }) => {
    await openMap(page, 'v=a&m=16/40.06/-75.03&p=990000002');
    const details = page.locator('#pk-right');
    await expect(details.getByRole('heading', { name: '1203 N SAMPLE ST' })).toBeVisible();
    const rules = details.locator('section', { has: page.getByRole('heading', { name: 'Rules for this lot', exact: true }) });
    await expect(rules).toContainText('This lot is in the Sample Square Historic District, designated on March 10, 1999.');
    await expect(rules).toContainText("Changes here may need the Historical Commission's review; ask them first.");
    await expect(rules).toContainText('215 686 7660');
    await expect(rules).toContainText('A federal brownfield assessment or cleanup was recorded at or near this address. Test the soil before growing food.');
    const actions = details.locator('section', { has: page.getByRole('heading', { name: 'What you can do', exact: true }) });
    const garden = actions.locator('article.suggestion', { hasText: 'Start a community garden' });
    await expect(garden.getByTestId('soil-note')).toContainText('Test the soil before growing food.');
  });
});
