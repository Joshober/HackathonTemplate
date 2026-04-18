'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { LOCKTON_TRAVEL_PERSONALITY } from '@/lib/travelAssistant';
import type { User } from '@/lib/auth';

type Msg = { role: 'user' | 'assistant'; content: string };

const QUICK = [
  { label: 'Team trip ideas', text: 'Suggest 2 short team offsite ideas (US, 2 nights) with rough cost bands as estimates only.' },
  { label: 'Align before booking', text: 'What should I confirm with my manager or travel desk before booking a group trip?' },
  { label: 'Policy reminders', text: 'Quick reminders about typical corporate travel policy checks for a small team trip.' },
];

export default function TeamChatPanel({ user }: { user: User }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'This is your team planning thread. Ask about destinations, estimates, or what to align with your group. Teammates on the side are a demo roster.',
    },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;
      setErr(null);
      setPending(true);
      const nextUser: Msg = { role: 'user', content: trimmed };
      setMessages((prev) => [...prev, nextUser]);
      setInput('');

      const priorForPipeline = [...messages, nextUser].slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const result = await api.chatPipeline({
          text: trimmed,
          messages: priorForPipeline,
          mode: 'assistant',
          personality: `${LOCKTON_TRAVEL_PERSONALITY}\n\nContext: the user is in a team workspace; favor coordination, shared planning, and clear handoffs when relevant.`,
          userEmail: user?.email,
          userId: user?.sub,
        });
        const reply = result.message || 'No response.';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Request failed');
        setMessages((prev) => prev.slice(0, -1));
        setInput(trimmed);
      } finally {
        setPending(false);
      }
    },
    [messages, pending, user]
  );

  return (
    <div className="flex flex-col h-full min-h-[56vh] gap-3">
      <div>
        <h2 className="text-lg font-semibold text-white">Team chat</h2>
        <p className="text-xs text-travel-muted mt-1">Same travel assistant pipeline — use for coordination and estimates only.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => send(q.text)}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.04] text-white/90 hover:bg-white/10 disabled:opacity-50"
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-[240px] space-y-3 rounded-2xl border border-white/10 bg-black/25 p-3 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed rounded-xl px-3 py-2 ${
              m.role === 'user' ? 'bg-blue-600/25 text-white ml-4' : 'bg-white/[0.06] text-white/90 mr-4'
            }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {err ? <p className="text-xs text-red-300">{err}</p> : null}
      <form
        className="flex gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message the team thread…"
          className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="shrink-0 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium"
        >
          {pending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
