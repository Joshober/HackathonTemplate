'use client';

import { useState, useRef, useEffect } from 'react';
import { getCurrentUser, login } from '@/lib/auth';
import { api } from '@/lib/api';
import DashboardShell from '@/components/DashboardShell';
import { Mic, MicOff, Volume2, Send, Video } from 'lucide-react';

const MAX_VIDEO_SECONDS = 20;

const VIDEO_EXTENSIONS = ['.mov', '.mp4', '.webm', '.mpeg', '.mpeg4'];
function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  const name = (file.name || '').toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load video'));
    };
    video.src = url;
  });
}

const OPENAI_TTS_VOICES = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'ash', label: 'Ash' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'cedar', label: 'Cedar' },
  { id: 'coral', label: 'Coral' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'marin', label: 'Marin' },
  { id: 'nova', label: 'Nova' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'sage', label: 'Sage' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'verse', label: 'Verse' },
] as const;
const MAGIC_HOUR_VOICES = [
  { id: 'Elon Musk', label: 'Elon Musk' },
  { id: 'Morgan Freeman', label: 'Morgan Freeman' },
  { id: 'Joe Rogan', label: 'Joe Rogan' },
  { id: 'Barack Obama', label: 'Barack Obama' },
  { id: 'Donald Trump', label: 'Donald Trump' },
  { id: 'Joe Biden', label: 'Joe Biden' },
  { id: 'Taylor Swift', label: 'Taylor Swift' },
  { id: 'Samuel L. Jackson', label: 'Samuel L. Jackson' },
  { id: 'David Attenborough', label: 'David Attenborough' },
  { id: 'Kanye West', label: 'Kanye West' },
  { id: 'Kim Kardashian', label: 'Kim Kardashian' },
  { id: 'James Earl Jones', label: 'James Earl Jones' },
  { id: 'Jeff Goldblum', label: 'Jeff Goldblum' },
  { id: 'Marilyn Monroe', label: 'Marilyn Monroe' },
  { id: 'Albert Einstein', label: 'Albert Einstein' },
] as const;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  isVideo?: boolean;
  videoDuration?: number;
  /** Preview URLs for attached images (user messages) — so we can show the image in the thread */
  imagePreviews?: string[];
  /** Preview URL for attached video (user messages) */
  videoPreview?: string;
}

