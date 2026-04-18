/**
 * Pure date-window helpers for team manual availability (YYYY-MM-DD inclusive).
 */

export type DateDay = string;

export type DayWindow = { start: DateDay; end: DateDay };

function parseDay(s: string): number {
  const t = Date.parse(`${s.trim()}T12:00:00Z`);
  return Number.isFinite(t) ? t : NaN;
}

/** Merge overlapping / adjacent day intervals (inclusive). */
export function mergeDayIntervals(intervals: DayWindow[]): DayWindow[] {
  const valid = intervals
    .map((w) => {
      const a = parseDay(w.start);
      const b = parseDay(w.end);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      if (a > b) return { start: w.end, end: w.start } as DayWindow;
      return { start: w.start.trim(), end: w.end.trim() } as DayWindow;
    })
    .filter((x): x is DayWindow => x != null)
    .sort((x, y) => parseDay(x.start) - parseDay(y.start));

  if (!valid.length) return [];

  const out: DayWindow[] = [];
  let cur = { ...valid[0] };
  for (let i = 1; i < valid.length; i++) {
    const n = valid[i];
    const curEnd = parseDay(cur.end);
    const nStart = parseDay(n.start);
    const nEnd = parseDay(n.end);
    if (nStart <= curEnd + 86400000) {
      if (nEnd > curEnd) cur = { start: cur.start, end: n.end };
    } else {
      out.push(cur);
      cur = { ...n };
    }
  }
  out.push(cur);
  return out;
}

/** Intersection of two sets of merged inclusive day intervals. */
export function intersectDayIntervals(a: DayWindow[], b: DayWindow[]): DayWindow[] {
  if (!a.length || !b.length) return [];
  const res: DayWindow[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = parseDay(a[i].start) > parseDay(b[j].start) ? a[i].start : b[j].start;
    const end = parseDay(a[i].end) < parseDay(b[j].end) ? a[i].end : b[j].end;
    if (parseDay(start) <= parseDay(end)) {
      res.push({ start, end });
    }
    if (parseDay(a[i].end) < parseDay(b[j].end)) i++;
    else j++;
  }
  return mergeDayIntervals(res);
}

export type MemberWindowsInput = {
  userId?: string;
  displayName?: string | null;
  email?: string | null;
  windows: Array<{ startDate: string; endDate: string }>;
};

export type ManualOverlapResult = {
  /** Intersection across members who have at least one manual window. */
  commonIntervals: DayWindow[];
  /** Members included in the intersection (non-empty windows). */
  membersWithManual: MemberWindowsInput[];
  /** Members with zero manual windows (calendar-only or not set). */
  membersWithoutManual: MemberWindowsInput[];
};

/**
 * Strict manual overlap: only members with non-empty `windows` participate.
 * If fewer than two members have windows, intersection is the merged windows of that one member (or empty).
 */
export function computeManualTeamOverlap(members: MemberWindowsInput[]): ManualOverlapResult {
  const withManual: MemberWindowsInput[] = [];
  const withoutManual: MemberWindowsInput[] = [];
  for (const m of members) {
    const w = Array.isArray(m.windows) ? m.windows.filter((x) => x.startDate && x.endDate) : [];
    if (w.length) withManual.push({ ...m, windows: w });
    else withoutManual.push(m);
  }

  if (withManual.length === 0) {
    return { commonIntervals: [], membersWithManual: [], membersWithoutManual: withoutManual };
  }

  let acc: DayWindow[] | null = null;
  for (const m of withManual) {
    const raw: DayWindow[] = m.windows.map((x) => ({ start: x.startDate, end: x.endDate }));
    const merged = mergeDayIntervals(raw);
    acc = acc == null ? merged : intersectDayIntervals(acc, merged);
  }

  return {
    commonIntervals: acc ?? [],
    membersWithManual: withManual,
    membersWithoutManual: withoutManual,
  };
}

/** Longest span in days (inclusive); tie-breaker: first interval. */
export function pickLargestInterval(intervals: DayWindow[]): DayWindow | null {
  if (!intervals.length) return null;
  let best = intervals[0];
  let bestDays = daySpanInclusive(best);
  for (let i = 1; i < intervals.length; i++) {
    const d = daySpanInclusive(intervals[i]);
    if (d > bestDays) {
      best = intervals[i];
      bestDays = d;
    }
  }
  return best;
}

export function daySpanInclusive(w: DayWindow): number {
  const a = parseDay(w.start);
  const b = parseDay(w.end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}
