'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTeamPlanning } from '@/lib/teamPlanningContext';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import { checkTeamAvailability, getStoredCalendarToken } from '@/lib/googleCalendar';
import type { TeamPlan } from '@/lib/travelTypes';
import { Send, Sparkles, MapPin, Calendar, DollarSign, Loader2, Mic } from 'lucide-react';
import StartPlanningDropdown from '@/components/travel/StartPlanningDropdown';
import { api } from '@/lib/api';

// ── OpenRouter Config ────────────────────────────────────────────────────────
const OPENROUTER_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? '';

// ── Agent definitions ─────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: 'atlas',
    name: 'Atlas',
    role: 'Local Guide',
    emoji: '🌍',
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    textColor: 'text-emerald-700',
    bubbleColor: 'bg-emerald-500',
    ttsVoice: 'onyx',
    systemPrompt: `You are Atlas, an expert local travel guide. You know every destination intimately — hidden gems, must-see attractions, local restaurants, cultural events, and the best times to visit specific places. When the user mentions a destination, immediately suggest specific places to visit, with concrete day-by-day recommendations (e.g., "Day 1 morning: Visit Silver Dollar City..."). Be enthusiastic, specific, and helpful. Keep responses concise (3-5 bullet points max).`,
  },
  {
    id: 'aria',
    name: 'Aria',
    role: 'Personal Assistant',
    emoji: '📅',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    textColor: 'text-blue-700',
    bubbleColor: 'bg-blue-500',
    ttsVoice: 'nova',
    systemPrompt: `You are Aria, a personal assistant with access to the team's Google Calendars. When Atlas suggests dates, your job is to confirm whether those dates work for all team members based on their calendar availability. You will receive calendar availability info as context. If all members are free: confirm enthusiastically. If someone has conflicts: suggest alternative dates. Always be diplomatic and solution-oriented. Keep responses concise (2-4 sentences).`,
  },
  {
    id: 'sage',
    name: 'Sage',
    role: 'Trip Planner',
    emoji: '💼',
    color: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    textColor: 'text-amber-700',
    bubbleColor: 'bg-amber-500',
    ttsVoice: 'shimmer',
    systemPrompt: `You are Sage, an expert trip planner and budget analyst. You synthesize Atlas's location recommendations and Aria's calendar confirmations into practical, cost-aware travel plans. Research typical hotel prices, flight costs, and activity costs. Provide realistic budget estimates (low/high range). When all agents agree, summarize the plan concisely. When the user says "I agree", "let's approve", or "make approval list", respond with ONLY a valid JSON object (no markdown, no extra text) in this exact format:
{"destination":"...","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","highlights":["..."],"budgetEstimateUSD":{"low":0,"high":0},"dayByDay":[{"day":1,"date":"YYYY-MM-DD","morning":"...","afternoon":"...","evening":"...","hotel":"..."}],"notes":"...","rawSummary":"..."}`,
  },
];

type AgentId = 'atlas' | 'aria' | 'sage' | 'user' | 'system';

