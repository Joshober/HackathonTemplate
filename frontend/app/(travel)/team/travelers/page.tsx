'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { api, TRAVEL_ACTIVE_TEAM_STORAGE_KEY, type TeamDetail } from '@/lib/api';

export default function TeamTravelersPage() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamDetail | null>(null);
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
      setTeam(null);
      setLoading(false);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void api
      .getTeam(teamId)
      .then((d) => {
        if (!cancelled) {
          setTeam(d);
          setErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load team');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
      <h1 className="text-lg font-semibold text-gray-900">Travelers</h1>

      {!teamId ? (
        <p className="text-sm text-travel-muted">
          No active team yet. Open the Team tab and pick a group so members and roles load here.
        </p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-travel-muted py-4">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Loading team…
        </div>
      ) : err ? (
        <p className="text-sm text-red-700">{err}</p>
      ) : team ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 text-sm">
          <div>
            <p className="text-xs text-travel-muted">Team</p>
            <p className="font-semibold text-gray-900">{team.name}</p>
            {team.description ? <p className="text-travel-muted text-xs mt-1">{team.description}</p> : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Members</p>
            <ul className="space-y-2">
              {team.members.map((m) => {
                const leader = team.createdBy && m.userId === team.createdBy;
                return (
                  <li key={m.userId} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                    <span className="text-gray-900 font-medium">{m.displayName || m.email || m.userId}</span>
                    <span className="text-xs text-travel-muted">
                      {leader ? 'Organizer' : 'Member'}
                      {m.email ? ` · ${m.email}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <Link href="/team" className="inline-block text-xs font-semibold text-blue-600 hover:underline">
            Switch team on Team hub
          </Link>
        </div>
      ) : null}
    </div>
  );
}
