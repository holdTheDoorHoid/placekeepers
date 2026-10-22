// Translation (issue #49): the catalogs, the registry text and the content pages of every
// language, checked against English; the machinery that picks a language and falls back to
// English; and a list of what each language still lacks.
//
// A catalog fails when it has a key English lacks, a value of the wrong kind, a template that
// drops a value English shows, a translated English only key, or a dash. Missing translations
// never fail: they are listed, and the page shows English for them.

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT_DIR, markdownFiles, pageWords, readContentPages } from '../plugins/content.ts';
import { loadRegistry } from '../plugins/registry.ts';
import { LOCALES_DIR, loadCatalog, readRegistryText } from '../plugins/translations.ts';
import { ENGLISH_ONLY, applyCatalog, cloneText, compareCatalog, type Catalog } from '../src/i18n/catalog.ts';
import {
  addressWithLanguage,
  browserLanguage,
  decideLanguage,
  languageQuery,
  pickerLanguages,
  saveChoice,
  shouldOffer,
} from '../src/i18n/choose.ts';
import { WORD_FOR_WORD } from '../src/i18n/ethics.ts';
import { fixTranslationUrl } from '../src/i18n/fix.ts';
import { plural } from '../src/i18n/format.ts';
import { LANGUAGES, LANGUAGE_CODES, TRANSLATED_CODES, matchLanguage, type TranslatedCode } from '../src/i18n/languages.ts';
import { setLocale } from '../src/i18n/locale.ts';
import { FALLBACK_END, FALLBACK_START, isolateValue, markFallback, plainText, textKind } from '../src/i18n/marks.ts';
import { applyRegistryText, compareRegistryText, registryTextPaths } from '../src/i18n/registry-text.ts';
import type { KeyValueStore } from '../src/state/storage.ts';
import { formatDate, formatMoney, formatNumber, strings } from '../src/strings.ts';
import { findDashViolations } from '../src/style/no-dashes.ts';
import { shows, templateProbes, valueAt } from './i18n-probes.ts';

const registry = loadRegistry();
const probes = templateProbes();
const catalogs = new Map<TranslatedCode, Catalog>();
for (const code of TRANSLATED_CODES) catalogs.set(code, (await loadCatalog(code)) ?? {});

afterEach(() => setLocale('en'));

/** Templates a catalog translates that drop a value English shows, or that throw. */
function placeholderProblems(code: TranslatedCode, catalog: Catalog): string[] {
  const report = compareCatalog(strings, catalog);
  setLocale(code);
  const translated = cloneText(strings);
  applyCatalog(translated, catalog, (t) => t);
  const problems: string[] = [];
  for (const path of report.translated) {
    const probe = probes.get(path);
    if (!probe) continue;
    const en = valueAt(strings, path) as (...a: unknown[]) => unknown;
    const tr = valueAt(translated, path) as (...a: unknown[]) => unknown;
    for (const args of probe.calls) {
      setLocale('en');
      const want = String(en(...args));
      setLocale(code);
      let got: string;
      try {
        got = String(tr(...args));
      } catch (error) {
        problems.push(`${path}(${args.join(', ')}) throws: ${String(error)}`);
        continue;
      }
      for (const mark of probe.marks) if (shows(want, mark) && !shows(got, mark)) problems.push(`${path}(${args.join(', ')}) drops ${mark}: "${got}"`);
    }
  }
  setLocale('en');
  return problems;
}


