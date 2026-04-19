'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useTravelStage } from '@/lib/travelContext';
import type { TravelStageId } from '@/lib/travelTypes';
import { Send, Loader2, Bot, User, Sparkles, AlertTriangle, ChevronRight } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
    label: 'Planning help',
    tagline: 'Decide where to go, what to book, and what documents you will need — grounded in your saved trip.',
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
    label: 'Booking & approval',
    tagline: 'Manager approval, policy triggers, and how to phrase a compliant request.',
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
    label: 'On trip',
    tagline: 'Short answers while you are in transit — delays, contacts, and day-of next steps.',
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
    label: 'Post-trip wrap-up',
    tagline: 'Expenses, follow-ups, and a clean handoff after you are back.',
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
  const searchParams = useSearchParams();
  const config = STAGE_CONFIG[stage];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [incidentDetected, setIncidentDetected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const pre = searchParams.get('prefill') || searchParams.get('q');
    if (pre) setInput(pre);
  }, [searchParams]);

  // Reset chat when stage changes
  useEffect(() => {
    setMessages([]);
    setIncidentDetected(false);
  }, [stage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || loading) return;

    setInput('');
    setLoading(true);

    const userMessage: Message = {
      id: newId(),
      role: 'user',
      content: userMsg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

      const result = await api.chatCopilot({
        message: userMsg,
        assistantMode: 'trip_companion',
        travelStage: stage,
        messages: history,
      });

      const assistantMessage: Message = {
        id: newId(),
        role: 'assistant',
        content: result.reply || 'Sorry, I could not generate a response.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (result.incidentDetected) {
        setIncidentDetected(true);
      }
    } catch (err) {
      const errMsg: Message = {
        id: newId(),
        role: 'assistant',
        content: `I'm having trouble connecting right now. Please check your connection and try again.\n\n${err instanceof Error ? err.message : ''}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, stage]);

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
                    disabled={loading}
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
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white rounded-tr-sm'
                  : `bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm`
              }`}
            >
              {formatContent(msg.content)}
            </div>
          </div>
        ))}

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
      <form onSubmit={handleSubmit} className="shrink-0 px-4 pb-4 pt-2 border-t border-gray-100">
        <div className="flex items-end gap-2">
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
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex-none w-10 h-10 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center text-white transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Responses use your uploaded documents as context. Verify critical info before travel.
        </p>
      </form>
    </div>
  );
}
