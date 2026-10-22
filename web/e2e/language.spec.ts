// Languages (issue #49): the picker in the top bar and in Settings, the language carried in links,
// the first visit offer, English fallbacks marked for screen readers, the note on every translated
// page, Arabic right to left, and the checks with axe in Spanish and Arabic.
//
// Every language will soon be fully translated, so no real language serves as the "not translated
// yet" example. A test that needs English shown in its place asks the end to end build to leave
// part of a catalog or a content page out (leaveOut, src/i18n/boot.ts), so the fallback and its
// lang="en" marking stay tested however complete the translations are.

import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_CENTER, expectAccessible, isPhone, openMap } from './helpers.ts';

const FIELD = `v=f&m=16/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`;
const ANALYSIS = `v=a&m=15.4/${SAMPLE_CENTER.lat}/${SAMPLE_CENTER.lng}`;

/** Opens the map in a language, as a link with ?lang= would. */
async function openIn(page: Page, lang: string, hash: string): Promise<void> {
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.route('**/data/basemap/**', (route) => route.abort());
  await page.goto(`./?lang=${lang}#${hash}`);
  await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });
}

/** Parts of the interface the tests of English fallbacks treat as not translated yet. */
const UNTRANSLATED = ['search', 'layers', 'legend', 'field', 'sheet', 'chips', 'place'];

/**
 * Asks the end to end build to leave these catalog keys and content pages out of the next page
 * loads, as if their translation did not exist yet (window.__PK_E2E_LEAVE_OUT__, src/i18n/boot.ts).
 */
async function leaveOut(page: Page, what: { strings?: string[]; pages?: string[] }): Promise<void> {
  await page.addInitScript((value) => {
    (window as unknown as { __PK_E2E_LEAVE_OUT__?: unknown }).__PK_E2E_LEAVE_OUT__ = value;
  }, what);
}

/** The language a screen reader would use for an element: its own or its nearest ancestor's. */
async function langOf(page: Page, selector: string): Promise<string | null> {
  return page.locator(selector).first().evaluate((el) => el.closest('[lang]')?.getAttribute('lang') ?? null);
}

