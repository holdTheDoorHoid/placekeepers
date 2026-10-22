// Shared code that speaks the page's language (the translators' fix pass, issue #49): numbers,
// times, lists and punctuation that used to be English in code, and now follow the language
// through Intl or a template in web/src/strings.ts. English must read exactly as before; the other
// tests check that. Here: a page in another language.

import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../src/i18n/locale.ts';
import { formatDuration, formatMiles } from '../src/survey/sheet.ts';

afterEach(() => setLocale('en'));

describe('a survey walk', () => {
  it('writes its numbers the page language way', () => {
    setLocale('pt-BR');
    expect(formatMiles(16529)).toContain('10,3');
    expect(formatMiles(50)).toContain('0,1');
    expect(formatDuration(75)).toMatch(/1\D+15/);
  });
});
