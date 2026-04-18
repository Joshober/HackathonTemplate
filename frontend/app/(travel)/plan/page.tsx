import { Suspense } from 'react';
import PlanRoomInner from './PlanRoomInner';

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-gray-400">Loading planning room…</div>}>
      <PlanRoomInner />
    </Suspense>
  );
}
