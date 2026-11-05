import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5180,
    strictPort: true,
    // Reachable by LAN IP and by machine name (e.g. http://my-pc.local:5180).
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.WEAVE_API_URL ?? 'http://127.0.0.1:3100',
        configure: (proxy) => {
          // Without this the browser only sees a bare 500 while the API is still starting or has crashed.
          proxy.on('error', (_error, _req, res) => {
            if (!('writeHead' in res) || res.headersSent) return;
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ message: '后端服务没有响应，可能还在启动，请稍等几秒再试' }));
          });
        },
      },
    },
  },
  test: {
    include: ['test/**/*.spec.ts'],
  },
});
