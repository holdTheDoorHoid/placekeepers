import { readdirSync } from 'node:fs';
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

  it('never leaves the removal email token in the rendered contact page', () => {
    expect(pages.contact).not.toContain('{{REMOVAL_EMAIL}}');
  });

  it('says "coming soon" style text while REMOVAL_EMAIL is not set, and a mailto link once it is', () => {
    if (REMOVAL_EMAIL === null) {
      expect(pages.contact).toMatch(/not finished setting up/);
    } else {
      expect(pages.contact).toContain(`mailto:${REMOVAL_EMAIL}`);
    }
  });
});
