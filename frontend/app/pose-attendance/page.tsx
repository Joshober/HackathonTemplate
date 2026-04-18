'use client';

import '@/lib/patchTfConsole';
import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import { motion } from 'motion/react';
import { Camera, Copy, Check, Users, GraduationCap, Sparkles, Link2, Clock } from 'lucide-react';
import {
  extractKeypoints,
  detectPose,
  detectPoseFromImage,
  resetVideoPoseLandmarker,
  type PoseKeypoints,
} from '@/lib/poseDetection';
import { comparePoses, DEFAULT_CRINGE_THRESHOLD, getPoseTips } from '@/lib/poseComparison';
import { api } from '@/lib/api';

/** Wait until the video element has decodable frames and non-zero dimensions (fixes early Capture clicks). */
async function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 6000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return false;
}

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

const REQUIRED_POSES = 3;

const FEEDBACK_SUCCESS = [
  "You nailed the professor's weirdness!",
  'Maximum cringe achieved.',
  "That's the spirit!",
  'Pose complete! Next one...',
];
const FEEDBACK_FAIL = [
  "You look confident, but wrong.",
  "Try harder, you're not cringe enough.",
  'Almost there... or maybe not.',
  'Academic despair detected.',
];
const KICKED_MESSAGE = "Ok, the AI decided to kick you out because it's working too well.";

const POSE_PRESETS = [
  { id: 't-rex', label: 'T-Rex mode', emoji: '🦖' },
  { id: 'ai-malfunction', label: 'AI malfunction', emoji: '🤖' },
  { id: 'academic-despair', label: 'Academic despair', emoji: '😫' },
];

type PoseWithImage = { pose: PoseKeypoints; image: string | null };

/** Parse 1 pose from URL or 3-pose payload from code. */
function parsePosesFromInput(code: string): PoseWithImage[] | null {
  try {
    const json = decodeURIComponent(atob(code.replace(/-/g, '+').replace(/_/g, '/')));
    const parsed = JSON.parse(json);
    if (parsed?.poses && Array.isArray(parsed.poses) && parsed.poses.length >= REQUIRED_POSES) {
      const out: PoseWithImage[] = [];
      for (const p of parsed.poses.slice(0, REQUIRED_POSES)) {
        if (p?.pose && Array.isArray(p.pose) && p.pose.length >= 33 * 3) {
          out.push({ pose: p.pose, image: typeof p.image === 'string' && p.image.startsWith('data:') ? p.image : null });
        } else return null;
      }
      return out.length === REQUIRED_POSES ? out : null;
    }
    // Legacy: single pose
    if (Array.isArray(parsed) && parsed.length >= 33 * 3) {
      return [{ pose: parsed, image: null }];
    }
    if (parsed?.pose && Array.isArray(parsed.pose) && parsed.pose.length >= 33 * 3) {
      return [{ pose: parsed.pose, image: typeof parsed.image === 'string' && parsed.image.startsWith('data:') ? parsed.image : null }];
    }
    return null;
  } catch {
    return null;
  }
}

