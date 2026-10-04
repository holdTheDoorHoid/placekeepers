// The house style (CLAUDE.md): plain words, and no dashes as punctuation anywhere people read,
// not even a spaced hyphen used as a pause. This file enforces it on every interface string, on
// every content page, and on the GitHub issue forms, so a stray dash fails CI, not just review.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT_DIR } from '../plugins/content.ts';
import { findDashViolations } from '../src/style/no-dashes.ts';
import { collectStrings, strings } from '../src/strings.ts';

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
