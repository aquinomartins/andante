import workerURL from './tracking.worker.ts?worker&url';
import { createDetector, tips, type TipResult } from './detector';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
export class Tracker {
  backend = 'CPU · Worker';
  private worker: Worker | null = null;
  private workerBlob: string | null = null;
  private detector: HandLandmarker | null = null;
  private closed = false;
  private pending: { resolve: (value: TipResult) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  private rejectInit: ((reason: Error) => void) | null = null;
  async init(onStage: (message: string) => void) {
    const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
    onStage('Carregando modelo local…');
    if (typeof Worker !== 'undefined' && typeof createImageBitmap !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
      try {
        await new Promise<void>((resolve, reject) => {
          // A blob Worker inherits the page CSP, including connect-src self.
          // This blocks third-party metrics from the library without modifying it.
          this.workerBlob = URL.createObjectURL(new Blob([`import ${JSON.stringify(new URL(workerURL, document.baseURI).href)};`], { type: 'text/javascript' }));
          const worker = new Worker(this.workerBlob, { type: 'module' });
          this.worker = worker;
          const timer = setTimeout(() => reject(new Error('Tempo de carregamento excedido')), 25000);
          this.initTimer = timer;
          this.rejectInit = reject;
          worker.onmessage = ({ data }) => {
            if (data.type === 'closed') { worker.terminate(); return; }
            if (this.closed) return;
            if (data.type === 'ready') { this.revokeWorkerBlob(); clearTimeout(timer); this.rejectInit = null; resolve(); }
            if (data.type === 'error') {
              clearTimeout(timer);
              const error = new Error(data.error);
              if (this.rejectInit) { this.rejectInit = null; reject(error); }
              else this.finish(undefined, error);
            }
            if (data.type === 'result') this.finish(data.result);
          };
          worker.onerror = () => { clearTimeout(timer); reject(new Error('Falha no Worker')); this.finish(undefined, new Error('Falha no Worker')); };
          worker.postMessage({ type: 'init', base });
        });
        if (this.closed) throw new Error('Sessão encerrada');
        return;
      } catch (e) {
        this.worker?.terminate(); this.worker = null; this.revokeWorkerBlob(); this.rejectInit = null;
        if (this.closed) throw e;
        onStage('Tentando modo de compatibilidade…');
      }
    }
    const next = await createDetector(base);
    if (this.closed) { next.close(); throw new Error('Sessão encerrada'); }
    this.detector = next;
    this.backend = 'CPU · compatibilidade';
  }
  infer(bitmap: ImageBitmap, timestamp: number): Promise<TipResult> {
    if (this.closed) { bitmap.close(); return Promise.reject(new Error('Sessão encerrada')); }
    if (this.worker) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => this.finish(undefined, new Error('A detecção demorou demais')), 6000);
        this.pending = { resolve, reject, timer };
        try { this.worker!.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]); }
        catch (e) { bitmap.close(); this.finish(undefined, new Error(String(e))); }
      });
    }
    try {
      const start = performance.now();
      return Promise.resolve(tips(this.detector!.detectForVideo(bitmap, timestamp), performance.now() - start));
    } catch (e) { return Promise.reject(e); }
    finally { bitmap.close(); }
  }
  inferVideo(video: HTMLVideoElement, timestamp: number): TipResult {
    const start = performance.now();
    return tips(this.detector!.detectForVideo(video, timestamp), performance.now() - start);
  }
  get needsBitmap() { return !!this.worker || typeof createImageBitmap !== 'undefined'; }
  private finish(result?: TipResult, error?: Error) {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    if (error) this.pending.reject(error); else this.pending.resolve(result!);
    this.pending = null;
  }
  private revokeWorkerBlob() {
    if (this.workerBlob) URL.revokeObjectURL(this.workerBlob);
    this.workerBlob = null;
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.revokeWorkerBlob();
    if (this.initTimer) clearTimeout(this.initTimer); this.initTimer = null;
    this.rejectInit?.(new Error('Sessão encerrada')); this.rejectInit = null;
    this.finish(undefined, new Error('Sessão encerrada'));
    if (this.worker) {
      const worker = this.worker;
      worker.postMessage({ type: 'close' });
      setTimeout(() => worker.terminate(), 500);
      this.worker = null;
    }
    this.detector?.close(); this.detector = null;
  }
}