/** Encode 3 poses for URL or share code. */
function encodePosesForUrl(poses: PoseWithImage[]): string {
  return btoa(encodeURIComponent(JSON.stringify({ poses }))).replace(/\+/g, '-').replace(/\//g, '_');
}

function PoseAttendancePageInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('professor');
  const [referencePoses, setReferencePoses] = useState<PoseWithImage[]>([]);
  const [shareCode, setShareCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [cringeLevel, setCringeLevel] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [kickedFromRoom, setKickedFromRoom] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [faceOverlay, setFaceOverlay] = useState<{ x: number; y: number; size: number } | null>(null);
  const [faceEmojiMessage, setFaceEmojiMessage] = useState<{ emoji: string; text: string }>({ emoji: '🤡', text: "You're a rockstar!" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentPasteCode, setStudentPasteCode] = useState('');
  const [isProfessor, setIsProfessor] = useState(false);
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const hasAppliedUrlPoseRef = useRef(false);
  /** Stream attached — ref alone does not re-render, so overlay was stuck on "camera off". */
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFrameReady, setCameraFrameReady] = useState(false);

  const referencePose = referencePoses[currentPoseIndex]?.pose ?? null;
  const referenceImage = referencePoses[currentPoseIndex]?.image ?? null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const isDetectingRef = useRef(false);
  const consecutiveGoodFramesRef = useRef(0);

  /** Frames of similarity >= threshold (~1s at 30fps — easier attendance) */
  const SUSTAINED_FRAMES = 30;

  /** Seconds per pose — if time runs out, student is kicked */
  const POSE_TIMEOUT_SECONDS = 18;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateShareCode = useCallback((poses: PoseWithImage[]) => {
    return btoa(encodeURIComponent(JSON.stringify({ poses })));
  }, []);

  const parseShareCode = useCallback((code: string): PoseWithImage[] | null => {
    return parsePosesFromInput(code.trim());
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraFrameReady(false);
    lastVideoTimeRef.current = -1;
    resetVideoPoseLandmarker();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setCameraActive(true);
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.playsInline = true;
        try {
          await v.play();
        } catch {
          /* muted + playsInline usually enough; policies vary */
        }
        const ready = await waitForVideoReady(v, 8000);
        setCameraFrameReady(ready);
        if (!ready) {
          setError('Camera started but no video frames yet. Click Turn on camera again or check browser permissions.');
        }
      }
    } catch (e) {
      setCameraActive(false);
      setCameraFrameReady(false);
      setError('Could not access camera.');
      console.error(e);
    }
  }, []);

  const stopCamera = useCallback(() => {
    setCameraActive(false);
    setCameraFrameReady(false);
    lastVideoTimeRef.current = -1;
    resetVideoPoseLandmarker();
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
    if (referencePoses.length >= REQUIRED_POSES) return;
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      setError('Turn on the camera first, wait until you see the preview, then capture.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const ready = await waitForVideoReady(video, 5000);
      if (!ready) {
        setError('Camera not ready yet. Wait until you see yourself in the preview, then try Capture again.');
        return;
      }
      video.playsInline = true;
      await video.play().catch(() => {});
      await new Promise((r) => requestAnimationFrame(r));
      const result = await detectPoseFromImage(video);
      const keypoints = result ? extractKeypoints(result) : null;
      if (keypoints) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        let imageData = '';
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          imageData = canvas.toDataURL('image/jpeg', 0.85);
        }
        const newPose: PoseWithImage = { pose: keypoints, image: imageData || null };
        const updated = [...referencePoses, newPose];
        setReferencePoses(updated);
        if (updated.length === REQUIRED_POSES) {
          setShareCode(generateShareCode(updated));
        }
      } else {
        setError(
          'No pose detected. Face the camera, keep your upper body and arms in frame, use good lighting, then try again.'
        );
      }
    } catch (e) {
      setError('Error detecting pose. Disable ad blockers for this site (MediaPipe loads model/WASM from the network).');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [generateShareCode, referencePoses]);

  const loadFromShareCode = useCallback((code: string) => {
    const data = parseShareCode(code.trim());
    if (data && data.length >= REQUIRED_POSES) {
      setReferencePoses(data.slice(0, REQUIRED_POSES));
      setShareCode(code);
      setError(null);
      setCurrentPoseIndex(0);
      setKickedFromRoom(false);
      consecutiveGoodFramesRef.current = 0;
    } else if (data && data.length === 1) {
      setReferencePoses([data[0], data[0], data[0]]);
      setShareCode(code);
      setError(null);
      setCurrentPoseIndex(0);
      setKickedFromRoom(false);
      consecutiveGoodFramesRef.current = 0;
    } else {
      setError('Invalid code. Need 3 poses from the teacher.');
    }
  }, [parseShareCode]);

  useEffect(() => {
    api
      .adminMe()
      .then((r) => setIsProfessor(!!r?.isProfessor))
      .catch(() => setIsProfessor(false));
  }, []);

  const savePoseSession = useCallback(async () => {
    if (referencePoses.length !== REQUIRED_POSES) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = referencePoses.map((p) => ({ pose: p.pose, image: p.image }));
      const data = await api.createPoseSession(payload);
      setSessionPassword(data.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save. Only the professor can save sessions.');
    } finally {
      setIsSaving(false);
    }
  }, [referencePoses]);

  const loadFromPassword = useCallback(async (password: string) => {
    const pwd = password.trim();
    if (!pwd) {
      setError('Enter the password from your teacher.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const data = await api.getPoseSession(pwd);
      const poses = (data.poses || []).slice(0, REQUIRED_POSES);
      if (poses.length >= REQUIRED_POSES) {
        setReferencePoses(poses.map((p) => ({ pose: p.pose, image: p.image ?? null })));
        setStudentPasteCode('');
        setCurrentPoseIndex(0);
        setKickedFromRoom(false);
        consecutiveGoodFramesRef.current = 0;
      } else {
        setError('Invalid or expired password.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid password.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load poses from URL: ?password=xxx (from DB) or ?code=xxx (legacy base64)
  useEffect(() => {
    if (hasAppliedUrlPoseRef.current) return;
    const passwordParam = searchParams.get('password');
    const codeParam = searchParams.get('code');
    if (passwordParam) {
      hasAppliedUrlPoseRef.current = true;
      setMode('student');
      setStudentPasteCode(passwordParam);
      api.getPoseSession(passwordParam).then((data) => {
        const poses = (data.poses || []).slice(0, REQUIRED_POSES);
        if (poses.length >= REQUIRED_POSES) {
          setReferencePoses(poses.map((p) => ({ pose: p.pose, image: p.image ?? null })));
          setCurrentPoseIndex(0);
          setKickedFromRoom(false);
          consecutiveGoodFramesRef.current = 0;
          setError(null);
        } else setError('Invalid or expired password.');
      }).catch(() => setError('Invalid password.'));
      return;
    }
    if (codeParam) {
      const data = parsePosesFromInput(codeParam);
      if (data && data.length >= REQUIRED_POSES) {
        hasAppliedUrlPoseRef.current = true;
        setMode('student');
        setReferencePoses(data.slice(0, REQUIRED_POSES));
        setShareCode(codeParam);
        setError(null);
        setCurrentPoseIndex(0);
        setKickedFromRoom(false);
        consecutiveGoodFramesRef.current = 0;
      } else if (data && data.length === 1) {
        hasAppliedUrlPoseRef.current = true;
        setMode('student');
        setReferencePoses([data[0], data[0], data[0]]);
        setShareCode(codeParam);
        setError(null);
        setCurrentPoseIndex(0);
        setKickedFromRoom(false);
        consecutiveGoodFramesRef.current = 0;
      }
    }
  }, [searchParams]);

  // Loop de detecção para modo student
  useEffect(() => {
    if (mode !== 'student' || !referencePose || referencePoses.length === 0 || !videoRef.current) return;
    if (kickedFromRoom) return;

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

              if (currentPoseIndex >= REQUIRED_POSES - 1) {
                setKickedFromRoom(true);
                setFeedback(KICKED_MESSAGE);
                setFaceOverlay(null);
              } else {
                setCurrentPoseIndex((i) => i + 1);
                consecutiveGoodFramesRef.current = 0;
                setFaceOverlay(null);
                setFeedback(`Pose ${currentPoseIndex + 2}/${REQUIRED_POSES} — next!`);
              }
            } else {
              setFeedback(`Hold the pose... ${Math.round((consecutiveGoodFramesRef.current / SUSTAINED_FRAMES) * 100)}% (Pose ${currentPoseIndex + 1}/${REQUIRED_POSES})`);
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
  }, [mode, referencePose, referencePoses.length, currentPoseIndex, kickedFromRoom]);

  // Countdown timer per pose: 10s — if time runs out, kick
  useEffect(() => {
    if (mode !== 'student' || referencePoses.length === 0 || kickedFromRoom) return;
    setTimeRemaining(POSE_TIMEOUT_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setKickedFromRoom(true);
          setFeedback(KICKED_MESSAGE);
          setFaceOverlay(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mode, referencePoses.length, currentPoseIndex, kickedFromRoom]);

  // When entering professor or student mode, turn on camera
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const resetStudent = useCallback(() => {
    setKickedFromRoom(false);
    setCurrentPoseIndex(0);
    setFaceOverlay(null);
    setCringeLevel(0);
    setFeedback(null);
    setTips([]);
    setTimeRemaining(POSE_TIMEOUT_SECONDS);
    consecutiveGoodFramesRef.current = 0;
    lastVideoTimeRef.current = -1;
    resetVideoPoseLandmarker();
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
              The teacher strikes 3 poses. Students imitate all 3. Spoiler: you get kicked from the room anyway.
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
            setReferencePoses([]);
            setShareCode('');
            setSessionPassword(null);
            setCurrentPoseIndex(0);
            setKickedFromRoom(false);
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
            setReferencePoses([]);
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
                {!cameraActive && (
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
                  className="flex-1 px-4 py-2 bg-[#ff6b35]/20 text-[#ff6b35] rounded-lg hover:bg-[#ff6b35]/30"
                >
                  Turn on camera
                </button>
                <button
                  type="button"
                  onClick={captureReferencePose}
                  disabled={isLoading || referencePoses.length >= REQUIRED_POSES || !cameraActive}
                  className="flex-1 px-4 py-2 bg-fuchsia-500/30 text-fuchsia-300 rounded-lg hover:bg-fuchsia-500/40 disabled:opacity-50"
                >
                  {isLoading ? 'Detecting...' : referencePoses.length >= REQUIRED_POSES ? `All ${REQUIRED_POSES} captured!` : `Capture pose ${referencePoses.length + 1}/${REQUIRED_POSES}`}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Strike {REQUIRED_POSES} weird poses on camera. Click &quot;Capture pose&quot; for each one. Share the
                code with your students.
              </p>

              {referencePoses.length > 0 && (
                <>
                  {referencePoses.length === REQUIRED_POSES && (
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-4">
                      <p className="text-sm text-gray-400 px-4 pt-3 pb-2">Captured poses (students will see these):</p>
                      <div className="flex gap-2 p-4 overflow-x-auto">
                        {referencePoses.map((p, i) => (
                          p.image && (
                            <img
                              key={i}
                              src={p.image}
                              alt={`Pose ${i + 1}`}
                              className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                            />
                          )
                        ))}
                      </div>
                    </div>
                  )}
                  {referencePoses.length === REQUIRED_POSES && isProfessor && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    {!sessionPassword ? (
                      <>
                        <p className="text-sm text-gray-400 mb-2">Save these poses and get a password to share with students.</p>
                        <button
                          type="button"
                          onClick={savePoseSession}
                          disabled={isSaving}
                          className="w-full px-4 py-3 bg-fuchsia-500/30 text-fuchsia-300 rounded-lg hover:bg-fuchsia-500/40 disabled:opacity-50 font-medium"
                        >
                          {isSaving ? 'Saving...' : 'Save & get password'}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-400 mb-2">Share this password with students (they enter it on the Student tab):</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={sessionPassword}
                            className="flex-1 px-3 py-2 bg-black/30 rounded-lg text-lg font-mono tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(sessionPassword ?? '');
                              setCopiedPassword(true);
                              setTimeout(() => setCopiedPassword(false), 2000);
                            }}
                            className="px-4 py-2 bg-fuchsia-500/30 text-fuchsia-300 rounded-lg hover:bg-fuchsia-500/40 flex items-center gap-2"
                          >
                            {copiedPassword ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            {copiedPassword ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Students go to the Student tab and enter this password, or open this link:</p>
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            readOnly
                            value={typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?mode=student&password=${sessionPassword}` : ''}
                            className="flex-1 px-3 py-1.5 bg-black/30 rounded-lg text-xs font-mono truncate"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const link = `${window.location.origin}${window.location.pathname}?mode=student&password=${sessionPassword}`;
                              navigator.clipboard.writeText(link);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className="px-3 py-1.5 bg-white/10 rounded-lg hover:bg-white/20 text-sm flex items-center gap-1"
                          >
                            {copiedLink ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                            {copiedLink ? 'Copied' : 'Copy link'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  )}
                  {referencePoses.length === REQUIRED_POSES && !isProfessor && (
                    <p className="text-sm text-amber-500/90">Only the professor can save poses. Ask the teacher for the password.</p>
                  )}
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
              {/* Imagem fixa do professor fazendo a pose, or message when loaded from link */}
              {referenceImage ? (
                <div className="bg-white/5 backdrop-blur-md border-2 border-fuchsia-500/40 rounded-xl overflow-hidden">
                  <div className="bg-fuchsia-500/10 px-4 py-2 text-sm font-medium text-fuchsia-300">
                    Teacher&apos;s pose {currentPoseIndex + 1}/{REQUIRED_POSES} — copy this
                  </div>
                  <div className="aspect-video bg-black/30 flex items-center justify-center relative overflow-hidden">
                    <img
                      src={referenceImage}
                      alt="Teacher's pose to copy"
                      className="max-w-full max-h-full object-cover -scale-x-100"
                    />
                    {faceOverlay && referencePose && !kickedFromRoom && (() => {
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
              ) : referencePose ? (
                <div className="bg-white/5 backdrop-blur-md border-2 border-fuchsia-500/40 rounded-xl overflow-hidden">
                  <div className="bg-fuchsia-500/10 px-4 py-2 text-sm font-medium text-fuchsia-300">
                    Pose loaded from link
                  </div>
                  <div className="aspect-video bg-black/30 flex items-center justify-center p-6 text-center">
                    <p className="text-gray-400">Get in frame and match the pose. Use the cringe meter on the right!</p>
                  </div>
                </div>
              ) : null}
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
                  {faceOverlay && !kickedFromRoom && (
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
                  {!cameraActive && (
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
                    Enter the password the teacher sent you:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={studentPasteCode}
                      onChange={(e) => setStudentPasteCode(e.target.value)}
                      placeholder="Password"
                      className="flex-1 px-4 py-2 bg-black/30 rounded-lg border border-white/10 focus:border-fuchsia-500/50 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => loadFromPassword(studentPasteCode)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-fuchsia-500/30 text-fuchsia-300 rounded-lg hover:bg-fuchsia-500/40 disabled:opacity-50"
                    >
                      {isLoading ? 'Loading...' : 'Load'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {!kickedFromRoom && (
                    <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <Clock className="w-5 h-5 text-amber-500" />
                      <span className="text-amber-400 font-medium">{timeRemaining}s</span>
                      <span className="text-amber-500/80 text-sm">left for pose {currentPoseIndex + 1}/{REQUIRED_POSES}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Cringe Level</p>
                    <div className="h-4 bg-black/30 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          kickedFromRoom
                            ? 'bg-red-500'
                            : cringeLevel >= DEFAULT_CRINGE_THRESHOLD * 100
                              ? 'bg-green-500'
                              : cringeLevel >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500/70'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${kickedFromRoom ? 100 : Math.min(cringeLevel, 100)}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-right text-sm text-gray-500 mt-1">{kickedFromRoom ? '100%' : `${cringeLevel}%`}</p>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      Tip: step back so your <strong className="text-gray-400">full body</strong> is in frame, face the camera, and{' '}
                      <strong className="text-gray-400">hold still</strong> when the bar turns green (~1s) to register the pose.
                    </p>
                  </div>

                  <div
                    className={`p-6 rounded-xl border ${
                      kickedFromRoom
                        ? 'bg-red-500/20 border-red-500/50'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {feedback ? (
                      <p className={kickedFromRoom ? 'text-red-400 text-xl font-bold' : 'text-red-400'}>
                        {feedback}
                      </p>
                    ) : (
                      <p className="text-gray-500">Do the pose to start... (Pose {currentPoseIndex + 1}/{REQUIRED_POSES})</p>
                    )}
                    {tips.length > 0 && !kickedFromRoom && (
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
                    {kickedFromRoom && (
                      <p className="mt-2 text-2xl font-bold text-red-400">{KICKED_MESSAGE}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                    setReferencePoses([]);
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

export default function PoseAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background-dark text-slate-400 text-sm">
          Loading pose attendance…
        </div>
      }
    >
      <PoseAttendancePageInner />
    </Suspense>
  );
}
