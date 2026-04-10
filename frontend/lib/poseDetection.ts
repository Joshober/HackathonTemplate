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

/** Must match `dependencies["@mediapipe/tasks-vision"]` — `@latest` WASM often breaks detection silently. */
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL_LITE =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
/** Full model for single-frame capture: detects better with partial body / awkward poses. */
const MODEL_FULL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

/** VIDEO loop: balance speed vs recall. */
const MIN_CONFIDENCE_VIDEO = 0.2;
/** IMAGE capture: be permissive so reference poses register reliably. */
const MIN_CONFIDENCE_IMAGE = 0.15;

let poseLandmarker: PoseLandmarker | null = null;
let poseLandmarkerImage: PoseLandmarker | null = null;

export type PoseKeypoints = number[]; // flattened [x0,y0,z0, x1,y1,z1, ...] para 33 landmarks

/** Landmarker em modo VIDEO (loop do aluno). */
export async function initPoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarker) return poseLandmarker;
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const p = PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_LITE },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: MIN_CONFIDENCE_VIDEO,
    minPosePresenceConfidence: MIN_CONFIDENCE_VIDEO,
    minTrackingConfidence: MIN_CONFIDENCE_VIDEO,
  });
  poseLandmarker = await p;
  return poseLandmarker;
}

/** Landmarker em modo IMAGE (captura única do professor). Mais estável que VIDEO para um frame. */
async function initPoseLandmarkerImage(): Promise<PoseLandmarker> {
  if (poseLandmarkerImage) return poseLandmarkerImage;
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const p = PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_FULL },
    runningMode: 'IMAGE',
    numPoses: 1,
    minPoseDetectionConfidence: MIN_CONFIDENCE_IMAGE,
    minPosePresenceConfidence: MIN_CONFIDENCE_IMAGE,
    minTrackingConfidence: MIN_CONFIDENCE_IMAGE,
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
 * Usa o landmarker em modo IMAGE e a API síncrona `detect()`.
 */
export async function detectPoseFromImage(
  video: HTMLVideoElement
): Promise<PoseLandmarkerResult | null> {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;
  const detector = await initPoseLandmarkerImage();

  // IMAGE running mode uses `detect()`, not `detectForImage` (that method does not exist on PoseLandmarker).
  const tryDetect = (
    source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap
  ): PoseLandmarkerResult | null => {
    try {
      const result = detector.detect(source);
      if (result?.landmarks?.length && result.landmarks[0]?.length) return result;
      return null;
    } catch {
      return null;
    }
  };

  const tryImageBitmap = async (): Promise<PoseLandmarkerResult | null> => {
    try {
      const bitmap = await createImageBitmap(video);
      try {
        return tryDetect(bitmap);
      } finally {
        bitmap.close();
      }
    } catch {
      return null;
    }
  };

  // 1) Current video frame (some browsers handle this best when the element is playing)
  let result = tryDetect(video);
  if (result) return result;

  // 2) ImageBitmap — often more reliable than drawing a not-yet-ready video frame
  result = await tryImageBitmap();
  if (result) return result;

  // 3) Canvas snapshot (avoids some video-element quirks)
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, 0, 0);
    result = tryDetect(canvas);
    if (result) return result;
  }

  // 4) Retries: wait for decoder / lighting / movement to settle
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 120));
    if (video.readyState < 2) break;
    result = await tryImageBitmap();
    if (result) return result;
    ctx?.drawImage(video, 0, 0);
    result = tryDetect(canvas);
    if (result) return result;
    result = tryDetect(video);
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