class MemoryStore implements KeyValueStore {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

describe('the languages', () => {
  it('are English and the nine the owner chose, in the City count order (issue #49)', () => {
    expect(LANGUAGE_CODES).toEqual(['en', 'es', 'zh-Hans', 'vi', 'ru', 'pt-BR', 'ht', 'km', 'fr', 'ar']);
  });

  it('each have a catalog file, and Arabic alone reads right to left', () => {
    for (const code of TRANSLATED_CODES) expect(existsSync(resolve(LOCALES_DIR, `${code}.ts`)), code).toBe(true);
    expect(LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code)).toEqual(['ar']);
  });

  it('offer their own words without dashes', () => {
    for (const l of LANGUAGES) {
      for (const text of [l.name, l.short, l.offer.question, l.offer.yes, l.offer.no]) expect(findDashViolations(text), l.code).toEqual([]);
    }
  });

  it('share the dash rule, with the dashes other writing systems use', () => {
    expect(findDashViolations('Москва — столица')).toHaveLength(1);
    expect(findDashViolations('这是——那是')).toHaveLength(2);
    expect(findDashViolations('Dit ― il')).toHaveLength(1);
    expect(findDashViolations('5 − 3')).toHaveLength(1);
    expect(findDashViolations('Voulez-vous voir Placekeepers en français ?')).toEqual([]);
    expect(findDashViolations('2026年10月5日，下午2:14')).toEqual([]);
  });

  it('match the tags browsers send', () => {
    expect(matchLanguage('es-MX')).toBe('es');
    expect(matchLanguage('ES')).toBe('es');
    expect(matchLanguage('zh-CN')).toBe('zh-Hans');
    expect(matchLanguage('zh-Hans-SG')).toBe('zh-Hans');
    expect(matchLanguage('zh-TW')).toBeNull();
    expect(matchLanguage('zh-Hant')).toBeNull();
    expect(matchLanguage('pt-PT')).toBe('pt-BR');
    expect(matchLanguage('pt')).toBe('pt-BR');
    expect(matchLanguage('ar-EG')).toBe('ar');
    expect(matchLanguage('ht')).toBe('ht');
    expect(matchLanguage('de-DE')).toBeNull();
    expect(matchLanguage('')).toBeNull();
  });
});

describe('choosing a language', () => {
  const decide = (search: string, browser: string[], local = new MemoryStore(), session = new MemoryStore()) =>
    decideLanguage({ search, browserLanguages: browser, local, session });

  it('opens in English on a first visit, and only offers the browser language', () => {
    const d = decide('', ['es-US', 'en-US']);
    expect(d).toMatchObject({ code: 'en', source: 'default', browser: 'es', chosen: false });
    expect(shouldOffer(d, true)).toBe('es');
    // On the published site only a language marked ready is offered.
    expect(shouldOffer(d, false)).toBe(LANGUAGES.find((l) => l.code === 'es')!.ready ? 'es' : null);
  });

  it('offers nothing when the browser puts English first, or once the visitor has chosen', () => {
    expect(browserLanguage(['en-US', 'es'])).toBeNull();
    const local = new MemoryStore();
    saveChoice('en', local, new MemoryStore());
    const d = decide('', ['es'], local);
    expect(d.chosen).toBe(true);
    expect(shouldOffer(d, true)).toBeNull();
  });

  it('follows a link before the saved choice, and the saved choice before English', () => {
    const local = new MemoryStore();
    saveChoice('fr', local, new MemoryStore());
    expect(decide('', [], local).code).toBe('fr');
    expect(decide('?lang=ar', [], local)).toMatchObject({ code: 'ar', source: 'link' });
    expect(decide('?lang=xx', [], local).code).toBe('fr');
    expect(decide('?lang=zh-CN', []).code).toBe('zh-Hans');
  });

  it("keeps a link's language for the rest of the visit without replacing the saved choice", () => {
    const local = new MemoryStore();
    const session = new MemoryStore();
    saveChoice('fr', local, session);
    session.setItem('placekeepers:v1:link-lang', 'km');
    expect(decide('', [], local, session)).toMatchObject({ code: 'km', source: 'visit' });
    expect(local.getItem('placekeepers:v1:lang')).toBe('fr');
  });

  it('puts a language other than English in the address, and takes English out', () => {
    expect(addressWithLanguage('https://x.test/placekeepers/about/#a=1', 'es')).toBe('https://x.test/placekeepers/about/?lang=es#a=1');
    expect(addressWithLanguage('https://x.test/placekeepers/?lang=es&q=2#v=a', 'en')).toBe('https://x.test/placekeepers/?q=2#v=a');
    expect(languageQuery('zh-Hans')).toBe('?lang=zh-Hans');
    expect(languageQuery('en')).toBe('');
  });

  it('lists ready languages, the one in use, and every language for testers', () => {
    expect(pickerLanguages('km', false).map((l) => l.code)).toEqual(
      LANGUAGES.filter((l) => l.ready || l.code === 'km').map((l) => l.code),
    );
    expect(pickerLanguages('en', true)).toHaveLength(LANGUAGES.length);
  });

  it('links to the "Fix a translation" form with the language and the page only', () => {
    const url = new URL(fixTranslationUrl('es', '/placekeepers/about/'));
    expect(url.searchParams.get('template')).toBe('fix-translation.yml');
    expect(url.searchParams.get('language')).toBe('Spanish (es)');
    expect(url.searchParams.get('page')).toBe('/placekeepers/about/');
    expect(existsSync(new URL('../../.github/ISSUE_TEMPLATE/fix-translation.yml', import.meta.url))).toBe(true);
  });
});

