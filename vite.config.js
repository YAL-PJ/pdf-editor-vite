import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

const DEBUG_DIR = path.resolve(process.cwd(), '.debug');
const DEBUG_LOG_PATH = path.join(DEBUG_DIR, 'select-log.ndjson');

function createSelectLogPlugin() {
  return {
    name: 'select-log-writer',
    apply: 'serve',
    configureServer(server) {
      try {
        fs.mkdirSync(DEBUG_DIR, { recursive: true });
      } catch (err) {
        console.warn('[select-log] failed to ensure debug directory', err);
      }

      server.middlewares.use('/__select-log', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        let raw = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
          raw += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(raw || '[]');
            const entries = Array.isArray(payload) ? payload : [payload];
            if (!entries.length) {
              res.statusCode = 204;
              res.end();
              return;
            }
            const lines = entries
              .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                if (!('ts' in entry)) entry.ts = Date.now();
                return JSON.stringify(entry);
              })
              .filter(Boolean)
              .join('\n') + '\n';
            fs.appendFile(DEBUG_LOG_PATH, lines, (err) => {
              if (err) {
                console.error('[select-log] failed to append log', err);
              }
            });
            res.statusCode = 204;
            res.end();
          } catch (err) {
            console.error('[select-log] invalid payload', err);
            res.statusCode = 400;
            res.end('invalid payload');
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [createSelectLogPlugin()],
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
