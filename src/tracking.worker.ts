import { createDetector, tips } from './detector';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
let detector: HandLandmarker | null = null;
let closing = false;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const next = await createDetector(data.base);
      if (closing) { next.close(); return; }
      detector = next;
      self.postMessage({ type: 'ready' });
    } catch (e) { self.postMessage({ type: 'error', error: String(e) }); }
  } else if (data.type === 'frame') {
    const bitmap: ImageBitmap = data.bitmap;
    try {
      if (!detector) throw new Error('Detector indisponível');
      const start = performance.now();
      const result = detector.detectForVideo(bitmap, data.timestamp);
      self.postMessage({ type: 'result', result: tips(result, performance.now() - start) });
    } catch (e) { self.postMessage({ type: 'error', error: String(e) }); }
    finally { bitmap.close(); }
  } else if (data.type === 'close') {
    closing = true; detector?.close(); detector = null;
    self.postMessage({ type: 'closed' });
    self.close();
  }
};
