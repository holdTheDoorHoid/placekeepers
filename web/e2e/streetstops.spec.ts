// Streets and stops (M4.5): the City's street poles, traffic calming and school crossing guard posts
// sit in the streets group and its bus shelters in the buses and trains group, each off until
// chosen, with a toggle of its own.

import { expect, test } from '@playwright/test';
import { expectAccessible, expectHash, isPhone, openMap, SAMPLE_CENTER } from './helpers.ts';

test.describe('streets and stops', () => {
  test('the four new layers are off until chosen, each with its own switch', async ({ page }, info) => {
    await openMap(page, `v=a&m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`);
    if (isPhone(info)) await page.getByRole('button', { name: 'Lens and layers' }).click();
    const streets = page.locator('#pk-left section[aria-labelledby="left-group-streets"]');
    for (const [label, id] of [
      ['Street poles and the lamps the City lists', 'street_poles'],
      ['Traffic calming the City lists', 'traffic_calming'],
      ['School crossing guard posts', 'crossing_guards'],
    ] as const) {
      const toggle = streets.getByRole('switch', { name: label, exact: true });
      await toggle.scrollIntoViewIfNeeded();
      await expect(toggle).not.toBeChecked();
      await toggle.check();
      await expectHash(page, 'l', new RegExp(id));
    }
    const transit = page.locator('#pk-left section[aria-labelledby="left-group-transit"]');
    const shelters = transit.getByRole('switch', { name: 'Bus shelters the City lists', exact: true });
    await shelters.scrollIntoViewIfNeeded();
    await expect(shelters).not.toBeChecked();
    await shelters.check();
    await expectHash(page, 'l', /city_shelters/);
    await expectAccessible(page, 'the layer list with the streets and stops layers on');
  });
});
