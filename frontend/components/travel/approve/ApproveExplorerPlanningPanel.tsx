'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import OpportunityCard from '@/components/travel/OpportunityCard';
import {
  api,
  type ExplorerAvailabilityCoverage,
  type ExplorerEventOption,
  type ExplorerOpportunity,
  type Item,
  type TeamCalendarCoverage,
  type TeamMemberAvailability,
} from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import type { TravelItemPayload, TravelOpportunityStatus } from '@/lib/travelTypes';
import {
  computeManualTeamOverlap,
  pickLargestInterval,
  type ManualOverlapResult,
} from '@/lib/teamAvailabilityOverlap';

const MAX_CITIES = 5;
const MAX_PER_CITY = 8;

type Props = {
  teamId: string | null;
  teamCities: string[];
  /** Same list as Home "Team trip ideas" (team return-feed, filtered + deduped by parent). */
  pipelineItems: Item[];
  onPlanningWindowChange?: (window: { start: string; end: string } | null) => void;
  /** Every common manual overlap interval (for live pricing presets on the Approve stage). */
  onOverlapPresetsChange?: (windows: { start: string; end: string }[]) => void;
  onAddEventOption?: (opt: ExplorerEventOption) => Promise<void>;
  busyOptionId?: string | null;
};

function statusPill(st: TravelOpportunityStatus | undefined) {
  const s = st || 'draft';
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    ready_for_approval: 'bg-blue-50 text-blue-800',
    submitted: 'bg-violet-50 text-violet-800',
    pending: 'bg-amber-50 text-amber-800',
    approved: 'bg-emerald-50 text-emerald-800',
    needs_changes: 'bg-red-50 text-red-800',
    booked: 'bg-emerald-100 text-emerald-900',
    completed: 'bg-orange-50 text-orange-800',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${map[s] || map.draft}`}>
      {s.replace(/_/g, ' ')}
    </span>
  );
}

/** Inclusive YYYY-MM-DD overlap. */
function tripDateRangeForWindow(t: TravelItemPayload | null): { start: string; end: string } | null {
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

function dateRangesOverlap(tripStart: string, tripEnd: string, winStart: string, winEnd: string): boolean {
  return tripStart <= winEnd && tripEnd >= winStart;
}

function formatCostLine(opt: ExplorerEventOption): string {
  const c = opt.cost;
  if (!c) return 'Est. cost: —';
  const parts: string[] = [];
  if (c.flightTotal != null) parts.push(`flight ~$${Math.round(c.flightTotal)}`);
  if (c.hotelTotal != null) parts.push(`hotel ~$${Math.round(c.hotelTotal)}`);
  if (c.ticketEstimate != null) parts.push(`tickets ~$${Math.round(c.ticketEstimate)}`);
  if (c.totalEstimated != null) parts.push(`total ~$${Math.round(c.totalEstimated)}`);
  return parts.length ? parts.join(' · ') : 'Est. cost: —';
}

export default function ApproveExplorerPlanningPanel({
  teamId,
  teamCities,
  pipelineItems,
  onPlanningWindowChange,
  onOverlapPresetsChange,
  onAddEventOption,
  busyOptionId,
}: Props) {
  const [members, setMembers] = useState<TeamMemberAvailability[]>([]);
  const [calendarCoverage, setCalendarCoverage] = useState<TeamCalendarCoverage | null>(null);
  const [overlap, setOverlap] = useState<ManualOverlapResult | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [keyword, setKeyword] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [eventOptions, setEventOptions] = useState<ExplorerEventOption[]>([]);
  const [opportunities, setOpportunities] = useState<ExplorerOpportunity[]>([]);
  const [availabilityCoverage, setAvailabilityCoverage] = useState<ExplorerAvailabilityCoverage | null>(null);
  /** When true, availability refresh will not overwrite start/end (user chose custom dates). */
  const skipAutoApplyWindowRef = useRef(false);
  const [tripWindowIsCustom, setTripWindowIsCustom] = useState(false);
  const [customDatesOpen, setCustomDatesOpen] = useState(false);
  const [planningPanelOpen, setPlanningPanelOpen] = useState(false);

  const refreshAvailability = useCallback(async () => {
    if (!teamId) {
      skipAutoApplyWindowRef.current = false;
      setTripWindowIsCustom(false);
      setMembers([]);
      setCalendarCoverage(null);
      setOverlap(null);
      return;
    }
    setLoadErr(null);
    try {
      const [avail, cov] = await Promise.all([api.getTeamAvailability(teamId), api.getTeamCalendarCoverage(teamId)]);
      setMembers(avail.members || []);
      setCalendarCoverage(cov);
      const computed = computeManualTeamOverlap(avail.members || []);
      setOverlap(computed);
      const best = pickLargestInterval(computed.commonIntervals);
      if (best && !skipAutoApplyWindowRef.current) {
        setWindowStart(best.start);
        setWindowEnd(best.end);
        setTripWindowIsCustom(false);
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load team availability');
      setMembers([]);
      setCalendarCoverage(null);
      setOverlap(null);
    }
  }, [teamId]);

  useEffect(() => {
    skipAutoApplyWindowRef.current = false;
    setTripWindowIsCustom(false);
    setCustomDatesOpen(false);
  }, [teamId]);

  useEffect(() => {
    if (overlap && overlap.commonIntervals.length === 0) {
      setCustomDatesOpen(true);
    }
  }, [overlap]);

  useEffect(() => {
    void refreshAvailability();
  }, [refreshAvailability]);

  useEffect(() => {
    onOverlapPresetsChange?.((overlap?.commonIntervals ?? []).map((iv) => ({ start: iv.start, end: iv.end })));
  }, [overlap, onOverlapPresetsChange]);

  useEffect(() => {
    if (windowStart && windowEnd && windowStart <= windowEnd) {
      onPlanningWindowChange?.({ start: windowStart, end: windowEnd });
    } else {
      onPlanningWindowChange?.(null);
    }
  }, [windowStart, windowEnd, onPlanningWindowChange]);

  const calendarByUserId = new Map((calendarCoverage?.members || []).map((m) => [m.userId, m]));

  const windowValid = Boolean(windowStart && windowEnd && windowStart <= windowEnd);

  const { tripsInWindow, tripsOutsideWindow, tripsUnknownDates } = useMemo(() => {
    const inside: Item[] = [];
    const outside: Item[] = [];
    const unknown: Item[] = [];
    if (!windowValid) {
      return { tripsInWindow: inside, tripsOutsideWindow: outside, tripsUnknownDates: unknown };
    }
    for (const item of pipelineItems) {
      const t = getTravelPayload(item);
      const range = tripDateRangeForWindow(t);
      if (!range) {
        unknown.push(item);
        continue;
      }
      if (dateRangesOverlap(range.start, range.end, windowStart, windowEnd)) {
        inside.push(item);
      } else {
        outside.push(item);
      }
    }
    return { tripsInWindow: inside, tripsOutsideWindow: outside, tripsUnknownDates: unknown };
  }, [pipelineItems, windowStart, windowEnd, windowValid]);

  const renderTeamTripCard = (item: Item) => {
    const t = getTravelPayload(item);
    const img = t?.imageUrl || item.imageUrls?.[0];
    const when =
      t?.startDate && t?.endDate
        ? `${t.startDate} → ${t.endDate}`
        : t?.startDate
          ? String(t.startDate)
          : null;
    const est = t?.costEstimate != null ? `Est. $${Number(t.costEstimate).toLocaleString()}` : null;
    return (
      <OpportunityCard
        key={item._id || item.title}
        title={item.title}
        subtitle={[t?.location, when, est].filter(Boolean).join(' · ') || undefined}
        imageUrl={img}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {statusPill(t?.opportunityStatus)}
            {t?.sourceUrl ? (
              <a
                href={t.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-600 hover:underline font-medium"
              >
                Source
              </a>
            ) : null}
          </div>
        }
      />
    );
  };

  const runSearchInWindow = async () => {
    setSearchErr(null);
    if (!teamId) {
      setSearchErr('Choose an active team on the Team tab.');
      return;
    }
    if (!windowStart || !windowEnd) {
      setSearchErr('Pick a start and end date for the team-availability window.');
      return;
    }
    if (windowStart > windowEnd) {
      setSearchErr('Start date must be on or before end date.');
      return;
    }
    const cities = teamCities.slice(0, MAX_CITIES);
    const q = keyword.trim();
    if (!cities.length && !q) {
      setSearchErr('Add team cities (full Explorer) or enter a keyword to search.');
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.searchExplorerOpportunities({
        ...(q ? { query: q } : {}),
        ...(cities.length ? { cities } : {}),
        maxPerCity: MAX_PER_CITY,
        startDate: windowStart,
        endDate: windowEnd,
        sortBy: 'date',
        sources: ['ticketmaster', 'duckduckgo', 'openstreetmap'],
        teamId,
        requireAllMembersFree: true,
        availabilityWindowStart: `${windowStart}T00:00:00Z`,
        availabilityWindowEnd: `${windowEnd}T23:59:59Z`,
      });
      setEventOptions(res.eventOptions || []);
      setOpportunities(res.opportunities || []);
      setAvailabilityCoverage(res.availabilityCoverage || null);
      if (!(res.eventOptions?.length || res.opportunities?.length)) {
        setSearchErr('No events matched. Try a broader keyword, more cities, or different dates.');
      }
    } catch (e) {
      setEventOptions([]);
      setOpportunities([]);
      setAvailabilityCoverage(null);
      setSearchErr(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {loadErr ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadErr}</div>
      ) : null}

      {!teamId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium text-gray-900">No active team</p>
          <p className="text-xs mt-1 text-amber-800/90">
            Pick a team to load shared availability, run &quot;everyone free&quot; search, and see calendar coverage.
          </p>
          <Link href="/team" className="inline-block mt-2 text-xs text-blue-700 font-medium hover:underline">
            Open Team tab
          </Link>
        </div>
      ) : null}

      {teamId ? (
        <details
          className="group rounded-2xl border border-gray-200 bg-white shadow-sm open:shadow-md transition-shadow"
          open={planningPanelOpen}
          onToggle={(e) => setPlanningPanelOpen(e.currentTarget.open)}
        >
          <summary className="list-none cursor-pointer select-none px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">Team window, availability &amp; search</h3>
                <p className="text-[11px] text-travel-muted mt-1">
                  {windowValid ? (
                    <>
                      <span className="font-medium text-gray-800">
                        {windowStart} → {windowEnd}
                      </span>
                      {overlap && overlap.commonIntervals.length > 0 ? (
                        <span> · {overlap.commonIntervals.length} overlap option(s)</span>
                      ) : null}
                    </>
                  ) : (
                    'Expand to set availability, overlaps, and event search.'
                  )}
                </p>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-travel-muted shrink-0 pt-0.5">
                {planningPanelOpen ? 'Hide' : 'Show'}
              </span>
            </div>
          </summary>
          <div className="px-4 pb-4 pt-0 space-y-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-travel-muted mt-3">
              Manual trip windows are intersected below. <strong className="text-gray-800 font-medium">Tap an overlap</strong> to use it for
              ideas and search, or open <strong className="text-gray-800 font-medium">Custom dates</strong> to try a different range. The
              longest overlap is applied on load until you override. Teammates without manual dates use Google Calendar for &quot;everyone
              free&quot; search. Saved team trips group into <strong className="text-gray-800 font-medium">in this window</strong> vs{' '}
              <strong className="text-gray-800 font-medium">outside</strong> by trip dates.
            </p>
            <p className="text-[11px] text-travel-muted mt-1">
              Team cities (up to {MAX_CITIES}):{' '}
              {teamCities.length ? teamCities.slice(0, MAX_CITIES).join(', ') : 'none — add on full Explorer or use a keyword.'}
            </p>
          </div>

          {calendarCoverage ? (
            <p className="text-xs text-gray-700">
              Calendars: {calendarCoverage.connectedMembers}/{calendarCoverage.totalMembers} connected · manual windows:{' '}
              {calendarCoverage.manualAvailabilityMembers ?? 0}/{calendarCoverage.totalMembers}
            </p>
          ) : null}

          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <p className="px-3 py-2 text-[11px] font-medium text-gray-800 bg-gray-50 border-b border-gray-100">Teammate availability</p>
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-travel-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Teammate</th>
                  <th className="px-3 py-2 font-medium">Manual trip windows</th>
                  <th className="px-3 py-2 font-medium">Calendar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-travel-muted">
                      No members loaded.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => {
                    const cal = calendarByUserId.get(m.userId);
                    const win = m.windows?.length
                      ? m.windows.map((w) => `${w.startDate} → ${w.endDate}`).join('; ')
                      : null;
                    return (
                      <tr key={m.userId} className="text-gray-800">
                        <td className="px-3 py-2 align-top">{(m.displayName || m.email || m.userId).trim()}</td>
                        <td className="px-3 py-2 align-top text-travel-muted">
                          {win || 'Calendar-only or not set'}
                        </td>
                        <td className="px-3 py-2 align-top text-travel-muted">
                          {cal?.connected ? 'Connected' : 'Not connected'}
                          {cal?.manualAvailability ? ' · manual flag' : ''}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {overlap ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-gray-900">Common manual overlap</p>
                {windowValid ? (
                  <p className="text-[11px] text-travel-muted">
                    Trip window:{' '}
                    <span className="font-semibold text-gray-800">
                      {windowStart} → {windowEnd}
                    </span>
                    {tripWindowIsCustom ? (
                      <span className="ml-1.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-900">Custom</span>
                    ) : overlap.commonIntervals.some((iv) => iv.start === windowStart && iv.end === windowEnd) ? (
                      <span className="ml-1.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-emerald-900">Overlap</span>
                    ) : (
                      <span className="ml-1.5 rounded-md bg-gray-200 px-1.5 py-0.5 text-gray-800">Other</span>
                    )}
                  </p>
                ) : null}
              </div>
              <p className="text-[11px] text-travel-muted">Select a range to compare ideas and run search. Longest overlap is chosen initially.</p>
              {overlap.commonIntervals.length ? (
                <ul className="flex flex-wrap gap-2">
                  {overlap.commonIntervals.map((iv) => {
                    const isSelected =
                      windowValid && iv.start === windowStart && iv.end === windowEnd && !tripWindowIsCustom;
                    const isExactMatch = windowValid && iv.start === windowStart && iv.end === windowEnd;
                    return (
                      <li key={`${iv.start}-${iv.end}`} className="contents">
                        <button
                          type="button"
                          onClick={() => {
                            skipAutoApplyWindowRef.current = false;
                            setTripWindowIsCustom(false);
                            setWindowStart(iv.start);
                            setWindowEnd(iv.end);
                          }}
                          aria-pressed={isExactMatch}
                          className={`text-left text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                            isExactMatch
                              ? 'bg-emerald-100 text-emerald-950 border-emerald-400 ring-1 ring-emerald-200 shadow-sm'
                              : 'bg-emerald-50/80 text-emerald-900 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200'
                          }`}
                        >
                          {iv.start} – {iv.end}
                          {isSelected ? <span className="ml-1 font-semibold">· active</span> : null}
                          {isExactMatch && tripWindowIsCustom ? <span className="ml-1 font-medium text-amber-800">· matches custom</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-travel-muted">
                  {overlap.membersWithManual.length < 2
                    ? 'Add manual availability for more teammates (or rely on calendar + search below).'
                    : 'No single range where every manual calendar overlaps — pick dates below or use search with connected calendars.'}
                </p>
              )}
              {overlap.membersWithoutManual.length ? (
                <p className="text-[11px] text-travel-muted">
                  {overlap.membersWithoutManual.length} teammate(s) have no manual windows (calendar-only or not set).
                </p>
              ) : null}
            </div>
          ) : null}

          <details
            className="group rounded-xl border border-gray-100 bg-gray-50/50 open:bg-gray-50/80 open:shadow-sm"
            open={customDatesOpen}
            onToggle={(e) => setCustomDatesOpen(e.currentTarget.open)}
          >
            <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-gray-900 select-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
              <span>Custom dates (override overlap)</span>
              <span className="text-[10px] font-normal text-travel-muted shrink-0 group-open:hidden">Tap to expand</span>
              <span className="text-[10px] font-normal text-travel-muted shrink-0 hidden group-open:inline">Hide</span>
            </summary>
            <div className="px-3 pb-3 pt-0 space-y-2 border-t border-gray-100/80">
              <p className="text-[11px] text-travel-muted pt-2">
                Set any start/end to test a different period. Search and trip grouping use these dates. Reloading team availability keeps
                custom dates until you pick an overlap again.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-travel-muted">
                  Window start
                  <input
                    type="date"
                    value={windowStart}
                    onChange={(e) => {
                      skipAutoApplyWindowRef.current = true;
                      setTripWindowIsCustom(true);
                      setWindowStart(e.target.value);
                    }}
                    className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
                  />
                </label>
                <label className="text-[11px] text-travel-muted">
                  Window end
                  <input
                    type="date"
                    value={windowEnd}
                    onChange={(e) => {
                      skipAutoApplyWindowRef.current = true;
                      setTripWindowIsCustom(true);
                      setWindowEnd(e.target.value);
                    }}
                    className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
                  />
                </label>
              </div>
              {overlap && overlap.commonIntervals.length ? (
                <button
                  type="button"
                  onClick={() => {
                    const best = pickLargestInterval(overlap.commonIntervals);
                    if (!best) return;
                    skipAutoApplyWindowRef.current = false;
                    setTripWindowIsCustom(false);
                    setWindowStart(best.start);
                    setWindowEnd(best.end);
                  }}
                  className="text-[11px] font-medium text-emerald-800 hover:text-emerald-950 underline-offset-2 hover:underline"
                >
                  Reset to longest overlap
                </button>
              ) : null}
            </div>
          </details>

          <div className="border-t border-gray-100 pt-3 space-y-4">
            <p className="text-xs font-medium text-gray-900">Team trip ideas (same as Home)</p>
            {pipelineItems.length === 0 ? (
              <p className="text-sm text-travel-muted">No trips on the team feed yet. Add from Explorer, Plan, or Home.</p>
            ) : !windowValid ? (
              <>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                  Choose a valid window start and end to split trips into in-period vs out-of-period.
                </p>
                <div className="space-y-3">{pipelineItems.map((item) => renderTeamTripCard(item))}</div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-900">
                    In this window ({tripsInWindow.length}) — overlaps {windowStart} → {windowEnd}
                  </p>
                  {tripsInWindow.length === 0 ? (
                    <p className="text-xs text-travel-muted">No saved team trips overlap this period.</p>
                  ) : (
                    <div className="space-y-3">{tripsInWindow.map((item) => renderTeamTripCard(item))}</div>
                  )}
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-800">
                    Outside this window ({tripsOutsideWindow.length})
                  </p>
                  {tripsOutsideWindow.length === 0 ? (
                    <p className="text-xs text-travel-muted">All dated trips fall inside the window above.</p>
                  ) : (
                    <div className="space-y-3">{tripsOutsideWindow.map((item) => renderTeamTripCard(item))}</div>
                  )}
                </div>
                {tripsUnknownDates.length ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-800">
                      No trip dates on record ({tripsUnknownDates.length})
                    </p>
                    <p className="text-[11px] text-travel-muted">
                      Add start/end dates on the trip (or source event time) to classify vs the window.
                    </p>
                    <div className="space-y-3">{tripsUnknownDates.map((item) => renderTeamTripCard(item))}</div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <label className="block text-[11px] text-travel-muted">
              Keyword (optional)
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. conference, music festival"
                className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900"
              />
            </label>
            {searchErr ? (
              <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">{searchErr}</div>
            ) : null}
            {availabilityCoverage ? (
              <p className="text-[11px] text-travel-muted">
                Search coverage: {availabilityCoverage.connectedMembers}/{availabilityCoverage.totalMembers} calendars considered
                {availabilityCoverage.removedByAvailability != null
                  ? ` · filtered out ${availabilityCoverage.removedByAvailability} options`
                  : ''}
                {availabilityCoverage.includedWithMissingEventTime != null &&
                availabilityCoverage.includedWithMissingEventTime > 0 ? (
                  <span className="block mt-1 text-gray-800">
                    {availabilityCoverage.includedWithMissingEventTime} result
                    {availabilityCoverage.includedWithMissingEventTime === 1 ? '' : 's'} had no event time — kept and
                    scored vs your search window (not ignored).
                  </span>
                ) : null}
                {availabilityCoverage.connectedMembers === 0 ? (
                  <span className="block mt-1 text-amber-800/90">
                    No Google calendars connected — only manual availability windows are used for &quot;everyone free&quot;.
                    Connect Calendar from Profile or Team tools if you want FreeBusy.
                  </span>
                ) : null}
              </p>
            ) : null}
            <button
              type="button"
              disabled={searchLoading}
              onClick={() => void runSearchInWindow()}
              className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-semibold"
            >
              {searchLoading ? 'Searching…' : 'Find events (everyone free in window)'}
            </button>
          </div>

          {eventOptions.length ? (
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <h4 className="text-xs font-semibold text-gray-900">More events in this window · ranked</h4>
              <p className="text-[11px] text-travel-muted">From search — scoped to the dates above.</p>
              {eventOptions.map((opt) => (
                <OpportunityCard
                  key={opt.optionId}
                  title={opt.title}
                  subtitle={[opt.city, opt.startAt ? new Date(opt.startAt).toLocaleString() : null].filter(Boolean).join(' · ')}
                  imageUrl={opt.imageUrl}
                  footer={
                    <div className="space-y-1 text-xs text-travel-muted">
                      <p>
                        <span className="text-emerald-800 font-medium">In search window</span> · Availability:{' '}
                        {opt.availability?.availableCount ?? 0}/{opt.availability?.totalMembers ?? 0}
                      </p>
                      {opt.availability?.eventTimeMissing ? (
                        <p className="text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                          No event time on this listing — team availability was checked across{' '}
                          {opt.availability.evaluationWindowStart && opt.availability.evaluationWindowEnd
                            ? `${opt.availability.evaluationWindowStart.slice(0, 10)} → ${opt.availability.evaluationWindowEnd.slice(0, 10)}`
                            : 'your window'}
                          . Confirm dates before booking.
                        </p>
                      ) : null}
                      {opt.cost?.pricingUsedAvailabilityWindow ? (
                        <p className="text-[11px] text-amber-800">
                          Cost estimate uses the first day of your search window — not a confirmed show time.
                        </p>
                      ) : null}
                      <p className="text-gray-800">{formatCostLine(opt)}</p>
                    </div>
                  }
                  action={
                    onAddEventOption ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onAddEventOption(opt);
                        }}
                        disabled={busyOptionId === opt.optionId}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold"
                      >
                        {busyOptionId === opt.optionId ? 'Adding…' : 'Add to plan'}
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          ) : null}

          {!eventOptions.length && opportunities.length ? (
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <h4 className="text-xs font-semibold text-gray-900">Web results in this window</h4>
              {opportunities.slice(0, 12).map((o) => (
                <OpportunityCard
                  key={o.id}
                  title={o.title}
                  subtitle={o.city}
                  imageUrl={o.imageUrl}
                  footer={<p className="text-xs text-travel-muted line-clamp-2">{o.snippet}</p>}
                />
              ))}
            </div>
          ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
