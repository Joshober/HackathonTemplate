import type { Item } from '@/lib/api';
import type {
  TravelApprovalDecision,
  TravelApprovalSetup,
  TravelBookingEstimate,
  TravelChecklistItem,
  TravelFollowUpTask,
  TravelIncident,
  TravelItemPayload,
  TravelOpportunityStatus,
  TravelPrivacyMeta,
  TravelPricingQuoteCache,
  TravelPricingSnapshot,
  TravelPricingSnapshotEvent,
  TravelTicket,
  TravelTripRecord,
} from '@/lib/travelTypes';

const SENTINEL = '__TRAVEL_JSON__';

export function isTravelItem(item: Item): boolean {
  if (item.travel && typeof item.travel === 'object') {
    const loc = (item.travel as { location?: unknown }).location;
    if (typeof loc === 'string' && loc.trim()) return true;
  }
  return typeof item.description === 'string' && item.description.startsWith(SENTINEL);
}

export function getTravelPayload(item: Item): TravelItemPayload | null {
  if (item.travel && typeof item.travel === 'object') {
    return normalizeTravel(item.travel as Record<string, unknown>);
  }
  if (typeof item.description === 'string' && item.description.startsWith(SENTINEL)) {
    try {
      const raw = JSON.parse(item.description.slice(SENTINEL.length)) as Record<string, unknown>;
      return normalizeTravel(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function pickBookingEstimate(raw: Record<string, unknown>): TravelBookingEstimate | undefined {
  const be = raw.bookingEstimate;
  if (!be || typeof be !== 'object' || Array.isArray(be)) return undefined;
  const o = be as Record<string, unknown>;
  const num = (k: string): number | undefined => {
    const v = typeof o[k] === 'number' ? o[k] : Number(o[k]);
    return Number.isFinite(v) ? v : undefined;
  };
  const flightLow = num('flightLow');
  const flightHigh = num('flightHigh');
  const hotelPerNight = num('hotelPerNight');
  const nights = num('nights');
  const totalLow = num('totalLow');
  const totalHigh = num('totalHigh');
  if (
    flightLow == null ||
    flightHigh == null ||
    hotelPerNight == null ||
    nights == null ||
    totalLow == null ||
    totalHigh == null
  ) {
    return undefined;
  }
  const last =
    typeof o.lastCalculatedTotal === 'number'
      ? o.lastCalculatedTotal
      : o.lastCalculatedTotal != null
        ? Number(o.lastCalculatedTotal)
        : undefined;
  return {
    flightLow,
    flightHigh,
    hotelPerNight,
    nights,
    totalLow,
    totalHigh,
    selectedBundle: typeof o.selectedBundle === 'string' ? o.selectedBundle : undefined,
    lastCalculatedTotal: Number.isFinite(last) ? last : undefined,
  };
}

function pickPricingSnapshot(raw: Record<string, unknown>): TravelPricingSnapshot | undefined {
  const s = raw.travelPricingSnapshot;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return undefined;
  const o = s as Record<string, unknown>;
  const eventsRaw = o.events;
  if (!Array.isArray(eventsRaw)) return undefined;
  const events: TravelPricingSnapshotEvent[] = eventsRaw
    .filter((e): e is Record<string, unknown> => e != null && typeof e === 'object' && !Array.isArray(e))
    .map((e) => ({
      tripTitle: typeof e.tripTitle === 'string' ? e.tripTitle : '',
      destinationQuery: typeof e.destinationQuery === 'string' ? e.destinationQuery : '',
      resolvedIata: typeof e.resolvedIata === 'string' || e.resolvedIata === null ? (e.resolvedIata as string | null) : undefined,
      resolvedLabel:
        typeof e.resolvedLabel === 'string' || e.resolvedLabel === null ? (e.resolvedLabel as string | null) : undefined,
      googleFlightsSearch:
        typeof e.googleFlightsSearch === 'string' || e.googleFlightsSearch === null
          ? (e.googleFlightsSearch as string | null)
          : undefined,
      googleHotelsSearch:
        typeof e.googleHotelsSearch === 'string' || e.googleHotelsSearch === null
          ? (e.googleHotelsSearch as string | null)
          : undefined,
      topFlightLine: typeof e.topFlightLine === 'string' ? e.topFlightLine : undefined,
      topHotelLine: typeof e.topHotelLine === 'string' ? e.topHotelLine : undefined,
      flightApiNote: typeof e.flightApiNote === 'string' || e.flightApiNote === null ? (e.flightApiNote as string | null) : undefined,
      hotelApiNote: typeof e.hotelApiNote === 'string' || e.hotelApiNote === null ? (e.hotelApiNote as string | null) : undefined,
    }));
  return {
    savedAt: typeof o.savedAt === 'string' ? o.savedAt : new Date().toISOString(),
    originIata: typeof o.originIata === 'string' ? o.originIata : undefined,
    mode: typeof o.mode === 'string' ? o.mode : undefined,
    scrapeEnabled: typeof o.scrapeEnabled === 'boolean' ? o.scrapeEnabled : undefined,
    events,
  };
}

function pickQuoteCache(raw: Record<string, unknown>): TravelPricingQuoteCache | undefined {
  const c = raw.travelPricingQuoteCache;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return undefined;
  const o = c as Record<string, unknown>;
  if (typeof o.savedAt !== 'string' || !o.event || typeof o.event !== 'object') return undefined;
  return {
    savedAt: o.savedAt,
    originIata: typeof o.originIata === 'string' ? o.originIata : '',
    outboundDate: typeof o.outboundDate === 'string' ? o.outboundDate : '',
    inboundDate: typeof o.inboundDate === 'string' ? o.inboundDate : '',
    scenarioKey: typeof o.scenarioKey === 'string' ? o.scenarioKey : undefined,
    event: o.event as TravelPricingQuoteCache['event'],
  };
}

function pickTripRecord(raw: Record<string, unknown>): TravelTripRecord | undefined {
  const tr = raw.tripRecord;
  if (!tr || typeof tr !== 'object' || Array.isArray(tr)) return undefined;
  const o = tr as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title : '';
  const locationSummary = typeof o.locationSummary === 'string' ? o.locationSummary : '';
  const checklistIntro = typeof o.checklistIntro === 'string' ? o.checklistIntro : '';
  const linksRaw = o.bookingLinks;
  const bookingLinks: TravelTripRecord['bookingLinks'] = [];
  if (Array.isArray(linksRaw)) {
    for (const row of linksRaw) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const label = typeof r.label === 'string' ? r.label : '';
      const url = typeof r.url === 'string' ? r.url : '';
      if (label && url) bookingLinks.push({ label, url });
    }
  }
  if (!title && !bookingLinks.length) return undefined;
  return { title, locationSummary, checklistIntro, bookingLinks };
}

function pickTeamOptionVotes(raw: Record<string, unknown>): Record<string, string> | undefined {
  const v = raw.teamOptionVotes;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'string' && val) out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

function pickChecklist(raw: Record<string, unknown>): TravelChecklistItem[] | undefined {
  const v = raw.checklist;
  if (!Array.isArray(v)) return undefined;
  const out: TravelChecklistItem[] = [];
  for (const row of v) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    const label = typeof r.label === 'string' ? r.label : '';
    const status = r.status;
    const source = r.source;
    if (!id || !label) continue;
    if (status !== 'pending' && status !== 'done' && status !== 'blocked') continue;
    if (source !== 'trip' && source !== 'policy' && source !== 'approval' && source !== 'risk' && source !== 'post_trip') continue;
    out.push({
      id,
      label,
      status,
      source,
      note: typeof r.note === 'string' ? r.note : undefined,
    });
  }
  return out.length ? out : undefined;
}

function pickApproval(raw: Record<string, unknown>): TravelApprovalDecision | undefined {
  const v = raw.approval;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  const status = r.status;
  if (
    status !== 'not_required' &&
    status !== 'required' &&
    status !== 'submitted' &&
    status !== 'pending' &&
    status !== 'approved' &&
    status !== 'needs_changes'
  ) {
    return undefined;
  }
  const requiredBy = Array.isArray(r.requiredBy) ? r.requiredBy.filter((x): x is string => typeof x === 'string') : [];
  const reasons = Array.isArray(r.reasons) ? r.reasons.filter((x): x is string => typeof x === 'string') : [];
  const fixes = Array.isArray(r.fixes) ? r.fixes.filter((x): x is string => typeof x === 'string') : [];
  const timelineRaw = Array.isArray(r.timeline) ? r.timeline : [];
  const timeline = timelineRaw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x))
    .map((x) => {
      const ts = x.status;
      if (ts !== 'done' && ts !== 'pending' && ts !== 'n/a' && ts !== 'blocked') return null;
      return {
        step: typeof x.step === 'string' ? x.step : '',
        status: ts as 'done' | 'pending' | 'n/a' | 'blocked',
        detail: typeof x.detail === 'string' ? x.detail : '',
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  return {
    status,
    requiredBy,
    reasons,
    fixes,
    timeline,
    submittedAt: typeof r.submittedAt === 'string' ? r.submittedAt : undefined,
    decisionAt: typeof r.decisionAt === 'string' ? r.decisionAt : undefined,
  };
}

function pickIncidents(raw: Record<string, unknown>): TravelIncident[] | undefined {
  const v = raw.incidents;
  if (!Array.isArray(v)) return undefined;
  const out: TravelIncident[] = [];
  for (const row of v) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const type = r.type;
    const severity = r.severity;
    const escalation = r.escalation;
    if (
      type !== 'delay' &&
      type !== 'cancellation' &&
      type !== 'missed_connection' &&
      type !== 'hotel_issue' &&
      type !== 'policy_exception' &&
      type !== 'medical' &&
      type !== 'security' &&
      type !== 'other'
    ) {
      continue;
    }
    if (severity !== 'low' && severity !== 'medium' && severity !== 'high') continue;
    if (!escalation || typeof escalation !== 'object' || Array.isArray(escalation)) continue;
    const e = escalation as Record<string, unknown>;
    const level = e.level;
    if (level !== 'none' && level !== 'monitor' && level !== 'travel_desk' && level !== 'manager' && level !== 'emergency') continue;
    const optionsRaw = Array.isArray(r.options) ? r.options : [];
    const options = optionsRaw
      .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o))
      .map((o) => {
        const actionType = o.actionType;
        if (actionType !== 'self_service' && actionType !== 'rebook' && actionType !== 'policy' && actionType !== 'contact') {
          return null;
        }
        return {
          id: typeof o.id === 'string' ? o.id : '',
          title: typeof o.title === 'string' ? o.title : '',
          details: typeof o.details === 'string' ? o.details : '',
          actionType: actionType as 'self_service' | 'rebook' | 'policy' | 'contact',
        };
      })
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    out.push({
      id: typeof r.id === 'string' ? r.id : '',
      type,
      severity,
      summary: typeof r.summary === 'string' ? r.summary : '',
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
      details: typeof r.details === 'string' ? r.details : undefined,
      options,
      escalation: {
        level,
        reason: typeof e.reason === 'string' ? e.reason : '',
        contact: typeof e.contact === 'string' ? e.contact : '',
        actionNow: typeof e.actionNow === 'string' ? e.actionNow : '',
      },
    });
  }
  return out.length ? out : undefined;
}

