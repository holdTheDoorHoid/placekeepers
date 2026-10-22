// Interface catalogs: one file per language in src/i18n/locales/, each mirroring the English
// object in web/src/strings.ts key for key. English stays the source of truth: a key the catalog
// leaves out shows the English text, marked so screen readers read it in an English voice
// (src/i18n/marks.ts), and a key English adds later simply falls back until a translator gets to
// it. Nothing in strings.ts has to change for a new English key to work this way.
//
// The catalog's type comes from strings.ts itself, so TypeScript stops a key English lacks and a
// template with the wrong arguments; tests/i18n.test.ts checks the same at run time, checks that
// every template keeps the values English shows, and lists what each language still lacks.

import type { strings } from '../strings.ts';
import { markFallback } from './marks.ts';

/** The shape of a translation of `T`: every key optional, text widened from English's literals. */
export type Translation<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Translation<R>
    : T extends readonly (infer E)[]
      ? readonly Translation<E>[]
      : T extends object
        ? { readonly [K in keyof T]?: Translation<T[K]> }
        : T;

/** A language's interface catalog. */
export type Catalog = Translation<typeof strings>;

/**
 * Keys that stay in English in every language, and are never marked: web addresses, and the
 * subject and body of the memorial removal email, which the project's maintainers read.
 */
export const ENGLISH_ONLY: ReadonlySet<string> = new Set([
  'app.repoUrl',
  'redlining.homepage',
  'redlining.licenseUrl',
  'streets.removalSubject',
  'streets.removalBody',
]);

/** Object keys whose values are identifiers, never text (the menu's page slugs). */
const ID_KEYS: ReadonlySet<string> = new Set(['slug']);
/** Values that are web addresses rather than words. */
const ADDRESS = /^(https?:\/\/|mailto:)/;

export interface ApplyReport {
  /** Keys a translation replaced. */
  translated: string[];
  /** Keys that kept their English text, marked. */
  fallback: string[];
  /** Keys in the catalog that English does not have. */
  extra: string[];
  /** Keys whose translation has another kind of value than English (text for a template, say). */
  mismatched: string[];
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A template that marks what it returns, keeping the original's argument count. On a right to
 * left page its text values are isolated too, so a date in Arabic stays whole inside an English
 * sentence.
 */
function markedTemplate(
  fn: (...args: unknown[]) => unknown,
  mark: (text: string) => string,
  isolate?: (text: string) => string,
): (...args: unknown[]) => unknown {
  const wrapped = (...args: unknown[]) => markValue(fn(...(isolate ? isolated(args, isolate) : args)), mark);
  Object.defineProperty(wrapped, 'length', { value: fn.length });
  return wrapped;
}

function markValue(value: unknown, mark: (text: string) => string): unknown {
  if (typeof value === 'string') return ADDRESS.test(value) ? value : mark(value);
  if (Array.isArray(value)) return value.map((v) => markValue(v, mark));
  if (isBag(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, ID_KEYS.has(k) ? v : markValue(v, mark)]));
  return value;
}

/**
 * The values a template is given, with each piece of text of more than one word isolated (right to
 * left pages). A single word is left alone: it cannot fall out of order, and templates compare
 * codes such as "segment" or "memorials", which must reach them as they are.
 */
function isolated(args: unknown[], isolate: (text: string) => string): unknown[] {
  return args.map((a) => (typeof a === 'string' && /\s/.test(a.trim()) ? isolate(a) : a));
}

