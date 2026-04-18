'use client';

import Link from 'next/link';
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
  const today = todayIso();
  const bookedWithTicket = items
    .filter(isTravelItem)
    .map((item) => ({ item, t: getTravelPayload(item) }))
    .filter(
      (x): x is { item: Item; t: NonNullable<ReturnType<typeof getTravelPayload>> } =>
        x.t != null && x.t.opportunityStatus === 'booked' && !!x.t.ticket
    );

  if (bookedWithTicket.length === 0) {
    return (
      <div className={`rounded-2xl border border-dashed border-white/15 ${compact ? 'p-4' : 'p-6'} text-center`}>
        <p className="text-sm text-white/90 font-medium">No ticket on file yet</p>
        <p className="text-xs text-travel-muted mt-2">
          Finalize a bundle in the <strong>Approve</strong> stage to generate demo ticket details here.
        </p>
        <Link href="/home" className="inline-block mt-4 text-sm text-blue-300 hover:underline">
          Go to Home
        </Link>
      </div>
    );
  }

  const { item, t } = bookedWithTicket[0];
  const ticket = t.ticket as TravelTicket;
  const isDepartToday = ticket.departDate === today;

  const obligations: { time: string; label: string; done?: boolean }[] = [];
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-travel-muted">Today</p>
        <h3 className={`font-semibold text-white ${compact ? 'text-base' : 'text-lg'}`}>{formatTodayLabel()}</h3>
        <p className="text-xs text-travel-muted mt-1">
          {isDepartToday
            ? 'You have a flight today — key times below.'
            : 'Ticket on file; departure is not today — prep checklist for today.'}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/10 overflow-hidden">
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-xs font-semibold text-amber-100">Must attend</p>
          <p className="text-sm text-white mt-1">
            {item.title} · {ticket.cityLabel || t.location}
          </p>
        </div>
        {obligations.map((row, i) => (
          <div key={i} className="px-4 py-3 flex gap-3 text-sm">
            <span className="text-travel-muted w-24 shrink-0 font-mono text-xs">{row.time}</span>
            <span className="text-white/90">{row.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">Ticket</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <dt className="text-travel-muted">Record locator</dt>
            <dd className="text-white font-mono font-medium">{ticket.recordLocator}</dd>
          </div>
          <div>
            <dt className="text-travel-muted">Flight</dt>
            <dd className="text-white font-medium">
              {ticket.airline} {ticket.flightNumber}
            </dd>
          </div>
          <div>
            <dt className="text-travel-muted">Route</dt>
            <dd className="text-white">
              {ticket.origin} → {ticket.destination}
            </dd>
          </div>
          <div>
            <dt className="text-travel-muted">Date / time</dt>
            <dd className="text-white">
              {ticket.departDate} · {ticket.departTime}
            </dd>
          </div>
          <div>
            <dt className="text-travel-muted">Seat</dt>
            <dd className="text-white">{ticket.seat ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-travel-muted">Gate / terminal</dt>
            <dd className="text-white">
              {ticket.gate ?? 'TBD'} · Term {ticket.terminal ?? '—'}
            </dd>
          </div>
        </dl>
        <p className="text-[10px] text-travel-muted">Demo data — always verify with airline or TMC.</p>
      </div>
    </div>
  );
}
