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
}

export const TRAVEL_STAGES: { id: TravelStageId; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'approve', label: 'Approve' },
  { id: 'travel', label: 'Travel' },
  { id: 'return', label: 'Return' },
];
