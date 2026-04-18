'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type Item, type TravelMetadata } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';

type Props = {
  items: Item[];
  onSaved?: () => Promise<void> | void;
};

export default function PreTripChecklistPanel({ items, onSaved }: Props) {
  const trips = useMemo(() => items.filter(isTravelItem).filter((i) => i._id), [items]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [tradeoffs, setTradeoffs] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<
    Array<{ id: string; label: string; status: 'pending' | 'done' | 'blocked'; source: string; note?: string }>
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
    setChecklist(travel?.checklist || []);
    setSummary('');
    setRiskFlags([]);
    setTradeoffs([]);
    setErr(null);
  }, [selectedId, trips]);

  const selected = trips.find((t) => t._id === selectedId) || null;
  const selectedTravel = selected ? getTravelPayload(selected) : null;

  const generateChecklist = async () => {
    if (!selected?._id || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.generateTravelChecklist({
        itemId: selected._id,
        destination: selectedTravel?.location,
        startDate: selectedTravel?.startDate,
        endDate: selectedTravel?.endDate,
        tripType: selectedTravel?.tripType,
        costEstimate: selectedTravel?.costEstimate,
      });
      setChecklist(res.checklist);
      setSummary(res.summary);
      setRiskFlags(res.riskFlags || []);
      setTradeoffs(res.tradeoffs || []);

      const merged: TravelMetadata = {
        ...((selected.travel as Record<string, unknown>) || {}),
        checklist: res.checklist,
        privacy: res.privacy,
      };
      await api.updateItem(selected._id, { travel: merged });
      await onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate checklist');
    } finally {
      setBusy(false);
    }
  };

  if (!trips.length) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Before Trip Checklist</h3>
        <p className="text-xs text-travel-muted mt-1">Add at least one travel card in Plan to generate checklist guidance.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Before Trip Checklist</h3>
        <p className="text-xs text-travel-muted mt-1">
          Auto-generates prep tasks, risk flags, and tradeoff reminders from your trip metadata.
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
        onClick={() => void generateChecklist()}
        disabled={busy}
        className="w-full rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold py-2.5"
      >
        {busy ? 'Generating...' : 'Generate checklist'}
      </button>

      {summary ? <p className="text-xs text-emerald-800">{summary}</p> : null}
      {err ? <p className="text-xs text-red-700">{err}</p> : null}

      {checklist.length ? (
        <ul className="space-y-2">
          {checklist.map((row) => (
            <li key={row.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-gray-900">{row.label}</p>
                <span
                  className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-md ${
                    row.status === 'done'
                      ? 'bg-emerald-100 text-emerald-900'
                      : row.status === 'blocked'
                        ? 'bg-red-100 text-red-900'
                        : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {row.status}
                </span>
              </div>
              {row.note ? <p className="text-xs text-travel-muted mt-1">{row.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {riskFlags.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-900 uppercase tracking-wide">Risk flags</p>
          <ul className="mt-1 space-y-1">
            {riskFlags.map((f, i) => (
              <li key={`${f}-${i}`} className="text-xs text-amber-900">
                - {f}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tradeoffs.length ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-blue-900 uppercase tracking-wide">Tradeoff guidance</p>
          <ul className="mt-1 space-y-1">
            {tradeoffs.map((f, i) => (
              <li key={`${f}-${i}`} className="text-xs text-blue-900">
                - {f}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

