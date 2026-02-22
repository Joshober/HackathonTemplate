/**
 * Pose Detection com MediaPipe Pose Landmarker
 * Usado para Presença por Pose Cringe™
 */

import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/** Lower thresholds so poses are detected more reliably (body partially visible / varying lighting). */
const MIN_CONFIDENCE = 0.25;

let poseLandmarker: PoseLandmarker | null = null;
let poseLandmarkerImage: PoseLandmarker | null = null;

export type PoseKeypoints = number[]; // flattened [x0,y0,z0, x1,y1,z1, ...] para 33 landmarks

/** Landmarker em modo VIDEO (loop do aluno). */
export async function initPoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarker) return poseLandmarker;
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const p = PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: MIN_CONFIDENCE,
    minPosePresenceConfidence: MIN_CONFIDENCE,
    minTrackingConfidence: MIN_CONFIDENCE,
  });
  poseLandmarker = await p;
  return poseLandmarker;
}

/** Landmarker em modo IMAGE (captura única do professor). Mais estável que VIDEO para um frame. */
async function initPoseLandmarkerImage(): Promise<PoseLandmarker> {
  if (poseLandmarkerImage) return poseLandmarkerImage;
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const p = PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH },
    runningMode: 'IMAGE',
    numPoses: 1,
    minPoseDetectionConfidence: MIN_CONFIDENCE,
    minPosePresenceConfidence: MIN_CONFIDENCE,
    minTrackingConfidence: MIN_CONFIDENCE,
  });
  poseLandmarkerImage = await p;
  return poseLandmarkerImage;
}

/**
 * Extrai keypoints normalizados de um resultado do PoseLandmarker.
 * Retorna array flat [x0,y0,z0, x1,y1,z1, ...] para uso na comparação.
 */
export function extractKeypoints(result: PoseLandmarkerResult): PoseKeypoints | null {
  if (!result.landmarks?.length) return null;
  const landmarks = result.landmarks[0] as NormalizedLandmark[];
  if (!landmarks?.length) return null;
  const flat: number[] = [];
  for (const lm of landmarks) {
    flat.push(lm.x, lm.y, lm.z ?? 0);
  }
  return flat;
}

/**
 * Detecta pose em um único frame (uso: professor capturando referência).
 * Tenta primeiro o vídeo direto (ImageSource), depois canvas. Faz até 3 tentativas com pequeno delay.
 */
export async function detectPoseFromImage(
  video: HTMLVideoElement
): Promise<PoseLandmarkerResult | null> {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;
  const detector = await initPoseLandmarkerImage();

  const tryDetect = (source: HTMLVideoElement | HTMLCanvasElement): PoseLandmarkerResult | null => {
    try {
      const result = detector.detectForImage(source);
      if (result?.landmarks?.length && result.landmarks[0]?.length) return result;
      return null;
    } catch {
      return null;
    }
  };

  // 1) Try current video frame directly (MediaPipe accepts HTMLVideoElement as ImageSource)
  let result = tryDetect(video);
  if (result) return result;

  // 2) Try canvas snapshot (avoids any video-element quirks)
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, 0, 0);
    result = tryDetect(canvas);
    if (result) return result;
  }

  // 3) Retry with short delays (in case the first frame was blank or not yet decoded)
  for (let i = 0; i < 2; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (video.readyState < 2) break;
    ctx?.drawImage(video, 0, 0);
    result = tryDetect(canvas);
    if (result) return result;
  }

  return null;
}

/**
 * Detecta pose em um frame de vídeo (uso: loop do aluno).
 * Exige timestamp em ms, monotónico; use video.currentTime * 1000.
 */
/**
 * Detecta pose em um frame de vídeo (uso: loop do aluno).
 */
export async function detectPose(
  video: HTMLVideoElement,
  timestamp: number
): Promise<PoseLandmarkerResult | null> {
  const detector = await initPoseLandmarker();
  try {
    return detector.detectForVideo(video, timestamp);
  } catch {
    return null;
  }
}
