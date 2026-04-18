'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import OpportunityCard from '@/components/travel/OpportunityCard';
import { api, type Item, type TravelPricingEventResult, type TravelPricingPreviewResponse } from '@/lib/api';
import { saveLastPricingSession } from '@/lib/travelPricingSession';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';

const ORIGIN_KEY = 'travel_explorer_origin_iata';

function defaultIsoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

type DateRow = { outbound: string; inbound: string };

function bookableLabel(v: boolean | null | undefined) {
  if (v === true) return <span className="text-emerald-700 font-medium">Likely bookable (verify)</span>;
  if (v === false) return <span className="text-amber-800 font-medium">Not bookable via API</span>;
  return <span className="text-travel-muted">Unknown</span>;
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
          {bookableLabel(ev.hotel.bookable)} — {ev.hotel.reason}
        </p>
        <ul className="space-y-1 list-disc pl-4 text-travel-muted">
          {ev.hotel.offers.slice(0, 5).map((o, i) => (
            <li key={i}>
              {o.hotelName || o.hotelId || 'Hotel'} · {o.currency} {o.total}
            </li>
          ))}
        </ul>
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

export default function ApprovedEventsLivePricing({ items }: { items: Item[] }) {
  const approved = useMemo(
    () =>
      items.filter((i) => {
        if (!isTravelItem(i)) return false;
        const t = getTravelPayload(i);
        return t?.opportunityStatus === 'approved';
      }),
    [items],
  );

  const [originIata, setOriginIata] = useState('ORD');
  const [datesById, setDatesById] = useState<Record<string, DateRow>>({});
  const [result, setResult] = useState<TravelPricingPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(ORIGIN_KEY);
      if (s && /^[A-Za-z]{3}$/.test(s)) setOriginIata(s.toUpperCase());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setDatesById((prev) => {
      const next = { ...prev };
      approved.forEach((item, idx) => {
        const stableId = item._id || `idx-${idx}`;
        if (next[stableId]) return;
        const t = getTravelPayload(item);
        const out = t?.startDate || defaultIsoDate(14);
        const inn = t?.endDate || defaultIsoDate(16);
        next[stableId] = { outbound: out, inbound: inn };
      });
      return next;
    });
  }, [approved]);

  const persistOrigin = (u: string) => {
    try {
      sessionStorage.setItem(ORIGIN_KEY, u);
    } catch {
      /* ignore */
    }
  };

  const refresh = useCallback(async () => {
    if (!approved.length) return;
    setLoading(true);
    setErr(null);
    try {
      const o = originIata.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(o)) {
        setErr('Enter a valid 3-letter origin airport code (e.g. ORD).');
        setLoading(false);
        return;
      }
      const events = approved.map((item, idx) => {
        const t = getTravelPayload(item);
        const stableId = item._id || `idx-${idx}`;
        const dr = datesById[stableId] || { outbound: defaultIsoDate(14), inbound: defaultIsoDate(16) };
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
      const data = await api.fetchTravelPricingPreview({ originIata: o, events });
      setResult(data);
      saveLastPricingSession(o, data);
    } catch (e) {
      setResult(null);
      setErr(e instanceof Error ? e.message : 'Pricing request failed');
    } finally {
      setLoading(false);
    }
  }, [approved, datesById, originIata]);

  if (!approved.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 shadow-sm">
        <p className="text-sm text-travel-muted">
          No approved trips yet. Submit a plan from Home and complete approval so items reach status &quot;approved&quot;,
          then open Explorer with the Approve stage to load live quotes here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Approved events and live pricing</h3>
        <p className="text-xs text-travel-muted mt-1">
          Flights: Amadeus test API if <code className="text-gray-800 bg-gray-100 px-1 rounded">AMADEUS_CLIENT_ID</code> is set, otherwise
          Duffel if <code className="text-gray-800 bg-gray-100 px-1 rounded">DUFFEL_ACCESS_TOKEN</code> is set, otherwise links only. Hotels
          still need Amadeus. Optional scrape: <code className="text-gray-800 bg-gray-100 px-1 rounded">TRAVEL_SCRAPE_OPTIONS=1</code>
          ; SerpAPI Google Flights + DuckDuckGo engines: <code className="text-gray-800 bg-gray-100 px-1 rounded">SERPAPI_API_KEY</code>{' '}
          + <code className="text-gray-800 bg-gray-100 px-1 rounded">TRAVEL_SERPAPI_SCRAPE=1</code> (needs destination resolved to IATA for flight rows). Override:{' '}
          <code className="text-gray-800 bg-gray-100 px-1 rounded">TRAVEL_FLIGHT_PROVIDER</code> (<code className="text-gray-800 bg-gray-100 px-1 rounded">auto</code>,{' '}
          <code className="text-gray-800 bg-gray-100 px-1 rounded">amadeus</code>, <code className="text-gray-800 bg-gray-100 px-1 rounded">duffel</code>).
        </p>
      </div>

      <label className="block text-xs text-travel-muted">
        Origin airport (IATA)
        <input
          value={originIata}
          onChange={(e) => setOriginIata(e.target.value.toUpperCase().slice(0, 3))}
          onBlur={() => {
            if (/^[A-Z]{3}$/.test(originIata)) persistOrigin(originIata);
          }}
          className="mt-1 w-full max-w-[120px] rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900 font-mono uppercase shadow-sm"
          maxLength={3}
        />
      </label>

      <div className="space-y-4">
        {approved.map((item, idx) => {
          const stableId = item._id || `idx-${idx}`;
          const t = getTravelPayload(item);
          const dr = datesById[stableId] || { outbound: defaultIsoDate(14), inbound: defaultIsoDate(16) };
          const ev = result?.events[idx];
          const img = t?.imageUrl || item.imageUrls?.[0];
          return (
            <div key={stableId} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
              <OpportunityCard
                title={item.title}
                subtitle={t?.location ? t.location : 'Trip'}
                imageUrl={img}
                footer={
                  t?.sourceUrl ? (
                    <a
                      href={t.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Source link
                    </a>
                  ) : null
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-travel-muted">
                  Outbound
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
              {ev ? (
                <PricingEventDetails ev={ev} />
              ) : (
                <p className="text-xs text-travel-muted">
                  Press &quot;Refresh live quotes&quot; to load Amadeus, links, and optional scrape results.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {err ? <div className="text-sm text-amber-900 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">{err}</div> : null}

      <button
        type="button"
        disabled={loading}
        onClick={() => void refresh()}
        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold"
      >
        {loading ? 'Loading quotes…' : 'Refresh live quotes'}
      </button>

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
