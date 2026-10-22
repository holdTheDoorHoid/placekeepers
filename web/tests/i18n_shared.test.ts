// Shared code that speaks the page's language (the translators' fix pass, issue #49): numbers,
// times, lists and punctuation that used to be English in code, and now follow the language
// through Intl or a template in web/src/strings.ts. English must read exactly as before; the other
// tests check that. Here: a page in another language.

import { render } from 'svelte/server';
import { afterEach, describe, expect, it } from 'vitest';
import WhyBreakdown from '../src/components/lens/WhyBreakdown.svelte';
import { setLocale } from '../src/i18n/locale.ts';
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
