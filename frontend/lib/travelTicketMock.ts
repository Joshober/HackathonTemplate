import type { TravelItemPayload, TravelTicket, TravelBookingEstimate } from '@/lib/travelTypes';

/** Demo-only ticket derived from trip title/location (no GDS). */
export function buildMockTicket(location: string, title: string): TravelTicket {
  const city = location.split(',')[0]?.trim() || 'Destination';
  const code = city.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X').padEnd(3, 'X').slice(0, 3);
  const d = new Date();
  const departDate = d.toISOString().slice(0, 10);
  const departTime = '07:15';
  return {
    recordLocator: `LOC${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    airline: 'Lockton Air (demo)',
    flightNumber: `LK${100 + (location.length % 800)}`,
    origin: 'ORD',
    destination: code,
    departDate,
    departTime,
    seat: `${12 + (title.length % 8)}${String.fromCharCode(65 + (title.length % 5))}`,
    gate: `B${1 + (location.length % 20)}`,
    terminal: '2',
    tripTitle: title,
    cityLabel: location,
  };
}

export function buildDefaultBookingEstimate(baseTripCost: number): TravelBookingEstimate {
  const flightLow = Math.round(baseTripCost * 0.35);
  const flightHigh = Math.round(baseTripCost * 0.48);
  const hotelPerNight = 189;
  const nights = 2;
  const hotelTotal = hotelPerNight * nights;
  const totalLow = flightLow + hotelTotal;
  const totalHigh = flightHigh + hotelTotal;
  return {
    flightLow,
    flightHigh,
    hotelPerNight,
    nights,
    totalLow,
    totalHigh,
  };
}

export function mergeBookedTravel(
  existing: TravelItemPayload,
  options?: { bundleIndex?: number; tripTitle?: string }
): TravelItemPayload {
  const bundleIndex = options?.bundleIndex ?? 0;
  const est = existing.bookingEstimate ?? buildDefaultBookingEstimate(existing.costEstimate || 1200);
  const midpoint = Math.round((est.flightLow + est.flightHigh) / 2) + est.hotelPerNight * est.nights;
  const title = options?.tripTitle?.trim() || existing.tripType || 'Trip';
  const ticket = buildMockTicket(existing.location, title);

  return {
    ...existing,
    opportunityStatus: 'booked',
    bookingEstimate: {
      ...est,
      selectedBundle: bundleIndex === 0 ? 'Economy mix' : 'Flexible fare',
      totalLow: est.totalLow,
      totalHigh: est.totalHigh,
      lastCalculatedTotal: midpoint,
    },
    ticket,
  };
}
