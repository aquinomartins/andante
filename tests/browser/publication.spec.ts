import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
let server: ReturnType<typeof createServer>;
const root = path.resolve('dist');
const types: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.task': 'application/octet-stream' };
test.beforeAll(async () => {
 server = createServer(async (req, res) => {
  try {
   const url = new URL(req.url!, 'http://localhost');
   if (!url.pathname.startsWith('/andante/')) { res.writeHead(404).end(); return; }
   let name = decodeURIComponent(url.pathname.slice('/andante/'.length)) || 'index.html';
   const target = path.resolve(root, name);
   if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
   const body = await readFile(target);
   res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Content-Length': body.length });
   res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end(); }
 });
 await new Promise<void>(resolve => server.listen(5176, '127.0.0.1', resolve));
});
test.afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
test('build em hospedagem estática inicia e verificador confirma arquivos', async ({ page }) => {
 await page.goto('http://localhost:5176/andante/?test');
 await expect(page.locator('#camera')).toBeEnabled();
 await expect(page.locator('#boot-status')).toBeHidden();
 await page.locator('#diagnostic-toggle').click(); await expect(page.locator('#diagnostics')).toBeVisible();
 const box = (await page.locator('#scene').boundingBox())!;
 await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5);
 await expect.poll(() => page.evaluate(() => (window as any).andanteTest.snapshot().x)).toBeGreaterThan(650);
 await page.goto('http://localhost:5176/andante/verificar.html');
 await page.locator('#run').click();
 await expect(page.locator('#summary')).toContainText('Arquivos disponíveis e tipos corretos');
 expect(await page.locator('li.fail').count()).toBe(0);
});
test('JavaScript com MIME incorreto informa falha e não apresenta botões ativos', async ({ page }) => {
 await page.route('**/assets/index-*.js', route => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'export {};' }));
 await page.goto('http://localhost:5176/andante/');
 await expect(page.locator('#boot-message')).toContainText('não conseguiu iniciar', { timeout: 10000 });
 await expect(page.locator('#camera')).toBeDisabled();
 await expect(page.getByRole('link', { name: 'Verificar instalação' })).toBeVisible();
});
test('verificador distingue JS servido como HTML, modelo bloqueado e WASM incompleto', async ({ page }) => {
 await page.route('**/assets/index-*.js', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>404 da hospedagem</html>' }));
 await page.route('**/models/hand_landmarker.task', route => route.fulfill({ status: 403, body: 'Forbidden' }));
 await page.route('**/wasm/vision_wasm_module_internal.wasm', route => route.fulfill({ status: 200, contentType: 'application/wasm', headers: { 'Content-Length': '123' }, body: '' }));
 await page.goto('http://localhost:5176/andante/verificar.html'); await page.locator('#run').click();
 await expect(page.locator('#summary')).toContainText('problema(s)');
 await expect(page.locator('#results')).toContainText('tipo incorreto');
 await expect(page.locator('#results')).toContainText('HTTP 403');
 await expect(page.locator('#results')).toContainText('tamanho diferente');
});
test('verificador explica envio de fonte ou pacote incompleto sem manifesto', async ({ page }) => {
 await page.route('**/deployment.json', route => route.fulfill({ status: 404, body: 'Not found' }));
 await page.goto('http://localhost:5176/andante/verificar.html'); await page.locator('#run').click();
 await expect(page.locator('#results')).toContainText('Pacote de produção não encontrado');
 await expect(page.locator('#summary')).toContainText('Instalação incompleta');
});
test('publicar index do código-fonte sem build reproduz controles sem resposta', async ({ page }) => {
 const { execFileSync } = await import('node:child_process');
 const original = execFileSync('git', ['show', 'origin/main:index.html'], { encoding: 'utf8' });
 await page.route('**/andante/', route => route.fulfill({ status: 200, contentType: 'text/html', body: original }));
 await page.addInitScript(() => {
  (window as any).cameraRequests = 0;
  navigator.mediaDevices.getUserMedia = async () => { (window as any).cameraRequests++; throw new Error('Não deve ser chamado'); };
 });
 await page.goto('http://localhost:5176/andante/');
 await page.locator('#camera').click();
 expect(await page.evaluate(() => (window as any).cameraRequests)).toBe(0);
 expect(await page.locator('#scene').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(0);
});
