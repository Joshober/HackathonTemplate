'use client';

import { PlanHome } from '@/components/stages/plan/PlanHome';
import { useTravelAuth } from '@/components/travel/useTravelAuth';

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
    <div className="h-full">
      <PlanHome />
    </div>
  );
}
