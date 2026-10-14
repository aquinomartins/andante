import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('estabilidade por cinco minutos com modelo real e captura sintética', async ({ page, context }) => {
  test.skip(process.env.RUN_STABILITY !== '1', 'Execute npm run test:stability para a observação de cinco minutos.');
  test.setTimeout(370000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const state = { stream: null as MediaStream | null, calls: 0 };
    (window as any).synthetic = state;
    navigator.mediaDevices.getUserMedia = async () => {
      state.calls++;
      const img = new Image(); img.src = '/tests/fixtures/pointing_up.jpg'; await img.decode();
      const c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const ctx = c.getContext('2d')!; const stream = c.captureStream(24); state.stream = stream;
      const draw = () => {
        if (stream.getTracks()[0].readyState === 'ended') return;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 640, 480);
        const time = performance.now() / 1000;
        if (time % 30 < 27) ctx.drawImage(img, 190 + Math.sin(time / 4) * 175, 75, 250, 300);
        requestAnimationFrame(draw);
      }; draw(); return stream;
    };
  });
  await page.goto('/?test'); await page.getByRole('button', { name: 'Iniciar câmera' }).click();
  await expect(page.locator('#mode')).toContainText('WORKER', { timeout: 25000 });
  await expect.poll(() => page.evaluate(() => (window as any).andanteTest.snapshot().handPresent)).toBe(true);
  const cdp = await context.newCDPSession(page);
  const measurements: any[] = [];
  const started = Date.now();
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(10000);
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage'); const dom = await cdp.send('Memory.getDOMCounters');
    const sample = await page.evaluate(() => (window as any).andanteTest.snapshot());
    measurements.push({ seconds: (Date.now() - started) / 1000, ...sample, heapBytes: heap.usedSize, dom, workers: page.workers().length });
    expect(page.workers()).toHaveLength(1); expect(sample.mode).toBe('camera'); expect(sample.animation).toBe(true);
    if (i === 8) await page.setViewportSize({ width: 390, height: 844 });
    if (i === 16) await page.setViewportSize({ width: 844, height: 390 });
    if (i === 22) await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.getByRole('button', { name: 'Parar câmera' }).click();
  await expect.poll(() => page.workers().length).toBe(0);
  const final = await page.evaluate(() => ({ ...((window as any).andanteTest.snapshot()), track: (window as any).synthetic.stream.getTracks()[0].readyState }));
  expect(final.track).toBe('ended'); expect(final.animation).toBe(false); expect(errors).toEqual([]);
  await cdp.send('HeapProfiler.collectGarbage');
  const stable = measurements.slice(3);
  const growth = stable.at(-1).heapBytes - stable[0].heapBytes;
  expect(growth).toBeLessThan(2_000_000);
  writeFileSync('test-results/stability.json', JSON.stringify({ browser: await page.context().browser()?.version(), syntheticCamera: true, durationSeconds: (Date.now() - started) / 1000, measurements, mainHeapGrowthAfterWarmupBytes: growth, final, errors, scope: 'Heap JS da página após GC; não mede toda memória WASM/Worker ou câmera física.' }, null, 2));
});
