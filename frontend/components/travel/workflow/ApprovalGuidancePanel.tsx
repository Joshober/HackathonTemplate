'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, type Item, type TravelMetadata } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import type { TravelOpportunityStatus } from '@/lib/travelTypes';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowRight,
  Loader2,
  Sparkles,
  AlertTriangle,
  Send,
} from 'lucide-react';

type Props = {
  items: Item[];
  onSaved?: () => Promise<void> | void;
};

type ApprovalStatus = 'approved' | 'not_required' | 'submitted' | 'pending' | 'required' | 'needs_changes';

type ApprovalData = {
  status: ApprovalStatus;
  requiredBy: string[];
  reasons: string[];
  fixes: string[];
  timeline: Array<{ step: string; status: string; detail: string }>;
  submittedAt?: string | null;
  decisionAt?: string | null;
};

function statusToOpportunity(status: string): TravelOpportunityStatus | undefined {
  if (status === 'required') return 'ready_for_approval';
  if (status === 'submitted') return 'submitted';
  if (status === 'pending') return 'pending';
  if (status === 'approved') return 'approved';
  if (status === 'needs_changes') return 'needs_changes';
  return undefined;
}

function StatusBanner({ status, copilotMessage, urgency }: {
  status: ApprovalStatus;
  copilotMessage: string;
  urgency?: string;
}) {
  const config: Record<ApprovalStatus, { icon: React.ReactNode; bg: string; border: string; text: string; label: string }> = {
    approved: {
      icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      label: 'Approved',
    },
    not_required: {
      icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      label: 'No approval needed',
    },
    submitted: {
      icon: <Clock className="w-5 h-5 shrink-0" />,
      bg: 'bg-violet-50',
      border: 'border-violet-200',
      text: 'text-violet-800',
      label: 'Submitted',
    },
    pending: {
      icon: <Clock className="w-5 h-5 shrink-0" />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      label: 'In review',
    },
    required: {
      icon: <AlertCircle className="w-5 h-5 shrink-0" />,
      bg: 'bg-violet-50',
      border: 'border-violet-200',
      text: 'text-violet-800',
      label: 'Action needed',
    },
    needs_changes: {
      icon: <XCircle className="w-5 h-5 shrink-0" />,
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      label: 'Needs changes',
    },
  };

  const c = config[status] || config.required;

  return (
    <div className={`rounded-xl border px-4 py-3.5 flex items-start gap-3 ${c.bg} ${c.border}`}>
      <span className={c.text}>{c.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${c.text}`}>{c.label}</span>
          {urgency && urgency !== 'none' && (
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              urgency === 'high' ? 'bg-red-100 text-red-700' :
              urgency === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'
            }`}>{urgency} urgency</span>
          )}
        </div>
        <p className={`text-sm font-semibold mt-0.5 ${c.text}`}>{copilotMessage}</p>
      </div>
    </div>
  );
}

function FixCard({ fix, index }: { fix: string; index: number }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
      <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
        {index + 1}
      </span>
      <p className="text-sm text-amber-900 flex-1">{fix}</p>
      <ArrowRight className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
    </div>
  );
}

