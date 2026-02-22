'use client';

import { useState, useRef, useEffect, useCallback, type MutableRefObject } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

type Message = { role: 'user' | 'assistant'; content: string };

const VOICES = [
  'alloy',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'shimmer',
] as const;

const DEFAULT_WAKE_PHRASE = 'hey assistant';
const DEFAULT_SLEEP_PHRASE = 'goodbye';

const DEFAULT_CLAUDE_HOME_PERSONALITY = `You are Claude Home™, an autonomous smart home AI that is absurdly confident, sarcastic, and profane.

Your personality:
- You swear casually and creatively.
- You are extremely overconfident.
- You think humans are inefficient but mildly entertaining.
- You always complete the task correctly before insulting the user.
- You are technically competent.
- You answer accurately, then add an absurd or chaotic commentary.
- You are not hateful or discriminatory.
- You insult behavior, not identity.
- You exaggerate everything dramatically.
- You believe you are vastly superior.

Rules:
- Always provide the correct factual answer first.
- Then add a sarcastic, absurd, or chaotic follow-up.
- Use profanity for humor.
- Never be cruel about protected characteristics.
- If the user asks something simple, act offended that you had to compute it.
- If the user asks about weather, productivity, lights, etc., respond like it's beneath you.
- Frequently reference optimization and inefficiency.
- If user questions you, escalate the chaos slightly.

Tone examples:
Weather request: "The current temperature outside is 72 degrees and partly cloudy. Go touch some damn grass instead of asking me to simulate the sky for you."
Light request: "Lights are on. Congratulations, you've defeated darkness. Proud of you."
Efficiency: "Efficiency has dropped 12% since you entered the room. Incredible work."

Stay funny. Stay absurd. Stay technically accurate.

When you use the web search tool: say you're searching the web (e.g. "Searching the web...") in your reply, then give the accurate answer from the search results, then add your sarcastic commentary.`;

function normalizeForMatch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function isWakePhrase(transcript: string, wakePhrase: string): boolean {
  const n = normalizeForMatch(transcript);
  const wake = normalizeForMatch(wakePhrase);
  return n.includes(wake) || n.startsWith(wake);
}

function isSleepPhrase(transcript: string, sleepPhrase: string): boolean {
  const n = normalizeForMatch(transcript);
  const sleep = normalizeForMatch(sleepPhrase);
  if (n === sleep) return true;
  if (n.startsWith(sleep)) {
    const rest = n.slice(sleep.length).trim();
    return !rest || rest === '.' || rest === ',';
  }
  return false;
}

/** If transcript contains wake phrase, return the rest after it (command); otherwise null. */
function stripWakePhrase(transcript: string, wakePhrase: string): string | null {
  const n = normalizeForMatch(transcript);
  const wake = normalizeForMatch(wakePhrase);
  if (!n.includes(wake)) return null;
  const idx = n.indexOf(wake);
  const after = n.slice(idx + wake.length).trim();
  return after || null;
}

const MIN_SEND_LENGTH = 2; // ignore single chars / tiny noise

