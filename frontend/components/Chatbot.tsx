'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

const MAX_VIDEO_SECONDS = 20;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
  imagePreviews?: string[];
  videoPreview?: string;
  videoDuration?: number;
  ttsError?: string;
}

function pickRecorderMime(): string | undefined {
  const c = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  for (const t of c) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
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

const VIDEO_EXTENSIONS = ['.mov', '.mp4', '.webm', '.mpeg', '.mpeg4'];
function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  const name = (file.name || '').toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

const CHAT_MODELS = [
  { id: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
] as const;

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'assistant' | 'roast'>('assistant');
  const [selectedModel, setSelectedModel] = useState<string>(CHAT_MODELS[0].id);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<{ file: File; preview: string }[]>([]);
  const [attachedPdfs, setAttachedPdfs] = useState<{ file: File }[]>([]);
  const [attachedVideo, setAttachedVideo] = useState<{ file: File; preview: string; duration: number } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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
    if (isLoading || isTranscribing) return;
    if (isRecordingRef.current) {
      stopRecording();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
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
            if (t) setInput((prev) => (prev ? `${prev} ${t}` : t).trim());
          } catch (err) {
            console.error('Transcription failed:', err);
          } finally {
            setIsTranscribing(false);
          }
        })();
      };
      mr.start(250);
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (e) {
      console.error('Microphone access failed:', e);
    }
  }, [isLoading, isTranscribing, stopRecording]);

  const canSend = chatMode === 'roast'
    ? attachedImages.length > 0 || attachedVideo !== null
    : (input.trim() || attachedImages.length > 0 || attachedPdfs.length > 0);

  const sendMessage = async () => {
    if ((!input.trim() && attachedImages.length === 0 && attachedPdfs.length === 0 && !attachedVideo) || isLoading) return;

    stopPlayback();
    setSpeakingIndex(null);

    const userContent = input.trim() || (attachedVideo ? '(See video)' : attachedPdfs.length ? '(PDF attached)' : '(See image)');
    const userMessage: Message = {
      role: 'user',
      content: userContent,
      imagePreview: attachedImages[0]?.preview,
      imagePreviews: attachedImages.length > 0 ? attachedImages.map((x) => x.preview) : undefined,
      videoPreview: attachedVideo?.preview,
      videoDuration: attachedVideo?.duration,
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    const currentImages = [...attachedImages];
    const currentPdfs = [...attachedPdfs];
    const currentVideo = attachedVideo;
    setInput('');
    setAttachedImages([]);
    setAttachedPdfs([]);
    setAttachedVideo(null);
    setVideoError(null);
    setIsLoading(true);

    try {
      const priorForPipeline = messages.map((msg) => ({ role: msg.role, content: msg.content }));
      const textPayload =
        currentInput.trim() ||
        (currentVideo ? '(See video)' : currentPdfs.length ? '(PDF attached)' : '(See image)');

      const imageFiles = currentImages.map(({ file }) => file);
      const pdfFiles = currentPdfs.map(({ file }) => file);
      const allAttach = [...imageFiles, ...pdfFiles];

      const response = await api.chatPipeline({
        text: textPayload,
        messages: priorForPipeline,
        images: allAttach.length > 0 ? allAttach : undefined,
        video: currentVideo?.file,
        model: selectedModel,
        mode: chatMode,
        tts: ttsEnabled,
        voice: 'coral',
        tts_provider: 'openai',
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message || 'Sorry, I could not process your request.',
        ttsError: response.tts_error,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (ttsEnabled && response.audio_base64 && response.audio_format) {
        playPipelineAudio(response.audio_base64, response.audio_format);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: error instanceof Error
          ? `Error: ${error.message}. Please check your backend configuration.`
          : 'Sorry, there was an error. Ensure the backend is running and OPENROUTER_API_KEY is set.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const isPdfFile = (f: File) => f.type === 'application/pdf' || (f.name || '').toLowerCase().endsWith('.pdf');

  const addImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setVideoError(null);
    const file = files[0];
    const isVideo = isVideoFile(file);
    if (chatMode === 'roast' && isVideo) {
      getVideoDuration(file)
        .then((duration) => {
          if (duration > MAX_VIDEO_SECONDS) {
            setVideoError(`Video must be ${MAX_VIDEO_SECONDS} seconds or less (this one is ${duration.toFixed(1)}s).`);
            return;
          }
          setAttachedVideo({
            file,
            preview: URL.createObjectURL(file),
            duration,
          });
          setAttachedImages([]);
          setAttachedPdfs([]);
        })
        .catch(() => {
          setAttachedVideo({ file, preview: URL.createObjectURL(file), duration: 0 });
          setAttachedImages([]);
          setAttachedPdfs([]);
        });
      e.target.value = '';
      return;
    }
    if (chatMode === 'roast' && attachedVideo) setAttachedVideo(null);
    const newList: { file: File; preview: string }[] = [];
    const newPdfs: { file: File }[] = [];
    for (let i = 0; i < Math.min(files.length, 3); i++) {
      const f = files[i];
      if (chatMode !== 'roast' && isPdfFile(f)) newPdfs.push({ file: f });
      else if (f.type.startsWith('image/')) newList.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setAttachedImages((prev) => [...prev, ...newList].slice(0, 3));
    setAttachedPdfs((prev) => [...prev, ...newPdfs].slice(0, 2));
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

  const removePdf = (index: number) => {
    setAttachedPdfs((prev) => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    if (attachedVideo) {
      URL.revokeObjectURL(attachedVideo.preview);
      setAttachedVideo(null);
      setVideoError(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Button - matches Claude Home™ dark theme */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-400 text-white rounded-full p-4 shadow-lg shadow-orange-500/25 transition-all duration-200 hover:scale-105 z-50"
          aria-label="Open chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
      )}

      {/* Chat Window - dark theme */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-[#0c0712] rounded-xl shadow-2xl flex flex-col z-50 border border-white/10 backdrop-blur-xl">
          {/* Header */}
          <div className="bg-orange-500/20 border-b border-white/10 text-white p-4 rounded-t-xl flex flex-col gap-2">
            {/* Tabs: Assistant | Roast */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setChatMode('assistant');
                  if (attachedVideo) removeVideo();
                }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  chatMode === 'assistant' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Assistant
              </button>
              <button
                type="button"
                onClick={() => setChatMode('roast')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  chatMode === 'roast' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Roast
              </button>
            </div>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">{chatMode === 'roast' ? 'Roast AI' : 'AI Assistant'}</h3>
              <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Close chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            </div>
            {/* Model selector — for text; images always use vision model */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                disabled={isLoading}
              >
                {CHAT_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0c0712] text-white">
                    {m.label}
                  </option>
                ))}
              </select>
              {attachedImages.length > 0 && (
                <span className="text-xs text-gray-400">(images → vision model)</span>
              )}
              {attachedVideo && (
                <span className="text-xs text-amber-400/90">Video → video model</span>
              )}
              {chatMode === 'roast' && !attachedVideo && attachedImages.length === 0 && (
                <span className="text-xs text-amber-400/90">Image or video (max {MAX_VIDEO_SECONDS}s)</span>
              )}
            </div>
            <label className="mt-1 inline-flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-white/20 bg-white/10 text-orange-500 focus:ring-orange-500"
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
                disabled={isLoading}
              />
              Read replies aloud (text-to-speech)
            </label>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/5">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl p-3 ${
                    message.role === 'user'
                      ? 'bg-orange-500/20 border border-orange-500/30 text-white'
                      : 'bg-white/5 border border-white/10 text-gray-200'
                  }`}
                >
                  {(message.imagePreviews?.length ?? (message.imagePreview ? 1 : 0)) > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(message.imagePreviews ?? (message.imagePreview ? [message.imagePreview] : [])).map((src, j) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={j} src={src} alt="Attached" className="rounded-lg max-h-32 object-cover border border-white/20" />
                      ))}
                    </div>
                  )}
                  {message.videoPreview && (
                    <div className="rounded-lg mb-2 max-h-24 overflow-hidden bg-black/30 flex items-center justify-center gap-2 text-gray-400 text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Video{message.videoDuration != null ? ` (${message.videoDuration.toFixed(1)}s)` : ''}
                    </div>
                  )}
                  {message.content && (message.content !== '(See image)' || !(message.imagePreviews?.length ?? message.imagePreview)) && (
                    <div className="flex items-start gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1 min-w-0">{message.content}</p>
                      {message.role === 'assistant' && message.content.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => speakAssistantText(message.content, index)}
                          disabled={speakingIndex === index || isLoading}
                          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-orange-400 hover:bg-white/10 disabled:opacity-40 transition-colors"
                          aria-label="Play message as speech"
                          title="Text-to-speech"
                        >
                          {speakingIndex === index ? (
                            <span className="block h-5 w-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  {message.role === 'assistant' && message.ttsError && (
                    <p className="text-xs text-amber-400/90 mt-2">{message.ttsError}</p>
                  )}
                </div>
              </div>
            ))}
            {(isLoading || isTranscribing) && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 text-gray-400 rounded-xl p-3">
                  {isTranscribing && !isLoading ? (
                    <p className="text-xs">Transcribing speech…</p>
                  ) : (
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-xl">
            {videoError && (
              <p className="text-amber-400 text-xs mb-2">{videoError}</p>
            )}
            {attachedVideo && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-300">Video ({attachedVideo.duration.toFixed(1)}s)</span>
                </div>
                <button
                  type="button"
                  onClick={removeVideo}
                  className="p-1.5 bg-red-500/80 text-white rounded-lg hover:bg-red-500"
                  aria-label="Remove video"
                >
                  ×
                </button>
              </div>
            )}
            {attachedImages.length > 0 && !attachedVideo && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt="" className="h-14 w-14 rounded-lg object-cover border border-white/10" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1 -right-1 bg-red-500/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachedPdfs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachedPdfs.map((pdf, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-sm truncate max-w-[120px]" title={pdf.file.name}>{pdf.file.name}</span>
                    <button type="button" onClick={() => removePdf(i)} className="p-1.5 bg-red-500/80 rounded hover:bg-red-500 text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept={chatMode === 'roast' ? 'image/*,video/mp4,video/webm,video/quicktime,video/mpeg,.mov,.mp4,.webm,.mpeg' : 'image/*,application/pdf,.pdf'}
                multiple={chatMode !== 'roast'}
                className="hidden"
                onChange={addImages}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-orange-400 hover:bg-white/5 rounded-lg transition-colors shrink-0"
                aria-label="Attach image"
                disabled={isLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void toggleMic()}
                className={`p-2 rounded-lg transition-colors shrink-0 ${
                  isRecording
                    ? 'text-red-300 bg-red-500/25 ring-2 ring-red-400/50 animate-pulse'
                    : 'text-gray-400 hover:text-orange-400 hover:bg-white/5'
                }`}
                aria-label={isRecording ? 'Stop recording and transcribe' : 'Speech to text (microphone)'}
                title={isRecording ? 'Stop — transcribe to text' : 'Speak — transcribe to text'}
                disabled={isLoading || isTranscribing}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  chatMode === 'roast'
                    ? 'Attach image or video ≤20s (optional caption)…'
                    : 'Type, attach files, or use the mic for speech-to-text…'
                }
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                disabled={isLoading || isTranscribing}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || isTranscribing || !canSend}
                className="bg-orange-500 hover:bg-orange-400 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
