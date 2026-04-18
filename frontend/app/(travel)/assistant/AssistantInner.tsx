'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { LOCKTON_TRAVEL_PERSONALITY } from '@/lib/travelAssistant';
import { useTravelAuth } from '@/components/travel/useTravelAuth';

type Msg = { role: 'user' | 'assistant'; content: string; ttsError?: string };

function pickRecorderMime(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

/** Pause in speech (ms) before we stop the recorder. */
const VAD_SILENCE_MS = 1400;
/** RMS above this counts as “speaking” (time-domain, normalized). */
const VAD_LOUD_RMS = 0.02;
/** Don’t end on silence until the user has spoken at least once. */
const VAD_MIN_SPEECH_MS = 350;
/** Minimum time recording before silence can end the clip (avoids instant stop). */
const VAD_MIN_RECORD_MS = 450;
const VAD_MAX_RECORD_MS = 120_000;

const QUICK = [
  { label: 'Suggest destinations', text: 'Suggest 3 US cities good for a 2-day client meeting this quarter, with a sentence each on why.' },
  { label: 'Estimate costs', text: 'Give a rough per-day cost band (flight + hotel + meals) for a domestic client trip, as estimates only.' },
  { label: 'Check policy', text: 'What kinds of things should I double-check in a typical corporate travel policy before booking?' },
];

export default function AssistantInner() {
  const { user, loading } = useTravelAuth();
  const search = useSearchParams();
  const topic = search.get('topic');
  const memoryDone = useRef(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Hi — I’m your travel copilot. Ask anything about destinations, rough costs, or how to stay policy-smart. Quick actions below.',
    },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef('');
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {});
  const vadRafRef = useRef<number | null>(null);
  const vadAudioContextRef = useRef<AudioContext | null>(null);
  const speechStartMsRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    if (topic !== 'memory' || memoryDone.current) return;
    memoryDone.current = true;
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        content:
          'Share a few bullet points about your trip (or paste a draft). I can suggest LinkedIn and Instagram captions — you can copy them into your post builder.',
      },
    ]);
  }, [topic]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopPlayback = useCallback(() => {
    const a = playbackRef.current;
    if (a) {
      a.pause();
      const src = a.src;
      if (src.startsWith('blob:')) URL.revokeObjectURL(src);
      playbackRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (vadRafRef.current != null) {
        cancelAnimationFrame(vadRafRef.current);
        vadRafRef.current = null;
      }
      void vadAudioContextRef.current?.close().catch(() => {});
      vadAudioContextRef.current = null;
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      isRecordingRef.current = false;
    };
  }, [stopPlayback]);

  const playPipelineAudio = useCallback(
    (base64: string, format: 'mp3' | 'wav') => {
      stopPlayback();
      const mime = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      const audio = new Audio(`data:${mime};base64,${base64}`);
      playbackRef.current = audio;
      audio.onended = () => {
        if (playbackRef.current === audio) playbackRef.current = null;
      };
      void audio.play().catch(() => {});
    },
    [stopPlayback]
  );

  const speakAssistantText = useCallback(
    async (text: string, messageIndex: number) => {
      const plain = text.trim().slice(0, 4096);
      if (!plain) return;
      setSpeakingIndex(messageIndex);
      stopPlayback();
      try {
        const blob = await api.generateVoice({ text: plain, provider: 'openai', voice: 'coral' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        playbackRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (playbackRef.current === audio) playbackRef.current = null;
          setSpeakingIndex(null);
        };
        try {
          await audio.play();
        } catch {
          URL.revokeObjectURL(url);
          setSpeakingIndex(null);
        }
      } catch {
        setSpeakingIndex(null);
      }
    },
    [stopPlayback]
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggleMic = useCallback(async () => {
    if (pending || isTranscribing) return;
    if (isRecordingRef.current) {
      stopRecording();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErr('Microphone is not available in this browser.');
      return;
    }
    try {
      setErr(null);
      speechStartMsRef.current = null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      const mime = pickRecorderMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        if (vadRafRef.current != null) {
          cancelAnimationFrame(vadRafRef.current);
          vadRafRef.current = null;
        }
        void vadAudioContextRef.current?.close().catch(() => {});
        vadAudioContextRef.current = null;

        stream.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        mediaRecorderRef.current = null;
        isRecordingRef.current = false;
        setIsRecording(false);
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        recordChunksRef.current = [];
        if (blob.size < 200) return;
        const ext = (mr.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `speech.${ext}`, { type: blob.type || `audio/${ext}` });
        setIsTranscribing(true);
        void (async () => {
          try {
            const { text } = await api.transcribeAudio(file);
            const t = (text || '').trim();
            if (!t) return;
            const combined = [inputRef.current.trim(), t].filter(Boolean).join(' ').trim();
            if (combined) await sendRef.current(combined);
          } catch {
            setErr('Could not transcribe audio. Check the backend and try again.');
          } finally {
            setIsTranscribing(false);
          }
        })();
      };
      mr.start(250);
      isRecordingRef.current = true;
      setIsRecording(true);

      const ACtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (ACtx) {
        try {
          const audioCtx = new ACtx();
          vadAudioContextRef.current = audioCtx;
          if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.88;
          source.connect(analyser);
          const buf = new Uint8Array(analyser.fftSize);
          const recordStarted = performance.now();
          let lastLoudAt = performance.now();
          let heardSpeech = false;

          const tick = () => {
            if (!isRecordingRef.current) return;
            const now = performance.now();
            if (now - recordStarted >= VAD_MAX_RECORD_MS) {
              if (vadRafRef.current != null) {
                cancelAnimationFrame(vadRafRef.current);
                vadRafRef.current = null;
              }
              stopRecording();
              return;
            }
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i]! - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            if (rms >= VAD_LOUD_RMS) {
              heardSpeech = true;
              lastLoudAt = now;
              if (speechStartMsRef.current == null) speechStartMsRef.current = now;
            }
            const speechMs =
              speechStartMsRef.current != null ? now - speechStartMsRef.current : 0;
            const canEndOnSilence =
              heardSpeech &&
              speechMs >= VAD_MIN_SPEECH_MS &&
              now - recordStarted >= VAD_MIN_RECORD_MS &&
              now - lastLoudAt >= VAD_SILENCE_MS;
            if (canEndOnSilence) {
              if (vadRafRef.current != null) {
                cancelAnimationFrame(vadRafRef.current);
                vadRafRef.current = null;
              }
              stopRecording();
              return;
            }
            vadRafRef.current = requestAnimationFrame(tick);
          };
          vadRafRef.current = requestAnimationFrame(tick);
        } catch {
          vadAudioContextRef.current = null;
        }
      }
    } catch {
      setErr('Microphone permission was denied or unavailable.');
    }
  }, [pending, isTranscribing, stopRecording]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;
      setErr(null);
      stopPlayback();
      setSpeakingIndex(null);
      setPending(true);
      const nextUser: Msg = { role: 'user', content: trimmed };
      setMessages((prev) => [...prev, nextUser]);
      setInput('');

      const priorForPipeline = [...messages, nextUser].slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const result = await api.chatPipeline({
          text: trimmed,
          messages: priorForPipeline,
          mode: 'assistant',
          personality: LOCKTON_TRAVEL_PERSONALITY,
          userEmail: user?.email,
          userId: user?.sub,
          tts: ttsEnabled,
          voice: 'coral',
          tts_provider: 'openai',
        });
        const reply = result.message || 'No response.';
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: reply, ttsError: result.tts_error },
        ]);
        if (ttsEnabled && result.audio_base64 && result.audio_format) {
          playPipelineAudio(result.audio_base64, result.audio_format);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Request failed');
        setMessages((prev) => prev.slice(0, -1));
        setInput(trimmed);
      } finally {
        setPending(false);
      }
    },
    [messages, pending, user, ttsEnabled, stopPlayback, playPipelineAudio]
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  return (
    <div className="mx-auto flex min-h-[68vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">AI assistant</h2>
        <p className="mt-1 text-xs text-travel-muted">Powered by your existing chat pipeline (estimates only).</p>
      </div>
      <div className="border-b border-gray-100 bg-gray-50/80 px-5 py-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick actions</div>
        <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => send(q.text)}
            disabled={pending}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            {q.label}
          </button>
        ))}
      </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`w-fit max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'ml-auto rounded-tr-md bg-gray-900 text-white'
                : 'mr-auto rounded-tl-md border border-gray-100 bg-white text-gray-800 shadow-sm'
            }`}
          >
            {m.role === 'assistant' ? (
              <div className="flex items-start gap-2">
                <p className="whitespace-pre-wrap flex-1 min-w-0">{m.content}</p>
                {m.content.trim().length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void speakAssistantText(m.content, i)}
                    disabled={speakingIndex === i || pending}
                    className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:opacity-40"
                    aria-label="Play message as speech"
                    title="Text to speech"
                  >
                    {speakingIndex === i ? (
                      <span className="block h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                      </svg>
                    )}
                  </button>
                ) : null}
              </div>
            ) : (
              m.content
            )}
            {m.role === 'assistant' && m.ttsError ? (
              <p className="text-xs text-amber-800 mt-2">{m.ttsError}</p>
            ) : null}
          </div>
        ))}
        {isRecording ? (
          <div className="mr-auto rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            Listening… pause when you’re done — it will transcribe and send. Tap the mic to stop early.
          </div>
        ) : null}
        {(pending || isTranscribing) && (
          <div className="mr-auto rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-travel-muted">
            {isTranscribing && !pending ? 'Transcribing speech…' : 'Thinking…'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {err ? <p className="px-5 pt-2 text-xs text-red-700">{err}</p> : null}
      <form
        className="flex flex-col gap-3 border-t border-gray-100 bg-white px-4 pb-4 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex flex-wrap items-center gap-2 px-1">
          <button
            type="button"
            aria-pressed={ttsEnabled}
            onClick={() => setTtsEnabled((v) => !v)}
            disabled={pending}
            title={ttsEnabled ? 'Turn off automatic read-aloud' : 'Read each new reply aloud automatically'}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-colors ${
              ttsEnabled
                ? 'border-blue-300 bg-blue-100 text-blue-900'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            } disabled:opacity-50 shadow-sm`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
            Auto-read replies
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2">
          <button
            type="button"
            onClick={() => void toggleMic()}
            className={`shrink-0 p-2.5 rounded-xl border transition-colors ${
              isRecording
                ? 'border-red-300 bg-red-50 text-red-800 ring-2 ring-red-200 animate-pulse'
                : 'border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50'
            } disabled:opacity-50`}
            aria-label={isRecording ? 'Stop recording now' : 'Voice: speak, pause to auto-send, or tap again to stop'}
            title={
              isRecording
                ? 'Tap to stop now (otherwise we stop after you pause speaking)'
                : 'Speak your question; we stop when you pause, then transcribe and send'
            }
            disabled={pending || isTranscribing}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about trips, policy, or costs…"
            disabled={pending || isTranscribing || isRecording}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || isTranscribing || !input.trim()}
            className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? '…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
