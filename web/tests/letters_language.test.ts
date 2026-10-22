// A letter's language (orchestrator, 2026-10-22): on a page in another language the letter prints
// in English by default, for the offices, organizations and owners who mostly read English, and
// the sender sees it in their own language. Here the strings hold Spanish, as on a page in Spanish.

import { afterAll, describe, expect, it } from 'vitest';
import es from '../src/i18n/locales/es.ts';
import { applyCatalog } from '../src/i18n/catalog.ts';
import { englishStrings, keepEnglish } from '../src/i18n/english.ts';
import { setLocale, withLocale } from '../src/i18n/locale.ts';
import { markFallback } from '../src/i18n/marks.ts';
import { buildLetter, EMPTY_FIELDS, letterText, listWords } from '../src/letters/templates.ts';
import { formatDate, strings } from '../src/strings.ts';

keepEnglish();
setLocale('es');
applyCatalog(strings, es, markFallback);
afterAll(() => setLocale('en'));

const fields = { ...EMPTY_FIELDS, recipientName: 'Council Member Example', lotAddress: '1234 Example St', plans: ['cleanup', 'garden'], senderName: 'Rosa' };

describe('a letter from a page in Spanish', () => {
  it('can still be written in English, with English lists and dates', () => {
    const english = withLocale('en', () => buildLetter('owner', { ...fields, date: formatDate('2026-10-22') ?? '' }, englishStrings()));
    expect(english.salutation).toBe('Dear Council Member Example,');
    expect(english.closing).toBe('Sincerely,');
    expect(english.date).toBe('October 22, 2026');
    expect(letterText(english)).toContain('1234 Example St');
    expect(letterText(english)).toContain('clean it up and plant a small garden');
    expect(listWords(['a', 'b', 'c'], englishStrings())).toBe('a, b and c');
    expect(englishStrings().join.names(['A', 'B'])).toBe('A and B');
  });

  it('is written in Spanish with the page strings, keeping what was typed as typed', () => {
    const spanish = buildLetter('owner', fields, strings);
    expect(spanish.salutation).not.toMatch(/^Dear/);
    expect(spanish.closing).toBe('Atentamente,');
    expect(letterText(spanish)).toContain('1234 Example St');
    expect(letterText(spanish)).toContain('Rosa');
  });
});
