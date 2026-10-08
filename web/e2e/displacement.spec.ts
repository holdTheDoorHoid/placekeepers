// The displacement watch (M4.1) on the sample data, at phone and desktop sizes: a greening card in
// a watch area adds the area's signs and the ways to protect neighbors, outside one it keeps the
// one line caution; the layer is on in the analysis view and off in the field view; tapping an
// area lists its signs; and a lot page opened from a link shows the watch from its dossier.

import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, isPhone, LOT, openMap } from './helpers.ts';

const CAUTION = 'Greening can raise nearby prices. Consider pairing it with protections.';
/** A sample lot inside a watch area (web/scripts/displacement-fixtures.mjs). */
const WATCH_LOT = { id: '990000021', lng: -75.14975, lat: 39.98529 };

/** Where a point stands, from meters east and north of the sample origin (make-fixtures.mjs). */
function sample(x: number, y: number): { lng: number; lat: number } {
  const lat0 = 39.985;
  const perLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  return { lng: round6(-75.158 + x / perLng), lat: round6(lat0 + y / 111_320) };
}

/** Taps the map at a place, once the watch areas are drawn there. */
async function tapArea(page: Page, place: { lng: number; lat: number }): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const map = (window as unknown as { pkMap: { getLayer(id: string): unknown; queryRenderedFeatures(o: { layers: string[] }): unknown[] } }).pkMap;
          return map.getLayer('pk:displacement_watch:fill') ? map.queryRenderedFeatures({ layers: ['pk:displacement_watch:fill'] }).length : 0;
        }),
      { timeout: 30_000, intervals: [500, 1000] },
    )
    .toBeGreaterThan(0);
  const canvas = page.locator('canvas.maplibregl-canvas');
  const point = await page.evaluate(({ lng, lat }) => {
    const map = (window as unknown as { pkMap: { project(c: [number, number]): { x: number; y: number } } }).pkMap;
    const p = map.project([lng, lat]);
    return { x: p.x, y: p.y };
  }, place);
  await canvas.click({ position: point });
}

test.describe('displacement watch', () => {
  test('a greening card in a watch area names its signs and points to the protections, shown once above the list', async ({ page }) => {
    await openMap(page, `v=f&m=17.5/${WATCH_LOT.lat}/${WATCH_LOT.lng}`);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const card = page.locator(`article.card[data-place="${WATCH_LOT.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(CAUTION);
    await expect(card).toContainText('This place is in a displacement watch area');
    // The ways to protect neighbors are listed once, above the cards (decided by the owner on
    // 2026-10-08), and each card in a watch area points to them.
    const sheet = page.locator('#pk-places');
    const full = sheet.locator('[data-watch-card]');
    await expect(full).toHaveCount(1);
    await expect(full.getByRole('heading', { name: 'Displacement watch' })).toBeVisible();
    const loop = full.getByRole('link', { name: "The City's Longtime Owner Occupants Program (LOOP)" });
    await expect(loop).toHaveAttribute('href', /^https:\/\/www\.phila\.gov\//);
    await expect(full.getByRole('link', { name: 'Neighborhood Gardens Trust' })).toHaveAttribute('href', 'https://ngtrust.org/preservation/');
    await expect(sheet.getByRole('link', { name: "The City's Longtime Owner Occupants Program (LOOP)" })).toHaveCount(1);
    await expect(card.getByRole('link', { name: "The City's Longtime Owner Occupants Program (LOOP)" })).toHaveCount(0);
    await card.getByRole('button', { name: 'See the ways to protect neighbors' }).click();
    await expect(full).toBeFocused();
    await expectAccessible(page, 'a greening card in a displacement watch area');
  });

  test('outside every watch area the card keeps the one line caution', async ({ page }) => {
    await openMap(page, `v=f&m=17.5/${LOT.lat}/${LOT.lng}`);
    await page.getByRole('button', { name: /What you can do nearby/ }).click();
    const card = page.locator(`article.card[data-place="${LOT.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(CAUTION);
    await expect(card).not.toContainText('displacement watch area');
    await expect(card.getByRole('link', { name: 'Ways to protect neighbors' })).toBeVisible();
  });

  test('a lot page in a watch area shows the full card exactly once, and each card points to it', async ({ page }) => {
    await openMap(page, `v=a&m=17.5/${WATCH_LOT.lat}/${WATCH_LOT.lng}&p=${WATCH_LOT.id}`);
    const lotPage = page.locator('#pk-right article.dossier');
    await expect(lotPage).toContainText('What you can do');
    const full = lotPage.locator('[data-watch-card]');
    await expect(full).toHaveCount(1);
    await expect(full).toContainText('This place is in a displacement watch area');
    await expect(full).toContainText(CAUTION);
    await expect(lotPage.getByText('This place is in a displacement watch area')).toHaveCount(1);
    await expect(lotPage.getByRole('link', { name: "The City's Homestead Exemption" })).toHaveCount(1);
    // Each greening and placemaking card keeps its one line caution and a button to the full card.
    const jumps = lotPage.getByRole('button', { name: 'See the signs here and the ways to protect neighbors' });
    expect(await jumps.count()).toBeGreaterThan(1);
    await jumps.last().click();
    await expect(full).toBeFocused();
    await expectAccessible(page, 'a lot page in a displacement watch area');
  });

  test('the layer is on for organizers, and a tapped area lists its signs', async ({ page }, info) => {
    test.skip(isPhone(info), 'The analysis view sits beside the map on a wide screen.');
    const middle = sample(475, 330);
    await openMap(page, `v=a&m=15/${middle.lat}/${middle.lng}`);
    const group = page.locator('#pk-left section[aria-labelledby="left-group-displacement"]');
    await expect(group.getByRole('heading', { name: 'Prices and protections' })).toBeVisible();
    await expect(group.getByRole('switch', { name: 'Displacement watch: signs that prices are rising', exact: true })).toBeChecked();
    await tapArea(page, middle);
    const details = page.locator('#pk-right');
    await expect(details).toContainText('Signs that prices are rising here');
    await expect(details).toContainText('Census tract 9002. Around Sample Heights.');
    await expect(details).toContainText('The middle price of the homes sold went from $61,000 to $112,000, up 84%, against up 28% across the city');
    await expect(details).toContainText('not a forecast');
    await expectAccessible(page, 'a tapped displacement watch area');
  });

  test('the layer is off in the field view until someone turns it on', async ({ page }) => {
    const middle = sample(475, 330);
    await openMap(page, `v=f&m=15/${middle.lat}/${middle.lng}`);
    await page.getByRole('button', { name: 'More layers', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Displacement watch: signs that prices are rising', exact: true })).not.toBeChecked();
  });

  test('a lot page opened from a link shows the watch from its dossier', async ({ page }) => {
    // Far from the sample parcels, so the lot's map tile is never loaded.
    await openMap(page, `v=a&m=16/40.06/-75.03&p=990000013`);
    const lotPage = page.locator('article.dossier').first();
    await expect(lotPage).toContainText(CAUTION);
    await expect(lotPage).toContainText('This place is in a displacement watch area');
    await expect(lotPage.getByRole('link', { name: "The City's Homestead Exemption" }).first()).toBeVisible();
  });
});
