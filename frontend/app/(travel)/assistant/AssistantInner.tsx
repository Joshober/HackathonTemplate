'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { LOCKTON_TRAVEL_PERSONALITY } from '@/lib/travelAssistant';
import { useTravelAuth } from '@/components/travel/useTravelAuth';

type Msg = { role: 'user' | 'assistant'; content: string };

const QUICK = [
  { label: 'Suggest destinations', text: 'Suggest 3 US cities good for a 2-day client meeting this quarter, with a sentence each on why.' },
  { label: 'Estimate costs', text: 'Give a rough per-day cost band (flight + hotel + meals) for a domestic client trip, as estimates only.' },
  { label: 'Check policy', text: 'What kinds of things should I double-check in a typical corporate travel policy before booking?' },
];

export default function AssistantInner() {
  const { user, loading } = useTravelAuth();
  const search = useSearchParams();
  const topic = search.get('topic');
  const memoryDone = useRef(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Hi — I’m your travel copilot. Ask anything about destinations, rough costs, or how to stay policy-smart. Quick actions below.',
    },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (topic !== 'memory' || memoryDone.current) return;
    memoryDone.current = true;
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        content:
          'Share a few bullet points about your trip (or paste a draft). I can suggest LinkedIn and Instagram captions — you can copy them into your post builder.',
      },
    ]);
  }, [topic]);

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
          personality: LOCKTON_TRAVEL_PERSONALITY,
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

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  return (
    <div className="flex flex-col min-h-[60vh] gap-3">
      <div>
        <h2 className="text-lg font-semibold text-white">AI assistant</h2>
        <p className="text-xs text-travel-muted mt-1">Powered by your existing chat pipeline (estimates only).</p>
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
      <div className="flex-1 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3 max-h-[50vh] overflow-y-auto">
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
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about trips, policy, or costs…"
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
