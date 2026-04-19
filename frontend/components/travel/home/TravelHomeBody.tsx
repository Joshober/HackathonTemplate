'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, TRAVEL_ACTIVE_TEAM_STORAGE_KEY, type Item, type TravelMetadata } from '@/lib/api';
import { ChevronDown } from 'lucide-react';
import OpportunityCard from '@/components/travel/OpportunityCard';
import PlanStagePanel from '@/components/travel/home/PlanStagePanel';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import { filterTeamTripIdeas } from '@/lib/travelTeamPipeline';
import type { TravelApprovalRow, TravelOpportunityStatus } from '@/lib/travelTypes';
import type { User } from '@/lib/auth';
import { useTravelStage } from '@/lib/travelContext';
import TravelDayItinerary from '@/components/travel/TravelDayItinerary';
import ReturnStagePanel from '@/components/travel/home/ReturnStagePanel';
import PreTripChecklistPanel from '@/components/travel/workflow/PreTripChecklistPanel';
import ApprovalGuidancePanel from '@/components/travel/workflow/ApprovalGuidancePanel';
import IssueEscalationPanel from '@/components/travel/workflow/IssueEscalationPanel';
import PostTripFollowUpsPanel from '@/components/travel/workflow/PostTripFollowUpsPanel';
import TravelProactiveBanner from '@/components/travel/home/TravelProactiveBanner';
import HomeCommandCenter from '@/components/travel/home/HomeCommandCenter';

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
  const [teamApprovedItems, setTeamApprovedItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [availStart, setAvailStart] = useState('');
  const [availEnd, setAvailEnd] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefMsg, setPrefMsg] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await api.getItems();
      setItems(list);
      if (activeTeamId) {
        const shared = await api.getTeamReturnFeed(activeTeamId);
        setTeamApprovedItems(shared);
      } else {
        setTeamApprovedItems([]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load plan');
    } finally {
      setLoading(false);
    }
  }, [activeTeamId]);

  const travelItems = useMemo(() => items.filter(isTravelItem), [items]);
  const voterEmail = user.email?.trim() || '';

  const commandCenter = (
    <HomeCommandCenter travelItems={travelItems} activeTeamId={activeTeamId} stage={stage} />
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const readActiveTeam = () => {
      const tid = typeof window !== 'undefined' ? localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY)?.trim() : '';
      setActiveTeamId(tid || null);
    };
    readActiveTeam();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', readActiveTeam);
      window.addEventListener('focus', readActiveTeam);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', readActiveTeam);
        window.removeEventListener('focus', readActiveTeam);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeTeamId) {
      setAvailStart('');
      setAvailEnd('');
      setBudgetMin('');
      setBudgetMax('');
      return;
    }
    void (async () => {
      try {
        const res = await api.getTeamAvailability(activeTeamId);
        const mine =
          res.members.find((m) => m.userId === user.sub) ||
          res.members.find((m) => (m.email || '').trim().toLowerCase() === (user.email || '').trim().toLowerCase()) ||
          null;
        const first = mine?.windows?.[0];
        setAvailStart(first?.startDate || '');
        setAvailEnd(first?.endDate || '');
        setBudgetMin(mine?.budgetMin != null ? String(mine.budgetMin) : '');
        setBudgetMax(mine?.budgetMax != null ? String(mine.budgetMax) : '');
      } catch {
        // ignore
      }
    })();
  }, [activeTeamId, user.sub, user.email]);

  const saveMyApprovalPrefs = async () => {
    if (!activeTeamId || prefSaving) return;
    if (availStart && availEnd && availStart > availEnd) {
      setPrefMsg('Availability start date must be before end date.');
      return;
    }
    const minNum = budgetMin.trim() ? Number(budgetMin) : null;
    const maxNum = budgetMax.trim() ? Number(budgetMax) : null;
    if ((minNum != null && (!Number.isFinite(minNum) || minNum < 0)) || (maxNum != null && (!Number.isFinite(maxNum) || maxNum < 0))) {
      setPrefMsg('Budget range must be valid positive numbers.');
      return;
    }
    if (minNum != null && maxNum != null && minNum > maxNum) {
      setPrefMsg('Budget min must be less than or equal to budget max.');
      return;
    }
    setPrefSaving(true);
    setPrefMsg(null);
    try {
      const windows = availStart && availEnd ? [{ startDate: availStart, endDate: availEnd }] : [];
      await api.setMyTeamAvailability(activeTeamId, windows, { min: minNum, max: maxNum });
      setPrefMsg('Saved your availability and budget preferences for team approvals.');
    } catch (e) {
      setPrefMsg(e instanceof Error ? e.message : 'Could not save preferences');
    } finally {
      setPrefSaving(false);
    }
  };

  const sendAvailabilityRequestMessage = async (teamIdToAttach: string, item: Item, location: string) => {
    const availabilityRequest = `[SYSTEM_EVENT]${JSON.stringify({
      type: 'availability_request',
      itemId: item._id || null,
      title: item.title,
      city: location,
      message:
        'We are now looking into booking times. Please send your availability by connecting Google Calendar for a date range or entering it manually.',
    })}`;
    await api.sendTeamMessage(teamIdToAttach, availabilityRequest, { invokeAssistant: false });
  };

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
    const teamIdToAttach = teamId || item.teamId || undefined;
    await api.updateItem(item._id, {
      ...(teamIdToAttach ? { teamId: teamIdToAttach } : {}),
      travel: {
        ...t,
        opportunityStatus: 'submitted',
        approvals,
        approvalSetup,
        addedBy: t.addedBy || user.email,
      } as unknown as TravelMetadata,
    });
    if (teamIdToAttach) {
      const actor = user.name || user.email || 'A teammate';
      const location = t.location || 'Unknown location';
      const msg = `[SYSTEM] ${actor} submitted "${item.title}" in ${location} for team approval (Plan).`;
      try {
        await api.sendTeamMessage(teamIdToAttach, msg, { invokeAssistant: false });
        await sendAvailabilityRequestMessage(teamIdToAttach, item, location);
      } catch {
        // Keep approval state even if chat notice fails.
      }
    }
    await refresh();
  };

  const markAllReviewersApproved = async (item: Item) => {
    const t = getTravelPayload(item);
    if (!item._id || !t) return;
    const teamId =
      typeof window !== 'undefined' ? localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY)?.trim() : '';
    const teamIdToAttach = teamId || item.teamId || undefined;
    const base = t.approvals?.length ? t.approvals : [];
    if (base.length) {
      const approvals = base.map((a) => ({ ...a, status: 'approved' as const }));
      await api.updateItem(item._id, {
        ...(teamIdToAttach ? { teamId: teamIdToAttach } : {}),
        travel: {
          ...t,
          approvals,
          opportunityStatus: 'approved',
        } as unknown as TravelMetadata,
      });
    } else {
      await api.updateItem(item._id, {
        ...(teamIdToAttach ? { teamId: teamIdToAttach } : {}),
        travel: {
          ...t,
          opportunityStatus: 'approved',
        } as unknown as TravelMetadata,
      });
    }
    if (teamIdToAttach) {
      const actor = user.name || user.email || 'A teammate';
      const location = t.location || 'Unknown location';
      try {
        await api.sendTeamMessage(
          teamIdToAttach,
          `[SYSTEM] ${actor} approved "${item.title}" in ${location} from offline approval.`,
          { invokeAssistant: false }
        );
        await sendAvailabilityRequestMessage(teamIdToAttach, item, location);
      } catch {
        // Keep approval state even if chat notice fails.
      }
    }
    await refresh();
  };

  const voteCounts = (travel: { teamOptionVotes?: Record<string, string> } | null | undefined) => {
    const votes = travel?.teamOptionVotes;
    if (!votes || typeof votes !== 'object') return { a: 0, b: 0 };
    let a = 0;
    let b = 0;
    Object.values(votes).forEach((v) => {
      if (v === 'a') a += 1;
      if (v === 'b') b += 1;
    });
    return { a, b };
  };

  const voteOption = async (itemId: string, option: 'a' | 'b') => {
    if (!voterEmail) return;
    const current = items.find((i) => i._id === itemId);
    if (!current) return;
    const payload = getTravelPayload(current);
    if (!payload) return;
    const nextVotes = {
      ...(payload.teamOptionVotes || {}),
      [voterEmail]: option,
    };
    await api.updateItem(itemId, {
      travel: {
        ...payload,
        teamOptionVotes: nextVotes,
      } as unknown as TravelMetadata,
    });
    await refresh();
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
    return (
      <div className="space-y-4">
        {commandCenter}
        <PlanStagePanel travelItems={travelItems} onSubmitForApproval={(item) => submitApproval(item)} />
        <PreTripChecklistPanel items={travelItems} onSaved={refresh} />
      </div>
    );
  }

  if (stage === 'approve') {
    const teamTripIdeas = filterTeamTripIdeas(teamApprovedItems);

    return (
      <div className="space-y-4">
        {commandCenter}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Approval status</h2>
          <p className="text-sm text-travel-muted mt-1">Reviewers come from your active team on the Team tab.</p>
        </div>
        {!activeTeamId ? (
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
        {activeTeamId ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Your availability & budget for this team</p>
              <p className="text-xs text-travel-muted mt-0.5">
                Teammates can set their own preferred booking window and budget range here.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-travel-muted">
                Availability start
                <input
                  type="date"
                  value={availStart}
                  onChange={(e) => setAvailStart(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </label>
              <label className="text-xs text-travel-muted">
                Availability end
                <input
                  type="date"
                  value={availEnd}
                  onChange={(e) => setAvailEnd(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-travel-muted">
                Budget min (USD)
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </label>
              <label className="text-xs text-travel-muted">
                Budget max (USD)
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void saveMyApprovalPrefs()}
              disabled={prefSaving}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-medium"
            >
              {prefSaving ? 'Saving…' : 'Save my preferences'}
            </button>
            {prefMsg ? <p className="text-xs text-travel-muted">{prefMsg}</p> : null}
          </div>
        ) : null}
        {activeTeamId ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Team trip ideas</h3>
              <span className="text-xs text-travel-muted">{teamTripIdeas.length}</span>
            </div>
            <p className="text-xs text-travel-muted -mt-2">
              Options the planner added (Explorer) or sent from Plan — reviewers sign off here.
            </p>
            {teamTripIdeas.length === 0 ? (
              <p className="text-sm text-travel-muted">
                No shared ideas yet. Add trips on Explorer with this team selected, or send cards from Plan.
              </p>
            ) : (
              teamTripIdeas.map((item) => {
                const t = getTravelPayload(item);
                const img = t?.imageUrl || item.imageUrls?.[0];
                const approvals = t?.approvals || [];
                const allPending = approvals.length > 0 && approvals.every((a) => a.status === 'pending');
                const st = t?.opportunityStatus;
                const showOfflineApprove =
                  (st === 'submitted' || st === 'pending') && (approvals.length === 0 || allPending);
                const approvedBy = approvals.filter((a) => a.status === 'approved').map((a) => a.name.trim()).filter(Boolean);
                return (
                  <OpportunityCard
                    key={`team-approved-${item._id}`}
                    title={item.title}
                    subtitle={t?.location}
                    imageUrl={img}
                    footer={
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">{statusBadge(st)}</div>
                        {st === 'draft' || st === 'ready_for_approval' ? (
                          <p className="text-sm text-travel-muted">
                            In the planner queue — open <span className="font-medium text-gray-800">Plan</span> to send
                            this for team approval.
                          </p>
                        ) : approvedBy.length ? (
                          <p className="text-sm text-travel-muted">Approved by: {approvedBy.join(', ')}</p>
                        ) : (
                          <p className="text-sm text-travel-muted">No team members have approved this yet.</p>
                        )}
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
          </div>
        ) : null}
        <Link href="/explorer" className="block text-center text-xs text-blue-600 hover:underline pt-2 font-medium">
          Browse more opportunities on Explorer
        </Link>
        <ApprovalGuidancePanel items={travelItems} onSaved={refresh} />
      </div>
    );
  }

  if (stage === 'travel') {
    const options: Array<{ key: 'a' | 'b'; label: string }> = [
      { key: 'a', label: 'Option A — morning departure' },
      { key: 'b', label: 'Option B — flexible afternoon' },
    ];
    const hasNotBooked = travelItems.some((i) => getTravelPayload(i)?.opportunityStatus !== 'booked');

    return (
      <div className="space-y-6">
        {commandCenter}
        {/* Proactive travel banner */}
        <TravelProactiveBanner parsedDoc={null} travelItems={travelItems} />

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
        <IssueEscalationPanel items={travelItems} onSaved={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {commandCenter}
      <PostTripFollowUpsPanel items={travelItems} onSaved={refresh} />
      <ReturnStagePanel user={user} />
    </div>
  );
}
