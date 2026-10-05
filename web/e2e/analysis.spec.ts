// The analysis view, for organizers: filter chips kept in the link, the ranked list, downloads with
// the owner flags, the plot of need against the first step to get permission, saved lists, the
// base map setting, and lot pages that keep their parcel in view, at phone and desktop sizes.

import { readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { LOT, SAMPLE_CENTER, expectHash, expectSelectedInView, hashParams, isPhone, openMap } from './helpers.ts';

// Every sample parcel fits in view, even in the small map a phone leaves above the open drawer.
const IN_VIEW = `v=a&m=15.4/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`;

/** On phones the left panel opens over the map; on larger screens it is always there. */
async function openLeft(page: Page, info: TestInfo) {
  if (isPhone(info)) await page.getByRole('button', { name: 'Lens and layers' }).click();
}

async function closeLeft(page: Page, info: TestInfo) {
  if (isPhone(info)) await page.locator('#pk-left').getByRole('button', { name: 'Close panel' }).click();
}

async function openDrawer(page: Page, name: RegExp) {
  const tab = page.locator('#places-section').getByRole('button', { name });
  if ((await tab.getAttribute('aria-expanded')) !== 'true') await tab.click();
}

const rows = (page: Page) => page.locator('#pk-drawer-table tbody tr');

async function download(page: Page, button: string, scope = page.locator('#pk-drawer-table')): Promise<string> {
  const [file] = await Promise.all([page.waitForEvent('download'), scope.getByRole('button', { name: button }).click()]);
  return readFileSync((await file.path())!, 'utf8');
}

test.describe('analysis view', () => {
  test('filter chips narrow the lots and travel in the link', async ({ page }, info) => {
    await openMap(page, IN_VIEW);
    await openDrawer(page, /Ranked list/);
    await expect(rows(page).first()).toBeVisible();
    const all = await rows(page).count();

    await openLeft(page, info);
    const firstStep = page.locator('[data-filter="first_step"]');
    // A category in its fixed order, never a ranking of how easy a lot is to get.
    await expect(firstStep.locator('label')).toHaveText([
      'No clear route yet',
      'Community LandCare',
      'Garden agreement or license',
      'Ask PHDC',
      'Ask the public agency',
      'Ask the owner',
    ]);
    await firstStep.getByText('Ask the owner', { exact: true }).click();
    await expect(firstStep.getByRole('checkbox', { name: 'Ask the owner' })).toBeChecked();
    await expectHash(page, 'f', /^first_step:5$/);
    await page.locator('[data-filter="min_confidence"]').getByText('Very likely vacant only').click();
    await expectHash(page, 's', /vacant_parcels\.min_confidence:3/);
    await closeLeft(page, info);

    await openDrawer(page, /Ranked list/);
    await expect.poll(() => rows(page).count()).toBeLessThan(all);
    const steps = await rows(page).locator('td:nth-child(5)').allTextContents();
    expect(steps.length).toBeGreaterThan(0);
    expect(new Set(steps)).toEqual(new Set(['Ask the owner']));

    // The same link opens the same filters.
    const link = page.url();
    await page.goto('about:blank');
    await page.goto(link);
    await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });
    await openLeft(page, info);
    await expect(page.locator('[data-filter="first_step"]').getByRole('checkbox', { name: 'Ask the owner' })).toBeChecked();
    await expect(page.locator('[data-filter="min_confidence"]').getByRole('radio', { name: 'Very likely vacant only' })).toBeChecked();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect.poll(async () => (await hashParams(page)).get('f') ?? '').toBe('');
  });

  test('the ranked list shows the first step to get permission and sorts by score', async ({ page }) => {
    await openMap(page, IN_VIEW);
    await openDrawer(page, /Ranked list/);
    await expect(page.locator('#pk-drawer-table th').filter({ hasText: 'First step to get permission' })).toBeVisible();
    await expect(rows(page).first()).toBeVisible();
    const scores = async () => (await rows(page).locator('td.score').allTextContents()).filter(Boolean).map(Number);
    const high = await scores();
    expect(high.length).toBeGreaterThan(3);
    expect(high).toEqual([...high].sort((a, b) => b - a));
    await page.locator('#pk-drawer-table').getByRole('button', { name: /^Score\./ }).click();
    await expect.poll(async () => (await scores())[0]).toBe(Math.min(...high));
    const low = await scores();
    expect(low).toEqual([...low].sort((a, b) => a - b));
    // Rows open their lot page.
    await rows(page).filter({ hasText: LOT.address }).getByRole('button', { name: LOT.address, exact: true }).click();
    await expectHash(page, 'p', new RegExp(`^${LOT.id}$`));
  });

  test('downloads the places in view as CSV and GeoJSON, with the owner flags and the terms first', async ({ page }) => {
    await openMap(page, IN_VIEW);
    await openDrawer(page, /Ranked list/);
    await expect(rows(page).first()).toBeVisible();

    const csv = await download(page, 'Download CSV');
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toMatch(/^# Placekeepers export: for community care and lawful action only\. Read the terms of use first: http:\/\/localhost:\d+\/placekeepers\/terms\/$/);
    const header = lines.find((line) => line.startsWith('opa_account,'))!;
    expect(header.split(',')).toEqual(expect.arrayContaining(['address', 'first_step_to_get_permission', 'owner_names', 'mailing_address', 'owner_flags', 'lot_page']));
    const lot = lines.find((line) => line.startsWith(`${LOT.id},`))!;
    expect(lot).toContain(LOT.address);
    expect(lot).toContain('Possible estate: The owner of record may have died.');
    expect(lot).toContain('A private owner: ask the owner');
    await expect(page.locator('#pk-drawer-table [role="status"]')).toContainText('Downloaded');

    const geojson = await download(page, 'Download GeoJSON');
    expect(geojson.split('\n')[0]).toMatch(/^\{"terms_of_use": "Placekeepers export: for community care and lawful action only\./);
    const parsed = JSON.parse(geojson);
    expect(parsed.type).toBe('FeatureCollection');
    const feature = parsed.features.find((f: { properties: { opa_account: string } }) => f.properties.opa_account === LOT.id);
    expect(feature.geometry.type).toBe('Point');
    const estate = feature.properties.owner_flags.find((f: { id: string }) => f.id === 'possible_estate');
    // Each flag keeps its careful note and protective next step beside it (docs/ETHICS.md).
    expect(estate.text).toBe('The owner of record may have died.');
    expect(estate.careful).toContain('Family members may still have a right to this property');
    expect(estate.next_step).toContain('Tangled Title Fund');
  });

  test('plots need against the first step to get permission, and a dot opens its lot page', async ({ page }, info) => {
    await openMap(page, IN_VIEW);
    await openDrawer(page, /Need and first step/);
    const plot = page.locator('#pk-drawer-plot');
    await expect(plot.getByRole('img', { name: /Need and the first step to get permission/ })).toBeVisible();
    await expect(plot.locator('g.dot').first()).toBeAttached();
    // One row per category in the fixed order, each dot in the row of its own first step.
    await expect(plot.locator('text.row-label')).toHaveText([/^No clear route yet/, /^Community LandCare/, /^Garden agreement or license/, /^Ask PHDC/, /^Ask the public agency/, /^Ask the owner/]);
    await expect(plot.locator(`g.dot[data-place="${LOT.id}"]`)).toHaveAttribute('data-code', '5');

    // Dots of close scores can overlap on a narrow screen, so the click goes to this dot itself.
    await plot.locator(`g.dot[data-place="${LOT.id}"] circle.mark`).dispatchEvent('click');
    await expectHash(page, 'p', new RegExp(`^${LOT.id}$`));
    if (!isPhone(info)) await expect(page.locator('#pk-right').getByRole('heading', { name: LOT.address })).toBeVisible();
  });

  test('saved lists: name one, add and remove places, download it and open it again', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await openMap(page, IN_VIEW);
    await openDrawer(page, /Saved lists/);
    const lists = page.locator('#pk-drawer-lists');
    await expect(lists).toContainText('Lists stay in this browser, on this device. Nothing is sent anywhere.');
    await lists.getByRole('button', { name: 'New list' }).click();
    await lists.getByLabel('Name for the new list').fill('Block walk');
    await lists.getByRole('button', { name: 'Make the list' }).click();
    await expect(lists.getByRole('heading', { name: /Block walk/ })).toBeVisible();

    await openDrawer(page, /Ranked list/);
    await expect(rows(page).first()).toBeVisible();
    await rows(page).nth(0).getByRole('button', { name: /^Save / }).click();
    await rows(page).nth(1).getByRole('button', { name: /^Save / }).click();
    await expect(rows(page).nth(0).getByRole('button', { name: /^Save / })).toHaveAttribute('aria-pressed', 'true');

    await openDrawer(page, /Saved lists/);
    await expect(lists.locator('ul.places li')).toHaveCount(2);
    await lists.locator('ul.places li').first().getByRole('button', { name: /^Remove / }).click();
    await expect(lists.locator('ul.places li')).toHaveCount(1);

    const file = await download(page, 'Download GeoJSON', lists);
    expect(JSON.parse(file).name).toBe('Block walk');
    await lists.getByRole('button', { name: 'Delete this list' }).click();
    await expect(lists).toContainText('No lists yet.');

    await lists.locator('input[type="file"]').setInputFiles({ name: 'block-walk.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(file) });
    await expect(lists).toContainText('Opened "Block walk" with 1 place.');
    await expect(lists.locator('ul.places li')).toHaveCount(1);
  });

  test('a lot page keeps its parcel in view, from a link and with Show on map', async ({ page }, info) => {
    if (!isPhone(info)) await page.setViewportSize({ width: 800, height: 800 });
    await openMap(page, `v=a&m=18/${LOT.lat}/${LOT.lng}&p=${LOT.id}`);
    const details = page.locator('#pk-right');
    await expect(details.getByRole('heading', { name: LOT.address })).toBeVisible();
    // At 800 pixels the lot page covers the right of the map, and the parcel sits left of it.
    if (!isPhone(info)) await expectSelectedInView(page);
    // On a phone the lot page covers the whole map: Show on map closes it and shows the parcel.
    await details.getByRole('button', { name: 'Show on map' }).click();
    await expectSelectedInView(page);
    if (isPhone(info)) await expect(details).toBeHidden();
    else await expect(details).toBeVisible();
  });

  test('the base map is a setting kept in the link', async ({ page }, info) => {
    await openMap(page, IN_VIEW);
    await openLeft(page, info);
    const layers = page.locator('#pk-left');
    const base = layers.getByRole('switch', { name: 'Base map' });
    await expect(base).toBeChecked();
    // Without the base map file, as in these tests, it says so.
    await expect(layers).toContainText('The base map is not available here, so the map shows a plain background.');
    await layers.getByRole('radio', { name: 'Gray, so the data stands out' }).check();
    await expectHash(page, 's', /basemap\.look:muted/);
    await base.uncheck();
    await expectHash(page, 'l', /(^|,)-basemap(,|$)/);
    await base.check();
    await expect.poll(async () => (await hashParams(page)).get('l') ?? '').not.toContain('basemap');
  });
});
