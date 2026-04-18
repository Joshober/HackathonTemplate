'use client';

import { Suspense } from 'react';
import PlanRoomInner from '../plan/PlanRoomInner';

export default function AssistantPage() {
  return (
    <div className="h-full">
      <Suspense fallback={<div className="py-24 text-center text-sm text-travel-muted">Loading TripReady Copilot Hub…</div>}>
        <PlanRoomInner />
      </Suspense>
    </div>
  );
}