export default function ChatPage() {
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I\'m your AI assistant. You can speak, type, or attach images. Enable "Speak response" to hear my replies.' },
  ]);
  const [text, setText] = useState('');
  // Combined mode: roast when user attaches image/video, assistant for text-only (no toggle)
  const getEffectiveMode = (opts: { images?: unknown[]; video?: unknown }): 'assistant' | 'roast' =>
    (opts.images?.length || opts.video) ? 'roast' : 'assistant';
  const [attachedImages, setAttachedImages] = useState<{ file: File; preview: string }[]>([]);
  const [attachedVideo, setAttachedVideo] = useState<{ file: File; preview: string; duration: number } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<'openai' | 'magic_hour'>('openai');
  const [ttsVoice, setTtsVoice] = useState('coral');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCurrentUser().then((u) => setUser(u)).catch(() => login());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const SILENCE_THRESHOLD = 15;
  const SILENCE_DURATION_MS = 1500;
  const MIN_RECORDING_MS = 800;
  const VAD_CHECK_INTERVAL_MS = 100;

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (vadIntervalRef.current) {
          clearInterval(vadIntervalRef.current);
          vadIntervalRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
        await sendPipeline({ audio: file });
      };
      mr.start();
      setIsRecording(true);

      // Voice Activity Detection: auto-stop when user stops talking
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastLoudTime = Date.now();
      const startTime = Date.now();

      vadIntervalRef.current = setInterval(() => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > SILENCE_THRESHOLD) lastLoudTime = Date.now();
        const elapsed = Date.now() - startTime;
        const silentFor = Date.now() - lastLoudTime;
        if (elapsed >= MIN_RECORDING_MS && silentFor >= SILENCE_DURATION_MS) {
          stopRecording();
        }
      }, VAD_CHECK_INTERVAL_MS);
    } catch {
      setError('Microphone permission denied');
    }
  };

  const stopRecording = () => {
    // Use recorder state (not isRecording) so VAD interval can stop recording — avoids stale closure
    if (mediaRecorderRef.current?.state === 'recording') {
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setVideoError(null);
    const file = files[0];
    const isVideo = isVideoFile(file);
    if (isVideo) {
      setVideoError(null);
      getVideoDuration(file)
        .then((duration) => {
          if (duration > MAX_VIDEO_SECONDS) {
            setVideoError(`Video must be ${MAX_VIDEO_SECONDS}s or less (this one is ${duration.toFixed(1)}s).`);
            return;
          }
          setAttachedVideo({ file, preview: URL.createObjectURL(file), duration });
          setAttachedImages([]);
        })
        .catch(() => {
          setAttachedVideo({ file, preview: URL.createObjectURL(file), duration: 0 });
          setAttachedImages([]);
        });
      e.target.value = '';
      return;
    }
    if (attachedVideo) setAttachedVideo(null);
    const pdfPlaceholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="#1e293b" width="64" height="64"/><text x="32" y="38" text-anchor="middle" fill="#94a3b8" font-size="11">PDF</text></svg>');
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isPdf = f.type === 'application/pdf' || (f.name || '').toLowerCase().endsWith('.pdf');
      if (f.type.startsWith('image/')) {
        setAttachedImages((prev) => [...prev, { file: f, preview: URL.createObjectURL(f) }]);
      } else if (isPdf) {
        setAttachedImages((prev) => [...prev, { file: f, preview: pdfPlaceholder }]);
      }
    }
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setAttachedImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].preview);
      next.splice(idx, 1);
      return next;
    });
  };

  const removeVideo = () => {
    if (attachedVideo) {
      URL.revokeObjectURL(attachedVideo.preview);
      setAttachedVideo(null);
      setVideoError(null);
    }
  };

  const sendPipeline = async (overrides?: { audio?: File; text?: string }) => {
    const inputText = (overrides?.text ?? text).trim();
    const audio = overrides?.audio;
    const images = attachedImages.map((x) => x.file);
    const video = attachedVideo?.file;

    const hasMedia = images.length > 0 || !!video;
    if (!inputText && !audio && !hasMedia) return;

    const userContent = inputText || (audio ? '(Voice message)' : video ? '(See video)' : '(Image attached)');
    const userMsg: Message = { role: 'user', content: userContent };
    if (video && attachedVideo) {
      userMsg.isVideo = true;
      userMsg.videoDuration = attachedVideo.duration;
      userMsg.videoPreview = attachedVideo.preview;
    }
    if (attachedImages.length > 0) {
      userMsg.imagePreviews = attachedImages.map((x) => x.preview);
    }
    setMessages((prev) => [...prev, userMsg]);
    setText('');
    setAttachedImages([]);
    const currentVideo = attachedVideo;
    setAttachedVideo(null);
    setVideoError(null);
    setIsLoading(true);
    setError(null);

    try {
      const prevMessages = messages;
      const apiMessages = [
        ...prevMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: inputText || (audio ? '(Voice message)' : currentVideo ? '(See video)' : '(See image)') },
      ];
      const pipelineMessages = apiMessages.slice(0, -1);

      const result = await api.chatPipeline({
        audio: audio || undefined,
        text: inputText || undefined,
        images: images.length ? images : undefined,
        video: currentVideo?.file,
        messages: pipelineMessages,
        tts: ttsEnabled,
        voice: ttsVoice,
        tts_provider: ttsEnabled ? ttsProvider : undefined,
        mode: getEffectiveMode({ images, video: currentVideo }),
      });

      const fullMessage = result.message || 'No response.';
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx].role === 'user' && result.transcribed_text) {
          next[lastIdx] = { ...next[lastIdx], content: result.transcribed_text };
        }
        return [...next, { role: 'assistant' as const, content: fullMessage }];
      });
      if (result.tts_error) setError((e) => (e ? e + ' ' : '') + `TTS: ${result.tts_error}`);

      if (ttsEnabled && result.audio_base64) {
        const mime = result.audio_format === 'wav' ? 'audio/wav' : 'audio/mpeg';
        const binary = atob(result.audio_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);
        const audioEl = ttsAudioRef.current || new Audio();
        if (!ttsAudioRef.current) ttsAudioRef.current = audioEl;
        audioEl.onended = () => URL.revokeObjectURL(url);
        audioEl.onerror = () => URL.revokeObjectURL(url);
        audioEl.src = url;
        audioEl.play().catch(() => URL.revokeObjectURL(url));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setError(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendPipeline({ text });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-8rem)] gap-0 -m-6 sm:-m-8">
        {/* Sidebar: Recent Mistakes */}
        <aside className="w-80 flex-shrink-0 flex flex-col border-r border-border-dark bg-surface-dark/50 backdrop-blur-xl overflow-hidden">
          <div className="p-6 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">visibility</span>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">Always Judging</h1>
            </div>
            <p className="text-primary/60 text-xs font-medium uppercase tracking-widest">Chaos Logs</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-2 tracking-widest">Recent Mistakes</div>
            {messages.filter((m) => m.role === 'user').slice(-5).reverse().map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all">
                <span className="material-symbols-outlined text-slate-400">history</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-300 truncate">{m.content.slice(0, 40)}{m.content.length > 40 ? '…' : ''}</p>
                  <p className="text-[10px] text-slate-500">Message {messages.length - i}</p>
                </div>
              </div>
            ))}
            {messages.filter((m) => m.role === 'user').length === 0 && (
              <div className="px-3 py-3 text-slate-500 text-sm">No regrets yet.</div>
            )}
          </div>
        </aside>

        {/* Main Chat */}
        <div className="flex-1 flex flex-col min-w-0 bg-background-dark">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {messages.length === 1 && (
              <div className="flex justify-center">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em] bg-border-dark/20 px-4 py-1 rounded-full">
                  Claude is judging your typing speed...
                </span>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start items-start gap-4'}>
                {m.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-xl bg-surface-dark border border-primary/30 flex items-center justify-center shrink-0 mt-1">
                    <span className="material-symbols-outlined text-primary">face_6</span>
                  </div>
                )}
                <div className={m.role === 'user' ? 'max-w-[70%]' : 'max-w-[70%]'}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'bg-primary/10 border border-primary/20 p-4 rounded-2xl rounded-tr-none'
                        : 'bg-surface-dark border border-border-dark p-5 rounded-2xl rounded-tl-none'
                    }
                  >
                    {m.imagePreviews && m.imagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {m.imagePreviews.map((src, j) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={j} src={src} alt="" className="max-w-full max-h-48 rounded-lg object-cover border border-primary/20" />
                        ))}
                      </div>
                    )}
                    {m.isVideo && (m.videoPreview ? (
                      <div className="mb-2 rounded-lg overflow-hidden border border-primary/20 max-w-xs">
                        <video src={m.videoPreview} controls className="w-full max-h-40" />
                        <div className="flex items-center gap-2 text-xs text-slate-400 px-2 py-1">
                          <Video className="w-4 h-4" />
                          Video{m.videoDuration != null ? ` (${m.videoDuration.toFixed(1)}s)` : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Video className="w-4 h-4" />
                        Video{m.videoDuration != null ? ` (${m.videoDuration.toFixed(1)}s)` : ''}
                      </div>
                    ))}
                    {m.content && (m.content !== '(Image attached)' || !m.imagePreviews?.length) && (
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                  <p className={`text-[10px] text-slate-500 font-mono mt-2 ${m.role === 'user' ? 'text-right' : ''}`}>
                    {m.role === 'user' ? 'READ BY JUDGE' : 'PROCESSED WITH REGRET'}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-center">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em]">Processing your questionable request...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {(error || videoError) && (
            <div className="px-6 py-2">
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {error || videoError}
              </div>
            </div>
          )}

          {/* Input */}
          <footer className="p-6 bg-gradient-to-t from-background-dark to-transparent shrink-0">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              {attachedVideo && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Video className="w-5 h-5 text-primary" />
                    <span className="text-sm">Video ({attachedVideo.duration.toFixed(1)}s)</span>
                  </div>
                  <button type="button" onClick={removeVideo} className="p-1.5 bg-red-500/80 rounded-lg hover:bg-red-500">×</button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-2">
                {!attachedVideo && attachedImages.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt="" className="w-16 h-16 object-cover rounded-lg" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs">×</button>
                  </div>
                ))}
              </div>
              <div className="relative flex items-end gap-3 bg-surface-dark border border-border-dark p-3 rounded-2xl focus-within:border-primary/50 transition-all shadow-2xl">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/mpeg,.mov,.mp4,.webm,.mpeg,.mpeg4,application/pdf,.pdf"
                  multiple={!attachedVideo}
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-2 text-slate-500 hover:text-primary transition-colors" title="Attach">
                  <span className="material-symbols-outlined">attachment</span>
                </button>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type your next regret here..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-200 placeholder:text-slate-600 py-2 min-w-0"
                />
                <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={isLoading} className={`p-2 ${isRecording ? 'text-red-500' : 'text-slate-500 hover:text-primary'}`} title={isRecording ? 'Stop' : 'Mic'}>
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button type="button" onClick={() => setTtsEnabled((v) => !v)} className={`p-2 ${ttsEnabled ? 'text-primary' : 'text-slate-500 hover:text-accent-pink'}`} title="TTS">
                  <Volume2 className="w-5 h-5" />
                </button>
                {ttsEnabled && (
                  <>
                    <select value={ttsProvider} onChange={(e) => { const p = e.target.value as 'openai' | 'magic_hour'; setTtsProvider(p); setTtsVoice(p === 'openai' ? 'coral' : 'Morgan Freeman'); }} className="px-2 py-1 rounded-lg bg-primary/5 border border-primary/20 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="openai">OpenAI</option>
                    <option value="magic_hour">Magic Hour</option>
                  </select>
                    <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} className="px-2 py-1 rounded-lg bg-primary/5 border border-primary/20 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary max-w-[120px]">
                      {(ttsProvider === 'openai' ? OPENAI_TTS_VOICES : MAGIC_HOUR_VOICES).map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </>
                )}
                <button type="submit" disabled={isLoading || (!text.trim() && attachedImages.length === 0 && !attachedVideo)} className="bg-primary hover:bg-primary/90 text-background-dark px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap">
                  Send (probably) <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-600 mt-3 font-medium uppercase tracking-widest">Claude may provide questionable or sarcastic answers. Tread carefully.</p>
            </form>
          </footer>
        </div>
      </div>
    </DashboardShell>
  );
}
