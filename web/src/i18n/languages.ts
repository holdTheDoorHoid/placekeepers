// The languages the site speaks: English, the source of every word, and the nine the owner chose
// on 2026-10-21 (issue #49): Spanish plus the single languages at the top of the City's own count
// of residents who speak English less than very well (its CDBG-DR Language Access Plan, 2023).
// The list is the owner's; do not add or drop a language without the owner.
//
// This file is shared by every language, so a translator changes only the line of their own
// language (its `offer` words, if they read badly). How the rest fits together is in
// docs/TRANSLATING.md.
//
// `ready` decides whether the language picker and the first visit offer list a language on the
// published site. A language that is not ready can still be opened with ?lang= in the address
// (for translators and reviewers), and the picker lists every language in the dev server and the
// end to end tests. The orchestrator turns `ready` on once a language's translation is done.
//
// `reviewed` turns on once a native speaker has checked the language; until then every page in it
// carries the note that it was translated with the help of AI and not yet checked by a native
// speaker, with a link to the "Fix a translation" form.

export interface Language {
  /** The code used in ?lang=, in file names, and in the page's lang attribute (BCP 47). */
  code: string;
  /** The language's name in itself, as the picker shows it. */
  name: string;
  /** A short form of that name for the top bar on a phone. */
  short: string;
  /** Its name in English, for docs, reports and the English line of the picker. */
  english: string;
  dir: 'ltr' | 'rtl';
  /**
   * The locale handed to Intl for numbers, money, dates and plurals. Arabic keeps Western digits,
   * so numbers match the addresses, parcel numbers and phone numbers on the same page, which
   * come from City records as they are written.
   */
  intl: string;
  /**
   * Month names, for a language the browser's Intl does not know (Haitian Creole). Dates are then
   * written "5 oktòb 2026" from these names, with numbers in the US style.
   */
  months?: readonly string[];
  /** Listed by the picker and offered on a first visit on the published site. */
  ready: boolean;
  /** Checked by a native speaker: the AI translation note is no longer shown. */
  reviewed: boolean;
  /**
   * The first visit offer, in the language itself, shown while the page is still in English when
   * the browser asks for this language: a question, the button that switches, and the button
   * that keeps English.
   */
  offer: { question: string; yes: string; no: string };
}

