/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { contentPlugin } from './plugins/content.ts';
import { dataRootPlugin } from './plugins/data-root.ts';
import { registryPlugin } from './plugins/registry.ts';

export default defineConfig({
  // The site is published on GitHub Pages at https://<owner>.github.io/placekeepers/.
  base: '/placekeepers/',
  // The map, the data status page, every content page, and real 404s for missing files, as on
  // Pages. Each content page is its own entry below, following the pattern status/index.html set.
  appType: 'mpa',
  plugins: [registryPlugin(), contentPlugin(), dataRootPlugin(), svelte()],
  build: {
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
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
