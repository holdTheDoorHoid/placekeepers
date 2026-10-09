/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { contentPlugin } from './plugins/content.ts';
import { dataRootPlugin } from './plugins/data-root.ts';
import { registryPlugin } from './plugins/registry.ts';

// End to end tests (playwright.config.ts) build the same production site into dist-e2e/ without
// public/, which holds only a local copy of the data root, so the tests always read the committed
// sample in fixtures/data/ (served by plugins/data-root.ts) and never real data.
const e2e = process.env.PK_E2E === '1';

export default defineConfig({
  // The site is published on GitHub Pages at https://<owner>.github.io/placekeepers/.
  base: '/placekeepers/',
  publicDir: e2e ? false : 'public',
  // The map, the data status page, every content page, and real 404s for missing files, as on
  // Pages. Each content page is its own entry below, following the pattern status/index.html set.
  appType: 'mpa',
  plugins: [registryPlugin(), contentPlugin(), dataRootPlugin(), svelte()],
  // True only in the end to end tests' build, which may hand the tests a few things to watch
  // (src/components/MapView.svelte). The published site is built with it false, and the code
  // behind it is dropped from the bundle.
  define: { __PK_E2E__: JSON.stringify(e2e) },
  build: {
    outDir: e2e ? 'dist-e2e' : 'dist',
    target: 'es2022',
    // MapLibre alone is about 1 MB (280 kB compressed). It loads after the page appears.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      input: {
        main: 'index.html',
        status: 'status/index.html',
        about: 'about/index.html',
        why: 'why/index.html',
        how: 'how/index.html',
        responsibly: 'responsibly/index.html',
        vacantLand: 'vacant-land/index.html',
        terms: 'terms/index.html',
        privacy: 'privacy/index.html',
        contact: 'contact/index.html',
        streetcomplete: 'streetcomplete/index.html',
        survey: 'survey/index.html',
        landBank: 'land-bank/index.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
