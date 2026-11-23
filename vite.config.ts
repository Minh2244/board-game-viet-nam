import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { handleRoomGet, handleRoomPost } from './api/_roomStore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Middleware cục bộ cho `vite dev` và `vite preview`:
 * Phục vụ chính xác endpoint `/api/room` dùng chung logic với Vercel Function (`api/room.ts`),
 * giúp test Online 2 tab / 2 điện thoại cùng mạng LAN mà không cần cài thêm server rời!
 */
function localRoomApiPlugin(): Plugin {
  const attachMiddleware = (
    middlewares: {
      use: (
        route: string,
        fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
      ) => void;
    },
  ) => {
    middlewares.use('/api/room', (req, res, next) => {
      const method = (req.method || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'POST') {
        next();
        return;
      }

      const sendJson = (status: number, body: Record<string, unknown>) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.end(JSON.stringify(body));
      };

      if (method === 'GET') {
        const fullUrl = new URL(req.url || '/', 'http://localhost');
        void handleRoomGet(fullUrl)
          .then((result) => sendJson(result.status, result.body))
          .catch((err) => {
            console.error('[local /api/room GET]', err);
            sendJson(500, { ok: false, error: 'SERVER_ERROR', message: 'Lỗi máy chủ cục bộ.' });
          });
        return;
      }

      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          void handleRoomPost(parsed)
            .then((result) => sendJson(result.status, result.body))
            .catch((err) => {
              console.error('[local /api/room POST]', err);
              sendJson(500, { ok: false, error: 'SERVER_ERROR', message: 'Lỗi máy chủ cục bộ.' });
            });
        } catch {
          sendJson(400, { ok: false, error: 'BAD_JSON', message: 'Dữ liệu JSON không hợp lệ.' });
        }
      });
    });
  };

  return {
    name: 'bgvn-local-room-api',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localRoomApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            return 'three-engine';
          }
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/lucide-react')
          ) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
});
