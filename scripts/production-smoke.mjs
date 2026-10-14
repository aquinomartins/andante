import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.json': 'application/json', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
 try {
  let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (!name.startsWith('/caminhante/')) { res.writeHead(404).end(); return; }
  name = name.slice('/caminhante/'.length); if (!name) name = 'index.html';
  const target = path.resolve(root, name); if (!target.startsWith(root)) { res.writeHead(403).end(); return; }
  const body = await readFile(target); res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' }).end(body);
 } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(5175, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
 const errors = []; page.on('pageerror', e => errors.push(e.message));
 const failed = []; page.on('requestfailed', r => failed.push({ url: r.url(), failure: r.failure()?.errorText }));
 const requests = []; page.on('request', r => requests.push(r.url()));
 const image = await readFile('tests/fixtures/pointing_up.jpg');
 await page.route('**/fixture.jpg', route => route.fulfill({ body: image, contentType: 'image/jpeg' }));
 await page.addInitScript(() => {
  const state = { stream: null, calls: 0 }; window.fakeCamera = state;
  navigator.mediaDevices.getUserMedia = async () => {
   state.calls++;
   const img = new Image(); img.src = '/fixture.jpg'; await img.decode();
   const c = document.createElement('canvas'); c.width = 640; c.height = 480; const ctx = c.getContext('2d');
   const stream = c.captureStream(24); state.stream = stream;
   const draw = () => { if (stream.getTracks()[0].readyState === 'ended') return; ctx.fillStyle='#fff'; ctx.fillRect(0,0,640,480); ctx.drawImage(img,100,75,250,300); requestAnimationFrame(draw); }; draw(); return stream;
  };
 });
 await page.goto('http://localhost:5175/caminhante/?test');
 await mkdir('test-results/production', { recursive: true });
 await page.screenshot({ path: 'test-results/production/andante-desktop.png', fullPage: true });
 await page.locator('#camera').click();
 await page.waitForFunction(() => window.andanteTest.snapshot().handPresent, null, { timeout: 25000 });
 assert.match(await page.locator('#mode').textContent(), /WORKER/);
 assert.equal(page.workers().length, 1);
 await page.locator('#camera').click();
 await page.waitForFunction(() => window.fakeCamera.stream.getTracks()[0].readyState === 'ended');
 await page.waitForTimeout(700); assert.equal(page.workers().length, 0);
 assert.equal(await page.evaluate(() => window.andanteTest.snapshot().animation), false);
 const remote = requests.filter(url => !url.startsWith('http://localhost:5175/'));
 assert.ok(remote.every(url => failed.some(f => f.url === url && /CSP|BLOCKED/i.test(f.failure || ''))), 'Conexão externa não foi bloqueada pela CSP'); assert.deepEqual(errors, []);
 await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'test-results/production/andante-mobile.png', fullPage: true });
 await writeFile('test-results/production/production-smoke.json', JSON.stringify({ subpath: '/caminhante/', worker: 'CPU', simulatedCamera: true, externalAttemptsBlocked: failed.filter(r => remote.includes(r.url)), errors, requests }, null, 2));
 console.log('Build em subpasta: detector real em Worker, trilha encerrada, Worker encerrado, zero conexões externas permitidas, zero erros JS.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
