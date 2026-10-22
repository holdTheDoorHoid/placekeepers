// The neighbor flyer (M5.2, issue #46) on the sample data, at phone and desktop sizes: it opens from
// a lot page, shows the address, the hopes and the contact typed, a QR code to the lot's page with
// nothing that tracks who scans it, the warning that what is printed is public, and the guide to
// where posting is allowed (also reachable from the How page); it prints on one Letter page, or two
// half pages to a sheet; and nothing typed ever leaves the browser.

import { expect, test, type Page } from '@playwright/test';
import { LOT, expectAccessible, isPhone, openMap } from './helpers.ts';

async function offline(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.route('**/data/basemap/**', (route) => route.abort());
}

test.describe('the neighbor flyer', () => {
  test('opens from the lot page with the lot and its point after "#"', async ({ page, context }, info) => {
    const phone = isPhone(info);
    await openMap(page, `v=${phone ? 'f' : 'a'}&m=17/${LOT.lat}/${LOT.lng}&p=${LOT.id}`);
    const link = (phone ? page.getByRole('dialog', { name: LOT.address }) : page.locator('#pk-right')).getByRole('link', { name: 'Make a flyer for neighbors' });
    const href = await link.getAttribute('href');
    expect(href).toMatch(new RegExp(`flyer/#opa=${LOT.id}(&at=-75\\.\\d+,39\\.\\d+)?$`));
    await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    const [flyer] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await flyer.waitForLoadState();
    await expect(flyer.getByTestId('flyer')).toContainText(LOT.address);
  });

  test('says what neighbors hope to do and how to reach them, with a QR code to the lot\'s page', async ({ page, context }, info) => {
    const sent: string[] = [];
    context.on('request', (request) => sent.push(`${request.url()} ${request.postData() ?? ''}`));
    await offline(page);
    await page.goto(`./flyer/#opa=${LOT.id}&at=${LOT.lng},${LOT.lat}`);
    const flyer = page.getByTestId('flyer');
    await expect(flyer).toContainText('Neighbors care about this lot');
    await expect(flyer).toContainText(LOT.address);
    await expect(page.getByRole('note')).toContainText('What you print is public');

    await page.getByLabel('A garden').check();
    await page.getByLabel('Or in your own words').fill('Zq9 keep it open for kids');
    await page.getByLabel('How neighbors can reach you').fill('Zq9 group chat at chat.example.org');
    await page.getByLabel('Your own link for a second QR code (optional)', { exact: true }).fill('https://chat.example.org/invite/Zq9');
    await expect(flyer).toContainText('Plant a garden');
    await expect(flyer).toContainText('Zq9 keep it open for kids');
    await expect(flyer).toContainText('Zq9 group chat at chat.example.org');

    const codes = flyer.locator('svg.qr');
    await expect(codes).toHaveCount(2);
    const lotUrl = await codes.nth(0).getAttribute('data-qr');
    const url = new URL(lotUrl!);
    expect(url.origin).toBe(new URL(page.url()).origin);
    expect(url.pathname).toBe('/placekeepers/');
    expect(url.search).toBe('');
    expect(url.hash).toBe(`#p=${LOT.id}`);
    await expect(codes.nth(1)).toHaveAttribute('data-qr', 'https://chat.example.org/invite/Zq9');

    // A phone number in the contact field brings a reminder, never a block.
    await page.getByLabel('How neighbors can reach you').fill('Call 215-555-0100');
    await expect(page.getByText('This looks like it may be a home address or a personal phone number.')).toBeVisible();
    await expect(flyer).toContainText('Call 215-555-0100');

    // Where you may post it, lawful places first, with the guide one tap away.
    await expect(page.getByRole('heading', { name: 'Where you may post it' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Read the guide, with its sources' })).toHaveAttribute('href', '/placekeepers/posting/');
    await expectAccessible(page, 'flyer');

    await page.reload();
    await expect(page.getByLabel('How neighbors can reach you')).toHaveValue('Call 215-555-0100');
    for (const request of sent) {
      expect(request, 'flyer text left the browser').not.toContain('Zq9');
      expect(request).not.toContain('555-0100');
    }
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Clear what I typed' }).click();
    expect(await page.evaluate(() => localStorage.getItem('placekeepers:v1:flyer'))).toBeNull();

    if (isPhone(info)) return;
    // On paper: one Letter page, or two half pages to a sheet.
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.controls')).toBeHidden();
    const pdfPages = async () => ((await page.pdf({ format: 'Letter' })).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(await pdfPages()).toBe(1);
    await page.emulateMedia({ media: 'screen' });
    await page.getByLabel('Half page, two to a sheet').check();
    await expect(page.getByTestId('flyer').locator('article')).toHaveCount(2);
    await page.emulateMedia({ media: 'print' });
    expect(await pdfPages()).toBe(1);
  });

  test('prints in any language of the site, and in two side by side with English', async ({ page, context }, info) => {
    const sent: string[] = [];
    context.on('request', (request) => sent.push(`${request.url()} ${request.postData() ?? ''}`));
    // The page's own language by default (in a tab of its own, since a ?lang= link holds for the
    // rest of a visit in its tab).
    const spanish = await context.newPage();
    await offline(spanish);
    await spanish.goto(`./flyer/?lang=es#opa=${LOT.id}&at=${LOT.lng},${LOT.lat}`);
    await expect(spanish.getByTestId('flyer')).toContainText('A los vecinos les importa este lote');
    await expect(spanish.getByTestId('flyer').locator('article').first()).toHaveAttribute('lang', 'es');
    await spanish.close();

    // Another language, from a page in English: Arabic, right to left, with what was typed as typed.
    await offline(page);
    await page.goto(`./flyer/#opa=${LOT.id}&at=${LOT.lng},${LOT.lat}`);
    const flyer = page.getByTestId('flyer');
    await page.getByLabel('Flyer language').selectOption('ar');
    await expect(flyer).toContainText('الجيران يهتمون بهذه القطعة');
    await expect(flyer).not.toContainText('Neighbors care about this lot');
    await expect(flyer.locator('article').first()).toHaveAttribute('dir', 'rtl');
    // The address from City records keeps its number in front inside the Arabic flyer.
    await expect(flyer.locator('.address').first()).toHaveAttribute('dir', 'auto');
    await page.getByLabel('A garden').check();
    await page.getByLabel('How neighbors can reach you').fill('Zq9 group chat at chat.example.org');
    await expect(flyer).toContainText('نأمل أن');
    await expect(flyer).toContainText('Zq9 group chat at chat.example.org');

    // English beside it, in a second column; the address and what was typed appear once.
    await page.getByLabel('Add English beside it, in a second column').check();
    await expect(flyer).toContainText('Neighbors care about this lot');
    await expect(flyer).toContainText('الجيران يهتمون بهذه القطعة');
    await expect(flyer.locator('article').first().locator('.headline [lang="en"]')).toHaveText('Neighbors care about this lot');
    await expect(flyer.getByText('Zq9 group chat at chat.example.org')).toHaveCount(1);
    await expect(flyer.getByText(LOT.address)).toHaveCount(1);
    const [arabic, english] = await flyer.locator('article').first().locator('.headline .side').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x));
    // Side by side, the flyer's language first: Arabic on the right, where an Arabic reader starts.
    expect(english!).toBeLessThan(arabic!);

    // Kept for the next visit, and still nothing sent anywhere.
    await page.reload();
    await expect(page.getByLabel('Flyer language')).toHaveValue('ar');
    await expect(page.getByLabel('Add English beside it, in a second column')).toBeChecked();
    for (const request of sent) expect(request).not.toContain('Zq9');

    if (isPhone(info)) return;
    await expectAccessible(page, 'a flyer in Arabic and English');
    // On paper: still one Letter page, and two half pages to a sheet with nothing cut off.
    await page.emulateMedia({ media: 'print' });
    const pdfPages = async () => ((await page.pdf({ format: 'Letter' })).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(await pdfPages()).toBe(1);
    await page.emulateMedia({ media: 'screen' });
    await page.getByLabel('Half page, two to a sheet').check();
    await page.emulateMedia({ media: 'print' });
    expect(await pdfPages()).toBe(1);
    const cut = await flyer.locator('article').evaluateAll((els) => els.map((el) => el.scrollHeight - el.clientHeight));
    for (const overflow of cut) expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the guide to where posting is allowed is reachable from the How page and cites its sources', async ({ page }) => {
    await offline(page);
    await page.goto('./how/');
    await page.getByRole('link', { name: 'where you may post it' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Where to post a flyer' })).toBeVisible();
    await expect(page.getByText('Philadelphia Code section 10-1202 forbids posting signs')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bill No. 130628' })).toHaveAttribute('href', 'https://files.amlegal.com/pdffiles/Philadelphia/130628.pdf');
    await expectAccessible(page, 'posting guide');
  });
});
