// Vite plugin: serves each language's registry text and content pages as modules of their own,
// so a page downloads only its own language:
//
//   virtual:placekeepers/registry-text/<code>  registry/i18n/<code>.yaml, checked against the
//                                               registry (src/i18n/registry-text.ts)
//   virtual:placekeepers/content/<code>        content/<code>/*.md, rendered as plugins/content.ts
//                                               renders the English pages
//
// A missing file is simply an empty translation: everything falls back to English. Problems in a
// file (an id the registry does not have, a dash) are printed as warnings here, so a stale
// translation never stops the site from building, and they fail tests/i18n.test.ts in CI.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';
import { parse } from 'yaml';
import type { Catalog } from '../src/i18n/catalog.ts';
import { TRANSLATED_CODES, type TranslatedCode } from '../src/i18n/languages.ts';
import { compareRegistryText, type RegistryText } from '../src/i18n/registry-text.ts';
import { CONTENT_DIR, markdownFiles, pageWords, readContentPages } from './content.ts';
import { REGISTRY_DIR, loadRegistry } from './registry.ts';

export const REGISTRY_TEXT_DIR = resolve(REGISTRY_DIR, 'i18n');
export const LOCALES_DIR = fileURLToPath(new URL('../src/i18n/locales', import.meta.url));

const REGISTRY_PREFIX = 'virtual:placekeepers/registry-text/';
const CONTENT_PREFIX = 'virtual:placekeepers/content/';

/** The path of a language's registry text file. */
export function registryTextFile(code: string, dir: string = REGISTRY_TEXT_DIR): string {
  return resolve(dir, `${code}.yaml`);
}

/** A language's registry text, or an empty one when it has no file yet. Throws on bad YAML. */
export function readRegistryText(code: string, dir: string = REGISTRY_TEXT_DIR): RegistryText {
  const path = registryTextFile(code, dir);
  if (!existsSync(path)) return {};
  const parsed = parse(readFileSync(path, 'utf8'), { prettyErrors: true, uniqueKeys: true }) as unknown;
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`registry/i18n/${code}.yaml must be a map of registry files.`);
  return parsed as RegistryText;
}

/** A language's interface catalog, loaded in Node for the words its content pages need. */
export async function loadCatalog(code: string): Promise<Catalog | null> {
  const path = resolve(LOCALES_DIR, `${code}.ts`);
  if (!existsSync(path)) return null;
  // The file's time in the address, so the dev server picks up a translator's edit. Vitest loads
  // modules its own way and needs the plain address.
  const url = pathToFileURL(path).href;
  const mod = (await import(process.env.VITEST ? url : `${url}?v=${Math.round(statSync(path).mtimeMs)}`)) as { default?: Catalog };
  return mod.default ?? null;
}

function isTranslated(code: string): code is TranslatedCode {
  return (TRANSLATED_CODES as readonly string[]).includes(code);
}

export function translationsPlugin(): Plugin {
  return {
    name: 'placekeepers-translations',
    resolveId(id) {
      if (id.startsWith(REGISTRY_PREFIX) || id.startsWith(CONTENT_PREFIX)) return '\0' + id;
      return undefined;
    },
    async load(id) {
      if (!id.startsWith('\0virtual:placekeepers/')) return undefined;
      const virtual = id.slice(1);
      if (virtual.startsWith(REGISTRY_PREFIX)) {
        const code = virtual.slice(REGISTRY_PREFIX.length);
        if (!isTranslated(code)) throw new Error(`No language "${code}" (src/i18n/languages.ts).`);
        const path = registryTextFile(code);
        if (existsSync(path)) this.addWatchFile(path);
        const text = readRegistryText(code);
        const report = compareRegistryText(loadRegistry(), text);
        for (const problem of [...report.extra, ...report.mismatched]) {
          this.warn(`registry/i18n/${code}.yaml: ${problem} does not match the registry, so it is left out.`);
        }
        return `export default ${JSON.stringify(text)};`;
      }
      if (virtual.startsWith(CONTENT_PREFIX)) {
        const code = virtual.slice(CONTENT_PREFIX.length);
        if (!isTranslated(code)) throw new Error(`No language "${code}" (src/i18n/languages.ts).`);
        const folder = resolve(CONTENT_DIR, code);
        for (const name of markdownFiles(folder)) this.addWatchFile(resolve(folder, name));
        const catalogPath = resolve(LOCALES_DIR, `${code}.ts`);
        if (existsSync(catalogPath)) this.addWatchFile(catalogPath);
        const words = pageWords(await loadCatalog(code));
        return `export default ${JSON.stringify(readContentPages(CONTENT_DIR, { code, words }))};`;
      }
      return undefined;
    },
  };
}
