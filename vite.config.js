import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@app': '/src/app',
      '@pdf': '/src/pdf',
      '@ui' : '/src/ui',
    },
  },
});
