'use client';

import type { TravelPricingPreviewResponse } from '@/lib/api';
import type { TravelPricingSnapshot, TravelPricingSnapshotEvent } from '@/lib/travelTypes';

const STORAGE_KEY = 'travelLastPricingPreview';

export type StoredPricingSession = {
  originIata: string;
  preview: TravelPricingPreviewResponse;
  storedAt: string;
};

function firstFlightLine(o?: { carrierSummary?: string; grandTotal?: string; currency?: string; departureAt?: string }) {
  if (!o) return undefined;
  const parts = [o.carrierSummary, o.currency && o.grandTotal ? `${o.currency} ${o.grandTotal}` : o.grandTotal, o.departureAt].filter(
    Boolean
  );
  return parts.length ? parts.join(' · ') : undefined;
}

function firstHotelLine(o?: { hotelName?: string; total?: string; currency?: string }) {
  if (!o) return undefined;
  const parts = [o.hotelName, o.currency && o.total ? `${o.currency} ${o.total}` : o.total].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Shrink API response into JSON-safe metadata stored on the trip item. */
export function buildTravelPricingSnapshot(
  preview: TravelPricingPreviewResponse,
  originIata: string
): TravelPricingSnapshot {
  const events: TravelPricingSnapshotEvent[] = preview.events.map((ev) => ({
    tripTitle: ev.title,
    destinationQuery: ev.destinationQuery,
    resolvedIata: ev.resolvedDestination?.iata ?? null,
    resolvedLabel: ev.resolvedDestination?.label ?? null,
    googleFlightsSearch: ev.deepLinks.googleFlightsSearch ?? null,
    googleHotelsSearch: ev.deepLinks.googleHotelsSearch ?? null,
    topFlightLine: firstFlightLine(ev.flight.offers[0]),
    topHotelLine: firstHotelLine(ev.hotel.offers[0]),
    flightApiNote: ev.flight.error || ev.flight.reason || null,
    hotelApiNote: ev.hotel.error || ev.hotel.reason || null,
  }));
  return {
    savedAt: new Date().toISOString(),
    originIata: originIata.toUpperCase(),
    mode: preview.mode,
    scrapeEnabled: preview.scrapeEnabled,
    events,
  };
}

export function saveLastPricingSession(originIata: string, preview: TravelPricingPreviewResponse): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredPricingSession = {
      originIata: originIata.trim().toUpperCase(),
      preview,
      storedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function loadLastPricingSession(): StoredPricingSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as StoredPricingSession;
    if (!o?.preview?.events || !Array.isArray(o.preview.events)) return null;
    if (typeof o.originIata !== 'string') return null;
    return o;
  } catch {
    return null;
  }
}

export function clearLastPricingSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
