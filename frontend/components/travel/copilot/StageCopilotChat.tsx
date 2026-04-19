'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useTravelStage } from '@/lib/travelContext';
import type { TravelStageId } from '@/lib/travelTypes';
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Mic,
  Volume2,
  Plus,
  X,
} from 'lucide-react';
import {
  buildCopilotAttachmentPayload,
  isAllowedCopilotAttachment,
  isChatImageFile,
} from '@/lib/extractTravelFileText';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Filenames attached with this user message (display only). */
  attachmentNames?: string[];
  meta?: {
    nextStep?: string;
    intent?: string;
    sourcesUsed?: Array<{ sourceType: string; label: string }>;
  };
}

interface StageConfig {
  label: string;
  tagline: string;
  color: string;
  bgColor: string;
  borderColor: string;
  quickPrompts: Array<{ label: string; prompt: string }>;
}

const STAGE_CONFIG: Record<TravelStageId, StageConfig> = {
  plan: {
    label: 'Planning',
    tagline: "I've read your documents. Ask me anything about your trip.",
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    quickPrompts: [
      { label: 'Summarize my trip', prompt: 'Give me a plain-language summary of my trip based on my uploaded documents.' },
      { label: 'Visa requirements', prompt: 'What visa or travel documents do I need for this trip? Be specific about each destination.' },
      { label: 'Generate checklist', prompt: 'Generate a pre-trip checklist for me based on my itinerary.' },
      { label: 'Booking options', prompt: 'What are my best 2-3 booking options for this trip? Compare cost vs flexibility tradeoffs.' },
      { label: 'What could go wrong?', prompt: 'What are the main risks or things I should watch out for on this trip?' },
    ],
  },
  approve: {
    label: 'Approval',
    tagline: 'Let me guide you through the approval process.',
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    quickPrompts: [
      { label: 'Why approval needed?', prompt: 'Why does this trip need manager approval? Explain the specific policy triggers.' },
      { label: 'Compliant alternative', prompt: 'Is there a more policy-compliant option for this trip that would still meet my needs?' },
      { label: 'Prepare request', prompt: 'Help me prepare a concise approval request with business justification.' },
      { label: 'Approval status', prompt: 'What is the current status of my approval and what are the next steps?' },
    ],
  },
  travel: {
    label: 'Traveling',
    tagline: "You're on the move. I'll keep it brief.",
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    quickPrompts: [
      { label: "What's next?", prompt: "What is my next step right now based on my itinerary?" },
      { label: 'Flight delayed', prompt: 'My flight is delayed. What are my options?' },
      { label: 'Contact info', prompt: 'Who should I contact if I have a travel emergency right now?' },
      { label: 'Gate / terminal', prompt: 'Where do I need to be right now based on my itinerary?' },
      { label: 'Coverage check', prompt: 'Is this travel disruption covered by my company policy?' },
    ],
  },
  return: {
    label: 'Return',
    tagline: "Welcome back. Let's close out your trip.",
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    quickPrompts: [
      { label: 'What do I still need to do?', prompt: 'What outstanding tasks do I still need to complete after my trip?' },
      { label: 'Summarize my trip', prompt: 'Give me a brief summary of my completed trip for my records.' },
      { label: 'Expense report tips', prompt: 'What should I include in my expense report from this trip? What is typically covered?' },
      { label: 'Close approvals', prompt: 'What approval or compliance items can be automatically closed now that my trip is complete?' },
    ],
  },
};

