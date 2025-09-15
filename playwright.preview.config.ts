import { defineConfig } from '@playwright/test';

// Runs e2e tests against a production preview (vite preview) on port 5173.
export default defineConfig({
  testDir: 'tests/e2e',
  reporter: 'list',
  use: {
    headless: true,
    trace: 'on-first-retry',
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run preview -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

