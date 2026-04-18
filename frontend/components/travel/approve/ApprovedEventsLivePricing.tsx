'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Item, type TravelPricingEventResult, type TravelPricingPreviewResponse } from '@/lib/api';
import { saveLastPricingSession } from '@/lib/travelPricingSession';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import { daySpanInclusive } from '@/lib/teamAvailabilityOverlap';
import {
  airportCodeFromCityHints,
  nearestTravelOriginCode,
  TRAVEL_ORIGIN_AIRPORTS,
} from '@/lib/travelOriginAirports';

const ORIGIN_KEY = 'travel_explorer_origin_iata';

const CUSTOM_ORIGIN_VALUE = '__custom__';

function defaultIsoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

type DateRow = { outbound: string; inbound: string };

type DateRange = { start: string; end: string };

function scenarioKey(p: { start: string; end: string }): string {
  return `${p.start}|${p.end}`;
}

function parseMoneyAmount(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Inclusive event / trip dates from saved payload (YYYY-MM-DD). */
function eventDateRangeFromPayload(t: ReturnType<typeof getTravelPayload>): DateRange | null {
  if (!t) return null;
  const rawS = typeof t.startDate === 'string' ? t.startDate.trim().slice(0, 10) : '';
  const rawE = typeof t.endDate === 'string' ? t.endDate.trim().slice(0, 10) : '';
  if (!rawS && !rawE) return null;
  if (rawS && rawE) {
    if (rawS <= rawE) return { start: rawS, end: rawE };
    return { start: rawE, end: rawS };
  }
  const d = rawS || rawE;
  return { start: d, end: d };
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && a.end >= b.start;
}

/** Calendar midpoint of an inclusive stay (YYYY-MM-DD); used when the card has no event dates. */
function middleDayOfStay(stay: DateRange): DateRange {
  const s = stay.start.trim().slice(0, 10);
  const e = stay.end.trim().slice(0, 10);
  const a = Date.parse(`${s}T12:00:00Z`);
  const b = Date.parse(`${e}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { start: s, end: s };
  }
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const midTime = lo + Math.floor((hi - lo) / 2);
  const midStr = new Date(midTime).toISOString().slice(0, 10);
  return { start: midStr, end: midStr };
}

function attendanceLabel(
  stay: DateRange,
  eventRange: DateRange | null,
): { label: string; ok: boolean | null } {
  if (!eventRange) return { label: 'Add event dates on the trip to check.', ok: null };
  const ok = rangesOverlap(eventRange, stay);
  return ok
    ? { label: 'In town for this event', ok: true }
    : { label: 'Trip dates miss the event', ok: false };
}

function cheapestFlightLine(ev: TravelPricingEventResult | undefined): string {
  if (!ev?.flight?.offers?.length) return '—';
  let bestN: number | null = null;
  let bestC = 'USD';
  for (const o of ev.flight.offers) {
    const n = parseMoneyAmount(o.grandTotal);
    if (n == null) continue;
    if (bestN == null || n < bestN) {
      bestN = n;
      bestC = o.currency?.trim() || bestC;
    }
  }
  if (bestN == null) return '—';
  return `${bestC} ${Math.round(bestN)}`;
}

function cheapestHotelLine(ev: TravelPricingEventResult | undefined): string {
  if (!ev?.hotel?.offers?.length) return '—';
  let bestN: number | null = null;
  let bestC = 'USD';
  for (const o of ev.hotel.offers) {
    const n = parseMoneyAmount(o.total);
    if (n == null) continue;
    if (bestN == null || n < bestN) {
      bestN = n;
      bestC = o.currency?.trim() || bestC;
    }
  }
  if (bestN == null) return '—';
  return `${bestC} ${Math.round(bestN)}`;
}

function truncateTitle(s: string, max = 22): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function bookableLabel(v: boolean | null | undefined) {
  if (v === true) return <span className="text-emerald-700 font-medium">Likely bookable (verify)</span>;
  if (v === false) return <span className="text-amber-800 font-medium">Not bookable via API</span>;
  return <span className="text-travel-muted">Unknown</span>;
}

function hotelScrapedRows(ev: TravelPricingEventResult) {
  return (ev.scrapedOptions || []).filter((s) => {
    const k = (s.kind || '').toLowerCase();
    const q = (s.sourceQuery || '').toLowerCase();
    return k === 'hotel' || q.includes('hotel');
  });
}

function PricingEventDetails({ ev }: { ev: TravelPricingEventResult }) {
  return (
    <div className="space-y-3 text-xs border-t border-gray-100 pt-3">
      {ev.resolvedDestination?.iata ? (
        <p className="text-travel-muted">
          Resolved destination: <span className="text-gray-900 font-mono font-medium">{ev.resolvedDestination.iata}</span>
          {ev.resolvedDestination.label ? ` · ${ev.resolvedDestination.label}` : null}
        </p>
      ) : null}
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-2 space-y-1">
        <p className="text-gray-900 font-medium">Flights</p>
        {ev.flight.error ? <p className="text-amber-800">{ev.flight.error}</p> : null}
        <p className="text-travel-muted">
          {bookableLabel(ev.flight.bookable)} — {ev.flight.reason}
        </p>
        <ul className="space-y-1 list-disc pl-4 text-travel-muted">
          {ev.flight.offers.slice(0, 5).map((o, i) => (
            <li key={i}>
              {o.carrierSummary || '—'} · {o.currency} {o.grandTotal}
              {o.departureAt ? ` · dep ${o.departureAt}` : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-2 space-y-1">
        <p className="text-gray-900 font-medium">Hotels</p>
        {ev.hotel.error ? <p className="text-amber-800">{ev.hotel.error}</p> : null}
        <p className="text-travel-muted">
          {ev.hotel.offers?.length
            ? (
                <>
                  {bookableLabel(ev.hotel.bookable)} — {ev.hotel.reason}
                </>
              )
            : ev.deepLinks.googleHotelsSearch
              ? (
                  <>
                    <span className="text-violet-900 font-medium">Deep link + web search</span>
                    {' — '}
                    {ev.hotel.reason ||
                      'No Amadeus hotel rates — open Google Hotels, enable SerpAPI Google Hotels, or use scraped links.'}
                  </>
                )
              : (
                  <>
                    {bookableLabel(ev.hotel.bookable)} — {ev.hotel.reason}
                  </>
                )}
        </p>
        {ev.hotel.distanceSummary ? (
          <p className="text-[11px] text-gray-800 bg-violet-50/80 border border-violet-100 rounded-md px-2 py-1.5">
            {ev.hotel.distanceSummary}
          </p>
        ) : ev.hotel.averageDistanceMinutes != null ? (
          <p className="text-[11px] text-travel-muted">
            Avg transit hint ~{ev.hotel.averageDistanceMinutes} min across listings (area, not exact venue).
          </p>
        ) : null}
        {ev.hotel.offers?.length ? (
          <ul className="space-y-2 list-disc pl-4 text-travel-muted">
            {ev.hotel.offers.slice(0, 8).map((o, i) => (
              <li key={i} className="leading-snug">
                <span className="text-gray-900">
                  {o.hotelName || o.hotelId || 'Hotel'} · {o.currency} {o.total}
                </span>
                {o.distanceMinutes != null ? (
                  <span className="text-travel-muted"> · ~{o.distanceMinutes} min (area transit)</span>
                ) : null}
                {o.listingUrl ? (
                  <a
                    href={o.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[11px] text-blue-600 hover:underline font-medium mt-0.5"
                  >
                    Open listing
                  </a>
                ) : null}
                {o.distanceHint ? (
                  <span className="block text-[10px] text-travel-muted mt-0.5 line-clamp-2">{o.distanceHint}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-travel-muted pl-1">
            No hotel rate rows yet.{hotelScrapedRows(ev).length ? ' See hotel-specific web results below.' : ''}
          </p>
        )}
        {ev.deepLinks.googleHotelsSearch ? (
          <a
            href={ev.deepLinks.googleHotelsSearch}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex mt-1 text-[11px] px-2 py-1 rounded-lg bg-violet-100 text-violet-900 hover:bg-violet-200 font-medium"
          >
            Open Google Hotels (this stay)
          </a>
        ) : null}
        {hotelScrapedRows(ev).length ? (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            <p className="text-[11px] font-medium text-gray-900">Hotel leads from web scrape</p>
            <ul className="space-y-2">
              {hotelScrapedRows(ev).slice(0, 6).map((s, i) => (
                <li key={i}>
                  <span className="text-[10px] uppercase text-travel-muted">{s.kind}</span>{' '}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline block font-medium"
                  >
                    {s.title || s.pageTitle || s.url}
                  </a>
                  {s.snippet ? <p className="text-travel-muted mt-0.5 line-clamp-2">{s.snippet}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {ev.deepLinks.googleFlightsSearch ? (
          <a
            href={ev.deepLinks.googleFlightsSearch}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] px-2 py-1 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 font-medium"
          >
            Google Flights
          </a>
        ) : null}
        {ev.deepLinks.googleHotelsSearch ? (
          <a
            href={ev.deepLinks.googleHotelsSearch}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] px-2 py-1 rounded-lg bg-violet-100 text-violet-900 hover:bg-violet-200 font-medium"
          >
            Google Hotels
          </a>
        ) : null}
      </div>
      {ev.scrapedOptions?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-2">
          <p className="text-amber-900 font-medium">Web options (scraped / unverified)</p>
          <p className="text-[10px] text-travel-muted">Demo only; may violate site ToS — not for production.</p>
          <ul className="space-y-2">
            {ev.scrapedOptions.map((s, i) => (
              <li key={i}>
                <span className="text-[10px] uppercase text-travel-muted">{s.kind}</span>{' '}
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block font-medium">
                  {s.title || s.pageTitle || s.url}
                </a>
                {s.snippet ? <p className="text-travel-muted mt-0.5 line-clamp-2">{s.snippet}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {ev.scrapeNote ? <p className="text-[10px] text-travel-muted">{ev.scrapeNote}</p> : null}
    </div>
  );
}

function isPipelinePricingStatus(s: string | undefined): boolean {
  return s === 'submitted' || s === 'pending' || s === 'approved' || s === 'needs_changes';
}

function dedupePresets(list: { start: string; end: string }[]): { start: string; end: string }[] {
  const seen = new Set<string>();
  const out: { start: string; end: string }[] = [];
  for (const p of list) {
    if (!p.start || !p.end || p.start > p.end) continue;
    const k = `${p.start}|${p.end}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ start: p.start, end: p.end });
  }
  return out;
}

