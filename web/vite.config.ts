/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { registryPlugin } from './plugins/registry.ts';

export default defineConfig({
  base: '/placekeepers/',
  plugins: [registryPlugin(), svelte()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
