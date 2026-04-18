'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import type { Item } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import type { TravelTicket } from '@/lib/travelTypes';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatTodayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function minutesBefore(timeHHmm: string, minutes: number): string {
  const [h, m] = timeHHmm.split(':').map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setMinutes(d.getMinutes() - minutes);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function TravelDayItinerary({
  items,
  compact,
}: {
  items: Item[];
  /** Slim layout for Explorer tab */
  compact?: boolean;
}) {
  const [resolvedDisruption, setResolvedDisruption] = useState(false);
  const [resolving, setResolving] = useState(false);

  const today = todayIso();
  const booked = items
    .filter(isTravelItem)
    .map((item) => ({ item, t: getTravelPayload(item) }))
    .filter(
      (x): x is { item: Item; t: NonNullable<ReturnType<typeof getTravelPayload>> } =>
        x.t != null && x.t.opportunityStatus === 'booked'
    );

  const firstBooked = booked.find(
    (x) => x.t.tripRecord || x.t.travelPricingSnapshot?.events?.length || x.t.ticket
  );

  if (!firstBooked) {
    return (
      <div className={`rounded-2xl border border-dashed border-gray-200 bg-white ${compact ? 'p-4' : 'p-6'} text-center shadow-sm`}>
        <p className="text-sm text-gray-900 font-medium">No trip record on file yet</p>
        <p className="text-xs text-travel-muted mt-2">
          In <strong>Approve</strong>, refresh live quotes (optional), then use <strong>Finalize bundle</strong> to save
          your trip record and booking links here.
        </p>
        <Link href="/home" className="inline-block mt-4 text-sm text-blue-600 hover:underline font-medium">
          Go to Home
        </Link>
      </div>
    );
  }

  const { item, t } = firstBooked;
  const tripRecord = t.tripRecord;
  const snapshot = t.travelPricingSnapshot;
  const ticket = t.ticket as TravelTicket | undefined;
  const legacyTicket = ticket?.recordLocator && ticket?.flightNumber;

  const obligations: { time: string; label: string }[] = [];
  if (legacyTicket) {
    const isDepartToday = ticket.departDate === today;
    if (isDepartToday) {
      obligations.push({ time: minutesBefore(ticket.departTime, 120), label: 'Arrive at airport (2h before departure)' });
      obligations.push({ time: minutesBefore(ticket.departTime, 45), label: 'Be at gate for boarding' });
      obligations.push({ time: ticket.departTime, label: `Flight ${ticket.flightNumber} departs` });
    } else {
      obligations.push({
        time: '—',
        label: `Next flight ${ticket.departDate} at ${ticket.departTime} — today: prep and confirmations.`,
      });
    }
  } else {
    obligations.push({
      time: '—',
      label: 'Review booking links below and confirm check-in windows with your carrier or TMC.',
    });
    if (snapshot?.events?.[0]?.topFlightLine) {
      obligations.push({ time: '—', label: `Latest captured flight option: ${snapshot.events[0].topFlightLine}` });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-travel-muted">Today</p>
        <h3 className={`font-semibold text-gray-900 ${compact ? 'text-base' : 'text-lg'}`}>{formatTodayLabel()}</h3>
        <p className="text-xs text-travel-muted mt-1">
          {legacyTicket
            ? 'Legacy demo ticket on file — verify with airline.'
            : tripRecord?.checklistIntro || 'Trip record from your last pricing save.'}
        </p>
      </div>

      {/* DISRUPTION COPILOT ALERT UI (MOCK) */}
      {legacyTicket && !resolvedDisruption ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
            <h4 className="text-sm font-bold text-red-900">Urgent: Flight {ticket.flightNumber} Delayed</h4>
          </div>
          <p className="text-xs text-red-800">
            A 2-hour delay has been detected. This creates a severe missed connection risk for your onward travel.
          </p>
          <div className="bg-white/60 p-3 rounded-xl border border-red-100">
            <p className="text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-2 text-red-900/60">Copilot Resolution Options</p>
            <ul className="space-y-2">
              <li className="text-xs flex items-center justify-between text-gray-800">
                <span><strong>Option A:</strong> Rebook to 3:30 PM Delta (In-Policy)</span>
                <button 
                  onClick={() => {
                    setResolving(true);
                    setTimeout(() => setResolvedDisruption(true), 1500);
                  }}
                  disabled={resolving}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {resolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Rebook Now'}
                </button>
              </li>
              <li className="text-xs flex items-center justify-between text-gray-800 border-t border-red-200/50 pt-2">
                <span><strong>Option B:</strong> Wait for United & Claim Voucher</span>
                <button className="px-3 py-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-800 rounded-lg font-semibold min-w-[85px]">
                  Wait
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : legacyTicket && resolvedDisruption ? (
         <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-900">Disruption Resolved</span>
          </div>
          <p className="text-xs text-emerald-800">
            Copilot successfully rebooked you on the 3:30 PM Delta flight. Your new e-ticket has been sent to your email and your HR team has been notified.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-xs font-semibold text-amber-900">Must attend</p>
          <p className="text-sm text-gray-900 mt-1">
            {item.title} · {tripRecord?.locationSummary || t.location}
          </p>
        </div>
        {obligations.map((row, i) => (
          <div key={i} className="px-4 py-3 flex gap-3 text-sm">
            <span className="text-travel-muted w-24 shrink-0 font-mono text-xs">{row.time}</span>
            <span className="text-gray-800">{row.label}</span>
          </div>
        ))}
      </div>

      {tripRecord && tripRecord.bookingLinks.length > 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">Booking links</p>
          <p className="text-xs text-travel-muted">{tripRecord.title}</p>
          <ul className="space-y-2">
            {tripRecord.bookingLinks.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline font-medium">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-travel-muted">Links reflect saved pricing search — always confirm before purchase.</p>
        </div>
      ) : null}

      {snapshot?.events?.length ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 text-xs shadow-sm">
          <p className="font-semibold text-gray-900">Saved pricing snapshot</p>
          <p className="text-travel-muted">
            Origin {snapshot.originIata ?? '—'} · {snapshot.mode === 'links_only' ? 'Links-only mode' : 'Amadeus test'}{' '}
            · saved {new Date(snapshot.savedAt).toLocaleString()}
          </p>
          <ul className="space-y-1 text-travel-muted list-disc pl-4">
            {snapshot.events.slice(0, 3).map((ev, i) => (
              <li key={i}>
                {ev.tripTitle}: {ev.topFlightLine || 'No flight line'} {ev.topHotelLine ? `· ${ev.topHotelLine}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {legacyTicket ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">Legacy ticket (demo)</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div>
              <dt className="text-travel-muted">Record locator</dt>
              <dd className="text-gray-900 font-mono font-medium">{ticket.recordLocator}</dd>
            </div>
            <div>
              <dt className="text-travel-muted">Flight</dt>
              <dd className="text-gray-900 font-medium">
                {ticket.airline} {ticket.flightNumber}
              </dd>
            </div>
            <div>
              <dt className="text-travel-muted">Route</dt>
              <dd className="text-gray-900">
                {ticket.origin} → {ticket.destination}
              </dd>
            </div>
            <div>
              <dt className="text-travel-muted">Date / time</dt>
              <dd className="text-gray-900">
                {ticket.departDate} · {ticket.departTime}
              </dd>
            </div>
          </dl>
          <p className="text-[10px] text-travel-muted">Demo data — always verify with airline or TMC.</p>
        </div>
      ) : null}
    </div>
  );
}
