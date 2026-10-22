// The first step of every page: decide the language (src/i18n/choose.ts), load that language's
// words, write them into web/src/strings.ts and the registry, and set the page's lang and dir.
// Every page's main.ts awaits startLanguage() before it imports and draws anything else, so no
// module ever reads an English word that should have been translated:
//
//   import { startLanguage } from '../i18n/boot.ts';
//   await startLanguage({ registry });
//   const { mountPage } = await import('./page.ts');
//
// A page added later must do the same, or it stays in English.

import type { Registry } from '../registry/types.ts';
import { strings } from '../strings.ts';
import { applyCatalog, type ApplyReport, type Catalog } from './catalog.ts';
import {
  addressWithLanguage,
  decideLanguage,
  localStore,
  rememberLinkLanguage,
  sessionStore,
  shouldOffer,
  type LanguageDecision,
} from './choose.ts';
import { languageOf, type LanguageCode, type TranslatedCode } from './languages.ts';
import { setLocale } from './locale.ts';
import { watchFallbacks } from './marks.ts';
import { applyRegistryText, type RegistryText, type RegistryTextReport } from './registry-text.ts';

type Loader<T> = () => Promise<{ default: T }>;

/** Each language's interface catalog, in its own file so it downloads only when needed. */
const CATALOGS: Record<TranslatedCode, Loader<Catalog>> = {
  es: () => import('./locales/es.ts'),
  'zh-Hans': () => import('./locales/zh-Hans.ts'),
  vi: () => import('./locales/vi.ts'),
  ru: () => import('./locales/ru.ts'),
  'pt-BR': () => import('./locales/pt-BR.ts'),
  ht: () => import('./locales/ht.ts'),
  km: () => import('./locales/km.ts'),
  fr: () => import('./locales/fr.ts'),
  ar: () => import('./locales/ar.ts'),
};

/** Each language's registry text (registry/i18n/<code>.yaml, read by plugins/translations.ts). */
const REGISTRY_TEXTS: Record<TranslatedCode, Loader<RegistryText>> = {
  es: () => import('virtual:placekeepers/registry-text/es'),
  'zh-Hans': () => import('virtual:placekeepers/registry-text/zh-Hans'),
  vi: () => import('virtual:placekeepers/registry-text/vi'),
  ru: () => import('virtual:placekeepers/registry-text/ru'),
  'pt-BR': () => import('virtual:placekeepers/registry-text/pt-BR'),
  ht: () => import('virtual:placekeepers/registry-text/ht'),
  km: () => import('virtual:placekeepers/registry-text/km'),
  fr: () => import('virtual:placekeepers/registry-text/fr'),
  ar: () => import('virtual:placekeepers/registry-text/ar'),
};

/** Each language's content pages (content/<code>/*.md), for the content pages only. */
const CONTENT: Record<TranslatedCode, Loader<Record<string, string>>> = {
  es: () => import('virtual:placekeepers/content/es'),
  'zh-Hans': () => import('virtual:placekeepers/content/zh-Hans'),
  vi: () => import('virtual:placekeepers/content/vi'),
  ru: () => import('virtual:placekeepers/content/ru'),
  'pt-BR': () => import('virtual:placekeepers/content/pt-BR'),
  ht: () => import('virtual:placekeepers/content/ht'),
  km: () => import('virtual:placekeepers/content/km'),
  fr: () => import('virtual:placekeepers/content/fr'),
  ar: () => import('virtual:placekeepers/content/ar'),
};

export interface PageLanguage {
  code: LanguageCode;
  decision: LanguageDecision;
  /** The browser's language to offer on this first visit, or null. */
  offer: LanguageCode | null;
  /** True in the dev server and the end to end tests: the picker lists every language. */
  showAll: boolean;
  strings: ApplyReport | null;
  registry: RegistryTextReport | null;
}

let current: PageLanguage = {
  code: 'en',
  decision: { code: 'en', source: 'default', browser: null, chosen: false },
  offer: null,
  showAll: false,
  strings: null,
  registry: null,
};

/** What startLanguage() decided, for the picker, the offer and the translation note. */
export function pageLanguage(): PageLanguage {
  return current;
}

function showsAll(): boolean {
  return import.meta.env.DEV || (typeof __PK_E2E__ !== 'undefined' && __PK_E2E__);
}

function setDocumentLanguage(code: LanguageCode): void {
  const root = document.documentElement;
  root.lang = code;
  root.dir = languageOf(code).dir;
}

/**
 * Decides the page's language and makes everything that follows speak it. With a registry, its
 * visitor facing text is translated too. If a language's files cannot be loaded, the page shows
 * English and says nothing is wrong: the words are still all there.
 */
export async function startLanguage(options: { registry?: Registry } = {}): Promise<PageLanguage> {
  const showAll = showsAll();
  const decision = decideLanguage({
    search: window.location.search,
    browserLanguages: navigator.languages ?? [navigator.language],
    local: localStore(),
    session: sessionStore(),
  });
  let code = decision.code;
  let stringsReport: ApplyReport | null = null;
  let registryReport: RegistryTextReport | null = null;

  if (code !== 'en') {
    try {
      const [catalog, registryText] = await Promise.all([
        CATALOGS[code](),
        options.registry ? REGISTRY_TEXTS[code]() : Promise.resolve(null),
      ]);
      setLocale(code);
      stringsReport = applyCatalog(strings, catalog.default);
      if (options.registry && registryText) registryReport = applyRegistryText(options.registry, registryText.default);
    } catch (error) {
      console.warn(`Placekeepers could not load the words for "${code}", so this page is in English.`, error);
      code = 'en';
      setLocale('en');
    }
  }

  setDocumentLanguage(code);
  if (decision.source === 'link') rememberLinkLanguage(code, sessionStore());
  // The address bar always carries a language other than English, so a copied address keeps it.
  const address = addressWithLanguage(window.location.href, code);
  if (address !== window.location.href) history.replaceState(history.state, '', address);

  if (code !== 'en') {
    const start = () => watchFallbacks(document, code, languageOf(code).dir);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }

  current = { code, decision, offer: shouldOffer(decision, showAll), showAll, strings: stringsReport, registry: registryReport };
  return current;
}

/** The content pages in the page's language, or null in English or when they cannot be loaded. */
export async function loadContentPages(code: LanguageCode): Promise<Record<string, string> | null> {
  if (code === 'en') return null;
  try {
    return (await CONTENT[code]()).default;
  } catch (error) {
    console.warn(`Placekeepers could not load the pages for "${code}".`, error);
    return null;
  }
}
