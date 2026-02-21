'use client';

import '@/lib/patchTfConsole';
import { useEffect, useRef, useState, useCallback } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { motion } from 'motion/react';
import { Camera, Copy, Check, Users, GraduationCap, Sparkles } from 'lucide-react';
import {
  extractKeypoints,
  detectPose,
  detectPoseFromImage,
  type PoseKeypoints,
} from '@/lib/poseDetection';
import { comparePoses, DEFAULT_CRINGE_THRESHOLD, getPoseTips } from '@/lib/poseComparison';

/** Extract face position and size from pose keypoints. MediaPipe: 0=nose, 2=left_eye, 5=right_eye, 7=left_ear, 8=right_ear */
function getFaceFromKeypoints(keypoints: PoseKeypoints): { x: number; y: number; size: number } | null {
  if (keypoints.length < 33 * 3) return null;
  const noseX = keypoints[0];
  const noseY = keypoints[1];
  const eyeLX = keypoints[2 * 3];
  const eyeLY = keypoints[2 * 3 + 1];
  const eyeRX = keypoints[5 * 3];
  const eyeRY = keypoints[5 * 3 + 1];
  const earLX = keypoints[7 * 3];
  const earLY = keypoints[7 * 3 + 1];
  const earRX = keypoints[8 * 3];
  const earRY = keypoints[8 * 3 + 1];
  const earDist = Math.sqrt((earRX - earLX) ** 2 + (earRY - earLY) ** 2);
  if (earDist < 0.02) return null;
  const x = (noseX + eyeLX + eyeRX) / 3;
  const y = (noseY + eyeLY + eyeRY) / 3;
  const size = Math.min(0.5, earDist * 2.2);
  return { x, y, size };
}

type Mode = 'professor' | 'student';

const FEEDBACK_SUCCESS = [
  "You nailed the professor's weirdness!",
  'Maximum cringe achieved.',
  "That's the spirit!",
  'Attendance confirmed!',
];
const FEEDBACK_FAIL = [
  "You look confident, but wrong.",
  "Try harder, you're not cringe enough.",
  'Almost there... or maybe not.',
  'Academic despair detected.',
];

const POSE_PRESETS = [
  { id: 't-rex', label: 'T-Rex mode', emoji: '🦖' },
  { id: 'ai-malfunction', label: 'AI malfunction', emoji: '🤖' },
  { id: 'academic-despair', label: 'Academic despair', emoji: '😫' },
];

