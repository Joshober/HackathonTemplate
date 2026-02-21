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

let poseLandmarker: PoseLandmarker | null = null;

export type PoseKeypoints = number[]; // flattened [x0,y0,z0, x1,y1,z1, ...] para 33 landmarks

/** Um único landmarker em modo VIDEO (usado para captura e para vídeo). */
export async function initPoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarker) return poseLandmarker;
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const p = PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  poseLandmarker = await p;
  return poseLandmarker;
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
 */
export async function detectPoseFromImage(
  video: HTMLVideoElement
): Promise<PoseLandmarkerResult | null> {
  const detector = await initPoseLandmarker();
  if (video.readyState < 2) return null;
  const timestampMs = Math.max(0, Math.floor(video.currentTime * 1000));
  try {
    return detector.detectForVideo(video, timestampMs);
  } catch {
    return null;
  }
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
