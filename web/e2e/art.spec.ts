// Public art (M3.2): a layer of its own, off until chosen, with a switch for each kind of work; a
// tapped work shows its title, artist and a link to each source; a memorial artwork shows only
// that it is one, with its sources, and never a name (docs/ETHICS.md).

import { expect, type Page, test } from '@playwright/test';
import { expectAccessible, expectHash, isPhone, openMap } from './helpers.ts';

/** Sample works (web/scripts/make-fixtures.mjs): a statue in all three sources, and a memorial. */
const STATUE = { lng: -75.15671, lat: 39.985898 };
const MEMORIAL = { lng: -75.154835, lat: 39.98482 };

/** Taps the map where a place is drawn (the test build hands the tests the map as pkMap). */
async function tapAt(page: Page, place: { lng: number; lat: number }): Promise<void> {
  const canvas = page.locator('canvas.maplibregl-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('The map is not on the page');
  const point = await page.evaluate(({ lng, lat }) => {
    const map = (window as unknown as { pkMap: { project(lngLat: [number, number]): { x: number; y: number } } }).pkMap;
    const p = map.project([lng, lat]);
    return { x: p.x, y: p.y };
  }, place);
  await canvas.click({ position: point });
}

test.describe('public art', () => {
  test('public art is a layer of its own, off until chosen, with a switch for each kind', async ({ page }, info) => {
    await openMap(page, `v=a&m=16/${STATUE.lat}/${STATUE.lng}`);
    if (isPhone(info)) await page.getByRole('button', { name: 'Lens and layers' }).click();
    const group = page.locator('#pk-left section[aria-labelledby="left-group-placemaking"]');
    await expect(group.getByRole('heading', { name: 'Art and placemaking' })).toBeVisible();
    const toggle = group.getByRole('switch', { name: 'Public art', exact: true });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expectHash(page, 'l', /public_art/);
    for (const label of ['Murals and wall paintings', 'Sculptures and statues', 'Mosaics', 'Works inside buildings']) {
      await expect(group.getByLabel(label, { exact: true })).toBeChecked();
    }
    await group.getByLabel('Mosaics', { exact: true }).uncheck();
    await expectHash(page, 's', /public_art\.mosaics:0/);
    await expect(group).toContainText('Artworks that remember someone are shown without names.');
    await expectAccessible(page, 'the layer list with public art on');
  });

  test('a tapped work shows its title, artist and sources, and a memorial artwork no name', async ({ page }) => {
    await openMap(page, `v=f&m=17/${STATUE.lat}/${STATUE.lng}&l=public_art`);
    await tapAt(page, STATUE);
    const details = page.getByRole('dialog', { name: 'Public art' });
    await expect(details).toBeVisible();
    await expect(details).toContainText('Sample Figure');
    await expect(details).toContainText('A statue');
    await expect(details).toContainText('By Avery Example.');
    await expect(details).toContainText('Made in 1976.');
    for (const link of ["The City's record of this work (PDF)", 'See it on OpenStreetMap', 'See it on Wikidata', 'Read about it on Wikipedia']) {
      await expect(details.getByRole('link', { name: link })).toBeVisible();
    }
    await expect(details.getByRole('link', { name: "More about it on the Association for Public Art's site" })).toBeVisible();
    await expectAccessible(page, 'a work of public art');
    await details.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(details).toBeHidden();

    await page.evaluate(({ lng, lat }) => {
      (window as unknown as { pkMap: { jumpTo(o: { center: [number, number] }): void } }).pkMap.jumpTo({ center: [lng, lat] });
    }, MEMORIAL);
    await expectHash(page, 'm', new RegExp(`/${MEMORIAL.lat.toFixed(4)}`));
    await tapAt(page, MEMORIAL);
    await expect(details).toBeVisible();
    await expect(details).toContainText('Memorial artwork');
    await expect(details).toContainText('This artwork remembers someone. Placekeepers shows no names on memorials');
    await expect(details.getByRole('link', { name: 'See it on Wikidata' })).toBeVisible();
    await expect(details).not.toContainText('By ');
    await expect(details).not.toContainText('Made in');
    await expectAccessible(page, 'a memorial artwork');
  });
});
