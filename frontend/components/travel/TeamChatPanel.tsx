'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type TeamMessage } from '@/lib/api';
import type { User } from '@/lib/auth';
import { MessageCircle, Send } from 'lucide-react';

export default function TeamChatPanel({
  teamId,
  user,
}: {
  teamId: string | null;
  user: User;
}) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!teamId) {
      setMessages([]);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    setErr(null);
    api
      .getTeamMessages(teamId, 100)
      .then(({ messages: rows }) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load messages');
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || !teamId) return;
      setErr(null);
      setPending(true);
      setInput('');
      try {
        const { userMessage, assistantMessage } = await api.sendTeamMessage(teamId, trimmed, {
          invokeAssistant: true, // simplified for new UI
        });
        setMessages((prev) =>
          assistantMessage ? [...prev, userMessage, assistantMessage] : [...prev, userMessage]
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Request failed');
        setInput(trimmed);
      } finally {
        setPending(false);
      }
    },
    [teamId, pending]
  );

  if (!teamId) return null;

  return (
    <div className="flex flex-col h-full absolute inset-0">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto w-full px-5 py-4 flex flex-col pt-10">
        {loadingHistory ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-80 mt-[-10%]">
            <MessageCircle className="w-16 h-16 text-gray-300 stroke-[1.5] mb-4" />
            <p className="text-[#64748b] text-base font-semibold">No messages yet</p>
            <p className="text-[#94a3b8] text-sm mt-0.5">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              const label = isUser && m.userId === user.sub ? 'You' : isUser ? (m.authorDisplayName || 'Teammate') : (m.authorDisplayName || 'AI Assistant');
              return (
                <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide mb-1 px-1">
                    {label}
                  </span>
                  <div
                    className={`max-w-[90%] md:max-w-[80%] text-[13px] leading-relaxed rounded-[20px] px-4 py-2.5 shadow-sm ${
                      isUser
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {err ? <p className="text-xs text-red-500 px-5 text-center mt-2">{err}</p> : null}

      {/* Input Area */}
      <div className="shrink-0 p-4 pb-6 bg-white shrink">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 bg-[#f8f9fa] outline outline-1 outline-gray-100 rounded-full pl-5 pr-2 py-1.5 focus-within:outline-blue-500 transition-all shadow-sm max-w-full overflow-hidden"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 min-w-0 bg-transparent py-2.5 text-[14px] text-gray-700 placeholder:text-gray-300 font-medium focus:outline-none focus:ring-0"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="shrink-0 w-[42px] h-[42px] flex items-center justify-center rounded-full bg-[#E2E8F0] text-gray-500 hover:bg-gray-300 disabled:opacity-50 transition-colors mr-0.5"
          >
            <Send className="w-5 h-5 -ml-0.5 mt-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
