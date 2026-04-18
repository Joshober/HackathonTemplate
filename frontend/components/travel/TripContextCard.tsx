'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ParsedTripDocument } from '@/lib/api';
import {
  MapPin,
  Calendar,
  AlertCircle,
  Plane,
  Hotel,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';

const STORAGE_KEY = 'tripready_parsed_doc';

interface Props {
  parsed?: ParsedTripDocument | null;
  onRefresh?: () => void;
  className?: string;
}

function formatDate(d: string | null | undefined) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function TripContextCard({ parsed: parsedProp, onRefresh, className = '' }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [parsed, setParsed] = useState<ParsedTripDocument | null>(parsedProp ?? null);
  const [loading, setLoading] = useState(false);

  // Load from localStorage if not passed as prop
  useEffect(() => {
    if (parsedProp !== undefined) {
      setParsed(parsedProp);
      return;
    }
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try { setParsed(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, [parsedProp]);

  // Optionally refresh from server
  const refreshFromServer = async () => {
    setLoading(true);
    try {
      const { documents } = await api.getTripDocuments();
      if (documents.length > 0) {
        setParsed(documents[0].extracted);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(documents[0].extracted));
        onRefresh?.();
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  if (!parsed) return null;

  const departure = formatDate(parsed.travelDates?.departureDate);
  const returnDate = formatDate(parsed.travelDates?.returnDate);
  const hasVisa = parsed.visaRequirements.length > 0;
  const hasRisks = parsed.risks.length > 0;
  const hasFlights = parsed.flights.length > 0;
  const hasHotels = parsed.hotels.length > 0;

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Trip Context</p>
            <p className="text-sm font-semibold mt-0.5 leading-snug">
              {parsed.tripSummary || 'Your trip details'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshFromServer()}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Refresh from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Key info row */}
      <div className="px-4 py-3 space-y-2">
        {/* Destinations */}
        {parsed.destinations.length > 0 && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {parsed.destinations.map((d) => (
                <span key={d} className="text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full font-medium border border-blue-100">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        {(departure || returnDate) && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span>
              {departure}
              {returnDate && departure !== returnDate && <> → {returnDate}</>}
              {parsed.travelDates?.durationDays && (
                <span className="text-gray-400 ml-1">({parsed.travelDates.durationDays} days)</span>
              )}
            </span>
          </div>
        )}

        {/* Visa warnings */}
        {hasVisa && (
          <div className="space-y-1">
            {parsed.visaRequirements.map((v, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                <span className="text-amber-800">
                  <span className="font-semibold">{v.country}:</span> {v.requirement}
                  {v.note && <span className="text-amber-600"> — {v.note}</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Risk flags */}
        {hasRisks && (
          <div className="space-y-1">
            {parsed.risks.slice(0, 2).map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" />
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Expandable details */}
        {(hasFlights || hasHotels || parsed.policyHighlights.length > 0) && (
          <>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-1"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? 'Hide details' : 'Show flights & hotels'}
            </button>

            {expanded && (
              <div className="space-y-3 pt-1 border-t border-gray-100">
                {hasFlights && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Flights</p>
                    {parsed.flights.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                        <Plane className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>
                          {f.from} → {f.to}
                          {f.date && <span className="text-gray-400 ml-1">{formatDate(f.date)}</span>}
                          {f.flightNumber && <span className="text-gray-400 ml-1">({f.flightNumber})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {hasHotels && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hotels</p>
                    {parsed.hotels.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                        <Hotel className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>
                          {h.name} — {h.city}
                          {h.checkIn && <span className="text-gray-400 ml-1">{formatDate(h.checkIn)}{h.checkOut && ` → ${formatDate(h.checkOut)}`}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {parsed.policyHighlights.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Policy notes</p>
                    {parsed.policyHighlights.map((p, i) => (
                      <p key={i} className="text-xs text-gray-600">• {p}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Ask Copilot CTA */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => router.push('/assistant')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Ask Copilot about this trip
        </button>
      </div>
    </div>
  );
}
