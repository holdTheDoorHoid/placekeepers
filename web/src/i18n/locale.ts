// The language this page is shown in, and the Intl formatters that follow it: numbers, money,
// dates, times and plural forms, always in Philadelphia's time zone. web/src/strings.ts formats
// through these, so English text and every catalog share them.
//
// The language is set once, before the page draws (src/i18n/boot.ts), and choosing another one
// reloads the page; nothing here has to react to a change while the page is open. This module
// must stay free of browser globals: the build (plugins/content.ts) and the tests import it in
// Node.

import { LANGUAGES, languageOf, type Language, type LanguageCode } from './languages.ts';

export const CITY_TIME_ZONE = 'America/New_York';

let active: LanguageCode = 'en';
type Formatter = Intl.DateTimeFormat | Intl.NumberFormat | Intl.PluralRules | Intl.ListFormat;
const cache = new Map<string, Formatter>();

/** Sets the page's language. Called by the boot step, and by tests that check a catalog. */
export function setLocale(code: LanguageCode): void {
  if (code === active) return;
  active = code;
  cache.clear();
}

/** The page's language code, such as "en", "es" or "zh-Hans". */
export function currentLocale(): LanguageCode {
  return active;
}

export function currentLanguage(): Language {
  return languageOf(active);
}

/** True when the page is in English, the source language. */
export function isSourceLocale(): boolean {
  return active === 'en';
}

function cached<T extends Formatter>(key: string, make: (intl: string) => T): T {
  const full = `${active}|${key}`;
  let hit = cache.get(full) as T | undefined;
  if (!hit) {
    hit = make(currentLanguage().intl);
    cache.set(full, hit);
  }
  return hit;
}

/** Whole numbers and decimals in the page's language: "1,234" in English, "1.234" in Portuguese. */
export function numberFormat(): Intl.NumberFormat {
  return cached('number', (intl) => new Intl.NumberFormat(intl));
}

/** A number with exactly this many decimals: "0.4" in English, "0,4" in French. */
export function decimalFormat(digits: number): Intl.NumberFormat {
  return cached(`decimal${digits}`, (intl) => new Intl.NumberFormat(intl, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
}

/** Whole dollars in the page's language: "$1,500", "1.500 US$", "1 500 $US". */
export function moneyFormat(): Intl.NumberFormat {
  return cached('money', (intl) => new Intl.NumberFormat(intl, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }));
}

/** Short dollars for chart axes: "$1.2M", "$500K", or the page language's own short forms. */
export function compactMoneyFormat(): Intl.NumberFormat {
  return cached('compactMoney', (intl) =>
    new Intl.NumberFormat(intl, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }),
  );
}

/** A time of day in Philadelphia: "2:14 PM", "14:14". */
export function timeFormat(): Intl.DateTimeFormat {
  return cached('time', (intl) => new Intl.DateTimeFormat(intl, { hour: 'numeric', minute: '2-digit', timeZone: CITY_TIME_ZONE }));
}

/**
 * A time on a clock rather than a moment: SEPTA's "6:50 AM" or a hearing's "3:30 PM", shown in
 * the page language's own way ("6:50", "6:50 a.m.") whatever time zone the visitor is in. Format
 * a Date made with Date.UTC(1970, 0, 1, hours, minutes).
 */
export function clockFormat(): Intl.DateTimeFormat {
  return cached('clock', (intl) => new Intl.DateTimeFormat(intl, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }));
}

/** "a, b and c" in the page's language: "a, b y c" in Spanish, "a、b和c" in Chinese. */
export function listFormat(): Intl.ListFormat {
  return cached('list', (intl) => new Intl.ListFormat(intl, { type: 'conjunction' }));
}

/** The plural category of a count in the page's language ("one", "few", "many", "other" ...). */
export function pluralCategory(n: number): Intl.LDMLPluralRule {
  return cached('plural', (intl) => new Intl.PluralRules(intl)).select(n);
}

export type DateStyle = 'long' | 'short';

/**
 * A date in words in the page's language. `timeZone` is Philadelphia's for moments in time, and
 * UTC for a bare calendar day (2026-10-01), which is shown as written.
 */
export function formatDateIn(date: Date, style: DateStyle, timeZone: string): string {
  const language = currentLanguage();
  const options: Intl.DateTimeFormatOptions =
    style === 'long' ? { dateStyle: 'long', timeZone } : { month: 'short', day: 'numeric', year: 'numeric', timeZone };
  const format = cached(`date|${style}|${timeZone}`, (intl) => new Intl.DateTimeFormat(intl, options));
  if (!language.months) return format.format(date);
  // A language Intl does not know: the day, the month's own name and the year.
  const parts = format.formatToParts(date);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = Number(
    cached(`month|${timeZone}`, () => new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone })).format(date),
  );
  const name = language.months[month - 1] ?? '';
  return `${day} ${style === 'short' && name.length > 4 ? `${name.slice(0, 3)}.` : name} ${year}`;
}

/** Every language's Intl locale, for tests. */
export const INTL_LOCALES: Record<LanguageCode, string> = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.intl])) as Record<
  LanguageCode,
  string
>;
