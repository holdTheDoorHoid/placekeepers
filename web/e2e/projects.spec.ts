// Projects neighbors finished (M5.3, issue #47): a layer of its own in the care group, on for
// organizers; a tapped project shows what was done, when, by which group, what it took and a link
// to its report; a lot page lists its projects with the prefilled report form and a timeline switch
// of their own. Nothing is ever asked of GitHub: the reports are plain links.

import { expect, type Page, test } from '@playwright/test';
import { LOT, expectAccessible, isPhone, openMap } from './helpers.ts';

/** The sample bench the City installed at a stop, on no parcel (web/scripts/projects-fixtures.mjs). */
const BENCH = { lng: -75.15655, lat: 39.98535 };

/** Every address the page asks for that is not the site itself. */
function watchOutside(page: Page): string[] {
  const asked: string[] = [];
  page.on('request', (request) => {
    if (!/^https?:\/\/localhost[:/]/.test(request.url())) asked.push(request.url());
  });
  return asked;
}

/** Taps the map where a place is drawn (the test build hands the tests the map as pkMap). */
async function tapAt(page: Page, place: { lng: number; lat: number }): Promise<void> {
  const canvas = page.locator('canvas.maplibregl-canvas');
  const point = await page.evaluate(({ lng, lat }) => {
    const map = (window as unknown as { pkMap: { project(lngLat: [number, number]): { x: number; y: number } } }).pkMap;
    const p = map.project([lng, lat]);
    return { x: p.x, y: p.y };
  }, place);
  await canvas.click({ position: point });
}

test.describe('projects neighbors finished', () => {
  test('are a layer in the care group, on for organizers, with a legend that says each is approved', async ({ page }, info) => {
    await openMap(page, `v=a&m=16/${BENCH.lat}/${BENCH.lng}`);
    if (isPhone(info)) await page.getByRole('button', { name: 'Lens and layers' }).click();
    const group = page.locator('#pk-left section[aria-labelledby="left-group-care"]');
    const toggle = group.getByRole('switch', { name: 'Projects neighbors finished', exact: true });
    await expect(toggle).toBeChecked();
    await expect(group).toContainText('Placekeepers reads and approves every report before it appears.');
    await expect(group).toContainText('The map never shows who sent a report');
  });

  test('a tapped project shows what was done and links its report, asking nothing of GitHub', async ({ page }) => {
    const outside = watchOutside(page);
    await openMap(page, `v=f&m=18/${BENCH.lat}/${BENCH.lng}&l=projects`);
    await tapAt(page, BENCH);
    const details = page.getByRole('dialog', { name: 'Project neighbors finished' });
    await expect(details).toBeVisible();
    await expect(details).toContainText('A shelter or bench the City installed');
    await expect(details).toContainText('Finished in September 2026');
    await expect(details).toContainText('By Sample Stop Riders');
    await expect(details).toContainText('What it took');
    const report = details.getByRole('link', { name: 'See the report and its photos on GitHub' });
    await expect(report).toHaveAttribute('href', 'https://github.com/holdTheDoorHoid/placekeepers/issues/14');
    await expect(report).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(details.locator('img')).toHaveCount(0);
    await expectAccessible(page, 'a project neighbors finished');
    expect(outside.filter((url) => /github/.test(url))).toEqual([]);
  });

  test('a lot page lists its projects, offers the report form for the lot, and puts them in the timeline', async ({ page }) => {
    const outside = watchOutside(page);
    await openMap(page, `v=a&m=16/40.06/-75.03&p=${LOT.id}`);
    const details = page.locator('#pk-right');
    await expect(details.getByRole('heading', { name: LOT.address })).toBeVisible();
    const projects = details.locator('section', { has: page.getByRole('heading', { name: 'Projects here', exact: true }) });
    await expect(projects).toContainText('Garden');
    await expect(projects).toContainText('Finished in May 2026');
    await expect(projects).toContainText('By Example Avenue Growers');
    await expect(projects).toContainText('Cleanup');
    await expect(projects).toContainText('One lot on its own cannot show whether a project worked.');
    await expect(projects.getByRole('link', { name: 'See the report and its photos on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/holdTheDoorHoid/placekeepers/issues/12',
    );
    const tell = projects.getByRole('link', { name: 'Tell us about a project you finished here' });
    const href = new URL((await tell.getAttribute('href'))!);
    expect(href.origin + href.pathname).toBe('https://github.com/holdTheDoorHoid/placekeepers/issues/new');
    expect(href.searchParams.get('template')).toBe('project.yml');
    expect(href.searchParams.get('where')).toContain(`#p=${LOT.id}`);

    const history = details.locator('section', { has: page.getByRole('heading', { name: 'History', exact: true }) });
    await history.getByRole('heading', { name: 'The story of this lot' }).scrollIntoViewIfNeeded();
    const events = history.locator('.events li.event');
    await expect(events.filter({ hasText: 'Garden, by Example Avenue Growers' })).toHaveCount(1);
    await history.getByRole('checkbox', { name: /Projects neighbors finished/ }).uncheck();
    await expect(events.filter({ hasText: 'Garden, by Example Avenue Growers' })).toHaveCount(0);
    await history.getByRole('checkbox', { name: /Projects neighbors finished/ }).check();
    await expectAccessible(page, 'a lot page with projects');
    expect(outside.filter((url) => /github/.test(url))).toEqual([]);
  });
});
