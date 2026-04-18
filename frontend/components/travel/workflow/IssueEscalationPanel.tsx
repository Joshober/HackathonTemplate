'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type Item, type TravelIssueType, type TravelMetadata } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import {
  AlertTriangle,
  Loader2,
  Phone,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

type Props = {
  items: Item[];
  onSaved?: () => Promise<void> | void;
};

const ISSUE_OPTIONS: Array<{ value: TravelIssueType; label: string; emoji: string }> = [
  { value: 'delay', label: 'Flight delay', emoji: '⏱️' },
  { value: 'cancellation', label: 'Cancellation', emoji: '✈️' },
  { value: 'missed_connection', label: 'Missed connection', emoji: '🔀' },
  { value: 'hotel_issue', label: 'Hotel issue', emoji: '🏨' },
  { value: 'policy_exception', label: 'Policy exception', emoji: '📋' },
  { value: 'medical', label: 'Medical concern', emoji: '🏥' },
  { value: 'security', label: 'Security concern', emoji: '🔒' },
  { value: 'other', label: 'Other', emoji: '❓' },
];

const ACTION_TYPE_COLORS: Record<string, string> = {
  rebook: 'border-blue-200 bg-blue-50',
  contact: 'border-orange-200 bg-orange-50',
  self_service: 'border-emerald-200 bg-emerald-50',
  policy: 'border-violet-200 bg-violet-50',
};

const ACTION_TYPE_LABEL: Record<string, string> = {
  rebook: 'Rebook',
  contact: 'Call',
  self_service: 'Self-service',
  policy: 'Policy',
};

