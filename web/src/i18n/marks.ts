// English text shown on a page in another language, because its translation is missing, is
// wrapped in two invisible characters: FIRST STRONG ISOLATE before it and POP DIRECTIONAL ISOLATE
// after it. They do two jobs:
//
//  * In Arabic, which reads right to left, they keep an English sentence in its own left to right
//    run, so its words and full stop stay in order (the Unicode bidirectional algorithm's
//    isolates, as the W3C recommends for text of another direction).
//  * They let watchFallbacks() find English text after the page draws and put lang="en" on the
//    element that holds it, so screen readers switch to an English voice.
//
// Nothing marks text on a page in English. Text that leaves the page (a downloaded file, an
// address) goes through plainText() so the marks never reach it.

import { isSourceLocale } from './locale.ts';

export const FALLBACK_START = '\u2068';
export const FALLBACK_END = '\u2069';
const MARKS = /[\u2068\u2069]/g;

/** English text marked as a fallback. */
export function markFallback(text: string): string {
  return text ? `${FALLBACK_START}${text}${FALLBACK_END}` : text;
}

/**
 * Text that stays in English in every language, such as the weekly refresh's notes for the people
 * who maintain the map: marked on a page in another language, as it is on a page in English.
 */
export function asEnglish(text: string): string {
  return isSourceLocale() ? text : markFallback(text);
}

/** The text without fallback marks, for files, addresses and comparisons. */
export function plainText(text: string): string {
  return text.replace(MARKS, '');
}

export function hasFallback(text: string): boolean {
  return text.includes(FALLBACK_START);
}

/** The text with every marked run taken out, outermost runs first. */
function withoutMarkedRuns(text: string): string {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === FALLBACK_START) depth++;
    else if (ch === FALLBACK_END) depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

const LETTER = /\p{L}/u;

/**
 * What language a piece of text is in, as far as the marks tell: "fallback" when every letter
 * in it sits inside a marked run, "translated" when it has letters outside any run, and null
 * when it has no letters at all (numbers, punctuation, an address).
 */
export function textKind(text: string): 'fallback' | 'translated' | null {
  if (!LETTER.test(text)) return null;
  if (!hasFallback(text)) return 'translated';
  return LETTER.test(withoutMarkedRuns(text)) ? 'translated' : 'fallback';
}

// Watching the page ------------------------------------------------------------------------

/** Set on an element whose lang attribute watchFallbacks() put there, so it can take it back. */
const OWN = 'data-pk-lang';
const NAMED_BY = ['aria-label', 'alt', 'placeholder', 'title'] as const;

function directText(el: Element): string {
  let text = '';
  for (const node of el.childNodes) if (node.nodeType === 3) text += node.nodeValue ?? '';
  return text;
}

/**
 * What an element's own words are: its text, or, for an element with no words inside it at all
 * (an icon button, a text box), the name an attribute gives it. An element whose words sit in its
 * children has none of its own: the children settle themselves, so a row of buttons labeled in
 * English does not make the buttons inside it English.
 */
function elementKind(el: Element): { kind: 'fallback' | 'translated'; fromText: boolean } | null {
  const own = textKind(directText(el));
  if (own) return { kind: own, fromText: true };
  if (LETTER.test(el.textContent ?? '')) return null;
  for (const name of NAMED_BY) {
    const value = el.getAttribute(name);
    if (value) {
      const kind = textKind(value);
      if (kind) return { kind, fromText: name === 'placeholder' };
    }
  }
  return null;
}

/** The language an element inherits from the nearest ancestor with a lang attribute. */
function inheritedLang(el: Element, pageLang: string): string {
  return el.parentElement?.closest('[lang]')?.getAttribute('lang') ?? pageLang;
}

/** The language the page, or an ancestor's own lang attribute (not one put there here), declares. */
function declaredLang(el: Element, pageLang: string): string {
  return el.parentElement?.closest(`[lang]:not([${OWN}])`)?.getAttribute('lang') ?? pageLang;
}

/** The direction an element inherits from the nearest ancestor with a dir attribute. */
function inheritedDir(el: Element): string {
  return el.parentElement?.closest('[dir]')?.getAttribute('dir') ?? 'ltr';
}

/** The direction for an element's own words on a right to left page. */
function directionFor(el: Element, want: string, pageLang: string): string {
  if (want === pageLang) return 'rtl';
  // A text box keeps "auto", so what a visitor types in Arabic still runs right to left.
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? 'auto' : 'ltr';
}

function settle(el: Element, pageLang: string, rtl: boolean): void {
  if (el.tagName === 'HTML') return;
  const ours = el.hasAttribute(OWN);
  // An element with its own lang or dir attribute (a language name in the picker, say) keeps it.
  if (!ours && (el.hasAttribute('lang') || el.hasAttribute('dir'))) return;
  const found = elementKind(el);
  // Unmarked words are in the language of their surroundings: the page's, or the language a part
  // of the page declares itself (an English content page shown before its translation exists).
  const want = found?.kind === 'fallback' ? 'en' : found?.kind === 'translated' ? declaredLang(el, pageLang) : null;
  const lang = want !== null && want !== inheritedLang(el, pageLang) ? want : null;
  // On an Arabic page an English sentence reads left to right, so its words and punctuation stay
  // in order and a cut off line ends with "..." where it should; Arabic inside it reads right to
  // left again. Only an element's own text decides this, never a label on a box of other things.
  let dir: string | null = null;
  if (rtl && want !== null && found?.fromText) {
    const wanted = directionFor(el, want, pageLang);
    if (wanted !== inheritedDir(el)) dir = wanted;
  }
  if (lang === null && dir === null) {
    if (ours) {
      el.removeAttribute('lang');
      el.removeAttribute('dir');
      el.removeAttribute(OWN);
    }
    return;
  }
  if (lang !== null) {
    if (el.getAttribute('lang') !== lang) el.setAttribute('lang', lang);
  } else if (ours) el.removeAttribute('lang');
  if (dir !== null) {
    if (el.getAttribute('dir') !== dir) el.setAttribute('dir', dir);
  } else if (ours) el.removeAttribute('dir');
  if (!ours) el.setAttribute(OWN, '');
}

function settleTree(root: Element, pageLang: string, rtl: boolean): void {
  settle(root, pageLang, rtl);
  // Parents before children, so a child knows the language it inherits.
  const walker = root.ownerDocument.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) settle(node as Element, pageLang, rtl);
}

/**
 * Puts lang="en" on every element whose words are English fallbacks, and the page's language
 * back on a translated element inside one, now and whenever the page changes; on a right to left
 * page, the matching dir too. Returns a function that stops watching.
 */
export function watchFallbacks(doc: Document, pageLang: string, pageDir: 'ltr' | 'rtl' = 'ltr'): () => void {
  if (!doc.body) return () => {};
  const rtl = pageDir === 'rtl';
  settleTree(doc.body, pageLang, rtl);
  let pending = new Set<Element>();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const roots = [...pending].filter((el) => el.isConnected);
    pending = new Set();
    // Skip any element inside another one already being settled.
    for (const el of roots) if (!roots.some((other) => other !== el && other.contains(el))) settleTree(el, pageLang, rtl);
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target.nodeType === 1 ? (record.target as Element) : record.target.parentElement;
      if (target) pending.add(target);
    }
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  });
  observer.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...NAMED_BY] });
  return () => observer.disconnect();
}
