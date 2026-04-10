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

const MEDIAPIPE_VERSION = '0.10.32';
const WASM_PATH = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

const MODEL_LITE =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const MODEL_FULL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

/** VIDEO loop: balance speed vs recall. */
const MIN_CONFIDENCE_VIDEO = 0.2;
/** IMAGE capture: permissive so reference poses register reliably. */
const MIN_CONFIDENCE_IMAGE = 0.15;

let poseLandmarkerVideo: PoseLandmarker | null = null;
let poseLandmarkerImageLite: PoseLandmarker | null = null;
let poseLandmarkerImageFull: PoseLandmarker | null = null;

export type PoseKeypoints = number[]; // flattened [x0,y0,z0, x1,y1,z1, ...] para 33 landmarks

function landmarkerOptions(
  modelAssetPath: string,
  runningMode: 'VIDEO' | 'IMAGE',
  minConfidence: number
) {
  return {
    baseOptions: { modelAssetPath },
    runningMode,
    numPoses: 1,
    minPoseDetectionConfidence: minConfidence,
    minPosePresenceConfidence: minConfidence,
    minTrackingConfidence: minConfidence,
  } as const;
}

/** Landmarker em modo VIDEO (loop do aluno). */
export async function initPoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarkerVideo) return poseLandmarkerVideo;
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const p = PoseLandmarker.createFromOptions(
    vision,
    landmarkerOptions(MODEL_LITE, 'VIDEO', MIN_CONFIDENCE_VIDEO)
  );
  poseLandmarkerVideo = await p;
  return poseLandmarkerVideo;
}

async function initPoseLandmarkerImageLite(): Promise<PoseLandmarker> {
  if (poseLandmarkerImageLite) return poseLandmarkerImageLite;
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const p = PoseLandmarker.createFromOptions(
    vision,
    landmarkerOptions(MODEL_LITE, 'IMAGE', MIN_CONFIDENCE_IMAGE)
  );
  poseLandmarkerImageLite = await p;
  return poseLandmarkerImageLite;
}

async function initPoseLandmarkerImageFull(): Promise<PoseLandmarker> {
  if (poseLandmarkerImageFull) return poseLandmarkerImageFull;
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const p = PoseLandmarker.createFromOptions(
    vision,
    landmarkerOptions(MODEL_FULL, 'IMAGE', MIN_CONFIDENCE_IMAGE)
  );
  poseLandmarkerImageFull = await p;
  return poseLandmarkerImageFull;
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

/** IMAGE running mode uses synchronous `detect()`. */
function detectOnce(
  detector: PoseLandmarker,
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap
): PoseLandmarkerResult | null {
  try {
    const result = detector.detect(source);
    if (result?.landmarks?.length && result.landmarks[0]?.length) return result;
    return null;
  } catch {
    return null;
  }
}

async function tryImageBitmap(
  detector: PoseLandmarker,
  video: HTMLVideoElement
): Promise<PoseLandmarkerResult | null> {
  try {
    const bitmap = await createImageBitmap(video);
    try {
      return detectOnce(detector, bitmap);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

/**
 * Runs lite then full model with video, ImageBitmap, canvas, and retries (teacher capture).
 */
async function detectPoseFromImageWithDetector(
  detector: PoseLandmarker,
  video: HTMLVideoElement
): Promise<PoseLandmarkerResult | null> {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;

  let result = detectOnce(detector, video);
  if (result) return result;

  result = await tryImageBitmap(detector, video);
  if (result) return result;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.drawImage(video, 0, 0);
    result = detectOnce(detector, canvas);
    if (result) return result;
  }

  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) break;

    result = detectOnce(detector, video);
    if (result) return result;

    result = await tryImageBitmap(detector, video);
    if (result) return result;

    if (ctx) {
      ctx.drawImage(video, 0, 0);
      result = detectOnce(detector, canvas);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Detecta pose em um único frame (uso: professor capturando referência).
 * Tenta modelo lite, depois full.
 */
export async function detectPoseFromImage(
  video: HTMLVideoElement
): Promise<PoseLandmarkerResult | null> {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;

  const lite = await initPoseLandmarkerImageLite();
  let result = await detectPoseFromImageWithDetector(lite, video);
  if (result) return result;

  const full = await initPoseLandmarkerImageFull();
  result = await detectPoseFromImageWithDetector(full, video);
  return result;
}

/**
 * Detecta pose em um frame de vídeo (uso: loop do aluno).
 */
export async function detectPose(
  video: HTMLVideoElement,
  timestamp: number
): Promise<PoseLandmarkerResult | null> {
  const detector = await initPoseLandmarker();
  try {
    const result = detector.detectForVideo(video, timestamp);
    if (result?.landmarks?.length && result.landmarks[0]?.length) return result;
    return null;
  } catch {
    return null;
  }
}
