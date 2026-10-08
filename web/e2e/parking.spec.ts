// Parking problems reported with Laser Vision (issue #37) on the sample data, at phone and desktop
// sizes: the layer sits in the street safety group, off until chosen, with its window and its
// threshold in the legend and a setting for the kind; tapping an area close in gives its counts by
// kind, the window, the physical fixes they support and the credit with a link to Philly Bike
// Action's map. The browser never asks bikeaction.org for anything: the counts come with our tiles.

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { expectAccessible, expectHash, isPhone, openMap, SAMPLE_CENTER } from './helpers.ts';

/** Words the layer must never use (docs/ETHICS.md, "Policing"). */
const NEVER = /ticket|citation|parking authority|enforce|police|report(ing)? (a |the )?drivers?|plate/i;

/** The middle sample cell of web/scripts/parking-fixtures.mjs: 300 meters east and 60 north of the
 * sample origin, as make-fixtures.mjs places it. */
function sample(x: number, y: number): { lng: number; lat: number } {
  const lat0 = 39.985;
  const perLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  return { lng: round6(-75.158 + x / perLng), lat: round6(lat0 + y / 111_320) };
}

/** Every host the browser asks for anything. */
function watchHosts(context: BrowserContext): Set<string> {
  const hosts = new Set<string>();
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') hosts.add(url.hostname);
  });
  return hosts;
}

/** Taps a place on the map once a map part draws something there. */
async function tapWhereDrawn(page: Page, part: string, at: { lng: number; lat: number }): Promise<void> {
  const canvas = page.locator('canvas.maplibregl-canvas');
  let spot: { x: number; y: number } | null = null;
  await expect
    .poll(
      async () => {
        spot = await page.evaluate(
          ({ layerId, lngLat }) => {
            const map = (window as unknown as {
              pkMap: {
                getLayer(id: string): unknown;
                project(c: [number, number]): { x: number; y: number };
                queryRenderedFeatures(point: [number, number], options: { layers: string[] }): unknown[];
              };
            }).pkMap;
            if (!map.getLayer(layerId)) return null;
            const { x, y } = map.project(lngLat);
            return map.queryRenderedFeatures([x, y], { layers: [layerId] }).length ? { x, y } : null;
          },
          { layerId: part, lngLat: [at.lng, at.lat] as [number, number] },
        );
        return spot !== null;
      },
      { timeout: 30_000, intervals: [500, 1000] },
    )
    .toBe(true);
  const box = (await canvas.boundingBox())!;
  const { x, y } = spot!;
  await page.mouse.click(box.x + x, box.y + y);
}

test.describe('parking problems reported', () => {
  test('the layer sits with street safety, off until chosen, with its window, threshold and kinds', async ({ page, context }, info) => {
    const hosts = watchHosts(context);
    await openMap(page, `v=a&m=15/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    if (isPhone(info)) await page.getByRole('button', { name: 'Lens and layers' }).click();
    const group = page.locator('#pk-left section[aria-labelledby="left-group-streets"]');
    const toggle = group.getByRole('switch', { name: 'Parking problems reported (Laser Vision)', exact: true });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expectHash(page, 'l', /parking_reports/);

    await expect(group.getByText('Zoomed out: where reports cluster. From October 4, 2025 to October 3, 2026.')).toBeVisible();
    await expect(group.getByText(/Areas with fewer than 5 reports are left out, so no single report shows/)).toBeVisible();
    await expect(group.getByText(/Philly Bike Action's Laser Vision/).first()).toBeVisible();
    await expect(group.getByText('100 or more')).toBeVisible();
    await group.getByRole('group', { name: 'Show reports of vehicles' }).getByRole('radio', { name: 'Blocking a curb ramp' }).check();
    await expectHash(page, 's', /parking_reports\.kind:ramp/);
    await expect(group.getByText('80 or more')).toBeVisible();
    const layer = group.locator('.layer.on').filter({ has: page.getByRole('switch', { name: 'Parking problems reported (Laser Vision)', exact: true }) });
    await expect(layer).toContainText('Blocking a curb ramp');
    await expect(layer).not.toContainText(NEVER);
    await expectAccessible(page, 'the layer list with the parking reports on');
    expect([...hosts].filter((host) => host.includes('bikeaction'))).toEqual([]);
  });

  test('a tapped area gives its counts by kind, the window, the fixes and the credit', async ({ page, context }) => {
    const hosts = watchHosts(context);
    const middle = sample(300, 60);
    await openMap(page, `v=f&m=16/${middle.lat}/${middle.lng}&l=parking_reports`);
    await tapWhereDrawn(page, 'pk:parking_reports:cells', middle);
    const details = page.getByRole('dialog', { name: 'Parking problems reported' });
    await expect(details).toBeVisible();
    await expect(details).toContainText('142 reports of vehicles blocking the way. From October 4, 2025 to October 3, 2026.');
    await expect(details.getByRole('listitem').filter({ hasText: 'On a sidewalk' })).toContainText('61');
    await expect(details.getByRole('listitem').filter({ hasText: 'Blocking a curb ramp' })).toContainText('7');
    await expect(details).toContainText('curb extensions, bollards, daylighted corners, protected bike lanes and loading zones');
    const credit = details.getByRole('link', { name: "From Philly Bike Action's Laser Vision map" });
    await expect(credit).toHaveAttribute('href', 'https://bikeaction.org/tools/laser/map/');
    await expect(credit).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(details).not.toContainText(NEVER);
    await expectAccessible(page, 'parking report details');
    expect([...hosts].filter((host) => host.includes('bikeaction'))).toEqual([]);
  });
});
