'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type Item, type TravelMetadata } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import type { TravelFollowUpStatus } from '@/lib/travelTypes';

type Props = {
  items: Item[];
  onSaved?: () => Promise<void> | void;
};

export default function PostTripFollowUpsPanel({ items, onSaved }: Props) {
  const trips = useMemo(
    () =>
      items
        .filter(isTravelItem)
        .filter((i) => i._id)
        .filter((i) => {
          const st = getTravelPayload(i)?.opportunityStatus;
          return st === 'approved' || st === 'booked' || st === 'completed';
        }),
    [items],
  );
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [followUps, setFollowUps] = useState<
    Array<{ id: string; type: string; label: string; dueDate: string; status: TravelFollowUpStatus; owner: string }>
  >([]);

  useEffect(() => {
    if (!trips.length) return;
    if (!selectedId || !trips.some((t) => t._id === selectedId)) {
      setSelectedId(trips[0]._id || '');
    }
  }, [trips, selectedId]);

  useEffect(() => {
    const selected = trips.find((t) => t._id === selectedId);
    const travel = selected ? getTravelPayload(selected) : null;
    setFollowUps((travel?.followUps || []).map((f) => ({ ...f })));
    setSummary('');
    setErr(null);
  }, [selectedId, trips]);

  const selected = trips.find((t) => t._id === selectedId) || null;

  const persist = async (
    next: Array<{ id: string; type: string; label: string; dueDate: string; status: TravelFollowUpStatus; owner: string }>,
  ) => {
    if (!selected?._id) return;
    const merged: TravelMetadata = {
      ...((selected.travel as Record<string, unknown>) || {}),
      followUps: next,
    };
    await api.updateItem(selected._id, { travel: merged });
    await onSaved?.();
  };

  const generate = async () => {
    if (!selected?._id || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.generateTravelFollowUps({ itemId: selected._id });
      setFollowUps(res.followUps);
      setSummary(res.summary);
      const merged: TravelMetadata = {
        ...((selected.travel as Record<string, unknown>) || {}),
        followUps: res.followUps,
        privacy: res.privacy,
      };
      await api.updateItem(selected._id, { travel: merged });
      await onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate follow-ups');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, status: TravelFollowUpStatus) => {
    const next = followUps.map((f) => (f.id === id ? { ...f, status } : f));
    setFollowUps(next);
    try {
      await persist(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update follow-up status');
    }
  };

  if (!trips.length) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">After Trip Follow-ups</h3>
        <p className="text-xs text-travel-muted mt-1">
          Follow-up automation appears once a trip is approved/booked/completed.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">After Trip Follow-ups</h3>
        <p className="text-xs text-travel-muted mt-1">
          Generates close-the-loop tasks for expenses, feedback, and compliance handoff.
        </p>
      </div>

      <label className="text-xs text-travel-muted block">
        Trip
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
        >
          {trips.map((t) => {
            const travel = getTravelPayload(t);
            return (
              <option key={t._id} value={t._id}>
                {t.title} {travel?.location ? `- ${travel.location}` : ''}
              </option>
            );
          })}
        </select>
      </label>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy}
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5"
      >
        {busy ? 'Generating...' : 'Generate follow-up tasks'}
      </button>

      {summary ? <p className="text-xs text-emerald-800">{summary}</p> : null}
      {err ? <p className="text-xs text-red-700">{err}</p> : null}

      {followUps.length ? (
        <div className="space-y-2">
          {followUps.map((task) => (
            <div key={task.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">{task.label}</p>
                  <p className="text-[11px] text-travel-muted mt-1">
                    Due {task.dueDate} - Owner: {task.owner}
                  </p>
                </div>
                <select
                  value={task.status}
                  onChange={(e) => void updateStatus(task.id, e.target.value as TravelFollowUpStatus)}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900"
                >
                  <option value="open">open</option>
                  <option value="done">done</option>
                  <option value="skipped">skipped</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

