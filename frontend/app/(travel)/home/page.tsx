'use client';

import { useTravelAuth } from '@/components/travel/useTravelAuth';
import TravelHomeBody from '@/components/travel/home/TravelHomeBody';
import { useTravelStage } from '@/lib/travelContext';

export default function TravelHomePage() {
  const { user, loading } = useTravelAuth();
  const { stage, setStage } = useTravelStage();

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-24 text-travel-muted text-sm">
        Signing you in…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 shadow-sm">
        <p className="text-xs text-travel-muted min-w-0">
          What&apos;s next: use the stage bar above to move through Plan → Approve → Travel → Return.
        </p>
        {stage !== 'approve' ? (
          <button
            type="button"
            onClick={() => setStage('approve')}
            className="shrink-0 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-4 py-2.5 text-center transition-colors"
          >
            Approve a trip
          </button>
        ) : null}
      </div>
      <TravelHomeBody user={user} />
    </div>
  );
}
