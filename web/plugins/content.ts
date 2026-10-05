// Vite plugin: reads ../content/*.md at build time, checks the house dash style, converts each
// file to HTML, and serves the result to the app as the module "virtual:placekeepers/content".
// Markdown parsing happens here, in Node, so the browser never downloads a markdown parser; the
// client bundle only ever gets plain HTML strings.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import type { Plugin } from 'vite';
import { REMOVAL_EMAIL } from '../src/content/removal-email.ts';
import { strings } from '../src/strings.ts';
import { findDashViolations } from '../src/style/no-dashes.ts';

export const CONTENT_DIR = fileURLToPath(new URL('../../content', import.meta.url));

const VIRTUAL_ID = 'virtual:placekeepers/content';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// contact.md carries this token where the removal email goes. REMOVAL_EMAIL is the one constant
// to change once the owner creates the address; every other page is untouched by this, because
// none of them contain the token.
const REMOVAL_EMAIL_TOKEN = '{{REMOVAL_EMAIL}}';
const REMOVAL_EMAIL_FALLBACK =
  'We have not finished setting up a dedicated email address for this yet. Check back soon, or use the correction form below and we will follow up by email.';

function renderRemovalEmail(): string {
  return REMOVAL_EMAIL ? `Email us at [${REMOVAL_EMAIL}](mailto:${REMOVAL_EMAIL}).` : REMOVAL_EMAIL_FALLBACK;
}

/**
 * Wraps each table in a box that scrolls sideways on its own, so a wide table never makes the
 * whole page scroll sideways on a phone (WCAG 1.4.10). The box can take keyboard focus, so the
 * arrow keys scroll it too (WCAG 2.1.1), and it is named for screen readers: a group rather than a
 * landmark, so pages with many tables do not fill the list of landmarks.
 */
export function wrapTables(html: string): string {
  return html
    .replaceAll('<table>', `<div class="table-scroll" tabindex="0" role="group" aria-label="${strings.content.tableLabel}"><table>`)
    .replaceAll('</table>', '</table></div>');
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();
}

/** Reads, style checks, and renders every content page. Throws one error listing every problem. */
export function readContentPages(dir: string = CONTENT_DIR): Record<string, string> {
  const pages: Record<string, string> = {};
  const problems: string[] = [];

  for (const name of markdownFiles(dir)) {
    const slug = name.slice(0, -3);
    const raw = readFileSync(resolve(dir, name), 'utf8').replaceAll(REMOVAL_EMAIL_TOKEN, renderRemovalEmail());
    for (const problem of findDashViolations(raw)) problems.push(`content/${name} has a ${problem}`);
    pages[slug] = wrapTables(marked.parse(raw, { async: false }) as string);
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
