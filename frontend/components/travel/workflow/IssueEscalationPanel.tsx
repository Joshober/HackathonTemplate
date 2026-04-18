'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type Item, type TravelIssueType, type TravelMetadata } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';

type Props = {
  items: Item[];
  onSaved?: () => Promise<void> | void;
};

const ISSUE_OPTIONS: Array<{ value: TravelIssueType; label: string }> = [
  { value: 'delay', label: 'Flight delay' },
  { value: 'cancellation', label: 'Cancellation' },
  { value: 'missed_connection', label: 'Missed connection' },
  { value: 'hotel_issue', label: 'Hotel issue' },
  { value: 'policy_exception', label: 'Policy exception' },
  { value: 'medical', label: 'Medical concern' },
  { value: 'security', label: 'Security concern' },
  { value: 'other', label: 'Other' },
];

export default function IssueEscalationPanel({ items, onSaved }: Props) {
  const trips = useMemo(
    () =>
      items
        .filter(isTravelItem)
        .filter((i) => i._id)
        .filter((i) => {
          const st = getTravelPayload(i)?.opportunityStatus;
          return st === 'approved' || st === 'booked' || st === 'completed' || st === 'pending' || st === 'submitted';
        }),
    [items],
  );
  const [selectedId, setSelectedId] = useState('');
  const [issueType, setIssueType] = useState<TravelIssueType>('delay');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [incident, setIncident] = useState<{
    id: string;
    type: string;
    severity: string;
    summary: string;
    options: Array<{ id: string; title: string; details: string; actionType: string }>;
    escalation: { level: string; reason: string; contact: string; actionNow: string };
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
    const latest = travel?.incidents?.[travel.incidents.length - 1];
    if (latest) {
      setIncident({
        id: latest.id,
        type: latest.type,
        severity: latest.severity,
        summary: latest.summary,
        options: latest.options,
        escalation: latest.escalation,
      });
    } else {
      setIncident(null);
    }
    setErr(null);
    setMsg(null);
  }, [selectedId, trips]);

  const selected = trips.find((t) => t._id === selectedId) || null;
  const selectedTravel = selected ? getTravelPayload(selected) : null;

  const triage = async () => {
    if (!selected?._id || busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await api.triageTravelIncident({
        itemId: selected._id,
        type: issueType,
        details: details.trim(),
      });
      setIncident(res.incident);
      const priorIncidents = selectedTravel?.incidents || [];
      const merged: TravelMetadata = {
        ...((selected.travel as Record<string, unknown>) || {}),
        incidents: [...priorIncidents, res.incident],
        privacy: res.privacy,
      };
      await api.updateItem(selected._id, { travel: merged });
      await onSaved?.();
      setMsg(res.nextStep || 'Issue triaged.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not triage issue');
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    if (!selected?._id || !incident || escalating) return;
    setEscalating(true);
    setErr(null);
    try {
      const res = await api.escalateTravelIssue({
        itemId: selected._id,
        incidentId: incident.id,
        reason: details.trim() || incident.summary,
        contactPreference:
          incident.escalation.level === 'manager'
            ? 'manager'
            : incident.escalation.level === 'emergency'
              ? 'emergency'
              : 'travel_desk',
      });
      setMsg(`${res.message} Reference: ${res.escalationId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not escalate issue');
    } finally {
      setEscalating(false);
    }
  };

  if (!trips.length) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Issue & Escalation Assistant</h3>
        <p className="text-xs text-travel-muted mt-1">
          Approve or book a trip first, then use this panel for real-time disruption handling.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Issue & Escalation Assistant</h3>
        <p className="text-xs text-travel-muted mt-1">
          Detects trip issues, gives concise options, and triggers escalation when needed.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs text-travel-muted block">
          Issue type
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value as TravelIssueType)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {ISSUE_OPTIONS.map((row) => (
              <option key={row.value} value={row.value}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-xs text-travel-muted block">
        What happened?
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          placeholder="Example: Flight canceled after check-in; need same-day arrival for client meeting."
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 resize-none"
        />
      </label>

      <button
        type="button"
        onClick={() => void triage()}
        disabled={busy}
        className="w-full rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5"
      >
        {busy ? 'Triage in progress...' : 'Triage issue'}
      </button>

      {err ? <p className="text-xs text-red-700">{err}</p> : null}
      {msg ? <p className="text-xs text-emerald-800">{msg}</p> : null}

      {incident ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">Situation</p>
            <p className="text-sm text-gray-900 mt-1">{incident.summary}</p>
            <p className="text-[11px] text-travel-muted mt-1">
              Severity: <span className="font-medium text-gray-800">{incident.severity}</span>
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-blue-900 font-semibold">Next options</p>
            <ul className="mt-1 space-y-1">
              {incident.options.map((opt) => (
                <li key={opt.id} className="text-xs text-blue-900">
                  <span className="font-medium">{opt.title}:</span> {opt.details}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-amber-900 font-semibold">
              Escalation: {incident.escalation.level.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-amber-900">{incident.escalation.reason}</p>
            <p className="text-xs text-amber-900">Contact: {incident.escalation.contact}</p>
            <p className="text-xs text-amber-900">Action now: {incident.escalation.actionNow}</p>
            {incident.escalation.level !== 'monitor' && incident.escalation.level !== 'none' ? (
              <button
                type="button"
                onClick={() => void escalate()}
                disabled={escalating}
                className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold py-2 mt-1"
              >
                {escalating ? 'Escalating...' : 'Escalate now'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