export default function ApprovedEventsLivePricing({
  items,
  planningWindow,
  overlapPresets,
  originHintCities,
  onFinalizeBooking,
  finalizeBusy,
}: {
  items: Item[];
  planningWindow?: { start: string; end: string } | null;
  /** Common manual overlap intervals from the team planning panel (all scenarios for pricing). */
  overlapPresets?: { start: string; end: string }[];
  /** Team preset cities — used to suggest an origin when the browser can’t use location. */
  originHintCities?: string[];
  /** Optional: mark first in-approval trip booked (uses estimate on file + last pricing session). */
  onFinalizeBooking?: (bundleIndex: number) => void | Promise<void>;
  finalizeBusy?: boolean;
}) {
  const pricedTrips = useMemo(
    () =>
      items.filter((i) => {
        if (!isTravelItem(i)) return false;
        const t = getTravelPayload(i);
        return isPipelinePricingStatus(t?.opportunityStatus);
      }),
    [items],
  );

  const pricingDatePresets = useMemo(() => {
    const fromOverlap = dedupePresets(overlapPresets ?? []);
    if (fromOverlap.length) return fromOverlap;
    if (
      planningWindow?.start &&
      planningWindow?.end &&
      planningWindow.start <= planningWindow.end
    ) {
      return [{ start: planningWindow.start, end: planningWindow.end }];
    }
    return [];
  }, [overlapPresets, planningWindow]);

  const [originIata, setOriginIata] = useState('ORD');
  const [originSuggestionNote, setOriginSuggestionNote] = useState<string | null>(null);
  const [datesById, setDatesById] = useState<Record<string, DateRow>>({});
  const [result, setResult] = useState<TravelPricingPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quotesByScenario, setQuotesByScenario] = useState<Record<string, TravelPricingPreviewResponse>>({});
  const [quotesBatchLoading, setQuotesBatchLoading] = useState(false);
  const [quotesBatchErr, setQuotesBatchErr] = useState<string | null>(null);
  const [quotesBatchDone, setQuotesBatchDone] = useState(0);

  useEffect(() => {
    setDatesById((prev) => {
      const next = { ...prev };
      pricedTrips.forEach((item, idx) => {
        const stableId = item._id || `idx-${idx}`;
        if (next[stableId]) return;
        const t = getTravelPayload(item);
        const out =
          (typeof t?.startDate === 'string' && t.startDate) ||
          planningWindow?.start ||
          defaultIsoDate(14);
        const inn =
          (typeof t?.endDate === 'string' && t.endDate) || planningWindow?.end || defaultIsoDate(16);
        next[stableId] = { outbound: out, inbound: inn };
      });
      return next;
    });
  }, [pricedTrips, planningWindow]);

  const persistOrigin = (u: string) => {
    try {
      sessionStorage.setItem(ORIGIN_KEY, u);
    } catch {
      /* ignore */
    }
  };

  const teamCitiesKey = useMemo(
    () =>
      (originHintCities ?? [])
        .map((c) => c.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .join('|'),
    [originHintCities],
  );

  useEffect(() => {
    let cancelled = false;

    const readSessionCode = (): string | null => {
      try {
        const s = sessionStorage.getItem(ORIGIN_KEY);
        if (s && /^[A-Za-z]{3}$/.test(s)) return s.toUpperCase();
      } catch {
        /* ignore */
      }
      return null;
    };

    const applyFromSession = (code: string) => {
      if (cancelled) return;
      setOriginIata(code);
      setOriginSuggestionNote(null);
    };

    const applyAuto = (code: string, note: string, shouldPersist = true) => {
      if (cancelled) return;
      const u = code.toUpperCase();
      setOriginIata(u);
      if (shouldPersist) persistOrigin(u);
      setOriginSuggestionNote(note || null);
    };

    const sessionCode = readSessionCode();
    if (sessionCode) {
      applyFromSession(sessionCode);
      return () => {
        cancelled = true;
      };
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const code = nearestTravelOriginCode(pos.coords.latitude, pos.coords.longitude);
          applyAuto(code, 'Closest listed airport to your current location.');
        },
        () => {
          const team = airportCodeFromCityHints(originHintCities);
          if (team) {
            applyAuto(team, 'Suggested from a team preset city (location not shared).');
          } else {
            applyAuto('ORD', '', false);
          }
        },
        { enableHighAccuracy: false, timeout: 9000, maximumAge: 300_000 },
      );
    } else {
      const team = airportCodeFromCityHints(originHintCities);
      if (team) {
        applyAuto(team, 'Suggested from a team preset city (browser location unavailable).');
      } else {
        applyAuto('ORD', '', false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [teamCitiesKey, originHintCities]);

  const savedAirportOption = useMemo(() => {
    const u = originIata.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(u)) return null;
    if (TRAVEL_ORIGIN_AIRPORTS.some((o) => o.code === u)) return null;
    return { code: u, label: `${u} — saved` };
  }, [originIata]);

  const originSelectValue = useMemo(() => {
    const u = originIata.trim().toUpperCase();
    if (
      /^[A-Z]{3}$/.test(u) &&
      (TRAVEL_ORIGIN_AIRPORTS.some((o) => o.code === u) || savedAirportOption?.code === u)
    ) {
      return u;
    }
    return CUSTOM_ORIGIN_VALUE;
  }, [originIata, savedAirportOption]);

  const applyPresetToAllTrips = useCallback(
    (p: { start: string; end: string }) => {
      const key = scenarioKey(p);
      setDatesById((prev) => {
        const next = { ...prev };
        pricedTrips.forEach((item, idx) => {
          const stableId = item._id || `idx-${idx}`;
          next[stableId] = { outbound: p.start, inbound: p.end };
        });
        return next;
      });
      const hit = quotesByScenario[key];
      if (hit) {
        setResult(hit);
        try {
          const o = originIata.trim().toUpperCase();
          if (/^[A-Z]{3}$/.test(o)) saveLastPricingSession(o, hit);
        } catch {
          /* ignore */
        }
      }
    },
    [pricedTrips, quotesByScenario, originIata],
  );

  const allTripsUsePreset = useCallback(
    (p: { start: string; end: string }) => {
      if (!pricedTrips.length) return false;
      return pricedTrips.every((item, idx) => {
        const stableId = item._id || `idx-${idx}`;
        const dr = datesById[stableId];
        return dr?.outbound === p.start && dr?.inbound === p.end;
      });
    },
    [pricedTrips, datesById],
  );

  const buildPricingEvents = useCallback(
    (getDates: (item: Item, idx: number) => DateRow) => {
      return pricedTrips.map((item, idx) => {
        const t = getTravelPayload(item);
        const dr = getDates(item, idx);
        return {
          itemId: item._id || undefined,
          title: item.title,
          destinationQuery: t?.location || '',
          outboundDate: dr.outbound,
          inboundDate: dr.inbound,
          checkIn: dr.outbound,
          checkOut: dr.inbound,
          adults: 1,
        };
      });
    },
    [pricedTrips],
  );

  const refresh = useCallback(async () => {
    if (!pricedTrips.length) return;
    setLoading(true);
    setErr(null);
    try {
      const o = originIata.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(o)) {
        setErr('Enter a valid 3-letter origin airport code (e.g. ORD).');
        setLoading(false);
        return;
      }
      const events = buildPricingEvents((item, idx) => {
        const stableId = item._id || `idx-${idx}`;
        return datesById[stableId] || { outbound: defaultIsoDate(14), inbound: defaultIsoDate(16) };
      });
      const data = await api.fetchTravelPricingPreview({ originIata: o, events });
      setResult(data);
      saveLastPricingSession(o, data);
    } catch (e) {
      setResult(null);
      setErr(e instanceof Error ? e.message : 'Pricing request failed');
    } finally {
      setLoading(false);
    }
  }, [pricedTrips, datesById, originIata, buildPricingEvents]);

  const loadQuotesAllScenarios = useCallback(async () => {
    if (!pricedTrips.length || !pricingDatePresets.length) return;
    setQuotesBatchErr(null);
    const o = originIata.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(o)) {
      setQuotesBatchErr('Enter a valid 3-letter origin airport code first.');
      return;
    }
    setQuotesBatchLoading(true);
    setQuotesBatchDone(0);
    const merged: Record<string, TravelPricingPreviewResponse> = {};
    try {
      for (let i = 0; i < pricingDatePresets.length; i++) {
        const preset = pricingDatePresets[i];
        const key = scenarioKey(preset);
        const events = buildPricingEvents(() => ({ outbound: preset.start, inbound: preset.end }));
        const data = await api.fetchTravelPricingPreview({ originIata: o, events });
        merged[key] = data;
        setQuotesByScenario({ ...merged });
        setQuotesBatchDone(i + 1);
      }
      const matchPreset = pricingDatePresets.find((p) =>
        pricedTrips.every((item, idx) => {
          const stableId = item._id || `idx-${idx}`;
          const dr = datesById[stableId];
          return dr?.outbound === p.start && dr?.inbound === p.end;
        }),
      );
      const pick = matchPreset ? merged[scenarioKey(matchPreset)] : merged[scenarioKey(pricingDatePresets[0])];
      if (pick) {
        setResult(pick);
        saveLastPricingSession(o, pick);
      }
    } catch (e) {
      setQuotesBatchErr(e instanceof Error ? e.message : 'Batch pricing failed');
    } finally {
      setQuotesBatchLoading(false);
    }
  }, [pricedTrips, pricingDatePresets, originIata, buildPricingEvents, datesById]);

  if (!pricedTrips.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 shadow-sm">
        <p className="text-sm text-travel-muted">
          No trips in the approval pipeline yet (submitted, pending, approved, or needs changes). Send cards from Plan or
          add options above, then use Refresh live quotes once trips appear here. Dates default from the team window when
          set.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Trips in approval — live pricing</h3>
        <p className="text-xs text-travel-muted mt-1 leading-relaxed">
          Pick <strong className="text-gray-800 font-medium">departure and return</strong> dates, use the grid to check{' '}
          <strong className="text-gray-800 font-medium">attendance vs event dates</strong>, and compare the cheapest flight and hotel for each team
          window. Tap a date row to apply it to every trip, then load quotes below.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="travel-pricing-origin" className="block text-xs font-medium text-gray-800">
          Flying from
        </label>
        <select
          id="travel-pricing-origin"
          value={originSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            setOriginSuggestionNote(null);
            if (v === CUSTOM_ORIGIN_VALUE) {
              setOriginIata('');
              return;
            }
            setOriginIata(v);
            persistOrigin(v);
          }}
          className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
        >
          {savedAirportOption ? (
            <option value={savedAirportOption.code}>{savedAirportOption.label}</option>
          ) : null}
          {TRAVEL_ORIGIN_AIRPORTS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
          <option value={CUSTOM_ORIGIN_VALUE}>Other airport…</option>
        </select>
        {originSelectValue === CUSTOM_ORIGIN_VALUE ? (
          <div className="space-y-1">
            <label htmlFor="travel-pricing-origin-custom" className="sr-only">
              Other airport code
            </label>
            <input
              id="travel-pricing-origin-custom"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={3}
              placeholder="3-letter code (e.g. DSM)"
              value={originIata}
              onChange={(e) => {
                setOriginSuggestionNote(null);
                setOriginIata(e.target.value.toUpperCase().replace(/[^A-Za-z]/g, '').slice(0, 3));
              }}
              onBlur={() => {
                const u = originIata.trim().toUpperCase();
                if (/^[A-Z]{3}$/.test(u)) persistOrigin(u);
              }}
              className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-900 font-mono uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
            />
            <p className="text-[11px] text-travel-muted">Use the IATA code from your ticket or airline app.</p>
          </div>
        ) : null}
        {originSuggestionNote ? (
          <p className="text-[11px] text-emerald-900/90 bg-emerald-50/80 border border-emerald-100 rounded-lg px-2.5 py-1.5">
            {originSuggestionNote}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4 shadow-sm">
        {pricingDatePresets.length > 0 ? (
          <>
            <div>
              <p className="text-xs font-semibold text-gray-900">Trip windows, attendance &amp; prices</p>
              <p className="text-[11px] text-travel-muted mt-1">
                <strong className="text-gray-800 font-medium">Tap a date row</strong> to apply that window to every trip. Cells show event
                attendance and flight/hotel lows after you load quotes.
              </p>
            </div>
            {quotesBatchErr ? (
              <div className="text-xs text-amber-900 border border-amber-200 bg-amber-50 rounded-lg px-2 py-1.5">{quotesBatchErr}</div>
            ) : null}
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="min-w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 pr-3 align-bottom font-semibold text-gray-800 whitespace-nowrap">Book trip (tap)</th>
                    {pricedTrips.map((item, idx) => {
                      const t = getTravelPayload(item);
                      const er = eventDateRangeFromPayload(t);
                      const sid = item._id || `idx-${idx}`;
                      return (
                        <th key={sid} className="py-2 px-2 align-bottom font-semibold text-gray-800 min-w-[9.5rem]">
                          <div className="leading-snug">{truncateTitle(item.title, 26)}</div>
                          {er ? (
                            <div className="text-travel-muted font-mono mt-1 font-normal">
                              Event {er.start === er.end ? er.start : `${er.start}–${er.end}`}
                            </div>
                          ) : (
                            <div className="text-amber-800/90 font-normal mt-1 leading-snug">
                              No event on card
                              <span className="block text-[10px] text-travel-muted font-normal">
                                Grid assumes mid book trip
                              </span>
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pricingDatePresets.map((preset) => {
                    const stay: DateRange = { start: preset.start, end: preset.end };
                    const key = scenarioKey(preset);
                    const scen = quotesByScenario[key];
                    const span = daySpanInclusive(stay);
                    const rowActive = allTripsUsePreset(preset);
                    return (
                      <tr key={key} className="border-t border-gray-100 align-top">
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => applyPresetToAllTrips(preset)}
                            className={`w-full text-left rounded-lg border px-2 py-1.5 transition-colors ${
                              rowActive
                                ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200'
                                : 'border-gray-200 bg-gray-50/80 hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-mono text-gray-900">
                              {preset.start} <span className="text-travel-muted">→</span> {preset.end}
                            </div>
                            <div className="text-travel-muted mt-0.5">
                              {span} day{span === 1 ? '' : 's'} stay
                              {rowActive ? <span className="ml-1 font-semibold text-emerald-800">· applied</span> : null}
                            </div>
                          </button>
                        </td>
                        {pricedTrips.map((item, idx) => {
                          const t = getTravelPayload(item);
                          const erExplicit = eventDateRangeFromPayload(t);
                          const erEffective = erExplicit ?? middleDayOfStay(stay);
                          const { ok, label } = attendanceLabel(stay, erEffective);
                          const evRes = scen?.events[idx];
                          const sid = item._id || `idx-${idx}`;
                          const assumedMid = !erExplicit;
                          return (
                            <td key={sid} className="py-2 px-2">
                              <div
                                className={
                                  ok === true ? 'text-emerald-800 font-medium' : 'text-rose-800 font-medium'
                                }
                              >
                                {ok === true ? '✓ Can attend' : '✗ Out of window'}
                              </div>
                              {assumedMid && ok === true ? (
                                <p className="text-[10px] text-travel-muted mt-0.5 leading-snug">
                                  Assumed event <span className="font-mono text-gray-700">{erEffective.start}</span> (mid
                                  of this row&apos;s trip)
                                </p>
                              ) : null}
                              {ok === false ? <p className="text-travel-muted mt-0.5 leading-snug">{label}</p> : null}
                              {scen ? (
                                <div className="mt-2 space-y-0.5 text-gray-900 border-t border-gray-100 pt-2">
                                  <p>
                                    <span className="text-travel-muted">Flight</span> · {cheapestFlightLine(evRes)}
                                  </p>
                                  <p>
                                    <span className="text-travel-muted">Hotel</span> · {cheapestHotelLine(evRes)}
                                  </p>
                                  {evRes?.hotel?.averageDistanceMinutes != null ? (
                                    <p className="text-[10px] text-travel-muted">
                                      Avg area transit ~{evRes.hotel.averageDistanceMinutes} min
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="text-travel-muted mt-2 italic">Load quotes below</p>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-travel-muted">
            No team overlap windows yet — set dates on each trip, then use <strong className="text-gray-800 font-medium">Get quotes</strong>{' '}
            below.
          </p>
        )}

        <div className="space-y-5 border-t border-gray-100 pt-4">
          <p className="text-[11px] font-medium text-gray-900">Quote detail (same order as grid columns)</p>
          {pricedTrips.map((item, idx) => {
            const stableId = item._id || `idx-${idx}`;
            const t = getTravelPayload(item);
            const dr = datesById[stableId] || { outbound: defaultIsoDate(14), inbound: defaultIsoDate(16) };
            const ev = result?.events[idx];
            const approvedBy = (t?.approvals || [])
              .filter((a) => a.status === 'approved')
              .map((a) => a.name?.trim())
              .filter((name): name is string => Boolean(name));
            return (
              <div key={stableId} className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                  <span className="font-semibold text-gray-900 leading-snug">{item.title}</span>
                  {t?.location ? <span className="text-travel-muted">· {t.location}</span> : null}
                  <span className="text-travel-muted font-mono text-[11px]">
                    · {dr.outbound} → {dr.inbound}
                  </span>
                  {t?.sourceUrl ? (
                    <>
                      <span className="text-travel-muted">·</span>
                      <a
                        href={t.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Source
                      </a>
                    </>
                  ) : null}
                  <span className="text-travel-muted">
                    · {approvedBy.length ? `Approved: ${approvedBy.join(', ')}` : 'No approvals yet'}
                  </span>
                </div>
                {pricingDatePresets.length === 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-w-md">
                    <label className="text-[11px] text-travel-muted">
                      Outbound (flight out)
                      <input
                        type="date"
                        value={dr.outbound}
                        onChange={(e) =>
                          setDatesById((p) => ({
                            ...p,
                            [stableId]: { ...dr, outbound: e.target.value },
                          }))
                        }
                        className="mt-0.5 w-full rounded-lg bg-white border border-gray-200 px-2 py-1.5 text-xs text-gray-900 shadow-sm"
                      />
                    </label>
                    <label className="text-[11px] text-travel-muted">
                      Return / checkout
                      <input
                        type="date"
                        value={dr.inbound}
                        onChange={(e) =>
                          setDatesById((p) => ({
                            ...p,
                            [stableId]: { ...dr, inbound: e.target.value },
                          }))
                        }
                        className="mt-0.5 w-full rounded-lg bg-white border border-gray-200 px-2 py-1.5 text-xs text-gray-900 shadow-sm"
                      />
                    </label>
                  </div>
                ) : null}
                {ev ? (
                  <PricingEventDetails ev={ev} />
                ) : (
                  <p className="text-xs text-travel-muted">
                    Use <strong className="text-gray-800 font-medium">Get quotes</strong> below — summaries are in the grid above.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {err ? <div className="text-sm text-amber-900 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">{err}</div> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 pt-1">
          {pricingDatePresets.length > 0 ? (
            <button
              type="button"
              disabled={quotesBatchLoading || loading}
              onClick={() => void loadQuotesAllScenarios()}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold"
            >
              {quotesBatchLoading
                ? `Loading ${quotesBatchDone}/${pricingDatePresets.length}…`
                : `Get quotes (${pricingDatePresets.length} team windows)`}
            </button>
          ) : null}
          <button
            type="button"
            disabled={loading || quotesBatchLoading}
            onClick={() => void refresh()}
            className={`py-3 rounded-xl text-sm font-semibold disabled:opacity-50 ${
              pricingDatePresets.length > 0
                ? 'flex-1 border-2 border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                : 'w-full bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {loading ? 'Loading…' : pricingDatePresets.length > 0 ? 'Current dates only' : 'Get quotes'}
          </button>
        </div>

        {onFinalizeBooking ? (
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-900">Finalize</p>
            <p className="text-[11px] text-travel-muted">
              Uses the <strong className="text-gray-800 font-medium">saved estimate</strong> on the trip and attaches{' '}
              <strong className="text-gray-800 font-medium">booking links</strong> from your last live quote run (if any).
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={finalizeBusy}
                onClick={() => void onFinalizeBooking(0)}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {finalizeBusy ? 'Saving…' : 'Mark booked (standard)'}
              </button>
              <button
                type="button"
                disabled={finalizeBusy}
                onClick={() => void onFinalizeBooking(1)}
                className="flex-1 py-2.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 text-violet-900 text-sm font-semibold"
              >
                {finalizeBusy ? 'Saving…' : 'Mark booked (flexible fare label)'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {result?.mode === 'links_only' ? (
        <p className="text-xs text-travel-muted text-center">
          No Amadeus or Duffel token — comparison links (and scrape if enabled) only for flights.
        </p>
      ) : null}
      {result?.mode === 'duffel' ? (
        <p className="text-xs text-travel-muted text-center">
          Flights via Duffel — hotels still use links unless you add Amadeus keys.
        </p>
      ) : null}
    </div>
  );
}
