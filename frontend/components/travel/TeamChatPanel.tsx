'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type TeamMessage } from '@/lib/api';
import type { User } from '@/lib/auth';

const QUICK = [
  { label: 'Team trip ideas', text: 'Suggest 2 short team offsite ideas (US, 2 nights) with rough cost bands as estimates only.' },
  { label: 'Align before booking', text: 'What should I confirm with my manager or travel desk before booking a group trip?' },
  { label: 'Policy reminders', text: 'Quick reminders about typical corporate travel policy checks for a small team trip.' },
];

export default function TeamChatPanel({
  teamId,
  user,
  presetCities = [],
}: {
  teamId: string | null;
  user: User;
  presetCities?: string[];
}) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [askAssistant, setAskAssistant] = useState(true);
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
          invokeAssistant: askAssistant,
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
    [teamId, pending, askAssistant]
  );

  if (!teamId) {
    return (
      <div className="flex flex-col min-h-[56vh] gap-3 justify-center text-center px-4">
        <p className="text-sm text-travel-muted">Create a team or pick one from the list to open the shared thread.</p>
        <p className="text-xs text-travel-muted">Messages are stored on the server for all members.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[56vh] gap-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Team chat</h2>
        <p className="text-xs text-travel-muted mt-1">
          Saved for your team. The assistant reads this thread (with speaker names) and can use web search, weather, and
          Explorer-style city event search (DuckDuckGo), like the AI page. Estimates only — not live prices.
        </p>
        {presetCities.length ? (
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
            <p className="text-[11px] text-blue-900 font-medium">Preset cities for this team</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {presetCities.map((city) => (
                <span key={city} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-blue-200 text-blue-800">
                  {city}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={askAssistant}
          onChange={(e) => setAskAssistant(e.target.checked)}
          className="rounded border-gray-300"
        />
        <span>
          Ask travel assistant to reply
          <span className="text-travel-muted font-normal"> — off for teammate-only notes; use </span>
          <code className="text-[10px] text-gray-600 bg-gray-100 px-1 rounded">@assistant</code>
          <span className="text-travel-muted font-normal"> to invoke anyway.</span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => send(q.text)}
            disabled={pending || loadingHistory}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50 shadow-sm"
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-[240px] space-y-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 overflow-y-auto">
        {loadingHistory ? (
          <p className="text-xs text-travel-muted text-center py-8">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-travel-muted text-center py-8">No messages yet — say hello or use a quick prompt.</p>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';
            const label =
              isUser && m.userId === user.sub
                ? 'You'
                : isUser
                  ? m.authorDisplayName || 'Teammate'
                  : m.authorDisplayName || 'Travel assistant';
            return (
              <div key={m.id} className={`space-y-0.5 ${isUser ? 'ml-4' : 'mr-4'}`}>
                <p className="text-[10px] uppercase tracking-wide text-travel-muted px-1">{label}</p>
                <div
                  className={`text-sm leading-relaxed rounded-xl px-3 py-2 ${
                    isUser ? 'bg-blue-100 text-gray-900 border border-blue-200' : 'bg-white text-gray-800 border border-gray-100 shadow-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {err ? <p className="text-xs text-red-700">{err}</p> : null}
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
          placeholder="Message the team…"
          className="flex-1 rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm"
        />
        <button
          type="submit"
          disabled={pending || loadingHistory || !input.trim()}
          className="shrink-0 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium"
        >
          {pending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
