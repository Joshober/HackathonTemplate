'use client';

import React, { useState } from 'react';
import { Objective, WorkflowState } from '@/lib/api';
import { OKRPermissions } from '@/hooks/useOKRPermissions';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { api } from '@/lib/api';
import { CheckCircle2, XCircle, Clock, FileCheck, Archive } from 'lucide-react';

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

export function OKRWorkflowState({ objective, permissions, onUpdate }: OKRWorkflowStateProps) {
  const [loading, setLoading] = useState(false);
  const workflowState = objective.workflowState || 'active';

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const updated = await api.submitObjective(objective._id!);
      onUpdate?.(updated);
    } catch (err) {
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
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setLoading(true);
    try {
      const updated = await api.rejectObjective(objective._id!, { reason });
      onUpdate?.(updated);
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    const reason = prompt('What changes are needed?');
    if (!reason) return;
    setLoading(true);
    try {
      const updated = await api.requestChanges(objective._id!, { reason });
      onUpdate?.(updated);
    } catch (err) {
      console.error('Failed to request changes:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 mb-4">
      <Badge className={workflowStateColors[workflowState]}>
        {workflowStateLabels[workflowState]}
      </Badge>
      
      {permissions.canChangeWorkflow && (
        <div className="flex gap-2">
          {workflowState === 'draft' && (
            <Button size="sm" onClick={handleSubmit} disabled={loading}>
              Submit for Approval
            </Button>
          )}
          {workflowState === 'submitted' && (
            <>
              <Button size="sm" onClick={handleApprove} disabled={loading}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={handleReject} disabled={loading}>
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button size="sm" variant="outline" onClick={handleRequestChanges} disabled={loading}>
                Request Changes
              </Button>
            </>
          )}
          {workflowState === 'under_review' && (
            <>
              <Button size="sm" onClick={handleApprove} disabled={loading}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={handleReject} disabled={loading}>
                Reject
              </Button>
              <Button size="sm" variant="outline" onClick={handleRequestChanges} disabled={loading}>
                Request Changes
              </Button>
            </>
          )}
          {workflowState === 'approved' && (
            <Button size="sm" onClick={handleSubmit} disabled={loading}>
              Activate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
