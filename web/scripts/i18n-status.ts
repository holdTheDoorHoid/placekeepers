// How far each language's translation has come, and what it still lacks (docs/TRANSLATING.md).
//
//   npm run i18n:status                 a table of every language
//   npm run i18n:status -- es           the Spanish keys, registry texts and pages still in English
//   npm run i18n:status -- es --english the same, with the English words to translate
//
// It reads the same files the site does and changes nothing.

import { loadRegistry } from '../plugins/registry.ts';
import { CONTENT_DIR, markdownFiles } from '../plugins/content.ts';
import { loadCatalog, readRegistryText } from '../plugins/translations.ts';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { ENGLISH_ONLY, compareCatalog } from '../src/i18n/catalog.ts';
import { WORD_FOR_WORD } from '../src/i18n/ethics.ts';
import { LANGUAGES, TRANSLATED_CODES, isLanguageCode, type TranslatedCode } from '../src/i18n/languages.ts';
import { compareRegistryText } from '../src/i18n/registry-text.ts';
import { strings } from '../src/strings.ts';

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const showEnglish = args.includes('--english');
const registry = loadRegistry();
const englishPages = markdownFiles(CONTENT_DIR);

function words(text: string): number {
  return text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
}

/** The words a template shows: its quoted text, without the code around it or the values spliced in. */
function templateWords(source: string): number {
  const quoted = source.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? [];
  return quoted.reduce((n, q) => n + words(q.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ')), 0);
}

function valueAt(root: unknown, path: string): unknown {
  let value: unknown = root;
  for (const part of path.split(/\.|\[|\]/).filter(Boolean)) {
    if (value === null || typeof value !== 'object') return undefined;
    if (Array.isArray(value) && !/^\d+$/.test(part)) value = value.find((v) => (v as { slug?: string }).slug === part);
    else value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function englishText(path: string): string {
  const value = valueAt(strings, path);
  if (typeof value === 'string') return value;
  if (typeof value === 'function') return value.toString().replace(/\s+/g, ' ');
  return '';
}

function registryEnglish(path: string): string {
  const [file, ...rest] = path.split('.');
  let value: unknown = registry[file as keyof typeof registry];
  for (const part of rest) {
    if (Array.isArray(value)) value = value.find((v) => [v.id, v.value, v.url].map(String).includes(part)) ?? (value as unknown[])[Number(part)];
    else if (value && typeof value === 'object') value = (value as Record<string, unknown>)[part];
  }
  return Array.isArray(value) ? value.join(' ') : String(value ?? '');
}

const percent = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '');

async function status(code: TranslatedCode) {
  const catalog = (await loadCatalog(code)) ?? {};
  const ui = compareCatalog(strings, catalog);
  const reg = compareRegistryText(registry, readRegistryText(code));
  const pages = new Set(markdownFiles(resolve(CONTENT_DIR, code)));
  return { code, ui, reg, pages };
}

if (only) {
  if (!isLanguageCode(only) || only === 'en') {
    console.error(`No translated language "${only}". Choose one of: ${TRANSLATED_CODES.join(', ')}.`);
    process.exit(1);
  }
  const { ui, reg, pages } = await status(only);
  const missingUi = ui.fallback.filter((k) => !ENGLISH_ONLY.has(k));
  const missingPages = englishPages.filter((p) => !pages.has(p));
  console.log(`Interface keys still in English (${missingUi.length}), in web/src/i18n/locales/${only}.ts:`);
  for (const key of missingUi) console.log(showEnglish ? `  ${key}: ${englishText(key)}` : `  ${key}`);
  console.log(`\nRegistry texts still in English (${reg.fallback.length}), in registry/i18n/${only}.yaml:`);
  for (const path of reg.fallback) console.log(showEnglish ? `  ${path}: ${registryEnglish(path)}` : `  ${path}`);
  console.log(`\nContent pages still in English (${missingPages.length}), in content/${only}/:`);
  for (const page of missingPages) console.log(`  ${page}`);
  console.log('\nWord for word passages from docs/ETHICS.md (translate with special care):');
  for (const w of WORD_FOR_WORD) {
    const done = w.keys.every((k) => ui.translated.includes(k));
    console.log(`  ${done ? 'translated' : 'to do     '}  ${w.passage}: ${w.keys.join(', ')}${w.registry ? `, registry ${w.registry.join(', ')}` : ''}`);
  }
  const problems = [...ui.extra, ...ui.mismatched, ...reg.extra, ...reg.mismatched];
  if (problems.length) {
    console.log(`\nProblems to fix (${problems.length}):`);
    for (const p of problems) console.log(`  ${p}`);
    process.exitCode = 1;
  }
} else {
  const uiWords = Object.fromEntries(
    compareCatalog(strings, {}).fallback.map((k) => {
      const value = valueAt(strings, k);
      return [k, typeof value === 'function' ? templateWords(value.toString()) : words(englishText(k))];
    }),
  );
  const regAll = compareRegistryText(registry, {}).fallback;
  const regWords = Object.fromEntries(regAll.map((p) => [p, words(registryEnglish(p))]));
  const pageWords = Object.fromEntries(englishPages.map((p) => [p, words(readFileSync(resolve(CONTENT_DIR, p), 'utf8'))]));
  const sum = (keys: string[], table: Record<string, number>) => keys.reduce((n, k) => n + (table[k] ?? 0), 0);
  const total = { ui: sum(Object.keys(uiWords), uiWords), reg: sum(regAll, regWords), pages: sum(englishPages, pageWords) };
  console.log(`English to translate: interface ${Object.keys(uiWords).length} keys (about ${total.ui} words), registry ${regAll.length} texts (about ${total.reg} words), ${englishPages.length} pages (about ${total.pages} words).\n`);
  console.log('Language                     Interface keys      Registry texts      Pages   Words left');
  for (const code of TRANSLATED_CODES) {
    const { ui, reg, pages } = await status(code);
    const language = LANGUAGES.find((l) => l.code === code)!;
    const uiAll = ui.translated.length + ui.fallback.length;
    const regAllCount = reg.translated.length + reg.fallback.length;
    const left = sum(ui.fallback, uiWords) + sum(reg.fallback, regWords) + sum(englishPages.filter((p) => !pages.has(p)), pageWords);
    const flags = [...ui.extra, ...ui.mismatched, ...reg.extra, ...reg.mismatched].length ? '  (has problems)' : '';
    console.log(
      `${`${code} ${language.english}`.padEnd(28)} ${`${ui.translated.length}/${uiAll} ${percent(ui.translated.length, uiAll)}`.padEnd(19)} ${`${reg.translated.length}/${regAllCount} ${percent(reg.translated.length, regAllCount)}`.padEnd(19)} ${`${pages.size}/${englishPages.length}`.padEnd(7)} ${left}${flags}`,
    );
  }
}
