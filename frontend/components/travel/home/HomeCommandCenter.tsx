'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import type { Item, ParsedTripDocument } from '@/lib/api';
import { getTravelPayload } from '@/lib/travelItem';
import type { TravelStageId } from '@/lib/travelTypes';
import { TRAVEL_STAGES } from '@/lib/travelTypes';
import TravelProactiveBanner from '@/components/travel/home/TravelProactiveBanner';
import {
  deriveAlerts,
  deriveNextSteps,
  derivePrimaryTripItem,
  deriveReadinessPercent,
  hasOpenFollowUps,
  hasOpenIncidents,
  stageLabel,
} from '@/lib/travelDashboardDerive';

const JOURNEY_NODES: { id: string; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'book', label: 'Book' },
  { id: 'approval', label: 'Approval' },
  { id: 'travel', label: 'Travel' },
  { id: 'issues', label: 'Issues' },
  { id: 'return', label: 'Return' },
];

function copilotPrefillUrl(text: string): string {
  return `/assistant?prefill=${encodeURIComponent(text)}`;
}

function timelineActiveIndex(stage: TravelStageId, issuesOpen: boolean): number {
  if (stage === 'plan') return 0;
  if (stage === 'approve') return 2;
  if (stage === 'travel') return issuesOpen ? 4 : 3;
  return 5;
}

type Props = {
  travelItems: Item[];
  activeTeamId: string | null;
  parsedDoc: ParsedTripDocument | null;
  stage: TravelStageId;
};

