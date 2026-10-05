// Amenities and conditions (M3.5) on the sample data, at phone and desktop sizes: drinking water
// and toilets are on in the field view and tapping a toilet tells what OpenStreetMap says about
// it; a 311 condition layer turns on from the layer list, with its setting and legend, and tapping
// a block tells how many requests were made there, never an address.

import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, openMap } from './helpers.ts';

/** Where a sample point (web/scripts/amenity-fixtures.mjs) stands, from meters east and north of
 * the sample origin, as make-fixtures.mjs places it. */
function sample(x: number, y: number): { lng: number; lat: number } {
  const lat0 = 39.985;
  const perLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  return { lng: round6(-75.158 + x / perLng), lat: round6(lat0 + y / 111_320) };
}

/** Taps the first feature a map part draws, once the map has drawn it. */
async function tapFeature(page: Page, part: string): Promise<void> {
  const canvas = page.locator('canvas.maplibregl-canvas');
  let spot: { x: number; y: number } | null = null;
  await expect
    .poll(
      async () => {
        spot = await page.evaluate((layerId) => {
          type Feature = { geometry: { type: string; coordinates: [number, number] } };
          const map = (window as unknown as {
            pkMap: { getLayer(id: string): unknown; queryRenderedFeatures(options: { layers: string[] }): Feature[]; project(c: [number, number]): { x: number; y: number } };
          }).pkMap;
          if (!map.getLayer(layerId)) return null;
          const found = map.queryRenderedFeatures({ layers: [layerId] }).find((f) => f.geometry.type === 'Point');
          return found ? map.project(found.geometry.coordinates) : null;
        }, part);
        return spot !== null;
      },
      { timeout: 30_000, intervals: [500, 1000] },
    )
    .toBe(true);
  const box = (await canvas.boundingBox())!;
  const { x, y } = spot!;
  await page.mouse.click(box.x + x, box.y + y);
}

test.describe('amenities and conditions', () => {
  test('drinking water and toilets are on in the field view, and a toilet says what is mapped', async ({ page }) => {
    const toilet = sample(420, -40);
    await openMap(page, `v=f&m=17.5/${toilet.lat}/${toilet.lng}`);
    await tapFeature(page, 'pk:toilets:dot');
    const details = page.getByRole('dialog', { name: 'As mapped in OpenStreetMap' });
    await expect(details).toBeVisible();
    await expect(details.getByRole('heading', { name: 'Sample Park toilets' })).toBeVisible();
    await expect(details).toContainText('Open to anyone');
    await expect(details).toContainText('Free');
    await expect(details.getByRole('link', { name: 'See it on OpenStreetMap' })).toHaveAttribute('href', 'https://www.openstreetmap.org/node/9100031');
    await expect(details.getByRole('link', { name: 'Missing or wrong? How to fix it' })).toHaveAttribute('href', /\/placekeepers\/streetcomplete\/$/);
    await expectAccessible(page, 'toilet details');
  });

  test('a 311 layer turns on with its setting and legend, and a block never names an address', async ({ page }) => {
    const block = sample(400, -60);
    await openMap(page, `v=f&m=17.5/${block.lat}/${block.lng}`);
    await page.getByRole('button', { name: 'More layers', exact: true }).click();
    const layers = page.getByRole('dialog', { name: 'Layers' });
    const layerSwitch = layers.getByRole('switch', { name: 'Illegal dumping reported to 311' });
    await layerSwitch.scrollIntoViewIfNeeded();
    await layerSwitch.check();
    await expect(layers.getByText('Illegal dumping: a request still open')).toBeVisible();
    await expect(layers.getByText('Illegal dumping: every request closed')).toBeVisible();
    await layers.getByRole('group', { name: 'Show blocks with' }).getByRole('radio', { name: 'A request still open' }).check();
    await expect(layers.getByText('Illegal dumping: every request closed')).toBeHidden();
    await expectAccessible(page, 'layers with a 311 layer');
    await page.keyboard.press('Escape');
    await tapFeature(page, 'pk:dumping:open');
    const details = page.getByRole('dialog', { name: 'Reported to 311' });
    await expect(details).toBeVisible();
    await expect(details).toContainText('3 requests to Philly311 in the last 90 days, 1 still open.');
    await expect(details).toContainText('On this block of Sample 3 St.');
    await expect(details.getByRole('link', { name: 'Report it to Philly311' })).toBeVisible();
  });
});
