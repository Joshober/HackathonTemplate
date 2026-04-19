'use client';

import { useRouter } from 'next/navigation';
import type { ParsedTripDocument, Item } from '@/lib/api';
import { getTravelPayload } from '@/lib/travelItem';
import { Plane, Clock, ArrowRight } from 'lucide-react';

interface Props {
  parsedDoc: ParsedTripDocument | null;
  travelItems: Item[];
}

function getNextFlight(parsedDoc: ParsedTripDocument | null) {
  if (!parsedDoc?.flights?.length) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the next upcoming flight
  const upcoming = parsedDoc.flights
    .filter((f) => {
      if (!f.date) return true; // include if no date (can't filter)
      const d = new Date(f.date);
      return d >= today;
    })
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  return upcoming[0] ?? parsedDoc.flights[0];
}

function getActiveTrip(travelItems: Item[]) {
  return travelItems.find((i) => {
    const t = getTravelPayload(i);
    return t?.opportunityStatus === 'booked' || t?.opportunityStatus === 'approved';
  }) ?? travelItems[0] ?? null;
}

export default function TravelProactiveBanner({ parsedDoc, travelItems }: Props) {
  const router = useRouter();
  const nextFlight = getNextFlight(parsedDoc);
  const activeTrip = getActiveTrip(travelItems);
  const activeTravel = activeTrip ? getTravelPayload(activeTrip) : null;

  // Build the "what's next" message
  const whatNext = (() => {
    if (nextFlight) {
      const parts: string[] = [];
      if (nextFlight.from && nextFlight.to) {
        parts.push(`${nextFlight.from} → ${nextFlight.to}`);
      }
      if (nextFlight.departureTime) parts.push(`departs ${nextFlight.departureTime}`);
      if (nextFlight.flightNumber) parts.push(`(${nextFlight.flightNumber})`);
      if (nextFlight.airline) parts.push(`on ${nextFlight.airline}`);
      return parts.join(' ');
    }
    if (activeTravel?.location) {
      return `Traveling to ${activeTravel.location}`;
    }
    return null;
  })();

  if (!whatNext) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Next up</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{whatNext}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {nextFlight?.date
                ? new Date(nextFlight.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Check your itinerary for departure details'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/assistant')}
          className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium shrink-0"
        >
          Ask Copilot <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