/** A translated template whose text values are isolated before it uses them (right to left pages). */
function isolatingTemplate(fn: (...args: unknown[]) => unknown, isolate: (text: string) => string): (...args: unknown[]) => unknown {
  const wrapped = (...args: unknown[]) => fn(...isolated(args, isolate));
  Object.defineProperty(wrapped, 'length', { value: fn.length });
  return wrapped;
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

/** Arrays of objects with a slug are matched by slug; other arrays by position, when lengths agree. */
interface Writing {
  mark: (text: string) => string;
  /** On a right to left page, wraps each text value a translated template fills in. */
  isolate?: (text: string) => string;
}

function mergeArray(en: unknown[], tr: unknown, path: string, report: ApplyReport, mark: Writing): void {
  const list = Array.isArray(tr) ? tr : undefined;
  if (tr !== undefined && !list) report.mismatched.push(path);
  const bySlug = en.every((e) => isBag(e) && typeof e.slug === 'string');
  if (bySlug) {
    const found = new Map((list ?? []).filter(isBag).map((t) => [t.slug, t]));
    for (const [i, e] of en.entries()) mergeValue(en, i, found.get((e as Bag).slug), `${path}[${String((e as Bag).slug)}]`, report, mark);
    for (const t of list ?? []) if (isBag(t) && !en.some((e) => (e as Bag).slug === t.slug)) report.extra.push(`${path}[${String(t.slug)}]`);
    return;
  }
  const usable = list && list.length === en.length ? list : undefined;
  if (list && !usable) report.mismatched.push(path);
  for (let i = 0; i < en.length; i++) mergeValue(en, i, usable?.[i], `${path}[${i}]`, report, mark);
}

function mergeValue(
  holder: Bag | unknown[],
  key: string | number,
  tr: unknown,
  path: string,
  report: ApplyReport,
  how: Writing,
): void {
  const mark = how.mark;
  const box = holder as Record<string | number, unknown>;
  const en = box[key];
  if (typeof en === 'string') {
    if (typeof tr === 'string' && tr.trim()) {
      box[key] = tr;
      report.translated.push(path);
    } else {
      if (tr !== undefined && typeof tr !== 'string') report.mismatched.push(path);
      if (!ADDRESS.test(en)) box[key] = mark(en);
      report.fallback.push(path);
    }
  } else if (typeof en === 'function') {
    if (typeof tr === 'function') {
      box[key] = how.isolate ? isolatingTemplate(tr as (...args: unknown[]) => unknown, how.isolate) : tr;
      report.translated.push(path);
    } else {
      if (tr !== undefined) report.mismatched.push(path);
      box[key] = markedTemplate(en as (...args: unknown[]) => unknown, mark, how.isolate);
      report.fallback.push(path);
    }
  } else if (Array.isArray(en)) {
    mergeArray(en, tr, path, report, how);
  } else if (isBag(en)) {
    if (tr !== undefined && !isBag(tr)) report.mismatched.push(path);
    mergeObject(en, isBag(tr) ? tr : undefined, path, report, how);
  }
}

function mergeObject(en: Bag, tr: Bag | undefined, path: string, report: ApplyReport, mark: Writing): void {
  for (const key of Object.keys(en)) {
    const p = join(path, key);
    if (ENGLISH_ONLY.has(p) || ID_KEYS.has(key)) {
      if (tr && key in tr && !ID_KEYS.has(key)) report.extra.push(p);
      continue;
    }
    mergeValue(en, key, tr?.[key], p, report, mark);
  }
  if (tr) for (const key of Object.keys(tr)) if (!(key in en)) report.extra.push(join(path, key));
}

/**
 * Writes a catalog into the English object in place, leaf by leaf, so every module that already
 * holds a part of `strings` (say `const f = strings.dossier.flags`) sees the translation. Keys the
 * catalog leaves out keep their English text, passed through `mark`. Returns what happened, key
 * by key. Never call it on a page in English.
 */
export function applyCatalog(
  target: object,
  catalog: object,
  mark: (text: string) => string = markFallback,
  options: { isolate?: (text: string) => string } = {},
): ApplyReport {
  const report: ApplyReport = { translated: [], fallback: [], extra: [], mismatched: [] };
  mergeObject(target as Bag, catalog as Bag, '', report, { mark, isolate: options.isolate });
  return report;
}

/**
 * The same walk without changing anything: what a catalog translates, lacks and has too much of,
 * measured against a deep copy of English. For the tests and the status script.
 */
export function compareCatalog(english: object, catalog: object): ApplyReport {
  return applyCatalog(cloneText(english), catalog, (text) => text);
}

/** A copy of a strings object deep enough that applying a catalog to it leaves the original alone. */
export function cloneText<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneText) as T;
  if (isBag(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneText(v)])) as T;
  return value;
}