describe('numbers, dates and plurals follow the language, in Philadelphia time', () => {
  it('formats in the language of the page', () => {
    setLocale('pt-BR');
    expect(formatNumber(1234567)).toBe('1.234.567');
    setLocale('es');
    expect(formatDate('2026-10-05')).toBe('5 de octubre de 2026');
    expect(formatDate('2026-10-06T02:30:00Z')).toBe('5 de octubre de 2026');
    setLocale('ar');
    expect(formatNumber(1500)).toBe('1,500');
    setLocale('en');
    expect(formatDate('2026-10-05')).toBe('October 5, 2026');
    expect(formatMoney(1499.5)).toBe('$1,500');
  });

  it('writes Haitian Creole months itself, since Intl has none', () => {
    setLocale('ht');
    expect(formatDate('2026-10-05')).toBe('5 oktòb 2026');
    expect(formatDate('2026-01-05', 'short')).toBe('5 jan. 2026');
  });

  it('picks the plural form Intl.PluralRules gives', () => {
    setLocale('ru');
    const forms = { one: '# место', few: '# места', many: '# мест', other: '# места' };
    expect([1, 3, 5, 21].map((n) => plural(n, forms))).toEqual(['1 место', '3 места', '5 мест', '21 место']);
    setLocale('ar');
    expect(plural(2, { two: 'مكانان', other: '# أماكن' })).toBe('مكانان');
    setLocale('zh-Hans');
    expect(plural(1, { other: '# 个地方' })).toBe('1 个地方');
  });
});

