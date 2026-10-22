// Registry text in other languages: one file per language, registry/i18n/<code>.yaml, holding
// the visitor facing words of registry/*.yaml by id. English in registry/*.yaml stays the source;
// a field a translation leaves out shows the English, marked (src/i18n/marks.ts).
//
// A translation file looks like this (every part optional):
//
//   layers:
//     vacant_parcels:
//       label: Lotes y edificios vacíos
//       description: ...
//       settings:
//         min_confidence:
//           label: ...
//           options:
//             "3": ...
//   routes:
//     garden_agreement:
//       steps: [first step, second step, ...]   # as many as English has
//       links:
//         "https://www.phila.gov/...": ...      # keyed by the link's address
//
// Ids, addresses, numbers, licenses, attributions and partner names are never translated.

import type { Registry } from '../registry/types.ts';
import { markFallback } from './marks.ts';

interface ListSpec {
  /** The field that names each item: its id, an option's value, a link's address. */
  key: string;
  fields: readonly string[];
  /** Fields that are lists of text, translated item by item (a route's steps). */
  texts?: readonly string[];
  lists?: Readonly<Record<string, ListSpec>>;
}

/**
 * Which words of each registry file a visitor reads, and so which a translation may hold. Source
 * attributions, license names and partner names stay as written: they are credits and names.
 */
export const REGISTRY_TEXT: Readonly<Record<keyof Registry, ListSpec>> = {
  groups: { key: 'id', fields: ['label', 'description'] },
  licenses: { key: 'id', fields: [] },
  sources: { key: 'id', fields: ['name', 'publisher'] },
  layers: {
    key: 'id',
    fields: ['label', 'description'],
    lists: { settings: { key: 'id', fields: ['label'], lists: { options: { key: 'value', fields: ['label'] } } } },
  },
  lenses: {
    key: 'id',
    fields: ['label', 'description'],
    lists: { factors: { key: 'id', fields: ['label', 'explain'] }, presets: { key: 'id', fields: ['label'] } },
  },
  suggestions: { key: 'id', fields: ['label', 'summary', 'cost'] },
  routes: {
    key: 'id',
    fields: ['label', 'who', 'warning', 'cost', 'timeline'],
    texts: ['steps'],
    lists: { links: { key: 'url', fields: ['label'] } },
  },
  partners: { key: 'id', fields: ['one_line'] },
  options: { key: 'id', fields: ['label', 'description'], lists: { options: { key: 'value', fields: ['label'] } } },
};

export type RegistryText = Partial<Record<keyof Registry, Record<string, unknown>>>;

export interface RegistryTextReport {
  /** Paths such as "layers.vacant_parcels.label" a translation replaced. */
  translated: string[];
  /** Paths that kept their English. */
  fallback: string[];
  /** Paths in the translation that English does not have, or that may not be translated. */
  extra: string[];
  /** Paths whose translation is the wrong kind of value, or a list of steps of another length. */
  mismatched: string[];
}

type Bag = Record<string, unknown>;
const isBag = (v: unknown): v is Bag => !!v && typeof v === 'object' && !Array.isArray(v);

function walkItems(
  items: Bag[],
  spec: ListSpec,
  tr: unknown,
  path: string,
  report: RegistryTextReport,
  write: boolean,
  mark: (text: string) => string,
): void {
  if (tr !== undefined && !isBag(tr)) report.mismatched.push(path);
  const given = isBag(tr) ? tr : {};
  const keys = new Set<string>();
  for (const item of items) {
    const key = String(item[spec.key]);
    keys.add(key);
    walkItem(item, spec, given[key], `${path}.${key}`, report, write, mark);
  }
  for (const key of Object.keys(given)) if (!keys.has(key)) report.extra.push(`${path}.${key}`);
}

function walkItem(
  item: Bag,
  spec: ListSpec,
  tr: unknown,
  path: string,
  report: RegistryTextReport,
  write: boolean,
  mark: (text: string) => string,
): void {
  if (tr !== undefined && !isBag(tr)) report.mismatched.push(path);
  const given = isBag(tr) ? tr : {};
  const allowed = new Set([...spec.fields, ...(spec.texts ?? []), ...Object.keys(spec.lists ?? {})]);
  for (const field of spec.fields) {
    const en = item[field];
    if (typeof en !== 'string' || !en) continue;
    const t = given[field];
    const p = `${path}.${field}`;
    if (typeof t === 'string' && t.trim()) {
      if (write) item[field] = t.trim();
      report.translated.push(p);
    } else {
      if (t !== undefined && typeof t !== 'string') report.mismatched.push(p);
      if (write) item[field] = mark(en);
      report.fallback.push(p);
    }
  }
  for (const field of spec.texts ?? []) {
    const en = item[field];
    if (!Array.isArray(en) || en.length === 0) continue;
    const t = given[field];
    const p = `${path}.${field}`;
    const ok = Array.isArray(t) && t.length === en.length && t.every((s) => typeof s === 'string' && s.trim());
    if (ok) {
      if (write) item[field] = (t as string[]).map((s) => s.trim());
      report.translated.push(p);
    } else {
      if (t !== undefined) report.mismatched.push(p);
      if (write) item[field] = en.map((s) => (typeof s === 'string' ? mark(s) : s));
      report.fallback.push(p);
    }
  }
  for (const [field, sub] of Object.entries(spec.lists ?? {})) {
    const list = item[field];
    if (Array.isArray(list)) walkItems(list.filter(isBag), sub, given[field], `${path}.${field}`, report, write, mark);
  }
  for (const field of Object.keys(given)) if (!allowed.has(field)) report.extra.push(`${path}.${field}`);
}

function walkRegistry(registry: Registry, text: RegistryText, write: boolean, mark: (text: string) => string): RegistryTextReport {
  const report: RegistryTextReport = { translated: [], fallback: [], extra: [], mismatched: [] };
  const given = isBag(text) ? (text as Bag) : {};
  for (const file of Object.keys(REGISTRY_TEXT) as (keyof Registry)[]) {
    walkItems(registry[file] as unknown as Bag[], REGISTRY_TEXT[file], given[file], file, report, write, mark);
  }
  for (const file of Object.keys(given)) if (!(file in REGISTRY_TEXT)) report.extra.push(file);
  return report;
}

/**
 * Writes a language's registry text into the registry in place, before the page builds anything
 * from it; fields left out keep their English, marked. Never call it on a page in English.
 */
export function applyRegistryText(registry: Registry, text: RegistryText, mark: (text: string) => string = markFallback): RegistryTextReport {
  return walkRegistry(registry, text, true, mark);
}

/** What a registry translation covers, lacks and has too much of, without changing anything. */
export function compareRegistryText(registry: Registry, text: RegistryText): RegistryTextReport {
  return walkRegistry(registry, text, false, (t) => t);
}

/** Every translatable registry text with its path, in English, for the status script and tests. */
export function registryTextPaths(registry: Registry): string[] {
  return compareRegistryText(registry, {}).fallback;
}
