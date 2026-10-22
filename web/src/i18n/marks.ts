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

/** What an element's own words are: its text, or the name given in an attribute when it has none. */
function elementKind(el: Element): 'fallback' | 'translated' | null {
  const own = textKind(directText(el));
  if (own) return own;
  for (const name of NAMED_BY) {
    const value = el.getAttribute(name);
    if (value) {
      const kind = textKind(value);
      if (kind) return kind;
    }
  }
  return null;
}

/** The language an element inherits from the nearest ancestor with a lang attribute. */
function inheritedLang(el: Element, pageLang: string): string {
  return el.parentElement?.closest('[lang]')?.getAttribute('lang') ?? pageLang;
}

function settle(el: Element, pageLang: string): void {
  if (el.tagName === 'HTML') return;
  const ours = el.hasAttribute(OWN);
  // An element with its own lang attribute (a language name in the picker, say) keeps it.
  if (!ours && el.hasAttribute('lang')) return;
  const kind = elementKind(el);
  const want = kind === 'fallback' ? 'en' : kind === 'translated' ? pageLang : null;
  if (want && want !== inheritedLang(el, pageLang)) {
    if (el.getAttribute('lang') !== want) el.setAttribute('lang', want);
    if (!ours) el.setAttribute(OWN, '');
  } else if (ours) {
    el.removeAttribute('lang');
    el.removeAttribute(OWN);
  }
}

function settleTree(root: Element, pageLang: string): void {
  settle(root, pageLang);
  // Parents before children, so a child knows the language it inherits.
  const walker = root.ownerDocument.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) settle(node as Element, pageLang);
}

/**
 * Puts lang="en" on every element whose words are English fallbacks, and the page's language
 * back on a translated element inside one, now and whenever the page changes. Returns a function
 * that stops watching.
 */
export function watchFallbacks(doc: Document, pageLang: string): () => void {
  if (!doc.body) return () => {};
  settleTree(doc.body, pageLang);
  let pending = new Set<Element>();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const roots = [...pending].filter((el) => el.isConnected);
    pending = new Set();
    // Skip any element inside another one already being settled.
    for (const el of roots) if (!roots.some((other) => other !== el && other.contains(el))) settleTree(el, pageLang);
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
