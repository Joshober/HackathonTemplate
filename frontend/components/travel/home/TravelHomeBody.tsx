'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { api, TRAVEL_ACTIVE_TEAM_STORAGE_KEY, type Item, type TravelMetadata } from '@/lib/api';
import { useTravelStage } from '@/lib/travelContext';
import OpportunityCard from '@/components/travel/OpportunityCard';
import PlanStagePanel from '@/components/travel/home/PlanStagePanel';
import { getTravelPayload, humanDescriptionLine, isTravelItem } from '@/lib/travelItem';
import type { TravelApprovalRow, TravelOpportunityStatus } from '@/lib/travelTypes';
import type { User } from '@/lib/auth';
import ApproveFlightBundles from '@/components/travel/approve/ApproveFlightBundles';
import TravelCostCalculator from '@/components/travel/approve/TravelCostCalculator';
import TravelDayItinerary from '@/components/travel/TravelDayItinerary';
import { useApproveBookingPanel } from '@/components/travel/approve/useApproveBookingPanel';
import ReturnStagePanel from '@/components/travel/home/ReturnStagePanel';

function statusBadge(status: TravelOpportunityStatus | undefined) {
  const s = status || 'draft';
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    ready_for_approval: 'bg-blue-50 text-blue-800',
    submitted: 'bg-violet-50 text-violet-800',
    pending: 'bg-amber-50 text-amber-800',
    approved: 'bg-emerald-50 text-emerald-800',
    needs_changes: 'bg-red-50 text-red-800',
    booked: 'bg-emerald-100 text-emerald-900',
    completed: 'bg-orange-50 text-orange-800',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${map[s] || map.draft}`}>
      {s.replace(/_/g, ' ')}
    </span>
  );
}

export default function TravelHomeBody({ user }: { user: User }) {
  const { stage } = useTravelStage();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await api.getItems();
      setItems(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load plan');
    } finally {
      setLoading(false);
    }
  }, []);

  const travelItems = useMemo(() => items.filter(isTravelItem), [items]);
  const approvePanel = useApproveBookingPanel(items, refresh);
  const voterEmail = user.email?.trim() || '';

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submitApproval = async (item: Item) => {
    const t = getTravelPayload(item);
    if (!t || !item._id) return;
    let approvals: TravelApprovalRow[] = [];
    let approvalSetup: 'team_linked' | 'needs_team' = 'needs_team';
    const teamId =
      typeof window !== 'undefined' ? localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY)?.trim() : '';
    if (teamId) {
      try {
        const detail = await api.getTeam(teamId);
        if (detail.members?.length) {
          approvals = detail.members.map((m) => ({
            name: (m.displayName || m.email || 'Team member').trim(),
            role: 'Reviewer',
            status: 'pending' as const,
          }));
          approvalSetup = 'team_linked';
        }
      } catch {
        /* keep needs_team */
      }
    }
    await api.updateItem(item._id, {
      travel: {
        ...t,
        opportunityStatus: 'submitted',
        approvals,
        approvalSetup,
        addedBy: t.addedBy || user.email,
      } as unknown as TravelMetadata,
    });
    await refresh();
  };

  const markAllReviewersApproved = async (item: Item) => {
    const t = getTravelPayload(item);
    if (!item._id || !t) return;
    const base = t.approvals?.length ? t.approvals : [];
    if (base.length) {
      const approvals = base.map((a) => ({ ...a, status: 'approved' as const }));
      await api.updateItem(item._id, {
        travel: {
          ...t,
          approvals,
          opportunityStatus: 'approved',
        } as unknown as TravelMetadata,
      });
    } else {
      await api.updateItem(item._id, {
        travel: {
          ...t,
          opportunityStatus: 'approved',
        } as unknown as TravelMetadata,
      });
    }
    await refresh();
  };

  const voteOption = async (itemId: string, key: string) => {
    const item = items.find((i) => i._id === itemId);
    if (!item?._id) return;
    const t = getTravelPayload(item);
    if (!t) return;
    const email = voterEmail || 'self';
    const teamOptionVotes = { ...(t.teamOptionVotes || {}), [email]: key };
    await api.updateItem(item._id, {
      travel: { ...t, teamOptionVotes } as unknown as TravelMetadata,
    });
    await refresh();
  };

  const voteCounts = (t: NonNullable<ReturnType<typeof getTravelPayload>>) => {
    const votes = t.teamOptionVotes || {};
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (const v of Object.values(votes)) {
      if (v === 'a' || v === 'b') counts[v] = (counts[v] || 0) + 1;
    }
    return counts;
  };

  if (loading && !items.length) {
    return (
      <div className="flex items-center justify-center py-20 text-travel-muted text-sm">
        Loading your plan…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {err}
      </div>
    );
  }

  if (stage === 'plan') {
    return <PlanStagePanel travelItems={travelItems} onSubmitForApproval={(item) => submitApproval(item)} />;
  }

  if (stage === 'approve') {
    const inReview = travelItems.filter((i) => {
      const st = getTravelPayload(i)?.opportunityStatus;
      return st === 'submitted' || st === 'pending' || st === 'approved' || st === 'needs_changes';
    });

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Approval status</h2>
          <p className="text-sm text-travel-muted mt-1">Reviewers come from your active team on the Team tab.</p>
        </div>
        {inReview.some((i) => getTravelPayload(i)?.approvalSetup === 'needs_team') ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium text-gray-900">No active team selected</p>
            <p className="text-xs text-amber-800/90 mt-1">
              Pick a team on the Team tab so reviewer names populate on the next submit. You can still record offline
              approvals below if you already have sign-off.
            </p>
            <Link href="/team" className="inline-block mt-2 text-xs text-blue-600 hover:underline font-medium">
              Open Team
            </Link>
          </div>
        ) : null}
        {inReview.length === 0 ? (
          <p className="text-sm text-travel-muted">No items in approval. Submit a plan from the Plan stage.</p>
        ) : (
          inReview.map((item) => {
            const t = getTravelPayload(item);
            const approvals = t?.approvals || [];
            const img = t?.imageUrl || item.imageUrls?.[0];
            const allPending = approvals.length > 0 && approvals.every((a) => a.status === 'pending');
            const showOfflineApprove =
              t?.opportunityStatus === 'submitted' && (approvals.length === 0 || allPending);
            return (
              <OpportunityCard
                key={item._id}
                title={item.title}
                subtitle={humanDescriptionLine(item, t)}
                imageUrl={img}
                footer={
                  <div className="space-y-3">
                    <ul className="space-y-2">
                      {approvals.map((a, idx) => (
                        <li key={idx} className="flex items-center justify-between text-sm gap-2">
                          <span className="text-gray-900">
                            {a.name} <span className="text-travel-muted text-xs">({a.role})</span>
                          </span>
                          {statusBadge(a.status as TravelOpportunityStatus)}
                        </li>
                      ))}
                      {approvals.length === 0 ? (
                        <li className="text-travel-muted text-sm">No reviewers listed — select a team and re-submit from Plan.</li>
                      ) : null}
                    </ul>
                    {showOfflineApprove ? (
                      <button
                        type="button"
                        onClick={() => void markAllReviewersApproved(item)}
                        className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
                      >
                        {approvals.length
                          ? 'Record offline approvals (mark all approved)'
                          : 'Approve trip (no team reviewers on file)'}
                      </button>
                    ) : null}
                  </div>
                }
              />
            );
          })
        )}
        <div className="pt-4 border-t border-gray-200 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Booking & cost</h3>
            <p className="text-xs text-travel-muted">
              Refresh live quotes on Explorer (Approve stage), then finalize a bundle — your trip record stores those
              links.
            </p>
          </div>
          <ApproveFlightBundles busy={approvePanel.finalizeBusy} onFinalize={approvePanel.onFinalize} />
          <TravelCostCalculator
            key={approvePanel.eligibleFinalizeItem?._id ?? 'calc'}
            initialFlightLow={approvePanel.eligiblePayload?.bookingEstimate?.flightLow ?? 420}
            initialFlightHigh={approvePanel.eligiblePayload?.bookingEstimate?.flightHigh ?? 510}
            initialHotelPerNight={approvePanel.eligiblePayload?.bookingEstimate?.hotelPerNight ?? 180}
            initialNights={approvePanel.eligiblePayload?.bookingEstimate?.nights ?? 2}
            busy={approvePanel.calcBusy}
            onApply={approvePanel.onApplyCalculator}
            applyLabel="Save estimate to first in-approval trip"
          />
          {approvePanel.approveMsg ? (
            <p className="text-xs text-center text-travel-muted border border-gray-200 bg-gray-50 rounded-lg py-2 px-3">
              {approvePanel.approveMsg}
            </p>
          ) : null}
        </div>
        <Link href="/explorer" className="block text-center text-xs text-blue-600 hover:underline pt-2 font-medium">
          Browse more opportunities on Explorer
        </Link>
      </div>
    );
  }

  if (stage === 'travel') {
    const options = [
      { key: 'a', label: 'Option A — morning departure' },
      { key: 'b', label: 'Option B — flexible afternoon' },
    ];
    const hasNotBooked = travelItems.some((i) => getTravelPayload(i)?.opportunityStatus !== 'booked');

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Today & trip record</h2>
          <p className="text-sm text-travel-muted mt-1">Day-of checklist and booking links from your saved pricing snapshot.</p>
        </div>
        <TravelDayItinerary items={items} />

        {hasNotBooked && travelItems.length > 0 ? (
          <details className="rounded-2xl border border-gray-200 bg-white group shadow-sm">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-900 list-none flex items-center justify-between">
              <span>Team option voting (pre-book)</span>
              <ChevronDown className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform shrink-0" aria-hidden />
            </summary>
            <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-3">
              <p className="text-[11px] text-travel-muted">
                Votes are saved on each trip so teammates see the same counts. Finalize bundles in{' '}
                <Link href="/home" className="text-blue-600 hover:underline font-medium">
                  Approve
                </Link>{' '}
                to attach flight and hotel links.
              </p>
              {travelItems.map((item) => {
                const t = getTravelPayload(item);
                if (!t || t.opportunityStatus === 'booked') return null;
                const img = t?.imageUrl || item.imageUrls?.[0];
                const current = voterEmail && t.teamOptionVotes ? t.teamOptionVotes[voterEmail] : '';
                const counts = voteCounts(t);
                return (
                  <OpportunityCard
                    key={item._id}
                    title={item.title}
                    subtitle={t?.location}
                    imageUrl={img}
                    footer={
                      <div className="space-y-2">
                        <p className="text-[10px] text-travel-muted">
                          Team votes: A {counts.a} · B {counts.b}
                        </p>
                        {options.map((o) => {
                          const picked = current === o.key;
                          return (
                            <button
                              key={o.key}
                              type="button"
                              onClick={() => item._id && void voteOption(item._id, o.key)}
                              className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                                picked
                                  ? 'border-emerald-300 bg-emerald-50 text-gray-900'
                                  : 'border-gray-200 text-travel-muted hover:border-gray-300 bg-white'
                              }`}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    }
                  />
                );
              })}
            </div>
          </details>
        ) : null}

        <Link href="/team" className="block text-center text-xs text-blue-600 hover:underline font-medium">
          Team tab
        </Link>
      </div>
    );
  }

  return <ReturnStagePanel user={user} />;
}
