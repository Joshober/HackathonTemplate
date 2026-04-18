import { Suspense } from 'react';
import TravelItineraryInner from './TravelItineraryInner';

export default function TravelPlanPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-gray-400">Loading itinerary…</div>}>
      <TravelItineraryInner />
    </Suspense>
  );
}
