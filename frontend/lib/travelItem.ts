import type { Item } from '@/lib/api';
import type {
  TravelApprovalSetup,
  TravelBookingEstimate,
  TravelItemPayload,
  TravelOpportunityStatus,
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
    tripRecord: pickTripRecord(raw),
    teamOptionVotes: pickTeamOptionVotes(raw),
    instagramCaption: ig,
    instagramCaptionGeneratedAt: igAt,
    sourceUrl,
    startDate: typeof raw.startDate === 'string' ? raw.startDate : undefined,
    endDate: typeof raw.endDate === 'string' ? raw.endDate : undefined,
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
