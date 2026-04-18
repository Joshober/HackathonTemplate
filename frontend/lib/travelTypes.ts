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
  notes?: string;
  bookingEstimate?: TravelBookingEstimate;
  ticket?: TravelTicket;
}

export const TRAVEL_STAGES: { id: TravelStageId; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'approve', label: 'Approve' },
  { id: 'travel', label: 'Travel' },
  { id: 'return', label: 'Return' },
];
