import type { TravelBookingEstimate } from '@/lib/travelTypes';

/** Default calculator bands when the user has not saved an estimate yet. */
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
