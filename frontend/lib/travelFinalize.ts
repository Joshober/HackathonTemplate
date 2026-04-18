import { api, type Item, type TravelMetadata } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import { buildDefaultBookingEstimate, mergeBookedTravel } from '@/lib/travelTicketMock';
import type { TravelBookingEstimate } from '@/lib/travelTypes';

/** First trip in approval pipeline that can be finalized (demo). */
export function findEligibleFinalizeItem(items: Item[]): Item | null {
  const travelItems = items.filter(isTravelItem);
  return (
    travelItems.find((i) => {
      const t = getTravelPayload(i);
      const st = t?.opportunityStatus;
      return st === 'submitted' || st === 'approved' || st === 'pending' || st === 'needs_changes';
    }) ?? null
  );
}

export async function saveBookingEstimateToEligibleItem(
  items: Item[],
  estimate: TravelBookingEstimate
): Promise<{ ok: boolean; message: string }> {
  const item = findEligibleFinalizeItem(items);
  const t = item ? getTravelPayload(item) : null;
  if (!item?._id || !t) {
    return { ok: false, message: 'No trip in approval — submit a plan from the Plan stage first.' };
  }
  await api.updateItem(item._id, {
    travel: { ...t, bookingEstimate: estimate } as unknown as TravelMetadata,
  });
  return { ok: true, message: 'Estimate saved on the first in-approval trip.' };
}

export async function finalizeBookingForEligibleItem(
  items: Item[],
  bundleIndex: number,
  tripTitle: string,
  estimate?: TravelBookingEstimate
): Promise<{ ok: boolean; message: string }> {
  const item = findEligibleFinalizeItem(items);
  const t = item ? getTravelPayload(item) : null;
  if (!item?._id || !t) {
    return { ok: false, message: 'No trip in approval — submit a plan from the Plan stage first.' };
  }
  const baseEst = estimate ?? t.bookingEstimate ?? buildDefaultBookingEstimate(t.costEstimate || 1200);
  const withEst: typeof t = { ...t, bookingEstimate: baseEst };
  const merged = mergeBookedTravel(withEst, { bundleIndex, tripTitle });
  await api.updateItem(item._id, { travel: merged as unknown as TravelMetadata });
  return { ok: true, message: 'Booking saved. Open the Travel stage to see today’s flight and ticket.' };
}
