'use client';

import { useMemo, useState } from 'react';
import type { TravelBookingEstimate } from '@/lib/travelTypes';

type Props = {
  /** Seed fields from trip cost or last saved estimate */
  initialFlightLow?: number;
  initialFlightHigh?: number;
  initialHotelPerNight?: number;
  initialNights?: number;
  onApply?: (estimate: TravelBookingEstimate) => void | Promise<void>;
  applyLabel?: string;
  busy?: boolean;
};

export default function TravelCostCalculator({
  initialFlightLow = 420,
  initialFlightHigh = 510,
  initialHotelPerNight = 180,
  initialNights = 2,
  onApply,
  applyLabel = 'Save estimate to trip',
  busy,
}: Props) {
  const [flightLow, setFlightLow] = useState(initialFlightLow);
  const [flightHigh, setFlightHigh] = useState(initialFlightHigh);
  const [hotelPerNight, setHotelPerNight] = useState(initialHotelPerNight);
  const [nights, setNights] = useState(initialNights);

  const derived = useMemo(() => {
    const hotelTotal = hotelPerNight * nights;
    const totalLow = flightLow + hotelTotal;
    const totalHigh = flightHigh + hotelTotal;
    const lastCalculatedTotal = Math.round((flightLow + flightHigh) / 2 + hotelTotal);
    const estimate: TravelBookingEstimate = {
      flightLow,
      flightHigh,
      hotelPerNight,
      nights,
      totalLow,
      totalHigh,
      lastCalculatedTotal,
    };
    return estimate;
  }, [flightLow, flightHigh, hotelPerNight, nights]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">Travel cost calculator</h3>
        <p className="text-xs text-travel-muted mt-1">Adjust inputs — totals update on-device.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="text-travel-muted col-span-1">
          Flight low ($)
          <input
            type="number"
            min={0}
            value={flightLow}
            onChange={(e) => setFlightLow(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="text-travel-muted col-span-1">
          Flight high ($)
          <input
            type="number"
            min={0}
            value={flightHigh}
            onChange={(e) => setFlightHigh(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="text-travel-muted col-span-1">
          Hotel / night ($)
          <input
            type="number"
            min={0}
            value={hotelPerNight}
            onChange={(e) => setHotelPerNight(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="text-travel-muted col-span-1">
          Nights
          <input
            type="number"
            min={1}
            value={nights}
            onChange={(e) => setNights(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-2 py-2 text-sm text-white"
          />
        </label>
      </div>
      <div className="rounded-xl bg-black/25 border border-white/10 p-3 text-sm space-y-1">
        <p className="text-white/90">
          Trip total (range):{' '}
          <strong>
            ${derived.totalLow.toLocaleString()} – ${derived.totalHigh.toLocaleString()}
          </strong>
        </p>
        <p className="text-travel-muted text-xs">
          Midpoint: ${derived.lastCalculatedTotal?.toLocaleString() ?? '—'} · compare to policy caps with your
          manager.
        </p>
      </div>
      {onApply ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply(derived)}
          className="w-full py-2.5 rounded-xl border border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/30 text-blue-100 text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : applyLabel}
        </button>
      ) : null}
    </div>
  );
}
