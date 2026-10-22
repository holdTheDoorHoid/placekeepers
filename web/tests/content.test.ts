import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';
import { describe, expect, it } from 'vitest';
import { CONTENT_DIR, readContentPages } from '../plugins/content.ts';
import { REMOVAL_EMAIL } from '../src/content/removal-email.ts';
import { strings } from '../src/strings.ts';

function slugsOnDisk(): string[] {
  return readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => name.slice(0, -3))
    .sort();
}

describe('content pages and the site menu stay in step', () => {
  it('has a content/<slug>.md file for every page in strings.nav.pages', () => {
    const onDisk = new Set(slugsOnDisk());
    for (const page of strings.nav.pages) expect(onDisk).toContain(page.slug);
  });

  it('has a strings.nav.pages entry for every content/<slug>.md file', () => {
    const inNav = new Set(strings.nav.pages.map((p) => p.slug));
    for (const slug of slugsOnDisk()) expect(inNav).toContain(slug);
  });

  it('lists every page exactly once', () => {
    const slugs = strings.nav.pages.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('readContentPages', () => {
  const pages = readContentPages();

  it('renders every page to non-empty HTML with its own heading', () => {
    for (const slug of slugsOnDisk()) {
      expect(pages[slug], `content/${slug}.md should have rendered`).toBeTruthy();
      expect(pages[slug]).toMatch(/<h1/);
    }
  });

  it('turns a Markdown table into an HTML table (How to do it has several)', () => {
    expect(pages.how).toMatch(/<table>/);
  });

  it('puts every table in its own sideways scrolling box that a keyboard can reach', () => {
    for (const slug of slugsOnDisk()) {
      const tables = pages[slug]!.match(/<table>/g)?.length ?? 0;
      const boxes = pages[slug]!.match(/<div class="table-scroll" tabindex="0" role="group" aria-label="[^"]+"><table>/g)?.length ?? 0;
      expect(boxes, `content/${slug}.md`).toBe(tables);
    }
  });

  it('gives every table header cell some text, for screen readers', () => {
    for (const slug of slugsOnDisk()) expect(pages[slug], `content/${slug}.md`).not.toMatch(/<th>\s*<\/th>/);
  });

  it('never leaves the removal email token in the rendered contact page', () => {
    expect(pages.contact).not.toContain('{{REMOVAL_EMAIL}}');
  });

  it('says a private address is coming soon while REMOVAL_EMAIL is not set, and a mailto link once it is', () => {
    if (REMOVAL_EMAIL === null) {
      // Decision D7 (docs/VERIFICATION.md): no promise of an email that does not exist yet, and
      // the interim way to ask is a GitHub issue, said plainly to be public.
      expect(pages.contact).toMatch(/private email address for these requests is coming soon/);
      expect(pages.contact).toMatch(/Anyone can read a GitHub issue/);
      expect(pages.contact).toContain('template=memorial-removal.yml');
    } else {
      expect(pages.contact).toContain(`mailto:${REMOVAL_EMAIL}`);
    }
  });

  it('never promises removal by email while there is no removal address', () => {
    if (REMOVAL_EMAIL !== null) return;
    for (const slug of slugsOnDisk()) {
      const text = pages[slug]!.replace(/<[^>]+>/g, ' ');
      expect(text, `content/${slug}.md`).not.toMatch(/remov[a-z]*[^.]*by email|by email[^.]*remov/i);
      expect(text, `content/${slug}.md`).not.toMatch(/follow up by email/i);
    }
  });
});

describe('content pages in every language', () => {
  /** Every Markdown page: content/*.md and content/<code>/*.md. */
  function pages(): string[] {
    const out: string[] = [];
    for (const name of readdirSync(CONTENT_DIR)) {
      const path = join(CONTENT_DIR, name);
      if (statSync(path).isDirectory()) out.push(...readdirSync(path).filter((n) => n.endsWith('.md')).map((n) => join(path, n)));
      else if (name.endsWith('.md') && name !== 'README.md') out.push(path);
    }
    return out;
  }

  it('never turns a wrapped line starting with a number, such as a year, into a list of its own', () => {
    // Markdown reads "  2026." inside a list item as a new numbered list starting at 2026, with
    // an empty item: the stray fourth item once on How to do it.
    const problems: string[] = [];
    for (const path of pages()) {
      const html = marked.parse(readFileSync(path, 'utf8'), { async: false });
      if (/<li>\s*<\/li>/.test(html) || /<ol start="\d{3,}"/.test(html)) problems.push(path.slice(CONTENT_DIR.length + 1));
    }
    expect(problems).toEqual([]);
  });
});
