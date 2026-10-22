// "Did it work?" (M5.4, issue #48), at phone and desktop sizes: the page shows the real study's
// numbers (the sample's tables/didit.json is data/didit/results.json, scripts/didit-fixtures.mjs),
// each with its verdict, interval, sample size and checks, the trials first, nothing for axe to
// flag, no sideways scroll on a small phone, and a print layout without the controls. A lot page
// that had care says when and links to the page, and never judges the one lot.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, isPhone, openMap } from './helpers.ts';

const results = JSON.parse(readFileSync(new URL('../../data/didit/results.json', import.meta.url), 'utf8'));
const landcare = results.kinds.find((k: { id: string }) => k.id === 'landcare');
const shootings = landcare.results.find((r: { outcome: string }) => r.outcome === 'shootings');
const demolition = results.kinds.find((k: { id: string }) => k.id === 'demolition');
const demolitionShootings = demolition.results.find((r: { outcome: string }) => r.outcome === 'shootings');

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(scroll, 'the page scrolls sideways').toBeLessThanOrEqual(width);
}

const percentWords = (p: number) => `${Math.abs(p).toFixed(1)}% ${p < 0 ? 'fewer' : 'more'}`;

test.describe('Did it work?', () => {
  test('shows every comparison with its verdict, interval, size and checks, and reads on a phone', async ({ page }, info) => {
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    if (isPhone(info)) await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./did-it-work/');
    await expect(page.getByRole('heading', { level: 1, name: 'Did it work?' })).toBeVisible();
    await expect(page).toHaveTitle('Did it work? Placekeepers');

    // The short answer, then the trials as the real evidence.
    const short = page.locator('section.short');
    await expect(short).toContainText('We made 9 comparisons.');
    await expect(short).toContainText('None of this is a verdict on any one lot.');
    await expect(page.getByRole('heading', { name: 'The real evidence: trials in Philadelphia' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Read the greening trial' })).toHaveAttribute('href', 'https://doi.org/10.1073/pnas.1718503115');

    // LandCare and shootings: the check failed, so we could not tell, with the numbers behind it.
    const lc = page.locator('section[data-kind="landcare"] article[data-outcome="shootings"]');
    await expect(lc).toHaveAttribute('data-verdict', shootings.verdict);
    await expect(lc).toContainText('We could not tell.');
    await expect(lc).toContainText(`Compared: ${shootings.main.places} places that got care`);
    await expect(lc).toContainText(`Check failed: pretending care came four and a half years earlier, the comparison found ${percentWords(shootings.placebo.percent)}`);
    await expect(lc).toContainText(`A simple before and after would say ${percentWords(shootings.naive)}`);

    // Demolitions and shootings: more after care, the interval in words, and why that is not cause.
    const demo = page.locator('section[data-kind="demolition"] article[data-outcome="shootings"]');
    await expect(demo).toHaveAttribute('data-verdict', demolitionShootings.verdict);
    await expect(demo).toContainText(
      `${demolitionShootings.main.percent.toFixed(1)}% more shootings nearby than expected from similar places without care (90 percent interval: ${percentWords(demolitionShootings.main.low)} to ${percentWords(demolitionShootings.main.high)}).`,
    );
    await expect(demo).toContainText('This does not show that care caused them.');

    // Every kind of care has its three outcomes; projects say how many there are and what is needed.
    for (const kind of ['landcare', 'clean_seal', 'demolition']) {
      await expect(page.locator(`section[data-kind="${kind}"] article.result`)).toHaveCount(3);
    }
    const projects = page.locator('section[data-kind="projects"]');
    await expect(projects).toContainText('The map shows 4 projects neighbors finished.');
    await expect(projects).toContainText('A comparison needs at least 100.');
    await expect(page.getByRole('heading', { name: 'What this cannot tell' })).toBeVisible();

    await expectAccessible(page, 'the Did it work? page');
    await noSidewaysScroll(page);

    // The site menu lists the page, marked as the current one.
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Site menu' });
    await expect(menu.getByRole('link', { name: 'Did it work?' })).toHaveAttribute('aria-current', 'page');
  });

  test('prints without its controls', async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    await page.goto('./did-it-work/');
    await expect(page.locator('section[data-kind="landcare"] article.result').first()).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: 'Print this page' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Tell us about a project you finished' })).toBeHidden();
    await expect(page.locator('section[data-kind="landcare"] article.result').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How we compared' })).toBeVisible();
  });

  test('a lot page that had care says when and links to the citywide page', async ({ page }) => {
    await openMap(page, 'v=a&m=16/40.06/-75.03&p=990000002');
    const details = page.locator('#pk-right');
    await expect(details.getByRole('heading', { name: '1203 N SAMPLE ST' })).toBeVisible();
    await expect(details.getByText('Already maintained by PHS LandCare since 2016.')).toBeVisible();
    const note = details.locator('.care-note');
    await expect(note).toContainText('One lot cannot show whether care worked');
    await expect(note.getByRole('link', { name: "See what the City's records show for all of Philadelphia" })).toHaveAttribute(
      'href',
      '/placekeepers/did-it-work/',
    );
    await expect(details).not.toContainText(/this lot (worked|did not work)/i);
  });

  test('a building the City cleaned and sealed says on what day', async ({ page }) => {
    await openMap(page, 'v=a&m=16/40.06/-75.03&p=990000001');
    const details = page.locator('#pk-right');
    await expect(details.getByText('The City last cleaned and sealed it on February 14, 2024.')).toBeVisible();
    await expect(details.locator('.care-note')).toContainText('One lot cannot show whether care worked');
  });
});