describe('falling back to English', () => {
  it('marks English text so the page can say it is English, and files can drop the marks', () => {
    const marked = markFallback('Settings');
    expect(marked).toBe(`${FALLBACK_START}Settings${FALLBACK_END}`);
    expect(plainText(`Datos ${marked}`)).toBe('Datos Settings');
    expect(textKind(marked)).toBe('fallback');
    expect(textKind(`  ${marked}. `)).toBe('fallback');
    expect(textKind(`Ajustes ${marked}`)).toBe('translated');
    expect(textKind('Ajustes')).toBe('translated');
    expect(textKind('1,234')).toBeNull();
  });

  it('keeps values in their own direction on a right to left page, apart from English fallbacks', () => {
    const address = isolateValue('1305 N EXAMPLE AVE');
    expect(address).toBe('\u20681305 N EXAMPLE AVE\u2069');
    expect(isolateValue(address)).toBe(address);
    expect(textKind(address)).toBe('translated');
    expect(textKind(`العنوان: ${address}`)).toBe('translated');
    expect(textKind(markFallback(`Address: ${address}`))).toBe('fallback');
    expect(plainText(`\u2066a\u2069 \u2067b\u2069 ${address}`)).toBe('a b 1305 N EXAMPLE AVE');
    const english = cloneText(strings);
    applyCatalog(english, { place: { parcel: (id: string) => `القطعة ${id}` } }, markFallback, { isolate: isolateValue });
    expect(english.place.parcel('1305 N EXAMPLE AVE')).toBe('القطعة \u20681305 N EXAMPLE AVE\u2069');
    expect(english.place.parcel.length).toBe(1);
    // Codes reach templates as they are, so a template can still compare them.
    expect(english.place.parcel('990000005')).toBe('القطعة 990000005');
    expect(english.lens.allOffFor('segment')).toBe(markFallback(strings.lens.allOffFor('segment')));
  });

  it('writes a catalog into the English object in place, leaf by leaf', () => {
    const english = cloneText(strings);
    const header = english.header;
    const report = applyCatalog(english, { header: { settings: 'Ajustes' }, sheet: { countLabel: (n: number) => `${n} lugares` } });
    // A module that kept a part of the object sees the translation.
    expect(header.settings).toBe('Ajustes');
    expect(english.sheet.countLabel(4)).toBe('4 lugares');
    expect(header.share).toBe(markFallback('Copy link'));
    // Templates left out keep working, marked, with their argument count.
    expect(english.place.parcel('123')).toBe(markFallback('Parcel 123'));
    expect(english.place.parcel.length).toBe(1);
    // Addresses and English only keys are never marked.
    expect(english.app.repoUrl).toBe(strings.app.repoUrl);
    expect(english.streets.removalSubject('m1')).toBe(strings.streets.removalSubject('m1'));
    expect(report.translated).toEqual(['header.settings', 'sheet.countLabel']);
    expect(report.extra).toEqual([]);
  });

  it('matches the menu by page, whatever the order', () => {
    const english = cloneText(strings);
    applyCatalog(english, { nav: { pages: [{ slug: 'contact', label: 'Contacto' }] } });
    const contact = english.nav.pages.find((p) => p.slug === 'contact')!;
    expect(contact.label).toBe('Contacto');
    expect(english.nav.pages.find((p) => p.slug === 'about')!.label).toBe(markFallback('About'));
    expect(english.nav.pages.map((p) => p.slug)).toEqual(strings.nav.pages.map((p) => p.slug));
  });

  it('catches a template that drops a value English shows', () => {
    expect(probes.size).toBeGreaterThan(300);
    const bad = { sheet: { countLabel: () => 'muchos lugares' }, freshness: { ok: (date: string) => `Datos del ${date}` } } as Catalog;
    expect(placeholderProblems('es', bad)).toEqual([expect.stringContaining('sheet.countLabel(641) drops 641')]);
  });

  it('reports keys English lacks and values of the wrong kind', () => {
    const report = compareCatalog(strings, { header: { setings: 'x', settings: () => 'y' }, nav: { pages: 'x' } } as never);
    expect(report.extra).toEqual(['header.setings']);
    expect(report.mismatched).toEqual(expect.arrayContaining(['header.settings', 'nav.pages']));
  });

  it('writes registry text into the registry, with English for what it leaves out', () => {
    const copy = structuredClone(registry);
    const report = applyRegistryText(copy, { groups: { lots: { label: 'Lotes' } }, layers: { nope: { label: 'x' } } });
    expect(copy.groups.find((g) => g.id === 'lots')!.label).toBe('Lotes');
    expect(copy.groups.find((g) => g.id === 'lots')!.description).toBe(markFallback(registry.groups[0]!.description));
    expect(copy.layers[0]!.id).toBe(registry.layers[0]!.id);
    expect(report.extra).toEqual(['layers.nope']);
  });
});