export const LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    short: 'EN',
    english: 'English',
    dir: 'ltr',
    intl: 'en-US',
    ready: true,
    reviewed: true,
    offer: { question: 'See Placekeepers in English?', yes: 'English', no: 'No, thank you' },
  },
  {
    code: 'es',
    name: 'Español',
    short: 'ES',
    english: 'Spanish',
    dir: 'ltr',
    intl: 'es-US',
    ready: false,
    reviewed: false,
    offer: { question: '¿Quiere ver Placekeepers en español?', yes: 'Ver en español', no: 'Seguir en inglés' },
  },
  {
    code: 'zh-Hans',
    name: '简体中文',
    short: '中文',
    english: 'Chinese (simplified)',
    dir: 'ltr',
    intl: 'zh-Hans',
    ready: false,
    reviewed: false,
    offer: { question: '要用简体中文浏览 Placekeepers 吗？', yes: '使用简体中文', no: '继续使用英文' },
  },
  {
    code: 'vi',
    name: 'Tiếng Việt',
    short: 'VI',
    english: 'Vietnamese',
    dir: 'ltr',
    intl: 'vi',
    ready: false,
    reviewed: false,
    offer: { question: 'Bạn có muốn xem Placekeepers bằng tiếng Việt không?', yes: 'Xem bằng tiếng Việt', no: 'Tiếp tục bằng tiếng Anh' },
  },
  {
    code: 'ru',
    name: 'Русский',
    short: 'RU',
    english: 'Russian',
    dir: 'ltr',
    intl: 'ru',
    ready: false,
    reviewed: false,
    offer: { question: 'Открыть Placekeepers на русском языке?', yes: 'Да, на русском', no: 'Оставить английский' },
  },
  {
    code: 'pt-BR',
    name: 'Português (Brasil)',
    short: 'PT',
    english: 'Portuguese (Brazil)',
    dir: 'ltr',
    intl: 'pt-BR',
    ready: false,
    reviewed: false,
    offer: { question: 'Quer ver o Placekeepers em português?', yes: 'Ver em português', no: 'Continuar em inglês' },
  },
  {
    code: 'ht',
    name: 'Kreyòl ayisyen',
    short: 'HT',
    english: 'Haitian Creole',
    dir: 'ltr',
    // Intl has no Haitian Creole yet: numbers follow the US style and months come from `months`.
    intl: 'en-US',
    months: ['janvye', 'fevriye', 'mas', 'avril', 'me', 'jen', 'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm'],
    ready: false,
    reviewed: false,
    offer: { question: 'Èske ou vle wè Placekeepers an kreyòl ayisyen?', yes: 'Wè l an kreyòl', no: 'Kontinye an angle' },
  },
  {
    code: 'km',
    name: 'ភាសាខ្មែរ',
    short: 'ខ្មែរ',
    english: 'Khmer',
    dir: 'ltr',
    intl: 'km',
    ready: false,
    reviewed: false,
    offer: { question: 'តើអ្នកចង់មើល Placekeepers ជាភាសាខ្មែរទេ?', yes: 'មើលជាភាសាខ្មែរ', no: 'បន្តជាភាសាអង់គ្លេស' },
  },
  {
    code: 'fr',
    name: 'Français',
    short: 'FR',
    english: 'French',
    dir: 'ltr',
    intl: 'fr',
    ready: false,
    reviewed: false,
    offer: { question: 'Voulez-vous voir Placekeepers en français ?', yes: 'Voir en français', no: 'Continuer en anglais' },
  },
  {
    code: 'ar',
    name: 'العربية',
    short: 'عربي',
    english: 'Arabic',
    dir: 'rtl',
    intl: 'ar-u-nu-latn',
    ready: false,
    reviewed: false,
    offer: { question: 'هل تريد عرض Placekeepers باللغة العربية؟', yes: 'العرض بالعربية', no: 'المتابعة بالإنجليزية' },
  },
] as const satisfies readonly Language[];

export type LanguageCode = (typeof LANGUAGES)[number]['code'];
/** Every language but English: the ones with catalogs to fill. */
export type TranslatedCode = Exclude<LanguageCode, 'en'>;

export const SOURCE_LANGUAGE: LanguageCode = 'en';
export const LANGUAGE_CODES: readonly LanguageCode[] = LANGUAGES.map((l) => l.code);
export const TRANSLATED_CODES = LANGUAGE_CODES.filter((c): c is TranslatedCode => c !== 'en');

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGE_CODES as readonly string[]).includes(value);
}

export function languageOf(code: LanguageCode): Language {
  return LANGUAGES.find((l) => l.code === code)!;
}

/**
 * The language a browser tag such as "es-MX", "zh-CN", "zh-Hans-SG", "pt-PT" or "ar-EG" asks for,
 * if the site speaks it, or null. Chinese in traditional characters (zh-TW, zh-HK, zh-Hant) is
 * not offered simplified characters, and European Portuguese is still offered Brazilian.
 */
export function matchLanguage(tag: string): LanguageCode | null {
  const lower = tag.trim().toLowerCase();
  if (!lower) return null;
  const exact = LANGUAGE_CODES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const [base, ...rest] = lower.split('-');
  if (base === 'zh') {
    const traditional = rest.some((part) => part === 'hant' || part === 'tw' || part === 'hk' || part === 'mo');
    return traditional ? null : 'zh-Hans';
  }
  if (base === 'pt') return 'pt-BR';
  return LANGUAGE_CODES.find((c) => c === base) ?? null;
}
