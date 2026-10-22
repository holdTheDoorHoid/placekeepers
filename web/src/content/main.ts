// Mounts a single content page (About, Why this works, and so on). Every content page's
// index.html loads this same script and names its page with data-slug on #app, so this one file
// serves all of them; see web/about/index.html for the pattern.
//
// The language comes first (src/i18n/boot.ts). In another language the page is
// content/<code>/<slug>.md when a translator has written it; otherwise the English page is shown,
// marked as English, under a note in the page's language saying it is not translated yet.
import '../app.css';
import content from 'virtual:placekeepers/content';
import { loadContentPages, startLanguage } from '../i18n/boot.ts';
import { plainText } from '../i18n/marks.ts';
import { strings } from '../strings.ts';

const { code } = await startLanguage();
const target = document.getElementById('app')!;
const slug = target.dataset.slug;
const english = slug ? content[slug] : undefined;

if (!slug || english === undefined) {
  throw new Error(`No content page for slug "${slug}". Known pages: ${Object.keys(content).join(', ')}.`);
}

const translated = (await loadContentPages(code))?.[slug];
// The browser tab says the page's name in the page's language (index.html has it in English).
const label = strings.nav.pages.find((p) => p.slug === slug)?.label;
if (code !== 'en' && label) document.title = plainText(`${label}, ${strings.app.name}`);
const [{ mount }, { default: ContentPage }] = await Promise.all([import('svelte'), import('./ContentPage.svelte')]);
mount(ContentPage, { target, props: { slug, html: translated ?? english, inEnglish: code !== 'en' && translated === undefined } });