export default function HomeCommandCenter({ travelItems, activeTeamId, parsedDoc, stage }: Props) {
  const primary = derivePrimaryTripItem(travelItems);
  const t = primary ? getTravelPayload(primary) : null;
  const readiness = deriveReadinessPercent(travelItems);
  const nextSteps = deriveNextSteps(travelItems, activeTeamId, { hasLocalParsedDoc: Boolean(parsedDoc) });
  const alerts = deriveAlerts(travelItems, activeTeamId);
  const issuesOpen = hasOpenIncidents(travelItems);
  const activeIdx = timelineActiveIndex(stage, issuesOpen);

  const checklistPreview = (() => {
    for (const i of travelItems) {
      const rows = getTravelPayload(i)?.checklist || [];
      if (rows.length) return { title: i.title, rows: rows.slice(0, 4), total: rows.length, itemId: i._id };
    }
    return null;
  })();

  const headlinePhase =
    issuesOpen && stage === 'travel'
      ? 'Action needed'
      : stage === 'return'
        ? 'Trip complete'
        : stageLabel(stage);

  const tripPurpose = (() => {
    if (parsedDoc?.tripSummary?.trim()) {
      const s = parsedDoc.tripSummary.trim();
      return s.length > 160 ? `${s.slice(0, 157)}…` : s;
    }
    if (primary?.title?.trim()) return primary.title.trim();
    const tt = t?.tripType;
    if (tt && tt !== 'business') return `${tt.replace(/_/g, ' ')} trip`;
    return null;
  })();

  const followUpsOpen = hasOpenFollowUps(travelItems);

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-travel-muted -mb-2">
        What matters now — your command center for this trip. Use Explore for options, Team for people, Copilot for
        stage-aware help.
      </p>
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Trip summary</p>
            <h2 className="text-lg font-semibold text-gray-900 mt-0.5">
              {t?.location || parsedDoc?.destinations?.[0] || 'No destination yet'}
            </h2>
            <p className="text-xs text-travel-muted mt-1">
              {t?.startDate && t?.endDate
                ? `${t.startDate} → ${t.endDate}`
                : parsedDoc?.travelDates?.departureDate && parsedDoc?.travelDates?.returnDate
                  ? `${parsedDoc.travelDates.departureDate} → ${parsedDoc.travelDates.returnDate}`
                  : 'Add dates from a document or trip card'}
            </p>
            {tripPurpose ? (
              <p className="text-xs text-gray-700 mt-2 leading-snug border-t border-gray-100 pt-2">{tripPurpose}</p>
            ) : null}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-semibold uppercase text-gray-500">Journey stage</p>
            <p className="text-sm font-semibold text-gray-900">{headlinePhase}</p>
            <p className="text-[11px] text-travel-muted mt-1">
              Readiness{' '}
              {readiness != null ? (
                <span className="font-semibold text-gray-800">{readiness}%</span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </p>
          </div>
        </div>
        <Link
          href={copilotPrefillUrl('What should I focus on next for my trip based on my current status?')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
        >
          <MessageSquare className="w-3.5 h-3.5" aria-hidden />
          Ask Copilot about this trip
        </Link>
      </section>

      <TravelProactiveBanner parsedDoc={parsedDoc} travelItems={travelItems} />

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Next action</h3>
          <Link href="/explore" className="text-[11px] font-medium text-blue-600 hover:underline">
            Help me decide (Explore)
          </Link>
        </div>
        <ul className="mt-2 space-y-2">
          {nextSteps.map((s) => (
            <li key={s.id}>
              {s.href ? (
                <Link href={s.href} className="text-sm text-gray-800 hover:text-blue-700 block">
                  {s.label}
                </Link>
              ) : (
                <span className="text-sm text-gray-800">{s.label}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {followUpsOpen ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-blue-950">Post-trip follow-ups</h3>
          <p className="text-xs text-blue-900/90">
            You still have open tasks after travel (for example expenses or feedback). Close them out so your record is
            complete.
          </p>
          <Link href="/explore/post" className="inline-block text-xs font-semibold text-blue-800 hover:underline">
            Open post-trip workspace
          </Link>
        </section>
      ) : null}

      {alerts.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-amber-950">Alerts &amp; risks</h3>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className={`text-sm ${a.tone === 'red' ? 'text-red-950' : 'text-amber-950'}`}>
                {a.href ? (
                  <Link href={a.href} className="underline hover:no-underline">
                    {a.message}
                  </Link>
                ) : (
                  a.message
                )}
              </li>
            ))}
          </ul>
          <Link
            href="/home/alerts"
            className="inline-block text-xs font-medium text-amber-900 hover:underline"
          >
            View all alerts
          </Link>
        </section>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Checklist preview</h3>
          <Link href="/home/checklist" className="text-[11px] font-medium text-blue-600 hover:underline">
            Full checklist
          </Link>
        </div>
        {checklistPreview ? (
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
            {checklistPreview.rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    r.status === 'done' ? 'bg-emerald-500' : r.status === 'blocked' ? 'bg-red-400' : 'bg-gray-300'
                  }`}
                />
                <span className={r.status === 'done' ? 'line-through text-travel-muted' : ''}>{r.label}</span>
              </li>
            ))}
            {checklistPreview.total > checklistPreview.rows.length ? (
              <li className="text-xs text-travel-muted">
                +{checklistPreview.total - checklistPreview.rows.length} more on full checklist
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-xs text-travel-muted mt-2">
            No checklist yet — typical rows include passport validity, visa or ETA, manager approval, and health
            requirements. Open Plan below or visit{' '}
            <Link href="/home/checklist" className="text-blue-600 hover:underline">
              Checklist
            </Link>{' '}
            to generate one.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Your journey</h3>
          <Link href="/home/timeline" className="text-[11px] font-medium text-blue-600 hover:underline">
            Details
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-[11px]">
          {JOURNEY_NODES.map((node, i) => {
            const active = i === activeIdx;
            const passed = i < activeIdx;
            return (
              <span key={node.id} className="inline-flex items-center gap-1">
                <span
                  className={`px-2 py-1 rounded-full font-medium ${
                    active ? 'bg-gray-900 text-white' : passed ? 'bg-emerald-100 text-emerald-900' : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  {node.label}
                </span>
                {i < JOURNEY_NODES.length - 1 ? <span className="text-gray-400 px-0.5">→</span> : null}
              </span>
            );
          })}
        </div>
        <p className="text-[10px] text-travel-muted mt-3">
          Copilot uses your journey stage for prompts: {TRAVEL_STAGES.map((s) => s.label).join(' · ')}
        </p>
      </section>
    </div>
  );
}
