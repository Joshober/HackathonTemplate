'use client';

import { useState, useRef, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { api } from '@/lib/api';
import { FileWarning, Mic, MicOff, ImagePlus, Volume2, Send, Video } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

const ACCEPTED_DOC_TYPES = '.pdf,.doc,.docx';
const isPdfOrWord = (f: File) => {
  const name = (f.name || '').toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx');
};

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    parts.push(pageText);
  }
  return parts.join('\n\n');
}

async function extractWordText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

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
  const [readAloud, setReadAloud] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [lastTtsUrl, setLastTtsUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';
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

  const processFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(isPdfOrWord);
    if (!files.length) return;
    setError(null);
    setVideoError(null);
    Promise.all(
      files.map(async (file) => {
        const name = (file.name || '').toLowerCase();
        if (name.endsWith('.pdf')) return extractPdfText(file);
        if (name.endsWith('.doc') || name.endsWith('.docx')) return extractWordText(file);
        return '';
      })
    )
      .then((contents) => {
        const combined = contents.filter(Boolean).join('\n\n');
        if (combined) setText((prev) => (prev ? prev + '\n\n' + combined : combined));
      })
      .catch(() => setError('Could not read document. Try a different file.'));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    processFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    const valid = Array.from(files).filter(isPdfOrWord);
    if (valid.length) processFiles(valid);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center">
            <FileWarning className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reality Check</h1>
            <p className="text-gray-400 text-sm">
              Use voice, text, or attach images/video. Get a blunt analysis of jargon and fluff—no plain-language rewrite.
            </p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !isLoading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-white/20 hover:border-amber-500/50 hover:bg-white/5'
            } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_DOC_TYPES}
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <ImagePlus className="w-10 h-10 mx-auto mb-2 text-amber-400/80" />
            <p className="text-gray-300 font-medium">Drag and drop Word documents or PDF here</p>
            <p className="text-gray-500 text-sm mt-1">or click to browse • .doc, .docx, .pdf only</p>
          </div>

          {attachedVideo && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <Video className="w-5 h-5 text-amber-400" />
                <span className="text-sm">Video ({attachedVideo.duration.toFixed(1)}s)</span>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); removeVideo(); }} className="p-1.5 bg-red-500/80 rounded-lg hover:bg-red-500">×</button>
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`p-3 rounded-lg ${isRecording ? 'bg-red-500/30' : 'bg-white/10 hover:bg-white/20'}`}
                title={isRecording ? 'Stop recording' : 'Record voice'}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={() => setTtsEnabled((v) => !v)}
                className={`p-3 rounded-lg ${ttsEnabled ? 'bg-amber-500/30' : 'bg-white/10 hover:bg-white/20'}`}
                title="Speak analysis"
              >
                <Volume2 className="w-5 h-5" />
              </button>
              {ttsEnabled && (
                <>
                  <select
                    value={ttsProvider}
                    onChange={(e) => {
                      const p = e.target.value as 'openai' | 'magic_hour';
                      setTtsProvider(p);
                      setTtsVoice(p === 'openai' ? 'coral' : 'Morgan Freeman');
                    }}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    title="TTS provider"
                  >
                    <option value="openai">OpenAI (faster)</option>
                    <option value="magic_hour">Magic Hour (celebrity)</option>
                  </select>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    title="TTS voice"
                  >
                    {(ttsProvider === 'openai' ? OPENAI_TTS_VOICES : MAGIC_HOUR_VOICES).map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </>
              )}
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={attachedVideo || attachedImages.length ? 'Optional caption…' : 'Type or paste text…'}
                className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || (!text.trim() && attachedImages.length === 0 && !attachedVideo)}
                className="p-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-medium disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {ttsEnabled
                ? `✓ ${ttsProvider === 'magic_hour' ? 'Magic Hour' : 'OpenAI'} – ${(ttsProvider === 'openai' ? OPENAI_TTS_VOICES : MAGIC_HOUR_VOICES).find((v) => v.id === ttsVoice)?.label || ttsVoice}`
                : 'Enable speaker to hear analysis'}
              {' • '}Mic auto-sends when you stop talking • Max video {MAX_VIDEO_SECONDS}s
            </p>
          </form>

          {(error || videoError) && (
            <p className="text-red-400 text-sm">{error || videoError}</p>
          )}
        </div>

        {(userInputSummary !== null || readAloud || analysis) && (
          <div className="space-y-4">
            {userInputSummary !== null && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-400 mb-1">Input</h2>
                <p className="text-gray-200 text-sm whitespace-pre-wrap">{userInputSummary}</p>
                {transcribedText && (
                  <p className="text-gray-500 text-xs mt-2">Transcribed: {transcribedText}</p>
                )}
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
            {analysis && (
              <div className="bg-white/5 backdrop-blur border border-amber-500/30 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-amber-400 mb-3">Full analysis</h2>
                <div className="text-gray-300 text-sm whitespace-pre-wrap">{analysis}</div>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <p className="text-amber-400/80 text-sm">Analyzing…</p>
        )}
      </div>
    </DashboardShell>
  );
}
