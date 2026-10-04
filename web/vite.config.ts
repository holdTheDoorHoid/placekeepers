/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { dataRootPlugin } from './plugins/data-root.ts';
import { registryPlugin } from './plugins/registry.ts';

export default defineConfig({
  // The site is published on GitHub Pages at https://<owner>.github.io/placekeepers/.
  base: '/placekeepers/',
  plugins: [registryPlugin(), dataRootPlugin(), svelte()],
  build: {
    target: 'es2022',
    // MapLibre alone is about 1 MB (280 kB compressed). It loads after the page appears.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      input: {
        main: 'index.html',
        status: 'status/index.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
