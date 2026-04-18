import { api, type Item, type TravelMetadata } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import { buildDefaultBookingEstimate } from '@/lib/travelTicketMock';
import type { TravelBookingEstimate, TravelPricingSnapshot, TravelTripRecord } from '@/lib/travelTypes';
import {
  buildTravelPricingSnapshot,
  clearLastPricingSession,
  loadLastPricingSession,
} from '@/lib/travelPricingSession';

/** First trip in approval pipeline that can be finalized. */
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

function dedupeLinks(links: TravelTripRecord['bookingLinks']): TravelTripRecord['bookingLinks'] {
  const seen = new Set<string>();
  return links.filter((l) => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}

function buildTripRecordFromSnapshot(
  snapshot: TravelPricingSnapshot,
  tripTitle: string,
  location: string
): TravelTripRecord {
  const links: TravelTripRecord['bookingLinks'] = [];
  for (const ev of snapshot.events) {
    if (ev.googleFlightsSearch) {
      links.push({ label: `Google Flights — ${ev.tripTitle || tripTitle}`, url: ev.googleFlightsSearch });
    }
    if (ev.googleHotelsSearch) {
      links.push({ label: `Google Hotels — ${ev.tripTitle || tripTitle}`, url: ev.googleHotelsSearch });
    }
  }
  const first = snapshot.events[0];
  const loc = first?.resolvedLabel || first?.destinationQuery || location;
  return {
    title: tripTitle,
    locationSummary: loc,
    checklistIntro:
      snapshot.mode === 'links_only'
        ? 'Comparison links only were available — confirm schedules and book through your travel desk or airline.'
        : 'Air and hotel offers were captured when you saved pricing — re-check availability and fare before purchase.',
    bookingLinks: dedupeLinks(links),
  };
}

function buildTripRecordWithoutSnapshot(tripTitle: string, location: string): TravelTripRecord {
  return {
    title: tripTitle,
    locationSummary: location,
    checklistIntro:
      'No pricing snapshot was on file. Open Approve → refresh live quotes, then finalize again to attach Google Flights and Hotels links.',
    bookingLinks: [],
  };
}

function mergeBookedFromData(
  existing: NonNullable<ReturnType<typeof getTravelPayload>>,
  bundleIndex: number,
  tripTitle: string,
  estimate: TravelBookingEstimate,
  pricingSnapshot: TravelPricingSnapshot | null
): TravelMetadata {
  const selectedBundle = bundleIndex === 0 ? 'Economy mix' : 'Flexible fare';
  const midpoint = Math.round((estimate.flightLow + estimate.flightHigh) / 2) + estimate.hotelPerNight * estimate.nights;
  const tripRecord = pricingSnapshot
    ? buildTripRecordFromSnapshot(pricingSnapshot, tripTitle, existing.location)
    : buildTripRecordWithoutSnapshot(tripTitle, existing.location);

  const { ticket: _drop, ...rest } = existing;
  const merged: TravelMetadata = {
    ...(rest as unknown as TravelMetadata),
    opportunityStatus: 'booked',
    bookingEstimate: {
      ...estimate,
      selectedBundle,
      totalLow: estimate.totalLow,
      totalHigh: estimate.totalHigh,
      lastCalculatedTotal: midpoint,
    },
    tripRecord,
  };
  if (pricingSnapshot) {
    (merged as Record<string, unknown>).travelPricingSnapshot = pricingSnapshot;
  }
  return merged;
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

  const session = typeof window !== 'undefined' ? loadLastPricingSession() : null;
  const pricingSnapshot =
    session?.preview && session.originIata
      ? buildTravelPricingSnapshot(session.preview, session.originIata)
      : null;

  const merged = mergeBookedFromData(t, bundleIndex, tripTitle, baseEst, pricingSnapshot);
  await api.updateItem(item._id, { travel: merged });
  clearLastPricingSession();
  return {
    ok: true,
    message: pricingSnapshot
      ? 'Trip record saved with your latest pricing snapshot. Open Travel for checklist and booking links.'
      : 'Trip marked booked with calculator estimate. Run live quotes in Approve and finalize again to attach flight and hotel links.',
  };
}