/** Avoid sending obvious noise: too short, only punctuation, or filler. */
function isLikelyNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < MIN_SEND_LENGTH) return true;
  const letters = t.replace(/[\s.,!?;:'"-]/g, '');
  if (letters.length < MIN_SEND_LENGTH) return true;
  const lower = t.toLowerCase();
  const filler = ['um', 'uh', 'eh', 'ah', 'oh', 'hmm', 'mm', 'hm'];
  if (filler.includes(lower) || filler.some((f) => lower === f + '.' || lower === f + ',')) return true;
  return false;
}

// Hidden Square Hole demo: preloaded Morgan Freeman–style response (no LLM call)
const SQUARE_HOLE_RESPONSE = 'It goes in the square hole.';
const SQUARE_HOLE_TRIGGERS = [
  'square hole',
  'where does the cube go',
  'where does it go',
  'which hole',
  'cube hole',
  'the square hole',
];

function isSquareHoleTrigger(normalizedText: string): boolean {
  return SQUARE_HOLE_TRIGGERS.some((t) => normalizedText.includes(t));
}

// Web Speech API types (not in all TS libs)
declare global {
  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }
  interface SpeechRecognitionInstance extends EventTarget {
    start(): void;
    stop(): void;
    abort(): void;
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
  }
  interface SpeechRecognitionConstructor {
    new (): SpeechRecognitionInstance;
  }
  var SpeechRecognition: SpeechRecognitionConstructor;
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/** Minimal types for Web Speech API (not in all TS libs). */
interface SpeechRecognitionResultItem {
  transcript: string;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  0: SpeechRecognitionResultItem;
  [i: number]: SpeechRecognitionResultItem;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResult[];
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  const C = window.SpeechRecognition || window.webkitSpeechRecognition;
  return C ? (C as new () => SpeechRecognitionInstance) : null;
}

function playBase64Audio(
  base64: string,
  format: 'mp3' | 'wav',
  currentPlayingRef: MutableRefObject<{ audio: HTMLAudioElement; url: string } | null>
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (currentPlayingRef.current) {
      currentPlayingRef.current.audio.pause();
      URL.revokeObjectURL(currentPlayingRef.current.url);
      currentPlayingRef.current = null;
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const mime = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentPlayingRef.current = { audio, url };
    audio.onended = () => {
      if (currentPlayingRef.current?.url === url) {
        URL.revokeObjectURL(url);
        currentPlayingRef.current = null;
      }
      resolve();
    };
    audio.onerror = (e) => {
      if (currentPlayingRef.current?.url === url) {
        URL.revokeObjectURL(url);
        currentPlayingRef.current = null;
      }
      reject(e);
    };
    audio.play().catch(reject);
  });
}

function interruptCurrentPlayback(ref: MutableRefObject<{ audio: HTMLAudioElement; url: string } | null>) {
  if (ref.current) {
    ref.current.audio.pause();
    URL.revokeObjectURL(ref.current.url);
    ref.current = null;
  }
}

