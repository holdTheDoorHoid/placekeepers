// The "Fix a translation" form (.github/ISSUE_TEMPLATE/fix-translation.yml), opened already
// filled in with the language and the page. Only the page's path goes in the link: never the map
// position or anything else from the address, which could say where someone is.

import { languageOf, type LanguageCode } from './languages.ts';

export const FIX_TRANSLATION_FORM = 'https://github.com/holdTheDoorHoid/placekeepers/issues/new';

export function fixTranslationUrl(code: LanguageCode, pagePath: string): string {
  const language = languageOf(code);
  const params = new URLSearchParams({
    template: 'fix-translation.yml',
    title: `Translation (${language.english}): `,
    language: `${language.english} (${code})`,
    page: pagePath,
  });
  return `${FIX_TRANSLATION_FORM}?${params.toString()}`;
}
