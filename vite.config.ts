import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleRealtimeTokenGet } from './api/_realtimeAuth';
import { handleRoomGet, handleRoomPost } from './api/_roomStore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Middleware cục bộ cho `vite dev` và `vite preview`:
 * Phục vụ chính xác cả `/api/room` và `/api/realtime-token` dùng chung logic với Vercel Edge Functions,
 * giúp test Online 2 tab / 2 điện thoại cùng mạng LAN (hoặc Ably thật qua `.env.local`) mà không cần cài server rời!
 */
function localRoomApiPlugin(localEnv: Record<string, string>): Plugin {
  const sendJson = (res: ServerResponse, status: number, body: Record<string, unknown>) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.end(JSON.stringify(body));
  };

  const attachMiddleware = (
    middlewares: {
      use: (
        route: string,
        fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
      ) => void;
    },
  ) => {
    middlewares.use('/api/realtime-token', (req, res, next) => {
      const method = (req.method || 'GET').toUpperCase();
      if (method !== 'GET') {
        next();
        return;
      }
      const fullUrl = new URL(req.url || '/', 'http://localhost');
      const key = process.env.ABLY_API_KEY || localEnv.ABLY_API_KEY || '';
      void handleRealtimeTokenGet(fullUrl, key)
        .then((result) => sendJson(res, result.status, result.body))
        .catch((err) => {
          console.error('[local /api/realtime-token GET]', err);
          sendJson(res, 200, { ok: true, enabled: false, reason: 'SERVER_ERROR' });
        });
    });

    middlewares.use('/api/room', (req, res, next) => {
      const method = (req.method || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'POST') {
        next();
        return;
      }

      if (method === 'GET') {
        const fullUrl = new URL(req.url || '/', 'http://localhost');
        void handleRoomGet(fullUrl)
          .then((result) => sendJson(res, result.status, result.body))
          .catch((err) => {
            console.error('[local /api/room GET]', err);
            sendJson(res, 500, { ok: false, error: 'SERVER_ERROR', message: 'Lỗi máy chủ cục bộ.' });
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
            .then((result) => sendJson(res, result.status, result.body))
            .catch((err) => {
              console.error('[local /api/room POST]', err);
              sendJson(res, 500, { ok: false, error: 'SERVER_ERROR', message: 'Lỗi máy chủ cục bộ.' });
            });
        } catch {
          sendJson(res, 400, { ok: false, error: 'BAD_JSON', message: 'Dữ liệu JSON không hợp lệ.' });
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

export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), localRoomApiPlugin(localEnv)],
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
            if (id.includes('node_modules/ably')) {
              return 'ably-realtime';
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
  };
});
