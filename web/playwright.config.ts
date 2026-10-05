// End to end tests of both views, at phone and desktop sizes, against the production build of the
// site (`npm run build:e2e`, the same build into dist-e2e/ without the local data copy) served by
// `vite preview`, reading the committed sample data in fixtures/data/. Chromium only, one test at a
// time, so they stay light on a busy laptop and in CI. Run with `npm run e2e`.

import { defineConfig } from '@playwright/test';

// The port the tests build and serve their own copy of the site on: 4317, or another one named
// with PK_E2E_PORT, so agents working side by side on one machine each test their own build:
//   PK_E2E_PORT=4329 npm run e2e
// If something already listens on that port the run stops at once with "is already used" (and
// vite's --strictPort refuses it too), rather than silently testing another worktree's build. To
// test a server you started yourself on purpose (for example `npm run preview:e2e`), add
// PK_E2E_REUSE=1.
const PORT = Number(process.env.PK_E2E_PORT ?? 4317);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/placekeepers/`,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // MapLibre needs WebGL; without a graphics card Chromium draws it in software.
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    {
      name: 'phone',
      use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
    },
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: `npm run build:e2e && PK_E2E=1 npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/placekeepers/`,
    reuseExistingServer: process.env.PK_E2E_REUSE === '1',
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