test.describe('languages', () => {
  test('the top bar picker switches to Spanish, keeps it in the address and in this browser', async ({ page }) => {
    await openMap(page, FIELD);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // No note about translation on a page in English.
    await expect(page.getByText('Translated with the help of AI')).toHaveCount(0);

    await page.getByRole('button', { name: /^Language: English/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Language' });
    await expect(dialog).toBeVisible();
    // Each language in its own name and script, for the people who read it.
    for (const name of ['English', 'Español', '简体中文', 'Tiếng Việt', 'Русский', 'Português (Brasil)', 'Kreyòl ayisyen', 'ភាសាខ្មែរ', 'Français', 'العربية']) {
      await expect(dialog.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(dialog.locator('[lang="km"]').first()).toHaveText('ភាសាខ្មែរ');
    await Promise.all([page.waitForURL(/[?&]lang=es/), dialog.getByRole('button', { name: /Español/ }).click()]);
    await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('button', { name: 'Ajustes' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Idioma: Español/ })).toBeVisible();
    // The note that the translation was made with the help of AI, with the form to fix it.
    const fix = page.getByRole('link', { name: 'Corregir una traducción' }).first();
    await expect(fix).toHaveAttribute('href', /template=fix-translation\.yml/);
    await expect(fix).toHaveAttribute('href', /language=Spanish/);

    // Remembered in this browser: the plain address opens in Spanish again.
    await page.goto('./#' + FIELD);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveURL(/[?&]lang=es/);
  });

  test('English that is not translated yet is marked as English for screen readers', async ({ page }, info) => {
    // As if the address search, the layer list and the field view were not translated yet.
    await leaveOut(page, { strings: UNTRANSLATED });
    await openIn(page, 'es', isPhone(info) ? FIELD : ANALYSIS);
    // Translated: the settings button. Not yet translated: the address search box.
    expect(await langOf(page, 'button.settings')).toBe('es');
    const search = page.locator('input[type="search"], input[type="text"]').first();
    await expect(search).toHaveAttribute('lang', 'en');
    await expect.poll(() => page.locator('[data-pk-lang][lang="en"]').count()).toBeGreaterThan(10);
  });

  test('Settings lists the languages and shows the translation note', async ({ page }) => {
    await openIn(page, 'es', FIELD);
    await page.getByRole('button', { name: 'Ajustes' }).click();
    const settings = page.getByRole('dialog', { name: 'Ajustes' });
    await expect(settings.getByRole('heading', { name: 'Idioma' })).toBeVisible();
    await expect(settings.getByRole('list', { name: 'Idiomas' }).getByRole('button')).toHaveCount(10);
    await expect(settings.getByRole('link', { name: 'Corregir una traducción' })).toBeVisible();
    await expect(settings.locator('button[aria-current="true"]')).toContainText('Español');
  });

  test('a copied link carries the language', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (text: string) => ((window as unknown as { copied: string }).copied = text) },
      });
    });
    await openIn(page, 'es', FIELD);
    const copy = page.getByRole('button', { name: 'Copiar enlace' }).first();
    if (await copy.isVisible()) await copy.click();
    else {
      await page.getByRole('button', { name: 'Menú' }).click();
      await page.getByRole('dialog', { name: 'Menú del sitio' }).getByRole('button', { name: 'Copiar enlace' }).click();
    }
    await expect.poll(() => page.evaluate(() => (window as unknown as { copied?: string }).copied ?? '')).toMatch(/\?lang=es#/);
  });

  test('Arabic reads right to left, and the top bar mirrors', async ({ page }, info) => {
    await leaveOut(page, { strings: UNTRANSLATED });
    await openIn(page, 'ar', FIELD);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    const brand = await page.locator('.brand .mark').boundingBox();
    const settings = await page.locator('button.settings').boundingBox();
    // The logo starts the line, so it sits at the right; Settings ends it, at the left.
    expect(brand!.x).toBeGreaterThan(settings!.x);
    // English fallbacks read left to right inside the Arabic page.
    await expect.poll(() => page.locator('[data-pk-lang][dir="ltr"]').count()).toBeGreaterThan(3);
    if (!isPhone(info)) await expectAccessible(page, 'the map in Arabic');
  });

  test('a content page in Spanish, and one not translated yet shown in English', async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    // As if the About page had no Spanish translation yet.
    await leaveOut(page, { pages: ['about'] });
    await page.goto('./contact/?lang=es');
    await expect(page.getByRole('heading', { level: 1, name: 'Contacto' })).toBeVisible();
    await expect(page.locator('main .prose')).not.toHaveAttribute('lang', 'en');
    await expect(page.getByText('Esta página todavía no está traducida')).toHaveCount(0);
    await expectAccessible(page, 'the Contact page in Spanish');

    await page.goto('./about/?lang=es');
    await expect(page.getByText('Esta página todavía no está traducida, así que se muestra en inglés.')).toBeVisible();
    await expect(page.locator('main .prose')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('About Placekeepers');
    await expectAccessible(page, 'an untranslated page in Spanish');

    // The menu's page names are in Spanish.
    await page.getByRole('button', { name: 'Menú' }).click();
    await expect(page.getByRole('link', { name: 'Contacto' })).toBeVisible();
  });

  test('the letters, flyer and packet pages open in Spanish', async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    for (const [path, title] of [
      ['letters/', 'Escribir una carta'],
      ['flyer/', 'Hacer un volante para los vecinos'],
      ['packet/', 'Hacer un paquete'],
    ] as const) {
      await page.goto(`./${path}?lang=es`);
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Idioma: Español/ })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Corregir una traducción' }).first()).toBeVisible();
    }
    // The letters keep their note that no lawyer has reviewed them, in Spanish.
    await page.goto('./letters/?lang=es');
    await expect(page.getByText('Un abogado todavía no ha revisado esta carta. No es asesoría legal.').first()).toBeVisible();
  });

  test('the Data status page keeps the refresh notes in English, marked so', async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    await page.goto('./status/?lang=es');
    await expect(page.getByRole('button', { name: /^Idioma: Español/ })).toBeVisible();
    const notes = page.locator('.notes ul');
    if (await notes.count()) await expect(notes).toHaveAttribute('lang', 'en');
  });
});

test.describe('a first visit from a browser set to Spanish', () => {
  test.use({ locale: 'es-US' });

  test('is offered Spanish, and nothing changes until the visitor answers', async ({ page }) => {
    await openMap(page, FIELD);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const offer = page.getByRole('region', { name: 'Language offer' });
    await expect(offer).toBeVisible();
    await expect(offer).toHaveAttribute('lang', 'es');
    await expect(offer).toContainText('¿Quiere ver Placekeepers en español?');

    // "No" is remembered: the question is not asked again.
    await offer.getByRole('button', { name: 'Seguir en inglés' }).click();
    await expect(offer).toBeHidden();
    await page.reload();
    await expect(page.locator('[data-map-ready="true"]')).toBeAttached({ timeout: 60_000 });
    await expect(page.getByRole('region', { name: 'Language offer' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('"yes" switches to Spanish', async ({ page }) => {
    await openMap(page, FIELD);
    const offer = page.getByRole('region', { name: 'Language offer' });
    await Promise.all([page.waitForURL(/[?&]lang=es/), offer.getByRole('button', { name: 'Ver en español' }).click()]);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });
});
