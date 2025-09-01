import { defineConfig, configDefaults } from 'vitest/config';
import viteBase from './vite.config.js';

export default defineConfig({
  resolve: {
    alias: (viteBase?.resolve?.alias ?? []),
  },
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, 'e2e/**', 'tests/e2e/**'],
    setupFiles: [],
  },
});
