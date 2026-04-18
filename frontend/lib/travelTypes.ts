export type TravelStageId = 'plan' | 'approve' | 'travel' | 'return';

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
}

export const TRAVEL_STAGES: { id: TravelStageId; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'approve', label: 'Approve' },
  { id: 'travel', label: 'Travel' },
  { id: 'return', label: 'Return' },
];
