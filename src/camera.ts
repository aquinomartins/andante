import { Tracker } from './tracker';
import type { TipResult } from './detector';
export class CameraSession {
  private stream: MediaStream | null = null;
  private tracker = new Tracker();
  private stopped = false;
  private active = false;
  private busy = false;
  private callback = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private previousFrame = -1;
  private timestamp = 0;
  private lastCapture = -Infinity;
  private errors = 0;
  private observation: number[] = [];
  private windowStart = 0;
  rate = 20;
  inputWidth = 480;
  averageCost = 0;
  backend = '';
  constructor(private video: HTMLVideoElement, private onResult: (result: TipResult) => void, private onError: (error: unknown) => void) {}
  async start(facing: 'user' | 'environment', deviceId: string | null, onStage: (message: string) => void) {
    if (!isSecureContext) throw new Error('Use HTTPS para acessar a câmera. Em desenvolvimento, use localhost.');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não oferece acesso à câmera. Use mouse ou toque.');
    onStage('Aguardando permissão da câmera…');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facing } }),
    } });
    if (this.stopped) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream;
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (!this.stopped) this.onError(new Error('A câmera foi interrompida. Tente iniciar novamente.')); });
    this.video.srcObject = stream;
    await this.video.play();
    if (this.stopped) return;
    await this.tracker.init(onStage);
    if (this.stopped) return;
    this.backend = this.tracker.backend;
    if (this.backend.includes('compatibilidade')) this.rate = 10;
    this.active = true;
    this.windowStart = performance.now();
    this.schedule();
  }
  get deviceId() { return this.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? null; }
  private schedule() {
    if (this.stopped || !this.active || document.hidden) return;
    if ('requestVideoFrameCallback' in this.video) {
      this.callback = this.video.requestVideoFrameCallback((now) => { this.callback = 0; void this.capture(now); this.schedule(); });
    } else {
      this.timer = setTimeout(() => { this.timer = null; void this.capture(performance.now()); this.schedule(); }, 20);
    }
  }
  private async capture(now: number) {
    if (this.busy || this.stopped || this.video.readyState < 2 || now - this.lastCapture < 1000 / this.rate || this.previousFrame === this.video.currentTime) return;
    this.busy = true;
    this.previousFrame = this.video.currentTime;
    this.lastCapture = now;
    this.timestamp = Math.max(this.timestamp + 0.01, now);
    try {
      let result: TipResult;
      if (this.tracker.needsBitmap) {
        const bitmap = await createImageBitmap(this.video, { resizeWidth: this.inputWidth, resizeHeight: Math.max(1, Math.round(this.inputWidth * this.video.videoHeight / this.video.videoWidth)), resizeQuality: 'low' });
        if (this.stopped || document.hidden) { bitmap.close(); return; }
        result = await this.tracker.infer(bitmap, this.timestamp);
      } else result = this.tracker.inferVideo(this.video, this.timestamp);
      if (this.stopped || document.hidden) return;
      this.errors = 0;
      this.onResult(result);
      this.observation.push(result.cost);
      if (now - this.windowStart > 5000) {
        this.averageCost = this.observation.reduce((a, b) => a + b, 0) / this.observation.length;
        const main = this.backend.includes('compatibilidade');
        this.rate = main ? Math.min(10, Math.max(5, Math.floor(500 / Math.max(this.averageCost, 1)))) : Math.min(24, Math.max(8, Math.floor(700 / Math.max(this.averageCost, 1))));
        // Preserve 480 px to avoid sacrificing landmark quality without a real-device quality measurement.
        this.observation.length = 0; this.windowStart = now;
      }
    } catch (e) { if (!this.stopped && ++this.errors >= 3) this.onError(e); }
    finally { this.busy = false; }
  }
  visibilityChanged() {
    this.cancelCallbacks();
    if (!document.hidden) { this.previousFrame = -1; this.schedule(); }
  }
  private cancelCallbacks() {
    if (this.callback) this.video.cancelVideoFrameCallback(this.callback);
    this.callback = 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.active = false;
    this.cancelCallbacks();
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    this.video.pause(); this.video.srcObject = null;
    this.tracker.close();
  }
}
