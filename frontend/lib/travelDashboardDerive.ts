import type { Item } from '@/lib/api';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import type { TravelStageId } from '@/lib/travelTypes';

const STATUS_ORDER: string[] = [
  'booked',
  'approved',
  'pending',
  'submitted',
  'ready_for_approval',
  'needs_changes',
  'draft',
  'completed',
];

export function travelItemsOf(items: Item[]): Item[] {
  return items.filter(isTravelItem);
}

export function derivePrimaryTripItem(travelItems: Item[]): Item | null {
  if (!travelItems.length) return null;
  for (const st of STATUS_ORDER) {
    const found = travelItems.find((i) => getTravelPayload(i)?.opportunityStatus === st);
    if (found) return found;
  }
  return travelItems[0];
}

/** 0–100 from checklist rows across all trips; null if no checklist rows. */
export function deriveReadinessPercent(travelItems: Item[]): number | null {
  let total = 0;
  let done = 0;
  for (const i of travelItems) {
    const rows = getTravelPayload(i)?.checklist || [];
    for (const r of rows) {
      total += 1;
      if (r.status === 'done') done += 1;
    }
  }
  if (!total) return null;
  return Math.round((done / total) * 100);
}

export function hasOpenIncidents(travelItems: Item[]): boolean {
  for (const i of travelItems) {
    const inc = getTravelPayload(i)?.incidents;
    if (Array.isArray(inc) && inc.length) return true;
  }
  return false;
}

export interface HomeNextStep {
  id: string;
  label: string;
  href?: string;
}

export type DeriveNextStepsOpts = {
  /** True when the user has parsed a document in this session (Home Plan upload). */
  hasLocalParsedDoc?: boolean;
};

export function hasOpenFollowUps(travelItems: Item[]): boolean {
  for (const i of travelItems) {
    const fus = getTravelPayload(i)?.followUps;
    if (Array.isArray(fus) && fus.some((f) => f.status === 'open')) return true;
  }
  return false;
}

export function deriveNextSteps(
  travelItems: Item[],
  activeTeamId: string | null,
  opts: DeriveNextStepsOpts = {},
): HomeNextStep[] {
  const steps: HomeNextStep[] = [];
  const { hasLocalParsedDoc = false } = opts;

  if (hasOpenFollowUps(travelItems)) {
    steps.push({
      id: 'followups',
      label: 'Submit expenses and close post-trip follow-ups',
      href: '/explore/post',
    });
  }

  const needsChanges = travelItems.filter((i) => getTravelPayload(i)?.opportunityStatus === 'needs_changes');
  if (needsChanges.length) {
    steps.push({
      id: 'fix-approval',
      label: 'Address approver feedback before re-submitting',
      href: '/assistant?prefill=' + encodeURIComponent('What should I change first to get my trip approved?'),
    });
  }

  const pendingApproval = travelItems.filter((i) => {
    const s = getTravelPayload(i)?.opportunityStatus;
    return s === 'ready_for_approval' || s === 'draft';
  });
  if (pendingApproval.length) {
    steps.push({
      id: 'submit-approval',
      label:
        pendingApproval.length > 1
          ? `Submit ${pendingApproval.length} trips for manager approval`
          : 'Submit for approval',
      href: '/home',
    });
  }

  const awaiting = travelItems.filter((i) => {
    const s = getTravelPayload(i)?.opportunityStatus;
    return s === 'submitted' || s === 'pending';
  });
  if (awaiting.length) {
    steps.push({
      id: 'await-approval',
      label: 'Track approval status or nudge reviewers',
      href: '/team/approvals',
    });
  }

  const approvedNotBooked = travelItems.filter((i) => getTravelPayload(i)?.opportunityStatus === 'approved');
  if (approvedNotBooked.length) {
    steps.push({
      id: 'book',
      label: 'Compare flight and hotel options, then finalize booking',
      href: '/explore/flights',
    });
  }

  const booked = travelItems.filter((i) => getTravelPayload(i)?.opportunityStatus === 'booked');
  if (booked.length) {
    steps.push({
      id: 'check-in',
      label: 'Check in and review your day-of trip record',
      href: '/explore/trip',
    });
  }

  const noChecklist = travelItems.some((i) => {
    const c = getTravelPayload(i)?.checklist;
    return !c || !c.length;
  });
  if (travelItems.length && noChecklist) {
    steps.push({
      id: 'checklist',
      label: 'Complete pre-trip checklist (passport, ETA, approvals)',
      href: '/home/checklist',
    });
  }

  if (!activeTeamId && travelItems.length) {
    steps.push({
      id: 'team',
      label: 'Pick who’s involved — select an active team',
      href: '/team',
    });
  }

  if (travelItems.length && !hasLocalParsedDoc) {
    steps.push({
      id: 'upload-itinerary',
      label: 'Upload an itinerary so we can parse visa and date requirements',
      href: '/home?focus=upload#trip-doc-upload',
    });
  }

  if (!steps.length && travelItems.length) {
    steps.push({
      id: 'explore',
      label: 'Compare options and policy fit in Explore',
      href: '/explore/flights',
    });
  }

  if (!travelItems.length) {
    steps.push({
      id: 'start',
      label: 'Add a trip or open Requirements in Explore to get started',
      href: '/explore/requirements',
    });
  }

  return steps.slice(0, 6);
}

export interface HomeAlert {
  id: string;
  tone: 'amber' | 'red' | 'blue';
  message: string;
  href?: string;
}

export function deriveAlerts(travelItems: Item[], activeTeamId: string | null): HomeAlert[] {
  const alerts: HomeAlert[] = [];
  if (!activeTeamId && travelItems.some((i) => getTravelPayload(i)?.opportunityStatus === 'submitted')) {
    alerts.push({
      id: 'no-team',
      tone: 'amber',
      message: 'No active team — approval reviewers may be incomplete.',
      href: '/team',
    });
  }
  for (const i of travelItems) {
    const t = getTravelPayload(i);
    if (t?.opportunityStatus === 'needs_changes') {
      alerts.push({
        id: `changes-${i._id}`,
        tone: 'red',
        message: `Policy or approval: "${(i.title || 'Trip').slice(0, 48)}" needs changes.`,
        href: '/team/approvals',
      });
    }
    const inc = t?.incidents;
    if (Array.isArray(inc) && inc.length) {
      alerts.push({
        id: `inc-${i._id}`,
        tone: 'amber',
        message: `Open travel issue on "${(i.title || 'Trip').slice(0, 40)}".`,
        href: '/home#workspace-travel',
      });
    }
  }
  return alerts.slice(0, 5);
}

export function stageLabel(stage: TravelStageId): string {
  switch (stage) {
    case 'plan':
      return 'Planning';
    case 'approve':
      return 'Awaiting approval';
    case 'travel':
      return 'Traveling now';
    case 'return':
      return 'Trip complete';
    default:
      return 'Planning';
  }
}
