'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TRAVEL_OPPORTUNITY_SEED } from '@/lib/travelSeed';
import { useTravelStage } from '@/lib/travelContext';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import OpportunityCard from '@/components/travel/OpportunityCard';
import { api, type Item } from '@/lib/api';
import PolicyHint from '@/components/travel/PolicyHint';
import ApproveFlightBundles from '@/components/travel/approve/ApproveFlightBundles';
import TravelCostCalculator from '@/components/travel/approve/TravelCostCalculator';
import { useApproveBookingPanel } from '@/components/travel/approve/useApproveBookingPanel';
import TravelDayItinerary from '@/components/travel/TravelDayItinerary';

export default function ExplorerPage() {
  const { stage } = useTravelStage();
  const { user, loading } = useTravelAuth();
  const [locationQ, setLocationQ] = useState('');
  const [maxBudget, setMaxBudget] = useState(5000);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [panelItems, setPanelItems] = useState<Item[]>([]);

  const refreshPanelItems = useCallback(async () => {
    try {
      setPanelItems(await api.getItems());
    } catch {
      setPanelItems([]);
    }
  }, []);

  useEffect(() => {
    if (stage === 'approve' || stage === 'travel') {
      void refreshPanelItems();
    }
  }, [stage, refreshPanelItems]);

  const approvePanel = useApproveBookingPanel(panelItems, refreshPanelItems);

  const filtered = useMemo(() => {
    return TRAVEL_OPPORTUNITY_SEED.filter((o) => {
      if (locationQ.trim() && !o.location.toLowerCase().includes(locationQ.trim().toLowerCase())) return false;
      if (o.costEstimate > maxBudget) return false;
      return true;
    });
  }, [locationQ, maxBudget]);

  const addToPlan = async (id: string) => {
    if (!user?.email) return;
    const o = TRAVEL_OPPORTUNITY_SEED.find((x) => x.id === id);
    if (!o) return;
    setBusyId(id);
    setToast(null);
    try {
      await api.createItem({
        title: o.title,
        description: `${o.title} — ${o.tripType} trip to ${o.location}.`,
        travel: {
          location: o.location,
          costEstimate: o.costEstimate,
          tags: o.tags,
          tripType: o.tripType,
          imageUrl: o.imageUrl,
          addedBy: user.email || 'You',
          opportunityStatus: 'draft',
        },
      });
      setToast(`Added “${o.title}” to your plan.`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not add');
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  if (stage === 'approve') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Booking & cost optimization</h2>
          <p className="text-sm text-travel-muted mt-1">
            Same tools as Home — compare flight bundles and run the calculator while approvals are in progress.
          </p>
        </div>
        <ApproveFlightBundles busy={approvePanel.finalizeBusy} onFinalize={approvePanel.onFinalize} />
        <TravelCostCalculator
          key={approvePanel.eligibleFinalizeItem?._id ?? 'calc-ex'}
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
    );
  }

  if (stage === 'travel') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Today & ticket</h2>
          <p className="text-sm text-travel-muted mt-1">Mirror of Home — your day-of agenda and ticket (demo).</p>
        </div>
        <TravelDayItinerary items={panelItems} compact />
      </div>
    );
  }

  if (stage === 'return') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Memory + content builder</h2>
        <p className="text-sm text-travel-muted">
          Upload trip photos in the full profile editor or paste context into the AI Assistant for captions and post ideas.
        </p>
        <ul className="text-sm text-white/80 space-y-2 list-disc pl-4">
          <li>Instagram-ready captions</li>
          <li>LinkedIn post variants</li>
          <li>Export as plain text</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Opportunity explorer</h2>
        <p className="text-sm text-travel-muted mt-1">Curated ideas. Filters apply on-device.</p>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-travel-muted flex flex-wrap items-center gap-1">
          <PolicyHint title="Policy filters would connect to your official travel policy in production.">
            Estimates only — confirm with policy before booking.
          </PolicyHint>
        </p>
        <label className="text-xs text-travel-muted">
          Location contains
          <input
            value={locationQ}
            onChange={(e) => setLocationQ(e.target.value)}
            className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="e.g. Chicago"
          />
        </label>
        <label className="text-xs text-travel-muted">
          Max budget (USD)
          <input
            type="number"
            min={200}
            step={50}
            value={maxBudget}
            onChange={(e) => setMaxBudget(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>
      {toast ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{toast}</div>
      ) : null}
      <div className="space-y-4 pb-4">
        {filtered.map((o) => (
          <OpportunityCard
            key={o.id}
            title={o.title}
            subtitle={`${o.location} · ~$${o.costEstimate.toLocaleString()}`}
            imageUrl={o.imageUrl}
            footer={
              <div className="flex flex-wrap gap-1.5">
                {o.tags.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-travel-muted">
                    {t}
                  </span>
                ))}
              </div>
            }
            action={
              <button
                type="button"
                disabled={busyId === o.id}
                onClick={() => addToPlan(o.id)}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {busyId === o.id ? 'Adding…' : 'Add to plan'}
              </button>
            }
          />
        ))}
      </div>
    </div>
  );
}