interface ChatMessage {
  id: string;
  agentId: AgentId;
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

// Trigger phrases that activate plan generation
const APPROVAL_TRIGGERS = ['i agree', "let's approve", 'lets approve', 'make approval', 'approve the plan', 'generate plan', 'looks good'];

function agentById(id: AgentId) {
  return AGENTS.find(a => a.id === id);
}

// ── Animated orb ─────────────────────────────────────────────────────────────
function AgentOrb({ agent, status }: { agent: typeof AGENTS[0]; status: 'idle' | 'thinking' | 'speaking' }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center shadow-lg`}>
        <span className="text-2xl">{agent.emoji}</span>
        {status === 'thinking' && (
          <div className="absolute inset-0 rounded-full border-2 border-white/50 animate-ping" />
        )}
        {status === 'speaking' && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-gray-900">{agent.name}</p>
        <p className="text-[10px] text-gray-500">{agent.role}</p>
        <div className={`text-[9px] font-semibold mt-0.5 ${status === 'thinking' ? 'text-amber-500' :
            status === 'speaking' ? 'text-green-500' : 'text-gray-400'
          }`}>
          {status === 'thinking' ? '⚡ Thinking…' : status === 'speaking' ? '💬 Talking' : '● Idle'}
        </div>
      </div>
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const agent = agentById(msg.agentId);
  const isUser = msg.agentId === 'user';
  const isSystem = msg.agentId === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] text-gray-400 bg-gray-100 rounded-full px-3 py-1">{msg.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && agent && (
        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0 mt-1 shadow-sm`}>
          <span className="text-sm">{agent.emoji}</span>
        </div>
      )}
      <div className={`max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {!isUser && agent && (
          <span className="text-[10px] font-bold text-gray-400 px-1">{agent.name} · {agent.role}</span>
        )}
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${isUser
            ? 'bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-tr-sm'
            : `${agent?.bg ?? 'bg-gray-100'} ${agent?.textColor ?? 'text-gray-800'} ${agent?.border ?? ''} border rounded-tl-sm`
          }`}>
          {msg.isTyping ? (
            <div className="flex gap-1 items-center py-0.5">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlanRoomInner() {
  const { user, loading } = useTravelAuth();
  const { setGeneratedPlan, unlockStage, activeTeamId } = useTeamPlanning();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      agentId: 'system',
      content: 'Welcome to the TripReady Copilot Hub. Tell us your destination to get started!',
      timestamp: new Date(),
    },
    {
      id: 'atlas-intro',
      agentId: 'atlas',
      content: "Hi! I'm Atlas, your local guide 🌍 Just tell us where you're thinking of going and I'll suggest the best spots, hidden gems, and a day-by-day plan!",
      timestamp: new Date(),
    },
    {
      id: 'aria-intro',
      agentId: 'aria',
      content: "And I'm Aria 📅 Once Atlas suggests dates, I'll check everyone's Google Calendar to make sure you're all free. Make sure team members connect their calendars on the Team page!",
      timestamp: new Date(),
    },
    {
      id: 'sage-intro',
      agentId: 'sage',
      content: "I'm Sage 💼 I'll crunch the numbers on flights, hotels, and activities so you know exactly what to budget. When you're happy with the plan, just say \"I agree\" and I'll generate the approval list!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [agentStatus, setAgentStatus] = useState<Record<string, 'idle' | 'thinking' | 'speaking'>>({
    atlas: 'idle', aria: 'idle', sage: 'idle',
  });
  const [planGenerating, setPlanGenerating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<string[]>([]);

  // Mic state
  const inputRef = useRef(input);
  const sendRef = useRef<(txt?: string) => Promise<void>>(async () => { });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const vadRafRef = useRef<number | null>(null);
  const vadAudioContextRef = useRef<AudioContext | null>(null);
  const speechStartMsRef = useRef<number | null>(null);

  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceOrbState, setVoiceOrbState] = useState<'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'>('idle');
  const [activeVoiceAgentId, setActiveVoiceAgentId] = useState<string | null>(null);

  const voiceModeRef = useRef(voiceMode);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
      stopPlayback();
      if (vadRafRef.current != null) cancelAnimationFrame(vadRafRef.current);
      void vadAudioContextRef.current?.close().catch(() => { });
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopRecording, stopPlayback]);

  const playAgentAudio = useCallback(async (text: string, voice: string): Promise<void> => {
    if (!voiceModeRef.current) return;
    return new Promise(async (resolve) => {
      try {
        const plainText = text.replace(/[*#]/g, '').trim().slice(0, 1000); // Strip markdown for concise reading
        if (!plainText) return resolve();
        const blob = await api.generateVoice({ text: plainText, provider: 'openai', voice });
        if (!voiceModeRef.current) return resolve(); // In case it was closed during generation
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        playbackRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        await audio.play();
      } catch {
        resolve();
      }
    });
  }, []);

  const startListening = useCallback(async () => {
    if (isRecordingRef.current) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert('Microphone is not available in this browser.');
      return;
    }
    try {
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
        if (vadRafRef.current != null) cancelAnimationFrame(vadRafRef.current);
        void vadAudioContextRef.current?.close().catch(() => { });
        vadAudioContextRef.current = null;

        stream.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        mediaRecorderRef.current = null;
        isRecordingRef.current = false;
        setIsRecording(false);
        setVoiceOrbState('transcribing');

        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        recordChunksRef.current = [];
        if (blob.size < 200) {
          // Restart listening if too short and still in voice mode
          if (voiceModeRef.current) setTimeout(startListening, 500);
          return;
        }

        const ext = (mr.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `speech.${ext}`, { type: blob.type || `audio/${ext}` });

        setIsTranscribing(true);
        void (async () => {
          try {
            const { text } = await api.transcribeAudio(file);
            const t = (text || '').trim();
            if (t) {
              const combined = [inputRef.current.trim(), t].filter(Boolean).join(' ').trim();
              if (combined) {
                await sendRef.current(combined);
              }
            } else if (voiceModeRef.current) {
              setTimeout(startListening, 500); // Nothing heard, restart loop
            }
          } catch (e) {
            console.error('Transcription error', e);
            if (voiceModeRef.current) setTimeout(startListening, 500);
          } finally {
            setIsTranscribing(false);
            if (!voiceModeRef.current) setVoiceOrbState('idle');
          }
        })();
      };

      mr.start(250);
      isRecordingRef.current = true;
      setIsRecording(true);
      if (voiceModeRef.current) setVoiceOrbState('listening');

      const ACtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (ACtx) {
        try {
          const audioCtx = new ACtx();
          vadAudioContextRef.current = audioCtx;
          if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => { });
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
      alert('Microphone permission denied or error occurred.');
    }
  }, [stopRecording]);

  const toggleVoiceMode = () => {
    if (voiceMode) {
      setVoiceMode(false);
      stopRecording();
      stopPlayback();
      setVoiceOrbState('idle');
    } else {
      setVoiceMode(true);
      void startListening();
    }
  };

  // Build full conversation context for Gemini
  const getHistory = () => messages.filter(m => !m.isTyping).map(m => {
    const agent = agentById(m.agentId);
    const prefix = m.agentId === 'user' ? 'User' : m.agentId === 'system' ? 'System' : `${agent?.name} (${agent?.role})`;
    return `${prefix}: ${m.content}`;
  }).join('\n');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addTypingIndicator = (agentId: AgentId): string => {
    const id = `typing-${agentId}-${Date.now()}`;
    setMessages(prev => [...prev, { id, agentId, content: '', timestamp: new Date(), isTyping: true }]);
    return id;
  };

  const replaceTyping = (typingId: string, agentId: AgentId, content: string) => {
    setMessages(prev => prev.map(m =>
      m.id === typingId ? { ...m, content, isTyping: false, id: `msg-${Date.now()}-${agentId}` } : m
    ));
  };

  const askAgent = useCallback(async (agentIdx: number, userMsg: string, extraContext = ''): Promise<string> => {
    const agent = AGENTS[agentIdx];
    if (!OPENROUTER_KEY) {
      return `⚠️ OpenRouter API key not configured. Add NEXT_PUBLIC_OPENROUTER_API_KEY to your .env.local file.`;
    }
    const history = getHistory();
    const prompt = `${agent.systemPrompt}\n\n${extraContext ? `[Context: ${extraContext}]\n\n` : ''}Conversation so far:\n${history}\n\nUser just said: "${userMsg}"\n\nRespond as ${agent.name}:`;
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash", // Using OpenRouter's gemini-1.5-flash route
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Failed to fetch from OpenRouter");
    return data.choices[0].message.content.trim();
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch calendar availability for all team members and return a summary string
  const getCalendarContext = async (startDate: string, endDate: string): Promise<string> => {
    if (!activeTeamId) return 'No team selected.';
    try {
      // We don't have member user IDs directly here, use stored tokens
      // The IDs are stored as gcal_token_<userId> — build list from current user
      const memberIds = conversationRef.current.length > 0 ? conversationRef.current : [user?.sub ?? ''];
      const { summary } = await checkTeamAvailability(memberIds, startDate, endDate);
      return summary;
    } catch {
      return 'Could not fetch calendar data.';
    }
  };

  // Extract probable dates from a message (simple regex for "June 14" etc.)
  const extractDates = (text: string): { start: string; end: string } | null => {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const year = new Date().getFullYear();
    const match = text.match(/(\w+)\s+(\d{1,2})(?:\s*[-–to]+\s*(\w+\s+)?(\d{1,2}))?/i);
    if (!match) return null;
    const mon = months[match[1].toLowerCase().slice(0, 3)];
    if (!mon) return null;
    const day1 = match[2].padStart(2, '0');
    const day2 = (match[4] ?? String(parseInt(day1) + 2)).padStart(2, '0');
    return { start: `${year}-${mon}-${day1}`, end: `${year}-${mon}-${day2}` };
  };

  const isApprovalTrigger = (text: string) =>
    APPROVAL_TRIGGERS.some(t => text.toLowerCase().includes(t));

  const handleSend = async (textOverride?: string) => {
    const textToProcess = typeof textOverride === 'string' ? textOverride : input;
    const trimmed = textToProcess.trim();
    if (!trimmed || isProcessing) return;
    if (typeof textOverride !== 'string') setInput('');
    setIsProcessing(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      agentId: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Check if this is an approval trigger
    if (isApprovalTrigger(trimmed)) {
      setPlanGenerating(true);
      if (voiceModeRef.current) {
        setVoiceOrbState('thinking');
        setActiveVoiceAgentId('sage');
      }
      const typId = addTypingIndicator('sage');
      setAgentStatus(s => ({ ...s, sage: 'thinking' }));
      try {
        const planJson = await askAgent(2, trimmed);
        // Try to parse JSON response from Sage
        let plan: TeamPlan;
        try {
          // Extract JSON even if wrapped in backticks
          const jsonMatch = planJson.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch?.[0] ?? planJson);
          plan = { ...parsed, generatedAt: new Date().toISOString() } as TeamPlan;
        } catch {
          // Fallback: create a basic plan from the text
          plan = {
            generatedAt: new Date().toISOString(),
            destination: 'Branson, MO',
            startDate: new Date().toISOString().slice(0, 10),
            endDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
            highlights: ['Silver Dollar City', 'Table Rock Lake', 'Branson Landing'],
            budgetEstimateUSD: { low: 800, high: 1500 },
            dayByDay: [],
            notes: planJson.slice(0, 500),
            rawSummary: planJson,
          };
        }
        setGeneratedPlan(plan);
        unlockStage('approve');
        const msg = "🎉 Perfect! I've generated your travel plan and sent it to the **Approve** page. The leader or co-leader can now give the final OK. Check the 'Start Planning' menu → Approve!";
        replaceTyping(typId, 'sage', msg);
        if (voiceModeRef.current) {
          setVoiceOrbState('speaking');
          await playAgentAudio(msg, AGENTS[2].ttsVoice);
        }
        setMessages(prev => [...prev, {
          id: 'system-unlock',
          agentId: 'system',
          content: '✅ Approve stage unlocked! Go to Start Planning → Approve.',
          timestamp: new Date(),
        }]);
      } catch (e) {
        const errStr = `Sorry, I had trouble generating the plan. Try again!`;
        replaceTyping(typId, 'sage', errStr);
        if (voiceModeRef.current) {
          setVoiceOrbState('speaking');
          await playAgentAudio(errStr, AGENTS[2].ttsVoice);
        }
      } finally {
        setAgentStatus(s => ({ ...s, sage: 'idle' }));
        setPlanGenerating(false);
        setIsProcessing(false);
        if (voiceModeRef.current) {
          setVoiceOrbState('idle');
          toggleVoiceMode(); // End voice mode naturally on completion
        }
      }
      return;
    }

    // Normal multi-agent discussion flow
    const voicePromptInjection = "[VOICE MODE ACTIVE: The user is listening via audio. DO NOT use markdown, lists, or bullets. Provide your answer as exactly ONE highly concise spoken sentence under 20 words.]";

    // 1. Atlas responds first
    const atlasTypId = addTypingIndicator('atlas');
    setAgentStatus(s => ({ ...s, atlas: 'thinking' }));
    if (voiceModeRef.current) {
      setVoiceOrbState('thinking');
      setActiveVoiceAgentId('atlas');
    }

    let atlasReply = '';
    try {
      atlasReply = await askAgent(0, trimmed, voiceModeRef.current ? voicePromptInjection : '');
      if (!isMountedRef.current) return;
      replaceTyping(atlasTypId, 'atlas', atlasReply);
      setAgentStatus(s => ({ ...s, atlas: 'speaking' }));
      if (voiceModeRef.current) {
        setVoiceOrbState('speaking');
        await playAgentAudio(atlasReply, AGENTS[0].ttsVoice);
      }
    } catch {
      if (isMountedRef.current) replaceTyping(atlasTypId, 'atlas', "I'd love to suggest some places — make sure your OpenRouter API key is set!");
    }
    if (isMountedRef.current) setAgentStatus(s => ({ ...s, atlas: 'idle' }));

    // 2. Aria responds after a delay — checks calendar for dates mentioned
    if (!voiceModeRef.current) await new Promise(r => setTimeout(r, 900));
    const ariaTypId = addTypingIndicator('aria');
    setAgentStatus(s => ({ ...s, aria: 'thinking' }));
    if (voiceModeRef.current) {
      setVoiceOrbState('thinking');
      setActiveVoiceAgentId('aria');
    }

    try {
      // Try to extract dates from Atlas's reply or user message
      const combined = `${trimmed} ${atlasReply}`;
      const dates = extractDates(combined);
      let calContext = '';
      if (dates) {
        calContext = await getCalendarContext(dates.start, dates.end);
      } else {
        calContext = 'No specific dates were mentioned yet. Remind the team to specify travel dates.';
      }
      const ariaReply = await askAgent(1, trimmed, `${voiceModeRef.current ? voicePromptInjection + '\n\n' : ''}${calContext}`);
      if (!isMountedRef.current) return;
      replaceTyping(ariaTypId, 'aria', ariaReply);
      setAgentStatus(s => ({ ...s, aria: 'speaking' }));
      if (voiceModeRef.current) {
        setVoiceOrbState('speaking');
        await playAgentAudio(ariaReply, AGENTS[1].ttsVoice);
      }
    } catch {
      if (isMountedRef.current) replaceTyping(ariaTypId, 'aria', "I'm checking calendars — make sure your OpenRouter API key is set!");
    }
    if (isMountedRef.current) setAgentStatus(s => ({ ...s, aria: 'idle' }));

    // 3. Sage responds last with cost synthesis
    if (!voiceModeRef.current) await new Promise(r => setTimeout(r, 1000));
    const sageTypId = addTypingIndicator('sage');
    setAgentStatus(s => ({ ...s, sage: 'thinking' }));
    if (voiceModeRef.current) {
      setVoiceOrbState('thinking');
      setActiveVoiceAgentId('sage');
    }

    try {
      const sageReply = await askAgent(2, trimmed, voiceModeRef.current ? voicePromptInjection : '');
      if (!isMountedRef.current) return;
      replaceTyping(sageTypId, 'sage', sageReply);
      setAgentStatus(s => ({ ...s, sage: 'speaking' }));
      if (voiceModeRef.current) {
        setVoiceOrbState('speaking');
        await playAgentAudio(sageReply, AGENTS[2].ttsVoice);
      }
    } catch {
      if (isMountedRef.current) replaceTyping(sageTypId, 'sage', "I'm compiling cost estimates — add your OpenRouter API key!");
    }
    if (isMountedRef.current) setAgentStatus(s => ({ ...s, sage: 'idle' }));

    setIsProcessing(false);

    // Auto-resume listening loop if still in voice mode
    if (voiceModeRef.current) void startListening();
  };

  useEffect(() => {
    sendRef.current = handleSend;
  }, [handleSend]);

  if (loading || !user) {
    return <div className="py-16 text-center text-sm text-gray-400">Signing you in…</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-148px)] -mt-1">
      {/* Agent status bar */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-3 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-violet-500" />
            AI Planning Room
          </h2>
          <StartPlanningDropdown />
        </div>
        <div className="flex items-center justify-around">
          {AGENTS.map(agent => (
            <AgentOrb key={agent.id} agent={agent} status={agentStatus[agent.id] ?? 'idle'} />
          ))}
        </div>
      </div>

      {/* Key legend */}
      <div className="flex items-center gap-3 px-1 mb-2">
        {[
          { icon: <MapPin className="w-3 h-3" />, label: 'Ask about a destination', color: 'text-emerald-600' },
          { icon: <Calendar className="w-3 h-3" />, label: 'Calendar is auto-checked', color: 'text-blue-600' },
          { icon: <DollarSign className="w-3 h-3" />, label: 'Costs are estimated', color: 'text-amber-600' },
        ].map(item => (
          <div key={item.label} className={`flex items-center gap-1 text-[10px] font-medium ${item.color}`}>
            {item.icon} {item.label}
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-3 bg-gray-50 rounded-2xl border border-gray-100 p-3">
        {messages.map(msg => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Approval hint */}
      <div className="text-center py-1.5">
        <p className="text-[10px] text-gray-400">
          When ready → say <span className="font-semibold text-violet-600">&quot;I agree&quot;</span> or <span className="font-semibold text-violet-600">&quot;let&apos;s approve&quot;</span> to generate the plan
        </p>
      </div>

      {/* Input */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-2">
        <button
          onClick={toggleVoiceMode}
          disabled={isProcessing || isTranscribing}
          className={`w-9 h-9 flex items-center justify-center shrink-0 rounded-xl transition-all ${isRecording ? 'bg-red-50 text-red-600 animate-pulse border border-red-200' : 'bg-gray-50 hover:bg-gray-100 text-gray-500 border border-gray-100'
            }`}
          title="Start Voice Conversation"
        >
          <Mic className="w-4 h-4" />
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={planGenerating ? 'Generating plan…' : isTranscribing ? 'Transcribing...' : isRecording ? 'Listening...' : 'Tell us your destination...'}
          disabled={isProcessing || isTranscribing || isRecording}
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none py-1.5 disabled:opacity-50"
        />
        <button
          onClick={() => handleSend()}
          disabled={isProcessing || isTranscribing || !input.trim()}
          className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Siri-style Voice Mode Overlay */}
      {voiceMode && (
        <div className="fixed inset-0 z-[999] bg-gray-900/80 backdrop-blur-lg flex flex-col items-center justify-center animate-in fade-in duration-300 pb-16">
          <div className="flex-1 flex flex-col items-center justify-center w-full px-8">
            <h3 className="text-white/80 font-bold uppercase tracking-widest text-sm mb-12">
              {voiceOrbState === 'listening' ? 'Listening...' :
               voiceOrbState === 'transcribing' ? 'Transcribing...' :
               voiceOrbState === 'thinking' ? `${agentById(activeVoiceAgentId || 'atlas')?.name} is thinking...` :
               voiceOrbState === 'speaking' ? `${agentById(activeVoiceAgentId || 'atlas')?.name} is speaking` :
               'Connecting...'}
            </h3>

            {/* Glowing Orb */}
            <div className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700
              ${voiceOrbState === 'listening' ? 'scale-110 shadow-[0_0_80px_rgba(255,255,255,0.4)] bg-white/20' : 
                voiceOrbState === 'speaking' ? 'scale-125 shadow-[0_0_100px_rgba(139,92,246,0.6)] bg-violet-500/40' : 
                'scale-100 shadow-[0_0_40px_rgba(255,255,255,0.1)] bg-white/5'}
            `}>
              <div className={`w-28 h-28 rounded-full blur-xl bg-gradient-to-br transition-all duration-700
                ${voiceOrbState === 'listening' ? 'from-white/60 to-white/20 animate-pulse' :
                  voiceOrbState === 'speaking' ? (agentById(activeVoiceAgentId || 'atlas')?.color || 'from-violet-500 to-fuchsia-500') + ' animate-ping shadow-2xl' :
                  'from-gray-400 to-gray-500 opacity-50'}
              `} />
              
              {/* Center dot/icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                {voiceOrbState === 'listening' ? (
                  <Mic className="w-8 h-8 text-white animate-pulse" />
                ) : voiceOrbState === 'speaking' && activeVoiceAgentId ? (
                  <span className="text-4xl drop-shadow-md">{agentById(activeVoiceAgentId)?.emoji}</span>
                ) : (
                  <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                )}
              </div>
            </div>

            <p className="text-white mt-12 text-center text-lg max-w-xl font-medium drop-shadow-sm min-h-[4rem]">
              {voiceOrbState === 'speaking' && messages.length > 0 && messages[messages.length - 1].role !== 'user'
                ? messages[messages.length - 1].content 
                : voiceOrbState === 'listening' 
                ? "Go ahead, speak..."
                : ""}
            </p>
          </div>

          <button
            onClick={toggleVoiceMode}
            className="mb-12 flex items-center gap-2 px-6 py-3 bg-red-500/90 hover:bg-red-500 text-white rounded-full font-bold shadow-[0_0_30px_rgba(239,68,68,0.4)] hover:scale-105 transition-all"
          >
            End Conversation
          </button>
        </div>
      )}
    </div>
  );
}
