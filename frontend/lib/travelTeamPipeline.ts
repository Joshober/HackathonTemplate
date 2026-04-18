import type { Item } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import type { TravelOpportunityStatus } from '@/lib/travelTypes';

/** Same ordering as Home Approve "Team trip ideas". */
export const TEAM_TRIP_IDEAS_STATUS_ORDER: Record<string, number> = {
  submitted: 0,
  pending: 1,
  needs_changes: 2,
  ready_for_approval: 3,
  draft: 4,
  approved: 5,
  booked: 6,
  completed: 7,
};

export function isTeamTripIdeasStatus(st: TravelOpportunityStatus | undefined): boolean {
  return (
    st === 'draft' ||
    st === 'ready_for_approval' ||
    st === 'submitted' ||
    st === 'pending' ||
    st === 'approved' ||
    st === 'booked' ||
    st === 'completed' ||
    st === 'needs_changes'
  );
}

/** Items shown in Home Approve "Team trip ideas" (team return-feed rows only). */
export function filterTeamTripIdeas(items: Item[]): Item[] {
  return items
    .filter((i) => {
      if (!isTravelItem(i)) return false;
      return isTeamTripIdeasStatus(getTravelPayload(i)?.opportunityStatus);
    })
    .sort((a, b) => {
      const sa = TEAM_TRIP_IDEAS_STATUS_ORDER[getTravelPayload(a)?.opportunityStatus || 'draft'] ?? 99;
      const sb = TEAM_TRIP_IDEAS_STATUS_ORDER[getTravelPayload(b)?.opportunityStatus || 'draft'] ?? 99;
      if (sa !== sb) return sa - sb;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
}

/** Keep one row per Mongo id (latest `updatedAt` wins). */
export function dedupeItemsById(items: Item[]): Item[] {
  const map = new Map<string, Item>();
  for (const i of items) {
    const id = i._id?.trim();
    if (!id) continue;
    const prev = map.get(id);
    if (!prev || (i.updatedAt || '') > (prev.updatedAt || '')) {
      map.set(id, i);
    }
  }
  return Array.from(map.values());
}
