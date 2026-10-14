import { test, expect } from '@playwright/test';
async function syntheticCamera(page: any, mainThread = false) {
  await page.addInitScript(({ mainThread }: { mainThread: boolean }) => {
    if (mainThread) Object.defineProperty(window, 'Worker', { value: undefined });
    const state = { streams: [] as MediaStream[], x: 200, hand: true, callbacks: 0, calls: 0, handImage: null as HTMLImageElement | null };
    (window as any).fakeCamera = state;
    navigator.mediaDevices.enumerateDevices = async () => [
      { kind: 'videoinput', deviceId: 'front', label: 'Frente', groupId: 'fake' },
      { kind: 'videoinput', deviceId: 'rear', label: 'Traseira', groupId: 'fake' },
    ] as MediaDeviceInfo[];
    navigator.mediaDevices.getUserMedia = async (constraints: MediaStreamConstraints) => {
      if (constraints.audio !== false) throw new Error('Microfone não deve ser solicitado');
      state.calls++;
      const image = new Image(); image.src = '/tests/fixtures/pointing_up.jpg'; await image.decode(); state.handImage = image;
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      const stream = canvas.captureStream(24); state.streams.push(stream);
      const loop = () => {
        if (stream.getVideoTracks()[0].readyState === 'ended') return;
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, 640, 480);
        if (state.hand) ctx.drawImage(image, state.x, 75, 250, 300);
        state.callbacks++; requestAnimationFrame(loop);
      }; loop();
      return stream;
    };
  }, { mainThread });
}
const snapshot = (page: any) => page.evaluate(() => (window as any).andanteTest.snapshot());
test('modelo real em Worker: mão, perda/retorno, troca e início/parada repetidos', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await syntheticCamera(page); await page.goto('/?test');
  expect(await page.evaluate(() => (window as any).fakeCamera.calls)).toBe(0);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Iniciar câmera' }).click();
    await expect(page.locator('#mode')).toContainText('WORKER', { timeout: 25000 });
    await expect.poll(async () => (await snapshot(page)).handPresent).toBe(true);
    expect(page.workers()).toHaveLength(1);
    if (i === 0) {
      await page.evaluate(() => (window as any).fakeCamera.x = 15);
      await expect.poll(async () => (await snapshot(page)).x, { timeout: 10000 }).toBeGreaterThan(650);
      await page.evaluate(() => (window as any).fakeCamera.x = 360);
      await expect.poll(async () => (await snapshot(page)).x, { timeout: 10000 }).toBeLessThan(450);
      await page.evaluate(() => (window as any).fakeCamera.hand = false);
      await expect.poll(async () => (await snapshot(page)).handPresent).toBe(false);
      await expect.poll(async () => Math.abs((await snapshot(page)).velocity)).toBeLessThan(1);
      await page.locator('#finger').selectOption('thumb');
      await page.evaluate(() => (window as any).fakeCamera.hand = true);
      await expect.poll(async () => (await snapshot(page)).handPresent).toBe(true);
      await page.getByRole('button', { name: 'Ocultar prévia' }).click(); await expect(page.locator('#preview-wrap')).toBeHidden();
      await page.getByRole('button', { name: 'Mostrar prévia' }).click();
      await page.getByRole('button', { name: 'Trocar câmera' }).click();
      await expect(page.locator('#mode')).toContainText('WORKER', { timeout: 25000 });
      expect(await page.evaluate(() => (window as any).fakeCamera.streams.filter((s: MediaStream) => s.getTracks().some(t => t.readyState === 'live')).length)).toBe(1);
    }
    await page.getByRole('button', { name: 'Parar câmera' }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    expect(await page.evaluate(() => (window as any).fakeCamera.streams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === 'ended')))).toBe(true);
    expect((await snapshot(page)).animation).toBe(false);
  }
  expect(errors).toEqual([]);
});
test('fallback CPU na página usa o modelo real', async ({ page }) => {
  await syntheticCamera(page, true); await page.goto('/?test');
  await page.getByRole('button', { name: 'Iniciar câmera' }).click();
  await expect(page.locator('#mode')).toContainText('COMPATIBILIDADE', { timeout: 25000 });
  await expect.poll(async () => (await snapshot(page)).handPresent).toBe(true);
  expect(page.workers()).toHaveLength(0);
  await page.getByRole('button', { name: 'Parar câmera' }).click();
  expect((await snapshot(page)).camera).toBe(false);
});
test('falha de modelo libera câmera e deixa interface responsiva', async ({ page }) => {
  await syntheticCamera(page);
  await page.route('**/models/hand_landmarker.task', route => route.abort());
  await page.goto('/?test'); await page.getByRole('button', { name: 'Iniciar câmera' }).click();
  await expect(page.locator('#error')).toBeVisible({ timeout: 35000 });
  await expect.poll(() => page.workers().length).toBe(0);
  expect((await snapshot(page)).mode).toBe('pointer');
  expect(await page.evaluate(() => (window as any).fakeCamera.streams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === 'ended')))).toBe(true);
});
test('cancelar enquanto a permissão está pendente encerra a captura tardia', async ({ page }) => {
  await syntheticCamera(page);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => { await new Promise(r => setTimeout(r, 1200)); return original(constraints); };
  });
  await page.goto('/?test');
  await page.getByRole('button', { name: 'Iniciar câmera' }).click();
  await page.getByRole('button', { name: 'Parar câmera' }).click();
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => (window as any).fakeCamera.streams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === 'ended')))).toBe(true);
  expect(page.workers()).toHaveLength(0); expect((await snapshot(page)).animation).toBe(false);
});
test('fallback sem ImageBitmap e sem callback de quadro usa vídeo sem fila', async ({ page }) => {
  await syntheticCamera(page, true);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'createImageBitmap', { value: undefined });
    delete (HTMLVideoElement.prototype as any).requestVideoFrameCallback;
  });
  await page.goto('/?test'); await page.getByRole('button', { name: 'Iniciar câmera' }).click();
  await expect(page.locator('#mode')).toContainText('COMPATIBILIDADE', { timeout: 25000 });
  await expect.poll(async () => (await snapshot(page)).handPresent).toBe(true);
  await page.getByRole('button', { name: 'Parar câmera' }).click();
  expect((await snapshot(page)).animation).toBe(false);
});
test('interrupção da trilha retorna ao mouse; contexto inseguro explica HTTPS', async ({ page }) => {
  await syntheticCamera(page); await page.goto('/?test'); await page.getByRole('button', { name: 'Iniciar câmera' }).click();
  await expect(page.locator('#mode')).toContainText('WORKER', { timeout: 25000 });
  await page.evaluate(() => (window as any).fakeCamera.streams[0].getTracks()[0].dispatchEvent(new Event('ended')));
  await expect(page.locator('#error')).toContainText('interrompida');
  await expect.poll(() => page.workers().length).toBe(0);
  await page.evaluate(() => Object.defineProperty(window, 'isSecureContext', { value: false }));
  await page.getByRole('button', { name: 'Iniciar câmera' }).click();
  await expect(page.locator('#error')).toContainText('HTTPS');
});
test('cena pausada permanece desenhada após redimensionar', async ({ page }) => {
  await syntheticCamera(page); await page.goto('/?test'); await page.getByRole('button', { name: 'Iniciar câmera' }).click();
  await expect(page.locator('#mode')).toContainText('WORKER', { timeout: 25000 });
  await page.getByRole('button', { name: 'Parar câmera' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator('#scene').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(255);
  expect((await snapshot(page)).animation).toBe(false);
});
