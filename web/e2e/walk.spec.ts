// Walking, cycling and people (M3.3) on the sample data, at phone and desktop sizes: the three
// layers sit in their own group, off until chosen; each setting changes the legend; and tapping a
// street on the traffic stress layer tells its level, what it means for people on bikes, and
// where the rating comes from.

import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectHash, isPhone, openMap, SAMPLE_CENTER } from './helpers.ts';

/** Where a sample point (web/scripts/walk-fixtures.mjs) stands, from meters east and north of the
 * sample origin, as make-fixtures.mjs places it. */
function sample(x: number, y: number): { lng: number; lat: number } {
  const lat0 = 39.985;
  const perLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  return { lng: round6(-75.158 + x / perLng), lat: round6(lat0 + y / 111_320) };
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

test.describe('walking, cycling and people', () => {
  test('the three layers sit in their own group, off until chosen, and their settings change the legend', async ({ page }, info) => {
    await openMap(page, `v=a&m=15/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    if (isPhone(info)) await page.getByRole('button', { name: 'Lens and layers' }).click();
    const group = page.locator('#pk-left section[aria-labelledby="left-group-walking"]');
    await expect(group.getByRole('heading', { name: 'Walking, cycling and people' })).toBeVisible();
    const labels = ['How walkable each area is (EPA)', 'People and places within walking distance', 'Traffic stress for people on bikes (DVRPC)'];
    for (const label of labels) {
      const toggle = group.getByRole('switch', { name: label, exact: true });
      await toggle.scrollIntoViewIfNeeded();
      await expect(toggle).not.toBeChecked();
      await toggle.check();
    }
    await expectHash(page, 'l', /walkability/);
    await expectHash(page, 'l', /walking_distance/);
    await expectHash(page, 'l', /traffic_stress/);

    // Walkability: compared within the city by default, with the whole country on request.
    await expect(group.getByText('Least walkable fifth')).toBeVisible();
    await group.getByRole('group', { name: 'Compare with' }).getByRole('radio', { name: /The whole country/ }).check();
    await expect(group.getByText('Most walkable: 15.26 to 20')).toBeVisible();
    await expect(group.getByText('Least walkable fifth')).toBeHidden();
    await expectHash(page, 's', /walkability\.compare:nation/);

    // People and places: people by default, the seven kinds of everyday places on request.
    await expect(group.getByText('Fewer than 1,000 people')).toBeVisible();
    await group.getByRole('group', { name: 'Shade hexagons by' }).getByRole('radio', { name: 'Kinds of everyday places within a 10 minute walk' }).check();
    await expect(group.getByText('All 7 kinds')).toBeVisible();
    await expect(group.getByText(/The seven kinds: a library/)).toBeVisible();

    // Traffic stress: every level, or only the stressful streets.
    await expect(group.getByText('Level 1: calm enough for most people of all ages')).toBeVisible();
    await group.getByRole('group', { name: 'Show', exact: true }).getByRole('radio', { name: /Only stressful streets/ }).check();
    await expect(group.getByText('Level 1: calm enough for most people of all ages')).toBeHidden();
    await expect(group.getByText('Level 4: only for the most fearless riders')).toBeVisible();
    await expectAccessible(page, 'the layer list with the walking layers on');
  });

  test('a tapped street tells its traffic stress and what it means for people on bikes', async ({ page }) => {
    const broad = sample(160, 0);
    await openMap(page, `v=f&m=17/${broad.lat}/${broad.lng}&l=traffic_stress`);
    await tapWhereDrawn(page, 'pk:traffic_stress:line', broad);
    const details = page.getByRole('dialog', { name: 'Traffic stress for bikes' });
    await expect(details).toBeVisible();
    await expect(details).toContainText('Level 4 of 4');
    await expect(details).toContainText('Busy, fast traffic: only the most fearless riders.');
    await expect(details).toContainText('No bike lane.');
    await expect(details).toContainText('Traffic moves at about 35 miles an hour');
    await expect(details).toContainText("From DVRPC's Level of Traffic Stress network");
    await expectAccessible(page, 'traffic stress details');
  });
});
