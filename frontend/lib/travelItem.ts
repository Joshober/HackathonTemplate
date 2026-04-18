import type { Item } from '@/lib/api';
import type { TravelItemPayload, TravelOpportunityStatus } from '@/lib/travelTypes';

const SENTINEL = '__TRAVEL_JSON__';

export function isTravelItem(item: Item): boolean {
  if (item.travel && typeof item.travel === 'object') {
    const loc = (item.travel as { location?: unknown }).location;
    if (typeof loc === 'string' && loc.trim()) return true;
  }
  return typeof item.description === 'string' && item.description.startsWith(SENTINEL);
}

export function getTravelPayload(item: Item): TravelItemPayload | null {
  if (item.travel && typeof item.travel === 'object') {
    return normalizeTravel(item.travel as Record<string, unknown>);
  }
  if (typeof item.description === 'string' && item.description.startsWith(SENTINEL)) {
    try {
      const raw = JSON.parse(item.description.slice(SENTINEL.length)) as Record<string, unknown>;
      return normalizeTravel(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeTravel(raw: Record<string, unknown>): TravelItemPayload | null {
  const location = typeof raw.location === 'string' ? raw.location : '';
  if (!location) return null;
  return {
    location,
    costEstimate: typeof raw.costEstimate === 'number' ? raw.costEstimate : Number(raw.costEstimate) || 0,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    tripType: typeof raw.tripType === 'string' ? raw.tripType : 'business',
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined,
    addedBy: typeof raw.addedBy === 'string' ? raw.addedBy : undefined,
    opportunityStatus: raw.opportunityStatus as TravelOpportunityStatus | undefined,
    approvals: Array.isArray(raw.approvals) ? (raw.approvals as TravelItemPayload['approvals']) : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
  };
}

export function buildTravelDescription(payload: TravelItemPayload, humanLine: string): string {
  const embedded = { ...payload, humanLine };
  return `${SENTINEL}${JSON.stringify(embedded)}`;
}

export function humanDescriptionLine(item: Item, payload: TravelItemPayload | null): string {
  if (typeof item.description === 'string' && item.description.startsWith(SENTINEL)) {
    try {
      const o = JSON.parse(item.description.slice(SENTINEL.length)) as { humanLine?: string };
      if (typeof o.humanLine === 'string') return o.humanLine;
    } catch {
      /* fall through */
    }
  }
  if (payload?.notes) return payload.notes;
  return item.description?.replace(SENTINEL, '').trim() || '';
}
