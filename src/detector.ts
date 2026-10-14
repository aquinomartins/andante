import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
export type TipResult = { index: number | null; thumb: number | null; cost: number };
export async function createDetector(base: string) {
  const files = await FilesetResolver.forVisionTasks(`${base}wasm`, typeof document === 'undefined');
  return HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: `${base}models/hand_landmarker.task`, delegate: 'CPU' },
    runningMode: 'VIDEO', numHands: 1,
    minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
}
export function tips(result: HandLandmarkerResult, cost: number): TipResult {
  const hand = result.landmarks[0];
  return { index: hand?.[8].x ?? null, thumb: hand?.[4].x ?? null, cost };
}
