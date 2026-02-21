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

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

function getSpeechRecognition(): typeof SpeechRecognition | null {
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
  const [wakePhrase, setWakePhrase] = useState(DEFAULT_WAKE_PHRASE);
  const [sleepPhrase, setSleepPhrase] = useState(DEFAULT_SLEEP_PHRASE);
  const [personality, setPersonality] = useState(DEFAULT_CLAUDE_HOME_PERSONALITY);
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [testSearchLoading, setTestSearchLoading] = useState(false);
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isBusyRef = useRef(false);
  const isPausedRef = useRef(false);
  const isAwakeRef = useRef(false);
  const hasWokenOnceRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const selectedVoiceRef = useRef(selectedVoice);
  const wakePhraseRef = useRef(DEFAULT_WAKE_PHRASE);
  const sleepPhraseRef = useRef(DEFAULT_SLEEP_PHRASE);
  const personalityRef = useRef('');
  const interimDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef('');
  const currentPlayingRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const INTERIM_CLEAR_MS = 2000; // clear "Hearing..." after silence

  messagesRef.current = messages;
  isPausedRef.current = isPaused;
  isAwakeRef.current = isAwake;
  hasWokenOnceRef.current = hasWokenOnce;
  selectedVoiceRef.current = selectedVoice;
  wakePhraseRef.current = wakePhrase;
  sleepPhraseRef.current = sleepPhrase;
  personalityRef.current = personality;
  isBusyRef.current = status === 'processing' || status === 'speaking'; // ignore mic input while thinking or while TTS is playing (avoid hearing assistant output)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendToPipeline = useCallback(async (text: string) => {
    if (!text.trim()) return;
    interruptCurrentPlayback(currentPlayingRef);
    setStatus('processing');
    setError(null);
    const currentMessages = messagesRef.current;
    const voice = selectedVoiceRef.current;
    try {
      const response = await api.chatPipeline({
        text: text.trim(),
        messages: currentMessages,
        tts: true,
        voice,
        mode: 'assistant',
        personality: personalityRef.current.trim() || undefined,
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

  const handleTestSearch = useCallback(async () => {
    const q = testSearchQuery.trim();
    if (!q) return;
    setTestSearchLoading(true);
    setError(null);
    try {
      await sendToPipeline(q);
      setTestSearchQuery('');
    } catch {
      // error already set by sendToPipeline
    } finally {
      setTestSearchLoading(false);
    }
  }, [testSearchQuery, sendToPipeline]);

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
      const wake = wakePhraseRef.current;
      const sleep = sleepPhraseRef.current;
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
      // Only act on final results — never send from interim to avoid random/noise sends
      if (finalTranscript.trim()) {
        const text = finalTranscript.trim();
        if (interimDebounceRef.current) {
          clearTimeout(interimDebounceRef.current);
          interimDebounceRef.current = null;
        }
        if (!awake) {
          if (isWakePhrase(text, wake)) {
            setIsAwake(true);
            setHasWokenOnce(true);
            const afterWake = stripWakePhrase(text, wake);
            if (afterWake && !isLikelyNoise(afterWake)) sendToPipeline(afterWake);
          } else if (hasWokenOnceRef.current) {
            // After first wake this session, any speech wakes again (no need to repeat wake phrase)
            setIsAwake(true);
            if (!isLikelyNoise(text)) sendToPipeline(text);
          }
          setLiveTranscript('');
          lastTranscriptRef.current = '';
          return;
        }
        if (isSleepPhrase(text, sleep)) {
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
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [sendToPipeline]);

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
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0E1117] text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* One-click entry: runs Start listening logic so browser will show mic prompt (requires user gesture) */}
        {status === 'idle' && hasRecognition && (
          <button
            type="button"
            onClick={startListening}
            className="w-full mb-6 py-6 rounded-xl border-2 border-[#4F8CFF]/50 bg-[#4F8CFF]/20 text-white font-medium text-lg hover:bg-[#4F8CFF]/30 hover:border-[#4F8CFF]/70 transition-colors focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]"
          >
            Click to start listening — browser will ask for microphone access
          </button>
        )}
        <h1 className="text-2xl font-bold text-white mb-1">AI Voice Assistant</h1>
        <p className="text-gray-400 text-sm mb-4">
          Click the button above to start. Allow the microphone when prompted. Then the assistant listens for <strong className="text-gray-300">&quot;{wakePhrase}&quot;</strong> — say it to wake, then speak. Say <strong className="text-gray-300">&quot;{sleepPhrase}&quot;</strong> to put it back to sleep. It can search the web for weather, news, and more.
        </p>

        <details className="mb-4 text-sm text-gray-500 border border-white/10 rounded-lg bg-white/5">
          <summary className="px-4 py-2 cursor-pointer hover:text-gray-400 select-none">
            Personality &amp; prompt
          </summary>
          <div className="px-4 py-3 space-y-3 text-gray-400">
            <p className="text-gray-300">Optional: add instructions to change how the assistant responds (e.g. funnier, sarcastic, formal). It can still search the web for weather and news.</p>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400 text-xs">Personality / custom prompt</span>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="e.g. Be funny and use dry humor. Keep replies short."
                rows={3}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-[#4F8CFF] resize-y min-h-[80px]"
              />
            </label>
          </div>
        </details>

        <details className="mb-4 text-sm text-gray-500 border border-white/10 rounded-lg bg-white/5">
          <summary className="px-4 py-2 cursor-pointer hover:text-gray-400 select-none">
            Wake word &amp; sleep word
          </summary>
          <div className="px-4 py-3 space-y-3 text-gray-400">
            <p className="text-gray-300">When <strong>asleep</strong>, the assistant only reacts to the wake phrase. When <strong>awake</strong>, it processes your speech and goes to sleep if you say the sleep phrase.</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-gray-400 text-xs">Wake phrase</span>
                <input
                  type="text"
                  value={wakePhrase}
                  onChange={(e) => setWakePhrase(e.target.value)}
                  placeholder={DEFAULT_WAKE_PHRASE}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-48 focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-400 text-xs">Sleep phrase</span>
                <input
                  type="text"
                  value={sleepPhrase}
                  onChange={(e) => setSleepPhrase(e.target.value)}
                  placeholder={DEFAULT_SLEEP_PHRASE}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-48 focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]"
                />
              </label>
            </div>
          </div>
        </details>

        <details className="mb-4 text-sm text-gray-500 border border-white/10 rounded-lg bg-white/5" open>
          <summary className="px-4 py-2 cursor-pointer hover:text-gray-400 select-none">
            Test web search
          </summary>
          <div className="px-4 py-3 space-y-3 text-gray-400">
            <p className="text-gray-300">Type a query below and click Search &amp; respond to run it through the assistant (same pipeline as voice). It will search the web when needed and reply using your personality.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={testSearchQuery}
                onChange={(e) => setTestSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
                placeholder="e.g. What's the weather in Lamoni? or current news"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]"
                disabled={testSearchLoading || status === 'processing' || status === 'speaking'}
              />
              <button
                type="button"
                onClick={handleTestSearch}
                disabled={testSearchLoading || status === 'processing' || status === 'speaking' || !testSearchQuery.trim()}
                className="px-4 py-2 rounded-lg bg-[#4F8CFF] text-white text-sm font-medium hover:bg-[#5A96FF] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]"
              >
                {testSearchLoading || status === 'processing' || status === 'speaking' ? 'Searching…' : 'Search & respond'}
              </button>
            </div>
            <p className="text-gray-500 text-xs">The response will appear in the conversation below and play as voice if the pipeline returns TTS.</p>
          </div>
        </details>

        {/* Status & controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
              status === 'listening'
                ? 'bg-[#4F8CFF]/20 border-[#4F8CFF]/50'
                : status === 'processing' || status === 'speaking'
                  ? 'bg-amber-500/20 border-amber-500/50'
                  : 'bg-white/5 border-white/10'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full ${
                status === 'listening'
                  ? 'bg-green-500 animate-pulse'
                  : status === 'processing' || status === 'speaking'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-gray-500'
              }`}
            />
            <span className="text-sm font-medium text-gray-200">
              {status === 'listening' && (isAwake ? 'Listening…' : 'Listening for wake word…')}
              {status === 'processing' && 'Thinking…'}
              {status === 'speaking' && 'Speaking…'}
              {status === 'idle' && (isPaused ? 'Paused' : 'Starting…')}
              {status === 'error' && 'Error'}
            </span>
          </div>
          {status === 'listening' && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
                isAwake ? 'bg-green-500/10 border-green-500/40 text-green-300' : 'bg-gray-500/20 border-gray-500/40 text-gray-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              {isAwake ? 'Awake' : 'Asleep'}
            </div>
          )}
          {hasRecognition && (
            <button
              type="button"
              onClick={status === 'listening' ? stopListening : startListening}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                status === 'listening'
                  ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                  : 'bg-[#4F8CFF] text-white hover:bg-[#5A96FF]'
              }`}
            >
              {status === 'listening' ? 'Pause listening' : 'Start listening'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="voice" className="text-sm text-gray-400">Voice</label>
            <select
              id="voice"
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]"
            >
              {VOICES.map((v) => (
                <option key={v} value={v} className="bg-[#0E1117]">{v}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm space-y-2">
            <p>{error}</p>
            {error.includes('denied') && (
              <p className="text-gray-400 text-xs mt-2">
                If you’re on localhost, the mic should work in Chrome/Edge. Make sure no other app is blocking the microphone and that your OS allows the browser to use it.
              </p>
            )}
          </div>
        )}

        {/* Conversation */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden flex flex-col" style={{ minHeight: '320px' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" style={{ maxHeight: '50vh' }}>
            {messages.length === 0 && !liveTranscript && (
              <p className="text-gray-500 text-sm">Say &quot;{wakePhrase}&quot; to wake the assistant, then speak. Say &quot;{sleepPhrase}&quot; to put it back to sleep.</p>
            )}
            {liveTranscript && (
              <p className="text-gray-400 text-sm italic">Hearing: &quot;{liveTranscript}&quot;</p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-[#4F8CFF]/20 border border-[#4F8CFF]/30'
                      : 'bg-white/5 border border-white/10 text-gray-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {!hasRecognition && (
          <p className="mt-4 text-amber-400/90 text-sm">
            Use Chrome or Edge for always-on voice. Safari and Firefox have limited support.
          </p>
        )}
      </div>
    </div>
  );
}
