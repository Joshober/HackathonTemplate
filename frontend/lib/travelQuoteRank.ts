import type {
  TravelPricingBundleOption,
  TravelPricingEventResult,
  TravelPricingFlightOfferSummary,
  TravelPricingHotelOfferRow,
  TravelPricingMatrixFlightOption,
  TravelPricingMatrixHotelOption,
} from '@/lib/api';

export type QuoteRankMode = 'lowest_cost' | 'longest_leg' | 'closest_hotel';

const MAX_OFFERS_STORE = 18;
const MAX_SCRAPED_STORE = 12;

function parseMoney(n: unknown): number | null {
  if (n == null) return null;
  const v = typeof n === 'number' ? n : parseFloat(String(n).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(v) ? v : null;
}

function flightLegDurationMs(
  o: TravelPricingMatrixFlightOption | TravelPricingFlightOfferSummary,
): number {
  const dep = (o as TravelPricingMatrixFlightOption).outboundDepartureAt || o.departureAt;
  const arr = (o as TravelPricingMatrixFlightOption).outboundArrivalAt || o.arrivalAt;
  if (!dep || !arr) return 0;
  const a = Date.parse(dep);
  const b = Date.parse(arr);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, b - a);
}

function flightByOptionId(
  ev: TravelPricingEventResult,
  id: string | undefined,
): TravelPricingMatrixFlightOption | TravelPricingFlightOfferSummary | undefined {
  if (!id) return undefined;
  const matrix = ev.flightOptions || [];
  const hit = matrix.find((x) => x.optionId === id);
  if (hit) return hit;
  return ev.flight?.offers?.find((_, i) => `${i}` === id || `flight-${i + 1}` === id);
}

function hotelByOptionId(
  ev: TravelPricingEventResult,
  id: string | undefined,
): TravelPricingMatrixHotelOption | TravelPricingHotelOfferRow | undefined {
  if (!id) return undefined;
  const matrix = ev.hotelOptions || [];
  const hit = matrix.find((x) => x.optionId === id);
  if (hit) return hit;
  return ev.hotel?.offers?.find((_, i) => `hotel-${i + 1}` === id);
}

function hotelStayNights(h: TravelPricingHotelOfferRow): number {
  const a = h.checkIn?.trim().slice(0, 10);
  const b = h.checkOut?.trim().slice(0, 10);
  if (!a || !b) return 0;
  const d = (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000;
  return Number.isFinite(d) ? Math.max(0, Math.round(d)) : 0;
}

/** Sort key for bundle under rank mode (higher = better for longest; lower = better for cost/closest). */
export function bundleRankScore(ev: TravelPricingEventResult, b: TravelPricingBundleOption, mode: QuoteRankMode): number {
  if (mode === 'lowest_cost') {
    const t = b.totalEstimated ?? parseMoney(b.flightTotal ?? null) ?? parseMoney(b.hotelTotal ?? null);
    return t != null && Number.isFinite(t) ? -t : -1e15;
  }
  if (mode === 'longest_leg') {
    const fo = flightByOptionId(ev, b.flightOptionId);
    return fo ? flightLegDurationMs(fo) : 0;
  }
  const ho = hotelByOptionId(ev, b.hotelOptionId);
  const dm = ho && ho.distanceMinutes != null ? Number(ho.distanceMinutes) : 1e9;
  return -dm;
}

export function topBundlesForRank(
  ev: TravelPricingEventResult,
  mode: QuoteRankMode,
  take = 3,
): TravelPricingBundleOption[] {
  const raw = ev.bundleOptions || [];
  if (!raw.length) return [];
  const scored = raw.map((b) => ({ b, s: bundleRankScore(ev, b, mode) }));
  if (mode === 'lowest_cost') {
    scored.sort((a, b) => b.s - a.s);
  } else if (mode === 'longest_leg') {
    scored.sort((a, b) => b.s - a.s);
  } else {
    scored.sort((a, b) => b.s - a.s);
  }
  return scored.slice(0, take).map((x) => x.b);
}

export function topFlightsForRank(
  ev: TravelPricingEventResult,
  mode: QuoteRankMode,
  take = 3,
): (TravelPricingMatrixFlightOption | TravelPricingFlightOfferSummary)[] {
  const list: (TravelPricingMatrixFlightOption | TravelPricingFlightOfferSummary)[] =
    ev.flightOptions?.length ? [...ev.flightOptions] : [...(ev.flight?.offers || [])];
  if (!list.length) return [];
  if (mode === 'lowest_cost') {
    list.sort((a, b) => (parseMoney(a.grandTotal) ?? 1e12) - (parseMoney(b.grandTotal) ?? 1e12));
  } else if (mode === 'longest_leg') {
    list.sort((a, b) => flightLegDurationMs(b) - flightLegDurationMs(a));
  } else {
    list.sort((a, b) => (parseMoney(a.grandTotal) ?? 0) - (parseMoney(b.grandTotal) ?? 0));
  }
  return list.slice(0, take);
}

export function topHotelsForRank(
  ev: TravelPricingEventResult,
  mode: QuoteRankMode,
  take = 3,
): (TravelPricingMatrixHotelOption | TravelPricingHotelOfferRow)[] {
  const list: (TravelPricingMatrixHotelOption | TravelPricingHotelOfferRow)[] =
    ev.hotelOptions?.length ? [...ev.hotelOptions] : [...(ev.hotel?.offers || [])];
  if (!list.length) return [];
  if (mode === 'closest_hotel') {
    list.sort((a, b) => {
      const da = a.distanceMinutes != null ? Number(a.distanceMinutes) : 1e9;
      const db = b.distanceMinutes != null ? Number(b.distanceMinutes) : 1e9;
      return da - db;
    });
  } else if (mode === 'lowest_cost') {
    list.sort((a, b) => (parseMoney(a.total) ?? 1e12) - (parseMoney(b.total) ?? 1e12));
  } else {
    list.sort((a, b) => hotelStayNights(b) - hotelStayNights(a));
  }
  return list.slice(0, take);
}

/** Shrink arrays for MongoDB `travel` JSON (still useful for full UI when reloaded). */
export function trimPricingEventForStorage(ev: TravelPricingEventResult): TravelPricingEventResult {
  const o = JSON.parse(JSON.stringify(ev)) as TravelPricingEventResult;
  if (o.flight?.offers?.length) o.flight.offers = o.flight.offers.slice(0, MAX_OFFERS_STORE);
  if (o.hotel?.offers?.length) o.hotel.offers = o.hotel.offers.slice(0, MAX_OFFERS_STORE);
  if (o.flightOptions?.length) o.flightOptions = o.flightOptions.slice(0, MAX_OFFERS_STORE);
  if (o.hotelOptions?.length) o.hotelOptions = o.hotelOptions.slice(0, MAX_OFFERS_STORE);
  if (o.bundleOptions?.length) o.bundleOptions = o.bundleOptions.slice(0, 40);
  if (o.scrapedOptions?.length) o.scrapedOptions = o.scrapedOptions.slice(0, MAX_SCRAPED_STORE);
  return o;
}
