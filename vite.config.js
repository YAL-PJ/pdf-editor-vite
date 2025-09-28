import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@app': '/src/app',
      '@pdf': '/src/pdf',
      '@ui': '/src/ui',
      '@config': '/src/config',
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pdfjs-dist/')) return 'vendor-pdfjs';
          if (id.includes('node_modules/pdf-lib/')) return 'vendor-pdf-lib';
          if (id.includes('node_modules/')) return 'vendor';
        },
      },
    },
  },
});
