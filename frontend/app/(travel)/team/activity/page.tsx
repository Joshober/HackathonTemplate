'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { api, TRAVEL_ACTIVE_TEAM_STORAGE_KEY, type TeamMessage } from '@/lib/api';

const MESSAGE_LIMIT = 25;

export default function TeamActivityPage() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const tid = typeof window !== 'undefined' ? localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY)?.trim() : '';
      setTeamId(tid || null);
    };
    read();
    window.addEventListener('storage', read);
    window.addEventListener('focus', read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('focus', read);
    };
  }, []);

  useEffect(() => {
    if (!teamId) {
      setTeamName(null);
      setMessages([]);
      setLoading(false);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const detail = await api.getTeam(teamId);
        if (cancelled) return;
        setTeamName(detail.name);
        const { messages: msgs } = await api.getTeamMessages(teamId, MESSAGE_LIMIT);
        if (cancelled) return;
        setMessages(msgs);
        setErr(null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load activity');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return (
    <div className="space-y-3 py-2">
      <Link href="/team" className="inline-flex items-center gap-1 text-sm text-travel-muted hover:text-gray-900">
        <ChevronLeft className="w-4 h-4" aria-hidden />
        Back to Team hub
      </Link>
      <h1 className="text-lg font-semibold text-gray-900">Activity</h1>

      {!teamId ? (
        <p className="text-sm text-travel-muted">
          Select an active team on the Team tab to see the latest shared messages and system notes.
        </p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-travel-muted py-4">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Loading activity…
        </div>
      ) : err ? (
        <p className="text-sm text-red-700">{err}</p>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-xs text-travel-muted">
            Recent messages for <span className="font-medium text-gray-800">{teamName || 'your team'}</span> (newest
            last).
          </p>
          {messages.length === 0 ? (
            <p className="text-sm text-travel-muted">No messages yet — open the team chat from the Team tab to start.</p>
          ) : (
            <ul className="space-y-3 max-h-[420px] overflow-y-auto text-sm">
              {messages.map((m) => (
                <li key={m.id} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                  <p className="text-[10px] text-travel-muted uppercase tracking-wide">
                    {m.role === 'assistant' ? 'Assistant' : m.authorDisplayName || 'Teammate'}
                    {m.createdAt ? ` · ${m.createdAt}` : ''}
                  </p>
                  <p className="text-gray-800 whitespace-pre-wrap mt-0.5">{m.content}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/team" className="inline-block text-xs font-semibold text-blue-600 hover:underline">
            Open full team hub
          </Link>
        </div>
      )}
    </div>
  );
}
