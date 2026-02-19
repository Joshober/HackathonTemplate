'use client';

import React, { useState } from 'react';
import { Objective, WorkflowState } from '@/lib/api';
import { OKRPermissions } from '@/hooks/useOKRPermissions';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { api } from '@/lib/api';
import {
  CheckCircle2,
  XCircle,
  Send,
  FileEdit,
  Eye,
  PlayCircle,
  Flag,
  Archive,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { Label } from './ui/label';

interface OKRWorkflowStateProps {
  objective: Objective;
  permissions: OKRPermissions;
  onUpdate?: (objective: Objective) => void;
}

const workflowStateColors: Record<WorkflowState, string> = {
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  under_review: 'bg-yellow-500',
  approved: 'bg-green-500',
  active: 'bg-blue-600',
  completed: 'bg-purple-500',
  archived: 'bg-gray-400',
};

const workflowStateLabels: Record<WorkflowState, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

const workflowStateIcons: Record<WorkflowState, React.ReactNode> = {
  draft: <FileEdit className="h-4 w-4" />,
  submitted: <Send className="h-4 w-4" />,
  under_review: <Eye className="h-4 w-4" />,
  approved: <CheckCircle2 className="h-4 w-4" />,
  active: <PlayCircle className="h-4 w-4" />,
  completed: <Flag className="h-4 w-4" />,
  archived: <Archive className="h-4 w-4" />,
};

type ReasonDialogType = 'reject' | 'request-changes' | null;

export function OKRWorkflowState({ objective, permissions, onUpdate }: OKRWorkflowStateProps) {
  const [loading, setLoading] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogType>(null);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const workflowState = objective.workflowState || 'active';
  const icon = workflowStateIcons[workflowState];

  const closeReasonDialog = () => {
    setReasonDialog(null);
    setReason('');
    setComment('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const updated = await api.submitObjective(objective._id!);
      onUpdate?.(updated);
      toast.success('Submitted for approval');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit';
      toast.error(message);
      console.error('Failed to submit:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const updated = await api.approveObjective(objective._id!);
      onUpdate?.(updated);
      toast.success('Approved');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve';
      toast.error(message);
      console.error('Failed to approve:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectWithReason = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error('Reason is required for rejection');
      return;
    }
    setLoading(true);
    try {
      const updated = await api.rejectObjective(objective._id!, {
        reason: trimmed,
        comment: comment.trim() || undefined,
      });
      onUpdate?.(updated);
      toast.success('Rejected');
      closeReasonDialog();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject';
      toast.error(message);
      console.error('Failed to reject:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChangesWithReason = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error('Please describe what changes are needed');
      return;
    }
    setLoading(true);
    try {
      const updated = await api.requestChanges(objective._id!, {
        reason: trimmed,
        comment: comment.trim() || undefined,
      });
      onUpdate?.(updated);
      toast.success('Changes requested');
      closeReasonDialog();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to request changes';
      toast.error(message);
      console.error('Failed to request changes:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitReasonDialog = () => {
    if (reasonDialog === 'reject') handleRejectWithReason();
    else if (reasonDialog === 'request-changes') handleRequestChangesWithReason();
  };

  const stateBadge = (
    <Badge className={`${workflowStateColors[workflowState]} flex items-center gap-1.5 w-fit`}>
      {icon}
      {workflowStateLabels[workflowState]}
    </Badge>
  );

  return (
    <div className="flex items-center gap-4 mb-4">
      {permissions.canChangeWorkflow ? (
        stateBadge
      ) : (
        <span
          title="You don't have permission to change workflow for this OKR"
          className="inline-flex items-center gap-1.5"
        >
          {stateBadge}
          <Info className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        </span>
      )}

      {permissions.canChangeWorkflow && (
        <div className="flex gap-2 flex-wrap">
          {workflowState === 'draft' && (
            <Button size="sm" onClick={handleSubmit} disabled={loading}>
              <Send className="h-4 w-4 mr-1" />
              Submit for Approval
            </Button>
          )}
          {workflowState === 'submitted' && (
            <>
              <Button size="sm" onClick={handleApprove} disabled={loading}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReasonDialog('reject')}
                disabled={loading}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReasonDialog('request-changes')}
                disabled={loading}
              >
                Request Changes
              </Button>
            </>
          )}
          {workflowState === 'under_review' && (
            <>
              <Button size="sm" onClick={handleApprove} disabled={loading}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReasonDialog('reject')}
                disabled={loading}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReasonDialog('request-changes')}
                disabled={loading}
              >
                Request Changes
              </Button>
            </>
          )}
          {workflowState === 'approved' && (
            <Button size="sm" onClick={handleSubmit} disabled={loading}>
              <PlayCircle className="h-4 w-4 mr-1" />
              Activate
            </Button>
          )}
        </div>
      )}

      <Dialog open={reasonDialog !== null} onOpenChange={(open) => !open && closeReasonDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reasonDialog === 'reject' ? 'Reason for rejection' : 'What changes are needed?'}
            </DialogTitle>
            <DialogDescription>
              {reasonDialog === 'reject'
                ? 'Provide a reason for rejecting this OKR. The owner will see this feedback.'
                : 'Describe the changes needed. The owner will see this feedback.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonDialog === 'reject' ? 'Reason for rejection...' : 'Describe changes...'}
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="comment">Comment (optional)</Label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Additional context..."
                className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeReasonDialog} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={submitReasonDialog} disabled={loading || !reason.trim()}>
              {reasonDialog === 'reject' ? 'Reject' : 'Request Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