function pickFollowUps(raw: Record<string, unknown>): TravelFollowUpTask[] | undefined {
  const v = raw.followUps;
  if (!Array.isArray(v)) return undefined;
  const out: TravelFollowUpTask[] = [];
  for (const row of v) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const status = r.status;
    const type = r.type;
    const owner = r.owner;
    if (status !== 'open' && status !== 'done' && status !== 'skipped') continue;
    if (type !== 'expense' && type !== 'feedback' && type !== 'compliance' && type !== 'communication') continue;
    if (owner !== 'traveler' && owner !== 'copilot' && owner !== 'manager') continue;
    out.push({
      id: typeof r.id === 'string' ? r.id : '',
      type,
      label: typeof r.label === 'string' ? r.label : '',
      dueDate: typeof r.dueDate === 'string' ? r.dueDate : '',
      status,
      owner,
    });
  }
  return out.length ? out : undefined;
}

function pickPrivacy(raw: Record<string, unknown>): TravelPrivacyMeta | undefined {
  const v = raw.privacy;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  if (typeof r.redactionApplied !== 'boolean') return undefined;
  const retainedFields = Array.isArray(r.retainedFields)
    ? r.retainedFields.filter((x): x is string => typeof x === 'string')
    : [];
  const excludedFields = Array.isArray(r.excludedFields)
    ? r.excludedFields.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    redactionApplied: r.redactionApplied,
    retainedFields,
    excludedFields,
    note: typeof r.note === 'string' ? r.note : undefined,
  };
}

