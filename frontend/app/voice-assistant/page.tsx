'use client';

import { useState, useRef, useEffect, useCallback, type MutableRefObject } from 'react';
import Navbar from '@/components/Navbar';
import { api } from '@/lib/api';

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

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
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

  const sendToPipeline = useCallback(async (text: string) => {
    if (!text.trim()) return;
    interruptCurrentPlayback(currentPlayingRef);
    setStatus('processing');
    setError(null);
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

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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
    <div className="min-h-screen bg-[#08050c] text-white bg-dot-grid">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-6 pb-12">
        {/* Hero */}
        <header className="text-center mb-8">
          <h1 className="font-heading text-3xl font-bold text-white tracking-tight">Voice Assistant</h1>
          <p className="text-white/50 text-sm mt-1.5">
            Say &quot;{DEFAULT_WAKE_PHRASE}&quot; to start · &quot;{DEFAULT_SLEEP_PHRASE}&quot; to end
          </p>
        </header>

        {/* Voice orb + controls */}
        <div className="flex flex-col items-center mb-8">
          <button
            type="button"
            onClick={hasRecognition ? (isListening ? stopListening : startListening) : undefined}
            disabled={!hasRecognition}
            className={`
              relative w-32 h-32 rounded-full flex items-center justify-center
              transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2 focus:ring-offset-[#08050c]
              ${status === 'idle' && hasRecognition
                ? 'bg-[#ff6b35] hover:bg-[#ff8555] shadow-lg shadow-[#ff6b35]/25 hover:shadow-[#ff6b35]/40 hover:scale-105'
                : isActive
                  ? 'bg-[#ff6b35]/90 shadow-lg shadow-[#ff6b35]/30 scale-105'
                  : 'bg-white/10 cursor-not-allowed'
              }
            `}
          >
            {isActive && (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-30 bg-[#ff6b35]"
                style={{ animationDuration: '1.5s' }}
              />
            )}
            <svg
              className={`relative w-12 h-12 text-white ${status === 'processing' || status === 'speaking' ? 'animate-pulse' : ''}`}
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 2.97 2.96 5.21 5.91 5.21s5.42-2.24 5.91-5.21c.09-.6-.39-1.14-1-1.14z" />
            </svg>
          </button>

          <p className="mt-4 text-sm text-white/60 min-h-[20px]">
            {status === 'idle' && hasRecognition && 'Tap to start · Microphone access required'}
            {status === 'idle' && !hasRecognition && 'Voice not supported in this browser'}
            {isListening && !isAwake && 'Listening for wake word…'}
            {isListening && isAwake && 'Listening…'}
            {status === 'processing' && 'Thinking…'}
            {status === 'speaking' && 'Speaking…'}
            {status === 'error' && 'Something went wrong'}
          </p>

          <div className="mt-4 flex items-center gap-4">
            {hasRecognition && status !== 'idle' && (
              <button
                type="button"
                onClick={stopListening}
                className="text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                Pause
              </button>
            )}
            <label className="flex items-center gap-2 text-xs text-white/50">
              <span>Voice</span>
              <select
                id="voice"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/90 text-xs focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
              >
                {VOICES.map((v) => (
                  <option key={v} value={v} className="bg-[#0f0b14]">{v}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-sm">
            <p>{error}</p>
            {error.includes('denied') && (
              <p className="text-white/50 text-xs mt-2">
                Allow the microphone in your browser, then tap the button again.
              </p>
            )}
          </div>
        )}

        {/* Conversation */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden flex flex-col shadow-xl" style={{ minHeight: '320px' }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar" style={{ maxHeight: '50vh' }}>
            {messages.length === 0 && !liveTranscript && (
              <p className="text-white/40 text-sm text-center py-8">
                Say &quot;{DEFAULT_WAKE_PHRASE}&quot; then ask anything — weather, news, or search.
              </p>
            )}
            {liveTranscript && (
              <div className="flex justify-end">
                <p className="text-white/50 text-sm italic max-w-[85%]">&quot;{liveTranscript}&quot;</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-[#ff6b35]/15 border border-[#ff6b35]/20 text-white'
                      : 'bg-white/5 border border-white/10 text-white/90'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Footer context */}
        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/40">
          {userLocation && <span>Location on</span>}
          {locationError && <span>Location off</span>}
          {libraryCount != null && !libraryCountLoading && (
            <span>Library: {libraryCount} here</span>
          )}
          {!hasRecognition && (
            <span className="text-amber-400/80">Use Chrome or Edge for voice</span>
          )}
        </footer>
      </div>
    </div>
  );
}
