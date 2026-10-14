import { test, expect } from '@playwright/test';
const snapshot = (page: any) => page.evaluate(() => (window as any).andanteTest.snapshot());
test('controle, parada, mudança de direção, reset e viewport móvel', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test');
  const canvas = page.locator('#scene'); const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.9, rect.y + rect.height * 0.6);
  await expect.poll(async () => (await snapshot(page)).x).toBeGreaterThan(820);
  await expect.poll(async () => Math.abs((await snapshot(page)).velocity), { timeout: 7000 }).toBeLessThan(1);
  await page.mouse.move(rect.x + rect.width * 0.1, rect.y + rect.height * 0.6);
  await expect.poll(async () => (await snapshot(page)).x, { timeout: 8000 }).toBeLessThan(160);
  await page.getByRole('button', { name: 'Reiniciar cena' }).click();
  expect((await snapshot(page)).x).toBe(500);
  await page.getByRole('button', { name: 'Diagnóstico' }).click(); await expect(page.locator('#metrics')).toContainText('FPS');
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'test-results/mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'Iniciar câmera' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('negação da câmera mantém controle alternativo e permite tentar novamente', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
  await page.goto('/?test');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Iniciar câmera' }).click();
    await expect(page.locator('#error')).toContainText('Permissão negada');
    expect((await snapshot(page)).camera).toBe(false); expect((await snapshot(page)).mode).toBe('pointer');
  }
});
test('zona morta no navegador e modo econômico', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => {
    const c = (window as any).andanteTest.control;
    for (let i = 0; i < 60; i++) { c.setTarget(0.5 + Math.sin(i) * 0.002, i * 17 + 1000); c.update(1 / 60, i * 17 + 1000); }
    if (c.x !== 500) throw new Error('Tremor não rejeitado');
  });
  await page.locator('#economy').check();
  await expect.poll(async () => (await snapshot(page)).quality).toContain('30 FPS');
});
