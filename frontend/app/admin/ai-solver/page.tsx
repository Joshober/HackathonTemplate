'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type AdminAiSolverResponse } from '@/lib/api';

export default function AdminAiSolverPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [teamId, setTeamId] = useState('');
  const [tripId, setTripId] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<AdminAiSolverResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.getAdminMe();
        if (!cancelled) setAllowed(me.isAdmin === true);
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async () => {
    setErr(null);
    setLoading(true);
    setLast(null);
    try {
      const res = await api.adminAiSolver({
        message,
        currentPage: '/admin/ai-solver',
        selectedTeamId: teamId.trim() || undefined,
        selectedTripId: tripId.trim() || undefined,
        selectedDateRange:
          rangeStart && rangeEnd ? { start: rangeStart, end: rangeEnd } : undefined,
      });
      setLast(res);
      setPendingId((res.pendingActionId as string | null) ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [message, teamId, tripId, rangeStart, rangeEnd]);

  const confirm = useCallback(async () => {
    if (!pendingId) return;
    setErr(null);
    setLoading(true);
    try {
      const out = await api.adminAiSolverConfirm({ pendingActionId: pendingId });
      setPendingId(null);
      const ex = out.executed as { ok?: boolean; error?: string } | undefined;
      alert(ex?.ok ? 'Action executed.' : ex?.error || out.error || 'Action failed');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setLoading(false);
    }
  }, [pendingId]);

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center text-sm">
        Checking access…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-zinc-400">Admin access required.</p>
        <Link href="/home" className="text-amber-400 hover:underline text-sm">
          Back to home
        </Link>
      </div>
    );
  }

  const s = last?.structured;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AI Admin Solver</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Operations copilot — proposals require explicit confirmation for writes.
          </p>
        </div>
        <Link href="/home" className="text-sm text-amber-400 hover:underline shrink-0">
          Home
        </Link>
      </div>

      <div className="space-y-4 text-sm">
        <label className="block space-y-1">
          <span className="text-zinc-500">Team ID (optional)</span>
          <input
            className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="Mongo ObjectId"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-zinc-500">Trip / item ID (optional)</span>
          <input
            className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            placeholder="Mongo ObjectId"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-zinc-500">Range start</span>
            <input
              type="date"
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-zinc-500">Range end</span>
            <input
              type="date"
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-zinc-500">Request</span>
          <textarea
            className="w-full min-h-[120px] rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='e.g. "Who can cover Nov 10–12?" or "Flag pricing issues for this trip"'
          />
        </label>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading || !message.trim()}
            onClick={() => void run()}
            className="rounded-md bg-amber-500 text-zinc-950 px-4 py-2 font-medium disabled:opacity-40"
          >
            {loading ? 'Running…' : 'Run solver'}
          </button>
          {pendingId && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void confirm()}
              className="rounded-md border border-amber-500 text-amber-400 px-4 py-2 font-medium disabled:opacity-40"
            >
              Confirm pending action
            </button>
          )}
        </div>
      </div>

      {s && (
        <section className="mt-10 space-y-4 border-t border-zinc-800 pt-8">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Result</h2>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <p className="text-zinc-200 whitespace-pre-wrap">{s.userFacingMessage}</p>
            {s.reasoningSummary && (
              <p className="text-zinc-500 text-xs whitespace-pre-wrap">{s.reasoningSummary}</p>
            )}
            {s.validationErrors && s.validationErrors.length > 0 ? (
              <ul className="text-xs text-amber-400 list-disc list-inside space-y-1">
                {s.validationErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ) : null}
            <dl className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
              <dt>Intent</dt>
              <dd className="text-zinc-300">{s.intent}</dd>
              <dt>Confirmation</dt>
              <dd className="text-zinc-300">{s.requiresConfirmation ? 'required' : 'no'}</dd>
              {last?.pendingActionId && (
                <>
                  <dt>Pending ID</dt>
                  <dd className="text-zinc-300 font-mono break-all">{last.pendingActionId}</dd>
                </>
              )}
            </dl>
            {s.actionPayload && Object.keys(s.actionPayload).length > 0 && (
              <pre className="text-xs bg-zinc-950 p-3 rounded-md overflow-x-auto text-zinc-400">
                {JSON.stringify(s.actionPayload, null, 2)}
              </pre>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
