'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Item } from '@/lib/api';
import { getTravelPayload } from '@/lib/travelItem';
import type { TravelBookingEstimate } from '@/lib/travelTypes';
import { finalizeBookingForEligibleItem, findEligibleFinalizeItem, saveBookingEstimateToEligibleItem } from '@/lib/travelFinalize';

export function useApproveBookingPanel(items: Item[], refresh: () => Promise<void>) {
  const [approveMsg, setApproveMsg] = useState<string | null>(null);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [calcBusy, setCalcBusy] = useState(false);

  const eligibleFinalizeItem = useMemo(() => findEligibleFinalizeItem(items), [items]);
  const eligiblePayload = useMemo(
    () => (eligibleFinalizeItem ? getTravelPayload(eligibleFinalizeItem) : null),
    [eligibleFinalizeItem]
  );

  const onFinalize = useCallback(
    async (bundleIndex: number) => {
      setFinalizeBusy(true);
      setApproveMsg(null);
      const item = findEligibleFinalizeItem(items);
      const title = item?.title || 'Trip';
      const t = item ? getTravelPayload(item) : null;
      const r = await finalizeBookingForEligibleItem(items, bundleIndex, title, t?.bookingEstimate);
      setApproveMsg(r.message);
      if (r.ok) await refresh();
      setFinalizeBusy(false);
    },
    [items, refresh]
  );

  const onApplyCalculator = useCallback(
    async (estimate: TravelBookingEstimate) => {
      setCalcBusy(true);
      setApproveMsg(null);
      const r = await saveBookingEstimateToEligibleItem(items, estimate);
      setApproveMsg(r.message);
      if (r.ok) await refresh();
      setCalcBusy(false);
    },
    [items, refresh]
  );

  return {
    approveMsg,
    finalizeBusy,
    calcBusy,
    eligibleFinalizeItem,
    eligiblePayload,
    onFinalize,
    onApplyCalculator,
  };
}