function pickTicket(raw: Record<string, unknown>): TravelTicket | undefined {
  const t = raw.ticket;
  if (!t || typeof t !== 'object' || Array.isArray(t)) return undefined;
  const o = t as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === 'string' ? o[k] : undefined);
  if (!str('recordLocator') || !str('flightNumber')) return undefined;
  return {
    recordLocator: str('recordLocator')!,
    airline: str('airline') || 'Airline',
    flightNumber: str('flightNumber')!,
    origin: str('origin') || '',
    destination: str('destination') || '',
    departDate: str('departDate') || '',
    departTime: str('departTime') || '',
    seat: str('seat'),
    gate: str('gate'),
    terminal: str('terminal'),
    tripTitle: str('tripTitle'),
    cityLabel: str('cityLabel'),
  };
}

function normalizeTravel(raw: Record<string, unknown>): TravelItemPayload | null {
  const location = typeof raw.location === 'string' ? raw.location : '';
  if (!location) return null;
  const ig = typeof raw.instagramCaption === 'string' ? raw.instagramCaption : undefined;
  const igAt =
    typeof raw.instagramCaptionGeneratedAt === 'string' ? raw.instagramCaptionGeneratedAt : undefined;
  const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl : undefined;
  const approvalSetup = raw.approvalSetup as TravelApprovalSetup | undefined;
  return {
    location,
    costEstimate: typeof raw.costEstimate === 'number' ? raw.costEstimate : Number(raw.costEstimate) || 0,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    tripType: typeof raw.tripType === 'string' ? raw.tripType : 'business',
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined,
    addedBy: typeof raw.addedBy === 'string' ? raw.addedBy : undefined,
    opportunityStatus: raw.opportunityStatus as TravelOpportunityStatus | undefined,
    approvals: Array.isArray(raw.approvals) ? (raw.approvals as TravelItemPayload['approvals']) : undefined,
    approvalSetup: approvalSetup === 'team_linked' || approvalSetup === 'needs_team' ? approvalSetup : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    bookingEstimate: pickBookingEstimate(raw),
    ticket: pickTicket(raw),
    travelPricingSnapshot: pickPricingSnapshot(raw),
    travelPricingQuoteCache: pickQuoteCache(raw),
    tripRecord: pickTripRecord(raw),
    teamOptionVotes: pickTeamOptionVotes(raw),
    instagramCaption: ig,
    instagramCaptionGeneratedAt: igAt,
    sourceUrl,
    startDate: typeof raw.startDate === 'string' ? raw.startDate : undefined,
    endDate: typeof raw.endDate === 'string' ? raw.endDate : undefined,
    checklist: pickChecklist(raw),
    approval: pickApproval(raw),
    incidents: pickIncidents(raw),
    followUps: pickFollowUps(raw),
    privacy: pickPrivacy(raw),
  };
}

export function buildTravelDescription(payload: TravelItemPayload, humanLine: string): string {
  const embedded = { ...payload, humanLine };
  return `${SENTINEL}${JSON.stringify(embedded)}`;
}

export function humanDescriptionLine(item: Item, payload: TravelItemPayload | null): string {
  if (typeof item.description === 'string' && item.description.startsWith(SENTINEL)) {
    try {
      const o = JSON.parse(item.description.slice(SENTINEL.length)) as { humanLine?: string };
      if (typeof o.humanLine === 'string') return o.humanLine;
    } catch {
      /* fall through */
    }
  }
  if (payload?.notes) return payload.notes;
  return item.description?.replace(SENTINEL, '').trim() || '';
}
