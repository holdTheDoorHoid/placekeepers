// Mounts a single content page (About, Why this works, and so on). Every content page's
// index.html loads this same script and names its page with data-slug on #app, so this one file
// serves all of them; see web/about/index.html for the pattern.
import '../app.css';
import { mount } from 'svelte';
import content from 'virtual:placekeepers/content';
import ContentPage from './ContentPage.svelte';

const target = document.getElementById('app')!;
const slug = target.dataset.slug;
const html = slug ? content[slug] : undefined;

if (!slug || html === undefined) {
  throw new Error(`No content page for slug "${slug}". Known pages: ${Object.keys(content).join(', ')}.`);
}

mount(ContentPage, { target, props: { slug, html } });
