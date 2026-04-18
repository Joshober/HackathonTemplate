'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, type Item, type TravelMetadata } from '@/lib/api';
import { useTravelStage } from '@/lib/travelContext';
import OpportunityCard from '@/components/travel/OpportunityCard';
import { getTravelPayload, humanDescriptionLine, isTravelItem } from '@/lib/travelItem';
import { loadVotes, setVote } from '@/lib/travelVotes';
import type { TravelApprovalRow, TravelOpportunityStatus } from '@/lib/travelTypes';
import type { User } from '@/lib/auth';
import ApproveFlightBundles from '@/components/travel/approve/ApproveFlightBundles';
import TravelCostCalculator from '@/components/travel/approve/TravelCostCalculator';
import TravelDayItinerary from '@/components/travel/TravelDayItinerary';
import { mergeBookedTravel } from '@/lib/travelTicketMock';
import { useApproveBookingPanel } from '@/components/travel/approve/useApproveBookingPanel';

const MOCK_SHARE = [
  { who: 'Alex R.', snippet: 'Highlights from the Chicago forum — great client energy.' },
  { who: 'Jordan L.', snippet: 'Cost summary + 3 photos from the team dinner.' },
];

function statusBadge(status: TravelOpportunityStatus | undefined) {
  const s = status || 'draft';
  const map: Record<string, string> = {
    draft: 'bg-white/10 text-white/80',
    ready_for_approval: 'bg-stage-plan/20 text-blue-200',
    submitted: 'bg-stage-approve/20 text-violet-200',
    pending: 'bg-amber-500/15 text-amber-200',
    approved: 'bg-stage-travel/20 text-emerald-200',
    needs_changes: 'bg-red-500/15 text-red-200',
    booked: 'bg-stage-travel/25 text-emerald-100',
    completed: 'bg-stage-return/20 text-orange-200',
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
  const [votes, setVotesState] = useState(() => loadVotes());

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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submitApproval = async (item: Item) => {
    const t = getTravelPayload(item);
    if (!t || !item._id) return;
    const approvals: TravelApprovalRow[] = [
      { name: 'Alex Rivera', role: 'Manager', status: 'pending' },
      { name: 'Jordan Lee', role: 'Finance', status: 'pending' },
      { name: 'Sam Okonkwo', role: 'Travel desk', status: 'approved' },
    ];
    await api.updateItem(item._id, {
      travel: {
        ...t,
        opportunityStatus: 'submitted',
        approvals,
        addedBy: t.addedBy || user.email,
      },
    });
    await refresh();
  };

  const markBooked = async (item: Item) => {
    const t = getTravelPayload(item);
    if (!t || !item._id) return;
    const merged = mergeBookedTravel(t, { bundleIndex: 0, tripTitle: item.title });
    await api.updateItem(item._id, { travel: merged as unknown as TravelMetadata });
    await refresh();
  };

  const voteOption = (itemId: string, key: string) => {
    setVote(itemId, key);
    setVotesState(loadVotes());
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
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
        {err}
      </div>
    );
  }

  if (stage === 'plan') {
    const waiting = travelItems.filter((i) => {
      const st = (getTravelPayload(i)?.opportunityStatus || 'draft') as TravelOpportunityStatus;
      return st === 'draft' || st === 'ready_for_approval';
    });

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Planning dashboard</h2>
          <p className="text-sm text-travel-muted mt-1">Opportunities ready for the next step.</p>
        </div>
        {waiting.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-travel-muted text-sm">
            Nothing waiting yet.{' '}
            <Link href="/explorer" className="text-blue-300 hover:underline">
              Browse Explorer
            </Link>{' '}
            and add a trip.
          </div>
        ) : (
          waiting.map((item) => {
            const t = getTravelPayload(item);
            const st = (t?.opportunityStatus || 'draft') as TravelOpportunityStatus;
            const img = t?.imageUrl || item.imageUrls?.[0];
            return (
              <OpportunityCard
                key={item._id}
                title={item.title}
                subtitle={`${t?.location ?? ''} · Est. $${t?.costEstimate?.toLocaleString() ?? '—'} · ${t?.addedBy || 'You'}`}
                imageUrl={img}
                footer={
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(st)}
                    {t?.tags?.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-travel-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                }
                action={
                  st === 'draft' || st === 'ready_for_approval' ? (
                    <button
                      type="button"
                      onClick={() => submitApproval(item)}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                    >
                      Submit for approval
                    </button>
                  ) : st === 'submitted' ? (
                    <p className="text-xs text-travel-muted">In approval queue — check the Approve stage.</p>
                  ) : null
                }
              />
            );
          })
        )}
      </div>
    );
  }

  if (stage === 'approve') {
    const inReview = travelItems.filter((i) => {
      const st = getTravelPayload(i)?.opportunityStatus;
      return st === 'submitted' || st === 'pending' || st === 'approved' || st === 'needs_changes';
    });

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Approval status</h2>
          <p className="text-sm text-travel-muted mt-1">Who has signed off, and what is still open.</p>
        </div>
        {inReview.length === 0 ? (
          <p className="text-sm text-travel-muted">No items in approval. Submit a plan from the Plan stage.</p>
        ) : (
          inReview.map((item) => {
            const t = getTravelPayload(item);
            const approvals = t?.approvals || [];
            const img = t?.imageUrl || item.imageUrls?.[0];
            return (
              <OpportunityCard
                key={item._id}
                title={item.title}
                subtitle={humanDescriptionLine(item, t)}
                imageUrl={img}
                footer={
                  <ul className="space-y-2">
                    {approvals.map((a, idx) => (
                      <li key={idx} className="flex items-center justify-between text-sm gap-2">
                        <span className="text-white/90">
                          {a.name}{' '}
                          <span className="text-travel-muted text-xs">({a.role})</span>
                        </span>
                        {statusBadge(a.status as TravelOpportunityStatus)}
                      </li>
                    ))}
                    {approvals.length === 0 ? <li className="text-travel-muted text-sm">No approvers attached yet.</li> : null}
                  </ul>
                }
              />
            );
          })
        )}
        <div className="pt-4 border-t border-white/10 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Booking & cost</h3>
            <p className="text-xs text-travel-muted">Compare bundles and run totals while approvals are in flight.</p>
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
            <p className="text-xs text-center text-travel-muted border border-white/10 rounded-lg py-2 px-3">
              {approvePanel.approveMsg}
            </p>
          ) : null}
        </div>
        <Link href="/explorer" className="block text-center text-xs text-blue-300 hover:underline pt-2">
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
          <h2 className="text-lg font-semibold text-white">Today & ticket</h2>
          <p className="text-sm text-travel-muted mt-1">What you need to do today and your ticket details (demo).</p>
        </div>
        <TravelDayItinerary items={items} />

        {hasNotBooked && travelItems.length > 0 ? (
          <details className="rounded-2xl border border-white/10 bg-white/[0.02] group">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-white/90 list-none flex items-center justify-between">
              <span>Team option voting (pre-book)</span>
              <span className="material-symbols-outlined text-travel-muted group-open:rotate-180 transition-transform">
                expand_more
              </span>
            </summary>
            <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-3">
              {travelItems.map((item) => {
                const t = getTravelPayload(item);
                if (t?.opportunityStatus === 'booked') return null;
                const img = t?.imageUrl || item.imageUrls?.[0];
                const current = item._id ? votes[item._id] : '';
                return (
                  <OpportunityCard
                    key={item._id}
                    title={item.title}
                    subtitle={t?.location}
                    imageUrl={img}
                    footer={
                      <div className="space-y-2">
                        {options.map((o) => {
                          const picked = current === o.key;
                          return (
                            <button
                              key={o.key}
                              type="button"
                              onClick={() => item._id && voteOption(item._id, o.key)}
                              className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                                picked
                                  ? 'border-emerald-400/50 bg-emerald-500/10 text-white'
                                  : 'border-white/10 text-travel-muted hover:border-white/20'
                              }`}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    }
                    action={
                      <button
                        type="button"
                        onClick={() => markBooked(item)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-sm font-medium"
                      >
                        Lock trip & ticket (demo)
                      </button>
                    }
                  />
                );
              })}
            </div>
          </details>
        ) : null}

        <Link href="/team" className="block text-center text-xs text-blue-300 hover:underline">
          Team tab
        </Link>
      </div>
    );
  }

  /* return */
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Post-trip sharing</h2>
        <p className="text-sm text-travel-muted mt-1">See what teammates are preparing to share.</p>
      </div>
      {MOCK_SHARE.map((m, i) => (
        <div key={i} className="rounded-2xl border border-white/10 p-4 bg-white/[0.02]">
          <p className="text-xs text-travel-muted mb-1">{m.who}</p>
          <p className="text-sm text-white/90">{m.snippet}</p>
        </div>
      ))}
      <Link
        href="/assistant?topic=memory"
        className="block w-full text-center py-3 rounded-xl bg-orange-600/90 hover:bg-orange-500 text-white text-sm font-semibold"
      >
        Customize your post
      </Link>
      <Link
        href="/explorer"
        className="block w-full text-center py-3 rounded-xl border border-white/10 text-sm text-white/80 hover:bg-white/5"
      >
        Memory + content builder
      </Link>
    </div>
  );
}
