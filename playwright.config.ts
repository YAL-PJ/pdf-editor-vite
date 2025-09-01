import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  /* Don’t inherit any Vitest TS globals; keep it minimal */
  reporter: 'list',
  use: {
    headless: true,
    trace: 'on-first-retry',
    baseURL: 'http://localhost:5173',
  },
});
