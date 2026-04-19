'use client';

import { Suspense } from 'react';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import TravelHomeBody from '@/components/travel/home/TravelHomeBody';
import TeamSelectorDropdown from '@/components/travel/TeamSelectorDropdown';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between mt-2">
        <TeamSelectorDropdown />
      </div>
      <Suspense fallback={<div className="py-12 text-center text-sm text-travel-muted">Loading Home…</div>}>
        <TravelHomeBody user={user} />
      </Suspense>
    </div>
  );
}
