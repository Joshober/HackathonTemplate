'use client';

import { useEffect, useState, useRef } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import Link from 'next/link';
import DashboardShell from '@/components/DashboardShell';
import { Send, Mic, MicOff, ImagePlus, Volume2, Video } from 'lucide-react';
import { api } from '@/lib/api';

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME = 'Hello! I\'m your AI assistant. You can speak, type, or attach image/video. Choose a voice and enable "Speak response" to hear my replies.';

const TTS_VOICES = [
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

export default function TutorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: WELCOME }]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [tutorRecording, setTutorRecording] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState('coral');
  const [attachedImages, setAttachedImages] = useState<{ file: File; preview: string }[]>([]);
  const [attachedVideo, setAttachedVideo] = useState<{ file: File; preview: string; duration: number } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser(u))
      .catch(() => login())
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getParagraphsForTts = (content: string): string[] => {
    const t = content.trim();
    if (!t) return [];
    const paragraphs = t.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length >= 2) return paragraphs;
    if (paragraphs.length === 1) {
      const mid = Math.floor(t.length / 2);
      const searchStart = Math.max(0, mid - 100);
      const searchEnd = Math.min(t.length, mid + 100);
      const slice = t.slice(searchStart, searchEnd);
      const periodIdx = slice.indexOf('. ');
      const breakPoint = periodIdx >= 0 ? searchStart + periodIdx + 2 : mid;
      const first = t.slice(0, breakPoint).trim();
      const second = t.slice(breakPoint).trim();
      return second ? [first, second] : [first];
    }
    return [t];
  };

  const playTtsBlob = (blob: Blob, onEnded: () => void) => {
    const url = URL.createObjectURL(blob);
    const audio = ttsAudioRef.current || new Audio();
    if (!ttsAudioRef.current) ttsAudioRef.current = audio;
    const cleanup = () => URL.revokeObjectURL(url);
    audio.onended = () => { cleanup(); onEnded(); };
    audio.onerror = () => { cleanup(); onEnded(); };
    audio.src = url;
    audio.play().catch(() => { cleanup(); onEnded(); });
  };

  const playTtsResponse = (content: string) => {
    if (!ttsEnabled || !content.trim()) return;
    const chunks = getParagraphsForTts(content);
    if (chunks.length === 0) return;
    Promise.all(chunks.map((c) => api.textToSpeech(c, { voice: ttsVoice }))).then((blobs) => {
      const playNext = (i: number) => {
        if (i >= blobs.length) return;
        playTtsBlob(blobs[i], () => playNext(i + 1));
      };
      playNext(0);
    });
  };

  const sendToTutor = async (questionOverride?: string) => {
    const q = (questionOverride ?? text).trim();
    const hasMedia = attachedImages.length > 0 || attachedVideo !== null;
    if ((!q && !hasMedia) || tutorLoading) return;
    const userContent = q || (attachedVideo ? '(Video attached)' : '(Image attached)');
    setMessages((prev) => [...prev, { role: 'user', content: userContent }]);
    setText('');
    const currentImages = [...attachedImages];
    const currentVideo = attachedVideo;
    setAttachedImages([]);
    setAttachedVideo(null);
    setVideoError(null);
    setTutorLoading(true);
    setTutorError(null);
    try {
      let imagesBase64: string[] | undefined;
      let video_b64: string | undefined;
      let video_mime: string | undefined;
      if (currentVideo) {
        video_b64 = await fileToBase64(currentVideo.file);
        const f = currentVideo.file;
        video_mime = f.type?.startsWith('video/') ? f.type : (f.name?.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
      } else if (currentImages.length > 0) {
        imagesBase64 = await Promise.all(currentImages.map(({ file }) => fileToBase64(file)));
      }
      const res = await api.askTutor(q || '(See attached)', { images: imagesBase64, video_b64, video_mime });
      const parts: string[] = [];
      if (res.fun) parts.push(`"${res.fun}"`);
      if (res.help?.length) parts.push('\nHELP:\n' + res.help.map((s) => `• ${s}`).join('\n'));
      const assistantContent = parts.join('\n\n') || 'No response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
      playTtsResponse(assistantContent);
    } catch (e) {
      setTutorError(e instanceof Error ? e.message : 'Something went wrong');
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Something went wrong'}` }]);
    } finally {
      setTutorLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setVideoError(null);
    const file = files[0];
    if (isVideoFile(file)) {
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
    } else {
      if (attachedVideo) setAttachedVideo(null);
      const list: { file: File; preview: string }[] = [];
      for (let i = 0; i < Math.min(files.length, 3); i++) {
        const f = files[i];
        if (f.type.startsWith('image/')) list.push({ file: f, preview: URL.createObjectURL(f) });
      }
      setAttachedImages((prev) => [...prev, ...list].slice(0, 3));
    }
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
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

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'tutor-voice.webm', { type: 'audio/webm' });
        setTutorLoading(true);
        setTutorError(null);
        try {
          const { text: transcribed } = await api.transcribeAudio(file);
          const q = (transcribed || '').trim();
          if (q) {
            setMessages((prev) => [...prev, { role: 'user', content: q }]);
            const res = await api.askTutor(q, {});
            const parts: string[] = [];
            if (res.fun) parts.push(`"${res.fun}"`);
            if (res.help?.length) parts.push('\nHELP:\n' + res.help.map((s) => `• ${s}`).join('\n'));
            const assistantContent = parts.join('\n\n') || 'No response.';
            setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
            if (ttsEnabled && assistantContent.trim()) {
              const chunks = getParagraphsForTts(assistantContent);
              if (chunks.length > 0) {
                Promise.all(chunks.map((c) => api.textToSpeech(c, { voice: ttsVoice }))).then((blobs) => {
                  const playNext = (i: number) => {
                    if (i >= blobs.length) return;
                    playTtsBlob(blobs[i], () => playNext(i + 1));
                  };
                  playNext(0);
                });
              }
            }
          } else setTutorError('No speech detected. Try again.');
        } catch (e) {
          setTutorError(e instanceof Error ? e.message : 'Transcription failed');
        } finally {
          setTutorLoading(false);
          setTutorRecording(false);
        }
      };
      mr.start();
      setTutorRecording(true);
    } catch {
      setTutorError('Microphone access denied');
    }
  };

  const stopVoice = () => {
    if (mediaRecorderRef.current && tutorRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendToTutor();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0712] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell>
      <div className="flex flex-col max-w-4xl mx-auto w-full">
        <div className="mb-4">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
            ← Back to Overview
          </Link>
        </div>

        {/* Messages — same style as Chat Pipeline */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 min-h-[320px]">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-orange-500/20 text-white' : 'bg-white/10 text-slate-200'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {tutorLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-2 bg-white/10 text-gray-400 text-sm">Thinking…</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {(tutorError || videoError) && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {tutorError || videoError}
          </div>
        )}

        {/* Previews */}
        {attachedVideo && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <Video className="w-5 h-5 text-orange-400" />
              <span className="text-sm">Video ({attachedVideo.duration.toFixed(1)}s)</span>
            </div>
            <button type="button" onClick={removeVideo} className="p-1.5 bg-red-500/80 rounded-lg hover:bg-red-500">×</button>
          </div>
        )}
        {!attachedVideo && attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedImages.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.preview} alt="" className="w-16 h-16 object-cover rounded-lg" />
                <button type="button" onClick={() => removeImage(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Input bar — mic, attach, speaker, input, send */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={tutorRecording ? stopVoice : startVoice}
              disabled={tutorLoading}
              className={`p-3 rounded-lg ${tutorRecording ? 'bg-red-500/30' : 'bg-white/10 hover:bg-white/20'}`}
              title={tutorRecording ? 'Stop recording' : 'Record voice'}
            >
              {tutorRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={tutorLoading}
              className="p-3 rounded-lg bg-white/10 hover:bg-white/20"
              title="Attach image or video"
            >
              <ImagePlus className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime,video/mpeg,.mov,.mp4,.webm,.mpeg"
              multiple={!attachedVideo}
              className="hidden"
              onChange={handleFileSelect}
            />

            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-[140px] text-white"
              title="Voice (OpenAI or Magic Hour)"
            >
              {TTS_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setTtsEnabled((v) => !v)}
              className={`p-3 rounded-lg ${ttsEnabled ? 'bg-emerald-500/30' : 'bg-white/10 hover:bg-white/20'}`}
              title="Speak response"
            >
              <Volume2 className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendToTutor())}
              placeholder="Type a message or attach image/video…"
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-slate-500"
              disabled={tutorLoading}
            />

            <button
              type="submit"
              disabled={tutorLoading || (!text.trim() && attachedImages.length === 0 && !attachedVideo)}
              className="p-3 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Choose voice (OpenAI or Magic Hour) • {ttsEnabled ? '✓ Speak response on. ' : 'Click speaker to hear replies. '}
            Press mic to speak — auto-sends when you stop talking
          </p>
        </form>
      </div>
    </DashboardShell>
  );
}
