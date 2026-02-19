'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Objective } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const workflowStateLabels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

interface WorkflowHistoryEntry {
  state: string;
  userId: string;
  timestamp: string;
  reason?: string;
  comment?: string;
}

interface OKRModalHistoryProps {
  objectiveId: string;
  objective?: Objective | null;
}

export function OKRModalHistory({ objectiveId, objective }: OKRModalHistoryProps) {
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowHistoryEntry[]>([]);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);

  // Use objective.workflowHistory when available (stays in sync after workflow actions)
  useEffect(() => {
    if (objective?.workflowHistory && objective.workflowHistory.length > 0) {
      const sorted = [...objective.workflowHistory].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setWorkflowHistory(sorted as WorkflowHistoryEntry[]);
      setWorkflowLoading(false);
      return;
    }
    const loadWorkflow = async () => {
      try {
        const history = await api.getWorkflowHistory(objectiveId);
        const sorted = (history || []).sort(
          (a: WorkflowHistoryEntry, b: WorkflowHistoryEntry) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setWorkflowHistory(sorted);
      } catch (err) {
        console.error('Failed to load workflow history:', err);
      } finally {
        setWorkflowLoading(false);
      }
    };
    loadWorkflow();
  }, [objectiveId, objective?.workflowHistory]);

  useEffect(() => {
    const loadAudit = async () => {
      try {
        const audit = await api.getObjectiveAudit(objectiveId);
        setAuditHistory(audit || []);
      } catch (err) {
        console.error('Failed to load audit:', err);
      } finally {
        setAuditLoading(false);
      }
    };
    loadAudit();
  }, [objectiveId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflow timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {workflowLoading ? (
            <div className="text-sm text-muted-foreground">Loading workflow history...</div>
          ) : workflowHistory.length > 0 ? (
            <div className="space-y-4">
              {workflowHistory.map((entry, idx) => (
                <div key={idx} className="border-l-2 border-muted pl-4 py-2">
                  <div className="text-sm font-medium">
                    {workflowStateLabels[entry.state] ?? entry.state}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()} by {entry.userId}
                  </div>
                  {entry.reason && (
                    <div className="text-sm mt-1">
                      <span className="text-muted-foreground">Reason: </span>
                      {entry.reason}
                    </div>
                  )}
                  {entry.comment && (
                    <div className="text-sm mt-1 text-muted-foreground">{entry.comment}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No workflow transitions yet</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="text-sm text-muted-foreground">Loading audit trail...</div>
          ) : auditHistory.length > 0 ? (
            <div className="space-y-4">
              {auditHistory.map((entry: any, idx: number) => (
                <div key={idx} className="border-l-2 border-muted pl-4 py-2">
                  <div className="text-sm font-medium">{entry.action}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()} by {entry.userId}
                  </div>
                  {entry.reason && (
                    <div className="text-sm mt-1">{entry.reason}</div>
                  )}
                  {entry.changes && entry.changes.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {entry.changes.map((change: any, i: number) => (
                        <div key={i}>
                          {change.field}: {String(change.oldValue)} → {String(change.newValue)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No audit history available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
