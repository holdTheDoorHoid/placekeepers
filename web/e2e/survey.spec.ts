// The "Survey a route" page (M2.4) on the sample data, at phone and desktop sizes: picking a
// route, a direction and how many people share it, the sheet in order with what OpenStreetMap
// shows, boxes kept on this device across a reload, an address that can be shared, no sideways
// scrolling, no accessibility problems axe can find, and a print layout on letter paper with only
// the sheet.

import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './helpers.ts';

/** Opens the survey page with nothing leaving the machine. */
async function openSurvey(page: Page, query = ''): Promise<void> {
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.goto(`./survey/${query}`);
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(scroll, 'the page scrolls sideways').toBeLessThanOrEqual(width);
}

test.describe('survey a route', () => {
  test('pick a route and get its sheet, split among volunteers, with boxes kept on this device', async ({ page }) => {
    await openSurvey(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Survey a route' })).toBeVisible();
    const route = page.getByRole('combobox', { name: 'Route' });
    await expect(route.locator('optgroup')).toHaveCount(2);
    await route.selectOption('60');

    await expect(page.getByRole('heading', { name: 'Route 60, Eastbound to Sample Loop', exact: true })).toBeVisible();
    await expect(page.getByText('6 stops in Philadelphia')).toBeVisible();
    await expect(page.getByText(/Our estimate: about \d+ minutes for one person or pair/)).toBeVisible();
    await expect(page).toHaveURL(/survey\/\?route=60&d=0$/);

    const rows = page.locator('section.part tbody tr');
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(0)).toContainText('Sample 2 St & Sample 1 Ave');
    await expect(rows.nth(0)).toContainText('Shelter');
    await expect(rows.nth(3)).toContainText('Not found in OpenStreetMap');
    await expect(rows.nth(4)).toContainText('Not yet surveyed');
    await expect(rows.nth(0).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', 'https://www.openstreetmap.org/edit?node=9000001');

    await page.getByRole('combobox', { name: 'Split among' }).selectOption('2');
    await expect(page.getByRole('heading', { name: /Part 2 of 2: stops 4 to 6/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print part 2 only' })).toBeVisible();
    await expect(page).toHaveURL(/route=60&d=0&parts=2$/);

    const shelterYes = page.getByRole('checkbox', { name: 'Stop 2, Sample 2 St & Sample 4 Ave: Shelter, Yes' });
    const shelterNo = page.getByRole('checkbox', { name: 'Stop 2, Sample 2 St & Sample 4 Ave: Shelter, No' });
    await shelterYes.check();
    await shelterNo.check();
    await expect(shelterYes).not.toBeChecked();
    await page.getByRole('textbox', { name: 'Stop 2, Sample 2 St & Sample 4 Ave: notes' }).fill('Bench is cracked');
    await page.getByRole('textbox', { name: 'Stop 2, Sample 2 St & Sample 4 Ave: notes' }).press('Tab');
    await expect(page.getByText('You have filled in 1 of 6 stops on this device.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: /Part 2 of 2/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Stop 2, Sample 2 St & Sample 4 Ave: Shelter, No' })).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'Stop 2, Sample 2 St & Sample 4 Ave: notes' })).toHaveValue('Bench is cracked');

    await page.getByRole('combobox', { name: 'Direction' }).selectOption('1');
    await expect(page.getByRole('heading', { name: 'Route 60, Westbound to Sample 1 Ave', exact: true })).toBeVisible();
    await expect(page.getByText('1 more stop is outside Philadelphia and not on this sheet.')).toBeVisible();
    await noSidewaysScroll(page);
    await expectAccessible(page, 'survey page');
  });

  test('a trolley route says to leave out the tunnel stations, and a shared address opens its sheet', async ({ page }) => {
    await openSurvey(page, '?route=T1&d=1');
    await expect(page.getByRole('heading', { name: 'Route T1, Westbound to 63rd-Malvern', exact: true })).toBeVisible();
    await expect(page.getByText(/run underground at their Center City end/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Direction' })).toHaveValue('1');
    await noSidewaysScroll(page);
  });

  test('prints only the sheets, black on white, within letter paper', async ({ page }) => {
    await page.setViewportSize({ width: 730, height: 1000 });
    await openSurvey(page, '?route=60&d=0&parts=2');
    await expect(page.getByRole('heading', { name: /Part 1 of 2/ })).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('heading', { level: 1, name: 'Survey a route' })).toBeHidden();
    await expect(page.getByRole('combobox', { name: 'Route' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Edit' }).first()).toBeHidden();
    await expect(page.locator('section.part')).toHaveCount(2);
    await expect(page.locator('section.part .box').first()).toBeVisible();
    await expect(page.locator('section.part').nth(1)).toHaveCSS('break-before', 'page');
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('section.part table')].some((table) => table.scrollWidth > (table.parentElement?.clientWidth ?? 0) + 1),
    );
    expect(overflow, 'a sheet is wider than the page').toBe(false);
    const pdf = await page.pdf({ format: 'Letter', preferCSSPageSize: true });
    expect(pdf.length).toBeGreaterThan(1000);
  });

  test('says so when the sheets are not published', async ({ page }) => {
    await page.route('**/data/tables/routes/index.json', (route) => route.fulfill({ status: 404, body: 'Not found' }));
    await openSurvey(page);
    await expect(page.getByText('Survey sheets are not published yet.')).toBeVisible();
  });
});
