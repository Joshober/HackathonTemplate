import type { Item, TravelPricingPreviewResponse } from '@/lib/api';
import { api } from '@/lib/api';
import { getTravelPayload } from '@/lib/travelItem';
import { trimPricingEventForStorage } from '@/lib/travelQuoteRank';

type DateRow = { outbound: string; inbound: string };

/**
 * Save each trip's pricing row onto the item's `travel.travelPricingQuoteCache` in MongoDB.
 */
export async function persistTeamPricingQuotes(args: {
  pricedTrips: Item[];
  preview: TravelPricingPreviewResponse;
  originIata: string;
  datesById: Record<string, DateRow>;
  scenarioKey: string;
}): Promise<void> {
  const { pricedTrips, preview, originIata, datesById, scenarioKey } = args;
  const o = originIata.trim().toUpperCase();
  await Promise.all(
    pricedTrips.map(async (item, idx) => {
      const id = item._id;
      if (!id) return;
      const ev = preview.events[idx];
      if (!ev) return;
      const stableId = item._id || `idx-${idx}`;
      const dr = datesById[stableId];
      const existing = getTravelPayload(item);
      if (!existing) return;
      const trimmed = trimPricingEventForStorage(ev);
      try {
        await api.updateItem(id, {
          travel: {
            ...existing,
            travelPricingQuoteCache: {
              savedAt: new Date().toISOString(),
              originIata: o,
              outboundDate: String(ev.outboundDate || dr?.outbound || '').slice(0, 10),
              inboundDate: String(ev.inboundDate || dr?.inbound || '').slice(0, 10),
              scenarioKey,
              event: trimmed,
            },
          },
        });
      } catch {
        /* ignore per-item */
      }
    }),
  );
}
