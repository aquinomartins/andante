import { defineConfig } from 'vite';
export default defineConfig({ base: './', worker: { format: 'es' }, plugins: [{ name: 'dev-websocket', apply: 'serve', transformIndexHtml(html) { return html.replace("connect-src 'self';", "connect-src 'self' ws:;"); } }], build: { target: 'es2022' } });
