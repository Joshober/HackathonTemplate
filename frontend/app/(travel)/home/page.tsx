'use client';

import { useTravelAuth } from '@/components/travel/useTravelAuth';
import TravelHomeBody from '@/components/travel/home/TravelHomeBody';

export default function TravelHomePage() {
  const { user, loading } = useTravelAuth();

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-24 text-travel-muted text-sm">
        Signing you in…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-travel-muted">
        What&apos;s next: use the stage bar above to move through Plan → Approve → Travel → Return.
      </p>
      <TravelHomeBody user={user} />
    </div>
  );
}
