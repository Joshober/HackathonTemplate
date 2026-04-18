'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type Item, type TravelMetadata } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import type { TravelOpportunityStatus } from '@/lib/travelTypes';

type Props = {
  items: Item[];
  onSaved?: () => Promise<void> | void;
};

function statusToOpportunity(status: string): TravelOpportunityStatus | undefined {
  if (status === 'required') return 'ready_for_approval';
  if (status === 'submitted') return 'submitted';
  if (status === 'pending') return 'pending';
  if (status === 'approved') return 'approved';
  if (status === 'needs_changes') return 'needs_changes';
  return undefined;
}

export default function ApprovalGuidancePanel({ items, onSaved }: Props) {
  const trips = useMemo(() => items.filter(isTravelItem).filter((i) => i._id), [items]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [plainStatus, setPlainStatus] = useState('');
  const [approval, setApproval] = useState<{
    status: string;
    requiredBy: string[];
    reasons: string[];
    fixes: string[];
    timeline: Array<{ step: string; status: string; detail: string }>;
  } | null>(null);

  useEffect(() => {
    if (!trips.length) return;
    if (!selectedId || !trips.some((t) => t._id === selectedId)) {
      setSelectedId(trips[0]._id || '');
    }
  }, [trips, selectedId]);

  useEffect(() => {
    const selected = trips.find((t) => t._id === selectedId);
    const travel = selected ? getTravelPayload(selected) : null;
    if (travel?.approval) {
      setApproval({
        status: travel.approval.status,
        requiredBy: travel.approval.requiredBy,
        reasons: travel.approval.reasons,
        fixes: travel.approval.fixes,
        timeline: travel.approval.timeline,
      });
    } else {
      setApproval(null);
    }
    setErr(null);
    setPlainStatus('');
  }, [selectedId, trips]);

  const selected = trips.find((t) => t._id === selectedId) || null;
  const selectedTravel = selected ? getTravelPayload(selected) : null;

  const generateApproval = async () => {
    if (!selected?._id || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.prepareTravelApproval({
        itemId: selected._id,
        destination: selectedTravel?.location,
        startDate: selectedTravel?.startDate,
        endDate: selectedTravel?.endDate,
        costEstimate: selectedTravel?.costEstimate,
        status: selectedTravel?.opportunityStatus,
      });
      setApproval(res.approval);
      setPlainStatus(res.plainLanguageStatus);

      const mappedStatus = statusToOpportunity(res.approval.status);
      const merged: TravelMetadata = {
        ...((selected.travel as Record<string, unknown>) || {}),
        approval: res.approval,
        privacy: res.privacy,
        ...(mappedStatus ? { opportunityStatus: mappedStatus } : {}),
      };
      await api.updateItem(selected._id, { travel: merged });
      await onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not prepare approval guidance');
    } finally {
      setBusy(false);
    }
  };

  if (!trips.length) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Guided Approval</h3>
        <p className="text-xs text-travel-muted mt-1">Create travel options first to generate approval guidance.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Guided Approval</h3>
        <p className="text-xs text-travel-muted mt-1">
          Builds approval status, reasons, and fast fix suggestions so approvals feel guided, not bureaucratic.
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
        onClick={() => void generateApproval()}
        disabled={busy}
        className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5"
      >
        {busy ? 'Preparing...' : 'Prepare approval guidance'}
      </button>

      {plainStatus ? <p className="text-xs text-emerald-800">{plainStatus}</p> : null}
      {err ? <p className="text-xs text-red-700">{err}</p> : null}

      {approval ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-600">Status</p>
            <p className="text-sm text-gray-900 mt-1">{approval.status.replace(/_/g, ' ')}</p>
          </div>

          {approval.reasons.length ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-900">Why approval looks this way</p>
              <ul className="mt-1 space-y-1">
                {approval.reasons.map((r, i) => (
                  <li key={`${r}-${i}`} className="text-xs text-blue-900">
                    - {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {approval.fixes.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-amber-900">Fix quickly</p>
              <ul className="mt-1 space-y-1">
                {approval.fixes.map((r, i) => (
                  <li key={`${r}-${i}`} className="text-xs text-amber-900">
                    - {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {approval.timeline.length ? (
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-600">Approval timeline</p>
              <div className="mt-2 space-y-2">
                {approval.timeline.map((step) => (
                  <div key={step.step} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900">{step.step.replace(/_/g, ' ')}</p>
                      <p className="text-[11px] text-travel-muted">{step.detail}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                      {step.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