describe('the word for word passages of ETHICS.md stay fixed units', () => {
  it.each(WORD_FOR_WORD.map((w) => [w.passage, w] as const))('%s is fixed text, not a template', (_name, passage) => {
    for (const key of passage.keys) {
      const value = valueAt(strings, key);
      expect(typeof value, key).toBe('string');
      expect((value as string).length, key).toBeGreaterThan(20);
    }
    for (const path of passage.registry ?? []) expect(registryTextPaths(registry), path).toContain(path);
  });
});

describe.each(TRANSLATED_CODES.map((code) => [code] as const))('the %s catalog', (code) => {
  const catalog = catalogs.get(code)!;
  const report = compareCatalog(strings, catalog);

  it('has no key English lacks, and every value is the kind English has', () => {
    expect(report.extra).toEqual([]);
    expect(report.mismatched).toEqual([]);
  });

  it('translates no English only key', () => {
    expect(report.translated.filter((k) => ENGLISH_ONLY.has(k))).toEqual([]);
  });

  it('keeps every value English shows in each template it translates', () => {
    expect(placeholderProblems(code, catalog)).toEqual([]);
  });

  it('lists what it still lacks', () => {
    const total = report.translated.length + report.fallback.length;
    console.info(`${code}: interface ${report.translated.length} of ${total} keys translated`);
    expect(total).toBeGreaterThan(1000);
  });
});

describe.each(TRANSLATED_CODES.map((code) => [code] as const))('the %s registry text', (code) => {
  const text = readRegistryText(code);
  const report = compareRegistryText(registry, text);

  it('names only ids and fields the registry has, with lists of steps as long as English', () => {
    expect(report.extra).toEqual([]);
    expect(report.mismatched).toEqual([]);
  });

  it('lists what it still lacks', () => {
    console.info(`${code}: registry ${report.translated.length} of ${report.translated.length + report.fallback.length} texts translated`);
  });
});

describe.each(TRANSLATED_CODES.map((code) => [code] as const))('the %s content pages', (code) => {
  const folder = resolve(CONTENT_DIR, code);
  const english = new Set(markdownFiles(CONTENT_DIR));

  it('only translate pages English has, and render without dashes', async () => {
    for (const name of markdownFiles(folder)) expect(english, `content/${code}/${name}`).toContain(name);
    const pages = readContentPages(CONTENT_DIR, { code, words: pageWords(catalogs.get(code)!) });
    for (const html of Object.values(pages)) {
      expect(html).toMatch(/<h1/);
      expect(html).not.toContain('{{REMOVAL_EMAIL}}');
    }
    console.info(`${code}: content ${Object.keys(pages).length} of ${english.size} pages translated`);
  });
});

describe('the Spanish seed', () => {
  it('translates the top bar, the menu, the picker, the settings headings and the note', () => {
    const es = catalogs.get('es')!;
    const report = compareCatalog(strings, es);
    for (const group of ['header', 'nav', 'views', 'language', 'settings']) {
      expect(report.fallback.filter((k) => k.startsWith(`${group}.`)), group).toEqual([]);
    }
  });

  it('has the Contact page, with the memorial removal words in Spanish', () => {
    const pages = readContentPages(CONTENT_DIR, { code: 'es', words: pageWords(catalogs.get('es')!) });
    expect(pages.contact).toContain('<h1>Contacto</h1>');
    expect(pages.contact).toContain('template=memorial-removal.yml');
    expect(pages.contact).not.toContain('lang="en"');
  });

  it('covers the layer groups and the app wide option in the registry', () => {
    const report = compareRegistryText(registry, readRegistryText('es'));
    expect(report.fallback.filter((p) => p.startsWith('groups.') || p.startsWith('options.'))).toEqual([]);
  });
});

describe('every content folder is a language', () => {
  it('has no folder for a language the site does not speak', () => {
    const folders = readdirSync(CONTENT_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const name of folders) expect(TRANSLATED_CODES as readonly string[]).toContain(name);
  });
});
