// The English words as they were before a page's catalog was written into the strings
// (src/i18n/boot.ts), for the few things a page in another language still writes in English: a
// letter printed in English for the office, organization or owner who reads it (src/letters/).
// Format numbers and dates for them inside withLocale('en', ...) (src/i18n/locale.ts).

import { strings } from '../strings.ts';
import { cloneText } from './catalog.ts';

export type Strings = typeof strings;

let kept: Strings | null = null;

/** Called by the boot step just before it writes a catalog into the strings. */
export function keepEnglish(): void {
  kept ??= cloneText(strings);
}

/** The English strings: the copy kept before translation, or the strings themselves on an English page. */
export function englishStrings(): Strings {
  return kept ?? strings;
}
