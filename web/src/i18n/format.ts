// Helpers for writing catalogs (src/i18n/locales/<code>.ts): plural forms through
// Intl.PluralRules, and the number, money and date formatters of web/src/strings.ts, which follow
// the page's language. A catalog imports what it needs from here.

import { numberFormat, pluralCategory } from './locale.ts';

export { formatDate, formatMoney, formatNumber, formatTime, formatDecimal } from '../strings.ts';

/**
 * One form per plural category the language uses, with "#" where the number goes. `other` is
 * always required; the rest are the categories Intl.PluralRules gives for the language:
 *
 *   English, Spanish, French, Portuguese:  one, other  (Spanish, French and Portuguese also have
 *                                          many, for numbers like a million; `other` covers it)
 *   Russian:                               one, few, many, other
 *   Arabic:                                zero, one, two, few, many, other
 *   Chinese, Vietnamese, Khmer, Haitian:   other only
 *
 * Example: plural(n, { one: '# lugar', other: '# lugares' }) gives "1 lugar", "12 lugares".
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function plural(n: number, forms: PluralForms): string {
  const form = forms[pluralCategory(n)] ?? forms.other;
  return form.replaceAll('#', numberFormat().format(n));
}
