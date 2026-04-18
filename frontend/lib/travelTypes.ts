import type { TravelPricingEventResult } from '@/lib/api';

export type TravelStageId = 'plan' | 'approve' | 'travel' | 'return';

export type TravelChecklistStatus = 'pending' | 'done' | 'blocked';

export interface TravelChecklistItem {
  id: string;
  label: string;
  status: TravelChecklistStatus;
  source: 'trip' | 'policy' | 'approval' | 'risk' | 'post_trip';
  note?: string;
}

export type TravelApprovalState = 'not_required' | 'required' | 'submitted' | 'pending' | 'approved' | 'needs_changes';

export interface TravelApprovalTimelineStep {
  step: string;
  status: 'done' | 'pending' | 'n/a' | 'blocked';
  detail: string;
}

export interface TravelApprovalDecision {
  status: TravelApprovalState;
  requiredBy: string[];
  reasons: string[];
  fixes: string[];
  timeline: TravelApprovalTimelineStep[];
  submittedAt?: string | null;
  decisionAt?: string | null;
}

export type TravelIssueType =
  | 'delay'
  | 'cancellation'
  | 'missed_connection'
  | 'hotel_issue'
  | 'policy_exception'
  | 'medical'
  | 'security'
  | 'other';

export type TravelEscalationLevel = 'none' | 'monitor' | 'travel_desk' | 'manager' | 'emergency';

export interface TravelIncidentOption {
  id: string;
  title: string;
  details: string;
  actionType: 'self_service' | 'rebook' | 'policy' | 'contact';
}

export interface TravelIncident {
  id: string;
  type: TravelIssueType;
  severity: 'low' | 'medium' | 'high';
  summary: string;
  createdAt: string;
  details?: string;
  options: TravelIncidentOption[];
  escalation: {
    level: TravelEscalationLevel;
    reason: string;
    contact: string;
    actionNow: string;
  };
}

export type TravelFollowUpStatus = 'open' | 'done' | 'skipped';

export interface TravelFollowUpTask {
  id: string;
  type: 'expense' | 'feedback' | 'compliance' | 'communication';
  label: string;
  dueDate: string;
  status: TravelFollowUpStatus;
  owner: 'traveler' | 'copilot' | 'manager';
}

export interface TravelPrivacyMeta {
  redactionApplied: boolean;
  retainedFields: string[];
  excludedFields: string[];
  note?: string;
}

/** Last live pricing row for this trip (MongoDB via `items.travel`). */
export interface TravelPricingQuoteCache {
  savedAt: string;
  originIata: string;
  outboundDate: string;
  inboundDate: string;
  /** Team window key when all trips share one scenario, e.g. `2026-04-18|2026-04-25`. */
  scenarioKey?: string;
  event: TravelPricingEventResult;
}

export type TravelOpportunityStatus =
  | 'draft'
  | 'ready_for_approval'
  | 'submitted'
  | 'pending'
  | 'approved'
  | 'needs_changes'
  | 'booked'
  | 'completed';

export interface TravelApprovalRow {
  name: string;
  role: string;
  status: 'pending' | 'approved' | 'needs_changes';
}

/** Calculator-style totals persisted on the item (demo). */
export interface TravelBookingEstimate {
  flightLow: number;
  flightHigh: number;
  hotelPerNight: number;
  nights: number;
  totalLow: number;
  totalHigh: number;
  selectedBundle?: string;
  lastCalculatedTotal?: number;
}

/** Demo itinerary / ticket display for Travel stage. */
export interface TravelTicket {
  recordLocator: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departDate: string;
  departTime: string;
  seat?: string;
  gate?: string;
  terminal?: string;
  tripTitle?: string;
  cityLabel?: string;
}

/** Snapshot of live pricing (Amadeus or links-only) saved when user refreshes quotes in Approve. */
export interface TravelPricingSnapshotEvent {
  tripTitle: string;
  destinationQuery: string;
  resolvedIata?: string | null;
  resolvedLabel?: string | null;
  googleFlightsSearch?: string | null;
  googleHotelsSearch?: string | null;
  topFlightLine?: string;
  topHotelLine?: string;
  flightApiNote?: string | null;
  hotelApiNote?: string | null;
}

export interface TravelPricingSnapshot {
  savedAt: string;
  originIata?: string;
  mode?: string;
  scrapeEnabled?: boolean;
  events: TravelPricingSnapshotEvent[];
}

/** Human-readable trip record after finalize (not a GDS ticket). */
export interface TravelTripRecord {
  title: string;
  locationSummary: string;
  checklistIntro: string;
  bookingLinks: { label: string; url: string }[];
}

export type TravelApprovalSetup = 'team_linked' | 'needs_team';

export interface TravelItemPayload {
  location: string;
  costEstimate: number;
  tags: string[];
  tripType: string;
  imageUrl?: string;
  addedBy?: string;
  /** Server-backed when items API supports `travel` */
  opportunityStatus?: TravelOpportunityStatus;
  approvals?: TravelApprovalRow[];
  /** When submitted without an active team, reviewers are empty until user picks a team. */
  approvalSetup?: TravelApprovalSetup;
  notes?: string;
  bookingEstimate?: TravelBookingEstimate;
  /** Legacy demo PNR — prefer tripRecord + travelPricingSnapshot for new bookings */
  ticket?: TravelTicket;
  /** Persisted pricing quote snapshot + outbound booking links */
  travelPricingSnapshot?: TravelPricingSnapshot;
  /** Full last pricing API row for this trip (trimmed); written when quotes load in Approve */
  travelPricingQuoteCache?: TravelPricingQuoteCache;
  tripRecord?: TravelTripRecord;
  /** Email → selected option key (pre-book team poll) */
  teamOptionVotes?: Record<string, string>;
  /** Post-trip / Return stage — AI-generated social copy */
  instagramCaption?: string;
  instagramCaptionGeneratedAt?: string;
  sourceUrl?: string;
  /** ISO date YYYY-MM-DD for pricing / trips (optional) */
  startDate?: string;
  endDate?: string;
  checklist?: TravelChecklistItem[];
  approval?: TravelApprovalDecision;
  incidents?: TravelIncident[];
  followUps?: TravelFollowUpTask[];
  privacy?: TravelPrivacyMeta;
}

export type PlanningStage = 'chat' | 'plan' | 'approve' | 'travel' | 'return';

export interface TeamPlanDay {
  day: number;
  date: string;
  morning: string;
  afternoon: string;
  evening: string;
  hotel?: string;
}

export interface TeamPlan {
  destination: string;
  startDate: string;
  endDate: string;
  highlights: string[];
  budgetEstimateUSD: {
    low: number;
    high: number;
  };
  dayByDay: TeamPlanDay[];
  notes?: string;
  rawSummary?: string;
  generatedAt: string;
}

export const TRAVEL_STAGES: { id: TravelStageId; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'approve', label: 'Approve' },
  { id: 'travel', label: 'Travel' },
  { id: 'return', label: 'Return' },
];