export default function PoseAttendancePage() {
  const [mode, setMode] = useState<Mode>('professor');
  const [referencePose, setReferencePose] = useState<PoseKeypoints | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [cringeLevel, setCringeLevel] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [presenceConfirmed, setPresenceConfirmed] = useState(false);
  const [faceOverlay, setFaceOverlay] = useState<{ x: number; y: number; size: number } | null>(null);
  const [faceEmojiMessage, setFaceEmojiMessage] = useState<{ emoji: string; text: string }>({ emoji: '🤡', text: "You're a rockstar!" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentPasteCode, setStudentPasteCode] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const isDetectingRef = useRef(false);
  const consecutiveGoodFramesRef = useRef(0);

  /** Frames of similarity >= threshold required to confirm attendance */
  const SUSTAINED_FRAMES = 18;

  const generateShareCode = useCallback((pose: PoseKeypoints, image: string) => {
    const payload = { pose, image };
    return btoa(encodeURIComponent(JSON.stringify(payload)));
  }, []);

  const parseShareCode = useCallback((code: string): { pose: PoseKeypoints; image: string | null } | null => {
    try {
      const json = decodeURIComponent(atob(code));
      const parsed = JSON.parse(json);
      let pose: PoseKeypoints | null = null;
      let image: string | null = null;
      if (Array.isArray(parsed) && parsed.length >= 33 * 3) {
        pose = parsed;
      } else if (parsed?.pose && Array.isArray(parsed.pose) && parsed.pose.length >= 33 * 3) {
        pose = parsed.pose;
        if (typeof parsed.image === 'string' && parsed.image.startsWith('data:')) image = parsed.image;
      }
      if (pose) return { pose, image };
    } catch {
      // ignore
    }
    return null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      setError('Could not access camera.');
      console.error(e);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureReferencePose = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    setIsLoading(true);
    setError(null);
    try {
      const video = videoRef.current;
      const result = await detectPoseFromImage(video);
      const keypoints = result ? extractKeypoints(result) : null;
      if (keypoints) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = canvas.toDataURL('image/jpeg', 0.85);
          setReferenceImage(imageData);
          setReferencePose(keypoints);
          setShareCode(generateShareCode(keypoints, imageData));
        } else {
          setReferenceImage(null);
          setReferencePose(keypoints);
          setShareCode(generateShareCode(keypoints, ''));
        }
      } else {
        setError('No pose detected. Try again with your body visible.');
      }
    } catch (e) {
      setError('Error detecting pose.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [generateShareCode]);

  const loadFromShareCode = useCallback((code: string) => {
    const data = parseShareCode(code.trim());
    if (data) {
      setReferencePose(data.pose);
      setReferenceImage(data.image);
      setShareCode(code);
      setError(null);
      setPresenceConfirmed(false);
      consecutiveGoodFramesRef.current = 0;
    } else {
      setError('Invalid code.');
    }
  }, [parseShareCode]);

  // Loop de detecção para modo student
  useEffect(() => {
    if (mode !== 'student' || !referencePose || !videoRef.current) return;
    if (presenceConfirmed) return;

    const runDetection = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(runDetection);
        return;
      }
      const frameTime = video.currentTime;
      if (frameTime === lastVideoTimeRef.current || isDetectingRef.current) {
        rafRef.current = requestAnimationFrame(runDetection);
        return;
      }
      lastVideoTimeRef.current = frameTime;
      isDetectingRef.current = true;
      try {
        const result = await detectPose(video, frameTime * 1000);
        const keypoints = result ? extractKeypoints(result) : null;
        if (keypoints) {
          const similarity = comparePoses(referencePose, keypoints);
          setCringeLevel(Math.round(similarity * 100));
          if (similarity >= DEFAULT_CRINGE_THRESHOLD) {
            consecutiveGoodFramesRef.current += 1;
            setTips([]);
            if (consecutiveGoodFramesRef.current >= SUSTAINED_FRAMES) {
              const face = getFaceFromKeypoints(keypoints);
              if (face) setFaceOverlay(face);
              const emojis = [
                { emoji: '🤡', text: "You're a rockstar!" },
                { emoji: '🦄', text: 'Legendary!' },
                { emoji: '👑', text: 'Absolute legend!' },
                { emoji: '🔥', text: 'On fire!' },
                { emoji: '⭐', text: 'Star student!' },
              ];
              setFaceEmojiMessage(emojis[Math.floor(Math.random() * emojis.length)]);
              setPresenceConfirmed(true);
              setFeedback(FEEDBACK_SUCCESS[Math.floor(Math.random() * FEEDBACK_SUCCESS.length)]);
            } else {
              setFeedback(`Hold the pose... ${Math.round((consecutiveGoodFramesRef.current / SUSTAINED_FRAMES) * 100)}%`);
            }
          } else {
            consecutiveGoodFramesRef.current = 0;
            setFeedback(FEEDBACK_FAIL[Math.floor(Math.random() * FEEDBACK_FAIL.length)]);
            const poseTips = getPoseTips(referencePose, keypoints);
            setTips(poseTips.length > 0 ? poseTips : ['Try adjusting your arms and legs to match the reference image']);
          }
        }
      } catch {
        // ignore
      } finally {
        isDetectingRef.current = false;
      }
      rafRef.current = requestAnimationFrame(runDetection);
    };

    rafRef.current = requestAnimationFrame(runDetection);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, referencePose, presenceConfirmed]);

  // When entering student mode, turn on camera
  useEffect(() => {
    if (mode === 'student') {
      startCamera();
    }
    return () => stopCamera();
  }, [mode]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const resetStudent = useCallback(() => {
    setPresenceConfirmed(false);
    setFaceOverlay(null);
    setCringeLevel(0);
    setFeedback(null);
    setTips([]);
    consecutiveGoodFramesRef.current = 0;
  }, []);

  return (
    <DashboardShell>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-500/5 p-3 rounded-xl">
            <Sparkles className="w-6 h-6 text-fuchsia-500" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">Attendance by Pose Cringe™</h2>
            <p className="text-gray-400">
              The teacher strikes a pose. Students imitate. Attendance confirmed when cringe level hits.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs Teacher / Student */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => {
            setMode('professor');
            stopCamera();
            setReferencePose(null);
            setReferenceImage(null);
            setShareCode('');
            setPresenceConfirmed(false);
            setFaceOverlay(null);
            setCringeLevel(0);
            setFeedback(null);
          }}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            mode === 'professor'
              ? 'bg-fuchsia-500/30 text-white border border-fuchsia-500/50'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          <GraduationCap className="w-4 h-4 inline mr-2 -mt-0.5" />
          Teacher
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('student');
            setReferencePose(null);
            startCamera();
          }}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            mode === 'student'
              ? 'bg-fuchsia-500/30 text-white border border-fuchsia-500/50'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2 -mt-0.5" />
          Student
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {mode === 'professor' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
              <div className="aspect-video bg-black/50 flex items-center justify-center relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-w-full max-h-full object-cover"
                />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                {!streamRef.current && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                    <Camera className="w-16 h-16 mb-2 opacity-50" />
                    <span>Camera off</span>
                  </div>
                )}
              </div>
              <div className="p-4 flex gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 px-4 py-2 bg-[#4F8CFF]/20 text-[#4F8CFF] rounded-lg hover:bg-[#4F8CFF]/30"
                >
                  Turn on camera
                </button>
                <button
                  type="button"
                  onClick={captureReferencePose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-fuchsia-500/30 text-fuchsia-300 rounded-lg hover:bg-fuchsia-500/40 disabled:opacity-50"
                >
                  {isLoading ? 'Detecting...' : 'Capture pose'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Strike a weird pose on camera and click &quot;Capture pose&quot;. Share the
                code with your students.
              </p>

              {referencePose && (
                <>
                  {referenceImage && (
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-4">
                      <p className="text-sm text-gray-400 px-4 pt-3 pb-2">Captured pose (students will see this):</p>
                      <img
                        src={referenceImage}
                        alt="Captured pose"
                        className="w-full max-h-48 object-contain"
                      />
                    </div>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-sm text-gray-400 mb-2">Code to share:</p>
                    <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareCode}
                      className="flex-1 px-3 py-2 bg-black/30 rounded-lg text-sm font-mono truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(shareCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                </>
              )}

              <div className="border border-white/10 rounded-xl p-4">
                <p className="text-sm font-medium text-fuchsia-400 mb-2">Random poses</p>
                <div className="flex flex-wrap gap-2">
                  {POSE_PRESETS.map((p) => (
                    <span
                      key={p.id}
                      className="px-3 py-1.5 bg-white/5 rounded-lg text-sm text-gray-400"
                      title={p.label}
                    >
                      {p.emoji} {p.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {mode === 'student' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="grid md:grid-cols-2 gap-6">
            {/* Lado esquerdo: referência do professor + câmera do aluno */}
            <div className="space-y-4">
              {/* Imagem fixa do professor fazendo a pose */}
              {referenceImage && (
                <div className="bg-white/5 backdrop-blur-md border-2 border-fuchsia-500/40 rounded-xl overflow-hidden">
                  <div className="bg-fuchsia-500/10 px-4 py-2 text-sm font-medium text-fuchsia-300">
                    Teacher&apos;s pose — copy this
                  </div>
                  <div className="aspect-video bg-black/30 flex items-center justify-center relative overflow-hidden">
                    <img
                      src={referenceImage}
                      alt="Teacher's pose to copy"
                      className="max-w-full max-h-full object-cover -scale-x-100"
                    />
                    {presenceConfirmed && referencePose && (() => {
                      const refFace = getFaceFromKeypoints(referencePose);
                      if (!refFace) return null;
                      return (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                          className="absolute pointer-events-none flex flex-col items-center justify-center drop-shadow-2xl"
                          style={{
                            left: `${(1 - refFace.x) * 100}%`,
                            top: `${refFace.y * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            width: `${Math.min(0.5, refFace.size) * 120}%`,
                            aspectRatio: '1',
                          }}
                        >
                          <span
                            className="leading-none block w-full h-full flex items-center justify-center"
                            style={{ fontSize: 'min(8rem, 15vw)' }}
                          >
                            {faceEmojiMessage.emoji}
                          </span>
                          <span className="text-white text-xs sm:text-sm font-bold drop-shadow-lg text-center mt-1 px-2 py-1 bg-black/60 rounded-lg whitespace-nowrap">
                            {faceEmojiMessage.text}
                          </span>
                        </motion.div>
                      );
                    })()}
                  </div>
                </div>
              )}
              {/* Vídeo do aluno */}
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
                <div className="aspect-video bg-black/50 flex items-center justify-center relative overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="max-w-full max-h-full object-cover -scale-x-100"
                  />
                  {presenceConfirmed && faceOverlay && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center"
                      style={{ width: '100%', height: '100%' }}
                    >
                      <div
                        className="absolute flex flex-col items-center justify-center drop-shadow-2xl"
                        style={{
                          left: `${(1 - faceOverlay.x) * 100}%`,
                          top: `${faceOverlay.y * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          width: `${Math.min(0.5, faceOverlay.size) * 140}%`,
                          aspectRatio: '1',
                        }}
                      >
                        <span
                          className="leading-none block w-full h-full flex items-center justify-center"
                          style={{ fontSize: 'min(8rem, 15vw)' }}
                        >
                          {faceEmojiMessage.emoji}
                        </span>
                        <span className="text-white text-xs sm:text-sm font-bold drop-shadow-lg text-center mt-1 px-2 py-1 bg-black/60 rounded-lg whitespace-nowrap">
                          {faceEmojiMessage.text}
                        </span>
                      </div>
                    </motion.div>
                  )}
                  {!streamRef.current && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                      <Camera className="w-12 h-12 mb-2 opacity-50" />
                      <span>Starting camera...</span>
                    </div>
                  )}
                </div>
                <p className="p-4 text-sm text-gray-400">
                  {referencePose
                    ? 'Your camera — copy the pose above'
                    : 'Paste the code below to load the reference pose.'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {!referencePose ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <p className="mb-3 text-gray-400">
                    Paste the code the teacher shared:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={studentPasteCode}
                      onChange={(e) => setStudentPasteCode(e.target.value)}
                      placeholder="Pose code"
                      className="flex-1 px-4 py-2 bg-black/30 rounded-lg border border-white/10 focus:border-fuchsia-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => loadFromShareCode(studentPasteCode)}
                      className="px-4 py-2 bg-fuchsia-500/30 text-fuchsia-300 rounded-lg hover:bg-fuchsia-500/40"
                    >
                      Load
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Cringe Level</p>
                    <div className="h-4 bg-black/30 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          cringeLevel >= DEFAULT_CRINGE_THRESHOLD * 100
                            ? 'bg-green-500'
                            : cringeLevel >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500/70'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(cringeLevel, 100)}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-right text-sm text-gray-500 mt-1">{cringeLevel}%</p>
                  </div>

                  <div
                    className={`p-6 rounded-xl border ${
                      presenceConfirmed
                        ? 'bg-green-500/10 border-green-500/40'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {feedback ? (
                      <p className={presenceConfirmed ? 'text-green-400' : 'text-red-400'}>
                        {feedback}
                      </p>
                    ) : (
                      <p className="text-gray-500">Do the pose to start...</p>
                    )}
                    {tips.length > 0 && !presenceConfirmed && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-sm font-medium text-amber-400 mb-2">Tips:</p>
                        <ul className="text-sm text-gray-300 space-y-1">
                          {tips.map((tip, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="text-amber-500">→</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {presenceConfirmed && (
                      <p className="mt-2 text-2xl font-bold text-green-400">Attendance confirmed ✅</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                  setReferencePose(null);
                    setReferenceImage(null);
                    setShareCode('');
                    resetStudent();
                    }}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Back and use another code
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </DashboardShell>
  );
}
