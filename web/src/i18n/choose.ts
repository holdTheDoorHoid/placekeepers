// Which language a page opens in, and how a visitor changes it.
//
//  1. A link's ?lang= wins: a link shared from a page in Spanish opens in Spanish. It holds for
//     the rest of the visit in that tab (session storage), so the site's own links keep it, but it
//     never replaces the visitor's own choice for later visits.
//  2. Otherwise the language the visitor chose in this browser (local storage).
//  3. Otherwise English. The browser's language is only ever offered (LanguageOffer.svelte),
//     never switched to without asking.
//
// Choosing a language saves it, puts it in the address bar, and reloads the page, so every word,
// date and number on it comes from the same language.

import { readItem, removeItem, writeItem, type KeyValueStore } from '../state/storage.ts';
import { LANGUAGES, isLanguageCode, languageOf, matchLanguage, type LanguageCode } from './languages.ts';

/** The query parameter that carries the language in links. */
export const LANG_PARAM = 'lang';
/** The language the visitor chose in this browser (local storage). */
export const LANG_KEY = 'lang';
/** The language a link opened this tab in (session storage). */
export const LINK_LANG_KEY = 'link-lang';

export type LanguageSource = 'link' | 'visit' | 'chosen' | 'default';

export interface LanguageDecision {
  code: LanguageCode;
  source: LanguageSource;
  /** The language the browser asks for, when the site speaks it and it is not English. */
  browser: LanguageCode | null;
  /** Whether the visitor has chosen a language in this browser before (or said no to the offer). */
  chosen: boolean;
}

export interface DecideInput {
  search: string;
  /** navigator.languages, most preferred first. */
  browserLanguages: readonly string[];
  local: KeyValueStore | null;
  session: KeyValueStore | null;
}

/** The first language in the browser's list the site speaks, unless English comes first. */
export function browserLanguage(languages: readonly string[]): LanguageCode | null {
  for (const tag of languages) {
    const code = matchLanguage(tag);
    if (code) return code === 'en' ? null : code;
  }
  return null;
}

export function decideLanguage(input: DecideInput): LanguageDecision {
  const browser = browserLanguage(input.browserLanguages);
  const saved = readItem(LANG_KEY, input.local);
  const chosen = isLanguageCode(saved);
  const fromLink = new URLSearchParams(input.search).get(LANG_PARAM);
  if (fromLink !== null) {
    const code = matchLanguage(fromLink);
    if (code) return { code, source: 'link', browser, chosen };
  }
  const visit = readItem(LINK_LANG_KEY, input.session);
  if (isLanguageCode(visit)) return { code: visit, source: 'visit', browser, chosen };
  if (chosen) return { code: saved as LanguageCode, source: 'chosen', browser, chosen };
  return { code: 'en', source: 'default', browser, chosen };
}

/** Remembers a link's language for the rest of this visit in this tab. */
export function rememberLinkLanguage(code: LanguageCode, session: KeyValueStore | null): void {
  writeItem(LINK_LANG_KEY, code, session);
}

/** The address with ?lang= set for a language other than English, and taken out for English. */
export function addressWithLanguage(href: string, code: LanguageCode): string {
  const url = new URL(href);
  if (code === 'en') url.searchParams.delete(LANG_PARAM);
  else url.searchParams.set(LANG_PARAM, code);
  return url.toString();
}

/** "?lang=es" for a page in another language, or nothing in English: for links the site builds. */
export function languageQuery(code: LanguageCode): string {
  return code === 'en' ? '' : `?${LANG_PARAM}=${encodeURIComponent(code)}`;
}

/**
 * The languages the picker lists: the ready ones, every one in the dev server and the end to end
 * tests, and always the page's own language.
 */
export function pickerLanguages(current: LanguageCode, showAll: boolean): (typeof LANGUAGES)[number][] {
  return LANGUAGES.filter((l) => showAll || l.ready || l.code === current);
}

/** Whether a first visit should offer the browser's language. */
export function shouldOffer(decision: LanguageDecision, showAll: boolean): LanguageCode | null {
  if (decision.chosen || decision.source !== 'default' || !decision.browser) return null;
  return showAll || languageOf(decision.browser).ready ? decision.browser : null;
}

/** Saves a choice in this browser and this tab. */
export function saveChoice(code: LanguageCode, local: KeyValueStore | null, session: KeyValueStore | null): void {
  writeItem(LANG_KEY, code, local);
  if (code === 'en') removeItem(LINK_LANG_KEY, session);
  else writeItem(LINK_LANG_KEY, code, session);
}

function browserStore(kind: 'localStorage' | 'sessionStorage'): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window[kind];
  } catch {
    return null;
  }
}

export const localStore = (): KeyValueStore | null => browserStore('localStorage');
export const sessionStore = (): KeyValueStore | null => browserStore('sessionStorage');

/** Saves the choice and reloads the page in that language, keeping everything else in the address. */
export function chooseLanguage(code: LanguageCode): void {
  saveChoice(code, localStore(), sessionStore());
  window.location.replace(addressWithLanguage(window.location.href, code));
}

/** Keeps English without asking again (the offer's "no" button). */
export function declineOffer(): void {
  writeItem(LANG_KEY, 'en', localStore());
}