function pickRecorderMime(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

const VAD_SILENCE_MS = 1400;
const VAD_LOUD_RMS = 0.02;
const VAD_MIN_SPEECH_MS = 350;
const VAD_MIN_RECORD_MS = 450;
const VAD_MAX_RECORD_MS = 120_000;

const MAX_CHAT_ATTACHMENTS = 8;
const MAX_CHAT_IMAGES = 5;
const CHAT_ATTACHMENT_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

type PendingAttachment = { id: string; file: File };

function formatContent(content: string) {
  // Convert **bold** text and newlines to JSX
  const lines = content.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={lineIdx}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          }
          return <span key={i}>{part}</span>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

let msgCounter = 0;
function newId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

export default function StageCopilotChat() {
  const { stage } = useTravelStage();
  const config = STAGE_CONFIG[stage];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [incidentDetected, setIncidentDetected] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileAttachmentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef('');
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});
  const vadRafRef = useRef<number | null>(null);
  const vadAudioContextRef = useRef<AudioContext | null>(null);
  const speechStartMsRef = useRef<number | null>(null);
  /** Bumped on stage change so in-flight `MediaRecorder` `onstop` does not transcribe/send after reset. */
  const voiceEpochRef = useRef(0);

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
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

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

  const speakAssistantText = useCallback(
    async (messageId: string, text: string) => {
      const plain = text.trim().slice(0, 4096);
      if (!plain) return;
      setSpeakingId(messageId);
      stopPlayback();
      try {
        const blob = await api.generateVoice({ text: plain, provider: 'openai', voice: 'coral' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        playbackRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (playbackRef.current === audio) playbackRef.current = null;
          setSpeakingId(null);
        };
        try {
          await audio.play();
        } catch {
          URL.revokeObjectURL(url);
          setSpeakingId(null);
        }
      } catch {
        setSpeakingId(null);
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
    if (loading || isTranscribing) return;
    if (isRecordingRef.current) {
      stopRecording();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceErr('Microphone is not available in this browser.');
      return;
    }
    try {
      setVoiceErr(null);
      speechStartMsRef.current = null;
      const recEpoch = voiceEpochRef.current;
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
        if (recEpoch !== voiceEpochRef.current) return;
        const ext = (mr.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `speech.${ext}`, { type: blob.type || `audio/${ext}` });
        setIsTranscribing(true);
        void (async () => {
          try {
            if (recEpoch !== voiceEpochRef.current) return;
            const { text } = await api.transcribeAudio(file);
            if (recEpoch !== voiceEpochRef.current) return;
            const t = (text || '').trim();
            if (!t) return;
            const combined = [inputRef.current.trim(), t].filter(Boolean).join(' ').trim();
            if (combined) await sendMessageRef.current(combined);
          } catch {
            if (recEpoch === voiceEpochRef.current) {
              setVoiceErr('Could not transcribe audio. Check the backend and try again.');
            }
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
            const speechMs = speechStartMsRef.current != null ? now - speechStartMsRef.current : 0;
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
      setVoiceErr('Microphone permission was denied or unavailable.');
    }
  }, [loading, isTranscribing, stopRecording]);

  // Reset chat when stage changes
  useEffect(() => {
    voiceEpochRef.current += 1;
    stopPlayback();
    setSpeakingId(null);
    if (isRecordingRef.current) stopRecording();
    setMessages([]);
    setIncidentDetected(false);
    setVoiceErr(null);
    setPendingAttachments([]);
  }, [stage, stopPlayback, stopRecording]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onPickAttachmentFiles = useCallback((list: FileList | null) => {
    if (!list?.length) return;
    let pickErr: string | null = null;
    setPendingAttachments((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (next.length >= MAX_CHAT_ATTACHMENTS) break;
        if (!isAllowedCopilotAttachment(file)) {
          pickErr = `Unsupported: ${file.name}. Use PDF, PNG, JPEG, WebP, DOCX, or TXT.`;
          continue;
        }
        if (isChatImageFile(file)) {
          const nImg = next.filter((x) => isChatImageFile(x.file)).length;
          if (nImg >= MAX_CHAT_IMAGES) {
            pickErr = `At most ${MAX_CHAT_IMAGES} images per message.`;
            continue;
          }
        }
        next.push({ id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, file });
      }
      return next;
    });
    setVoiceErr(pickErr);
    if (fileAttachmentInputRef.current) fileAttachmentInputRef.current.value = '';
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg = text.trim();
      const atts = [...pendingAttachmentsRef.current];
      if ((!userMsg && atts.length === 0) || loading) return;

      setVoiceErr(null);
      stopPlayback();
      setSpeakingId(null);
      setInput('');
      setPendingAttachments([]);
      setLoading(true);

      const attachmentNames = atts.map((a) => a.file.name);
      const displayContent =
        userMsg ||
        (attachmentNames.length
          ? `Attached: ${attachmentNames.join(', ')}`
          : '');

      const userMessage: Message = {
        id: newId(),
        role: 'user',
        content: displayContent,
        timestamp: new Date(),
        ...(attachmentNames.length ? { attachmentNames } : {}),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

        let attachmentPayload: { attachmentContext?: string; images?: string[] } = {};
        if (atts.length > 0) {
          attachmentPayload = await buildCopilotAttachmentPayload(atts, {
            maxImages: MAX_CHAT_IMAGES,
            maxTextChars: 26000,
          });
          if (!attachmentPayload.attachmentContext && !attachmentPayload.images?.length) {
            throw new Error(
              'Could not read text or images from those files. Try another file or add a short message.'
            );
          }
        }

        const result = await api.chatCopilot({
          message: userMsg,
          assistantMode: 'trip_companion',
          travelStage: stage,
          messages: history,
          ...attachmentPayload,
        });

        const reply = result.reply || 'Sorry, I could not generate a response.';
        const meta: Message['meta'] = {};
        if (result.nextStep?.trim()) meta.nextStep = result.nextStep.trim();
        if (result.intent?.intent) meta.intent = result.intent.intent;
        if (result.sourcesUsed?.length) {
          meta.sourcesUsed = result.sourcesUsed.slice(0, 3).map((source) => ({
            sourceType: source.sourceType,
            label: source.label,
          }));
        }
        const assistantMessage: Message = {
          id: newId(),
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
          ...(Object.keys(meta).length > 0 ? { meta } : {}),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (result.incidentDetected) {
          setIncidentDetected(true);
        }

        if (ttsEnabled && reply.trim()) {
          try {
            const blob = await api.generateVoice({
              text: reply.trim().slice(0, 4096),
              provider: 'openai',
              voice: 'coral',
            });
            const url = URL.createObjectURL(blob);
            stopPlayback();
            const audio = new Audio(url);
            playbackRef.current = audio;
            audio.onended = () => {
              URL.revokeObjectURL(url);
              if (playbackRef.current === audio) playbackRef.current = null;
            };
            void audio.play().catch(() => {
              URL.revokeObjectURL(url);
            });
          } catch {
            /* ignore TTS failure */
          }
        }
      } catch (err) {
        setPendingAttachments(atts);
        setInput(userMsg);
        const errMsg: Message = {
          id: newId(),
          role: 'assistant',
          content: `I'm having trouble connecting right now. Please check your connection and try again.\n\n${err instanceof Error ? err.message : ''}`,
          timestamp: new Date(),
        };
        setMessages((prev) => {
          const tail = prev[prev.length - 1];
          const base = tail?.role === 'user' ? prev.slice(0, -1) : prev;
          return [...base, errMsg];
        });
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, stage, ttsEnabled, stopPlayback]
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className={`px-4 py-3 ${config.bgColor} border-b ${config.borderColor} shrink-0`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <Sparkles className={`w-4 h-4 ${config.color}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              TripReady Copilot
              <span className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded-md bg-white/60 ${config.color}`}>
                {config.label}
              </span>
            </p>
            <p className="text-xs text-gray-600">{config.tagline}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className={`rounded-2xl ${config.bgColor} border ${config.borderColor} p-4`}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className={`w-3.5 h-3.5 ${config.color}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {stage === 'plan' && (
                      <>
                        Hi! I&apos;m your TripReady Copilot. If you&apos;ve uploaded your travel itinerary, I can answer questions about your destinations, visa requirements, and what you need to prepare. Try one of the quick prompts below, or ask me anything.
                      </>
                    )}
                    {stage === 'approve' && (
                      <>
                        I&apos;ll help you navigate the approval process. I can explain what triggers approval, draft a business justification, and suggest compliant alternatives. What do you need help with?
                      </>
                    )}
                    {stage === 'travel' && (
                      <>
                        You&apos;re on the move. I&apos;ll keep answers short and focused on your immediate next step. Report disruptions, ask for contact info, or check what&apos;s covered by policy.
                      </>
                    )}
                    {stage === 'return' && (
                      <>
                        Welcome back! Let&apos;s close out your trip. I can help you with your expense report, outstanding tasks, and anything else that needs to be wrapped up.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick prompts */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quick prompts</p>
              <div className="space-y-1.5">
                {config.quickPrompts.map((qp) => (
                  <button
                    key={qp.label}
                    type="button"
                    onClick={() => void sendMessage(qp.prompt)}
                    disabled={loading || isTranscribing || isRecording}
                    className="w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-sm text-gray-700 transition-colors group disabled:opacity-50"
                  >
                    <span>{qp.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white'
                  : `bg-white border border-gray-200 ${config.color}`
              }`}
            >
              {msg.role === 'user' ? (
                <User className="w-3.5 h-3.5" />
              ) : (
                <Bot className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="max-w-[85%]">
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gray-900 text-white rounded-tr-sm'
                    : `bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm`
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">{formatContent(msg.content)}</div>
                    {msg.content.trim().length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void speakAssistantText(msg.id, msg.content)}
                        disabled={speakingId === msg.id || loading}
                        className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-sky-600 disabled:opacity-40"
                        aria-label="Play message as speech"
                        title="Read aloud"
                      >
                        {speakingId === msg.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {formatContent(msg.content)}
                    {msg.role === 'user' &&
                    msg.attachmentNames &&
                    msg.attachmentNames.length > 0 &&
                    !msg.content.startsWith('Attached:') ? (
                      <p className="mt-2 border-t border-white/20 pt-2 text-[10px] text-white/85">
                        Files: {msg.attachmentNames.join(', ')}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              {msg.role === 'assistant' && msg.meta && (msg.meta.nextStep || msg.meta.sourcesUsed?.length || msg.meta.intent) ? (
                <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  {msg.meta.intent ? (
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      Intent: <span className="font-semibold text-gray-700">{msg.meta.intent.replace(/_/g, ' ')}</span>
                    </p>
                  ) : null}
                  {msg.meta.nextStep ? (
                    <p className="mt-1 text-xs text-gray-700">
                      <strong>Next step:</strong> {msg.meta.nextStep}
                    </p>
                  ) : null}
                  {msg.meta.sourcesUsed?.length ? (
                    <p className="mt-1 text-[11px] text-gray-500">
                      Sources: {msg.meta.sourcesUsed.map((source) => source.label).join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {isRecording ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            Listening… pause when you&apos;re done — it will transcribe and send. Tap the mic to stop early.
          </div>
        ) : null}
        {isTranscribing && !loading ? (
          <div className="flex items-start gap-2.5">
            <div className={`w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 ${config.color}`}>
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                <span className="text-xs text-gray-500">Transcribing speech…</span>
              </div>
            </div>
          </div>
        ) : null}
        {loading && (
          <div className="flex items-start gap-2.5">
            <div className={`w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 ${config.color}`}>
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Thinking…</span>
              </div>
            </div>
          </div>
        )}

        {incidentDetected && stage !== 'travel' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              It sounds like there may be a disruption. Switch to the{' '}
              <strong>Travel</strong> stage for real-time issue support.
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="shrink-0 px-4 pb-4 pt-2 border-t border-gray-100 space-y-2">
        <input
          ref={fileAttachmentInputRef}
          type="file"
          className="hidden"
          multiple
          accept={CHAT_ATTACHMENT_ACCEPT}
          onChange={(e) => onPickAttachmentFiles(e.target.files)}
        />
        {pendingAttachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {pendingAttachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 py-1 pl-2.5 pr-1 text-[11px] text-gray-700"
              >
                <span className="truncate">{a.file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPendingAttachments((prev) => prev.filter((x) => x.id !== a.id))
                  }
                  className="rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                  aria-label={`Remove ${a.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={ttsEnabled}
            onClick={() => setTtsEnabled((v) => !v)}
            disabled={loading}
            title={
              ttsEnabled ? 'Turn off automatic read-aloud' : 'Read each new reply aloud automatically'
            }
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
              ttsEnabled
                ? 'border-sky-300 bg-sky-50 text-sky-900'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Volume2 className="h-3.5 w-3.5 shrink-0" />
            Auto-read replies
          </button>
        </div>
        {voiceErr ? <p className="text-xs text-red-600">{voiceErr}</p> : null}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileAttachmentInputRef.current?.click()}
            disabled={loading || isTranscribing || pendingAttachments.length >= MAX_CHAT_ATTACHMENTS}
            className="flex-none flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
            aria-label="Attach files"
            title="Attach PDF, Word, or images"
          >
            <Plus className="h-5 w-5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={() => void toggleMic()}
            className={`flex-none flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-40 ${
              isRecording
                ? 'border-red-300 bg-red-50 text-red-800 ring-2 ring-red-100 animate-pulse'
                : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            aria-label={
              isRecording ? 'Stop recording now' : 'Voice: speak, pause to auto-send, or tap again to stop'
            }
            title={
              isRecording
                ? 'Tap to stop now (otherwise we stop after you pause speaking)'
                : 'Speak your question; we stop when you pause, then transcribe and send'
            }
            disabled={loading || isTranscribing}
          >
            <Mic className="h-4 w-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              stage === 'travel'
                ? 'Report an issue or ask a quick question…'
                : 'Ask your copilot anything about this trip…'
            }
            rows={1}
            className="flex-1 resize-none rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent max-h-32"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
            disabled={loading || isTranscribing || isRecording}
          />
          <button
            type="submit"
            disabled={
              loading ||
              isTranscribing ||
              isRecording ||
              (!input.trim() && pendingAttachments.length === 0)
            }
            className="flex-none w-10 h-10 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center text-white transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center">
          PDF, DOCX, TXT, PNG, JPEG — up to {MAX_CHAT_ATTACHMENTS} files ({MAX_CHAT_IMAGES} images max). Responses use
          your trip context; verify critical info before travel.
        </p>
      </form>
    </div>
  );
}