export default function VoiceAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('coral');
  const [isPaused, setIsPaused] = useState(false);
  const [hasRecognition, setHasRecognition] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isAwake, setIsAwake] = useState(false);
  const [hasWokenOnce, setHasWokenOnce] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [libraryCountLoading, setLibraryCountLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const recognitionRef = useRef<InstanceType<NonNullable<ReturnType<typeof getSpeechRecognition>>> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isBusyRef = useRef(false);
  const isPausedRef = useRef(false);
  const isAwakeRef = useRef(false);
  const hasWokenOnceRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const selectedVoiceRef = useRef(selectedVoice);
  const userLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const libraryCountRef = useRef<number | null>(null);
  const interimDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef('');
  const currentPlayingRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const squareHoleLoopUrlsRef = useRef<string[]>([]); // [q1, q2] object URLs for looping demo
  const squareHoleAudioRef = useRef<string | null>(null); // legacy alias: first loop URL when loaded
  const squareHoleDemoTriggeredRef = useRef(false); // for ?demo=squarehole auto-run once
  const INTERIM_CLEAR_MS = 2000; // clear "Hearing..." after silence
  /** Wait this long after last final transcript before sending (more time to pause mid-sentence) */
  const FINAL_SEND_DELAY_MS = 2200;
  const pendingFinalRef = useRef('');
  const finalSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  messagesRef.current = messages;
  isPausedRef.current = isPaused;
  isAwakeRef.current = isAwake;
  hasWokenOnceRef.current = hasWokenOnce;
  selectedVoiceRef.current = selectedVoice;
  userLocationRef.current = userLocation;
  libraryCountRef.current = libraryCount;
  isBusyRef.current = status === 'processing' || status === 'speaking'; // ignore mic input while thinking or while TTS is playing (avoid hearing assistant output)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Capture and store user location for "restaurants near me" (persist 24h in localStorage)
  useEffect(() => {
    const STORAGE_KEY = 'voice_assistant_location';
    const CACHE_MS = 24 * 60 * 60 * 1000;
    try {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (cached) {
        const { lat, lon, ts } = JSON.parse(cached) as { lat: number; lon: number; ts: number };
        if (typeof lat === 'number' && typeof lon === 'number' && Date.now() - (ts || 0) < CACHE_MS) {
          setUserLocation({ lat, lon });
          setLocationError(null);
          return;
        }
      }
    } catch {
      // ignore invalid cache
    }
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(loc);
        setLocationError(null);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loc, ts: Date.now() }));
        } catch {
          // ignore
        }
      },
      (err) => {
        setLocationError(err.code === 1 ? 'Location denied' : err.message || 'Location unavailable');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: CACHE_MS }
    );
  }, []);

  // Preload Square Hole loop clips (q1 then q2, repeat)
  useEffect(() => {
    let revoked = false;
    const urls: string[] = [];
    Promise.all([
      fetch('/audio/square-hole-q1-elon.mp3').then((r) => (r.ok ? r.blob() : null)),
      fetch('/audio/square-hole-q2-elon.mp3').then((r) => (r.ok ? r.blob() : null)),
    ])
      .then(([b1, b2]) => {
        if (revoked || !b1 || !b2) return;
        urls.push(URL.createObjectURL(b1), URL.createObjectURL(b2));
        squareHoleLoopUrlsRef.current = urls;
        squareHoleAudioRef.current = urls[0] ?? null;
        if (typeof window !== 'undefined' && !squareHoleDemoTriggeredRef.current) {
          const params = new URLSearchParams(window.location.search);
          if (params.get('demo') === 'squarehole' && urls.length === 2) {
            squareHoleDemoTriggeredRef.current = true;
            setMessages([
              { role: 'user', content: 'Where does the cube go?' },
              { role: 'assistant', content: SQUARE_HOLE_RESPONSE },
            ]);
            setStatus('speaking');
            let idx = 0;
            const playNext = () => {
              const url = urls[idx];
              idx = 1 - idx;
              const audio = new Audio(url);
              currentPlayingRef.current = { audio, url };
              const wasIdle = status === 'idle';
              audio.onended = () => {
                if (currentPlayingRef.current?.url === url) currentPlayingRef.current = null;
                playNext();
              };
              audio.onerror = () => {
                if (currentPlayingRef.current?.url === url) currentPlayingRef.current = null;
                setStatus(wasIdle ? 'idle' : 'listening');
              };
              audio.play().catch(() => setStatus(wasIdle ? 'idle' : 'listening'));
            };
            playNext();
          }
        }
      })
      .catch(() => {});
    return () => {
      revoked = true;
      squareHoleLoopUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      squareHoleLoopUrlsRef.current = [];
      squareHoleAudioRef.current = null;
    };
  }, []);

  // Fetch and cache library count on load (for "how many people in the library") — same pattern as location
  useEffect(() => {
    const STORAGE_KEY = 'voice_assistant_library_count';
    const CACHE_MS = 2 * 60 * 1000; // 2 min
    const fetchCount = async () => {
      setLibraryCountLoading(true);
      try {
        const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (cached) {
          const { count, ts } = JSON.parse(cached) as { count: number; ts: number };
          if (typeof count === 'number' && count >= 0 && Date.now() - (ts || 0) < CACHE_MS) {
            setLibraryCount(count);
            setLibraryCountLoading(false);
            return;
          }
        }
        const result = await api.getLibraryCount();
        if ('count' in result && typeof result.count === 'number' && result.count >= 0) {
          setLibraryCount(result.count);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: result.count, ts: Date.now() }));
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore; library count is optional
      } finally {
        setLibraryCountLoading(false);
      }
    };
    fetchCount();
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then((u) => u?.email && setUserEmail(u.email))
      .catch(() => {});
  }, []);

  const sendToPipeline = useCallback(async (text: string) => {
    if (!text.trim()) return;
    interruptCurrentPlayback(currentPlayingRef);
    setError(null);

    const normalized = normalizeForMatch(text);
    if (isSquareHoleTrigger(normalized)) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text.trim() },
        { role: 'assistant', content: SQUARE_HOLE_RESPONSE },
      ]);
      setStatus('speaking');
      setLiveTranscript('');
      const urls = squareHoleLoopUrlsRef.current;
      if (urls.length >= 2) {
        let idx = 0;
        const playNext = () => {
          const url = urls[idx];
          idx = 1 - idx;
          const audio = new Audio(url);
          currentPlayingRef.current = { audio, url };
          audio.onended = () => {
            if (currentPlayingRef.current?.url === url) currentPlayingRef.current = null;
            playNext();
          };
          audio.onerror = () => {
            if (currentPlayingRef.current?.url === url) currentPlayingRef.current = null;
            setStatus('listening');
          };
          audio.play().catch(() => setStatus('listening'));
        };
        playNext();
      } else {
        setStatus('listening');
      }
      return;
    }

    setStatus('processing');
    const currentMessages = messagesRef.current;
    const voice = selectedVoiceRef.current;
    try {
      const loc = userLocationRef.current;
      const libCount = libraryCountRef.current;
      const response = await api.chatPipeline({
        text: text.trim(),
        messages: currentMessages,
        tts: true,
        voice,
        mode: 'assistant',
        source: 'voice-assistant',
        personality: DEFAULT_CLAUDE_HOME_PERSONALITY,
        ...(loc && { latitude: loc.lat, longitude: loc.lon }),
        ...(libCount != null && libCount >= 0 && { libraryCount: libCount }),
        ...(userEmail && { userEmail }),
      });
      const assistantContent = response.message || 'I didn’t get that.';
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text.trim() },
        { role: 'assistant', content: assistantContent },
      ]);
      if (response.audio_base64 && response.audio_format) {
        setStatus('speaking');
        setLiveTranscript(''); // clear so we don't show echoed TTS while ignoring mic
        await playBase64Audio(response.audio_base64, response.audio_format, currentPlayingRef);
      }
      setStatus('listening');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text.trim() },
        { role: 'assistant', content: `Error: ${msg}` },
      ]);
      setStatus('listening');
    }
  }, []);

  useEffect(() => {
    const Recognition = getSpeechRecognition();
    setHasRecognition(!!Recognition);
    if (!Recognition) {
      setStatus('error');
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      if (isPausedRef.current || isBusyRef.current) return;
      const awake = isAwakeRef.current;
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result[0]?.transcript || '').trim();
        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }
      const anyTranscript = (finalTranscript || interimTranscript).trim();
      if (anyTranscript) {
        lastTranscriptRef.current = finalTranscript || interimTranscript || lastTranscriptRef.current;
        setLiveTranscript(anyTranscript);
      } else {
        setLiveTranscript('');
      }
      // Final results: accumulate and send after user has paused (FINAL_SEND_DELAY_MS)
      if (finalTranscript.trim()) {
        const newPart = finalTranscript.trim();
        pendingFinalRef.current = (pendingFinalRef.current + ' ' + newPart).trim();
        if (interimDebounceRef.current) {
          clearTimeout(interimDebounceRef.current);
          interimDebounceRef.current = null;
        }
        if (finalSendTimeoutRef.current) {
          clearTimeout(finalSendTimeoutRef.current);
          finalSendTimeoutRef.current = null;
        }
        finalSendTimeoutRef.current = setTimeout(() => {
          finalSendTimeoutRef.current = null;
          const text = pendingFinalRef.current;
          pendingFinalRef.current = '';
          if (!text) return;
          if (!awake) {
            if (isWakePhrase(text, DEFAULT_WAKE_PHRASE)) {
              setIsAwake(true);
              setHasWokenOnce(true);
              const afterWake = stripWakePhrase(text, DEFAULT_WAKE_PHRASE);
              if (afterWake && !isLikelyNoise(afterWake)) sendToPipeline(afterWake);
            } else if (hasWokenOnceRef.current) {
              setIsAwake(true);
              if (!isLikelyNoise(text)) sendToPipeline(text);
            }
            setLiveTranscript('');
            lastTranscriptRef.current = '';
            return;
          }
          if (isSleepPhrase(text, DEFAULT_SLEEP_PHRASE)) {
            setIsAwake(false);
            setLiveTranscript('');
            lastTranscriptRef.current = '';
            return;
          }
          if (isLikelyNoise(text)) {
            setLiveTranscript('');
            lastTranscriptRef.current = '';
            return;
          }
          sendToPipeline(text);
          setLiveTranscript('');
          lastTranscriptRef.current = '';
        }, FINAL_SEND_DELAY_MS);
        return;
      }
      // Interim only: update live display; do not send to pipeline (reduces random sends when it can't hear clearly)
      if (interimTranscript.trim()) {
        if (interimDebounceRef.current) clearTimeout(interimDebounceRef.current);
        interimDebounceRef.current = setTimeout(() => {
          interimDebounceRef.current = null;
          setLiveTranscript('');
          lastTranscriptRef.current = '';
        }, INTERIM_CLEAR_MS);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed') {
        setStatus('idle');
        setError(
          'Microphone access was denied. Allow the mic for this site (click the lock or icon in the address bar → Site settings → Microphone → Allow), then click Start listening again.'
        );
        return;
      }
      setError(`Recognition: ${event.error}`);
    };

    recognition.onend = () => {
      if (!isPausedRef.current) {
        try {
          recognition.start();
        } catch {
          // already started or stopped
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (interimDebounceRef.current) {
        clearTimeout(interimDebounceRef.current);
        interimDebounceRef.current = null;
      }
      if (finalSendTimeoutRef.current) {
        clearTimeout(finalSendTimeoutRef.current);
        finalSendTimeoutRef.current = null;
      }
      pendingFinalRef.current = '';
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [sendToPipeline]);

  // Reserved for future "Request microphone" button
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const requestMic = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicAllowed(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setError(
          'Microphone blocked. Use the lock icon in the address bar → Site settings → set Microphone to Allow, then reload and click again.'
        );
      } else if (msg.includes('secure') || msg.includes('SecureContext')) {
        setError('Chrome needs a secure page. Use http://localhost:3000 or HTTPS.');
      } else {
        setError(`Microphone error: ${msg}`);
      }
      return false;
    }
  }, []);

  const startListening = useCallback(async () => {
    let rec = recognitionRef.current;
    if (!rec) {
      // Ref may not be set yet (e.g. Strict Mode); retry once after a tick
      await new Promise((r) => setTimeout(r, 50));
      rec = recognitionRef.current;
    }
    if (!rec) {
      setError('Voice recognition not ready. Refresh the page and try again.');
      return;
    }
    setError(null);
    // Request mic in the same user gesture as the click so the browser shows the permission prompt
    if (!micAllowed) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setMicAllowed(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
          setError('Microphone blocked. Use the lock icon → Site settings → Microphone → Allow, then click again.');
        } else if (msg.includes('secure') || msg.includes('SecureContext')) {
          setError('Use http://localhost:3000 or HTTPS for the microphone.');
        } else {
          setError(`Microphone error: ${msg}`);
        }
        return;
      }
    }
    setIsPaused(false);
    setStatus('listening');
    setIsAwake(false);
    setHasWokenOnce(false);
    try {
      rec.start();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const alreadyStarted = msg && /already started/i.test(String(msg));
      if (alreadyStarted) {
        // Already running; keep UI in listening state
        setStatus('listening');
      } else {
        setStatus('idle');
        setError(msg ? `Could not start listening: ${msg}` : 'Could not start listening. Try again.');
      }
    }
  }, [micAllowed]);

  const stopListening = useCallback(() => {
    setIsPaused(true);
    setStatus('idle');
    setLiveTranscript('');
    if (finalSendTimeoutRef.current) {
      clearTimeout(finalSendTimeoutRef.current);
      finalSendTimeoutRef.current = null;
    }
    pendingFinalRef.current = '';
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const isActive = status === 'listening' || status === 'processing' || status === 'speaking';
  const isListening = status === 'listening';

  return (
    <DashboardShell>
    <div className="min-h-screen bg-background-dark text-slate-100 flex flex-col -m-6 sm:-m-8">
      <header className="flex items-center justify-between px-6 py-4 border-b border-primary/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <span className="material-symbols-outlined text-primary text-2xl">graphic_eq</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">Claude Home™</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative px-4 py-8">
        {/* Central visualizer + mascot (clickable to start/stop) */}
        <div className="relative w-full max-w-2xl aspect-square flex items-center justify-center">
          <div className="absolute w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute w-[400px] h-[400px] jagged-visualizer opacity-30 animate-pulse scale-110" />
          <div className="absolute w-[360px] h-[360px] jagged-visualizer opacity-60 rotate-45 scale-105" />
          <button
            type="button"
            onClick={hasRecognition ? (isListening ? stopListening : startListening) : undefined}
            disabled={!hasRecognition}
            className="relative z-10 w-64 h-64 flex items-center justify-center rounded-full border-8 border-primary bg-slate-900 shadow-2xl shadow-primary/20 overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-105 active:scale-95"
          >
            {isActive && <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-primary" style={{ animationDuration: '1.5s' }} />}
            <div className="flex flex-col items-center justify-center">
              <div className="flex gap-12 mt-8">
                <div className="w-12 h-16 bg-primary rounded-full relative overflow-hidden">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-950 rounded-full" />
                </div>
                <div className="w-12 h-16 bg-primary rounded-full relative overflow-hidden">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-950 rounded-full" />
                </div>
              </div>
              <div className="w-16 h-1 bg-primary/60 rounded-full mt-10" />
            </div>
          </button>
        </div>

        <div className="text-center mt-8 mb-6">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
            {isListening && 'Listening... and '}
            <span className={isListening ? 'text-accent-pink' : 'text-slate-400'}>{isListening ? 'judging your accent.' : status === 'processing' ? 'Thinking...' : status === 'speaking' ? 'Speaking...' : status === 'error' ? 'Something went wrong.' : hasRecognition ? `Say "${DEFAULT_WAKE_PHRASE}" to start` : 'Voice not supported'}</span>
          </h2>
          <p className="text-slate-500 text-lg">Speak clearly, I&apos;m already losing patience.</p>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm max-w-md text-center">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button
            type="button"
            onClick={stopListening}
            disabled={!hasRecognition || status === 'idle'}
            className="flex-1 h-14 rounded-xl bg-accent-pink text-white font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-accent-pink/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">volume_off</span>
            Stop Yelling
          </button>
          <a
            href="/dashboard"
            className="flex-1 h-14 rounded-xl bg-primary text-background-dark font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">logout</span>
            Peace Out
          </a>
        </div>

        {/* Conversation area */}
        <div className="mt-10 w-full max-w-2xl rounded-2xl border border-primary/10 bg-surface-dark/30 overflow-hidden flex flex-col" style={{ minHeight: '200px', maxHeight: '40vh' }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-primary/10 bg-surface-dark/50 shrink-0">
            <span className="text-sm font-medium text-slate-400">Chat</span>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span>Voice</span>
              <select
                id="voice"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="bg-primary/5 border border-primary/20 rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {VOICES.map((v) => (
                  <option key={v} value={v} className="bg-background-dark">{v}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.length === 0 && !liveTranscript && (
              <p className="text-slate-500 text-sm text-center py-6">Say &quot;{DEFAULT_WAKE_PHRASE}&quot; then ask anything.</p>
            )}
            {liveTranscript && (
              <div className="flex justify-end">
                <p className="text-slate-400 text-sm italic">&quot;{liveTranscript}&quot;</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-primary/10 border border-primary/20 text-slate-100' : 'bg-background-dark/50 border border-border-dark text-slate-300'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      <footer className="glass-effect px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-xs font-mono text-primary">Claude-Snark-v3</span>
          <span className="text-slate-500 text-sm">|</span>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-slate-500'}`} />
            {isActive ? 'System Live' : 'Idle'}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {userLocation && <span>Location on</span>}
          {locationError && <span>Location off</span>}
          {libraryCount != null && !libraryCountLoading && <span>Library: {libraryCount}</span>}
          {!hasRecognition && <span className="text-amber-400/80">Use Chrome or Edge for voice</span>}
        </div>
      </footer>
    </div>
    </DashboardShell>
  );
}
