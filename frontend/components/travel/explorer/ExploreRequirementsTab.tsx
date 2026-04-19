'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { api, type ParsedTripDocument } from '@/lib/api';

export default function ExploreRequirementsTab() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [latest, setLatest] = useState<ParsedTripDocument | null>(null);
  const [docName, setDocName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { documents } = await api.getTripDocuments();
        if (cancelled) return;
        const sorted = [...documents].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        const d = sorted[0];
        if (d?.extracted) {
          setLatest(d.extracted);
          setDocName(d.documentName || d.documentType || null);
        } else {
          setLatest(null);
          setDocName(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load documents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 flex flex-col items-center gap-2 text-sm text-travel-muted">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden />
        Loading requirements from your documents…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900">
        {err}{' '}
        <Link href="/home" className="font-medium text-red-800 underline">
          Open Home
        </Link>
        .
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 text-sm text-gray-700">
        <h2 className="text-lg font-semibold text-gray-900">Requirements</h2>
        <p className="text-travel-muted">
          No parsed itinerary in your saved documents yet. Add trip details in{' '}
          <Link href="/home" className="text-blue-600 font-medium hover:underline">
            Home
          </Link>{' '}
          or sync documents from your team workflow so we can show visa rules, dates, and risks here.
        </p>
        <Link
          href="/assistant?prefill=What%20documents%20and%20visas%20do%20I%20need%20for%20my%20saved%20trip%3F"
          className="inline-block text-xs font-semibold text-blue-700 hover:underline"
        >
          Ask Copilot while you gather documents
        </Link>
      </div>
    );
  }

  const { travelDates, destinations, visaRequirements, risks, policyHighlights } = latest;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4 text-sm text-gray-700">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Requirements</h2>
        <p className="text-travel-muted mt-1">
          Decision support from your latest upload{docName ? ` (${docName})` : ''}. Confirm everything with your org
          before booking.
        </p>
      </div>

      {(travelDates.departureDate || travelDates.returnDate) && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dates</h3>
          <p className="mt-1">
            {travelDates.departureDate || '—'} → {travelDates.returnDate || '—'}
            {travelDates.durationDays != null ? ` · ${travelDates.durationDays} days` : null}
          </p>
        </div>
      )}

      {destinations?.length ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Destinations</h3>
          <ul className="mt-1 list-disc list-inside space-y-0.5">
            {destinations.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {visaRequirements?.length ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Visa & entry</h3>
          <ul className="mt-1 space-y-2">
            {visaRequirements.map((v, i) => (
              <li key={`${v.country}-${i}`} className="border border-gray-100 rounded-lg p-2 bg-gray-50/80">
                <span className="font-medium text-gray-900">{v.country}</span>: {v.requirement}
                {v.note ? <span className="text-travel-muted"> — {v.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {risks?.length ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Risks called out</h3>
          <ul className="mt-1 list-disc list-inside space-y-1">
            {risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {policyHighlights?.length ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Policy highlights (from doc)</h3>
          <ul className="mt-1 list-disc list-inside space-y-1">
            {policyHighlights.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-1 text-xs font-medium">
        <Link href="/explore/policies" className="text-blue-600 hover:underline">
          Open Policies tab
        </Link>
        <Link
          href="/assistant?prefill=Summarize%20the%20top%203%20compliance%20risks%20for%20my%20trip%20from%20my%20parsed%20documents."
          className="text-blue-600 hover:underline"
        >
          Explain risks in Copilot
        </Link>
      </div>
    </div>
  );
}
