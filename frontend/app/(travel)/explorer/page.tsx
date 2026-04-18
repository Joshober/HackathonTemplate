'use client';

import { useMemo, useState } from 'react';
import { TRAVEL_OPPORTUNITY_SEED } from '@/lib/travelSeed';
import { useTravelStage } from '@/lib/travelContext';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import OpportunityCard from '@/components/travel/OpportunityCard';
import { api } from '@/lib/api';
import PolicyHint from '@/components/travel/PolicyHint';

export default function ExplorerPage() {
  const { stage } = useTravelStage();
  const { user, loading } = useTravelAuth();
  const [locationQ, setLocationQ] = useState('');
  const [maxBudget, setMaxBudget] = useState(5000);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Booking & cost optimization</h2>
          <p className="text-sm text-travel-muted mt-1">
            Assistant-style recommendations (not live fares). Compare bundles before you finalize.
          </p>
        </div>
        {['Economy mix', 'Flexible fare'].map((label, i) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-white">{label}</span>
              <span className="text-xs text-emerald-300/90">{i === 0 ? 'Lowest total' : 'Fewer changes'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-travel-muted">
              <div className="rounded-lg bg-black/20 p-2">Flight · $420–$510</div>
              <div className="rounded-lg bg-black/20 p-2">Hotel · $180/night</div>
            </div>
            <p className="text-sm text-white/80">Total est. ${(1180 + i * 140).toLocaleString()} · within typical policy band</p>
          </div>
        ))}
        <button
          type="button"
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
          onClick={() => setToast('Demo: booking handoff would open your TMC or OBT here.')}
        >
          Finalize booking
        </button>
        {toast ? <p className="text-xs text-center text-travel-muted">{toast}</p> : null}
      </div>
    );
  }

  if (stage === 'travel') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Availability overlay</h2>
        <p className="text-sm text-travel-muted">
          Flight pricing overlays and smart suggestions are mocked. Use Home to vote on options.
        </p>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider text-travel-muted border-b border-white/10">
            {['Mon', 'Tue', 'Wed'].map((d) => (
              <div key={d} className="p-2 text-center border-r border-white/5 last:border-0">
                {d}
              </div>
            ))}
          </div>
          <div className="p-4 text-sm text-white/85 space-y-2">
            <p>Best time for all: <strong>Tue 13:00–17:00</strong></p>
            <p>Cheapest overlap: <strong>Wed morning</strong></p>
          </div>
        </div>
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

  /* Plan — explorer feed */
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