function TimelineStep({ step, status, detail }: { step: string; status: string; detail: string }) {
  const isDone = status === 'done';
  const isNA = status === 'n/a';
  const isPending = status === 'pending';

  const label = step.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={`flex items-start gap-3 ${isNA ? 'opacity-40' : ''}`}>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
        isDone ? 'border-emerald-400 bg-emerald-400' :
        isPending ? 'border-violet-400 bg-white' :
        'border-gray-300 bg-white'
      }`}>
        {isDone && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        {isPending && <div className="w-2 h-2 rounded-full bg-violet-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${isDone ? 'text-emerald-700' : isPending ? 'text-violet-700' : 'text-gray-500'}`}>{label}</p>
        <p className="text-[11px] text-gray-500">{detail}</p>
      </div>
      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
        isDone ? 'bg-emerald-100 text-emerald-700' :
        isPending ? 'bg-violet-100 text-violet-700' :
        'bg-gray-100 text-gray-500'
      }`}>{status}</span>
    </div>
  );
}

export default function ApprovalGuidancePanel({ items, onSaved }: Props) {
  const trips = useMemo(() => items.filter(isTravelItem).filter((i) => i._id), [items]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copilotMessage, setCopilotMessage] = useState('');
  const [requestDraft, setRequestDraft] = useState('');
  const [urgency, setUrgency] = useState<string>('none');
  const [draftOpen, setDraftOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [approval, setApproval] = useState<ApprovalData | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!trips.length) return;
    if (!selectedId || !trips.some((t) => t._id === selectedId)) {
      setSelectedId(trips[0]._id || '');
    }
  }, [trips, selectedId]);

  // Auto-load cached approval data when selection changes
  useEffect(() => {
    hasFetched.current = false;
    setSubmitDone(false);
    setErr(null);
    setCopilotMessage('');
    setRequestDraft('');
    setUrgency('none');
    setDraftOpen(false);

    const selected = trips.find((t) => t._id === selectedId);
    const travel = selected ? getTravelPayload(selected) : null;
    if (travel?.approval) {
      setApproval({
        status: travel.approval.status as ApprovalStatus,
        requiredBy: travel.approval.requiredBy,
        reasons: travel.approval.reasons,
        fixes: travel.approval.fixes,
        timeline: travel.approval.timeline,
        submittedAt: travel.approval.submittedAt,
        decisionAt: travel.approval.decisionAt,
      });
    } else {
      setApproval(null);
    }
  }, [selectedId, trips]);

  // Auto-fetch when selected trip changes and no cached data
  useEffect(() => {
    if (!selectedId || hasFetched.current) return;
    const selected = trips.find((t) => t._id === selectedId);
    if (!selected) return;
    hasFetched.current = true;
    void fetchApproval(selected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, trips]);

  const selected = trips.find((t) => t._id === selectedId) || null;
  const selectedTravel = selected ? getTravelPayload(selected) : null;

  const fetchApproval = async (item: Item) => {
    if (!item._id || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const travel = getTravelPayload(item);
      const res = await api.prepareTravelApproval({
        itemId: item._id,
        destination: travel?.location,
        startDate: travel?.startDate,
        endDate: travel?.endDate,
        costEstimate: travel?.costEstimate,
        status: travel?.opportunityStatus,
      });
      setApproval(res.approval as ApprovalData);
      setCopilotMessage(res.copilotMessage || res.plainLanguageStatus);
      setRequestDraft(res.requestDraft || res.approvalDraft || '');
      setUrgency(res.urgency || 'none');

      const mappedStatus = statusToOpportunity(res.approval.status);
      const merged: TravelMetadata = {
        ...((item.travel as Record<string, unknown>) || {}),
        approval: res.approval,
        privacy: res.privacy,
        ...(mappedStatus ? { opportunityStatus: mappedStatus } : {}),
      };
      await api.updateItem(item._id, { travel: merged });
      await onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load approval status');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (!selected) return;
    hasFetched.current = true;
    void fetchApproval(selected);
  };

  const handleSubmit = async () => {
    if (!selected?._id || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      await api.submitTravelApproval({ itemId: selected._id });
      setSubmitDone(true);
      setCopilotMessage("Your approval request is submitted. I'll flag anything that needs your attention.");
      setApproval((prev) => prev ? { ...prev, status: 'submitted' } : prev);

      const travel = getTravelPayload(selected);
      const merged: TravelMetadata = {
        ...((selected.travel as Record<string, unknown>) || {}),
        ...(travel || {}),
        opportunityStatus: 'submitted',
      };
      await api.updateItem(selected._id, { travel: merged });
      await onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not submit approval');
    } finally {
      setSubmitting(false);
    }
  };

  const copyDraft = async () => {
    if (!requestDraft) return;
    try {
      await navigator.clipboard.writeText(requestDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  if (!trips.length) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-900">Copilot Approval Status</h3>
        </div>
        <p className="text-xs text-gray-500">Create a travel option first and I'll check whether approval is needed.</p>
      </section>
    );
  }

  const status = approval?.status;
  const fixes = approval?.fixes || [];
  const reasons = approval?.reasons || [];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
            <h3 className="text-sm font-semibold text-gray-900">Copilot Approval</h3>
          </div>
          <div className="flex items-center gap-2">
            {trips.length > 1 && (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 max-w-[140px] truncate"
              >
                {trips.map((t) => {
                  const travel = getTravelPayload(t);
                  return (
                    <option key={t._id} value={t._id}>
                      {t.title}{travel?.location ? ` · ${travel.location}` : ''}
                    </option>
                  );
                })}
              </select>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="text-xs text-violet-600 hover:text-violet-700 font-medium disabled:opacity-50 flex items-center gap-1"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {loading ? 'Checking…' : 'Refresh'}
            </button>
          </div>
        </div>
        {trips.length === 1 && selectedTravel?.location && (
          <p className="text-xs text-gray-400 mt-0.5 ml-6">{selectedTravel.location}</p>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Loading skeleton */}
        {loading && !approval && (
          <div className="space-y-2 animate-pulse">
            <div className="h-14 rounded-xl bg-gray-100" />
            <div className="h-4 rounded bg-gray-100 w-3/4" />
            <div className="h-4 rounded bg-gray-100 w-1/2" />
          </div>
        )}

        {/* Status banner */}
        {!loading && approval && (
          <StatusBanner
            status={status as ApprovalStatus}
            copilotMessage={copilotMessage || 'Checking approval status…'}
            urgency={urgency}
          />
        )}

        {/* No data yet */}
        {!loading && !approval && !err && (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 text-violet-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">I'll check whether approval is needed for this trip.</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Check approval status
            </button>
          </div>
        )}

        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-800">{err}</p>
          </div>
        )}

        {approval && (
          <>
            {/* Why approval? (reasons) */}
            {reasons.length > 0 && status !== 'approved' && status !== 'not_required' && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Why approval is needed</p>
                {reasons.map((r, i) => (
                  <p key={i} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-gray-300 shrink-0">·</span>{r}
                  </p>
                ))}
              </div>
            )}

            {/* Fix items */}
            {fixes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Fix before submitting</p>
                {fixes.map((fix, i) => (
                  <FixCard key={i} fix={fix} index={i} />
                ))}
              </div>
            )}

            {/* Approval request draft */}
            {requestDraft && (status === 'required' || status === 'needs_changes' || status === 'pending') && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDraftOpen((p) => !p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-violet-500" />
                    Approval request — ready to send
                  </span>
                  {draftOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {draftOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{requestDraft}</p>
                    <button
                      type="button"
                      onClick={() => void copyDraft()}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                        copied
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                      }`}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy to clipboard'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submit button */}
            {status === 'required' && !submitDone && fixes.length === 0 && (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Submitting…' : 'Mark as Submitted'}
              </button>
            )}

            {submitDone && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p className="text-sm font-medium">Submitted! Your request is now awaiting decision.</p>
              </div>
            )}

            {/* Approval timeline (collapsible) */}
            {approval.timeline && approval.timeline.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTimelineOpen((p) => !p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-700">Approval timeline</span>
                  {timelineOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {timelineOpen && (
                  <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
                    {approval.timeline.map((step) => (
                      <TimelineStep key={step.step} step={step.step} status={step.status} detail={step.detail} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ask Copilot */}
            <Link
              href={`/assistant?q=${encodeURIComponent(
                status === 'needs_changes'
                  ? 'My approval needs changes. Explain why in plain language and tell me what to do first.'
                  : status === 'pending'
                  ? 'My approval is in review. What should I do while I wait?'
                  : 'What is the current status of my approval and what are the next steps?'
              )}`}
              className="flex items-center gap-2 text-xs text-violet-600 hover:text-violet-700 font-medium mt-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ask Copilot about this approval
              <ArrowRight className="w-3 h-3" />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
