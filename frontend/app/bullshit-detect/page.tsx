'use client';

import { useState, useRef, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { api } from '@/lib/api';
import { FileWarning, Mic, MicOff, ImagePlus, Volume2, Send, Video } from 'lucide-react';

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

const SILENCE_THRESHOLD = 15;
const SILENCE_DURATION_MS = 1500;
const MIN_RECORDING_MS = 800;
const VAD_CHECK_INTERVAL_MS = 100;

export default function BullshitDetectPage() {
  const [text, setText] = useState('');
  const [attachedImages, setAttachedImages] = useState<{ file: File; preview: string }[]>([]);
  const [attachedVideo, setAttachedVideo] = useState<{ file: File; preview: string; duration: number } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<'openai' | 'magic_hour'>('openai');
  const [ttsVoice, setTtsVoice] = useState('coral');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInputSummary, setUserInputSummary] = useState<string | null>(null);
  const [lastInputImagePreviews, setLastInputImagePreviews] = useState<string[]>([]);
  const [lastInputVideoPreview, setLastInputVideoPreview] = useState<string | null>(null);
  const [lastInputVideoDuration, setLastInputVideoDuration] = useState<number | null>(null);
  const [readAloud, setReadAloud] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [lastTtsUrl, setLastTtsUrl] = useState<string | null>(null);
  const [recentChecks, setRecentChecks] = useState<string[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTtsUrlRef = useRef<string | null>(null);
  lastTtsUrlRef.current = lastTtsUrl;

  useEffect(() => () => {
    if (lastTtsUrlRef.current) URL.revokeObjectURL(lastTtsUrlRef.current);
  }, []);

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
    if (isVideoFile(file)) {
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

    setUserInputSummary(inputText || (audio ? '(Voice message)' : video ? '(Video attached)' : '(Image attached)'));
    setLastInputImagePreviews(attachedImages.map((x) => x.preview));
    setLastInputVideoPreview(attachedVideo?.preview ?? null);
    setLastInputVideoDuration(attachedVideo?.duration ?? null);
    setTranscribedText(null);
    setAnalysis('');
    setText('');
    const currentVideo = attachedVideo;
    setAttachedImages([]);
    setAttachedVideo(null);
    setVideoError(null);
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.bullshitDetectPipeline({
        audio,
        text: inputText || undefined,
        images: images.length ? images : undefined,
        video: currentVideo?.file,
        tts: ttsEnabled,
        voice: ttsVoice,
        tts_provider: ttsEnabled ? ttsProvider : undefined,
      });
      setReadAloud(result.read_aloud || '');
      setAnalysis(result.analysis || '');
      if (result.transcribed_text) setTranscribedText(result.transcribed_text);
      setRecentChecks((prev) => [...prev, inputText || (audio ? '(Voice)' : video ? '(Video)' : '(Image)')].slice(-5));
      if (result.tts_error) setError((e) => (e ? e + ' ' : '') + `TTS: ${result.tts_error}`);

      if (ttsEnabled && result.audio_base64) {
        const mime = result.audio_format === 'wav' ? 'audio/wav' : 'audio/mpeg';
        const binary = atob(result.audio_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);
        if (lastTtsUrlRef.current) URL.revokeObjectURL(lastTtsUrlRef.current);
        setLastTtsUrl(url);
        const audioEl = ttsAudioRef.current || new Audio();
        if (!ttsAudioRef.current) ttsAudioRef.current = audioEl;
        audioEl.onended = () => {};
        audioEl.onerror = () => {};
        audioEl.src = url;
        audioEl.play().catch(() => {});
      } else {
        if (lastTtsUrlRef.current) URL.revokeObjectURL(lastTtsUrlRef.current);
        setLastTtsUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendPipeline({ text });
  };

  const replayTts = () => {
    if (!lastTtsUrl) return;
    const audioEl = ttsAudioRef.current || new Audio();
    if (!ttsAudioRef.current) ttsAudioRef.current = audioEl;
    audioEl.src = lastTtsUrl;
    audioEl.play().catch(() => {});
  };

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-8rem)] gap-0 -m-6 sm:-m-8">
        {/* Sidebar: same style as Chaos Logs */}
        <aside className="w-80 flex-shrink-0 flex flex-col border-r border-border-dark bg-surface-dark/50 backdrop-blur-xl overflow-hidden">
          <div className="p-6 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">warning</span>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">Reality Check</h1>
            </div>
            <p className="text-primary/60 text-xs font-medium uppercase tracking-widest">Threat Logs</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-2 tracking-widest">Recent Checks</div>
            {recentChecks.slice().reverse().map((summary, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all">
                <span className="material-symbols-outlined text-slate-400">fact_check</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-300 truncate">{summary.slice(0, 40)}{summary.length > 40 ? '…' : ''}</p>
                  <p className="text-[10px] text-slate-500">Check {recentChecks.length - i}</p>
                </div>
              </div>
            ))}
            {recentChecks.length === 0 && (
              <div className="px-3 py-3 text-slate-500 text-sm">No checks yet.</div>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 bg-background-dark">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-4 space-y-4">
              {attachedVideo && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Video className="w-5 h-5 text-primary" />
                    <span className="text-sm">Video ({attachedVideo.duration.toFixed(1)}s)</span>
                  </div>
                  <button type="button" onClick={removeVideo} className="p-1.5 bg-red-500/80 rounded-lg hover:bg-red-500">×</button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {!attachedVideo && attachedImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img.preview} alt="" className="w-16 h-16 object-cover rounded-lg" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs">×</button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSubmit} className="relative flex items-end gap-3 bg-background-dark border border-border-dark p-3 rounded-2xl focus-within:border-primary/50 transition-all shadow-2xl">
                <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime,video/mpeg,.mov,.mp4,.webm,.mpeg,.mpeg4,application/pdf,.pdf" multiple={!attachedVideo} className="hidden" onChange={handleImageSelect} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-2 text-slate-500 hover:text-primary transition-colors" title="Attach">
                  <ImagePlus className="w-5 h-5" />
                </button>
                <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={attachedVideo || attachedImages.length ? 'Optional caption…' : 'Type or paste text, or attach image/video…'} className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-200 placeholder:text-slate-600 py-2 min-w-0" disabled={isLoading} />
                <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={isLoading} className={`p-2 ${isRecording ? 'text-red-500' : 'text-slate-500 hover:text-primary'}`} title={isRecording ? 'Stop' : 'Record'}>
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button type="button" onClick={() => setTtsEnabled((v) => !v)} className={`p-2 ${ttsEnabled ? 'text-primary' : 'text-slate-500 hover:text-accent-pink'}`} title="Speak analysis">
                  <Volume2 className="w-5 h-5" />
                </button>
                {ttsEnabled && (
                  <>
                    <select value={ttsProvider} onChange={(e) => { const p = e.target.value as 'openai' | 'magic_hour'; setTtsProvider(p); setTtsVoice(p === 'openai' ? 'coral' : 'Morgan Freeman'); }} className="px-2 py-1 rounded-lg bg-primary/5 border border-primary/20 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary" title="TTS provider">
                      <option value="openai">OpenAI</option>
                      <option value="magic_hour">Magic Hour</option>
                    </select>
                    <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} className="px-2 py-1 rounded-lg bg-primary/5 border border-primary/20 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary max-w-[120px]" title="TTS voice">
                      {(ttsProvider === 'openai' ? OPENAI_TTS_VOICES : MAGIC_HOUR_VOICES).map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </>
                )}
                <button type="submit" disabled={isLoading || (!text.trim() && attachedImages.length === 0 && !attachedVideo)} className="bg-primary hover:bg-primary/90 text-background-dark px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap">
                  Analyze <Send className="w-4 h-4" />
                </button>
              </form>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Mic auto-sends • Max video {MAX_VIDEO_SECONDS}s</p>
            </div>

            {(error || videoError) && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {error || videoError}
              </div>
            )}
            {isLoading && (
              <div className="flex justify-center">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em]">Analyzing…</span>
              </div>
            )}
            {readAloud && (
              <div className="bg-amber-500/10 backdrop-blur border border-amber-500/40 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-amber-400">Summary (read aloud)</h2>
                  {lastTtsUrl && (
                    <button
                      type="button"
                      onClick={replayTts}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 text-sm font-medium transition-colors"
                      title="Play audio again"
                    >
                      <Volume2 className="w-4 h-4" />
                      Play again
                    </button>
                  )}
                </div>
                <div className="text-amber-200/90 text-sm whitespace-pre-wrap">{readAloud}</div>
              </div>
            )}

            {(userInputSummary !== null || readAloud || analysis) && (
              <div className="space-y-4">
                {userInputSummary !== null && (
                  <div className="bg-surface-dark border border-border-dark rounded-2xl p-5">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Input</h2>
                    {lastInputImagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {lastInputImagePreviews.map((src, j) => (
                          <img key={j} src={src} alt="" className="max-w-full max-h-48 rounded-lg object-cover border border-primary/20" />
                        ))}
                      </div>
                    )}
                    {lastInputVideoPreview && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-primary/20 max-w-xs">
                        <video src={lastInputVideoPreview} controls className="w-full max-h-40" />
                        {lastInputVideoDuration != null && (
                          <p className="text-xs text-slate-500 px-2 py-1">Video ({lastInputVideoDuration.toFixed(1)}s)</p>
                        )}
                      </div>
                    )}
                    {(userInputSummary !== '(Image attached)' || (lastInputImagePreviews.length === 0 && !lastInputVideoPreview)) && (
                      <p className="text-slate-200 text-sm whitespace-pre-wrap">{userInputSummary}</p>
                    )}
                    {transcribedText && (
                      <p className="text-slate-500 text-xs mt-2">Transcribed: {transcribedText}</p>
                    )}
                  </div>
                )}
                {readAloud && (
                  <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5">
                    <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Summary (read aloud)</h2>
                    <div className="text-slate-200 text-sm whitespace-pre-wrap">{readAloud}</div>
                  </div>
                )}
                {analysis && (
                  <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                    <h2 className="text-sm font-bold text-primary uppercase tracking-widest mb-3">Full analysis</h2>
                    <div className="text-slate-300 text-sm whitespace-pre-wrap">{analysis}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
