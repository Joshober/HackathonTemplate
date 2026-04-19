'use client';

import Link from 'next/link';
import type { Item } from '@/lib/api';
import TravelDayItinerary from '@/components/travel/TravelDayItinerary';
import { isTravelItem } from '@/lib/travelItem';

export default function ExploreTripRecordTab({ panelItems }: { panelItems: Item[] }) {
  const travel = panelItems.filter(isTravelItem);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Trip record</h2>
        <p className="text-sm text-travel-muted mt-1">
          Day-of checklist and saved booking cues from your items — aligned with Home when you are on the move.
        </p>
      </div>
      {travel.length === 0 ? (
        <p className="text-sm text-travel-muted rounded-2xl border border-gray-200 bg-white p-4">
          No saved trips yet. Add ideas from Events or send cards from Plan on Home.
        </p>
      ) : (
        <TravelDayItinerary items={panelItems} compact />
      )}
      <Link href="/home" className="text-xs font-semibold text-blue-600 hover:underline">
        Open full Home trip record
      </Link>
    </div>
  );
}