const ACTION_TYPE_ICON: Record<string, React.ReactNode> = {
  rebook: <RefreshCw className="w-3.5 h-3.5" />,
  contact: <Phone className="w-3.5 h-3.5" />,
  self_service: <CheckCircle className="w-3.5 h-3.5" />,
  policy: <ArrowRight className="w-3.5 h-3.5" />,
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High Priority', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  medium: { label: 'Medium Priority', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  low: { label: 'Low Priority', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

type IncidentData = {
  id: string;
  type: string;
  severity: string;
  summary: string;
  options: Array<{ id: string; title: string; details: string; actionType: string }>;
  escalation: { level: string; reason: string; contact: string; actionNow: string };
};

type ViewState = 'form' | 'results';

export default function IssueEscalationPanel({ items, onSaved }: Props) {
  const trips = useMemo(
    () =>
      items
        .filter(isTravelItem)
        .filter((i) => i._id)
        .filter((i) => {
          const st = getTravelPayload(i)?.opportunityStatus;
          return (
            st === 'approved' ||
            st === 'booked' ||
            st === 'completed' ||
            st === 'pending' ||
            st === 'submitted'
          );
        }),
    [items],
  );

  const [view, setView] = useState<ViewState>('form');
  const [selectedId, setSelectedId] = useState('');
  const [issueType, setIssueType] = useState<TravelIssueType>('delay');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [escalationMsg, setEscalationMsg] = useState<string | null>(null);
  const [incident, setIncident] = useState<IncidentData | null>(null);

  useEffect(() => {
    if (!trips.length) return;
    if (!selectedId || !trips.some((t) => t._id === selectedId)) {
      setSelectedId(trips[0]._id || '');
    }
  }, [trips, selectedId]);

  useEffect(() => {
    const selected = trips.find((t) => t._id === selectedId);
    const travel = selected ? getTravelPayload(selected) : null;
    const incs = travel?.incidents;
    const latest = Array.isArray(incs) ? incs[incs.length - 1] : null;
    if (latest && typeof latest === 'object') {
      setIncident(latest as IncidentData);
      setView('results');
    } else {
      setIncident(null);
      setView('form');
    }
    setErr(null);
    setEscalationMsg(null);
  }, [selectedId, trips]);

  const selected = trips.find((t) => t._id === selectedId) || null;
  const selectedTravel = selected ? getTravelPayload(selected) : null;

  const triage = async () => {
    if (!selected?._id || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.triageTravelIncident({
        itemId: selected._id,
        type: issueType,
        details: details.trim(),
      });
      setIncident(res.incident);
      setView('results');
      const priorIncidents = Array.isArray(selectedTravel?.incidents) ? selectedTravel.incidents : [];
      const merged: TravelMetadata = {
        ...((selected.travel as Record<string, unknown>) || {}),
        incidents: [...priorIncidents, res.incident],
        privacy: res.privacy,
      };
      await api.updateItem(selected._id, { travel: merged });
      await onSaved?.();
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
      setEscalationMsg(`Escalation opened. Reference: ${res.escalationId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not escalate issue');
    } finally {
      setEscalating(false);
    }
  };

  // No active trips — show a minimal placeholder
  if (!trips.length) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Issue Assistant</h3>
        </div>
        <p className="text-xs text-travel-muted mt-1">
          Approve or book a trip to enable real-time disruption handling.
        </p>
      </section>
    );
  }

  const sevConfig = SEVERITY_CONFIG[incident?.severity ?? 'medium'] ?? SEVERITY_CONFIG.medium;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-gray-900">Issue & Escalation</h3>
        </div>
        {view === 'results' && (
          <button
            type="button"
            onClick={() => { setView('form'); setIncident(null); setEscalationMsg(null); }}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Report new issue
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Trip selector (always visible) */}
        {trips.length > 1 && (
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
                    {t.title} {travel?.location ? `— ${travel.location}` : ''}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        {/* Form view */}
        {view === 'form' && (
          <div className="space-y-3">
            <p className="text-xs text-travel-muted">
              Report a disruption and I&apos;ll give you 3 concrete options immediately.
            </p>

            {/* Issue type — visual selector */}
            <div className="grid grid-cols-2 gap-2">
              {ISSUE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIssueType(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                    issueType === opt.value
                      ? 'border-orange-400 bg-orange-50 text-orange-900 font-semibold'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span>{opt.emoji}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>

            <label className="text-xs text-travel-muted block">
              What happened? <span className="text-gray-400">(optional)</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
                placeholder="e.g. Flight canceled after check-in; I need to arrive for a client meeting."
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </label>

            <button
              type="button"
              onClick={() => void triage()}
              disabled={busy}
              className="w-full rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold py-3 flex items-center justify-center gap-2 transition-colors"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing situation…
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Get my options now
                </>
              )}
            </button>

            {err && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <XCircle className="w-4 h-4 shrink-0" />
                {err}
              </div>
            )}
          </div>
        )}

        {/* Results view */}
        {view === 'results' && incident && (
          <div className="space-y-4">
            {/* Situation summary */}
            <div className={`rounded-xl border px-4 py-3 ${sevConfig.bg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className={`w-4 h-4 ${sevConfig.color} shrink-0`} />
                <span className={`text-xs font-bold uppercase tracking-wide ${sevConfig.color}`}>
                  {sevConfig.label}
                </span>
              </div>
              <p className="text-sm text-gray-900 font-medium leading-snug">{incident.summary}</p>
            </div>

            {/* Options — the core copilot value */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Your options ({incident.options.length})
              </p>
              <div className="space-y-2">
                {incident.options.map((opt, idx) => {
                  const actionColors = ACTION_TYPE_COLORS[opt.actionType] ?? 'border-gray-200 bg-gray-50';
                  const actionLabel = ACTION_TYPE_LABEL[opt.actionType] ?? opt.actionType;
                  const actionIcon = ACTION_TYPE_ICON[opt.actionType] ?? <ArrowRight className="w-3.5 h-3.5" />;
                  return (
                    <div key={opt.id} className={`rounded-xl border p-3.5 ${actionColors}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{opt.details}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-white/80 border border-gray-200 px-1.5 py-0.5 rounded-md shrink-0">
                          {actionIcon}
                          {actionLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Escalation */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-red-600" />
                <p className="text-xs font-bold uppercase tracking-wide text-red-700">
                  Escalation: {incident.escalation.level.replace(/_/g, ' ')}
                </p>
              </div>
              <p className="text-xs text-red-900 leading-relaxed">{incident.escalation.reason}</p>
              <div className="bg-red-100 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs text-red-800">
                  <span className="font-semibold">Contact:</span> {incident.escalation.contact}
                </p>
                <p className="text-xs text-red-800">
                  <span className="font-semibold">Action now:</span> {incident.escalation.actionNow}
                </p>
              </div>

              {incident.escalation.level !== 'monitor' && incident.escalation.level !== 'none' && (
                <>
                  {escalationMsg ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      {escalationMsg}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void escalate()}
                      disabled={escalating}
                      className="w-full rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 flex items-center justify-center gap-2 transition-colors"
                    >
                      {escalating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Escalating…
                        </>
                      ) : (
                        <>
                          <Phone className="w-3.5 h-3.5" />
                          Escalate to {incident.escalation.level.replace(/_/g, ' ')} now
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Next step reminder */}
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>
                <span className="font-semibold">Next step:</span> {incident.escalation.actionNow}
              </span>
            </div>

            {err && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <XCircle className="w-4 h-4 shrink-0" />
                {err}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
