'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

const MAX_VIDEO_SECONDS = 20;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
  videoPreview?: string;
  videoDuration?: number;
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
  const [attachedVideo, setAttachedVideo] = useState<{ file: File; preview: string; duration: number } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const canSend = chatMode === 'roast'
    ? attachedImages.length > 0 || attachedVideo !== null
    : (input.trim() || attachedImages.length > 0);

  const sendMessage = async () => {
    if ((!input.trim() && attachedImages.length === 0 && !attachedVideo) || isLoading) return;

    const userContent = input.trim() || (attachedVideo ? '(See video)' : '(See image)');
    const userMessage: Message = {
      role: 'user',
      content: userContent,
      imagePreview: attachedImages[0]?.preview,
      videoPreview: attachedVideo?.preview,
      videoDuration: attachedVideo?.duration,
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    const currentImages = [...attachedImages];
    const currentVideo = attachedVideo;
    setInput('');
    setAttachedImages([]);
    setAttachedVideo(null);
    setVideoError(null);
    setIsLoading(true);

    try {
      const apiMessages = [
        ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user' as const, content: currentInput || (currentVideo ? '(See video)' : '(See image)') },
      ];

      let imagesBase64: string[] | undefined;
      let videoBase64: string | undefined;
      let videoMime: string | undefined;
      if (currentVideo) {
        videoBase64 = await fileToBase64(currentVideo.file);
        const f = currentVideo.file;
        videoMime = f.type?.startsWith('video/') ? f.type : (f.name?.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
      } else if (currentImages.length > 0) {
        imagesBase64 = await Promise.all(currentImages.map(({ file }) => fileToBase64(file)));
      }

      const response = await api.sendChatMessage(
        apiMessages,
        selectedModel,
        imagesBase64,
        chatMode,
        videoBase64,
        videoMime
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message || 'Sorry, I could not process your request.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
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
        })
        .catch(() => {
          // e.g. .mov not decodable in this browser; still attach and let backend handle it
          setAttachedVideo({ file, preview: URL.createObjectURL(file), duration: 0 });
          setAttachedImages([]);
        });
      e.target.value = '';
      return;
    }
    if (chatMode === 'roast' && attachedVideo) setAttachedVideo(null);
    const newList: { file: File; preview: string }[] = [];
    for (let i = 0; i < Math.min(files.length, 3); i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      newList.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setAttachedImages((prev) => [...prev, ...newList].slice(0, 3));
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
                  {message.imagePreview && (
                    <img
                      src={message.imagePreview}
                      alt="Attached"
                      className="rounded-lg mb-2 max-h-24 object-cover"
                    />
                  )}
                  {message.videoPreview && (
                    <div className="rounded-lg mb-2 max-h-24 overflow-hidden bg-black/30 flex items-center justify-center gap-2 text-gray-400 text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Video{message.videoDuration != null ? ` (${message.videoDuration.toFixed(1)}s)` : ''}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 text-gray-400 rounded-xl p-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
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
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept={chatMode === 'roast' ? 'image/*,video/mp4,video/webm,video/quicktime,video/mpeg,.mov,.mp4,.webm,.mpeg' : 'image/*'}
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
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={chatMode === 'roast' ? 'Attach image or video ≤20s (optional caption)…' : 'Type your message or attach an image…'}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !canSend}
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
