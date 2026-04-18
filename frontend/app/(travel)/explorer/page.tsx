'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTravelStage } from '@/lib/travelContext';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import OpportunityCard from '@/components/travel/OpportunityCard';
import { api, type ExplorerOpportunity, type Item } from '@/lib/api';
import PolicyHint from '@/components/travel/PolicyHint';
import ApproveFlightBundles from '@/components/travel/approve/ApproveFlightBundles';
import TravelCostCalculator from '@/components/travel/approve/TravelCostCalculator';
import { useApproveBookingPanel } from '@/components/travel/approve/useApproveBookingPanel';
import TravelDayItinerary from '@/components/travel/TravelDayItinerary';
import ApprovedEventsLivePricing from '@/components/travel/approve/ApprovedEventsLivePricing';

const MAX_CITIES = 5;

function parseCitiesInput(raw: string): string[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, MAX_CITIES);
}

function truncateSnippet(text: string, max = 140): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function ExplorerPage() {
  const { stage } = useTravelStage();
  const { user, loading } = useTravelAuth();
  const [citiesInput, setCitiesInput] = useState('');
  const [maxBudget, setMaxBudget] = useState(5000);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [panelItems, setPanelItems] = useState<Item[]>([]);
  const [opportunities, setOpportunities] = useState<ExplorerOpportunity[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchedLabel, setSearchedLabel] = useState<string | null>(null);

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

  const runSearch = async () => {
    const cities = parseCitiesInput(citiesInput);
    setSearchError(null);
    setToast(null);
    if (!cities.length) {
      setSearchError('Enter at least one city (comma-separated for multiple).');
      setOpportunities([]);
      setSearchedLabel(null);
      return;
    }
    setSearchLoading(true);
    setSearchedLabel(cities.join(', '));
    try {
      const { opportunities: rows } = await api.searchExplorerOpportunities({ cities, maxPerCity: 8 });
      setOpportunities(rows);
      if (!rows.length) {
        setSearchError('No web results for those cities. Try different names or fewer cities.');
      }
    } catch (e) {
      setOpportunities([]);
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const addToPlan = async (o: ExplorerOpportunity) => {
    if (!user?.email) return;
    setBusyId(o.id);
    setToast(null);
    const descLines = [
      `${o.title} — web result for ${o.city}.`,
      o.snippet ? o.snippet : null,
      o.url ? `Source: ${o.url}` : null,
    ].filter(Boolean) as string[];
    try {
      await api.createItem({
        title: o.title.slice(0, 200),
        description: descLines.join('\n\n'),
        travel: {
          location: o.city,
          costEstimate: maxBudget,
          tags: ['web', 'duckduckgo', o.city],
          tripType: 'research',
          sourceUrl: o.url,
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
          <h2 className="text-lg font-semibold text-gray-900">Booking & cost optimization</h2>
          <p className="text-sm text-travel-muted mt-1">
            Same tools as Home — compare flight bundles and run the calculator while approvals are in progress.
          </p>
        </div>
        <ApprovedEventsLivePricing items={panelItems} />
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
          <p className="text-xs text-center text-travel-muted border border-gray-200 bg-gray-50 rounded-lg py-2 px-3">
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
          <h2 className="text-lg font-semibold text-gray-900">Today & trip record</h2>
          <p className="text-sm text-travel-muted mt-1">Same trip record as Home — checklist and links from your saved pricing.</p>
        </div>
        <TravelDayItinerary items={panelItems} compact />
      </div>
    );
  }

  if (stage === 'return') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Memory + content builder</h2>
        <p className="text-sm text-travel-muted">
          Upload trip photos in the full profile editor or paste context into the AI Assistant for captions and post ideas.
        </p>
        <ul className="text-sm text-gray-700 space-y-2 list-disc pl-4">
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
        <h2 className="text-lg font-semibold text-gray-900">Opportunity explorer</h2>
        <p className="text-sm text-travel-muted mt-1">
          Live DuckDuckGo results for business events and conferences. Up to {MAX_CITIES} cities per search.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-travel-muted flex flex-wrap items-center gap-1">
          <PolicyHint title="Policy filters would connect to your official travel policy in production.">
            Web results are unvetted — confirm with policy before booking.
          </PolicyHint>
        </p>
        <label className="text-xs text-travel-muted">
          Cities (comma-separated)
          <input
            value={citiesInput}
            onChange={(e) => setCitiesInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch();
            }}
            className="mt-1 w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400"
            placeholder="e.g. Chicago, Austin, Seattle"
            disabled={searchLoading}
          />
        </label>
        <label className="text-xs text-travel-muted">
          Planning budget when adding (USD)
          <input
            type="number"
            min={200}
            step={50}
            value={maxBudget}
            onChange={(e) => setMaxBudget(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={searchLoading}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold"
        >
          {searchLoading ? 'Searching…' : 'Search'}
        </button>
      </div>
      {searchedLabel && !searchLoading ? (
        <p className="text-xs text-travel-muted">Last search: {searchedLabel}</p>
      ) : null}
      {searchError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{searchError}</div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{toast}</div>
      ) : null}
      <div className="space-y-4 pb-4">
        {!searchLoading && !opportunities.length && !searchError ? (
          <p className="text-sm text-travel-muted">Enter one or more cities and press Search.</p>
        ) : null}
        {opportunities.map((o) => (
          <OpportunityCard
            key={o.id}
            title={o.title}
            subtitle={`${o.city} · ${truncateSnippet(o.snippet)}`}
            footer={
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {['web', 'duckduckgo'].map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {t}
                    </span>
                  ))}
                </div>
                {o.url ? (
                  <a
                    href={o.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-block font-medium"
                  >
                    Open link
                  </a>
                ) : null}
              </div>
            }
            action={
              <button
                type="button"
                disabled={busyId === o.id}
                onClick={() => void addToPlan(o)}
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
