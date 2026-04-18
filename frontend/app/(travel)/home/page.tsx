'use client';

import { useTravelAuth } from '@/components/travel/useTravelAuth';
import TravelHomeBody from '@/components/travel/home/TravelHomeBody';
import { useTravelStage } from '@/lib/travelContext';
import TeamSelectorDropdown from '@/components/travel/TeamSelectorDropdown';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between mt-2">
        <TeamSelectorDropdown />
      </div>
      <TravelHomeBody user={user} />
    </div>
  );
}
