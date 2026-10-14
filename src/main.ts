import './style.css';
import { WalkerControl } from './control';
import { Scene } from './scene';
import { CameraSession } from './camera';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('scene');
const video = element<HTMLVideoElement>('video');
const cameraButton = element<HTMLButtonElement>('camera');
const pointerButton = element<HTMLButtonElement>('pointer');
const switchButton = element<HTMLButtonElement>('switch');
const previewButton = element<HTMLButtonElement>('preview');
const previewWrap = element('preview-wrap');
const finger = element<HTMLSelectElement>('finger');
const economy = element<HTMLInputElement>('economy');
const control = new WalkerControl();
const scene = new Scene(canvas, control);
let mode: 'pointer' | 'camera' | 'paused' = 'pointer';
let session: CameraSession | null = null;
let serial = 0;
let facing: 'user' | 'environment' = 'user';
let selectedDevice: string | null = null;
let devices: MediaDeviceInfo[] = [];
let mirrored = true;
let frame = 0;
let lastUpdate = 0;
let lastDraw = 0;
let drawCount = 0;
let inferCount = 0;
let drawCost = 0;
let inferCost = 0;
let quality = 'Normal';
let autoEconomy = false;
let qualityWindow = 0;
let slowWindows = 0;
let fastWindows = 0;
let lastMetrics = performance.now();
let fps = 0;
let inferenceHz = 0;
let handPresent = false;
let lastHandHint = false;
const setStatus = (message: string) => { element('status').textContent = message; };
function animate(now: number) {
  frame = 0;
  if (document.hidden || mode === 'paused') return;
  const dt = lastUpdate ? Math.min((now - lastUpdate) / 1000, 0.05) : 0;
  lastUpdate = now;
  control.update(dt, now, mode === 'pointer');
  const economical = economy.checked || autoEconomy;
  quality = economical ? 'Econômico · 30 FPS' : 'Normal · até 60 FPS';
  if (now - lastDraw >= 1000 / (economical ? 30 : 60) - 1) {
    const start = performance.now();
    scene.draw(now, (now - lastDraw) / 1000 > 0.1 ? dt : (now - lastDraw) / 1000, economical);
    drawCost += performance.now() - start;
    drawCount++; lastDraw = now;
  }
  if (now - lastMetrics >= 1000) updateMetrics(now);
  frame = requestAnimationFrame(animate);
}
function resumeAnimation() { if (!frame && mode !== 'paused' && !document.hidden) { lastUpdate = lastDraw = 0; frame = requestAnimationFrame(animate); } }
function stopAnimation() { cancelAnimationFrame(frame); frame = 0; lastUpdate = 0; }
function updateMetrics(now: number) {
  const elapsed = (now - lastMetrics) / 1000;
  fps = drawCount / elapsed; inferenceHz = inferCount / elapsed;
  const cost = drawCost / Math.max(1, drawCount);
  if (now - qualityWindow > 5000) {
    if (cost > 12) { slowWindows++; fastWindows = 0; } else if (cost < 6) { fastWindows++; slowWindows = 0; }
    if (slowWindows >= 2) autoEconomy = true;
    if (fastWindows >= 3) autoEconomy = false;
    qualityWindow = now;
  }
  element('metrics').textContent = `Desenho     ${fps.toFixed(1)} FPS\nCusto       ${cost.toFixed(2)} ms/quadro\nDetecção    ${inferenceHz.toFixed(1)} Hz\nInferência  ${inferCost.toFixed(1)} ms\nQualidade   ${quality}\nEntrada     ${session?.inputWidth ?? '—'} px\nMotor       ${session?.backend || 'sem detector'}`;
  if (mode === 'camera' && session?.backend) {
    const lost = now - control.lastSeen > 250;
    if (lost !== lastHandHint) {
      setStatus(lost ? 'Mostre a mão inteira para retomar a caminhada.' : 'Mão encontrada. Seu movimento guia a figura.');
      lastHandHint = lost;
    }
    handPresent = !lost;
  }
  drawCount = inferCount = drawCost = 0; lastMetrics = now;
}
function stopCamera() {
  serial++;
  session?.stop(); session = null;
  previewWrap.hidden = true;
  switchButton.disabled = previewButton.disabled = true;
  cameraButton.querySelector('span')!.textContent = 'Iniciar câmera';
  element('status-dot').classList.remove('camera-on');
  control.lastSeen = -Infinity; handPresent = false;
}
function errorMessage(e: unknown) {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError') return 'Permissão negada. Autorize a câmera nas configurações do navegador e tente novamente.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Câmera não encontrada. Conecte uma câmera ou use mouse/toque.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Não foi possível abrir a câmera. Feche outros aplicativos que a utilizam e tente novamente.';
  if (e instanceof Error && /HTTPS|navegador|interrompida/.test(e.message)) return e.message;
  return 'Não foi possível carregar ou executar o rastreamento local. Tente novamente; mouse/toque continua disponível.';
}
function usePointer(message = 'Mova o mouse ou toque na cena para caminhar.') {
  stopCamera(); mode = 'pointer';
  control.target = control.x;
  element('mode').textContent = 'MOUSE / TOQUE';
  pointerButton.setAttribute('aria-pressed', 'true');
  element('instruction').textContent = 'Mova o mouse ou toque na cena para experimentar.';
  setStatus(message); resumeAnimation();
}
async function startCamera() {
  stopCamera();
  const token = serial;
  mode = 'camera'; pointerButton.setAttribute('aria-pressed', 'false');
  cameraButton.querySelector('span')!.textContent = 'Parar câmera';
  element('mode').textContent = 'CÂMERA · CARREGANDO';
  element('error').hidden = true;
  element('instruction').textContent = 'Mostre a mão inteira e mova o dedo para guiar o personagem.';
  control.lastSeen = -Infinity; lastHandHint = false;
  const next = new CameraSession(video, result => {
    if (token !== serial) return;
    inferCount++; inferCost = result.cost;
    const tip = finger.value === 'thumb' ? result.thumb : result.index;
    if (tip !== null) control.setTarget(mirrored ? 1 - tip : tip, performance.now());
  }, error => {
    if (token !== serial) return;
    const message = errorMessage(error);
    usePointer('Rastreamento indisponível. Controle por mouse/toque ativo.');
    element('error').textContent = message; element('error').hidden = false;
  });
  session = next; resumeAnimation();
  try {
    await next.start(facing, selectedDevice, message => { if (token === serial) setStatus(message); });
    if (token !== serial) return;
    devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    if (token !== serial) return;
    selectedDevice = next.deviceId;
    // Video is processed uncropped. Only the selfie preview is mirrored, once.
    const settings = (video.srcObject as MediaStream).getVideoTracks()[0].getSettings();
    mirrored = settings.facingMode ? settings.facingMode !== 'environment' : facing === 'user';
    previewWrap.classList.toggle('rear', !mirrored);
    previewWrap.hidden = previewButton.getAttribute('aria-pressed') !== 'true';
    previewButton.disabled = false; switchButton.disabled = devices.length < 2;
    element('mode').textContent = 'CÂMERA · ' + next.backend.toUpperCase();
    element('status-dot').classList.add('camera-on');
    setStatus('Mostre a mão inteira e mova o dedo para guiar o personagem.');
  } catch (e) {
    if (token !== serial) return;
    const message = errorMessage(e);
    usePointer('Mouse/toque ativo. Você pode tentar a câmera novamente.');
    element('error').textContent = message; element('error').hidden = false;
  }
}
cameraButton.addEventListener('click', () => {
  if (session) {
    stopCamera(); mode = 'paused'; stopAnimation(); control.velocity = 0;
    element('mode').textContent = 'PAUSADO'; setStatus('Câmera encerrada. Inicie novamente ou escolha mouse/toque.');
    scene.draw(performance.now(), 0, economy.checked);
  } else void startCamera();
});
pointerButton.addEventListener('click', () => { element('error').hidden = true; usePointer(); });
switchButton.addEventListener('click', () => {
  const index = devices.findIndex(d => d.deviceId === selectedDevice);
  selectedDevice = devices[(index + 1) % devices.length]?.deviceId ?? null;
  facing = facing === 'user' ? 'environment' : 'user';
  void startCamera();
});
previewButton.addEventListener('click', () => {
  const visible = previewButton.getAttribute('aria-pressed') !== 'true';
  previewButton.setAttribute('aria-pressed', String(visible));
  previewButton.textContent = visible ? 'Ocultar prévia' : 'Mostrar prévia';
  previewWrap.hidden = !visible;
});
canvas.addEventListener('pointermove', event => {
  if (mode !== 'pointer') return;
  if (event.pointerType === 'touch' && event.buttons === 0) return;
  const rect = canvas.getBoundingClientRect();
  control.setTarget(((event.clientX - rect.left) / rect.width * 1000 - control.left) / (control.right - control.left), performance.now(), false);
});
canvas.addEventListener('pointerdown', event => {
  if (mode !== 'pointer') return;
  canvas.setPointerCapture(event.pointerId);
  const rect = canvas.getBoundingClientRect();
  control.setTarget(((event.clientX - rect.left) / rect.width * 1000 - control.left) / (control.right - control.left), performance.now(), false);
});
element('reset').addEventListener('click', () => { control.reset(); scene.reset(); scene.draw(performance.now(), 0, economy.checked); });
element('diagnostic-toggle').addEventListener('click', () => {
  const visible = element('diagnostics').hidden;
  element('diagnostics').hidden = !visible;
  element('diagnostic-toggle').setAttribute('aria-expanded', String(visible));
  if (mode === 'paused') element('metrics').textContent = 'Experiência pausada. Loops e câmera encerrados.';
});
const fullscreen = element<HTMLButtonElement>('fullscreen');
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { setStatus('Tela cheia indisponível neste navegador.'); }
});
document.addEventListener('visibilitychange', () => {
  stopAnimation(); session?.visibilityChanged();
  control.lastSeen = -Infinity;
  if (!document.hidden) { lastMetrics = performance.now(); drawCount = inferCount = drawCost = 0; resumeAnimation(); }
});
window.addEventListener('pagehide', () => { stopCamera(); mode = 'paused'; stopAnimation(); scene.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
if (new URLSearchParams(location.search).has('test')) {
  Object.assign(window, { andanteTest: { control, snapshot: () => ({ x: control.x, velocity: control.velocity, target: control.target, mode, camera: !!session, animation: !!frame, handPresent, fps, inferenceHz, inferCost, quality }) } });
}
resumeAnimation();
