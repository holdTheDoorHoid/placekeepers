// The house style (CLAUDE.md): plain words, and no dashes as punctuation anywhere people read,
// not even a spaced hyphen used as a pause. This file enforces it on every interface string, on
// every content page, and on the GitHub issue forms, so a stray dash fails CI, not just review.
// The rule holds in every language (issue #49): every catalog in src/i18n/locales/, every
// translated content page in content/<code>/, and every registry translation in registry/i18n/.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT_DIR } from '../plugins/content.ts';
import { REGISTRY_TEXT_DIR, loadCatalog } from '../plugins/translations.ts';
import { applyCatalog, cloneText } from '../src/i18n/catalog.ts';
import { TRANSLATED_CODES } from '../src/i18n/languages.ts';
import { setLocale } from '../src/i18n/locale.ts';
import { findDashViolations } from '../src/style/no-dashes.ts';
import { collectStrings, strings } from '../src/strings.ts';
import { templateProbes, valueAt } from './i18n-probes.ts';

const ISSUE_TEMPLATE_DIR = fileURLToPath(new URL('../../.github/ISSUE_TEMPLATE', import.meta.url));

function filesIn(dir: string, extensions: string[]): string[] {
  return readdirSync(dir).filter((name) => extensions.some((ext) => name.endsWith(ext)));
}

describe('no dashes as punctuation: web/src/strings.ts', () => {
  it('has none in any interface string', () => {
    const problems = collectStrings(strings).flatMap(([path, text]) =>
      findDashViolations(text).map((problem) => `${path}: ${problem}`),
    );
    expect(problems).toEqual([]);
  });
});

describe('no dashes as punctuation: content/*.md', () => {
  const files = filesIn(CONTENT_DIR, ['.md']);

  it('found the expected content pages', () => {
    // A guard so this test cannot silently pass by finding zero files.
    expect(files.length).toBeGreaterThanOrEqual(9); // README plus the 8 pages, at least.
  });

  it.each(files)('%s has none', (name) => {
    const text = readFileSync(resolve(CONTENT_DIR, name), 'utf8');
    expect(findDashViolations(text)).toEqual([]);
  });
});

describe('no dashes as punctuation: .github/ISSUE_TEMPLATE/*.yml', () => {
  const files = filesIn(ISSUE_TEMPLATE_DIR, ['.yml', '.yaml']);

  it('found at least the two issue forms', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it.each(files)('%s has none', (name) => {
    const text = readFileSync(resolve(ISSUE_TEMPLATE_DIR, name), 'utf8');
    expect(findDashViolations(text)).toEqual([]);
  });
});

describe.each(TRANSLATED_CODES.map((code) => [code] as const))('no dashes as punctuation: the %s translation', (code) => {
  it('has none in its catalog (src/i18n/locales)', async () => {
    const catalog = (await loadCatalog(code)) ?? {};
    const probes = templateProbes();
    const translated = cloneText(strings);
    const own = applyCatalog(translated, catalog, (t) => t).translated;
    setLocale(code);
    const problems: string[] = [];
    try {
      for (const path of own) {
        const value = valueAt(translated, path);
        const probe = probes.get(path);
        const texts =
          typeof value === 'function' && probe
            ? probe.calls.map((args) => String((value as (...a: unknown[]) => unknown)(...args)))
            : collectStrings(value).map(([, text]) => text);
        for (const text of texts) for (const problem of findDashViolations(text)) problems.push(`${path}: ${problem}`);
      }
    } finally {
      setLocale('en');
    }
    expect(problems).toEqual([]);
  });

  it('has none in its content pages (content/<code>)', () => {
    const dir = resolve(CONTENT_DIR, code);
    const files = existsSync(dir) ? filesIn(dir, ['.md']) : [];
    const problems = files.flatMap((name) => findDashViolations(readFileSync(resolve(dir, name), 'utf8')).map((p) => `${name}: ${p}`));
    expect(problems).toEqual([]);
  });

  it('has none in its registry text (registry/i18n)', () => {
    const path = resolve(REGISTRY_TEXT_DIR, `${code}.yaml`);
    if (!existsSync(path)) return;
    // Comments are for translators, not visitors; the YAML list markers are allowed anyway.
    expect(findDashViolations(readFileSync(path, 'utf8').replace(/^\s*#.*$/gm, ''))).toEqual([]);
  });
});
