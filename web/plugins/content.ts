// Vite plugin: reads ../content/*.md at build time, checks the house dash style, converts each
// file to HTML, and serves the result to the app as the module "virtual:placekeepers/content".
// Markdown parsing happens here, in Node, so the browser never downloads a markdown parser; the
// client bundle only ever gets plain HTML strings.
//
// Pages in other languages live in content/<code>/<slug>.md with the same file names, and are
// served one language at a time by plugins/translations.ts through readContentPages(dir, code).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import type { Plugin } from 'vite';
import { REMOVAL_EMAIL } from '../src/content/removal-email.ts';
import type { Catalog } from '../src/i18n/catalog.ts';
import { strings } from '../src/strings.ts';
import { findDashViolations } from '../src/style/no-dashes.ts';

export const CONTENT_DIR = fileURLToPath(new URL('../../content', import.meta.url));

const VIRTUAL_ID = 'virtual:placekeepers/content';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// contact.md carries this token where the removal email goes. REMOVAL_EMAIL is the one constant
// to change once the owner creates the address; every other page is untouched by this, because
// none of them contain the token.
const REMOVAL_EMAIL_TOKEN = '{{REMOVAL_EMAIL}}';
// Until the address exists, no text promises one (docs/VERIFICATION.md, decision D7): the page says
// a private address is coming soon and that meanwhile a request can be made in a GitHub issue,
// which anyone can read. The sentences live in web/src/strings.ts (content.removalEmail and
// content.removalComingSoon), so each language's catalog can translate them.
export const REMOVAL_ISSUE_URL = 'https://github.com/holdTheDoorHoid/placekeepers/issues/new?template=memorial-removal.yml';

/** The words a page in another language takes from its catalog, English where it has none. */
export interface PageWords {
  tableLabel: string;
  removalEmail: (email: string) => string;
  removalComingSoon: (issueUrl: string) => string;
}

const ENGLISH_WORDS: PageWords = {
  tableLabel: strings.content.tableLabel,
  removalEmail: strings.content.removalEmail,
  removalComingSoon: strings.content.removalComingSoon,
};

/** A language's page words from its catalog; English words are wrapped to say they are English. */
export function pageWords(catalog: Catalog | null): PageWords {
  const own = catalog?.content;
  const english = (text: string) => `<span lang="en">${text}</span>`;
  return {
    tableLabel: own?.tableLabel ?? ENGLISH_WORDS.tableLabel,
    removalEmail: own?.removalEmail ?? ((email) => english(ENGLISH_WORDS.removalEmail(email))),
    removalComingSoon: own?.removalComingSoon ?? ((url) => english(ENGLISH_WORDS.removalComingSoon(url))),
  };
}

function renderRemovalEmail(words: PageWords): string {
  return REMOVAL_EMAIL ? words.removalEmail(REMOVAL_EMAIL) : words.removalComingSoon(REMOVAL_ISSUE_URL);
}

/**
 * Wraps each table in a box that scrolls sideways on its own, so a wide table never makes the
 * whole page scroll sideways on a phone (WCAG 1.4.10). The box can take keyboard focus, so the
 * arrow keys scroll it too (WCAG 2.1.1), and it is named for screen readers: a group rather than a
 * landmark, so pages with many tables do not fill the list of landmarks.
 */
export function wrapTables(html: string, label: string = ENGLISH_WORDS.tableLabel): string {
  return html
    .replaceAll('<table>', `<div class="table-scroll" tabindex="0" role="group" aria-label="${label.replaceAll('"', '&quot;')}"><table>`)
    .replaceAll('</table>', '</table></div>');
}

/** The content page files in a folder: every Markdown file but the README. */
export function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();
}

/**
 * Reads, style checks, and renders every content page, in English, or with `language` the pages
 * in content/<code>/ with that language's words. Throws one error listing every problem.
 */
export function readContentPages(dir: string = CONTENT_DIR, language?: { code: string; words: PageWords }): Record<string, string> {
  const pages: Record<string, string> = {};
  const problems: string[] = [];
  const folder = language ? resolve(dir, language.code) : dir;
  const words = language?.words ?? ENGLISH_WORDS;
  const shown = language ? `content/${language.code}/` : 'content/';

  for (const name of markdownFiles(folder)) {
    const slug = name.slice(0, -3);
    const raw = readFileSync(resolve(folder, name), 'utf8').replaceAll(REMOVAL_EMAIL_TOKEN, renderRemovalEmail(words));
    for (const problem of findDashViolations(raw)) problems.push(`${shown}${name} has a ${problem}`);
    pages[slug] = wrapTables(marked.parse(raw, { async: false }) as string, words.tableLabel);
  }

  if (problems.length) {
    throw new Error(
      `Dashes are not allowed as punctuation (CLAUDE.md: "No dashes as punctuation"). Fix these:\n${problems.join('\n')}`,
    );
  }
  return pages;
}

export function contentPlugin(dir: string = CONTENT_DIR): Plugin {
  return {
    name: 'placekeepers-content',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      // Watch files only, never the directory itself: Vite's dev server tries to resolve every
      // watched path as an importable module, and a directory is not one (it fails with
      // "Failed to resolve import ... /content/content"). A new page needs a dev server restart
      // to appear, the same tradeoff plugins/registry.ts already makes for a new registry file.
      for (const name of markdownFiles(dir)) this.addWatchFile(resolve(dir, name));
      return `export default ${JSON.stringify(readContentPages(dir))};`;
    },
  };
}
