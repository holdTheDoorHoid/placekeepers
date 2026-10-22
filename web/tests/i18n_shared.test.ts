// Shared code that speaks the page's language (the translators' fix pass, issue #49): numbers,
// times, lists and punctuation that used to be English in code, and now follow the language
// through Intl or a template in web/src/strings.ts. English must read exactly as before; the other
// tests check that. Here: a page in another language.

import { render } from 'svelte/server';
import { afterEach, describe, expect, it } from 'vitest';
import WhyBreakdown from '../src/components/lens/WhyBreakdown.svelte';
import { applyCatalog, cloneText } from '../src/i18n/catalog.ts';
import { setLocale } from '../src/i18n/locale.ts';
import { hasFallback, isolateValue, markFallback } from '../src/i18n/marks.ts';
import { labelledParts, strings } from '../src/strings.ts';
import { clockWords } from '../src/dossier/rules.ts';
import { formatDuration, formatMiles } from '../src/survey/sheet.ts';
import { clock } from '../src/transit/describe.ts';

afterEach(() => setLocale('en'));

describe('times on the clock', () => {
  it('follow the page language', () => {
    expect(clock(410)).toBe('6:50 AM');
    expect(clockWords('15:30')).toBe('3:30 PM');
    setLocale('pt-BR');
    expect(clock(410)).toBe('6:50');
    expect(clock(1530)).toBe('1:30');
    expect(clockWords('15:30')).toBe('15:30');
    setLocale('ru');
    expect(clock(1110)).toBe('18:30');
    setLocale('es');
    // US Spanish keeps the twelve hour clock, with its own words for it.
    expect(clock(1110)).toMatch(/^6:30\s?p\.\s?m\.$/);
  });

  it('do not depend on the time zone of the visitor', () => {
    setLocale('fr');
    expect(clock(0)).toMatch(/^0?0:00$/);
    expect(clock(1439)).toBe('23:59');
  });
});

describe('a survey walk', () => {
  it('writes its numbers the page language way', () => {
    setLocale('pt-BR');
    expect(formatMiles(16529)).toContain('10,3');
    expect(formatMiles(50)).toContain('0,1');
    expect(formatDuration(75)).toMatch(/1\D+15/);
  });
});

describe('the why of a score', () => {
  const why = {
    score: 26.3,
    allOff: false,
    factors: [
      { id: 'a', label: 'A', evidence: 'strong', explain: '', weight: 2, value: 80, contribution: 16.2 },
      { id: 'b', label: 'B', evidence: 'strong', explain: '', weight: 1, value: 60, contribution: 10.1 },
    ],
    main: null,
    missing: [],
  } as never;

  it('writes its points with the page language decimal mark', () => {
    expect(render(WhyBreakdown, { props: { why, idPrefix: 't' } }).body).toContain('26.3');
    setLocale('pt-BR');
    const body = render(WhyBreakdown, { props: { why, idPrefix: 't' } }).body;
    expect(body).toContain('26,3');
    expect(body).toContain('16,2');
    expect(body).not.toContain('26.3');
  });
});

describe('joining a label to its value, and a list into a phrase', () => {
  it('reads as before in English', () => {
    expect(strings.join.labelled('Route', '47')).toBe('Route: 47');
    expect(strings.join.colon('Protections')).toBe('Protections:');
    expect(strings.join.and(['a', 'b', 'c'])).toBe('a, b and c');
    expect(strings.join.long(['a', 'b', 'c'])).toBe('a; b; and c');
    expect(strings.join.names(['A', 'B'])).toBe('A and B');
    expect(labelledParts('License')).toEqual({ label: 'License:', gap: ' ', after: '' });
  });

  it('is right in a language that has not translated it yet, and never marked as English', () => {
    setLocale('es');
    const copy = cloneText(strings);
    applyCatalog(copy, {}, markFallback);
    expect(copy.join.labelled('Ruta', '47')).toBe('Ruta: 47');
    expect(copy.join.colon('Protecciones')).toBe('Protecciones:');
    expect(copy.join.and(['a', 'b', 'c'])).toBe('a, b y c');
    expect(copy.join.long(['a', 'b'])).toBe('a y b');
    expect(copy.join.names(['A', 'B'])).toBe('A y B');
    for (const text of [copy.join.labelled('Ruta', '47'), copy.join.and(['a', 'b'])]) expect(hasFallback(text)).toBe(false);
    // Any other template a catalog leaves out is still marked as English.
    expect(hasFallback(copy.survey.title('47', 'Norte'))).toBe(true);
  });

  it('joins a list the language way in Chinese and Arabic', () => {
    setLocale('zh-Hans');
    const zh = cloneText(strings);
    applyCatalog(zh, {}, markFallback);
    expect(zh.join.and(['甲', '乙', '丙'])).toBe('甲、乙和丙');
    setLocale('ar');
    const ar = cloneText(strings);
    applyCatalog(ar, {}, markFallback, { isolate: isolateValue });
    expect(ar.join.and(['أ', 'ب'])).toBe('أ وب');
  });

  it('splits around the value the way the language writes it', () => {
    const english = strings.join.labelled;
    try {
      strings.join.labelled = (label, value) => `${label}\u202F: ${value}`;
      expect(labelledParts('Licence')).toEqual({ label: 'Licence\u202F:', gap: ' ', after: '' });
      strings.join.labelled = (label, value) => `${label}：${value}`;
      expect(labelledParts('许可证')).toEqual({ label: '许可证：', gap: '', after: '' });
    } finally {
      strings.join.labelled = english;
    }
  });
});
