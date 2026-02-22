/**
 * Comparação de poses para Presença por Pose Cringe™
 * Usa similaridade ponderada nos keypoints mais importantes (braços, pernas, torso)
 */

import type { PoseKeypoints } from './poseDetection';

/** Keypoints mais importantes para identificação da pose: ombros, cotovelos, pulsos, quadril, joelhos, tornozelos */
const KEY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]; // MediaPipe indices

/**
 * Normaliza o vetor de keypoints: centraliza no quadril e escala.
 * MediaPipe: índice 23 = quadril esquerdo, 24 = quadril direito
 */
function normalizePose(flat: PoseKeypoints): PoseKeypoints {
  if (flat.length < 33 * 3) return flat;
  const midHipX = (flat[23 * 3] + flat[24 * 3]) / 2;
  const midHipY = (flat[23 * 3 + 1] + flat[24 * 3 + 1]) / 2;
  const shoulderLeftX = flat[11 * 3];
  const shoulderRightX = flat[12 * 3];
  const scale = Math.max(0.001, Math.abs(shoulderRightX - shoulderLeftX));
  const out: number[] = [];
  for (let i = 0; i < flat.length; i += 3) {
    out.push((flat[i] - midHipX) / scale);
    out.push((flat[i + 1] - midHipY) / scale);
    out.push((flat[i + 2] ?? 0) / scale);
  }
  return out;
}

/**
 * Similaridade ponderada: keypoints importantes (braços, pernas) têm peso 2x.
 * Combina similaridade geral com penalidade em erros nos pontos-chave.
 */
function weightedSimilarity(refNorm: PoseKeypoints, curNorm: PoseKeypoints): number {
  if (refNorm.length !== curNorm.length || refNorm.length === 0) return 0;
  const weights: number[] = [];
  for (let i = 0; i < 33; i++) {
    const w = KEY_JOINTS.includes(i) ? 2 : 1;
    weights.push(w, w, w);
  }
  let dot = 0;
  let normRef = 0;
  let normCur = 0;
  for (let i = 0; i < refNorm.length; i++) {
    const w = weights[i] ?? 1;
    dot += w * refNorm[i] * curNorm[i];
    normRef += w * refNorm[i] * refNorm[i];
    normCur += w * curNorm[i] * curNorm[i];
  }
  const denom = Math.sqrt(normRef) * Math.sqrt(normCur);
  if (denom < 1e-8) return 0;
  const sim = dot / denom;
  return (sim + 1) / 2;
}

/**
 * Penalidade por erro nos pontos-chave: distância média normalizada.
 * Quanto maior o erro nos braços/pernas, mais a similaridade cai.
 */
function keyJointPenalty(refNorm: PoseKeypoints, curNorm: PoseKeypoints): number {
  let totalErr = 0;
  let count = 0;
  for (const i of KEY_JOINTS) {
    const base = i * 3;
    for (let j = 0; j < 3; j++) {
      totalErr += (refNorm[base + j] - curNorm[base + j]) ** 2;
      count++;
    }
  }
  const rmse = Math.sqrt(totalErr / Math.max(1, count));
  return Math.max(0, 1 - rmse); // 1 = sem penalidade, 0 = erro grande
}

/**
 * Calcula similaridade entre a pose do aluno e a pose de referência do professor.
 * Combina similaridade ponderada (70%) com penalidade nos pontos-chave (30%).
 * Retorna valor entre 0 e 1 (1 = pose idêntica).
 */
export function comparePoses(reference: PoseKeypoints, current: PoseKeypoints): number {
  if (!reference?.length || !current?.length) return 0;
  if (reference.length !== current.length) return 0;
  const refNorm = normalizePose(reference);
  const curNorm = normalizePose(current);
  const weighted = weightedSimilarity(refNorm, curNorm);
  const penalty = keyJointPenalty(refNorm, curNorm);
  return 0.7 * weighted + 0.3 * penalty;
}

/** Stricter threshold: minimum similarity to count pose as correct (higher = more accurate match required) */
export const CRINGE_THRESHOLD = 0.88;
/** @deprecated Use CRINGE_THRESHOLD */
export const DEFAULT_CRINGE_THRESHOLD = CRINGE_THRESHOLD;

/** Joint info for tips: MediaPipe index, label, side */
const JOINT_TIPS: { index: number; part: string; side: 'left' | 'right' }[] = [
  { index: 15, part: 'hand', side: 'left' },
  { index: 16, part: 'hand', side: 'right' },
  { index: 13, part: 'elbow', side: 'left' },
  { index: 14, part: 'elbow', side: 'right' },
  { index: 11, part: 'shoulder', side: 'left' },
  { index: 12, part: 'shoulder', side: 'right' },
  { index: 25, part: 'knee', side: 'left' },
  { index: 26, part: 'knee', side: 'right' },
  { index: 27, part: 'foot', side: 'left' },
  { index: 28, part: 'foot', side: 'right' },
];

/**
 * Returns tips for the student when their pose doesn't match.
 * Analyzes which joints differ most and suggests adjustments.
 */
export function getPoseTips(
  reference: PoseKeypoints,
  current: PoseKeypoints
): string[] {
  if (!reference?.length || !current?.length || reference.length !== current.length) return [];
  const refNorm = normalizePose(reference);
  const curNorm = normalizePose(current);
  const tips: { err: number; tip: string }[] = [];
  const minErr = 0.15;

  for (const { index, part, side } of JOINT_TIPS) {
    const base = index * 3;
    const dx = curNorm[base] - refNorm[base];
    const dy = curNorm[base + 1] - refNorm[base + 1];
    const err = Math.sqrt(dx * dx + dy * dy);
    if (err < minErr) continue;

    const sideLabel = side === 'left' ? 'left' : 'right';
    if (part === 'hand' || part === 'elbow') {
      if (dy > minErr) tips.push({ err, tip: `Raise your ${sideLabel} arm a bit` });
      else if (dy < -minErr) tips.push({ err, tip: `Lower your ${sideLabel} arm` });
      if (Math.abs(dx) > minErr) {
        tips.push({ err, tip: dx > 0 ? `Move your ${sideLabel} hand inward` : `Move your ${sideLabel} hand outward` });
      }
    } else if (part === 'shoulder') {
      if (Math.abs(dy) > minErr) {
        tips.push({ err, tip: dy > 0 ? `Raise your ${sideLabel} shoulder` : `Lower your ${sideLabel} shoulder` });
      }
    } else if (part === 'knee') {
      if (dy > minErr) tips.push({ err, tip: `Bend your ${sideLabel} knee more` });
      else if (dy < -minErr) tips.push({ err, tip: `Straighten your ${sideLabel} leg` });
    } else if (part === 'foot') {
      if (Math.abs(dx) > minErr) {
        tips.push({ err, tip: dx > 0 ? `Move your ${sideLabel} foot inward` : `Move your ${sideLabel} foot outward` });
      }
    }
  }

  return tips
    .sort((a, b) => b.err - a.err)
    .slice(0, 3)
    .map((t) => t.tip)
    .filter((v, i, a) => a.indexOf(v) === i);
}
