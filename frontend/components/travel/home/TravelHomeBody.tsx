'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, TRAVEL_ACTIVE_TEAM_STORAGE_KEY, type Item, type TravelMetadata } from '@/lib/api';
import OpportunityCard from '@/components/travel/OpportunityCard';
import PlanStagePanel from '@/components/travel/home/PlanStagePanel';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import type { TravelApprovalRow } from '@/lib/travelTypes';
import type { User } from '@/lib/auth';

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

  return <PlanStagePanel travelItems={travelItems} onSubmitForApproval={(item) => submitApproval(item)} />;
}
